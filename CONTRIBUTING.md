# Contributing to Is Legal

Thanks for helping out. Bug reports, fixes, docs and features are all
welcome. For anything bigger than a small fix, please open an issue first so
we can agree on the approach before you put time into it.

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).

## Setup

Follow [Running locally](README.md#running-locally-emulators) in the README.
Everything runs on the Firebase emulators as the `demo-is-legal` project. You
only need a Gemini API key for indexing and answering questions; the rules
tests, unit tests, lint and type checks run without one.

## Before opening a pull request

Run the checks that cover your change:

```sh
pnpm test:rules                     # needed for any change to firestore.rules or storage.rules
npm --prefix functions test
npm --prefix functions run lint
pnpm lint && pnpm type-check && pnpm build-only
```

If you change the agent, prompt, retrieval or indexing, also run
`pnpm smoke:ask` against seeded emulators and say in the pull request how it
went. It calls the live Gemini API, so it isn't required for other changes.

## Rules every change has to keep

Is Legal holds several organizations' documents in one deployment, so most of
these are about keeping tenants apart:

- Server code gets the caller's org from their verified token
  (`requireMember` / `requireAdmin` in `functions/src/shared/auth.ts`),
  never from request data or model output. Build Firestore paths with the
  helpers in `functions/src/shared/paths.ts`.
- Agent tools are bound to the caller's org when the request starts. The
  model must never be able to choose which org it searches.
- `chunks` stay server-only, and conversations stay private to the employee
  who started them.
- Store Storage paths, never download URLs. A download URL bypasses the
  security rules.
- Changes to `firestore.rules` or `storage.rules` come with tests in `tests/`.
- Seed data stays fictional: no real laws, companies or people.
- Never commit secrets. The Gemini key belongs in `functions/.secret.local`
  and web config in `.env.*.local`; both are gitignored.

## Style

- Web app: ESLint with `eslint-config-vuetify` (`pnpm lint` fixes most issues).
- Functions: ESLint with the Google config (`npm --prefix functions run lint`).
- Match the surrounding code. Comments explain why, not what.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/),
  for example `fix(chat): drop citations outside the caller's org`.

## Reporting security issues

Don't open a public issue for a vulnerability. See [SECURITY.md](SECURITY.md).
