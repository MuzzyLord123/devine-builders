/* =====================================================================
   Devine Builders — chatbot.js  (SHARED, loaded on every page)
   Vanilla JS, defer-safe, no libraries, fully offline. No build step,
   no API keys, no network calls, no cookies — completely free to run.

   A friendly on-site ASSISTANT for Phil Devine's building firm. It is a
   knowledge-based assistant (not a large language model): every answer is
   authored from the site's own content, so it can never invent reviews,
   ratings, years in business, certifications or insurance claims. Anything
   it isn't sure about, it hands straight to Phil (call / email).

   How it works:
     1) A small KNOWLEDGE BASE of intents, each with trigger words/phrases
        and an authored reply (paragraphs + action links + quick replies).
     2) A lightweight INTENT ENGINE: normalise → expand synonyms → score
        every intent → pick the best above a threshold, else a helpful
        fallback that always routes to Phil.
     3) An accessible, themed UI built entirely with DOM APIs (user text is
        only ever inserted via textContent, so it is XSS-safe).

   Progressive enhancement: a single no-op-safe init. Honours
   prefers-reduced-motion, hides itself while the mobile nav is open, is
   auto-inerted by gallery.js when a lightbox opens (it is a <body> child),
   and remembers the conversation for the session (sessionStorage, guarded).
   ===================================================================== */

