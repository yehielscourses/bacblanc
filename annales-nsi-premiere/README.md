# Annales E3C — Spécialité NSI — Classe de Première

Téléchargement des sujets officiels de la banque nationale E3C (épreuve QCM, 7×6 questions, 2 h, calculatrice interdite, note = points × 20/42) pour la spécialité **Numérique et sciences informatiques (NSI)** en classe de **Première**.

## Contenu

| Dossier | Fichiers PDF | Source |
|---------|-------------|--------|
| `2020/` | 53 | [sujetdebac.fr — E3C NSI Première 2020](https://www.sujetdebac.fr/annales/sujets-e3c/spe-numerique-informatique/premiere/2020/) |
| `2021/` | 51 | [sujetdebac.fr — E3C NSI Première 2021](https://www.sujetdebac.fr/annales/sujets-e3c/spe-numerique-informatique/premiere/2021/) |
| `eduscol-officiel/` | 0 | — |
| **Total** | **104** | |

### Détail 2020

- **52 slugs** extraits (`spe-numerique-informatique-premiere-*`), dont le sujet zéro.
- **53 PDF** : 51 sujets officiels + sujet zéro (sujet + corrigé officiels pour `premiere-zero-1`).

### Détail 2021

- **51 slugs**, **51 PDF** (un sujet officiel par slug).

Les fichiers portent le nom d’origine sur sujetdebac.fr (ex. `e3c-spe-numerique-informatique-premiere-03316-sujet-officiel.pdf`).

## Méthode de collecte

1. Extraction des slugs `spe-numerique-informatique-premiere-*` sur chaque page année.
2. Pour chaque slug : page `https://www.sujetdebac.fr/annales/sujets-e3c/{slug}` ? liens `/sujets-e3c-pdf/spe-numerique-informatique/*.pdf`.
3. Téléchargement avec `curl -L` dans le sous-dossier de l’année.

Page d’index générale : [sujetdebac.fr — NSI Première](https://www.sujetdebac.fr/annales/sujets-e3c/spe-numerique-informatique/premiere/) (seules les années **2020** et **2021** sont listées).

## Recherche complémentaire (Éduscol / education.gouv.fr)

Recherche effectuée le **31 mai 2026** sur :

- [eduscol.education.gouv.fr — NSI voie générale](https://eduscol.education.gouv.fr/5823/programmes-et-ressources-en-numerique-et-sciences-informatiques-voie-g)
- [education.gouv.fr — Banque nationale de sujets](https://www.education.gouv.fr/reussir-au-lycee/la-banque-nationale-de-sujets-470525)
- [sujets.examens-concours.gouv.fr — DELOS NSI](https://sujets.examens-concours.gouv.fr/delos/public/bgt/nsi) (accès réservé / bac terminale)
- [sti.eduscol.education.fr — Bac NSI](https://sti.eduscol.education.fr/formations/bac-voie-generale/specialite-nsi-numerique-et-sciences-informatiques) (épreuves **Terminale** écrites et pratiques, sessions 2022–2025)

**Résultat :** aucun PDF d’annales **Première** post-2021 (évaluation ponctuelle QCM pour élèves abandonnant la spé NSI) n’a été trouvé en libre accès sur ces portails. Les ressources officielles récentes concernent le **bac de Terminale** (épreuves écrites 3 h 30 et pratique), pas la banque E3C Première.

**Contexte :** l’évaluation ponctuelle NSI en Première (QCM 42 questions) relève de la réforme du bac 2020–2021. [sujetdebac.fr](https://www.sujetdebac.fr/annales/sujets-e3c/spe-numerique-informatique/premiere/) ne référence plus d’années après 2021. La BNS actuelle (portail ministériel) ne publie pas, en accès public, l’équivalent indexé de ces 104 sujets pour les années suivantes.

Le dossier `eduscol-officiel/` est donc **vide** ; il est réservé à d’éventuels ajouts futurs si le ministère republie ces sujets.

## QCM extraits (JSON)

Les QCM de chaque PDF sont exportés dans `qcm-json/`, en conservant l’arborescence par année :

| Dossier | Fichiers JSON |
|---------|----------------|
| `qcm-json/2020/` | 53 |
| `qcm-json/2021/` | 51 |

Un fichier JSON porte le même nom de base que le PDF (ex. `e3c-spe-numerique-informatique-premiere-03316-sujet-officiel.json`).

Structure d’un fichier :

- métadonnées : `source_pdf`, `slug`, `annee`, `code`, `type` (`sujet` ou `corrige`)
- `themes` : 7 thèmes (A–G), chacun avec 6 questions
- chaque question : `numero`, `enonce`, `reponses` (lettres A–D)

Régénération :

```bash
pip install pymupdf
python3 scripts/extract_qcm_from_pdfs.py
```

**Limites :** les PDF du sujet zéro 2020 (`zero-1-sujet` et `zero-1-corrige`) utilisent une police non extractible ; les JSON correspondants indiquent `extraction: "echec"`.

## Vérification

```bash
find /workspace/annales-nsi-premiere -name '*.pdf' | wc -l
# Attendu : 104 (103 sujets + 1 corrigé sujet zéro 2020)

find /workspace/annales-nsi-premiere/qcm-json -name '*.json' | wc -l
# Attendu : 104
```

## Date du téléchargement

**31 mai 2026**
