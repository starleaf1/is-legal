# Is Legal? (Working title)

Is Legal is a multi-tenant, SaaS-like system primarily consisting of a chatbot agent that serves an organization's employees. Its primary purpose is to provide advice regarding the legality and policy compliance of a proposed action upon being prompted.

> [!IMPORTANT]
> Is Legal's answers are not legal advice. The agent only knows what's in
> the documents an organization uploads, and like any LLM-based system it
> can be wrong. Treat an answer as a starting point and contact Legal or
> Compliance before acting on anything high-stakes.

**Status:** early prototype. It runs end to end on the Firebase emulators but
hasn't been run in production or security-audited. There are no releases yet;
`master` is the only supported version.

## How it works

The org provides all relevant documents including Code of Conduct, Company Policy, Local/Regional/National Laws, or declassified files regarding previous cases of dispute. These documents are indexed and classified. Upon being asked, Is Legal agent composes a response based on the documents provided.

## Tech stack

- Google Cloud Storage for storing documents
- Firebase Auth for authentication and access control
- Genkit and Gemini for chat capabilities
- Firestore for storing document classification and Storage paths
- Vue for frontend
- Firebase/Cloud Run Functions for back-end stuff.

## Architecture

```
 Admin uploads file ──► Cloud Storage  orgs/{orgId}/documents/{docId}/{file}
                              │ onObjectFinalized
                              ▼
                     onDocumentUploaded (functions/src/indexing)
                     extract text (unpdf, or Gemini for scans)
                     → classify (Gemini, structured output)
                     → chunk (heading-aware) → embed (gemini-embedding-001, 768d)
                              │
                              ▼
          Firestore  orgs/{orgId}/documents/{docId}   classification, status
                     orgs/{orgId}/chunks/{docId}_{n}  passage + vector (server-only)

 Employee asks ──► askIsLegal (onCallGenkit, streaming)
                   Gemini agent ── searchDocuments tool ──► findNearest on
                   (may search policy, law and          orgs/{orgId}/chunks
                    past cases separately)
                   → structured answer: verdict, per-source findings, analysis
                     with [n] citations, conditions, escalation, follow-ups
                   → saved to orgs/{orgId}/conversations/{id}/messages
```

**Tenancy.** Each user's org and role live in Firebase Auth custom claims
(`{orgId, role: "admin" | "member"}`), set with the Admin SDK (the seed script
does this on the emulators). Security rules and every function derive the org
from the verified token, never from request data. The agent's search tool is
built per request and bound to the caller's org, so the model can't choose
which tenant to search. Chunks are never readable by clients, conversations
are private to the employee who started them, and only org admins can upload
or delete documents.

**Files, not URLs.** Firestore stores each document's Storage path rather
than a download URL: download URLs are bearer tokens that bypass security
rules. The app opens files through the Storage SDK, so the rules apply on
every read.

## Layout

| Path | What |
| --- | --- |
| `src/` | Vue 3 + Vuetify app: login, chat (`pages/chat`), document admin (`pages/documents`) |
| `functions/src/indexing/` | Storage trigger and the extract → classify → chunk → embed pipeline |
| `functions/src/chat/` | The `askIsLegal` agent flow, vector search, system prompt, citations |
| `functions/src/documents/` | `deleteDocument` and `reindexDocument` admin callables |
| `functions/scripts/` | `seed.ts`, `smoke-gemini.ts`, `smoke-ask.ts` |
| `functions/seed-data/` | Fictional sample documents for two orgs (see its README) |
| `firestore.rules`, `storage.rules` | Tenant isolation; tested by `tests/*-rules.test.ts` |
| `firestore.indexes.json` | Vector indexes for `chunks` (768 dimensions, cosine) |

## Running locally (emulators)

Prerequisites:

- Node 24 (`nvm use`), with pnpm from corepack (`corepack enable`).
- Java 21+ for the Firestore and Storage emulators. If your default `java` is
  older, `scripts/with-java21.sh` uses `/usr/lib/jvm/java-21-openjdk-amd64`
  (override with `JAVA21_HOME`).
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey),
  in `functions/.secret.local` (gitignored):

  ```
  GOOGLE_GENAI_API_KEY=your-key
  ```

The Firebase CLI is a dev dependency, so you don't need it installed
globally. The `pnpm` scripts below find it; elsewhere, run it as
`pnpm exec firebase`.

Install:

```sh
pnpm install
npm --prefix functions install
```

Run, in three terminals:

```sh
pnpm emulators          # builds functions, starts Auth/Firestore/Storage/Functions; UI on :4000
pnpm functions:watch    # optional: rebuild functions on change (the emulator reloads)
pnpm dev                # web app on http://localhost:3000
```

Then seed once (and again with `-- --reset` to re-upload the sample docs):

