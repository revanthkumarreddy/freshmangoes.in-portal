# FreshMangos — premium mango storefront

Fast, SEO-friendly storefront for the FreshMangos family orchard in Srinivasapur, Karnataka.

**Architecture:** [Astro 5](https://astro.build) + React islands + Tailwind v4, statically built and deployed to **GitHub Pages**. The backend (catalog, cart, checkout, members, coupons, shipping, orders) is the existing **FreshMangos Wix site** accessed via the **Wix Headless SDK** — no Wix-hosted frontend.

```
Browser (freshmangoes.com on GitHub Pages)
   │
   │  @wix/sdk + OAuthStrategy (visitor)
   ▼
Wix APIs   ── Catalog V3, Cart, Checkout, Orders, Coupons
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | Astro (SSG) + React 19 (islands) + Tailwind v4 |
| Backend / data | Wix Stores Catalog V3 + Wix eCommerce (existing FreshMangos site) |
| SDK auth | `OAuthStrategy({ clientId })` — visitor flow, no secret |
| Checkout | `currentCart.createCheckoutFromCurrentCart` → `redirects.createRedirectSession` → Wix-hosted checkout |
| Hosting | GitHub Pages (custom domain, free HTTPS) |
| Images | Wix Media CDN (served straight from product `media.main.image.url`) |

## Local development

1. Install Node 20+ if you don't have it.
2. `npm install --legacy-peer-deps`
3. Copy `.env.example` to `.env` (the example already contains the public client ID).
4. `npm run dev` and open http://localhost:4321

> The client ID in `.env` is the **public** OAuth client for browser visitor auth — safe to commit, but kept out of git via `.gitignore`. The example file is committed for new clones.

## Build & preview

```sh
npm run build      # writes static site to ./dist
npm run preview    # serves ./dist on http://localhost:4321
```

## Deploy

Push to `main` and the included [GitHub Actions workflow](.github/workflows/deploy.yml) builds and deploys to GitHub Pages.

### One-time setup on GitHub

1. **Create a public GitHub repo** (e.g. `freshmangoes-web`) and push this folder to it:
   ```sh
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin git@github.com:<your-username>/freshmangoes-web.git
   git push -u origin main
   ```
2. In the repo, go to **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Add a repo secret **Settings → Secrets and variables → Actions → New repository secret**:
   - Name: `PUBLIC_WIX_CLIENT_ID`
   - Value: `838b43b6-ece9-49f0-860c-4bac47c71e2e`
4. Re-run the Actions workflow if it hasn't auto-triggered.

### Custom domain (`freshmangoes.com`)

The `public/CNAME` file already tells GitHub Pages to serve at `freshmangoes.com`. At your domain registrar, add:

| Type | Host | Value |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | `<your-username>.github.io.` |

DNS propagation takes a few minutes to a few hours. GitHub will then auto-provision a Let's Encrypt cert and `https://freshmangoes.com` will go live.

## Wix backend

- **Site:** freshmangos_new1 (https://revanthkumarha.wixsite.com/freshmangos-new1)
- **OAuth Client ID:** `838b43b6-ece9-49f0-860c-4bac47c71e2e` (name "freshmangos_new1")
- **Allowed redirect URIs:** `http://localhost:4321/freshmangoes-web/login-callback`, `https://harshithsunku.github.io/freshmangoes-web/login-callback`

Manage the catalog, orders, payments and coupons at the [Wix dashboard](https://manage.wix.com/). Any product / price / coupon change there shows up here on the next deploy (build re-fetches the catalog).

## Manual to-dos after first deploy

1. **Verify Wix Payments** in the Wix dashboard so the redirect checkout can collect money.
2. **Add real farm photography** — replace the Wix-hosted stock images on each product.
3. **Rebuild on catalog change**: the site SSGs products at build time. After you edit a product in the Wix dashboard, trigger a workflow re-run (Actions → *Deploy to GitHub Pages* → Run workflow) — or wait for the next push.

## Project structure

```
src/
  layouts/Base.astro        Site shell, SEO, fonts
  components/
    Header.astro            Top nav + cart count badge
    Footer.astro
    AddToCart.tsx           Variant picker + add-to-cart (React island)
    CartPage.tsx            Full cart UI (React island)
  lib/
    wix-client.ts           Browser-side Wix SDK singleton
    wix-server.ts           Build-time Wix SDK (no token persistence)
    catalog.ts              Product fetch + price helpers
    cart.ts                 Cart façade + checkout redirect
  pages/
    index.astro             Hero, featured, brand story
    shop/index.astro        Product grid (SSG)
    shop/[slug].astro       PDP (SSG, JSON-LD)
    cart.astro
    thank-you.astro
    about.astro
    faq.astro
    contact.astro
  styles/global.css         Tailwind v4 + brand tokens
public/
  CNAME                     Custom domain pin
  favicon.svg
  placeholder-mango.svg
  robots.txt
```
