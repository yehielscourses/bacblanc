# bacblanc

Annales **E3C NSI Première** (PDF + QCM JSON) et application web d’entraînement.

## Application QCM

Quiz interactif avec corrections, déployé sur **GitHub Pages** :

**https://yehielscourses.github.io/bacblanc/**

- **Série E3C** : 42 questions aléatoires, note sur 42 et sous-notes par thème (A–G)
- **Mode illimité** : note sur 100 (100 dernières réponses) et sous-notes par thème sur 20 (20 dernières par thème)
- Les questions répondues **correctement** ne reviennent plus
- Thème d’affichage : clair, sombre ou système

### Développement local

```bash
bash scripts/prepare_quiz_app.sh   # optionnel si docs/data/qcm.json est à jour
cd docs && python3 -m http.server 8765
```

Ouvrir http://localhost:8765

### Données

605 questions uniques dans `annales-nsi-premiere/qcm-json/toutes-questions-uniques-avec-corrections.json`.

Voir [annales-nsi-premiere/README.md](annales-nsi-premiere/README.md) pour la collecte des PDF et l’extraction.
