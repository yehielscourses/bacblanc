#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Extract QCM from E3C NSI Premiere PDF sujets into JSON files."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import fitz

THEME_RE = re.compile(r"^Th\u00e8me\s+([A-G])\s*:\s*(.+)$")
QUESTION_RE = re.compile(r"^Question\s+([A-G])\.(\d*)$")
ANSWER_LETTER_RE = re.compile(r"^[A-D]$")
SKIP_LINE_RE = re.compile(
    r"^(Page\s+\d+\s*/\s*\d+|G1SNSIN\d+|G2SNSIN\d+)$"
)


def extract_code(doc: fitz.Document) -> str | None:
    text = doc[0].get_text()
    m = re.search(r"(G[12]SNSIN\d+)", text)
    return m.group(1) if m else None


def extract_lines_from_doc(doc: fitz.Document) -> list[str]:
    """Text lines from question pages (skip cover / answer sheet)."""
    chunks: list[str] = []
    for i in range(4, len(doc)):
        chunks.append(doc[i].get_text())
    lines: list[str] = []
    for raw in "\n".join(chunks).splitlines():
        line = raw.strip()
        if not line or SKIP_LINE_RE.match(line):
            continue
        lines.append(line)
    return lines


def validate_reponses(reponses: list[dict[str, str]]) -> str | None:
    """Retourne un message d'avertissement si les réponses semblent mal extraites."""
    letters = [r.get("lettre") for r in reponses]
    if len(reponses) != 4:
        return f"attendu 4 réponses, extrait {len(reponses)}"
    if len(set(letters)) != 4 or set(letters) != {"A", "B", "C", "D"}:
        return f"lettres invalides: {letters}"
    empty = [r["lettre"] for r in reponses if r.get("texte", "") == ""]
    if len(empty) == len(reponses):
        return "toutes les réponses sont vides"
    if empty:
        return f"réponses vides: {', '.join(empty)}"
    return None


def parse_answers(lines: list[str], start: int) -> tuple[list[dict[str, str]], int]:
    reponses: list[dict[str, str]] = []
    i = start
    current_letter: str | None = None
    current_parts: list[str] = []

    def flush() -> None:
        nonlocal current_letter, current_parts
        if current_letter is not None:
            reponses.append(
                {"lettre": current_letter, "texte": "\n".join(current_parts).strip()}
            )
        current_letter = None
        current_parts = []

    while i < len(lines):
        line = lines[i]
        if THEME_RE.match(line) or QUESTION_RE.match(line):
            break
        if ANSWER_LETTER_RE.match(line):
            flush()
            current_letter = line
            i += 1
            continue
        if current_letter is not None:
            current_parts.append(line)
        i += 1

    flush()
    return reponses, i


def parse_qcm_lines(lines: list[str]) -> list[dict]:
    themes: list[dict] = []
    theme_index: dict[str, dict] = {}
    i = 0

    while i < len(lines):
        theme_m = THEME_RE.match(lines[i])
        if theme_m:
            theme_id, theme_name = theme_m.group(1), theme_m.group(2).strip()
            if theme_id not in theme_index:
                theme_data = {
                    "id": theme_id,
                    "nom": theme_name,
                    "questions": [],
                }
                theme_index[theme_id] = theme_data
                themes.append(theme_data)
            else:
                theme_index[theme_id]["nom"] = theme_name
            i += 1
            continue

        question_m = QUESTION_RE.match(lines[i])
        if question_m:
            theme_id = question_m.group(1)
            q_num_str = question_m.group(2)
            if q_num_str:
                q_num = int(q_num_str)
            else:
                prev = theme_index.get(theme_id, {}).get("questions", [])
                q_num = (
                    max(int(q["numero"].split(".")[1]) for q in prev) + 1
                    if prev
                    else 1
                )
            numero = f"{theme_id}.{q_num}"
            i += 1
            enonce_parts: list[str] = []
            reponses_label = "R\u00e9ponses"
            while i < len(lines) and lines[i] != reponses_label:
                enonce_parts.append(lines[i])
                i += 1
            if i < len(lines) and lines[i] == reponses_label:
                i += 1
            reponses, i = parse_answers(lines, i)

            if theme_id not in theme_index:
                theme_data = {
                    "id": theme_id,
                    "nom": "",
                    "questions": [],
                }
                theme_index[theme_id] = theme_data
                themes.append(theme_data)

            question = {
                "numero": numero,
                "enonce": "\n".join(enonce_parts).strip(),
                "reponses": reponses,
            }
            warn = validate_reponses(reponses)
            if warn:
                question["avertissement_extraction"] = warn
            theme_index[theme_id]["questions"].append(question)
            continue

        i += 1

    return themes


def pdf_is_readable(doc: fitz.Document) -> bool:
    for i in range(min(8, len(doc))):
        text = doc[i].get_text()
        if "Question A.1" in text or "Th\u00e8me A" in text:
            return True
    return False


def extract_from_pdf(pdf_path: Path) -> dict:
    doc = fitz.open(pdf_path)
    root = Path(__file__).resolve().parents[1]
    rel = pdf_path.relative_to(root)
    parts = pdf_path.parts
    annee = next((p for p in parts if p.isdigit() and len(p) == 4), None)
    slug = re.sub(
        r"-(sujet|corrige)-officiel$",
        "",
        pdf_path.stem.replace("e3c-", "", 1),
    )

    meta = {
        "source_pdf": str(rel).replace("\\", "/"),
        "fichier": pdf_path.name,
        "slug": slug,
        "annee": annee,
        "code": extract_code(doc),
        "type": "corrige" if "corrige" in pdf_path.name else "sujet",
        "nombre_questions_attendu": 42,
    }

    if not pdf_is_readable(doc):
        return {
            **meta,
            "extraction": "echec",
            "erreur": "Texte non extractible (police personnalisee / PDF non structure).",
            "themes": [],
        }

    lines = extract_lines_from_doc(doc)
    themes = parse_qcm_lines(lines)
    total = sum(len(t["questions"]) for t in themes)

    result = {
        **meta,
        "extraction": "ok",
        "nombre_questions": total,
        "themes": themes,
    }
    if total != 42:
        result["avertissement"] = f"Attendu 42 questions, extrait {total}."
    doc.close()
    return result


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    pdf_root = root / "annales-nsi-premiere"
    out_dir = root / "annales-nsi-premiere" / "qcm-json"

    if not pdf_root.exists():
        print(f"Dossier introuvable: {pdf_root}", file=sys.stderr)
        return 1

    pdfs = sorted(
        p for p in pdf_root.rglob("*.pdf") if "qcm-json" not in p.parts
    )
    if not pdfs:
        print("Aucun PDF trouve.", file=sys.stderr)
        return 1

    out_dir.mkdir(parents=True, exist_ok=True)
    stats = {"ok": 0, "echec": 0, "avertissement": 0}

    for pdf_path in pdfs:
        data = extract_from_pdf(pdf_path)
        out_name = pdf_path.stem + ".json"
        year_dir = data.get("annee") or "inconnu"
        out_path = out_dir / year_dir / out_name
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with out_path.open("w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

        if data.get("extraction") == "ok":
            stats["ok"] += 1
            if "avertissement" in data:
                stats["avertissement"] += 1
        else:
            stats["echec"] += 1
        mark = "OK" if data.get("extraction") == "ok" else "FAIL"
        print(f"{mark} {out_name}")

    print(
        f"\n{len(pdfs)} files -> {out_dir}\n"
        f"  ok: {stats['ok']}\n"
        f"  failed: {stats['echec']}\n"
        f"  warnings (not 42 questions): {stats['avertissement']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
