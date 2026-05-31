#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Tests unitaires pour la reconstruction d'indentation PDF."""

from __future__ import annotations

import unittest
from pathlib import Path

import fitz

from extract_qcm_from_pdfs import (
    cluster_x_positions,
    extract_from_pdf,
    extract_lines_from_doc,
    indent_prefix_for_x,
)


class IndentHelpersTest(unittest.TestCase):
    def test_cluster_merges_close_x(self) -> None:
        clusters = cluster_x_positions([70.9, 71.2, 85.1, 106.0, 106.5])
        self.assertEqual(len(clusters), 3)
        self.assertAlmostEqual(clusters[0], 71.05, places=1)
        self.assertAlmostEqual(clusters[1], 85.1, places=1)

    def test_indent_prefix_levels(self) -> None:
        clusters = [70.9, 85.1, 106.3, 141.7]
        self.assertEqual(indent_prefix_for_x(70.9, clusters), "")
        self.assertEqual(indent_prefix_for_x(85.1, clusters), "")
        self.assertEqual(indent_prefix_for_x(106.3, clusters), "    ")
        self.assertEqual(indent_prefix_for_x(141.7, clusters), "        ")


class PdfExtractionTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        root = Path(__file__).resolve().parents[1]
        cls.pdf = root / (
            "annales-nsi-premiere/2020/"
            "e3c-spe-numerique-informatique-premiere-03316-sujet-officiel.pdf"
        )
        if not cls.pdf.is_file():
            raise unittest.SkipTest("PDF d'annales absent")

    def test_fonction_mystere_indentation(self) -> None:
        doc = fitz.open(self.pdf)
        lines = extract_lines_from_doc(doc)
        doc.close()
        joined = "\n".join(lines)
        self.assertIn("def fonctionMystere(table):", joined)
        self.assertIn("    mystere = []", joined)
        self.assertIn("    for ligne in table:", joined)
        self.assertIn("        if ligne[2] == 'F':", joined)
        self.assertIn("            mystere.append(ligne[1])", joined)

    def test_extracted_question_c3_in_json(self) -> None:
        data = extract_from_pdf(self.pdf)
        enonce = ""
        for theme in data["themes"]:
            for q in theme["questions"]:
                if q["numero"] == "C.3":
                    enonce = q["enonce"]
                    break
        self.assertIn("    mystere = []", enonce)
        self.assertIn("        if ligne[2] == 'F':", enonce)


if __name__ == "__main__":
    raise SystemExit(unittest.main())
