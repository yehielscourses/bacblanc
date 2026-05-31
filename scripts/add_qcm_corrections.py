#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Enrichit toutes-questions-uniques.json avec bonne_reponse et explication."""

from __future__ import annotations

import json
from pathlib import Path

SUFFIX_DESCRIPTION = (
    " \u2014 avec bonne r\u00e9ponse et explication pour chaque question"
)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    qcm_dir = root / "annales-nsi-premiere" / "qcm-json"
    source_path = qcm_dir / "toutes-questions-uniques.json"
    corrections_dir = qcm_dir / "corrections-batches"
    output_path = qcm_dir / "toutes-questions-uniques-avec-corrections.json"

    with source_path.open(encoding="utf-8") as f:
        data = json.load(f)

    answers: dict[int, dict] = {}
    for batch_file in sorted(corrections_dir.glob("batch-*.json")):
        with batch_file.open(encoding="utf-8") as f:
            batch = json.load(f)
        for entry in batch:
            qid = entry["id"]
            if qid in answers:
                raise ValueError(f"Reponse dupliquee pour la question {qid}")
            answers[qid] = {
                "bonne_reponse": entry["bonne_reponse"],
                "explication": entry["explication"],
            }

    enriched = []
    missing = []
    for question in data["questions"]:
        qid = question["id"]
        copy = dict(question)
        if qid in answers:
            copy["bonne_reponse"] = answers[qid]["bonne_reponse"]
            copy["explication"] = answers[qid]["explication"]
        else:
            missing.append(qid)
        enriched.append(copy)

    if missing:
        raise SystemExit(
            f"Corrections manquantes pour {len(missing)} question(s): {missing[:10]}..."
        )

    result = {
        **{k: v for k, v in data.items() if k != "questions"},
        "description": data.get("description", "") + SUFFIX_DESCRIPTION,
        "nombre_questions_avec_correction": len(enriched),
        "questions": enriched,
    }

    with output_path.open("w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Ecrit {len(enriched)} questions dans {output_path.relative_to(root)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
