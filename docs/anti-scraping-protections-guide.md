# DocCy Anti-Scraping Protections — Plain-English Guide

*Last updated: 2026-09-24 (claims re-checked against the code and the live database; see "How this was checked" at the end). Written for non-technical reading — no code, no jargon.*

## Why this exists

DocCy's core value is the directory itself — thousands of doctors, clinics, and their contact details, all in one searchable place. That's exactly what makes it a target: a competitor or data broker could try to copy the whole thing automatically instead of building their own directory. This document explains, in plain terms, everything currently in place to make that hard, slow, and provable.

Think of it like protecting a building: a legal notice on the fence, a locked vault inside, friction at every door, a security guard out front who now also checks ID against a watch-list, and a hidden dye-pack that proves a break-in happened.

---

## The six layers of protection

### 1. The legal warning sign

DocCy's Terms of Use explicitly forbid copying, scraping, or crawling the directory, and state that anyone who does it anyway owes **€50 per profile** they took, regardless of actual damages. This doesn't stop anyone technically, but it means DocCy has clear legal grounds to act if it ever happens — and it's a genuine deterrent for any legitimate business considering it.

### 2. The locked vault — the strongest layer

Every website has to expose a "front door key" in its own code so the site can talk to its database — that's unavoidable. What's not unavoidable is what that key can unlock. DocCy's database is set up so that key **cannot** be used to pull data directly out of the database in bulk, even though it's technically visible to anyone who looks. The only way to read directory data is through DocCy's own trusted servers, which apply all the other rules below. This closes off the fastest, easiest way to steal everything in one shot — and nothing else on this list changes how strong this layer is, since it doesn't depend on any of them.

One small exception remains: an older table holding registered professionals' practice addresses and opening hours can still be read with that key (see "What's still open"). It holds no phone numbers, emails or patient data, only what their public profiles already show, and it's being removed.

### 3. Friction on the website itself

Even browsing the site normally, several things slow down anyone trying to copy it wholesale:

- **Phone numbers aren't printed on the page.** A visitor has to click "reveal phone number," and that button can only be clicked a limited number of times per hour from the same visitor. A patient checking a few numbers is unaffected; a script trying to harvest thousands gets cut off automatically.
- **Browsing without narrowing your search is capped.** A visitor can see at most 60 listings (about 5 "show more" clicks) whether or not they've filtered by area or specialty. Genuinely browsing past that without narrowing down looks like data collection, not searching for a doctor — a real patient rarely goes that far anyway.
- **How many searches one visitor can run per hour is capped, too**, at 15/hour. Every page of results counts, on both the doctor finder and the clinics directory, including each "show more". This matters because the browsing-depth cap alone can be worked around by running many separate, narrower searches back-to-back (e.g., checking every town crossed with every specialty) instead of one big one — this limit catches that pattern as well. Cyprus has a limited number of districts and specialties, so 15/hour comfortably covers even a very thorough real patient, while making "check every combination" much slower for anyone trying to copy the directory.

Go over either limit, and the site quietly returns fewer results — no error message, no "you've been blocked" notice, so it doesn't tip off whoever (or whatever) is doing it.

Two honest caveats about these limits:

- **Over the limit, a search still shows its first page (12 listings).** So a combination of town and specialty with 12 or fewer professionals is still fully visible. The limits slow copying down a lot; they don't make it impossible.
- **The counts are kept separately on each of DocCy's web servers, and per network address.** The hosting service runs several servers at once and restarts them often, and each keeps its own tally, so a determined scraper spreading requests across addresses or over time gets more than 15 an hour. The limits reliably stop fast, obvious bursts; they are not a hard ceiling. (See "What's still open".)

### 4. The bouncer at the front door (Cloudflare)

Before any visitor even reaches DocCy's website, their request passes through a service called Cloudflare, which sits in front of the site like security at a venue entrance. Three things are configured here (in Cloudflare's own settings, not in DocCy's code):

- **Bot Fight Mode** — deliberately kept switched on. It watches how visitors behave and shows a "prove you're human" challenge to anything that looks automated, while waving real people straight through. There's an explicit internal rule never to turn this off, even when it occasionally slows down an internal testing tool.
- **Known scraping-tool blocking** — a rule that recognizes the default "signature" of common scripting tools (things like `curl`, `wget`, `Scrapy`, Python scripts) and challenges them before they ever reach the site. This mirrors a list of known bot signatures that already existed in DocCy's own code, now enforced one step earlier, at the door, instead of inside the building.
- **AI training crawlers are blocked.** Automated bots that exist specifically to ingest website content into AI training datasets are now blocked outright — this is the same threat as a scraper, just run by someone else's infrastructure. Bots that answer a live user question by referencing a page (an AI assistant citing DocCy in an answer) are still allowed, since that's closer to a referral than a copy. As a side effect, this also gave DocCy a standard, correctly-configured `robots.txt` file (a basic file every site is expected to have, telling automated crawlers what they may and may not do) — it didn't have one before.

### 5. The bait listings — the cleverest layer

