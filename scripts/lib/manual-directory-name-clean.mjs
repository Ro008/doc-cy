/**
 * Shared helpers for cleaning dirty Google Places-style professional names
 * before manual directory import (titles, specialty fluff, Greek → Latin).
 */

const HAS_GREEK = /[\u0370-\u03FF\u1F00-\u1FFF]/;
const HAS_LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/;

/** Exact raw-name overrides (after trim + whitespace collapse). */
const EXACT_NAME_OVERRIDES = new Map([
  ["Margarita Orphanidou & Accociates", "Margarita Orphanidou"],
  ["Andreas Andreou & Androula Michael", "Andreas Andreou"],
  ["thePsyHub - Tania Masia", "Tania Masia"],
  ["C of Mind Peronal Growth Center by Elena Andreou", "Elena Andreou"],
  ["Aspromalli Nikoletta", "Nikoletta Aspromalli"],
  ["Aspris Nikos Psychologist (systemic psychotherapist)", "Nikos Aspris"],
  [
    "Maria Photiades MSc | Registered Clinical Psychologist | Dialogue Center of Therapy",
    "Maria Photiades",
  ],
  [
    "Orestis Kasinopoulos PhD | Licensed Clinical Psychologist | The Safe Place Project",
    "Orestis Kasinopoulos",
  ],
  [
    "Dr Lina Efthyvoulou, DCounsPsych, Chartered Psychologist, Nicosia Psychology Clinic",
    "Lina Efthyvoulou",
  ],
]);

const SKIP_EXACT_NAMES = new Set([
  "Νικος Χατζησυμεου Ψυχολογος, Σύμβουλος Σχέσεων, Σεξολόγος, Οικογενειακός Διαμεσολαβητής",
]);

const ORG_ONLY_PATTERNS = [
  /merkezi/i,
  /psikoloji/i,
  /psikoterapi/i,
  /dan[iı][sş]manl[iı]k/i,
  /heka\b/i,
  /πυξίδα\s+ζωής/i,
  /pyxida\s+zois/i,
  /ψυχιατρικό\s+ψυχοθεραπευτικό\s+κέντρο/i,
];

const LATIN_FLUFF_WORDS =
  /\b(dr|mrs?|ms|miss|prof|phd|msc|bsc|dcounspsych|gesy|licensed|registered|chartered|clinical|counselling|counseling|educational|school|integrative|systemic|trainee|psychologist|psychologists|psychotherapist|psychotherapy|psychoanalyst|psychoanalysis|psychology|psychologos|counsellor|counselor|therapist|therapy|sports?|leadership|development|specialist|nicosia|limassol|larnaca|larnaka|paphos|paralimni|klinikos|kliniki|symvoulevtikos|symvoulevtiki|scholikos|scholiki|ekpaidevtikos|ekpaidevtiki|engegrammenos|engegrammeni|psychanalytria|psychotherapevtria|psychotherapeytria|psychotherapeftis|athlitiki|schol|ekp|ar|eggrafis|engrafis)\b/gi;

function collapseWs(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/📍/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCaseWords(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word === "&") return word;
      return word
        .split("-")
        .map((part) => {
          if (/^[A-Za-z]\.$/.test(part)) return part.toUpperCase();
          const lower = part.toLowerCase();
          return lower ? `${lower.charAt(0).toUpperCase()}${lower.slice(1)}` : "";
        })
        .join("-");
    })
    .join(" ");
}

function casePreserve(match, rep) {
  if (match === match.toUpperCase()) return rep.toUpperCase();
  if (match[0] === match[0].toUpperCase()) {
    return rep.charAt(0).toUpperCase() + rep.slice(1);
  }
  return rep;
}

