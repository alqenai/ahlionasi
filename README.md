# شرباكة | Shorbaka

Map your family, your friends and everyone in between, then share it as an Instagram story, a post, or a printable PDF.

Live at **[shorbaka.com](https://shorbaka.com)** (coming soon page for now).

## Coming soon page

`index.html` is a single static file with no build step. It is set up for GitHub Pages:

1. Repo **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`.
2. The `CNAME` file already points Pages at `shorbaka.com`.
3. At your domain registrar, add DNS records:
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` record for `www` → `alqenai.github.io`
4. Back in Settings → Pages, tick **Enforce HTTPS** once the certificate is ready.

## Brand

- **Logo:** "Rings" (الحلقتين). Two linked rings, one for family and one for friends, with a pearl in the middle for you.
- **Colours:** navy `#0E2A47`, deep blue `#12385E`, turquoise `#2EC4B6`, coral `#FF8A80`, pearl `#F4EFE6`, sand `#E9C46A`.
- **Font:** [Readex Pro](https://fonts.google.com/specimen/Readex+Pro) for Arabic and Latin.
- **Web icons in this repo:** `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `og-image.png` (link preview), `site.webmanifest`.
