# Tutorial videos

Playwright scripts that record the how-to videos for the help manual (`/help`, plan in
`docs/help-manual.md`) and the Instagram reels, always against a **throwaway local stack with a
demo account**, never against production or real patients.

Each spec records two cuts of the same flow: `tutorial` (16:9, desktop) and `reel` (9:16, phone).
Captions, a spotlight on what is being explained, a cursor and a progress bar are drawn inside the
page (`helpers.ts`), so the video needs no editing. `compose.mjs` trims the login, adds the title and
closing cards (`cards.mjs`) and writes the MP4s. The MP4s are never committed: they go to the
DocCy YouTube channel and Instagram.

## Recording

1. **Build from `origin/master`** (`git fetch` first: the recordings show the real UI and go stale).
2. Start a local stack the way the PR e2e does (see `docs/ci-test-policy.md`): a throwaway Supabase
   (`supabase start`, `db reset --local`, `node scripts/ci-db/load.mjs`), then the app on port 3100.
3. Seed the demo doctor, Dr. Elena Christou, with fictional expat patients:
   `node scripts/tutorial-videos/seed-demo.mjs` (refuses non-local URLs; prints `DEMO_EMAIL` and
   `DEMO_PASSWORD`). Re-check it against the schema after pulling: it inserts rows directly.
4. Record: `TEST_USER_EMAIL=$DEMO_EMAIL TEST_USER_PASSWORD=$DEMO_PASSWORD PLAYWRIGHT_BASE_URL=http://localhost:3100 \
   TUTORIAL_VIDEOS_OUT=<out dir> npx playwright test -c scripts/tutorial-videos/playwright.config.ts`
   (Playwright empties the output folder on every run: compose before recording the next one).
5. Cards: `node scripts/tutorial-videos/cards.mjs <name> "<Title>" "<subtitle>"`.
6. Compose: `FFMPEG_PATH=<ffmpeg> node scripts/tutorial-videos/compose.mjs <name> --cards <out dir>/cards`.
   `ffmpeg` is not a dependency of the repo; any build with libx264 works (e.g. `ffmpeg-static`).

Then upload the 16:9 cut to YouTube, put the id in `lib/help-manual.ts` and a poster frame in
`public/help/`. The 9:16 cut is the Instagram reel.

## Files

- `seed-demo.mjs`: demo doctor, clinic, schedule, fictional patients and requests (local only).
- `helpers.ts`: caption, spotlight, cursor, progress bar and click helpers.
- `dashboard-tour.spec.ts`: video "Your dashboard in 20 seconds".
- `demo-data.ts`: ids the specs share with the seed.
- `cards.mjs`, `compose.mjs`: title and closing cards, trimming and encoding.
