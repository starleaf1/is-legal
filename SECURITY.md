# Security policy

Is Legal is multi-tenant: one deployment holds several organizations'
documents and their employees' questions. Bugs that break that isolation are
the most serious kind.

## Reporting a vulnerability

Please don't open a public issue. Report it privately through GitHub's
[security advisory form](https://github.com/starleaf1/is-legal/security/advisories/new).

Include what's affected, how to reproduce it (ideally on the local emulators
with the seed data), and what an attacker could do with it. You'll be credited
in the advisory unless you'd rather not be. There is no bug bounty.

## Supported versions

There are no releases yet. Fixes land on `master`.

## Scope

In scope:

- Reading or changing another org's data (documents, chunks, conversations,
  members) through the app, the callables, the security rules or the agent.
- Reading another employee's conversations within the same org.
- A member doing something only admins can: uploading, deleting or
  re-indexing documents.
- Prompt injection, through a question or an uploaded document, that leaks
  another org's or another employee's data.
- Secrets exposed by the code, the build or the git history.

Out of scope:

- Wrong or misleading answers about law or policy. Those are bugs, so please
  open a regular issue, but they aren't security issues.
- The seed accounts and their shared password. They exist only on the local
  emulators.
- Weaknesses that come from how someone configured their own deployment,
  such as a missing App Check setup or using an unpaid Gemini API key.
