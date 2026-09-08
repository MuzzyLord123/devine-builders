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
| `vercel.json` | Vercel config — security headers + `cleanUrls: false`. **Strict schema: no comment keys** (a `_comment_*` property is rejected at deploy time) |
| `_headers` | Same headers for Netlify/Cloudflare Pages — inert on Vercel and GitHub Pages, kept for a future host move |
| `.nojekyll` | GitHub Pages leftover (skip Jekyll processing) — ignored by Vercel, harmless to keep |
| `*-connahs-quay.html` (×8) | Per-service landing pages — **hand-maintained**: edit the HTML directly |
| `chatbot.js` | Free on-site chat assistant (knowledge-based, no APIs) |
| `admin/` | Private enquiry tracker at `/admin/` — owner-only, not linked from the site (see below) |
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

**The host is Vercel** (moved off GitHub Pages). It's a plain static site —
no build step, no framework — so Vercel's "Other" preset serves the repo root
as-is. Import the `MuzzyLord123/devine-builders` repo and leave the Build &
Output settings empty; every push to `main` redeploys.

> **Still to do:** all canonical, Open Graph, sitemap and `robots.txt` URLs
> still point at the retired `https://muzzylord123.github.io/devine-builders`
> address. That is deliberate while the site is on a temporary `*.vercel.app`
> URL (it stops Google indexing the preview domain as the real one), but it
> **must** be swapped the moment a real domain is bought — see checklist item 3.
> Until then the GitHub Pages site should be left up, or those canonical tags
> point at a dead address.

The site now assumes it is served from a **domain root**:

- **`404.html` uses root-absolute links** (`/styles.css`, `/site.js`, …). It has
  to, because a host serves that page for arbitrary nested URLs, where relative
  paths would resolve against the wrong directory. Vercel returns `/404.html`
  for unmatched routes automatically. The old `/devine-builders/` GitHub Pages
  prefix was stripped when the site moved — if it is ever served from a
  sub-path again, that prefix has to come back.
- **`site.webmanifest` uses relative `start_url` / `scope` (`./`)**, so the PWA
  scope follows whatever path the manifest is served from. Leave them relative.
- **Vercel's filesystem is case-sensitive** (Windows is not). A link like
  `images/Logo.png` pointing at `images/logo.png` works locally and 404s in
  production — check the exact case when adding assets.
- `_headers` (Netlify/Cloudflare Pages) and `vercel.json` (Vercel) start being
  honoured on those hosts — they're ignored on GitHub Pages.
- **`vercel.json` deliberately omits `trailingSlash`.** Setting it to `false`
  would redirect `/admin/` to `/admin`, which serves the folder's `index.html`
  from a path where its relative `../styles.css` and `admin.js` no longer
  resolve — the tracker would load unstyled with no JavaScript. Leave the key
  out. (It used to be documented in a `_comment_trailingSlash` key inside
  `vercel.json`; Vercel validates that file against a strict schema and rejects
  unknown properties, so the note lives here instead — do not add comment keys
  back to `vercel.json`.)

No server, database or build step required anywhere.

---

## The enquiry tracker (`/admin/`)

A private page for whoever runs the business: **https://muzzylord123.github.io/devine-builders/admin/**
It is not linked from anywhere on the site, sends `noindex, nofollow`, and is
disallowed in `robots.txt`.

**Access key:** issued separately — ask the site owner; it is deliberately
**not** written down in this repo, because the repo is public and a key
published next to the URL protects nothing. Change it from the panel
(*Your data → Change the access key*) for the device you're on, or permanently
for every device by replacing `DEFAULT_KEY_HASH` in `admin/admin.js` (that
file explains how to generate the new hash). Never commit the key itself.

**Read this before relying on it:**

- **It does not receive quotes automatically.** The site is static, with no
  server or database — quote submissions go straight from the visitor to
  FormSubmit and into the business inbox, and the website never sees them.
  The tracker works by *paste*: open an enquiry email, copy it, paste it in,
  and the panel pulls out the name, email, phone, postcode, service and
  details for you to check and save. You can also type in phone enquiries.
- **The data lives in one browser, on one device.** Nothing is uploaded and
  there is no account, so the panel is empty on any other phone or laptop —
  and clearing your browsing data wipes it. **Use *Back up (JSON)* regularly**
  and keep the file somewhere safe; *Restore from backup* reads it back.
- **On iPhone/iPad, Safari deletes this kind of storage by itself** if you
  don't open the page for **7 days** (its anti-tracking rules make no
  exception for a site's own data). That is the most likely way to lose
  everything, and no warning is given. If you use it on an iPhone, either open
  it at least weekly, add it to the Home Screen (installed pages are exempt),
  or keep a current JSON backup — ideally all three.
- **The key is a privacy curtain, not a lock.** It is checked in the browser,
  so someone technical could bypass it. It stops a passer-by with your
  unlocked phone from reading customers' details — it is not a substitute for
  your device passcode. Genuine server-side logins would need a backend, which
  this site deliberately doesn't have.

**What it does:** tracks each enquiry through *new → quoted → won/lost* with a
quoted value, follow-up date and notes; flags follow-ups that are due; shows
totals, monthly count, jobs won, won value and win rate; searches and filters;
one-tap call / reply-by-email; exports CSV for a spreadsheet; auto-locks after
30 minutes idle.

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
   The `/admin/` tracker holds nothing centrally, so there is no database to
   migrate — but the outgoing owner should either **export a JSON backup for
   the new owner, or delete their tracker data** (*Your data → Delete
   everything*), since it contains customers' personal details. Change the
   access key after handover.
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
