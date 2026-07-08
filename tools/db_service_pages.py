# =============================================================================
# ONE-SHOT SCAFFOLD — DO NOT RE-RUN.
# This generator created the 8 *-connahs-quay.html landing pages on 2026-07-02
# and then mutated index.html / services.html / sitemap.xml in place. The HTML
# has since been HAND-EDITED (honesty-review fixes to FAQ answers, paragraphs
# and titles). Re-running this script would silently REVERT those fixes.
# It is kept only as provenance for where the page structure/copy came from.
# The pages are hand-maintained now: edit the .html files directly.
# =============================================================================
raise SystemExit("one-shot scaffold (ran 2026-07-02) — the landing pages are hand-maintained; edit the HTML directly")

# -*- coding: utf-8 -*-
"""Generate 8 per-service local-SEO landing pages for Devine Builders.

Chrome (header/footer) and each service's detail <article> are EXTRACTED from
the live services.html so the new pages can never drift from the site. Content
is honest-only: no reviews/ratings/years/certs/insurance/prices — everything
asserted is drawn from the site's established, true positioning.

Also: retargets the 8 homepage service-card links to the new pages, adds a
"full guide" link to each services.html detail CTA, and extends sitemap.xml.
"""
import os, re

# Site root = the parent of this tools/ folder (portable across machines).
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://muzzylord123.github.io/devine-builders"
TODAY = "2026-07-02"

