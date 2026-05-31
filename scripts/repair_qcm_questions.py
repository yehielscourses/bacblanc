#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Corrige les questions QCM connues comme mal extraites et valide la banque."""

from __future__ import annotations

import json
import sys
from pathlib import Path

TRUTH_TABLE_HEADER = "\U0001d44e\n\U0001d44f\n(\U0001d44e or \U0001d44f) and \U0001d44e"

TRUTH_TABLE_A = (
    f"{TRUTH_TABLE_HEADER}\n"
    "False\nFalse\nFalse\n"
    "False\nTrue\nFalse\n"
    "True\nFalse\nTrue\n"
    "True\nTrue\nTrue"
)

TRUTH_TABLE_B = (
    f"{TRUTH_TABLE_HEADER}\n"
    "False\nFalse\nFalse\n"
    "False\nTrue\nFalse\n"
    "True\nFalse\nFalse\n"
    "True\nTrue\nTrue"
)

TRUTH_TABLE_C = (
    f"{TRUTH_TABLE_HEADER}\n"
    "False\nFalse\nFalse\n"
    "False\nTrue\nFalse\n"
    "True\nFalse\nFalse\n"
    "False\nTrue\nTrue"
)

TRUTH_TABLE_D = (
    f"{TRUTH_TABLE_HEADER}\n"
    "False\nFalse\nFalse\n"
    "False\nTrue\nFalse\n"
    "True\nFalse\nFalse\n"
    "False\nTrue\nFalse"
)

FIXES: dict[int, dict] = {
    169: {
        "reponses": [
            {
                "lettre": "A",
                "texte": "la liaison \u00e9tant coup\u00e9e, le serveur ne sera plus accessible",
            },
            {
                "lettre": "B",
                "texte": "le t\u00e9l\u00e9chargement n\u2019est pas interrompu car les paquets peuvent transiter par le routeur D",
            },
            {
                "lettre": "C",
                "texte": "le t\u00e9l\u00e9chargement est interrompu, Vivien doit red\u00e9marrer une nouvelle connexion \u00e0 partir de\nz\u00e9ro",
            },
            {
                "lettre": "D",
                "texte": "le t\u00e9l\u00e9chargement se poursuit mais des donn\u00e9es seront perdues",
            },
        ],
    },
    232: {
        "reponses": [
            {"lettre": "A", "texte": "a"},
            {"lettre": "B", "texte": " "},
            {"lettre": "C", "texte": "@"},
            {"lettre": "D", "texte": "\u00e9"},
        ],
    },
    274: {
        "reponses": [
            {"lettre": "A", "texte": "15"},
            {"lettre": "B", "texte": "16"},
            {"lettre": "C", "texte": "18"},
            {"lettre": "D", "texte": "20"},
        ],
    },
    385: {
        "reponses": [
            {"lettre": "A", "texte": "def test(a,b):\nreturn a[0] < b[0]"},
            {"lettre": "B", "texte": "def test(a,b):\nreturn a[1] < b[1]"},
            {"lettre": "C", "texte": "def test(a,b):\nreturn a[0] > b[0]"},
            {"lettre": "D", "texte": "def test(a,b):\nreturn a[1] > b[1]"},
        ],
    },
    452: {
        "reponses": [
            {"lettre": "A", "texte": TRUTH_TABLE_A},
            {"lettre": "B", "texte": TRUTH_TABLE_B},
            {"lettre": "C", "texte": TRUTH_TABLE_C},
            {"lettre": "D", "texte": TRUTH_TABLE_D},
        ],
    },
}


def validate_question(q: dict) -> list[str]:
    problems: list[str] = []
    reponses = q.get("reponses") or []
    letters = [r.get("lettre") for r in reponses]
    if len(reponses) != 4:
        problems.append(f"{len(reponses)} r\u00e9ponses")
    if len(set(letters)) != len(letters):
        problems.append("lettres dupliqu\u00e9es")
    expected = {"A", "B", "C", "D"}
    if set(letters) != expected:
        problems.append(f"lettres invalides: {letters}")
    for r in reponses:
        texte = r.get("texte")
        if texte is None or texte == "":
            problems.append(f"texte vide pour {r.get('lettre')}")
    br = q.get("bonne_reponse")
    if br and br not in expected:
        problems.append(f"bonne_reponse {br!r} invalide")
    return problems


def apply_fixes(data: dict) -> int:
    count = 0
    for question in data["questions"]:
        qid = question["id"]
        if qid in FIXES:
            question.update(FIXES[qid])
            count += 1
    return count


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    paths = [
        root / "annales-nsi-premiere" / "qcm-json" / "toutes-questions-uniques.json",
        root
        / "annales-nsi-premiere"
        / "qcm-json"
        / "toutes-questions-uniques-avec-corrections.json",
    ]

    for path in paths:
        with path.open(encoding="utf-8") as f:
            data = json.load(f)
        n = apply_fixes(data)
        bad = [(q["id"], validate_question(q)) for q in data["questions"] if validate_question(q)]
        with path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{path.name}: {n} correction(s), {len(bad)} question(s) encore invalide(s)")
        if bad:
            for qid, probs in bad[:10]:
                print(f"  id {qid}: {', '.join(probs)}")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
