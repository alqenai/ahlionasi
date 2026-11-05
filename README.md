# شرباكة | Shorbaka

Five sections, picked under the hero, in this order from the right: «تحدي · عائلتي · دوامي · ربعي · شنو يصير لك؟». The site opens on «تحدي».

- **شنو يصير لك؟** (`#kin`). Type your name and someone else's, walk the family tree one step at a time, and get the relation written the way people say it («فهد يصير ولد عم أبوي»). Share it as an Instagram story or post, copy it, or keep it in «اللي يصيرون لي».
- **شجرة عائلتي** (`#tree`). Start from yourself and add relatives one by one; under every name it says what they are to you («ولد عمي»). See it from your father's side or your mother's side, and share it as a story or post. Saved in your account when signed in, otherwise on the device.
- **شجرة دوامي** (`#work`). The same idea for a workplace: start from yourself and add your manager, colleagues and the people under you, with their job and department; under every name it says what they are to you («مديرتي»، «زميلي»، «موظف عندي»). Rings are coloured by department. Mark friends at work «ربعي» (a heart) and people who left «طلع من الدوام». Share it as a story or post (with «أخفي الأسامي», only «ربعي» keep their names) or print it as an A4 PDF. Signed in, «رابط الشجرة كاملة» gives the whole tree its own link with no password (`shorbaka.com/w/#code`), and the PDF's QR opens it.
- **ربعي** (`#friends`). Your friends and the groups you know them from (الدوام، كرة القدم، النادي…), drawn as metro lines: your name is the bar on top, each group is a line in its colour, a friend in one group is a station on it, and a friend in several groups is a pearl capsule across their lines. Tap a name or a group to change it. Share it as a story or post or print it as an A4 PDF, picking which groups show (one, some or all) and «الأسامي: كلها / بس اسمي». Signed in, «رابط ربعي» gives it its own link with no password (`shorbaka.com/f/#code`), and the PDF's QR opens it.

- **تحدي** (`#game`), headed «تحدي شرباكة» / Shorbaka Quiz. A family quiz, once a day: 5 questions, each with three answers and ten seconds. A right answer gets 100 points straight away, down to 50 at ten seconds, and 25 after; wrong is 0. Each round has one question from your own «شجرة عائلتي» (or an example family when you have none), two small maps of you and a person («أنا ← أبوي ← أخوه ← ؟»), and riddles or questions about names, generations and counting. At the end the points out of 500 («188 من 500 نقطة»), shared as a story or post that ends with «جرّب تحدي شرباكة». One challenge every 24 hours: per account when signed in (every score is kept under «نتائج التحدي» in the account menu with the points added up, and each can be shared again), per internet address when not (the dashboard can turn that check off). Every challenge is kept for the dashboard's numbers: without an account it carries a random id of the browser instead of the address, whose hash is wiped after two days. The questions live in `public.game_questions` and are edited from the dashboard («الأسئلة»).

Live at **[shorbaka.com](https://shorbaka.com)**. The bigger app (mapping family, friends and circles) comes later.

## How the site is built

Static files, no build step, served by GitHub Pages from `main`:

- `index.html`: the page and its styles.
- `kin.js`: the kinship engine (relations, wording, story image) and the page logic.
- `tree.js`: the family tree: its data (one JSON document per person), layout, the picture to share, and the section's page logic.
- `work.js`: the work tree: its data (one JSON document per person: people, managers, departments), layout, the pictures and PDF, and the section's page logic.
- `w/index.html` + `wlink.js`: the page a work tree's link opens, to look at only (it asks the database for the tree with the link's code).
- `friends.js`: «ربعي»: its data (one JSON document per person: groups and friends), the metro-lines layout, the pictures and PDF, and the section's page logic.
- `f/index.html` + `flink.js`: the page a «رابط ربعي» opens, to look at only.
- `game.js` + `game-bank.js`: «تحدي»: the map drawing (`GAME.mapSvg`, also used by the dashboard), the round, the score picture. `game-bank.js` holds the starter questions, played when the database can't be reached; `supabase/migrations/20261103_game.sql` puts the same list in the table.
- `account.js`: Google sign-in and what is saved in the account (saved relations, the family tree, the work tree and «ربعي»), through Supabase. Accounts stay off while its `CONFIG` is empty; everything then lives on the device only.
- `vendor/supabase-2.117.3.js`: the Supabase browser client (from npm `@supabase/supabase-js`, MIT).
- `supabase/migrations/`: the database tables and their row-level security (each account sees only its own rows). Run each file once in the Supabase SQL Editor.

