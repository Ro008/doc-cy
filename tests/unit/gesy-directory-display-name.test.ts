import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanGesyDirectoryDisplayName } from "../../scripts/lib/gesy-directory-display-name.mjs";

describe("cleanGesyDirectoryDisplayName", () => {
  it("strips Resident Doctor notes", () => {
    assert.equal(
      cleanGesyDirectoryDisplayName("Adamantia Papamichail(Resident Doctor)"),
      "Adamantia Papamichail",
    );
    assert.equal(
      cleanGesyDirectoryDisplayName("Eleni Christou (Resident Doctor))"),
      "Eleni Christou",
    );
    assert.equal(
      cleanGesyDirectoryDisplayName("Irene Siakou ( Resident Doctor)"),
      "Irene Siakou",
    );
  });

  it("strips specialisation / only-for clinical notes", () => {
    assert.equal(
      cleanGesyDirectoryDisplayName(
        "Anastasios Tranoulis (Doctor With Specialisation In Gynaecologic Oncology)",
      ),
      "Anastasios Tranoulis",
    );
    assert.equal(
      cleanGesyDirectoryDisplayName(
        "Aphrodite Aristidou Kallika (Doctor Without Gynaecology Specialty – Fetal Medicine Only)",
      ),
      "Aphrodite Aristidou Kallika",
    );
    assert.equal(
      cleanGesyDirectoryDisplayName("Soteroula Christou (Only For Thalassemia Patients)"),
      "Soteroula Christou",
    );
  });

  it("strips clinic / brand suffixes", () => {
    assert.equal(
      cleanGesyDirectoryDisplayName(
        "Elena Troullidou - Mydietspot Health & Weight Loss Center",
      ),
      "Elena Troullidou",
    );
    assert.equal(
      cleanGesyDirectoryDisplayName(
        "Maria Charalambous (Κεντρο Λογοθεραπειας Μαρια Χαραλαμπους)",
      ),
      "Maria Charalambous",
    );
  });

  it("keeps short nickname aliases and alternate-name parens", () => {
    assert.equal(
      cleanGesyDirectoryDisplayName("Charalambos (Charis) Hadjicharalambous"),
      "Charalambos (Charis) Hadjicharalambous",
    );
    assert.equal(
      cleanGesyDirectoryDisplayName("Elena Koukouma (Alona Koukouma-Gudenian)"),
      "Elena Koukouma (Alona Koukouma-Gudenian)",
    );
  });
});
