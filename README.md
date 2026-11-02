# شرباكة | Shorbaka

Two sections, picked under the hero:

- **شنو يصير لك؟** Type your name and someone else's, walk the family tree one step at a time, and get the relation written the way people say it («فهد يصير ولد عم أبوي»). Share it as an Instagram story or post, copy it, or keep it in «اللي يصيرون لي».
- **شجرة عائلتي** (`#tree`). Start from yourself and add relatives one by one; under every name it says what they are to you («ولد عمي»). See it from your father's side or your mother's side, and share it as a story or post. Saved in your account when signed in, otherwise on the device.

Live at **[shorbaka.com](https://shorbaka.com)**. The bigger app (mapping family, friends and circles) comes later.

## How the site is built

Static files, no build step, served by GitHub Pages from `main`:

- `index.html`: the page and its styles.
- `kin.js`: the kinship engine (relations, wording, story image) and the page logic.
- `tree.js`: the family tree: its data (one JSON document per person), layout, the picture to share, and the section's page logic.
- `account.js`: Google sign-in and what is saved in the account (saved relations and the family tree), through Supabase. Accounts stay off while its `CONFIG` is empty; everything then lives on the device only.
- `vendor/supabase-2.117.3.js`: the Supabase browser client (from npm `@supabase/supabase-js`, MIT).
- `supabase/migrations/`: the database tables and their row-level security (each account sees only its own rows). Run each file once in the Supabase SQL Editor.

## Hosting

1. Repo **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`.
2. The `CNAME` file points Pages at `shorbaka.com`.
3. At the domain registrar (Hover), DNS records:
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` record for `www` → `alqenai.github.io`
4. In Settings → Pages, tick **Enforce HTTPS** once the certificate is ready. Google sign-in needs HTTPS.

## Accounts (Google sign-in)

1. Supabase project with the migrations in `supabase/migrations/` applied.
2. Google Cloud → Google Auth Platform → a *Web application* client with `https://shorbaka.com` under Authorized JavaScript origins.
3. Supabase → Authentication → Sign In / Providers → Google: enabled, with that client ID under *Client IDs*.
4. Fill `CONFIG` in `account.js` with the project URL, its public (anon) key and the Google client ID.

## لوحة التحكم (admin)

`shorbaka.com/dash/` (`dash/index.html`, `dash/dash.js`): numbers, sign-ups per day, the account list (block, stop a tree link, delete) and recent activity. The page is public; the `admin_*` functions in `supabase/migrations/20261102_admin.sql` answer only accounts listed in `public.admins`. They never return the names inside trees or saved relations.

1. Run `20261102_admin.sql` in the Supabase SQL Editor.
2. Open `shorbaka.com/dash/` signed in; it shows a line `insert into public.admins …` with your account id. Run that line too, then reload.

## Brand

- **Logo:** "Rings" (الحلقتين). Two linked rings, one for family and one for friends, with a pearl in the middle for you.
- **Colours:** navy `#0E2A47`, deep blue `#12385E`, turquoise `#2EC4B6`, coral `#FF8A80`, pearl `#F4EFE6`, sand `#E9C46A`.
- **Font:** [Readex Pro](https://fonts.google.com/specimen/Readex+Pro) for Arabic and Latin.
- **Web icons in this repo:** `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og-image.png` (link preview), `site.webmanifest`.
- **App (PWA):** `site.webmanifest` (with `icon-maskable-512.png` for Android's round icons), `sw.js` and `app.js`. The service worker fetches pages from the network first and keeps a copy for offline; the site's own files are kept (those with `?v=` or under `vendor/` are fetched once), Google Fonts are kept, and Supabase, Google sign-in and `/admin/` are left alone. `app.js` registers it and runs the «نزّل التطبيق» button: the browser's install prompt on Android and computers, the Add to Home Screen steps on iPhone, and «open it in Safari or Chrome first» inside Instagram. Bump `VERSION` in `sw.js` only when its own logic changes; new pages and `?v=` files reach people by themselves.
