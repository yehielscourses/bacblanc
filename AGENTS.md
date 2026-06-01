# AGENTS.md

Guidance for AI agents working in this repository.

## Cursor Cloud specific instructions

This repository hosts **E3C NSI Première** annales (PDF) and extracted QCM JSON under `annales-nsi-premiere/`.

### Services

| Service | Required? | Notes |
|---------|-----------|--------|
| — | — | No runtime services (quiz is static HTML/JS) |

### Web app QCM (GitHub Pages)

| Item | Detail |
|------|--------|
| Sources | `docs/` — static quiz served at `https://yehielscourses.github.io/bacblanc/` |
| Données | `docs/data/qcm.json` (copie de `annales-nsi-premiere/qcm-json/toutes-questions-uniques-avec-corrections.json`) |
| Déploiement | Push sur `main` → workflow `.github/workflows/pages.yml` (source : dossier `/docs`) |
| Préparer les données | `bash scripts/prepare_quiz_app.sh` après régénération du JSON source |
| Dev local | `cd docs && python3 -m http.server 8765` puis http://localhost:8765 |

Activer GitHub Pages dans le dépôt : **Settings → Pages → Build and deployment → GitHub Actions** (ou source « Deploy from branch » sur `/docs` si vous n’utilisez pas le workflow).

### Lint / test / build / run

| Command | Purpose |
|---------|---------|
| `pip install -r requirements.txt` | PDF extraction dependency (`pymupdf`) |
| `python3 scripts/extract_qcm_from_pdfs.py` | Regenerate `annales-nsi-premiere/qcm-json/` from PDFs (indentation via coordonnées x0) |
| `python3 scripts/build_unique_questions.py` | Rebuild `toutes-questions-uniques.json` after extraction |
| `python3 scripts/add_qcm_corrections.py` | Generate `toutes-questions-uniques-avec-corrections.json` from batch files in `corrections-batches/` |
| `python3 scripts/repair_qcm_questions.py` | Fix known bad extractions in the unique-questions JSON files |
| `bash scripts/prepare_quiz_app.sh` | Copy corrected bank into `docs/data/qcm.json` for the web app |

### VM update script

The cloud VM update script is a no-op (`true`) because there are no project dependencies to refresh on pull.

### When code is added

Future agents should update this section with:

- Non-obvious startup order (e.g. database before API)
- Required environment variables (point to `.env.example`)
- Port numbers and health-check URLs
- Any gotchas discovered during local development (hot reload, migrations, etc.)