S = [
    dict(slug="extensions-connahs-quay", art_id="extensions", param="extensions",
         nav="Extensions", noun="extension",
         h1="House Extensions in Connah&rsquo;s Quay &amp; North Wales",
         title="House Extensions Connah's Quay & North Wales | Devine Builders",
         desc="Single- and double-storey extensions, garage and loft conversions across Connah's Quay, Flintshire and North Wales from Devine Builders — a local, owner-run firm. Free, no-obligation quotes.",
         lead="From single-storey kitchen extensions to double-storey additions, garage and loft conversions, Devine Builders designs its work around how you actually want to live &mdash; built properly from the groundwork up.",
         paras=["More space is the most common reason people call Phil &mdash; a growing family, a bigger kitchen, a home office that isn&rsquo;t the corner of a bedroom. Around Connah&rsquo;s Quay and Flintshire, a well-planned extension is often a better move than the upheaval and cost of moving house: done properly, it adds real, usable space and lasting value to the home you already like living in.",
                "Because Devine Builders is owner-run, you deal with Phil from the first walk-round to the final finish. He talks through what you want, agrees a clear plan and a fair price, and manages the build so you always know what&rsquo;s happening and when &mdash; with a tidy site throughout."],
         faq_q="Do I need planning permission for an extension?",
         faq_a="It depends on the size and position of what you want to build — some projects fall under permitted development and others need an application. Every property is different, so Phil will give you straight, honest advice on what your project involves and point you in the right direction before anything is agreed.",
         related=["renovations-connahs-quay", "brickwork-connahs-quay"]),
    dict(slug="renovations-connahs-quay", art_id="renovations", param="renovations",
         nav="Renovations", noun="renovation",
         h1="House Renovations in Connah&rsquo;s Quay &amp; North Wales",
         title="House Renovations Connah's Quay & North Wales | Devine Builders",
         desc="Full home refurbishments, kitchens, bathrooms and structural alterations across Connah's Quay, Flintshire and North Wales. Owner-run, tidy work, free no-obligation quotes.",
         lead="Whole-house refurbishments and room-by-room renovations &mdash; kitchens, bathrooms, plastering, flooring and structural alterations &mdash; managed from first idea to final finish.",
         paras=["A renovation can be one tired room or a whole house that needs bringing back to life. Phil takes on both: full refurbishments, kitchens and bathrooms, plastering, flooring and joinery, and the structural work &mdash; RSJs and knock-throughs &mdash; that opens older homes up for modern living.",
                "You get one point of contact for the whole job. Phil plans the work in a sensible order, keeps the site tidy and liveable where you&rsquo;re staying in the house, and does things properly the first time &mdash; clear advice, fair pricing and no surprises along the way."],
         faq_q="Can you manage the whole renovation from start to finish?",
         faq_a="Yes — that's how Phil prefers to work. He plans the job with you, sequences the trades and stages sensibly, and sees it through from the first strip-out to the final coat of paint, so you deal with one person rather than juggling contractors.",
         related=["extensions-connahs-quay", "maintenance-connahs-quay"]),
    dict(slug="brickwork-connahs-quay", art_id="brickwork", param="brickwork",
         nav="Brickwork", noun="brickwork",
         h1="Bricklaying &amp; Masonry in Connah&rsquo;s Quay &amp; North Wales",
         title="Bricklaying & Masonry Connah's Quay & North Wales | Devine Builders",
         desc="Bricklaying, blockwork, stonework, garden walls, repointing and chimney repairs across Connah's Quay, Flintshire and North Wales. Neat, solid work — free quotes.",
         lead="Neat, solid brickwork and masonry &mdash; new walls, garden and retaining walls, repointing and chimney repairs, all built to keep the North Wales weather out.",
         paras=["Brickwork is the trade this firm was built on. From fresh blockwork for an extension to a garden wall, stonework or structural repairs, Phil lays it straight, keeps the courses true and points it properly &mdash; because brickwork done right should outlast everyone who worked on it.",
                "Coastal Flintshire weather is hard on mortar joints and chimneys. Tired joints let damp track into the house, and a chimney left too long gets expensive. Phil will tell you honestly whether a wall needs repointing, rebuilding or just leaving alone &mdash; and quote you fairly either way."],
         faq_q="Do you take on small brickwork repairs?",
         faq_a="Yes — no job too small is genuinely how the firm works. A blown section of pointing, a wobbly garden wall or a few courses of blockwork get the same care and tidiness as a full build.",
         related=["groundworks-connahs-quay", "extensions-connahs-quay"]),
    dict(slug="groundworks-connahs-quay", art_id="groundworks", param="groundworks",
         nav="Groundworks", noun="groundworks",
         h1="Groundworks in Connah&rsquo;s Quay &amp; North Wales",
         title="Groundworks Connah's Quay & North Wales | Devine Builders",
         desc="Foundations, footings, drainage, excavation and concrete works across Connah's Quay, Flintshire and North Wales from an owner-run local firm. Free, no-obligation quotes.",
         lead="Foundations, footings, drainage and concrete work done right from the very first dig &mdash; the groundwork everything else depends on.",
         paras=["Everything above ground is only as good as what&rsquo;s underneath it. Phil handles site clearance, excavation, foundations and footings, underpinning, drainage installation and repairs, concrete slabs, kerbing and trenching &mdash; the unglamorous work that decides whether a build stays solid for decades.",
                "It&rsquo;s also the stage where honest advice matters most. Ground conditions vary street to street around Deeside, and Phil will tell you plainly what your site needs &mdash; not more, not less &mdash; before any concrete is poured."],
         faq_q="Can you sort drainage problems?",
         faq_a="Yes — drainage installation and drain repairs are part of the groundworks Phil takes on, from a new run for an extension to fixing a persistent soggy patch or blocked gully. He'll find the cause before proposing the fix.",
         related=["driveways-connahs-quay", "brickwork-connahs-quay"]),
    dict(slug="roofing-connahs-quay", art_id="roofing", param="roofing",
         nav="Roofing", noun="roofing",
         h1="Roofing Services in Connah&rsquo;s Quay &amp; North Wales",
         title="Roofing Connah's Quay & North Wales | Roof Repairs & New Roofs — Devine Builders",
         desc="New roofs, roof repairs, tiling, slating, leadwork, fascias, soffits and guttering across Connah's Quay, Flintshire and North Wales. Free, no-obligation quotes from an owner-run firm.",
         lead="New roofs, repairs and watertight detailing for pitched and flat roofs &mdash; your home&rsquo;s first line of defence against the North Wales weather.",
         paras=["A roof problem never gets cheaper by waiting. Whether it&rsquo;s a slipped slate after a storm, a flat roof past its best or a full re-roof, Phil covers tiling and slating, leadwork and chimney details, and the fascias, soffits and guttering that finish the job and keep water where it belongs.",
                "For repairs, a photo taken from the ground is often enough for Phil to gauge the job before he visits. He&rsquo;ll tell you honestly whether you need a repair or a roof &mdash; and never the second when the first will do."],
         faq_q="Do you do small roof repairs or only full roofs?",
         faq_a="Both. A handful of slipped tiles, a leaking valley or a run of new guttering are all jobs Phil takes on — and if a repair will honestly sort it, that's what he'll recommend rather than a new roof.",
         related=["brickwork-connahs-quay", "maintenance-connahs-quay"]),
    dict(slug="driveways-connahs-quay", art_id="driveways-patios", param="driveways",
         nav="Driveways &amp; Patios", noun="driveway or patio",
         h1="Driveways &amp; Patios in Connah&rsquo;s Quay &amp; North Wales",
         title="Driveways & Patios Connah's Quay & North Wales | Block Paving, Resin, Tarmac — Devine Builders",
         desc="Block paving, resin, tarmac and concrete driveways plus patios and paths across Connah's Quay, Flintshire and North Wales. Properly prepared bases, free quotes.",
         lead="Hard-wearing driveways, patios and paths laid on a properly prepared base &mdash; block paving, resin, tarmac or concrete &mdash; so they stay level and drain well for years.",
         paras=["The difference between a driveway that lasts and one that sinks is almost always underneath: the dig-out, the sub-base and the drainage. Phil prepares the ground properly before a single block is laid, then finishes in the surface that suits your home and budget &mdash; block paving, resin, tarmac or concrete.",
                "The same goes for patios and paths: laid level, edged cleanly and drained away from the house. Tell Phil the rough area and the finish you like, and he&rsquo;ll come back with a clear, fair quote."],
         faq_q="Which driveway finishes do you offer?",
         faq_a="Block paving, resin-bound, tarmac and concrete — each with a properly prepared base. Phil will talk through how each one looks, wears and drains on your particular drive so you can pick what suits the house and the budget.",
         related=["landscaping-connahs-quay", "groundworks-connahs-quay"]),
    dict(slug="landscaping-connahs-quay", art_id="landscaping", param="landscaping",
         nav="Landscaping", noun="landscaping",
         h1="Landscaping in Connah&rsquo;s Quay &amp; North Wales",
         title="Landscaping Connah's Quay & North Wales | Decking, Fencing, Garden Walls — Devine Builders",
         desc="Garden landscaping, decking, fencing, turfing, artificial grass and garden walls across Connah's Quay, Flintshire and North Wales. Owner-run, free no-obligation quotes.",
         lead="Make the most of your outdoor space &mdash; landscaping, decking, fencing, turfing and garden walls, all built to handle the local weather.",
         paras=["A garden should work as hard as the house. Phil builds the structure that makes one usable year-round in North Wales: solid decking, straight fencing, retaining and garden walls, turfing and artificial grass &mdash; built once, built properly.",
                "Because the firm also does groundworks and brickwork, the whole job can be handled together: levels sorted, drainage right, walls built and the finished garden left tidy. Describe the space and what you&rsquo;d like from it, and Phil will quote it straight."],
         faq_q="Can you take on the whole garden project?",
         faq_a="Yes — levels and drainage, walls, decking, fencing and lawns can all be handled as one job with one point of contact, rather than juggling separate trades. Photos of the space help Phil quote it accurately.",
         related=["driveways-connahs-quay", "brickwork-connahs-quay"]),
    dict(slug="maintenance-connahs-quay", art_id="property-maintenance", param="maintenance",
         nav="Property Maintenance", noun="maintenance",
         h1="Property Maintenance in Connah&rsquo;s Quay &amp; North Wales",
         title="Property Maintenance Connah's Quay & North Wales | Repairs — Devine Builders",
         desc="General repairs, damp and leak fixes, storm damage and decorating across Connah's Quay, Flintshire and North Wales. No job too small — free, no-obligation quotes.",
         lead="Dependable repairs and upkeep for homes and rentals &mdash; damp and leak repairs, storm damage, decorating and the everyday jobs that keep a property right. No job too small.",
         paras=["Most builders chase the big jobs. Phil takes the small ones seriously too: a leak that keeps coming back, a damp patch, a door that&rsquo;s dropped, insurance and storm-damage repairs, interior and exterior decorating &mdash; done with the same care and tidiness as a full renovation.",
                "For landlords and busy homeowners it&rsquo;s the same straightforward deal: describe the problem (a photo helps), get an honest answer on what&rsquo;s needed, and have it fixed properly by someone local who turns up when he says he will."],
         faq_q="Is any job too small?",
         faq_a="No — 'no job too small' is genuinely how the firm works. If it's quicker to tell you how to fix something yourself, Phil has been known to do that too; honest advice costs nothing.",
         related=["roofing-connahs-quay", "renovations-connahs-quay"]),
]
BY_SLUG = {s["slug"]: s for s in S}

