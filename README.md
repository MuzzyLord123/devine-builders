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
| `index.html` | Home — hero, services, why-us, process, testimonials, FAQ, areas |
| `services.html` | Detailed services page |
| `gallery.html` | Photo gallery + lightbox + before/after slider |
| `quote.html` | Quote request form + contact details |
| `thank-you.html` | Post-submit confirmation page |
| `404.html` | Friendly not-found page |
| `styles.css` | Single shared stylesheet (blue & white theme) |
| `site.js` | Brick-wall hero, mobile menu, scroll-reveal, sticky call bar, before/after slider, back-to-top |
| `gallery.js` / `quote.js` | Lightbox / form validation |
| `images/gallery/` | Your photos go here (placeholders included) |
| `devine-builders-services.pdf` | Downloadable services brochure |
| `devine-builders.vcf` | "Save Phil's number" contact card |
| `favicon.ico`, `images/favicon-16/32.png`, `images/og-cover.png`, `site.webmanifest` | Icons, social share image, PWA manifest (`favicon.svg` / `og-cover.svg` are unlinked design sources) |
| `robots.txt`, `sitemap.xml` | Search-engine files |
| `_headers` | Security headers (Netlify / Cloudflare Pages) |
| `*-connahs-quay.html` (×8) | Per-service landing pages — **hand-maintained**: edit the HTML directly |
| `chatbot.js` | Free on-site chat assistant (knowledge-based, no APIs) |
| `tools/db_service_pages.py` | One-shot scaffold that originally generated the 8 landing pages — **do not re-run** (it would revert hand-applied copy fixes; it exits immediately by design) |

---

## ✅ Before you go live — checklist

1. **Add your photos** → drop images into `images/gallery/`:
   - Gallery grid: `project-1.jpg` … `project-6.jpg` (until then, tidy placeholders show).
   - Before/after slider (`gallery.html`): replace the illustrative `ba-kitchen-before/after.jpg` and `ba-bathroom-before/after.jpg` pairs with real paired photos (same view, same crop).
   - Home hero (`index.html`): add `images/gallery/hero.jpg` and point the hero `<img>` at it.
   - See `images/gallery/README.txt` for the full how-to.

2. **Add real testimonials** → in `index.html`, replace the clearly-marked **placeholder** quotes in the testimonials section with genuine client quotes. (They're intentionally not fake.)

3. **Set your real domain** → once you have one, replace `https://www.devinebuilders.co.uk` everywhere it appears:
   - the `<link rel="canonical">` and `og:url` in each HTML page,
   - `sitemap.xml` and `robots.txt`,
   - the JSON-LD blocks,
   - `devine-builders.vcf`.

4. **Make the quote form actually send** → it currently opens the visitor's email app (`mailto:`). For a proper "submit and done" experience, switch to a free service like **Formspree** — step-by-step instructions are in the comments of `quote.html` and `quote.js`. (The form already redirects to `thank-you.html` on success.)

5. *(Optional)* **Turn on cookie-free analytics** → uncomment one provider in the `<head>` of each page (Plausible / Cloudflare / GoatCounter). They need no cookie banner.

6. *(Optional)* **Enable the Content-Security-Policy** → uncomment the line in `_headers` after testing on your live domain.

7. *(Optional)* **Add raster icons** → a `favicon.ico` and a 180×180 `apple-touch-icon.png` for older browsers/iOS (the SVG favicon already covers modern browsers).

---

## Deploy

It's static, so any of these work — just upload the whole folder:

- **Netlify** — drag the folder onto app.netlify.com (reads `_headers` automatically).
- **Cloudflare Pages** — connect a repo or direct-upload (reads `_headers` too).
- **GitHub Pages** — push to a repo, enable Pages.

No server, database or build step required.

---

## Business details (for reference)

- **Devine Builders** — Phil Devine
- Connah's Quay, Flintshire, North Wales
- Phone: +44 7956 547040 · Email: phildevine24@icloud.com
- Facebook: https://www.facebook.com/phillip.devine1/
