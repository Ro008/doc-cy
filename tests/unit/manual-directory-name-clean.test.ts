import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { cleanManualDirectoryPersonName } from "../../scripts/lib/manual-directory-name-clean.mjs";

describe("cleanManualDirectoryPersonName", () => {
  it("keeps clean latin person names", () => {
    assert.equal(cleanManualDirectoryPersonName("Mary Eliade"), "Mary Eliade");
    assert.equal(cleanManualDirectoryPersonName("Maria-Eva Tsola"), "Maria-Eva Tsola");
  });

  it("applies agreed brand/person overrides", () => {
    assert.equal(
      cleanManualDirectoryPersonName("Margarita Orphanidou & Accociates"),
      "Margarita Orphanidou",
    );
    assert.equal(
      cleanManualDirectoryPersonName("Andreas Andreou & Androula Michael"),
      "Andreas Andreou",
    );
    assert.equal(cleanManualDirectoryPersonName("thePsyHub - Tania Masia"), "Tania Masia");
    assert.equal(
      cleanManualDirectoryPersonName("C of Mind Peronal Growth Center by Elena Andreou"),
      "Elena Andreou",
    );
  });

  it("skips clinics and the Greek duplicate of Nicos Hadjisymeou", () => {
    assert.equal(
      cleanManualDirectoryPersonName(
        "Mare Psikoterapi Merkezi | Kıbrıs Psikolog & Psikoterapi",
      ),
      null,
    );
    assert.equal(
      cleanManualDirectoryPersonName("HEKA PSİKOTERAPİ VE DANIŞMANLIK MERKEZİ"),
      null,
    );
    assert.equal(
      cleanManualDirectoryPersonName(
        "Νικος Χατζησυμεου Ψυχολογος, Σύμβουλος Σχέσεων, Σεξολόγος, Οικογενειακός Διαμεσολαβητής",
      ),
      null,
    );
  });

  it("prefers latin side of bilingual cells and strips titles", () => {
    assert.equal(
      cleanManualDirectoryPersonName(
        "Δρ. Μαρία Παντελή Κλινικός Ψυχολόγος ΓΕΣΥ/ Dr. Maria Panteli Clinical Psychologist GESY",
      ),
      "Maria Panteli",
    );
    assert.equal(
      cleanManualDirectoryPersonName(
        "Christos Lefkides - Licensed Clinical Psychologist",
      ),
      "Christos Lefkides",
    );
  });

  it("transliterates greek-only person names", () => {
    assert.equal(cleanManualDirectoryPersonName("Μαρία Κωνσταντούλα"), "Maria Konstantoula");
    assert.equal(
      cleanManualDirectoryPersonName("Μαργαρίτα Αντωνίου, Εγγεγραμμένη Συμβουλευτική Ψυχολόγος"),
      "Margarita Antoniou",
    );
    assert.equal(
      cleanManualDirectoryPersonName("Συστημική Ψυχοθεραπεύτρια Χρυσάνθη Νικολάου"),
      "Chrysanthi Nikolaou",
    );
  });

  it("fixes surname-first dirty rows", () => {
    assert.equal(cleanManualDirectoryPersonName("Aspromalli Nikoletta"), "Nikoletta Aspromalli");
    assert.equal(
      cleanManualDirectoryPersonName(
        "Aspris Nikos Psychologist (systemic psychotherapist)",
      ),
      "Nikos Aspris",
    );
  });
});
