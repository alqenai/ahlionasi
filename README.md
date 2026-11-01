# أهلي وناسي · Ahli o Nasi

Map your family, your friends and everyone in between, then share it as an Instagram story, a post, or a printable PDF.

Live at **[ahlionasi.com](https://ahlionasi.com)** (coming soon page for now).

## Coming soon page

`index.html` is a single static file with no build step. It is set up for GitHub Pages:

1. Repo **Settings → Pages** → Source: *Deploy from a branch*, Branch: `main`, folder `/ (root)`.
2. The `CNAME` file already points Pages at `ahlionasi.com`.
3. At your domain registrar, add DNS records:
   - `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `CNAME` record for `www` → `alqenai.github.io`
4. Back in Settings → Pages, tick **Enforce HTTPS** once the certificate is ready.
