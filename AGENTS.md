# AGENTS.md

Guidance for AI agents working in this repository.

## Cursor Cloud specific instructions

This repository hosts **E3C NSI Première** annales (PDF) and extracted QCM JSON under `annales-nsi-premiere/`.

### Services

| Service | Required? | Notes |
|---------|-----------|--------|
| — | — | No runtime services |

### Lint / test / build / run

| Command | Purpose |
|---------|---------|
| `pip install -r requirements.txt` | PDF extraction dependency (`pymupdf`) |
| `python3 scripts/extract_qcm_from_pdfs.py` | Regenerate `annales-nsi-premiere/qcm-json/` from PDFs |
| `python3 scripts/add_qcm_corrections.py` | Generate `toutes-questions-uniques-avec-corrections.json` from batch files in `corrections-batches/` |

### VM update script

The cloud VM update script is a no-op (`true`) because there are no project dependencies to refresh on pull.

### When code is added

Future agents should update this section with:

- Non-obvious startup order (e.g. database before API)
- Required environment variables (point to `.env.example`)
- Port numbers and health-check URLs
- Any gotchas discovered during local development (hot reload, migrations, etc.)
