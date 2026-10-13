# Help manual (`/help`)

An internal manual for professionals: one short how-to video per task, with the steps written
underneath, grouped in the order a doctor uses the product. Behind the login, linked from the
account menu ("Help & tutorials") and, later, from "?" links inside the product.

Decisions (Rocío, 2026-10-13): internal, not public; reached from the account menu first; videos on
the DocCy YouTube channel, **public**; English only; written steps under every video; every article
has a stable anchor (`/help#dashboard`) so it can be shared as it is.

## Content plan

Order follows the doctor's journey. `[x]` = video published, `[ ]` = to record.

### 1. Getting started
- [x] **Your dashboard in 20 seconds** (`dashboard`), youtu.be/4K0T_DNT3PY

### 2. Requests
- [ ] **Accept, suggest other times or decline a request** (`handle-requests`)
- [ ] **Answer a request that has no time that suits you** (`suggest-other-times`), if it needs its own video

### 3. Agenda
- [ ] **Add a booking made by phone** (`manual-booking`)
- [ ] **Read your day in the agenda** (`day-view`)

### 4. Settings
- [ ] **Pause your online bookings** (`pause-bookings`), blocked until the Settings changes land
- [ ] **Set your working hours** (`working-hours`)
- [ ] **Your clinic details** (`clinic-details`)

### 5. Your public profile
- [ ] **Share your booking link and QR code** (`share-booking-link`)
- [ ] **Personalise your public page** (`public-page`), after `feat/profile-redesign` merges

**First three for the PR:** `dashboard`, `handle-requests`, `manual-booking`.

## Conventions

- **Slugs never change once shared.** They are the anchors. Rename the title, not the slug.
- **One video per task, 20 to 30 seconds**, recorded from `scripts/tutorial-videos/` against the
  demo account (Dr. Elena Christou, fictional patients). Re-record when the screen changes: the
  specs are the source of truth, not the MP4s.
- **Every article has steps in text** (3 to 5, imperative, one line each). The video is not the only
  way to read it: people skim, mute sound and search.
- **Upload flow:** record, compose with the title and closing cards, upload to the DocCy channel
  (public, "not made for kids"), copy the id from `youtu.be/<id>`, add the article to
  `lib/help-manual.ts` with its poster in `public/help/`.
- **Reels** (9:16) of the same flows go to Instagram; they are not part of this page.
