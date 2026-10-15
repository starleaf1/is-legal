# Is Legal? (Working title)
Is Legal is a multi-tenant, SaaS-like system primarily consisting of a chatbot agent that serves an organization's employee. Its primary purpose is to provide advice regarding the legality and policy compliance of a proposed action upon being prompted.

# How it works
The org provides all relevant documents including Code of Conduct, Company Policy, Local/Regional/National Laws, or declassified files regarding previous cases of dispute. These documents are indexed and classified. Upon being asked, Is Legal agent composes a response based on the documents provided.

# Tech Stack
- Google Cloud Storage for storing documents
- Firebase Auth for authentication and access control
- Genkit and Gemini for chat capabilities
- Firestore for storing document classification and URLs
- Vue for frontend
- Firebase/Cloud Run Functions for back-end stuff.

# Prototype

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
(`{orgId, role: "admin" | "member"}`), set by the seed script. Security rules
and every function derive the org from the verified token, never from request
data. The agent's search tool is built per request and bound to the caller's
org, so the model can't choose which tenant to search. Chunks are never
readable by clients, conversations are private to the employee who started
them, and only org admins can upload or delete documents.

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
- A Gemini API key from Google AI Studio, in `functions/.secret.local`
  (gitignored):

  ```
  GOOGLE_GENAI_API_KEY=your-key
  ```

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

The emulators run as project `demo-is-legal`, so nothing touches the real
`is-legal` project. Gemini calls do go to the real API.

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

## Deploying (not done yet)

1. Upgrade the `is-legal` project to the Blaze plan and enable Firestore,
   Storage, Auth (email/password) and Secret Manager.
2. `firebase functions:secrets:set GOOGLE_GENAI_API_KEY`
3. Copy `.env.example` to `.env.production.local` and fill in the web app config.
4. `firebase deploy` (rules, the vector indexes, functions and hosting).
   Vector indexes take a few minutes to build.
5. Create org records and users with custom claims (adapt `functions/scripts/seed.ts`;
   it refuses to run outside the emulators).

Consider App Check on the callables, and a region near your users (`REGION`
in `functions/src/config.ts` and `FUNCTIONS_REGION` in `src/plugins/firebase.ts`).
