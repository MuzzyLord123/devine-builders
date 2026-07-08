# Devine Builders — website

A fast, accessible, fully self-contained marketing site for **Devine Builders** (Phil Devine — home renovations, property maintenance and garage conversions in Connah's Quay, Flintshire & North Wales).

Plain HTML, CSS and JavaScript. No frameworks, no build step, no external services loaded by default — it works offline and deploys to any static host.

---

## Preview it locally

Any static file server works. From this folder:

```
python -m http.server 8000
```

Then open **http://localhost:8000** in a normal browser (Chrome/Edge/Firefox) — not an in-editor preview panel, since those often don't load the stylesheet.
Tip: if a page ever looks unstyled after an edit, hard-refresh once with **Ctrl + Shift + R** to clear the browser cache.

---

## What's in here

| File | Purpose |
|------|---------|
| `index.html` | Home — hero, services, why-us, process, "Our promise" carousel, FAQ, areas map |
| `services.html` | Detailed services page |
| `gallery.html` | Photo gallery + lightbox + before/after slider |
| `quote.html` | Quote request form + contact details |
| `thank-you.html` | Post-submit confirmation page |
| `404.html` | Friendly not-found page |
| `styles.css` | Single shared stylesheet (blue & white theme) |
| `site.js` | Brick-wall hero bands, photo-hero effects, mobile menu, scroll-reveal, parallax, sticky call bar, before/after slider, promise carousel, back-to-top |
| `gallery.js` / `quote.js` | Lightbox / form validation |
| `images/gallery/` | Your photos go here (placeholders included) |
| `devine-builders-services.pdf` | Downloadable services brochure |
| `devine-builders.vcf` | "Save Phil's number" contact card |
| `favicon.ico`, `images/favicon-16/32.png`, `images/og-cover.png`, `site.webmanifest` | Icons, social share image, PWA manifest (`favicon.svg` / `og-cover.svg` are unlinked design sources) |
| `robots.txt`, `sitemap.xml` | Search-engine files |
| `_headers`, `vercel.json` | Security/caching headers for Netlify/Cloudflare Pages/Vercel — **inert on GitHub Pages** (kept ready for a future host move; there is no active Vercel deployment) |
| `.nojekyll` | Tells GitHub Pages to serve files as-is (skip Jekyll processing) — keep it |
| `*-connahs-quay.html` (×8) | Per-service landing pages — **hand-maintained**: edit the HTML directly |
| `chatbot.js` | Free on-site chat assistant (knowledge-based, no APIs) |
| `tools/db_service_pages.py` | One-shot scaffold that originally generated the 8 landing pages — **do not re-run** (it would revert hand-applied copy fixes; it exits immediately by design) |

---

## ✅ Before you go live — checklist

1. **Swap in real job photos** → the gallery currently shows licensed **stock photos, clearly labelled "Illustrative"** (an honesty decision — they are never presented as Phil's own work):
   - Gallery grid: save each real photo **over the matching filename** in `images/gallery/` — `photo-kitchen.jpg`, `photo-bathroom.jpg`, `photo-extension.jpg`, `photo-brickwork.jpg`, `photo-roofing.jpg`, `photo-driveway.jpg`, `photo-landscaping.jpg` — then remove that slot's "Illustrative" tag and update its alt text in `gallery.html`.
   - Before/after slider: replace the `ba-kitchen-before/after.jpg` and `ba-bathroom-before/after.jpg` pairs with real paired photos (same view, same crop), and remove their "Illustrative" captions.
   - Home hero backdrop: replace `images/hero-kitchen.jpg` (~1920×1280), then regenerate the 960-wide phone variant `images/hero-kitchen-960.jpg` and the hover edge-trace overlay `images/hero-kitchen-edges.webp` — the comments next to the hero `<img>` in `index.html` explain both.
   - See `images/gallery/README.txt` for the full how-to.

2. **Add real testimonials (only when you have them)** → the site deliberately ships with **no customer reviews**: the home page's "Our promise" carousel contains owner-stated commitments, not quotes, and nothing anywhere claims ratings or endorsements. When you have genuine client quotes (with permission to publish), a real testimonials section can be added — the comment above the promise section in `index.html` marks the spot and explains the rule: never invent reviews, ratings, years in business, certifications or insurance claims.

3. **Set your real domain** → once you have one, replace `https://muzzylord123.github.io/devine-builders` everywhere it appears:
   - the `<link rel="canonical">`, `og:url` and social-image URLs in every HTML page,
   - `sitemap.xml` and `robots.txt`,
   - the JSON-LD blocks (business `url`, provider `url`s, WebSite node),
   - `devine-builders.vcf`,
   - the root-absolute `/devine-builders/` links inside `404.html` (change the prefix to `/`),
   - and reset `start_url`/`scope` in `site.webmanifest` to `/`, then add a `CNAME` file.

4. **Quote form — already live** → the form posts to **FormSubmit.co** (free): a background JSON send with a native POST for photo attachments, falling back to the visitor's email app only if both fail. Delivery goes to **phildevine24@icloud.com**. If that inbox ever changes, update the address in BOTH `quote.html` (the form `action`) and `quote.js` (`RECIPIENT`), then submit the form once — FormSubmit emails a one-time activation link to the new address before it starts forwarding.

5. *(Optional)* **Turn on cookie-free analytics** → uncomment one provider in the `<head>` of each page (Plausible / Cloudflare / GoatCounter). They need no cookie banner.

6. *(Optional)* **Enable the Content-Security-Policy** → uncomment the line in `_headers` after testing on your live domain (only takes effect on hosts that read `_headers`; the template already allows FormSubmit).

---

## Deploy

**The site is already live** on GitHub Pages at
**https://muzzylord123.github.io/devine-builders/** — every push to the `main`
branch of the `MuzzyLord123/devine-builders` repo redeploys it automatically
(legacy branch builder, no Actions workflow needed). All canonical, sitemap and
social URLs point at that address until a real domain is set (checklist item 3).

Moving to a different host later? It's plain static files, so anything works —
but note two couplings first:

- **`404.html` hardcodes the `/devine-builders/` path prefix** in all its links
  and assets (required for GitHub Pages project sites, which serve the 404 for
  arbitrary nested URLs). On a host that serves the site at the domain root,
  change that prefix to `/` or the 404 page loads unstyled with dead links.
- `_headers` (Netlify/Cloudflare Pages) and `vercel.json` (Vercel) start being
  honoured on those hosts — they're ignored on GitHub Pages.

No server, database or build step required anywhere.

---

## Handing the site over — ownership transfer checklist

Everything the next owner/maintainer needs, in order:

1. **GitHub repo** — transfer `MuzzyLord123/devine-builders` to the new owner's
   GitHub account (repo Settings → Danger Zone → Transfer). GitHub Pages
   settings usually survive a transfer, but check Settings → Pages afterwards
   and confirm the site is still being served (source: `main` branch, root).
   Note the **site URL changes** with the account name
   (`https://<new-account>.github.io/devine-builders/`) unless a custom domain
   is added — either way, do checklist item 3 above with the new URL/domain.
2. **Quote-form delivery** — submissions currently arrive at
   `phildevine24@icloud.com` via FormSubmit (no account or key to hand over;
   the address in the code IS the wiring). New inbox? See checklist item 4.
3. **Editing** — there is no build step: edit the HTML/CSS/JS directly and push
   to `main`. The 8 `*-connahs-quay.html` landing pages are hand-maintained
   (don't run `tools/db_service_pages.py`; it's disabled for a reason). When a
   page's visible content changes, bump its `<lastmod>` in `sitemap.xml`.
4. **Assets with regeneration notes** — the brochure PDF, the hero image
   variants and the area-map satellite tile all have "how to regenerate"
   comments either in the HTML next to where they're used or in
   `images/gallery/README.txt`.
5. **Past commit authorship** — the repo's history carries the previous
   developer's personal e-mail in commit metadata (visible via `git log`).
   Future commits use a private GitHub noreply address. If the new owner wants
   history fully scrubbed, start a fresh history at transfer:
   `git checkout --orphan fresh && git commit -m "Initial handover commit" && git push -f origin fresh:main`.

---

## Business details (for reference)

- **Devine Builders** — Phil Devine
- Connah's Quay, Flintshire, North Wales
- Phone: +44 7956 547040 · Email: phildevine24@icloud.com
- Facebook: https://www.facebook.com/phillip.devine1/
