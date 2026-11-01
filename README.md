# شرباكة | Shorbaka

شنو يقرب لك؟ Type your name and someone else's, walk the family tree one step at a time, and get the relation written the way people say it («فهد يصير ولد عم أبوي»). Share it as an Instagram story, copy it, or keep it in your wallet.

Live at **[shorbaka.com](https://shorbaka.com)**. The bigger app (mapping family, friends and circles) comes later.

## How the site is built

Static files, no build step, served by GitHub Pages from `main`:

- `index.html`: the page and its styles.
- `kin.js`: the kinship engine (relations, wording, story image) and the page logic.
- `account.js`: Google sign-in and the wallet saved in the account, through Supabase. Accounts stay off while its `CONFIG` is empty; the wallet then lives on the device only.
- `vendor/supabase-2.117.3.js`: the Supabase browser client (from npm `@supabase/supabase-js`, MIT).
- `supabase/migrations/`: the database table and its row-level security (each account sees only its own rows).

## Hosting

1. Repo **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`.
2. The `CNAME` file points Pages at `shorbaka.com`.
3. At the domain registrar (Hover), DNS records:
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` record for `www` → `alqenai.github.io`
4. In Settings → Pages, tick **Enforce HTTPS** once the certificate is ready. Google sign-in needs HTTPS.

## Accounts (Google sign-in)

1. Supabase project with the migration in `supabase/migrations/` applied.
2. Google Cloud → Google Auth Platform → a *Web application* client with `https://shorbaka.com` under Authorized JavaScript origins.
3. Supabase → Authentication → Sign In / Providers → Google: enabled, with that client ID under *Client IDs*.
4. Fill `CONFIG` in `account.js` with the project URL, its public (anon) key and the Google client ID.

## Brand

- **Logo:** "Rings" (الحلقتين). Two linked rings, one for family and one for friends, with a pearl in the middle for you.
- **Colours:** navy `#0E2A47`, deep blue `#12385E`, turquoise `#2EC4B6`, coral `#FF8A80`, pearl `#F4EFE6`, sand `#E9C46A`.
- **Font:** [Readex Pro](https://fonts.google.com/specimen/Readex+Pro) for Arabic and Latin.
- **Web icons in this repo:** `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og-image.png` (link preview), `site.webmanifest`.
