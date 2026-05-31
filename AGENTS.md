# AGENTS.md

Guidance for AI agents working in this repository.

## Cursor Cloud specific instructions

This repository is currently a **greenfield stub**: the only tracked file is `README.md` (`# bacblanc`). There is no application source, dependency manifest, Docker setup, CI config, or test suite on `main`.

### Services

| Service | Required? | Notes |
|---------|-----------|--------|
| — | — | Nothing to start until an app stack is added |

### Lint / test / build / run

Not applicable yet. Once code lands, document the real commands here (for example `npm run lint`, `npm test`, `npm run dev`) and add them to the repo README.

### VM update script

The cloud VM update script is a no-op (`true`) because there are no project dependencies to refresh on pull.

### When code is added

Future agents should update this section with:

- Non-obvious startup order (e.g. database before API)
- Required environment variables (point to `.env.example`)
- Port numbers and health-check URLs
- Any gotchas discovered during local development (hot reload, migrations, etc.)