services_html = open(os.path.join(ROOT, "services.html"), encoding="utf-8").read()

def extract(tag_open, tag_close, hay, start=0):
    i = hay.index(tag_open, start)
    j = hay.index(tag_close, i) + len(tag_close)
    return hay[i:j]

HEADER = extract("<header class=\"site-header\">", "</header>", services_html)
# de-activate the Services aria-current for child pages
HEADER = HEADER.replace(' href="services.html" aria-current="page"', ' href="services.html"')
FOOTER = extract("<footer class=\"site-footer\">", "</footer>", services_html)

def article_for(art_id):
    a = extract('<article class="service-detail" id="%s">' % art_id, "</article>", services_html)
    # strip the quote-CTA row (the landing page has its own hero + closing CTAs)
    a = re.sub(r'\s*<p class="service-detail__cta">.*?</p>', "", a, flags=re.S)
    # avoid duplicate-heading confusion with the page H1: keep as-is (h2) ✓
    return a

AREAS_CHIPS = """        <ul class="areas-list" aria-label="Towns and areas we cover">
          <li class="areas-list__chip">Connah's Quay</li>
          <li class="areas-list__chip">Shotton</li>
          <li class="areas-list__chip">Queensferry</li>
          <li class="areas-list__chip">Hawarden</li>
          <li class="areas-list__chip">Ewloe</li>
          <li class="areas-list__chip">Mancot</li>
          <li class="areas-list__chip">Buckley</li>
          <li class="areas-list__chip">Mold</li>
          <li class="areas-list__chip">Flint</li>
          <li class="areas-list__chip">Saltney</li>
          <li class="areas-list__chip">Deeside</li>
          <li class="areas-list__chip">Flintshire</li>
          <li class="areas-list__chip">North Wales</li>
        </ul>"""