function transliterateGreek(input) {
  let s = String(input ?? "");
  // Name-oriented digraphs: medial μπ/ντ stay mp/nt; initial become b/d.
  s = s.replace(/(^|[^Α-Ωα-ωΆ-ώ])μπ/gi, (_, p1, offset, whole) => {
    const match = whole.slice(offset + p1.length, offset + p1.length + 2);
    return p1 + casePreserve(match, "b");
  });
  s = s.replace(/μπ/gi, (match) => casePreserve(match, "mp"));
  s = s.replace(/(^|[^Α-Ωα-ωΆ-ώ])ντ/gi, (_, p1, offset, whole) => {
    const match = whole.slice(offset + p1.length, offset + p1.length + 2);
    return p1 + casePreserve(match, "d");
  });
  s = s.replace(/ντ/gi, (match) => casePreserve(match, "nt"));

  const digraphs = [
    [/ο[υύ]/gi, "ou"],
    [/α[υύ]/gi, "av"],
    [/ε[υύ]/gi, "ev"],
    [/α[ιί]/gi, "ai"],
    [/ε[ιί]/gi, "ei"],
    [/ο[ιί]/gi, "oi"],
    [/υ[ιί]/gi, "yi"],
    [/γγ/gi, "ng"],
    [/γκ/gi, "gk"],
    [/γχ/gi, "nch"],
    [/τζ/gi, "tz"],
    [/τσ/gi, "ts"],
    [/θ/gi, "th"],
    [/χ/gi, "ch"],
    [/ψ/gi, "ps"],
  ];
  for (const [re, rep] of digraphs) {
    s = s.replace(re, (match) => casePreserve(match, rep));
  }
  // ευ/αυ → ef/af before θ (after digraph expansion)
  s = s.replace(/evth/gi, (m) => (m[0] === "E" ? "Efth" : "efth"));
  s = s.replace(/avth/gi, (m) => (m[0] === "A" ? "Afth" : "afth"));

  const map = {
    Α: "A",
    α: "a",
    Ά: "A",
    ά: "a",
    Β: "V",
    β: "v",
    Γ: "G",
    γ: "g",
    Δ: "D",
    δ: "d",
    Ε: "E",
    ε: "e",
    Έ: "E",
    έ: "e",
    Ζ: "Z",
    ζ: "z",
    Η: "I",
    η: "i",
    Ή: "I",
    ή: "i",
    Ι: "I",
    ι: "i",
    Ί: "I",
    ί: "i",
    ΐ: "i",
    ϊ: "i",
    Κ: "K",
    κ: "k",
    Λ: "L",
    λ: "l",
    Μ: "M",
    μ: "m",
    Ν: "N",
    ν: "n",
    Ξ: "X",
    ξ: "x",
    Ο: "O",
    ο: "o",
    Ό: "O",
    ό: "o",
    Π: "P",
    π: "p",
    Ρ: "R",
    ρ: "r",
    Σ: "S",
    σ: "s",
    ς: "s",
    Τ: "T",
    τ: "t",
    Υ: "Y",
    υ: "y",
    Ύ: "Y",
    ύ: "y",
    ϋ: "y",
    ΰ: "y",
    Φ: "F",
    φ: "f",
    Ω: "O",
    ω: "o",
    Ώ: "O",
    ώ: "o",
  };

  return [...s].map((ch) => map[ch] ?? ch).join("");
}

function normalizeSeparators(text) {
  return collapseWs(
    String(text)
      .replace(/[|\\\/,–—·•]+/g, " ")
      .replace(/\s[-–—]\s/g, " ")
      .replace(/[()[\]{}]/g, " ")
      .replace(/\s+&\s+/g, " "),
  );
}