```sh
pnpm seed
```

This creates two orgs, **Acme Corp** and **Globex Inc**, and these users
(password `password123`):

| Email | Org | Role |
| --- | --- | --- |
| `member@acme.test` | Acme Corp | member |
| `member2@acme.test` | Acme Corp | member |
| `admin@acme.test` | Acme Corp | admin (can manage documents) |
| `admin@globex.test` | Globex Inc | admin |

`pnpm emulators` keeps data between runs in `.emulator-data/`;
`pnpm emulators:fresh` starts empty.

The emulators run as project `demo-is-legal`, so nothing touches a real
Firebase project. Gemini calls do go to the real API and count against your
key's quota.

## Checks

```sh
pnpm test:rules                     # Firestore + Storage rules: tenant isolation, privacy
npm --prefix functions test         # chunker and citation unit tests
npm --prefix functions run lint
pnpm lint && pnpm type-check && pnpm build-only
npm --prefix functions run smoke:gemini   # live Gemini capability check (needs the key)
pnpm smoke:ask                      # end-to-end questions against the seeded emulators
```

`smoke:ask` asks the agent the demo questions as different users and fails if
a verdict is off or any citation points outside the caller's org. One question
is a canary: Globex's gifts policy has a "Platinum Hospitality Allowance",
and an Acme employee asking about it must not get Globex's rules.

Things to try in the app as `member@acme.test`:

- "A vendor offered me courtside tickets worth $400. They won't attend. Can I accept?"
- "A customs officer asked for $20 in cash to clear our shipment today. Can I pay?"
- "Can I paste our customer list into a public AI chatbot?"

As `admin@acme.test`, open **Documents** to upload a PDF, Markdown or text
file and watch it get classified and indexed, then ask about it.

## Tuning

`functions/src/config.ts` holds the models, chunk sizes, search limits and
the distance cutoff. `ANSWER_MODE=simulated` (environment variable) switches
the agent from Gemini's native JSON schema to a prompt-described schema, in
case a model rejects tools combined with a response schema. Changing the
embedding model or dimensions requires re-indexing (Documents → re-index, or
`pnpm seed -- --reset`) and updating `firestore.indexes.json`.

## Deploying your own instance

Nobody has run Is Legal in production yet, so expect rough edges. One
deployment is one Firebase project, which can host any number of orgs.

1. Create a Firebase project and upgrade it to the Blaze plan (Cloud
   Functions and Secret Manager need it). Enable Firestore, Storage and
   Authentication with the Email/Password provider.
2. Sign in and select your project for this checkout:

   ```sh
   firebase login
   firebase use your-project-id
   ```

   `firebase use` stores the choice on your machine, not in the repo. The
   committed `.firebaserc` points at the demo project, so a `firebase deploy`
   without a selected project fails instead of reaching a real one.
3. Store your Gemini key as a secret. Read [Privacy](#privacy) before
   choosing which key to use.

   ```sh
   firebase functions:secrets:set GOOGLE_GENAI_API_KEY
   ```

4. Register a web app in the Firebase console, copy `.env.example` to
   `.env.production.local` and fill in the app's config.
5. `firebase deploy` (rules, the vector indexes, functions and hosting).
   Vector indexes take a few minutes to build.
6. Create orgs and users with the Admin SDK. There's no sign-up flow or
   member management UI yet. `functions/scripts/seed.ts` shows how; it
   refuses to run outside the emulators, so adapt a copy. Each org needs:
   - an `orgs/{orgId}` Firestore document with `name` (string) and
     `defaultJurisdiction` (string or `null`), where `orgId` matches
     `[A-Za-z0-9_-]{1,128}`;
   - an Auth user per person with custom claims
     `{orgId, role: "admin" | "member"}`. Claims take effect the next time
     the user signs in, or within an hour when their ID token refreshes.

Before real use, consider App Check on the callables, budget alerts on the
project, and a region near your users (`REGION` in `functions/src/config.ts`
and `FUNCTIONS_REGION` in `src/plugins/firebase.ts`). `setGlobalOptions` in
`functions/src/index.ts` caps each function at 10 instances.

## Privacy

Uploaded documents and employees' questions are sent to the Gemini API to
classify, embed and answer them. On the Gemini API's unpaid tier, Google may
use that content to improve its products and human reviewers may read it;
Google asks you not to send sensitive, confidential or personal information
there. Use a key on a paid tier for real documents, and check the current
[Gemini API terms](https://ai.google.dev/gemini-api/terms) yourself. The
sample documents in `functions/seed-data/` are fictional, so the local demo
is fine on a free key.

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the
development workflow and the rules every change has to keep.

## Security

Please don't report vulnerabilities in public issues, especially anything
that lets one org see another org's data. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
