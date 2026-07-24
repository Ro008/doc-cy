# GeSY directory export (DocCy)

Plan to harvest Cyprus GeSY healthcare professionals into Excel files for later
manual-directory import / outreach — **not** by scraping [giatroi.info](https://giatroi.info/).

Source UI: [gesy.org.cy/provider-search](https://www.gesy.org.cy/provider-search)  
Public API base: `https://www.gesy.org.cy/pubapi/`

---

## Goal

Produce **one Excel per DocCy specialty**, starting with **Dermatology**, with the
fields we need for finder + future email outreach (gender, email, GHS code),
**without** latitude/longitude or Google Maps links in this phase.

Later (separate step): Google Places enrichment for coords / Maps URL before
publishing rows that need “📍 X km away”. Rows without a usable street address
are kept in the Excel for review but are **not** candidates to publish as-is.

---

## Why GeSY (not giatroi)

- Official provider registry behind the public search UI.
- Machine-readable JSON API (`pubapi`).
- Fields we care about (email, gender, phones, offices) are available without
  clicking the Details button in a browser — if we follow the same request
  pattern the UI uses.

---

## API flow (how we fetch)

### 1. Full list (one request)

```http
GET https://www.gesy.org.cy/pubapi/professionals
Accept-Language: en
```

Returns ~8,700 professionals with, among others:

- `prvId` → **GHS code**
- `firstName`, `lastName`, `name`
- `genderCd` (`F` / `M`)
- `email`
- `specialties[]` (codes)
- `segments[]` (PD, OS, AP, DE, …)
- `districts[]` (NIC, LA, LIM, …)
- `telephones[]`

### 2. Street address (per professional)

The Details modal address does **not** always live on the professional’s own
`workhours`. The UI also loads offices for **associated providers** (`assocPrvs`).

For each professional:

1. `GET /pubapi/professional/{prvId}` → profile + `assocPrvs`
2. `GET /pubapi/professional/{prvId}/workhours` → own offices
3. For each associated `prvId` ≠ self:  
   `GET /pubapi/professional/{assocPrvId}/workhours`
4. Keep offices whose type matches the professional’s segment (same filter as
   the GeSY frontend: e.g. `OFFAP` ↔ segment `AP`)

Use a small delay between `workhours` calls to avoid hammering the API.

### 3. Specialty filter for “Dermatology”

GeSY uses **many internal codes** for the same human specialty depending on
context (outpatient / inpatient / A&E). For Dermatology we include codes that
map to **Dermato-venereology**:

| GeSY code | Typical context | English label |
|-----------|-----------------|---------------|
| `D` | Outpatient specialist | Dermato-venereology |
| `ISD` | Inpatient / hospital specialty list | Dermato-venereology |

**Do not** treat `DR` as Dermatology — in GeSY, `DR` is **Diagnostic Radiology**.

A professional is included in the Dermatology export if **any** of their
`specialties[]` is in that code set.

---

## Specialty codes vs human specialties

| Concept | Approx. count | Meaning |
|---------|---------------|---------|
| GeSY specialty **codes** in use | ~135 | Internal IDs (`CD`, `ISCD`, `AECD`, …) |
| Distinct English **labels** | ~67–72 | Real specialties as shown in GeSY |
| DocCy master labels | See `lib/cyprus-specialties.ts` | What we store in `directory_manual.specialty` |

Example: Cardiology → codes `CD`, `ISCD`, `AECD` → one DocCy label `Cardiology`.

---

## Excel output

### Layout

- Folder: `tmp/gesy-exports/` (local / gitignored artifacts; do not commit PII dumps)
- Prefer **one file per GeSY search filter**, e.g. `personal-doctor-all-specialties.xlsx`
- Sheet: **one row per clinic/location** (same professional may appear on multiple rows)
- `specialty` uses the **GeSY UI label as-is** (no DocCy remapping such as
  Dermato-venereology → Dermatology). Labels come from the provider-search
  dropdown maps (`scripts/lib/gesy-specialty-labels.json`). For Personal Doctors,
  that is typically `PD - Adults` / `PD - Children` (`pdtypes`).

### Columns (final)

| Column | Description |
|--------|-------------|
| `ghs_code` | GeSY `prvId` (stable ID, e.g. `A2831`) |
| `name` | Display name (Title Case **Latin**) for DocCy |
| `name_raw` | Latin name as returned by GeSY (often ALL CAPS) |
| `specialty` | GeSY UI specialty label(s), unchanged (e.g. `DERMATO-VENEREOLOGY`, `PD - Adults`) |
| `specialty_gesy_code` | Raw GeSY specialty code(s), e.g. `D` or `D;ISD` or `PDGEN;PDPED` |
| `segment` | Full English segment text (e.g. `Personal Doctor`, `Outpatient Specialist`) |
| `clinic_name` | Associated healthcare provider name (Latin) |
| `clinic_ghs_code` | Associated provider `prvId` |
| `district` | Primary DocCy district (`Nicosia`, `Limassol`, `Paphos`, `Larnaca`, `Famagusta`) |
| `districts_all` | All districts if they practice in more than one |
| `gender` | `Female` / `Male` |
| `email` | Email from GeSY |
| `phone` | Digits only (e.g. `99747311`) — no spaces, no “office/mobile” labels |
| `address` | Full street address text when available via workhours (+ assoc), **Latin only** (Greek script is transliterated; GeSY has no bilingual address field) |

**Names:** GeSY’s `name` field is usually `GREEK / LATIN`. The export takes the
Latin side only (UI shows both; `firstName`/`lastName` are often Greek-only and
are not used for DocCy display names).

**Addresses:** Unlike names, street lines are usually stored in a single script.
`Accept-Language` does not switch them. The export romanizes Greek characters
(and a few common phrases like Flat / Avenue) so the Excel stays Latin-only.

### Explicitly out of scope for this export

- `latitude` / `longitude`
- `address_maps_link` / Google Places
- Working hours
- `municipality`, `post_code`, `registry_id`, `website` as separate columns  
  (municipality/CP may still appear inside `address` text)

---

## District mapping

| GeSY code(s) | DocCy district |
|--------------|----------------|
| `NIC` | Nicosia |
| `LIM`, `LI` | Limassol |
| `LA`, `LAR` | Larnaca |
| `PA`, `PAF`, `PFO` | Paphos |
| `FAM`, `FA` | Famagusta |

If several districts exist, pick a primary for `district` (first mappable code)
and put the full list in `districts_all`.

---

## Phone normalisation

From GeSY `telephones[]` and/or office `workPhone` / `mobPhone`:

1. Prefer a non-empty phone from list or office.
2. Strip spaces, dashes, and a leading `+357` / `00357` if present.
3. Store **digits only** in `phone`.

---

## Segment (what it means)

GeSY `segment` is the **provider category**, not the medical specialty:

| Code | Meaning (EN) |
|------|----------------|
| `PD` | Personal Doctor |
| `OS` | Outpatient Specialist |
| `AP` | Allied Health Professional |
| `DE` | Dentist |
| `LB` | Laboratory |
| `PH` | Pharmacy |
| `NM` | Nursing / Midwifery |
| `AE` | Accident & Emergency |
| `IS` | (codes often appear with `IS…` specialty prefixes for hospital lists) |

Useful for filtering (e.g. exclude pharmacies) before DocCy import.

---

## Publishing rules (product)

Agreed for DocCy finder:

- **No district-centre fallback** as a fake “📍 X km away”.
- Exact distance needs Places/geocoding **later**.
- For address-only phase: prefer rows with a real `address` string; treat empty
  `address` as review / do-not-publish until enriched or discarded.
- Finder distance labels go through `computeFinderDistanceKm` in
  `lib/finder-distance.ts` (covered by unit tests). Missing lat/lon → **no**
  distance label — never approximate from the district capital/centre.

This export script **does not** push to Supabase. It only writes Excel for human
review, then the existing manual-directory migration workflow can be used.

---

## Implementation plan

1. **Document** this plan (`docs/gesy-directory-export.md`) — done.
2. **Script:** `scripts/export-gesy-specialty-xlsx.mjs`
   - `--specialty dermatology` (DocCy label or alias)
   - Maps DocCy label → GeSY code set
   - Fetches list → filters → enriches address (self + assoc) → writes xlsx via `xlsx`
   - Output: `tmp/gesy-exports/dermatology.xlsx` (gitignored)
   ```bash
   node scripts/export-gesy-specialty-xlsx.mjs --specialty dermatology
   node scripts/export-gesy-specialty-xlsx.mjs --list-specialties
   ```
3. **Dermatology v1** exported (81 rows; GeSY codes `D`, `ISD`). Review before import.
4. **Extend** `SPECIALTY_EXPORTS` in the script for other DocCy specialties; export
   one file at a time.
5. **Optional later:** Places backfill for lat/lon + Maps URL; outreach digests
   using `email` + vote counts (`directory_manual_patient_booking_requests`).

---

## Dermatology code set (v1)

```text
DocCy specialty: Dermatology
GeSY codes:      D, ISD
GeSY label:      Dermato-venereology
```

If we later find additional derm-related codes with the same English label, add
them here and re-export.

---

## Safety / ops

- Be polite to GeSY: delay between detail/`workhours` calls; no parallel flood.
- Do not commit Excel dumps with emails/phones to git.
- Prefer Resend (not personal Gmail) for any future automated outreach; digests
  only, never one email per patient vote (see product discussion in chat).
- GeSY emails are public directory contacts; still use opt-out and B2B-appropriate
  copy if we email professionals.