Scattered into the real directory, in quiet corners (specific small towns and specialties), are a handful of **completely fake clinic listings** — invented names, invented phone numbers, invented addresses. These fake listings are deliberately left out of the list of pages DocCy hands to Google and other search engines (the "sitemap"), and they sit where a real patient is unlikely to look, so the realistic way anyone would come across them is by systematically copying the directory. If a rival directory ever shows up with those exact same fake names and numbers, that's undeniable proof they copied DocCy's data — like a dye-pack hidden in a bank bag that only goes off if the bag is actually stolen.

### 6. A related fix: locking the staff door too

This isn't about the public directory, but came out of the same security review: the internal/founder area's login page previously had **no limit at all** on repeated login attempts — someone could try to guess the access code as many times as they wanted, instantly, forever. It's now limited to 3 attempts per hour per visitor; a 4th attempt within the hour is turned away automatically before it's even checked, and a different visitor isn't affected by someone else's failed attempts. (The same caveat as in Layer 3 applies: the count is kept per web server, so it slows guessing down sharply rather than capping it at exactly 3.)

---

## Recent history

| Date | Change |
|---|---|
| 2026-09-16 | Unfiltered/filtered browsing cap tightened back to 5 pages (60 listings) — it had quietly drifted to 20 pages (240 listings) during an unrelated, routine update months earlier, without anyone noticing at the time. |
| 2026-09-16 | New limit added: 15 searches/hour per visitor, closing the "run many small searches instead of one big one" workaround. |
| 2026-09-16 | Internal/founder login locked down: 3 attempts/hour per visitor. |
| 2026-09-16 | Cloudflare: known scraping tools now challenged at the edge; AI training crawlers blocked; a proper `robots.txt` now exists as a side effect. |
| 2026-09-16 | Checked whether to also add Cloudflare's built-in "leaked credential" login protection — decided against it, because the doctor sign-in page talks directly to a separate authentication service and never passes through Cloudflare, so the rule would have looked active while doing nothing. |
| 2026-09-24 | Guide re-checked against the code and the live database: added the caveats on how the limits are counted, corrected where the bait listings are hidden and which link can reveal a patient's details, and added the old locations table to "What's still open". |

All of the above were tested against the live directory data (nearly 7,000 professionals) before going live, and covered by automated tests that re-run on every future code change so they can't silently break or drift again unnoticed.

---

## What's still open

A few gaps were identified during this review that remain unresolved. Rated by how urgent each one is *given everything above is now in place*:

- **Medium — no automatic alert if traffic suddenly spikes.** There used to be a daily check that would email the founder if search traffic jumped to several times its normal level — a strong signal of scraping in progress. It was accidentally removed as a side effect of an unrelated fix to a database cost problem. Its job is now partly covered by the friction layers above (a scraper has a much harder time generating that kind of spike in the first place), which is why this dropped from "top priority" to "worth doing eventually" — but it's still the only thing that would catch something sophisticated enough to get past the other layers.
- **Medium — the "add to calendar" download link for a booking can reveal that patient's name and phone number** to anyone who has the link. It needs no sign-in. The booking reference in it is a long random code, so it can't practically be guessed, but the link travels in emails and could be forwarded. Not a scraping issue, but a genuine gap worth closing.
- **Medium — the per-hour limits are counted per web server, not across the whole site** (see the caveats in Layer 3). Moving the counts to one shared place (the database or a small shared store) would make "15 an hour" and "3 login attempts an hour" true limits.
- **Low — an older locations table can still be read directly with the public key.** It holds the practice addresses, map positions and opening hours of registered professionals (4 rows today) — the same details their public profiles show, and no contact or patient data. The table is scheduled for removal as part of the clinic restructure, which closes this.
- **Low — a pricing page reportedly has no access restriction.** Which page this means couldn't be confirmed in the 2026-09-24 re-check (the prices professionals set for their services can only be changed when signed in); worth pinning down. No patient data involved.
- **Low — an old, unused list of known bot signatures still sits in DocCy's code**, no longer doing anything since the system that used to read it was removed. Now that Cloudflare blocks the same signatures at the door, this is a cleanup item rather than a real gap.
- **Low — Supabase's own login protection hasn't been double-checked.** The doctor sign-in page talks directly to Supabase (see above), so whatever rate-limiting Supabase itself applies by default is the real protection here, not anything on DocCy's side. Worth a quick confirmation, not expected to reveal a problem.

None of these threaten the core protection (the locked vault in Layer 2, which stops a bulk copy of the directory regardless of anything else on this list) — they're refinements on top of an already solid foundation.

---

## How this was checked (2026-09-24)

- **Confirmed in the code:** 12 listings per page and at most 5 pages (60 listings); 15 searches an hour on the finder and clinics pages, falling back quietly to the first page; the phone-reveal and founder-login limits (3 an hour); bait listings left out of the sitemap; the unused bot-signature list; the traffic-spike alert removed (only a monthly email job remains).
- **Confirmed in the live database (read-only):** the public key cannot read the professionals, clinics, specialties or appointments tables, but can read the older locations table (4 rows).
- **Not checkable from the code:** the three Cloudflare settings in Layer 4 live in Cloudflare's dashboard; this guide reports them as configured on 2026-09-16.
