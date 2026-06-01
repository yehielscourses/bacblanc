#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Merge per-subject JSON files into a deduplicated unique question bank."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def normalize_enonce(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def build_unique_questions(qcm_dir: Path) -> dict:
    source_files = sorted(qcm_dir.glob("20*/*sujet-officiel.json"))
    seen: set[str] = set()
    questions: list[dict] = []
    total_sources = 0

    for path in source_files:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        if data.get("extraction") != "ok":
            continue
        for theme in data.get("themes", []):
            for q in theme.get("questions", []):
                total_sources += 1
                key = normalize_enonce(q["enonce"])
                if key in seen:
                    continue
                seen.add(key)
                questions.append(
                    {
                        "id": len(questions) + 1,
                        "numero_original": q["numero"],
                        "theme_id": theme["id"],
                        "theme_nom": theme.get("nom", ""),
                        "enonce": q["enonce"],
                        "reponses": q["reponses"],
                    }
                )

    return {
        "description": (
            "Banque unique de questions QCM NSI Premi\u00e8re (E3C), "
            "d\u00e9doublonn\u00e9es par \u00e9nonc\u00e9"
        ),
        "sources": f"{len(source_files)} fichiers JSON dans annales-nsi-premiere/qcm-json/",
        "nombre_questions_total_sources": total_sources,
        "nombre_questions_uniques": len(questions),
        "doublons_exclus": total_sources - len(questions),
        "questions": questions,
    }


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    qcm_dir = root / "annales-nsi-premiere" / "qcm-json"
    output = qcm_dir / "toutes-questions-uniques.json"

    if not qcm_dir.is_dir():
        print(f"Dossier introuvable: {qcm_dir}", file=sys.stderr)
        return 1

    data = build_unique_questions(qcm_dir)
    with output.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(
        f"{data['nombre_questions_total_sources']} sources -> "
        f"{data['nombre_questions_uniques']} uniques "
        f"({data['doublons_exclus']} doublons exclus)"
    )
    print(f"Ecrit {output.relative_to(root)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
