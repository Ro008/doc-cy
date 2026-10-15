# "What's new" email

The announcement of the Dashboard, the redesigned Agenda and Settings, for the active professionals
(`lib/product-announcement-email.ts`). It is sent by hand, never from the app. One short animation per
part, recorded from the real product with the same demo stack as `scripts/tutorial-videos`.

## What is where

- `lib/product-announcement-email.ts`: the copy and the HTML/text builder. Every point in it must be
  something shipped and checked in the product. `tests/unit/product-announcement-email.test.ts`
  guards the structure, the links (`/dashboard`, `/help#...`), that nothing loads from outside the
  site, and that each animation exists and weighs at most 1.3 MB.
- `public/email/*.gif`: the animations. They are served from `https://www.mydoccy.com/email/`, so
  **they must be deployed before the email is sent** (a recipient's mail app loads them from there).
- `record-gifs.spec.ts`, `make-gifs.mjs`: record and convert them. `preview.ts`: look at the email.

## Sending

`send.ts` (logic and guards in `lib/product-announcement-send.ts`, tested). It is from
`DocCy <hello@mydoccy.com>` with replies to `hello@mydoccy.com`: that address only receives through
Cloudflare Email Routing, which forwards to doccyteam@gmail.com, and doccyteam forwards to
rociosirvent@gmail.com. Never send it from the transactional `no-reply@` address.

- **It sends nothing unless `--send` is given**: without it, it prints who would get what.
- `RESEND_API_KEY` comes from the environment only, never read from a file.
- A test to one address, with the animations inside the email (before they are deployed):
  `RESEND_API_KEY=... npx tsx scripts/announcement-email/send.ts --to me@example.com --name Rocio --inline-images --send`
- The real send takes a JSON list `[{ "email": "...", "firstName": "..." }]` of the active professionals
  (from the production database, read only), kept out of git in `announcement-out/`:
  `RESEND_API_KEY=... npx tsx scripts/announcement-email/send.ts --recipients announcement-out/recipients.json --send`
  Deploy `public/email/*.gif` first: the real send loads them from the site.
- More than 10 recipients needs `--allow-many`; `--inline-images` is refused for a list.

Gmail does not deliver, as new mail, a reply that goes to hello@ and comes back to the account that sent
it, so test the reply chain from a different account (for instance Hotmail).

## Recording the animations again

1. Local demo stack and seed exactly as in `scripts/tutorial-videos/README.md` (steps 1 to 3), built
   from `origin/master` so the recording shows the product as it is.
2. Record:
   `TEST_USER_EMAIL=$DEMO_EMAIL TEST_USER_PASSWORD=$DEMO_PASSWORD PLAYWRIGHT_BASE_URL=http://localhost:3100 \
   ANNOUNCEMENT_OUT=<dir> npx playwright test -c scripts/announcement-email/playwright.config.ts`
3. Convert: `FFMPEG_PATH=<ffmpeg> ANNOUNCEMENT_OUT=<dir> node scripts/announcement-email/make-gifs.mjs`.
   If one is over the size limit, shorten its holds in the spec rather than lowering the quality again.

Each animation opens already showing its caption: Outlook on a desktop shows only the first frame of a
GIF, so that frame has to explain it on its own.

## Preview

`npx tsx scripts/announcement-email/preview.ts --name Elena` writes `announcement-out/preview.html`
(animations from this checkout, so it works before they are deployed). The logo loads from the site.