CHEVRON = '<span class="faq__chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>'

def faq_item(q, a):
    return ('          <details class="faq__item">\n'
            '            <summary class="faq__q">\n              %s\n              %s\n            </summary>\n'
            '            <div class="faq__a"><p>%s</p></div>\n'
            '          </details>' % (q, CHEVRON, a))

def esc_json(s):
    return s.replace("\\", "\\\\").replace('"', '\\"')

def build(s):
    url = "%s/%s.html" % (BASE, s["slug"])
    faqs = [
        ("How much does %s work cost?" % s["noun"],
         "Every job is different, so there are no fixed price lists — instead every quote is free and comes with no obligation. Tell Phil what you have in mind (photos help) and he'll come back with a clear, fair price you can plan around, usually within a day or two."),
        ("Do you cover my area?",
         "Devine Builders is based in Connah's Quay and works across Flintshire and the wider North Wales area — including Shotton, Queensferry, Hawarden, Ewloe, Buckley, Mold, Flint and Deeside. If you're nearby and not sure, just ask and Phil will let you know either way."),
        (s["faq_q"], s["faq_a"]),
    ]
    faq_html = "\n".join(faq_item(q, a) for q, a in faqs)
    faq_ld = ",\n      ".join(
        '{"@type":"Question","name":"%s","acceptedAnswer":{"@type":"Answer","text":"%s"}}'
        % (esc_json(q), esc_json(a)) for q, a in faqs)
    related_html = "\n".join(
        '            <li><a class="services-jump__link" href="%s.html">%s</a></li>'
        % (r, BY_SLUG[r]["nav"]) for r in s["related"])

    page = """<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{desc}">
  <meta name="author" content="Devine Builders">
  <meta name="theme-color" content="#1d4ed8">
  <link rel="canonical" href="{url}">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:title" content="{title}">
  <meta property="og:description" content="{desc}">
  <meta property="og:url" content="{url}">
  <meta property="og:site_name" content="Devine Builders">
  <meta property="og:locale" content="en_GB">
  <meta property="og:image" content="{base}/images/og-cover.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Devine Builders — extensions, renovations, brickwork, roofing and building services in Connah's Quay, North Wales">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{title}">
  <meta name="twitter:description" content="{desc}">
  <meta name="twitter:image" content="{base}/images/og-cover.png">
  <link rel="icon" href="favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="images/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="images/favicon-16.png">
  <link rel="apple-touch-icon" href="images/apple-touch-icon.png">
  <link rel="manifest" href="site.webmanifest">
  <noscript>
    <style>
      @media (max-width: 47.99em) {{
        .nav-toggle {{ display: none; }}
        .primary-nav {{
          position: static;
          max-height: none;
          overflow: visible;
          opacity: 1;
          visibility: visible;
          transform: none;
        }}
      }}
    </style>
  </noscript>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <canvas class="bg-canvas" aria-hidden="true"></canvas>
  <a class="skip-link" href="#main">Skip to content</a>
{header}

  <main class="main" id="main" tabindex="-1">
    <section class="hero hero--inner">
      <div class="container">
        <div class="section__head section__head--center">
          <nav class="breadcrumb" aria-label="Breadcrumb">
            <a href="index.html">Home</a> <span aria-hidden="true">&rsaquo;</span>
            <a href="services.html">Services</a> <span aria-hidden="true">&rsaquo;</span>
            <span aria-current="page">{nav_plain}</span>
          </nav>
          <p class="section__eyebrow">Owner-run &middot; Free, no-obligation quotes</p>
          <h1 class="section__title">{h1}</h1>
          <p class="section__lead">{lead}</p>
          <div class="hero__actions">
            <a class="btn btn--primary btn--lg" href="quote.html?service={param}">Get a free {noun} quote</a>
            <a class="btn btn--ghost-light btn--lg" href="tel:+447956547040">Call Phil: 07956 547040</a>
          </div>
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="about-work-title">
      <div class="container">
        <div class="section__head">
          <p class="section__eyebrow">Straight talk</p>
          <h2 class="section__title" id="about-work-title">How Phil approaches {noun} work</h2>
        </div>
        <div class="prose">
          <p>{para1}</p>
          <p>{para2}</p>
        </div>
      </div>
    </section>

    <section class="section section--surface" aria-labelledby="{art_id}-title">
      <div class="container">
{article}
      </div>
    </section>

    <section class="section" aria-labelledby="areas-title">
      <div class="container">
        <div class="section__head section__head--center">
          <p class="section__eyebrow">Where we work</p>
          <h2 class="section__title" id="areas-title">{nav_plain} across Flintshire &amp; North Wales</h2>
          <p class="section__lead">Based in Connah's Quay, working across Flintshire and the wider North Wales area &mdash; if you're nearby and not listed, just <a href="quote.html?service={param}">get in touch</a> and Phil will let you know.</p>
        </div>
{areas}
      </div>
    </section>

    <section class="section section--surface" aria-labelledby="faq-title">
      <div class="container">
        <div class="section__head section__head--center">
          <p class="section__eyebrow">FAQ</p>
          <h2 class="section__title" id="faq-title">{nav_plain} questions, answered honestly</h2>
        </div>
        <div class="faq">
{faq}
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="related-title">
      <div class="container">
        <div class="section__head section__head--center">
          <p class="section__eyebrow">Related services</p>
          <h2 class="section__title" id="related-title">Often paired with</h2>
        </div>
        <nav class="services-jump" aria-label="Related services">
          <ul class="services-jump__list">
{related}
            <li><a class="services-jump__link" href="services.html">All services</a></li>
          </ul>
        </nav>
      </div>
    </section>

    <section class="section section--tight" aria-labelledby="cta-title">
      <div class="container">
        <div class="service-area">
          <div class="service-area__body">
            <h2 class="service-area__title" id="cta-title">Ready to talk {noun}?</h2>
            <p class="service-area__text">Tell Phil what you've got in mind and get a free, no-obligation quote &mdash; he usually replies within a day or two.</p>
          </div>
          <div class="hero__actions">
            <a class="btn btn--ghost-light btn--lg" href="quote.html?service={param}">Get a free quote</a>
          </div>
        </div>
      </div>
    </section>
  </main>

{footer}
  <script src="site.js" defer></script>
  <script src="chatbot.js" defer></script>

  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "BreadcrumbList",
        "itemListElement": [
          {{"@type": "ListItem", "position": 1, "name": "Home", "item": "{base}/"}},
          {{"@type": "ListItem", "position": 2, "name": "Services", "item": "{base}/services.html"}},
          {{"@type": "ListItem", "position": 3, "name": "{nav_plain}", "item": "{url}"}}
        ]
      }},
      {{
        "@type": "Service",
        "name": "{nav_plain}",
        "url": "{url}",
        "provider": {{"@id": "{base}/#business"}},
        "areaServed": ["Connah's Quay", "Flintshire", "North Wales"],
        "description": "{desc}"
      }},
      {{
        "@type": "FAQPage",
        "mainEntity": [
      {faq_ld}
        ]
      }}
    ]
  }}
  </script>
</body>
</html>
"""
    nav_plain = s["nav"].replace("&amp;", "&")
    html = page.format(
        title=s["title"].replace("&", "&amp;").replace("&amp;amp;", "&amp;"),
        desc=s["desc"].replace("&", "&amp;").replace("&amp;amp;", "&amp;"),
        url=url, base=BASE, h1=s["h1"], lead=s["lead"], param=s["param"],
        noun=s["noun"], nav_plain=nav_plain.replace("&", "&amp;"),
        para1=s["paras"][0], para2=s["paras"][1],
        art_id=s["art_id"], article=article_for(s["art_id"]),
        areas=AREAS_CHIPS, faq=faq_html, related=related_html,
        header=HEADER, footer=FOOTER, faq_ld=faq_ld,
    )
    # JSON-LD must carry plain text, not entities
    html = html.replace('"name": "%s"' % nav_plain.replace("&", "&amp;"),
                        '"name": "%s"' % nav_plain)
    out = os.path.join(ROOT, s["slug"] + ".html")
    open(out, "w", encoding="utf-8").write(html)
    print("wrote", s["slug"] + ".html", len(html), "bytes")