function stripLatinSpecialtyFluff(text) {
  let s = normalizeSeparators(text);
  s = s.replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|miss|prof\.?)\s+/i, "");
  s = s.replace(/\([^)]*gesy[^)]*\)/gi, " ");
  s = s.replace(/\|\s*dialogue center of therapy.*$/i, " ");
  s = s.replace(/,\s*nicosia psychology clinic.*$/i, " ");
  s = s.replace(/\|\s*the safe place project.*$/i, " ");
  s = s.replace(/\(psychology\s*-\s*psychotherapy\)\s*$/i, " ");
  s = s.replace(LATIN_FLUFF_WORDS, " ");
  s = normalizeSeparators(s);
  // Drop trailing orphan punctuation / single non-letters
  s = s
    .split(" ")
    .map((w) => w.replace(/^-+|-+$/g, ""))
    .filter((w) => w && /^[\p{L}][\p{L}'.-]*\.?$/u.test(w))
    .join(" ");
  return collapseWs(s);
}

function looksLikePersonName(text) {
  const words = collapseWs(text).split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (
    /\b(center|centre|clinic|project|hub|mind|merkez|safe|place|dialogue|growth|personal|peronal)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  return words.every((w) => /^[\p{L}][\p{L}'.-]*\.?$/u.test(w));
}

function extractLatinPersonChunks(raw) {
  const collapsed = collapseWs(raw);
  const chunks = [];

  for (const part of collapsed.split(/\s*[\/|\\]\s*/)) {
    const latinOnly = collapseWs(
      part.replace(/[\u0370-\u03FF\u1F00-\u1FFF]+/g, " "),
    );
    if (HAS_LATIN_LETTER.test(latinOnly)) chunks.push(latinOnly);
  }

  const wholeLatin = collapseWs(
    collapsed.replace(/[\u0370-\u03FF\u1F00-\u1FFF]+/g, " "),
  );
  if (HAS_LATIN_LETTER.test(wholeLatin)) chunks.push(wholeLatin);

  return chunks;
}

function pickBestLatinPerson(raw) {
  let best = null;
  for (const chunk of extractLatinPersonChunks(raw)) {
    const roleFirst = chunk.match(
      /^(?:psychologist|psychotherapist)(?:\s*[-–—\/]\s*(?:psychologist|psychotherapist))?\s+(.+)$/i,
    );
    const candidateSource = roleFirst ? roleFirst[1] : chunk;
    const cleaned = stripLatinSpecialtyFluff(candidateSource);
    if (!looksLikePersonName(cleaned)) continue;
    const score = cleaned.split(" ").length;
    // Prefer chunks that came from explicit Latin bilingual sides (higher letter count)
    const letterScore = (cleaned.match(/[A-Za-z]/g) || []).length;
    const total = score * 10 + letterScore;
    if (!best || total > best.total) best = { cleaned, total };
  }
  return best?.cleaned ?? null;
}

function stripGreekSpecialtyWords(text) {
  return collapseWs(
    String(text)
      .replace(/\([^)]*γεσ[υύ][^)]*\)/gi, " ")
      .replace(/\bγεσ[υύ]\b/gi, " ")
      .replace(
        /\b(εγγεγραμμέν[ηοσς]?|κλινικ[ήόός]?|συμβουλευτικ[ήόός]?|σχολικ[ήόός]?|εκπαιδευτικ[ήόός]?|ψυχολόγ[οση]?|ψυχολογ[οση]?|ψυχοθεραπεύτρι[α]?|ψυχοθεραπευτ[ήής]?|ψυχαναλύτρι[α]?|συστημική|σύμβουλος|σχέσεων|σεξολόγ[οση]?|οικογενειακός|διαμεσολαβητής|αθλητικ[ήόός]?|λάρνακα|λευκωσία|αρ\.?\s*εγγραφής)\b/gi,
        " ",
      ),
  );
}

function pickGreekThenTransliterate(raw) {
  let greek = collapseWs(raw);

  // If bilingual, try Greek-only side first for names without usable Latin person
  if (HAS_LATIN_LETTER.test(greek) && HAS_GREEK.test(greek)) {
    const greekSide = collapseWs(
      greek.replace(/[A-Za-z\u00C0-\u024F0-9]+/g, " "),
    );
    if (greekSide) greek = greekSide;
  }

  const roleFirst = greek.match(/^συστημική\s+ψυχοθεραπεύτρια\s+(.+)$/i);
  if (roleFirst) greek = roleFirst[1];

  greek = stripGreekSpecialtyWords(greek);
  greek = normalizeSeparators(greek);
  greek = collapseWs(greek.replace(/[^\u0370-\u03FF\u1F00-\u1FFF\s'-]/g, " "));
  if (!greek) return null;

  // Transliterate first, then strip any leftover Latinized specialty fluff
  const latin = stripLatinSpecialtyFluff(transliterateGreek(greek));
  if (!looksLikePersonName(latin)) return null;
  return latin;
}

function isOrgOnlyName(raw) {
  const collapsed = collapseWs(raw);
  return ORG_ONLY_PATTERNS.some((re) => re.test(collapsed));
}

/**
 * @returns {string|null} cleaned Title Case person name, or null to skip row
 */
function cleanManualDirectoryPersonName(rawName) {
  const collapsed = collapseWs(rawName);
  if (!collapsed) return null;

  if (SKIP_EXACT_NAMES.has(collapsed)) return null;
  if (isOrgOnlyName(collapsed)) return null;

  if (EXACT_NAME_OVERRIDES.has(collapsed)) {
    return toTitleCaseWords(EXACT_NAME_OVERRIDES.get(collapsed));
  }

  // Prefer Latin person when available (bilingual cells)
  const latinPerson = pickBestLatinPerson(collapsed);
  if (latinPerson) return toTitleCaseWords(latinPerson);

  if (HAS_GREEK.test(collapsed)) {
    const fromGreek = pickGreekThenTransliterate(collapsed);
    if (fromGreek) return toTitleCaseWords(fromGreek);
  }

  const plain = stripLatinSpecialtyFluff(collapsed);
  if (looksLikePersonName(plain)) return toTitleCaseWords(plain);

  return null;
}

export {
  cleanManualDirectoryPersonName,
  isOrgOnlyName,
  transliterateGreek,
  collapseWs,
};
