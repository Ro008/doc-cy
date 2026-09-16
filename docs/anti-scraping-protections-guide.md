# DocCy Anti-Scraping Protections — Plain-English Guide

*Last updated: 2026-09-16. Written for non-technical reading — no code, no jargon.*

## Why this exists

DocCy's core value is the directory itself — thousands of doctors, clinics, and their contact details, all in one searchable place. That's exactly what makes it a target: a competitor or data broker could try to copy the whole thing automatically instead of building their own directory. This document explains, in plain terms, everything currently in place to make that hard, slow, and provable — and what changed most recently.

Think of it like protecting a building: a legal notice on the fence, a locked vault inside, friction at every door, a security guard out front, and a hidden dye-pack that proves a break-in happened.

---

## The five layers of protection

### 1. The legal warning sign

DocCy's Terms of Use explicitly forbid copying, scraping, or crawling the directory, and state that anyone who does it anyway owes **€50 per profile** they took, regardless of actual damages. This doesn't stop anyone technically, but it means DocCy has clear legal grounds to act if it ever happens — and it's a genuine deterrent for any legitimate business considering it.

### 2. The locked vault — the strongest layer

Every website has to expose a "front door key" in its own code so the site can talk to its database — that's unavoidable. What's not unavoidable is what that key can unlock. DocCy's database is set up so that key **cannot** be used to pull data directly out of the database in bulk, even though it's technically visible to anyone who looks. The only way to read directory data is through DocCy's own trusted servers, which apply all the other rules below. This closes off the fastest, easiest way to steal everything in one shot.

### 3. Friction on the website itself

Even browsing the site normally, several things slow down anyone trying to copy it wholesale:

- **Phone numbers aren't printed on the page.** A visitor has to click "reveal phone number," and that button can only be clicked a limited number of times per hour from the same visitor. A patient checking a few numbers is unaffected; a script trying to harvest thousands gets cut off automatically.
- **Browsing without narrowing your search is capped.** You can only see so many listings before the site stops loading more, unless you actually filter by area or specialty — which is exactly what a real patient does anyway. *(Tightened 2026-09-16 — see "What changed" below.)*
- **How many searches one visitor can run per hour is now capped, too.** *(New as of 2026-09-16 — see below.)* This matters because the browsing cap alone can be worked around by running many separate, narrower searches back-to-back (e.g., checking every town crossed with every specialty) instead of one big one — this new limit catches that pattern as well.

### 4. The bouncer at the front door (Cloudflare)

Before any visitor even reaches DocCy's website, their request passes through a service called Cloudflare, which sits in front of the site like security at a venue entrance. A feature called **Bot Fight Mode** is deliberately kept switched on — it watches how visitors behave and shows a "prove you're human" challenge to anything that looks automated, while waving real people straight through. The team has an explicit internal rule: never turn this off, even if it occasionally slows down an internal testing tool.

### 5. The bait listings — the cleverest layer

Scattered into the real directory, in quiet corners (specific small towns and specialties), are a handful of **completely fake clinic listings** — invented names, invented phone numbers, invented addresses. These fake listings are deliberately hidden from Google and everyday search, so the *only* realistic way anyone would ever come across them is by systematically copying the entire directory. If a rival directory ever shows up with those exact same fake names and numbers, that's undeniable proof they copied DocCy's data — like a dye-pack hidden in a bank bag that only goes off if the bag is actually stolen.

---

## What changed on 2026-09-16

Two related fixes went out together, addressing a gap found during a security review:

**1. Tightened the "browse without narrowing your search" limit.**
This limit had quietly loosened over time — a routine, unrelated update to how search results are displayed accidentally allowed 10x more browsing than originally intended, without anyone noticing at the time. It's now been brought back down to a tight, deliberate limit: a visitor can see at most 60 listings (about 5 "show more" clicks) whether they've narrowed their search or not. That's still generous for any real patient — genuinely browsing without filters past that point looks like data collection, not searching for a doctor.

**2. Added a brand-new limit: how many searches one visitor can run per hour.**
Previously, nothing stopped a script from running hundreds of separate searches per hour — each one individually small and unremarkable, but collectively able to reconstruct the whole directory by checking every combination of area and specialty. Now, each visitor (identified by their network address) is limited to **15 searches per hour**. Cyprus has a limited number of districts and specialties, so this comfortably covers even a very thorough real patient comparing several options — while making the "check every combination" approach far too slow to be worthwhile for anyone trying to copy the directory. Go over the limit, and searches quietly return only the first page of results — no error message, no "you've been blocked" notice, so it doesn't tip off whoever (or whatever) is doing it.

Both changes were tested against the live directory data (nearly 7,000 professionals) before going live, confirming the limits trigger exactly as intended and that nothing else on the site was affected.

---

## What's being watched and what could still be improved

For full transparency, a few gaps were identified during the same review that are **not yet resolved**:

- **The automatic "traffic spike" alert is currently missing.** There used to be a daily check that would email the founder if search traffic suddenly spiked to several times its normal level — a strong signal of scraping in progress. It was accidentally removed as a side effect of an unrelated fix to a database cost problem a few days earlier. Restoring some version of this is the next priority.
- **Two specific pages have no protection at all** — one lets anyone with (or able to guess) a booking reference download that patient's name and phone number; the other is a fully open pricing page. Neither is scraping-specific, but both are worth locking down.
- **The internal staff login has no limit on repeated attempts.**
- Most of the custom protection lives in DocCy's own website code rather than in Cloudflare's settings — adding a couple of Cloudflare-level rules would mean bad traffic gets stopped before it even reaches DocCy's servers.

These are tracked as follow-up work, not left unaddressed by oversight.