for s in S:
    build(s)

# ---- retarget the 8 homepage service-card links to the landing pages ----
idx_p = os.path.join(ROOT, "index.html")
idx = open(idx_p, encoding="utf-8").read()
MAP = {"extensions": "extensions-connahs-quay", "renovations": "renovations-connahs-quay",
       "brickwork": "brickwork-connahs-quay", "groundworks": "groundworks-connahs-quay",
       "roofing": "roofing-connahs-quay", "driveways-patios": "driveways-connahs-quay",
       "landscaping": "landscaping-connahs-quay", "property-maintenance": "maintenance-connahs-quay"}
n = 0
for anchor, slug in MAP.items():
    old = 'class="service-card__more" href="services.html#%s"' % anchor
    new = 'class="service-card__more" href="%s.html"' % slug
    if old in idx:
        idx = idx.replace(old, new, 1); n += 1
open(idx_p, "w", encoding="utf-8").write(idx)
print("index card links retargeted:", n)

# ---- add "full guide" links into services.html detail CTA rows ----
sv_p = os.path.join(ROOT, "services.html")
sv = open(sv_p, encoding="utf-8").read()
n = 0
for s in S:
    mark = 'href="quote.html?service=%s">Get a free %s quote</a>' % (s["param"], s["noun"])
    add = ('%s\n            <a class="service-card__more service-detail__more" href="%s.html">'
           'Full %s guide</a>' % (mark, s["slug"], s["nav"].replace("&amp;", "&amp;")))
    if mark in sv and s["slug"] not in sv:
        sv = sv.replace(mark, add, 1); n += 1
open(sv_p, "w", encoding="utf-8").write(sv)
print("services.html guide links added:", n)

# ---- sitemap ----
sm_p = os.path.join(ROOT, "sitemap.xml")
sm = open(sm_p, encoding="utf-8").read()
if "extensions-connahs-quay" not in sm:
    entries = "".join(
        "  <url>\n    <loc>%s/%s.html</loc>\n    <lastmod>%s</lastmod>\n"
        "    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>\n"
        % (BASE, s["slug"], TODAY) for s in S)
    sm = sm.replace("</urlset>", entries + "</urlset>")
    open(sm_p, "w", encoding="utf-8").write(sm)
    print("sitemap: +8 urls")
print("DONE")