## Hosting

1. Repo **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`.
2. The `CNAME` file points Pages at `shorbaka.com`.
3. At the domain registrar (Hover), DNS records:
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` record for `www` → `alqenai.github.io`
4. In Settings → Pages, tick **Enforce HTTPS** once the certificate is ready. Google sign-in needs HTTPS.

## Search engines (SEO)

- `index.html` carries the title, description, canonical URL, Open Graph and Twitter cards, and JSON-LD (Organization, WebSite, WebApplication). Only the home page is indexed: the sections (`#kin`, `#tree`…) are parts of it, not separate URLs.
- `sitemap.xml` lists the home page; `robots.txt` points to it. Update `<lastmod>` when the home page changes a lot.
- Private pages stay out of search: `/dash/` and the tree links `/t/`, `/w/`, `/f/` carry `noindex` and are never in the sitemap. They are left crawlable in `robots.txt` on purpose, so search engines can read that `noindex`. The codes after `#` are never sent to any server.
- Google Search Console and Bing Webmaster Tools are verified with a DNS TXT record at Hover (no file in this repo).

## Accounts (Google sign-in)

1. Supabase project with the migrations in `supabase/migrations/` applied.
2. Google Cloud → Google Auth Platform → a *Web application* client with `https://shorbaka.com` under Authorized JavaScript origins.
3. Supabase → Authentication → Sign In / Providers → Google: enabled, with that client ID under *Client IDs*.
4. Fill `CONFIG` in `account.js` with the project URL, its public (anon) key and the Google client ID.

## لوحة التحكم (admin)

`shorbaka.com/dash/` (`dash/index.html`, `dash/dash.js`): numbers, sign-ups per day, the account list (block, stop a tree link, delete) and recent activity. The page is public; the `admin_*` functions in `supabase/migrations/20261102_admin.sql` answer only accounts listed in `public.admins`. They never return the names inside trees or saved relations.

1. Run `20261102_admin.sql` in the Supabase SQL Editor.
2. Open `shorbaka.com/dash/` signed in; it shows a line `insert into public.admins …` with your account id. Run that line too, then reload.

«التحدي» (after `20261103_game_stats.sql`): how many people play (accounts, and browsers for the ones who don't sign in), how many today, finished and unfinished challenges, the average points, and every challenge newest first (the email of signed-in players, «زائر» for the rest). Admins' challenges are listed but left out of the numbers. In «الأسئلة» each question says how many times it came up and how many got it right, and «الأكثر ظهور» puts the most played first, to turn them off and write new ones.

## Brand

- **Logo:** "Rings" (الحلقتين). Two linked rings, one for family and one for friends, with a pearl in the middle for you.
- **Colours:** navy `#0E2A47`, deep blue `#12385E`, turquoise `#2EC4B6`, coral `#FF8A80`, pearl `#F4EFE6`, sand `#E9C46A`.
- **Font:** [Readex Pro](https://fonts.google.com/specimen/Readex+Pro) for Arabic and Latin.
- **Web icons in this repo:** `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og-image.png` (link preview), `site.webmanifest`.
- **App (PWA):** `site.webmanifest` (with `icon-maskable-512.png` for Android's round icons), `sw.js` and `app.js`. The service worker fetches pages from the network first and keeps a copy for offline; the site's own files are kept (those with `?v=` or under `vendor/` are fetched once), Google Fonts are kept, and Supabase, Google sign-in and the dashboard (`/dash/`) are left alone. `app.js` registers it and runs the «نزّل التطبيق» button: the browser's install prompt on Android and computers, the Add to Home Screen steps on iPhone, and «open it in Safari or Chrome first» inside Instagram. Bump `VERSION` in `sw.js` only when its own logic changes; new pages and `?v=` files reach people by themselves.