(function () {
  "use strict";

  /* ---- shared tiny utils (local copies; no coupling to site.js) ----- */

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function prefersReducedMotion() {
    return !!(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  /* =================================================================
     1. SITE FACTS  (single source of truth for the assistant)
     ================================================================= */

  var CONTACT = {
    tel: "+447956547040",
    telDisplay: "07956 547040",
    telIntl: "+44 7956 547040",
    email: "phildevine24@icloud.com",
    facebook: "https://www.facebook.com/phillip.devine1/"
  };

  // Towns/areas exactly as listed on the homepage "Areas we cover".
  var AREAS = [
    "Connah's Quay", "Shotton", "Queensferry", "Hawarden", "Ewloe",
    "Mancot", "Buckley", "Mold", "Flint", "Saltney", "Deeside",
    "Flintshire", "North Wales"
  ];

  // The 8 headline services + the trades in between. `anchor` deep-links to
  // the matching section on services.html. `tags` drive intent matching.
  var SERVICES = [
    {
      id: "extensions", name: "Extensions", anchor: "extensions",
      blurb: "Single- and double-storey extensions, garage and loft conversions, conservatories, porches, garden rooms and outbuildings — built from the groundwork up.",
      items: ["Single- & double-storey extensions", "Garage & loft conversions", "Conservatories, porches & garden rooms", "Outbuildings & new builds"],
      tags: ["extension", "extensions", "extend", "single storey", "double storey", "loft", "loft conversion", "attic", "garage conversion", "conservatory", "conservatories", "porch", "porches", "garden room", "outbuilding", "new build", "new builds", "more space", "extra room"]
    },
    {
      id: "renovations", name: "Renovations", anchor: "renovations",
      blurb: "Full refurbishments and room-by-room renovations, managed from first idea to final finish and kept tidy throughout.",
      items: ["Full home refurbishments", "Kitchens, bathrooms & wet rooms", "Plastering, flooring & joinery", "Structural alterations, RSJs & knock-throughs"],
      tags: ["renovation", "renovations", "renovate", "refurbishment", "refurbish", "refurb", "remodel", "do up", "doing up", "full house", "whole house"]
    },
    {
      id: "brickwork", name: "Brickwork & Masonry", anchor: "brickwork",
      blurb: "Neat, solid brickwork and masonry — new walls, repairs and everything in between, built to keep the weather out.",
      items: ["Bricklaying, blockwork & stonework", "Garden & retaining walls", "Repointing & structural brickwork", "Chimney repairs"],
      tags: ["brick", "bricks", "brickwork", "bricklaying", "bricklayer", "blockwork", "block work", "masonry", "stonework", "stone", "wall", "walls", "garden wall", "retaining wall", "repointing", "pointing", "chimney", "chimneys"]
    },
    {
      id: "groundworks", name: "Groundworks", anchor: "groundworks",
      blurb: "Foundations, drainage and concrete work done right from the very first dig — the groundwork everything else depends on.",
      items: ["Foundations, footings & underpinning", "Site clearance & excavation", "Drainage installation & drain repairs", "Concrete slabs, kerbing & trenching"],
      tags: ["groundwork", "groundworks", "foundation", "foundations", "footing", "footings", "underpinning", "underpin", "drainage", "drain", "drains", "excavation", "excavate", "digging", "dig", "concrete", "slab", "slabs", "kerbing", "trenching", "site clearance"]
    },
    {
      id: "roofing", name: "Roofing", anchor: "roofing",
      blurb: "New roofs, repairs and watertight detailing for pitched and flat roofs — your home's first line of defence against the weather.",
      items: ["New roofs, repairs & flat roofs", "Roof tiling & slate roofing", "Leadwork & chimney repairs", "Fascias, soffits & guttering"],
      tags: ["roof", "roofs", "roofing", "roofer", "flat roof", "pitched roof", "roof repair", "leak", "leaking roof", "tile", "tiles", "tiling", "slate", "slates", "slating", "leadwork", "lead", "fascia", "fascias", "soffit", "soffits", "gutter", "guttering", "gutters"]
    },
    {
      id: "driveways", name: "Driveways & Patios", anchor: "driveways-patios",
      blurb: "Hard-wearing driveways and patios laid on a properly prepared base, so they stay level and drain well for years.",
      items: ["Patios, paths & block paving", "Resin & tarmac driveways", "Concrete driveways"],
      tags: ["driveway", "driveways", "drive", "patio", "patios", "paving", "block paving", "paved", "path", "paths", "resin", "tarmac", "tarmacadam", "concrete driveway", "hardstanding", "parking"]
    },
    {
      id: "landscaping", name: "Landscaping", anchor: "landscaping",
      blurb: "Make the most of your outdoor space with landscaping, decking, fencing and walls built to handle the local weather.",
      items: ["Landscaping & garden walls", "Turfing & artificial grass", "Decking", "Fencing"],
      tags: ["landscaping", "landscape", "garden", "gardens", "decking", "deck", "fence", "fences", "fencing", "turf", "turfing", "lawn", "artificial grass", "astro", "patio garden", "outdoor space"]
    },
    {
      id: "maintenance", name: "Property Maintenance", anchor: "property-maintenance",
      blurb: "Dependable repairs and upkeep — no job too small, with the same care and tidiness as a big project.",
      items: ["General repairs & refurbishments", "Damp & leak repairs", "Insurance, fire & storm damage work", "Interior & exterior decorating"],
      tags: ["maintenance", "repair", "repairs", "fix", "fixing", "handyman", "odd job", "odd jobs", "small job", "small jobs", "damp", "leak", "leaks", "storm damage", "fire damage", "insurance work", "upkeep", "snagging"]
    }
  ];

  // Trades that live UNDER the headline services (the full capabilities
  // grid on services.html). Each maps a topic to the parent service so
  // "do you do plastering?" gets a confident, accurate yes.
  var TRADES = [
    { name: "Kitchens", parent: "renovations", tags: ["kitchen", "kitchens", "kitchen fitting", "worktop", "worktops"] },
    { name: "Bathrooms & wet rooms", parent: "renovations", tags: ["bathroom", "bathrooms", "wet room", "wetroom", "ensuite", "en-suite", "shower room"] },
    { name: "Plastering & rendering", parent: "renovations", tags: ["plaster", "plastering", "plasterer", "skim", "skimming", "render", "rendering", "dry lining", "drylining", "coving", "pebble dash", "pebbledash"] },
    { name: "Carpentry & joinery", parent: "renovations", tags: ["carpentry", "carpenter", "joinery", "joiner", "stud wall", "timber frame", "door", "doors", "staircase", "stairs", "skirting", "architrave", "first fix", "second fix"] },
    { name: "Flooring", parent: "renovations", tags: ["floor", "floors", "flooring", "screed", "screeding", "laminate", "engineered floor", "hardwood floor", "vinyl", "floor tiling"] },
    { name: "Tiling", parent: "renovations", tags: ["tiling", "tiler", "wall tiles", "floor tiles"] },
    { name: "Decorating", parent: "maintenance", tags: ["decorating", "decorator", "painting", "painter", "paint", "wallpaper", "wallpapering", "wood staining"] },
    { name: "Structural work", parent: "renovations", tags: ["structural", "rsj", "rsjs", "steel beam", "steels", "knock through", "knock-through", "knockthrough", "load bearing", "load-bearing", "remove wall", "removing a wall", "open plan"] },
    { name: "Commercial building", parent: "maintenance", tags: ["commercial", "shop fit", "shopfitting", "shop fitting", "office refurbishment", "warehouse", "industrial", "business premises"] }
  ];

  /* =================================================================
     2. REPLY HELPERS  (build the structured message a node-renderer reads)

     A reply = { blocks:[ {type:'p',text} | {type:'actions',items:[…]} ],
                 chips:[ {label, send} | {label, href, external} ] }
     ================================================================= */

  function p(text) { return { type: "p", text: text }; }

  function actions(items) { return { type: "actions", items: items }; }

  // Common action buttons (reused across many replies).
  var ACT = {
    quote: { label: "Get a free quote", href: "quote.html", primary: true },
    call: { label: "Call Phil", href: "tel:" + CONTACT.tel },
    email: { label: "Email Phil", href: "mailto:" + CONTACT.email },
    services: { label: "See all services", href: "services.html" },
    gallery: { label: "View the gallery", href: "gallery.html" },
    facebook: { label: "Message on Facebook", href: CONTACT.facebook, external: true },
    brochure: { label: "Download brochure (PDF)", href: "devine-builders-services.pdf", external: true }
  };

  // Quick-reply chip sets.
  var STARTER_CHIPS = [
    { label: "What services do you offer?", send: "What services do you offer?" },
    { label: "Get a free quote", send: "How do I get a quote?" },
    { label: "Areas you cover", send: "What areas do you cover?" },
    { label: "Contact Phil", send: "How do I contact you?" }
  ];

  function serviceReply(svc, opts) {
    opts = opts || {};
    var blocks = [
      p(svc.name + " — " + svc.blurb),
      p("That includes: " + svc.items.join("; ") + "."),
      actions([
        { label: svc.name + " details", href: "services.html#" + svc.anchor },
        ACT.quote
      ])
    ];
    if (opts.lead) blocks.unshift(p(opts.lead));
    return {
      blocks: blocks,
      chips: [
        { label: "Get a free quote", send: "I'd like a quote for " + svc.name.toLowerCase() },
        { label: "Areas you cover", send: "What areas do you cover?" },
        { label: "Other services", send: "What services do you offer?" }
      ]
    };
  }

  /* =================================================================
     3. KNOWLEDGE BASE  (standalone intents; service intents are added
        programmatically below)
     ================================================================= */

  var INTENTS = [
    {
      id: "greeting",
      tags: ["hi", "hello", "hey", "hiya", "good morning", "good afternoon", "good evening", "alright", "yo", "howdy"],
      onlyShort: true,
      reply: function () {
        return {
          blocks: [p("Hello! 👋 I can help with our building services, the areas we cover, or getting a free, no-obligation quote from Phil. What are you after?")],
          chips: STARTER_CHIPS
        };
      }
    },
    {
      id: "thanks",
      tags: ["thanks", "thank you", "thankyou", "cheers", "ta", "appreciate it", "great thanks"],
      onlyShort: true,
      reply: function () {
        return {
          blocks: [p("You're very welcome! Is there anything else I can help with? You can always call Phil on " + CONTACT.telDisplay + " too.")],
          chips: STARTER_CHIPS
        };
      }
    },
    {
      id: "bye",
      tags: ["bye", "goodbye", "see you", "that's all", "thats all", "nothing else", "no thanks"],
      onlyShort: true,
      reply: function () {
        return {
          blocks: [
            p("Thanks for stopping by! When you're ready, Phil would be glad to help — call " + CONTACT.telDisplay + " or get a free quote any time."),
            actions([ACT.quote, ACT.call])
          ],
          chips: STARTER_CHIPS
        };
      }
    },
    {
      id: "services-overview",
      tags: ["service", "services", "what do you do", "what do you offer", "what can you do", "what work", "type of work", "types of work", "kind of work", "what jobs", "offer", "capabilities", "trades", "everything you do"],
      reply: function () {
        return {
          blocks: [
            p("Devine Builders covers eight main areas:"),
            p("Extensions · Renovations · Brickwork & Masonry · Groundworks · Roofing · Driveways & Patios · Landscaping · Property Maintenance."),
            p("Plus all the trades in between — carpentry & joinery, plastering, kitchens & bathrooms, flooring, decorating and structural work. Which one would you like to know more about?"),
            actions([ACT.services, ACT.quote])
          ],
          chips: [
            { label: "Extensions", send: "Tell me about extensions" },
            { label: "Renovations", send: "Tell me about renovations" },
            { label: "Roofing", send: "Tell me about roofing" },
            { label: "Brickwork", send: "Tell me about brickwork" },
            { label: "Get a free quote", send: "How do I get a quote?" }
          ]
        };
      }
    },
    {
      id: "quote",
      tags: ["quote", "quotation", "quotes", "estimate", "estimates", "get a quote", "free quote", "enquire", "enquiry", "inquiry", "book", "booking", "get started", "interested", "contact form", "request a quote"],
      reply: function () {
        return {
          blocks: [
            p("Getting a free quote is easy — and there's never any obligation:"),
            p("1) Tell us about the job · 2) Phil comes back with a clear, no-pressure quote and a sensible plan · 3) we do the work and keep the site tidy."),
            p("You can fill in the quote form, or call/email Phil directly — he usually gets back to you within a day or two."),
            actions([ACT.quote, ACT.call, ACT.email])
          ],
          chips: [
            { label: "What areas do you cover?", send: "What areas do you cover?" },
            { label: "What services do you offer?", send: "What services do you offer?" }
          ]
        };
      }
    },
    {
      id: "pricing",
      tags: ["price", "prices", "pricing", "cost", "costs", "how much", "expensive", "cheap", "fee", "fees", "charge", "charges", "rate", "rates", "budget", "ballpark", "day rate", "hourly", "afford"],
      reply: function () {
        return {
          blocks: [
            p("Every quote is free and with no obligation. We don't list fixed prices because every job is different — Phil works out a clear, fair price once he understands exactly what you need."),
            p("Tell us about your project and he'll come back to you, usually within a day or two."),
            actions([ACT.quote, ACT.call])
          ],
          chips: [
            { label: "How do I get a quote?", send: "How do I get a quote?" },
            { label: "What services do you offer?", send: "What services do you offer?" }
          ]
        };
      }
    },
    {
      id: "contact",
      tags: ["contact", "phone", "call", "ring", "telephone", "number", "mobile", "email", "e-mail", "mail", "reach you", "get in touch", "speak", "talk", "message", "facebook", "social", "human", "real person", "someone", "speak to", "talk to phil", "talk to someone"],
      reply: function () {
        return {
          blocks: [
            p("You can reach Phil directly — he usually gets back to you within a day or two:"),
            p("📞 Phone: " + CONTACT.telIntl + "   ·   ✉️ Email: " + CONTACT.email),
            actions([ACT.call, ACT.email, ACT.facebook, ACT.quote])
          ],
          chips: [
            { label: "Get a free quote", send: "How do I get a quote?" },
            { label: "What areas do you cover?", send: "What areas do you cover?" }
          ]
        };
      }
    },
    {
      id: "hours",
      tags: ["hours", "opening", "open", "when are you", "availability", "available", "how soon", "response time", "get back", "reply", "how long to hear", "weekend", "weekends", "out of hours"],
      reply: function () {
        return {
          blocks: [
            p("Phil usually gets back to you within a day or two of your message. For anything specific about timing or availability, the quickest thing is to give him a call."),
            actions([ACT.call, ACT.quote])
          ],
          chips: [
            { label: "How do I get a quote?", send: "How do I get a quote?" },
            { label: "Contact Phil", send: "How do I contact you?" }
          ]
        };
      }
    },
    {
      id: "timescale",
      tags: ["how long", "timescale", "timeframe", "time frame", "duration", "lead time", "when can you start", "start date", "how quickly", "turnaround", "how many weeks", "how many days"],
      reply: function () {
        return {
          blocks: [
            p("It really depends on the size of the job — a small repair is very different from a full extension. Phil will give you a realistic timescale along with your free quote, once he's seen what's involved."),
            actions([ACT.quote, ACT.call])
          ],
          chips: [
            { label: "Get a free quote", send: "How do I get a quote?" },
            { label: "What services do you offer?", send: "What services do you offer?" }
          ]
        };
      }
    },
    {
      id: "about",
      tags: ["about", "who are you", "who is phil", "phil devine", "tell me about", "your company", "the company", "the business", "your firm", "owner", "experience", "background", "established", "how long have you"],
      reply: function () {
        return {
          blocks: [
            p("Devine Builders is a small, local, owner-run firm based in Connah's Quay, run by Phil Devine — a hands-on builder. When you call, you talk to the person actually doing the work, not a call centre."),
            p("That means clear advice, fair pricing and no surprises. Phil treats every home like his own: turning up on time, keeping the site tidy and doing things properly the first time."),
            actions([ACT.services, ACT.quote])
          ],
          chips: [
            { label: "What areas do you cover?", send: "What areas do you cover?" },
            { label: "Contact Phil", send: "How do I contact you?" }
          ]
        };
      }
    },
    {
      id: "areas",
      tags: ["area", "areas", "cover", "covered", "coverage", "where", "location", "located", "based", "near me", "do you come", "travel", "local to", "postcode", "town", "region", "flintshire", "north wales", "connah", "deeside"].concat(
        AREAS.map(function (a) { return a.toLowerCase(); })
      ),
      reply: function (ctx) {
        var named = findArea(ctx && ctx.norm);
        var blocks;
        if (named) {
          blocks = [
            p("Yes — " + named + " is right in the area we cover. We're based in Connah's Quay and work across Flintshire and the wider North Wales area. Tell Phil about your project for a free quote."),
            actions([ACT.quote, ACT.call])
          ];
        } else if (ctx && ctx.unknownPlace) {
          blocks = [
            p("We're based in Connah's Quay and cover Flintshire and the wider North Wales area. I can't say for certain about “" + ctx.unknownPlace + "” specifically — the best thing is to ask Phil; he'll let you know straight away."),
            actions([ACT.call, ACT.quote])
          ];
        } else {
          // List the towns, excluding the two region names by value (they're
          // already named in the sentence) — stays correct if AREAS grows.
          var towns = AREAS.filter(function (a) {
            return a !== "Flintshire" && a !== "North Wales";
          });
          blocks = [
            p("We're based in Connah's Quay and cover Flintshire and the wider North Wales area, including: " + towns.join(", ") + " and more."),
            p("If you're nearby and not listed, just ask Phil — he'll happily let you know if he reaches you."),
            actions([ACT.quote, ACT.call])
          ];
        }
        return {
          blocks: blocks,
          chips: [
            { label: "Get a free quote", send: "How do I get a quote?" },
            { label: "What services do you offer?", send: "What services do you offer?" }
          ]
        };
      }
    },
    {
      id: "gallery",
      tags: ["gallery", "photo", "photos", "picture", "pictures", "image", "images", "examples", "portfolio", "past work", "previous work", "see your work", "before and after", "before after"],
      reply: function () {
        return {
          blocks: [
            p("You can see examples on our Gallery page. A quick, honest heads-up: the images there are illustrations for now — Phil is adding real project photos soon."),
            actions([ACT.gallery, ACT.quote])
          ],
          chips: [
            { label: "What services do you offer?", send: "What services do you offer?" },
            { label: "Get a free quote", send: "How do I get a quote?" }
          ]
        };
      }
    },
    {
      id: "brochure",
      tags: ["brochure", "pdf", "leaflet", "download", "price list", "catalogue", "catalog", "document"],
      reply: function () {
        return {
          blocks: [
            p("You can download our services brochure (PDF) — it lists everything we do across Flintshire and North Wales."),
            actions([ACT.brochure, ACT.services, ACT.quote])
          ],
          chips: STARTER_CHIPS.slice(0, 3)
        };
      }
    },
    {
      // HONESTY-CRITICAL: never fabricate insurance, certifications,
      // guarantees, ratings, reviews or years in business. Hand to Phil.
      id: "credentials",
      tags: ["insured", "insurance cover", "public liability", "liability", "certified", "certification", "qualified", "qualification", "accredited", "accreditation", "guarantee", "guaranteed", "warranty", "warrantied", "review", "reviews", "rating", "ratings", "rated", "stars", "testimonial", "testimonials", "references", "reference", "registered", "checkatrade", "trustpilot", "gas safe", "niceic", "years experience", "how many years"],
      reply: function () {
        return {
          blocks: [
            p("That's something Phil is best placed to answer directly, rather than me guessing — give him a call or drop him an email and he'll be happy to talk it through honestly."),
            actions([ACT.call, ACT.email])
          ],
          chips: [
            { label: "Get a free quote", send: "How do I get a quote?" },
            { label: "What services do you offer?", send: "What services do you offer?" }
          ]
        };
      }
    },
    {
      id: "help",
      tags: ["help", "what can you help", "options", "menu", "how does this work", "who am i talking to", "are you a bot", "are you real", "bot", "chatbot", "robot"],
      reply: function () {
        return {
          blocks: [
            p("I'm Devine Builders' automated assistant — happy to help! I can tell you about our services, the areas we cover, how quotes work, or how to reach Phil. For anything specific to your project, Phil is the best person to speak to.")
          ],
          chips: STARTER_CHIPS
        };
      }
    }
  ];

  // Add one intent per headline service, generated from SERVICES.
  SERVICES.forEach(function (svc) {
    INTENTS.push({
      id: "service-" + svc.id,
      tags: svc.tags,
      service: svc,
      reply: function (ctx) {
        return serviceReply(svc, ctx && ctx.lead ? { lead: ctx.lead } : undefined);
      }
    });
  });

  // Add trade intents that route to their parent service with a tailored lead.
  TRADES.forEach(function (trade) {
    INTENTS.push({
      id: "trade-" + trade.name.toLowerCase().replace(/[^a-z]+/g, "-"),
      tags: trade.tags,
      reply: function () {
        var parent = serviceById(trade.parent);
        return serviceReply(parent, {
          lead: "Yes — " + trade.name.toLowerCase() + " is something we do. It falls under our " + parent.name + " work."
        });
      }
    });
  });

  /* =================================================================
     4. INTENT ENGINE
     ================================================================= */

  function normalize(s) {
    return (
      " " +
      String(s == null ? "" : s)
        .toLowerCase()
        .replace(/[‘’ʼ`]/g, "'")
        .replace(/[^a-z0-9'\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim() +
      " "
    );
  }

  // Map loose phrasings onto words the KB already knows. Appended to the
  // normalised text so scoring picks them up without losing the original.
  var SYNONYMS = [
    [["how much", "how much is", "how much does", "whats the cost", "what's the cost"], "price cost"],
    [["come out", "come round", "come to my", "visit", "site visit"], "quote"],
    [["sort out", "sort my", "need someone to", "looking for someone", "need a builder", "looking for a builder"], "quote"],
    [["fit a", "fitting a", "install", "installation", "put in"], "renovation"],
    [["knock down", "take down a wall", "remove a wall", "open up"], "structural"],
    [["wet wall", "damp wall", "rising damp"], "damp"],
    [["block paved", "blockpaved"], "block paving"],
    [["fence panel", "fence panels", "new fence"], "fencing"],
    [["who do i", "who can i", "speak to a person", "talk to a human"], "contact"]
  ];

  function applySynonyms(norm) {
    // norm is already space-padded + whitespace-collapsed, so a space-anchored
    // test gives clean word-boundary matching (no accidental in-word hits).
    var extra = "";
    for (var i = 0; i < SYNONYMS.length; i++) {
      var phrases = SYNONYMS[i][0];
      for (var j = 0; j < phrases.length; j++) {
        if (norm.indexOf(" " + phrases[j] + " ") !== -1) {
          extra += " " + SYNONYMS[i][1];
          break;
        }
      }
    }
    return extra ? norm + extra + " " : norm;
  }

  // Score a single tag against normalised text.
  //   multi-word phrase present  → strong (scaled by word count)
  //   single word present (with word boundaries) → light
  function scoreTag(norm, tag) {
    if (tag.indexOf(" ") !== -1) {
      return norm.indexOf(tag) !== -1 ? 3 + tag.split(" ").length : 0;
    }
    return norm.indexOf(" " + tag + " ") !== -1 ? 2 : 0;
  }

  function scoreIntent(intent, norm, wordCount) {
    // Greetings/thanks only fire on short messages so they don't hijack
    // a longer, more specific question that happens to start with "hi".
    if (intent.onlyShort && wordCount > 4) return 0;
    var total = 0;
    for (var i = 0; i < intent.tags.length; i++) {
      total += scoreTag(norm, intent.tags[i]);
    }
    return total;
  }

  function findArea(norm) {
    if (!norm) return null;
    // Word-boundary match against the space-padded norm, so a short name like
    // "Mold" never matches inside "mouldy" (which would wrongly confirm cover).
    for (var i = 0; i < AREAS.length; i++) {
      if (norm.indexOf(" " + AREAS[i].toLowerCase() + " ") !== -1) return AREAS[i];
    }
    return null;
  }

  function serviceById(id) {
    for (var i = 0; i < SERVICES.length; i++) {
      if (SERVICES[i].id === id) return SERVICES[i];
    }
    return SERVICES[0];
  }

  function fallbackReply() {
    return {
      blocks: [
        p("I'm a simple assistant, so I may have missed that — sorry! I can help with our services, the areas we cover, how free quotes work, or how to reach Phil."),
        p("For anything specific, the best thing is to call Phil on " + CONTACT.telDisplay + " or get a free quote."),
        actions([ACT.quote, ACT.call, ACT.services])
      ],
      chips: STARTER_CHIPS
    };
  }

  function respondTo(text) {
    var norm = applySynonyms(normalize(text));
    var wordCount = norm.trim().split(" ").length;

    var best = null;
    var bestScore = 0;
    for (var i = 0; i < INTENTS.length; i++) {
      var s = scoreIntent(INTENTS[i], norm, wordCount);
      if (s > bestScore) { bestScore = s; best = INTENTS[i]; }
    }

    if (!best || bestScore < 2) return fallbackReply();

    // Build context for intents that look closer at the message.
    var ctx = { norm: norm };
    if (best.id === "areas") {
      var named = findArea(norm);
      if (!named) {
        // A capitalised place-ish word the user typed that we don't cover.
        // Skip common sentence words so "Can you cover…" isn't read as a place.
        var STOP = " do does can could will would are is am the my we you i how what where when why who hi hey hello there your please cover area areas near ";
        var matches = String(text).match(/\b[A-Z][a-z]{2,}\b/g) || [];
        for (var k = 0; k < matches.length; k++) {
          var w = matches[k];
          if (AREAS.indexOf(w) === -1 && STOP.indexOf(" " + w.toLowerCase() + " ") === -1) {
            ctx.unknownPlace = w;
            break;
          }
        }
      }
    }
    return best.reply(ctx);
  }

  /* =================================================================
     5. UI  (built entirely with DOM APIs — user text via textContent only)
     ================================================================= */

  var SVG_NS = "http://www.w3.org/2000/svg";

  function svgIcon(paths, opts) {
    opts = opts || {};
    var el = document.createElementNS(SVG_NS, "svg");
    el.setAttribute("viewBox", "0 0 24 24");
    el.setAttribute("fill", opts.fill || "none");
    if (!opts.fill) {
      el.setAttribute("stroke", "currentColor");
      el.setAttribute("stroke-width", "2");
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("stroke-linejoin", "round");
    } else {
      el.setAttribute("fill", "currentColor");
    }
    el.setAttribute("aria-hidden", "true");
    for (var i = 0; i < paths.length; i++) {
      var path = document.createElementNS(SVG_NS, "path");
      path.setAttribute("d", paths[i]);
      el.appendChild(path);
    }
    return el;
  }

  var ICONS = {
    chat: ["M21 11.5a8.4 8.4 0 0 1-8.5 8.4 8.6 8.6 0 0 1-3.9-.9L3 20.5l1.6-5a8.4 8.4 0 0 1-.9-3.8A8.4 8.4 0 0 1 12.2 3a8.4 8.4 0 0 1 8.8 8.5Z"],
    close: ["M18 6 6 18", "M6 6l12 12"],
    send: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4 20-7Z"]
  };

  var state = {
    open: false,
    messages: [],   // [{ from:'bot'|'user', blocks:[…] }]
    chips: [],
    built: false,
    busy: false
  };

  var els = {};   // DOM references

  var STORE_KEY = "db-chat-v1";

  // Guard against a corrupt / truncated stored entry bricking the panel.
  function validMessage(m) {
    if (!m || (m.from !== "bot" && m.from !== "user")) return false;
    return m.from === "bot" ? Array.isArray(m.blocks) : typeof m.blocks === "string";
  }

  function loadState() {
    try {
      var raw = window.sessionStorage.getItem(STORE_KEY);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (data && Array.isArray(data.messages)) {
        state.messages = data.messages.filter(validMessage).slice(-40);
        state.chips = Array.isArray(data.chips) ? data.chips : [];
        state.open = !!data.open;
      }
    } catch (e) { /* private mode / disabled storage — ignore */ }
  }

  function saveState() {
    try {
      window.sessionStorage.setItem(STORE_KEY, JSON.stringify({
        messages: state.messages.slice(-40),
        chips: state.chips,
        open: state.open
      }));
    } catch (e) { /* ignore */ }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildActions(items) {
    var wrap = el("div", "db-chat__actions");
    items.forEach(function (item) {
      var a = el("a", "db-chat__action" + (item.primary ? " db-chat__action--primary" : ""));
      a.setAttribute("href", item.href);
      a.textContent = item.label;
      if (item.external) {
        a.setAttribute("target", "_blank");
        a.setAttribute("rel", "noopener");
      }
      wrap.appendChild(a);
    });
    return wrap;
  }

  // Render one message's blocks into a bubble element.
  function renderMessage(msg) {
    var row = el("div", "db-chat__msg db-chat__msg--" + msg.from);
    var bubble = el("div", "db-chat__bubble");
    if (msg.from === "bot") {
      (Array.isArray(msg.blocks) ? msg.blocks : []).forEach(function (b) {
        if (b.type === "p") {
          bubble.appendChild(el("p", "db-chat__p", b.text));
        } else if (b.type === "actions") {
          bubble.appendChild(buildActions(b.items));
        }
      });
    } else {
      // user message — plain text only (XSS-safe via textContent)
      bubble.appendChild(el("p", "db-chat__p", msg.blocks));
    }
    row.appendChild(bubble);
    return row;
  }

  function renderChips() {
    if (els.chips) els.chips.remove();
    if (!state.chips || !state.chips.length) { els.chips = null; return; }
    var wrap = el("div", "db-chat__chips");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Suggested questions");
    state.chips.forEach(function (chip) {
      if (chip.href) {
        var a = el("a", "db-chat__chip db-chat__chip--link");
        a.setAttribute("href", chip.href);
        a.textContent = chip.label;
        if (chip.external) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
        wrap.appendChild(a);
      } else {
        var btn = el("button", "db-chat__chip", chip.label);
        btn.type = "button";
        btn.addEventListener("click", function () {
          handleUserText(chip.send || chip.label);
          // Keep keyboard users in flow — return focus to the composer.
          try { els.input.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        });
        wrap.appendChild(btn);
      }
    });
    els.log.appendChild(wrap);
    els.chips = wrap;
  }

  function scrollToBottom() {
    if (els.log) els.log.scrollTop = els.log.scrollHeight;
  }

  function renderAll() {
    els.log.innerHTML = "";
    els.chips = null;
    state.messages.forEach(function (m) {
      try { els.log.appendChild(renderMessage(m)); } catch (e) { /* skip a corrupt entry */ }
    });
    renderChips();
    scrollToBottom();
  }

  function addMessage(msg, opts) {
    opts = opts || {};
    state.messages.push(msg);
    if (state.messages.length > 60) state.messages = state.messages.slice(-60);
    if (!opts.skipRender) {
      // keep chips below the newest message
      if (els.chips) { els.chips.remove(); els.chips = null; }
      els.log.appendChild(renderMessage(msg));
      if (state.chips && state.chips.length) renderChips();
      scrollToBottom();
    }
    saveState();
  }

  function showTyping() {
    if (els.typing) return;
    var row = el("div", "db-chat__msg db-chat__msg--bot db-chat__typing");
    var bubble = el("div", "db-chat__bubble db-chat__bubble--typing");
    // Visually-hidden text so the polite live region actually announces it;
    // the animated dots are decorative.
    bubble.appendChild(el("span", "db-chat__sr", "Assistant is typing…"));
    for (var i = 0; i < 3; i++) {
      var dot = el("span", "db-chat__dot");
      dot.setAttribute("aria-hidden", "true");
      bubble.appendChild(dot);
    }
    row.appendChild(bubble);
    els.log.appendChild(row);
    els.typing = row;
    scrollToBottom();
  }

  function hideTyping() {
    if (els.typing) { els.typing.remove(); els.typing = null; }
  }

  // Core conversation step: echo the user, "think", then reply.
  function handleUserText(text) {
    text = String(text || "").trim();
    if (!text || state.busy) return;

    addMessage({ from: "user", blocks: text });
    state.chips = [];
    if (els.chips) { els.chips.remove(); els.chips = null; }

    var reply = respondTo(text);
    var delay = prefersReducedMotion() ? 0 : 360 + Math.min(text.length * 6, 320);

    if (delay === 0) {
      deliver(reply);
    } else {
      state.busy = true;
      showTyping();
      window.setTimeout(function () {
        hideTyping();
        state.busy = false;
        deliver(reply);
      }, delay);
    }
  }

  function deliver(reply) {
    state.chips = reply.chips || [];
    addMessage({ from: "bot", blocks: reply.blocks });
    // addMessage re-renders chips because state.chips is now set
  }

  function onSubmit(e) {
    e.preventDefault();
    var val = els.input.value;
    els.input.value = "";
    handleUserText(val);
    els.input.focus();
  }

  /* ---- open / close ------------------------------------------------- */

  // At the mobile breakpoint the panel is a full-height bottom sheet and so
  // behaves modally — there we trap focus and mark it aria-modal.
  function isMobileSheet() {
    return !!(window.matchMedia && window.matchMedia("(max-width: 47.99em)").matches);
  }

  function focusablesIn(container) {
    var sel = 'a[href], button:not([disabled]), input:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';
    return Array.prototype.filter.call(container.querySelectorAll(sel), function (n) {
      return n.offsetWidth || n.offsetHeight || n.getClientRects().length;
    });
  }

  function trapTab(e) {
    var f = focusablesIn(els.panel);
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function openPanel(silent) {
    if (state.open) return;
    state.open = true;
    els.root.classList.add("is-open");
    document.body.classList.add("db-chat-active");
    els.launcher.setAttribute("aria-expanded", "true");
    els.launcher.setAttribute("aria-label", "Close chat assistant");
    els.panel.setAttribute("aria-modal", isMobileSheet() ? "true" : "false");
    swapLauncherIcon(true);
    // First-ever open: greet.
    if (!state.messages.length) {
      state.chips = STARTER_CHIPS;
      addMessage({
        from: "bot",
        blocks: [
          p("Hi! 👋 I'm the Devine Builders assistant. I can help with our services, the areas we cover, or getting a free, no-obligation quote from Phil."),
          p("What can I help you with?")
        ]
      });
    } else {
      scrollToBottom();
    }
    // Focus the input for keyboard users, without yanking the page scroll.
    // Skipped when silently restoring an already-open panel on page load.
    if (!silent) {
      window.setTimeout(function () {
        try { els.input.focus({ preventScroll: true }); } catch (e) { els.input.focus(); }
      }, prefersReducedMotion() ? 0 : 120);
    }
    saveState();
  }

  function closePanel(returnFocus) {
    if (!state.open) return;
    state.open = false;
    els.root.classList.remove("is-open");
    document.body.classList.remove("db-chat-active");
    els.launcher.setAttribute("aria-expanded", "false");
    els.launcher.setAttribute("aria-label", "Open chat assistant");
    els.panel.setAttribute("aria-modal", "false");
    swapLauncherIcon(false);
    if (returnFocus !== false) {
      try { els.launcher.focus({ preventScroll: true }); } catch (e) { els.launcher.focus(); }
    }
    saveState();
  }

  function togglePanel() { state.open ? closePanel() : openPanel(); }

  function swapLauncherIcon(isOpen) {
    if (!els.launcherIcon) return;
    var next = svgIcon(isOpen ? ICONS.close : ICONS.chat);
    next.setAttribute("class", "db-chat__launcher-icon");
    els.launcher.replaceChild(next, els.launcherIcon);
    els.launcherIcon = next;
  }

  /* ---- build the widget once --------------------------------------- */

  function build() {
    if (state.built || document.getElementById("db-chat")) return;
    state.built = true;

    var root = el("div", "db-chat");
    root.id = "db-chat";

    /* launcher (FAB) */
    var launcher = el("button", "db-chat__launcher");
    launcher.type = "button";
    launcher.id = "db-chat-launcher";
    launcher.setAttribute("aria-label", "Open chat assistant");
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-expanded", "false");
    launcher.setAttribute("aria-controls", "db-chat-panel");
    var lIcon = svgIcon(ICONS.chat);
    lIcon.setAttribute("class", "db-chat__launcher-icon");
    launcher.appendChild(lIcon);
    launcher.appendChild(el("span", "db-chat__launcher-label", "Chat"));
    launcher.addEventListener("click", togglePanel);

    /* panel */
    var panel = el("div", "db-chat__panel");
    panel.id = "db-chat-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-label", "Devine Builders chat assistant");

    // header
    var header = el("div", "db-chat__header");
    var hText = el("div", "db-chat__header-text");
    hText.appendChild(el("p", "db-chat__title", "Devine Builders"));
    hText.appendChild(el("p", "db-chat__subtitle", "Virtual assistant · here to help"));
    var avatar = el("span", "db-chat__avatar");
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "DB";
    var closeBtn = el("button", "db-chat__close");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close chat");
    var cIcon = svgIcon(ICONS.close);
    cIcon.setAttribute("class", "db-chat__close-icon");
    closeBtn.appendChild(cIcon);
    closeBtn.addEventListener("click", function () { closePanel(); });
    header.appendChild(avatar);
    header.appendChild(hText);
    header.appendChild(closeBtn);

    // message log
    var log = el("div", "db-chat__log");
    log.id = "db-chat-log";
    log.setAttribute("role", "log");
    log.setAttribute("aria-live", "polite");
    log.setAttribute("aria-atomic", "false");
    log.setAttribute("aria-label", "Conversation with the Devine Builders assistant");

    // composer
    var form = el("form", "db-chat__composer");
    form.setAttribute("autocomplete", "off");
    var inputWrap = el("div", "db-chat__input-wrap");
    var input = el("input", "db-chat__input");
    input.type = "text";
    input.id = "db-chat-input";
    input.setAttribute("placeholder", "Ask about services, areas, quotes…");
    input.setAttribute("aria-label", "Type your message to the assistant");
    input.setAttribute("maxlength", "300");
    input.setAttribute("autocomplete", "off");
    var sendBtn = el("button", "db-chat__send");
    sendBtn.type = "submit";
    sendBtn.setAttribute("aria-label", "Send message");
    var sIcon = svgIcon(ICONS.send);
    sIcon.setAttribute("class", "db-chat__send-icon");
    sendBtn.appendChild(sIcon);
    inputWrap.appendChild(input);
    inputWrap.appendChild(sendBtn);
    form.appendChild(inputWrap);
    form.appendChild(el("p", "db-chat__note", "Automated assistant · for anything specific, contact Phil directly."));
    form.addEventListener("submit", onSubmit);

    panel.appendChild(header);
    panel.appendChild(log);
    panel.appendChild(form);

    root.appendChild(panel);
    root.appendChild(launcher);
    document.body.appendChild(root);

    els = {
      root: root, launcher: launcher, launcherIcon: lIcon,
      panel: panel, log: log, form: form, input: input, chips: null, typing: null
    };

    // Esc closes the panel; Tab is trapped while the mobile sheet is open.
    root.addEventListener("keydown", function (e) {
      if (!state.open) return;
      if (e.key === "Escape" || e.keyCode === 27) {
        e.stopPropagation();
        closePanel();
        return;
      }
      if ((e.key === "Tab" || e.keyCode === 9) && isMobileSheet()) {
        trapTab(e);
      }
    });

    // Restore any prior conversation for this browser session.
    renderAll();

    // Hide while the mobile nav menu is open (mirrors the call-bar / to-top).
    var nav = document.querySelector(".primary-nav");
    if (nav && "MutationObserver" in window) {
      var mo = new MutationObserver(function () {
        root.classList.toggle("db-chat--nav-open", nav.classList.contains("is-open"));
      });
      mo.observe(nav, { attributes: true, attributeFilter: ["class"] });
    }

    // On the gallery page, if a lightbox opens it takes over the screen (and
    // gallery.js inerts every body child). Close our panel so it can't be left
    // stranded/inerted underneath — don't fight the lightbox for focus.
    var lightbox = document.getElementById("lightbox");
    if (lightbox && "MutationObserver" in window) {
      var lbo = new MutationObserver(function () {
        if (state.open && !lightbox.hasAttribute("hidden")) closePanel(false);
      });
      lbo.observe(lightbox, { attributes: true, attributeFilter: ["hidden"] });
    }

    // Re-open automatically if it was open before navigating (same session),
    // but silently — don't grab focus / scroll on a fresh page load.
    if (state.open) {
      state.open = false; // force openPanel to run its logic
      openPanel(true);
    }
  }

  function init() {
    if (!document.body) return;
    loadState();
    build();
  }

  ready(init);
})();
