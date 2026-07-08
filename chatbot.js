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
        fallback that always routes to Phil. On top of that:
        - TYPO TOLERANCE: if nothing matches exactly, a second scoring pass
          allows close misspellings (bounded Damerau-Levenshtein, same first
          two letters) so "drivway" or "extenshion" still land.
        - CONTEXT MEMORY: the last service discussed is remembered, so
          follow-ups like "how much would that cost?" answer in context and
          deep-link the quote form to the right project type.
        - MULTI-TOPIC: "do you do roofing AND driveways?" answers both.
        - POSTCODE AWARENESS: a typed postcode gets the same honest area
          advisory as the quote form (CH4-CH8 / LL covered; ask Phil
          otherwise) — road numbers like the A55 are ignored.
     3) A GUIDED QUOTE FLOW ("Start my quote"): three chip-driven questions
        (job type → location → brief details) that hand off to quote.html
        with the project type pre-selected and the details pre-filled via
        sessionStorage (quote.js only fills fields the visitor left empty).
        It never promises anything beyond the site's established wording.
     4) An accessible, themed UI built entirely with DOM APIs (user text is
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

  // The 8 headline services + the trades in between. `page` is each
  // service's landing page; `tags` drive intent matching.
  var SERVICES = [
    {
      id: "extensions", name: "Extensions", page: "extensions-connahs-quay.html",
      blurb: "Single- and double-storey extensions, garage and loft conversions, conservatories, porches, garden rooms and outbuildings — built from the groundwork up.",
      items: ["Single- & double-storey extensions", "Garage & loft conversions", "Conservatories, porches & garden rooms", "Outbuildings & new builds"],
      tags: ["extension", "extensions", "extend", "single storey", "double storey", "loft", "loft conversion", "attic", "garage", "garage conversion", "conservatory", "conservatories", "porch", "porches", "garden room", "outbuilding", "new build", "new builds", "more space", "extra room"]
    },
    {
      id: "renovations", name: "Renovations", page: "renovations-connahs-quay.html",
      blurb: "Full refurbishments and room-by-room renovations, managed from first idea to final finish and kept tidy throughout.",
      items: ["Full home refurbishments", "Kitchens, bathrooms & wet rooms", "Plastering, flooring & joinery", "Structural alterations, RSJs & knock-throughs"],
      tags: ["renovation", "renovations", "renovate", "refurbishment", "refurbish", "refurb", "remodel", "do up", "doing up", "full house", "whole house"]
    },
    {
      id: "brickwork", name: "Brickwork & Masonry", page: "brickwork-connahs-quay.html",
      blurb: "Neat, solid brickwork and masonry — new walls, repairs and everything in between, built to keep the weather out.",
      items: ["Bricklaying, blockwork & stonework", "Garden & retaining walls", "Repointing & structural brickwork", "Chimney repairs"],
      tags: ["brick", "bricks", "brickwork", "bricklaying", "bricklayer", "blockwork", "block work", "masonry", "stonework", "stone", "wall", "walls", "garden wall", "retaining wall", "repointing", "pointing", "chimney", "chimneys"]
    },
    {
      id: "groundworks", name: "Groundworks", page: "groundworks-connahs-quay.html",
      blurb: "Foundations, drainage and concrete work done right from the very first dig — the groundwork everything else depends on.",
      items: ["Foundations, footings & underpinning", "Site clearance & excavation", "Drainage installation & drain repairs", "Concrete slabs, kerbing & trenching"],
      tags: ["groundwork", "groundworks", "foundation", "foundations", "footing", "footings", "underpinning", "underpin", "drainage", "drain", "drains", "excavation", "excavate", "digging", "dig", "concrete", "slab", "slabs", "kerbing", "trenching", "site clearance"]
    },
    {
      id: "roofing", name: "Roofing", page: "roofing-connahs-quay.html",
      blurb: "New roofs, repairs and watertight detailing for pitched and flat roofs — your home's first line of defence against the weather.",
      items: ["New roofs, repairs & flat roofs", "Roof tiling & slate roofing", "Leadwork & chimney repairs", "Fascias, soffits & guttering"],
      tags: ["roof", "roofs", "roofing", "roofer", "flat roof", "pitched roof", "roof repair", "leak", "leaking roof", "tile", "tiles", "tiling", "slate", "slates", "slating", "leadwork", "lead", "fascia", "fascias", "soffit", "soffits", "gutter", "guttering", "gutters"]
    },
    {
      id: "driveways", name: "Driveways & Patios", page: "driveways-connahs-quay.html",
      blurb: "Hard-wearing driveways and patios laid on a properly prepared base, so they stay level and drain well for years.",
      items: ["Patios, paths & block paving", "Resin & tarmac driveways", "Concrete driveways"],
      tags: ["driveway", "driveways", "drive", "patio", "patios", "paving", "block paving", "paved", "path", "paths", "resin", "tarmac", "tarmacadam", "concrete driveway", "hardstanding", "parking"]
    },
    {
      id: "landscaping", name: "Landscaping", page: "landscaping-connahs-quay.html",
      blurb: "Make the most of your outdoor space with landscaping, decking, fencing and walls built to handle the local weather.",
      items: ["Landscaping & garden walls", "Turfing & artificial grass", "Decking", "Fencing"],
      tags: ["landscaping", "landscape", "garden", "gardens", "decking", "deck", "fence", "fences", "fencing", "turf", "turfing", "lawn", "artificial grass", "astro", "patio garden", "outdoor space"]
    },
    {
      id: "maintenance", name: "Property Maintenance", page: "maintenance-connahs-quay.html",
      blurb: "Dependable repairs and upkeep — no job too small, with the same care and tidiness as a big project.",
      items: ["General repairs & refurbishments", "Damp & leak repairs", "Insurance, fire & storm damage work", "Interior & exterior decorating"],
      tags: ["maintenance", "repair", "repairs", "fix", "fixing", "handyman", "odd job", "odd jobs", "small job", "small jobs", "damp", "leak", "leaks", "storm damage", "fire damage", "insurance work", "upkeep", "snagging"]
    }
  ];

  // Trades that live UNDER the headline services (the full capabilities
  // grid on services.html). Each maps a topic to the parent service so
  // "do you do plastering?" gets a confident, accurate yes.
  var TRADES = [
    { name: "Kitchens", parent: "renovations", tags: ["kitchen", "kitchens", "kitchen fitting", "worktop", "worktops", "appliance", "appliances", "appliance fitting"] },
    { name: "Bathrooms & wet rooms", parent: "renovations", tags: ["bathroom", "bathrooms", "wet room", "wetroom", "ensuite", "en-suite", "shower room"] },
    { name: "Plastering & rendering", parent: "renovations", tags: ["plaster", "plastering", "plasterer", "skim", "skimming", "render", "rendering", "dry lining", "drylining", "boarding", "plasterboard", "coving", "pebble dash", "pebbledash", "silicone render", "silicone rendering"] },
    { name: "Carpentry & joinery", parent: "renovations", tags: ["carpentry", "carpenter", "joinery", "joiner", "stud wall", "stud walls", "timber frame", "timber framing", "door", "doors", "door frame", "door frames", "staircase", "staircases", "stairs", "skirting", "architrave", "architraves", "first fix", "second fix"] },
    { name: "Flooring", parent: "renovations", tags: ["floor", "floors", "flooring", "screed", "screeding", "laminate", "engineered floor", "engineered flooring", "hardwood floor", "hardwood flooring", "vinyl", "floor tiling"] },
    { name: "Tiling", parent: "renovations", tags: ["tiling", "tiler", "wall tiles", "floor tiles"] },
    { name: "Decorating", parent: "maintenance", tags: ["decorating", "decorator", "painting", "painter", "paint", "wallpaper", "wallpapering", "wood staining", "interior painting", "exterior painting", "wood treatment", "staining"] },
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
    { label: "Start a free quote", send: "Start my quote" },
    { label: "Areas you cover", send: "What areas do you cover?" },
    { label: "Contact Phil", send: "How do I contact you?" }
  ];

  function serviceReply(svc, opts) {
    opts = opts || {};
    var blocks = [
      p(svc.name + " — " + svc.blurb),
      p("That includes: " + svc.items.join("; ") + "."),
      actions([
        { label: svc.name + " details", href: svc.page },
        ACT.quote
      ])
    ];
    if (opts.lead) blocks.unshift(p(opts.lead));
    return {
      blocks: blocks,
      chips: [
        { label: "Start my quote", send: "Start my quote" },
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
      tags: ["service", "services", "what do you do", "what do you offer", "what can you do", "what work", "type of work", "types of work", "kind of work", "what jobs", "offer", "capabilities", "trades", "everything you do", "what else do you", "anything else you"],
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
      reply: function (ctx) {
        var svc = ctx && ctx.svc;
        var quoteAct = svc
          ? { label: "Quote form — " + svc.name, href: "quote.html?service=" + svc.id, primary: true }
          : ACT.quote;
        return {
          blocks: [
            p("Getting a free quote is easy — and there's never any obligation:"),
            p("1) Tell us about the job · 2) Phil comes back with a clear, no-pressure quote and a sensible plan · 3) we do the work and keep the site tidy."),
            p("You can fill in the quote form, or call/email Phil directly — he usually gets back to you within a day or two. Or answer three quick questions right here and I'll set the form up for you."),
            actions([quoteAct, ACT.call, ACT.email])
          ],
          chips: [
            { label: "Start my quote here", send: "Start my quote" },
            { label: "What areas do you cover?", send: "What areas do you cover?" }
          ]
        };
      }
    },
    {
      id: "pricing",
      tags: ["price", "prices", "pricing", "cost", "costs", "how much", "expensive", "cheap", "fee", "fees", "charge", "charges", "rate", "rates", "budget", "ballpark", "day rate", "hourly", "afford"],
      reply: function (ctx) {
        var svc = ctx && ctx.svc;
        var quoteAct = svc
          ? { label: "Get a " + svc.name.toLowerCase() + " quote", href: "quote.html?service=" + svc.id, primary: true }
          : ACT.quote;
        return {
          blocks: [
            p("Every quote is free and with no obligation. We don't list fixed prices because every job is different — Phil works out a clear, fair price once he understands exactly what you need." + (svc ? " That goes for " + svc.name.toLowerCase() + " too: the size and spec make all the difference." : "")),
            p("Tell us about your project and he'll come back to you, usually within a day or two."),
            actions([quoteAct, ACT.call])
          ],
          chips: [
            { label: "Start my quote", send: "Start my quote" },
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
      reply: function (ctx) {
        var svc = ctx && ctx.svc;
        var quoteAct = svc
          ? { label: "Get a " + svc.name.toLowerCase() + " quote", href: "quote.html?service=" + svc.id, primary: true }
          : ACT.quote;
        return {
          blocks: [
            p("It really depends on the size of the job — a small repair is very different from a full extension. Phil will give you a realistic timescale along with your free quote, once he's seen what's involved." + (svc ? " For " + svc.name.toLowerCase() + ", just tell him what you have in mind and he'll be straight with you about timing." : "")),
            actions([quoteAct, ACT.call])
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
    },
    {
      // Short follow-up like "tell me more" — expands on the last service
      // discussed (conversation context), else asks which topic.
      id: "more",
      tags: ["more", "tell me more", "more info", "more details", "more information", "go on", "what else"],
      onlyShort: true,
      reply: function (ctx) {
        if (ctx && ctx.svc) {
          return serviceReply(ctx.svc, { lead: "Happy to — here's more on our " + ctx.svc.name.toLowerCase() + " work." });
        }
        return {
          blocks: [p("Happy to! Which topic — one of our services, the areas we cover, or how free quotes work?")],
          chips: STARTER_CHIPS
        };
      }
    },
    {
      // Kicks off the guided quote flow (handled in deliver()).
      id: "quote-start",
      tags: ["start my quote", "start a quote", "start quote", "start my quote here", "quote in chat", "quick questions", "three questions", "3 questions"],
      reply: function () {
        return { startFlow: "quote" };
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
      tradeParent: trade.parent,
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
    [["who do i", "who can i", "speak to a person", "talk to a human"], "contact"],
    [["lino", "linoleum"], "vinyl"],
    [["annexe", "annex", "granny flat"], "extension"],
    [["re roof", "reroof", "reroofing"], "roofing"],
    [["resurface", "resurfacing"], "driveway"],
    // "mould"/"mouldy" (and explicit mold-on-wall phrasings) mean damp, not
    // the town of Mold — weight with two maintenance words so the damp
    // answer outscores the areas intent's town match.
    [["mould", "mouldy", "mold on the wall", "mold on my wall", "mold in the"], "damp leak"]
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
  //   fuzzy pass only: a close misspelling of a single-word tag → light
  function scoreTag(norm, tag, words, fuzzy) {
    if (tag.indexOf(" ") !== -1) {
      return norm.indexOf(" " + tag + " ") !== -1 ? 3 + tag.split(" ").length : 0;
    }
    if (norm.indexOf(" " + tag + " ") !== -1) return 2;
    if (fuzzy && words) {
      for (var i = 0; i < words.length; i++) {
        if (isCloseMisspelling(words[i], tag)) return 2;
      }
    }
    return 0;
  }

  // "Is this word a typo of that tag?" — bounded Damerau-Levenshtein with
  // guard rails: both reasonably long, SAME FIRST TWO LETTERS (typos rarely
  // hit the start of a word, and it keeps e.g. glass/grass apart), length
  // within budget, then distance ≤ 1 (≤ 2 for tags of 8+ letters).
  function isCloseMisspelling(word, tag) {
    if (word === tag || word.length < 4 || tag.length < 5) return false;
    if (word.charAt(0) !== tag.charAt(0) || word.charAt(1) !== tag.charAt(1)) return false;
    var max = tag.length >= 8 ? 2 : 1;
    if (Math.abs(word.length - tag.length) > max) return false;
    return damerau(word, tag, max) <= max;
  }

  // Damerau-Levenshtein distance (optimal string alignment), bailing out
  // early once a whole row exceeds `max`.
  function damerau(a, b, max) {
    var al = a.length, bl = b.length;
    var prev2 = null, prev = [], curr, i, j;
    for (j = 0; j <= bl; j++) prev[j] = j;
    for (i = 1; i <= al; i++) {
      curr = [i];
      var rowMin = i;
      for (j = 1; j <= bl; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        var v = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
        if (prev2 && i > 1 && j > 1 &&
            a.charAt(i - 1) === b.charAt(j - 2) &&
            a.charAt(i - 2) === b.charAt(j - 1)) {
          v = Math.min(v, prev2[j - 2] + 1);
        }
        curr[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      prev2 = prev; prev = curr;
    }
    return prev[bl];
  }

  function scoreIntent(intent, norm, wordCount, words, fuzzy) {
    // Greetings/thanks only fire on short messages so they don't hijack
    // a longer, more specific question that happens to start with "hi".
    if (intent.onlyShort && wordCount > 4) return 0;
    var total = 0;
    for (var i = 0; i < intent.tags.length; i++) {
      total += scoreTag(norm, intent.tags[i], words, fuzzy);
    }
    return total;
  }

  function findArea(norm) {
    if (!norm) return null;
    // Apostrophe-stripped copy so "connahs quay" still matches "Connah's
    // Quay" (dropping an apostrophe never shortens a town name into a
    // substring of another word, so the boundary guarantee holds).
    var flat = norm.replace(/'/g, "");
    // Word-boundary match against the space-padded norm, so a short name like
    // "Mold" never matches inside "mouldy" (which would wrongly confirm cover).
    for (var i = 0; i < AREAS.length; i++) {
      var a = AREAS[i].toLowerCase();
      if (norm.indexOf(" " + a + " ") !== -1) return AREAS[i];
      if (a.indexOf("'") !== -1 && flat.indexOf(" " + a.replace(/'/g, "") + " ") !== -1) return AREAS[i];
    }
    return null;
  }

  function serviceById(id) {
    for (var i = 0; i < SERVICES.length; i++) {
      if (SERVICES[i].id === id) return SERVICES[i];
    }
    return SERVICES[0];
  }

  // Strict variant for validating stored/context ids — no fallback.
  function serviceByIdStrict(id) {
    for (var i = 0; i < SERVICES.length; i++) {
      if (SERVICES[i].id === id) return SERVICES[i];
    }
    return null;
  }

  // The service a given intent is "about" (headline service or a trade's
  // parent), or null for general intents like pricing/contact.
  function serviceForIntent(intent) {
    if (!intent) return null;
    if (intent.service) return intent.service;
    if (intent.tradeParent) return serviceById(intent.tradeParent);
    return null;
  }

  /* ---- conversation context (last service discussed) ---------------- */

  function rememberService(id) {
    if (state.context) { state.context.service = id; saveState(); }
  }

  function contextService() {
    return state.context && state.context.service
      ? serviceByIdStrict(state.context.service)
      : null;
  }

  /* ---- postcode awareness -------------------------------------------
     Same honest rule as the quote form's advisory: CH4–CH8 and any LL
     district are "within the area we cover"; anything else defers to
     Phil. Road numbers (A55, B5125, M56…) are explicitly not postcodes. */

  function findPostcode(text) {
    var up = String(text || "").toUpperCase();
    var re = /\b([A-Z]{1,2}[0-9][0-9A-Z]?)\s*([0-9][A-Z]{2})?\b/g;
    var m;
    while ((m = re.exec(up))) {
      if (!m[2] && /^[ABM][0-9]+$/.test(m[1])) continue; // a road (A55, M56…), not a postcode — keep looking
      return {
        code: m[1] + (m[2] ? " " + m[2] : ""),
        covered: /^CH[4-8]$/.test(m[1]) || /^LL[0-9]{1,2}[A-Z]?$/.test(m[1])
      };
    }
    return null;
  }

  function postcodeReply(pc) {
    var blocks;
    if (pc.covered) {
      blocks = [
        p("Great — " + pc.code + " is within the area we cover. We're based in Connah's Quay and work across Flintshire and the wider North Wales area. Phil will confirm when he's in touch."),
        actions([ACT.quote, ACT.call])
      ];
    } else {
      blocks = [
        p(pc.code + " looks outside our usual patch — we're based in Connah's Quay and cover Flintshire and the wider North Wales area. It's still worth asking though: Phil will tell you straight away, either way."),
        actions([ACT.call, ACT.quote])
      ];
    }
    return {
      blocks: blocks,
      chips: [
        { label: "Start my quote", send: "Start my quote" },
        { label: "What services do you offer?", send: "What services do you offer?" }
      ]
    };
  }

  // "Do you do roofing AND driveways?" — answer every clearly-named
  // service (capped at three) instead of picking one arbitrarily.
  function multiServiceReply(list) {
    var blocks = [p(list.length === 2
      ? "We can help with both of those:"
      : "We can help with all of those:")];
    var acts = [];
    for (var i = 0; i < list.length; i++) {
      var svc = serviceById(list[i].id);
      blocks.push(p(svc.name + " — " + svc.blurb));
      acts.push({ label: svc.name + " details", href: svc.page });
    }
    blocks.push(p("One enquiry can cover the lot — tell Phil what you're planning and he'll quote it as a whole job."));
    acts.push(ACT.quote);
    blocks.push(actions(acts));
    return {
      blocks: blocks,
      chips: [
        { label: "Start my quote", send: "Start my quote" },
        { label: "Areas you cover", send: "What areas do you cover?" }
      ]
    };
  }

  function fallbackReply() {
    return {
      blocks: [
        p("I'm a simple assistant, so I may have missed that — sorry! Short and plain works best with me — try something like 'garden wall cost', 'do you cover CH6?' or 'start a quote'."),
        p("For anything specific, the best thing is to call Phil on " + CONTACT.telDisplay + " or get a free quote."),
        actions([ACT.quote, ACT.call, ACT.services])
      ],
      chips: STARTER_CHIPS
    };
  }

  // One scoring sweep over every intent. Also collects, per headline
  // service, the strongest service/trade intent score — used both for the
  // multi-topic answer and for the guided flow's job-type matcher.
  function scoreAll(norm, words, wordCount, fuzzy) {
    var best = null, bestScore = 0;
    var perService = {};
    for (var i = 0; i < INTENTS.length; i++) {
      var s = scoreIntent(INTENTS[i], norm, wordCount, words, fuzzy);
      if (s > bestScore) { bestScore = s; best = INTENTS[i]; }
      if (s >= 2) {
        var svc = serviceForIntent(INTENTS[i]);
        if (svc && (!perService[svc.id] || s > perService[svc.id].score)) {
          perService[svc.id] = { id: svc.id, score: s };
        }
      }
    }
    var services = [];
    for (var k in perService) {
      if (perService.hasOwnProperty(k)) services.push(perService[k]);
    }
    services.sort(function (a, b) { return b.score - a.score; });
    // Drop weak also-rans (e.g. "garden wall" shouldn't drag landscaping
    // in on the generic word "garden" when brickwork matched the phrase,
    // and one strong match beats two incidental single-word ones).
    if (services.length > 1) {
      var top = services[0].score;
      services = services.filter(function (x) { return x.score * 2 > top; });
    }
    return { best: best, bestScore: bestScore, services: services };
  }

  function respondTo(text) {
    var norm = applySynonyms(normalize(text));
    var words = norm.trim().split(" ");
    var wordCount = words.length;

    // Pass 1: exact matching. Pass 2 (only when nothing lands): allow
    // close misspellings, so a typo never beats a genuine exact match.
    var scored = scoreAll(norm, words, wordCount, false);
    if (scored.bestScore < 2) scored = scoreAll(norm, words, wordCount, true);
    var best = scored.best;
    var bestScore = scored.bestScore;

    // A typed postcode answers "do you cover me?" directly — take over
    // when the message is area-flavoured or nothing else matched.
    var pc = findPostcode(text);
    if (pc && (bestScore < 2 || best.id === "areas")) return postcodeReply(pc);

    if (!best || bestScore < 2) return fallbackReply();

    // "Tell me about extensions" is a question about the SERVICE, not the
    // firm — when the about intent outscores on its "tell me about" phrase
    // but a service was clearly named, answer for the service instead.
    if (best.id === "about" && scored.services.length) {
      var svcAsked = serviceById(scored.services[0].id);
      rememberService(svcAsked.id);
      return scored.services.length >= 2
        ? multiServiceReply(scored.services.slice(0, 3))
        : serviceReply(svcAsked);
    }

    // Two or more different services clearly named → answer them all.
    if (scored.services.length >= 2 && serviceForIntent(best)) {
      rememberService(scored.services[0].id);
      return multiServiceReply(scored.services.slice(0, 3));
    }

    var mentioned = serviceForIntent(best);
    if (mentioned) rememberService(mentioned.id);

    // Build context for intents that look closer at the message. `svc` is
    // the last service discussed, so follow-ups can answer in context.
    var ctx = { norm: norm, svc: contextService() };
    if (best.id === "areas") {
      var named = findArea(norm);
      if (!named) {
        // A capitalised place-ish word the user typed that we don't cover.
        // Skip common sentence words so "Can you cover…" isn't read as a place.
        var STOP = " do does can could will would are is am the my we you i how what whats which whereabouts where when why who hi hey hiya hello there your please cover covers covered coverage area areas near just looking list towns anywhere everywhere ";
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
     4b. GUIDED QUOTE FLOW — three quick questions (job type → location
         → brief details), then a handoff to quote.html with the project
         type in the URL (the existing ?service= deep link) and the rest
         stashed in sessionStorage for quote.js to pre-fill. Chip-driven
         but free text works at every step; "cancel" backs out anywhere.
     ================================================================= */

  var FLOW_STEPS = { type: 1, where: 1, details: 1 };
  var PREFILL_KEY = "db-chat-prefill";

  function isSkipMsg(norm) { return /^ skip( this)?( one)? $/.test(norm); }

  function isCancelMsg(norm) {
    if (norm.indexOf(" cancel ") !== -1) return true;
    var EXACT = [" stop ", " quit ", " exit ", " never mind ", " nevermind ", " forget it ", " no thanks "];
    for (var i = 0; i < EXACT.length; i++) {
      if (norm === EXACT[i]) return true;
    }
    return false;
  }

  // Best-effort mapping of a free-text job description (or a chip label)
  // onto one of the 8 headline services; null → keep their own words.
  function guessService(text) {
    var norm = applySynonyms(normalize(text));
    var words = norm.trim().split(" ");
    var pass = scoreAll(norm, words, words.length, false);
    if (!pass.services.length) pass = scoreAll(norm, words, words.length, true);
    if (pass.services.length) return serviceById(pass.services[0].id);
    for (var i = 0; i < SERVICES.length; i++) {
      if (normalize(SERVICES[i].name) === norm) return SERVICES[i];
    }
    return null;
  }

  function flowCancelReply() {
    state.flow = null;
    lastPrefill = null;
    try { window.sessionStorage.removeItem(PREFILL_KEY); } catch (e) { /* ignore */ }
    saveState();
    return {
      blocks: [
        p("No problem — I've dropped that. The normal quote form is there whenever you want it, and I'm happy to help with anything else."),
        actions([ACT.quote, ACT.call])
      ],
      chips: STARTER_CHIPS
    };
  }

  function beginQuoteFlow() {
    state.flow = { id: "quote", step: "type", data: { service: "", serviceLabel: "", typeText: "", place: "", details: "" } };
    // A fresh flow invalidates any earlier handoff payload — a stale one
    // must never prefill an unrelated later visit to quote.html.
    lastPrefill = null;
    try { window.sessionStorage.removeItem(PREFILL_KEY); } catch (e) { /* ignore */ }
    saveState();
    say({
      blocks: [
        p("Brilliant — three quick questions and I'll set the quote form up for you. No obligation, and Phil reads every enquiry himself."),
        p("First: what type of job is it?")
      ],
      chips: SERVICES.map(function (svc) {
        return { label: svc.name, send: svc.name };
      }).concat([
        { label: "Something else", send: "Something else" },
        { label: "Cancel", send: "cancel" }
      ])
    });
  }

  function flowRespond(text) {
    var flow = state.flow;
    var norm = normalize(text);
    if (isCancelMsg(norm)) return flowCancelReply();
    var skipped = isSkipMsg(norm) || norm === " something else ";

    if (flow.step === "type") {
      var ack;
      if (skipped) {
        ack = "No problem — you can describe it in a moment.";
      } else {
        var guess = guessService(text);
        if (guess) {
          flow.data.service = guess.id;
          flow.data.serviceLabel = guess.name;
          // Keep their own wording too — "loft conversion with a dormer"
          // guesses Extensions, but that detail shouldn't be lost.
          if (normalize(text) !== normalize(guess.name)) flow.data.typeText = String(text).trim().slice(0, 60);
          rememberService(guess.id);
          ack = "Got it — " + guess.name + ".";
        } else {
          flow.data.serviceLabel = String(text).trim().slice(0, 60);
          ack = "Got it — I'll pass that on in your own words.";
        }
      }
      flow.step = "where";
      saveState();
      return {
        blocks: [p(ack), p("Next: whereabouts is the property? A town or postcode is perfect.")],
        chips: [
          { label: "Skip", send: "skip" },
          { label: "Cancel", send: "cancel" }
        ]
      };
    }

    if (flow.step === "where") {
      var ack2;
      if (skipped) {
        ack2 = "No problem.";
      } else {
        flow.data.place = String(text).trim().slice(0, 80);
        var area = findArea(norm);
        var pc = findPostcode(text);
        if (area || (pc && pc.covered)) {
          ack2 = "Great — that's right in the area we cover. Phil will confirm when he's in touch.";
        } else {
          ack2 = "Noted — and if it turns out to be outside Phil's patch, he'll tell you straight away.";
        }
      }
      flow.step = "details";
      saveState();
      return {
        blocks: [p(ack2), p("Last one: tell me a bit about the job — a sentence or two is plenty.")],
        chips: [
          { label: "Skip", send: "skip" },
          { label: "Cancel", send: "cancel" }
        ]
      };
    }

    // step === "details"
    if (!skipped) flow.data.details = String(text).trim().slice(0, 400);
    return finishQuoteFlow();
  }

  function finishQuoteFlow() {
    var d = state.flow.data;
    state.flow = null;

    // Hand the answers to quote.js: the service travels in the URL, the
    // rest via sessionStorage. quote.js only ever fills fields the
    // visitor has left empty, and clears the key immediately.
    var pc = d.place ? findPostcode(d.place) : null;
    var parts = [];
    if (d.service && d.typeText) parts.push("Job type (in their words): " + d.typeText + ".");
    if (!d.service && d.serviceLabel) parts.push("Job type: " + d.serviceLabel + ".");
    if (d.details) parts.push(d.details);
    if (d.place && !pc) parts.push("(Property in " + d.place + ".)");
    var payload = { details: parts.join(" "), postcode: pc ? pc.code : "" };
    lastPrefill = payload;
    try {
      window.sessionStorage.setItem(PREFILL_KEY, JSON.stringify(payload));
    } catch (e) { /* private mode — the form still works, just unfilled */ }
    saveState();

    var summary = "Job: " + (d.serviceLabel || "—") +
      "  ·  Where: " + (d.place || "—") +
      "  ·  Notes: " + (d.details ? (d.details.length > 90 ? d.details.slice(0, 87) + "…" : d.details) : "—");
    return {
      blocks: [
        p("Perfect, that's everything. Here's what I've got:"),
        p(summary),
        p("Tap continue and the quote form will be pre-filled — just add your name and contact details, check it over, and send. Phil usually replies within a day or two."),
        actions([
          { label: "Continue to the quote form", href: "quote.html" + (d.service ? "?service=" + d.service : ""), primary: true },
          ACT.call
        ])
      ],
      chips: [
        { label: "Start again", send: "Start my quote" },
        { label: "Areas you cover", send: "What areas do you cover?" }
      ]
    };
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
    send: ["M22 2 11 13", "M22 2 15 22l-4-9-9-4 20-7Z"],
    restart: ["M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8", "M21 3v5h-5"]
  };

  var state = {
    open: false,
    messages: [],   // [{ from:'bot'|'user', blocks:[…] }]
    chips: [],
    built: false,
    busy: false,
    context: { service: "" },  // last service discussed (id, or "")
    flow: null                 // active guided-quote-flow state, or null
  };

  // Pending assistant-reply timer — cancelled by Restart so a stale reply
  // can't surface after the transcript has been wiped.
  var replyTimer = null;

  // Last completed guided-flow handoff payload — re-stashed on bfcache
  // restores (quote.js consumes the key destructively on load).
  var lastPrefill = null;

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
        state.chips = Array.isArray(data.chips) ? data.chips.filter(function (c) { return c && typeof c === "object" && typeof c.label === "string"; }) : [];
        state.open = !!data.open;
        // Conversation context + any in-progress guided flow survive page
        // navigation, but only if they still validate against the KB.
        if (data.context && typeof data.context.service === "string" && serviceByIdStrict(data.context.service)) {
          state.context.service = data.context.service;
        }
        var f = data.flow;
        if (f && f.id === "quote" && FLOW_STEPS[f.step] === 1 && f.data && typeof f.data === "object") {
          state.flow = {
            id: "quote",
            step: f.step,
            data: {
              service: typeof f.data.service === "string" && serviceByIdStrict(f.data.service) ? f.data.service : "",
              serviceLabel: typeof f.data.serviceLabel === "string" ? f.data.serviceLabel.slice(0, 60) : "",
              typeText: typeof f.data.typeText === "string" ? f.data.typeText.slice(0, 60) : "",
              place: typeof f.data.place === "string" ? f.data.place.slice(0, 80) : "",
              details: typeof f.data.details === "string" ? f.data.details.slice(0, 400) : ""
            }
          };
        }
      }
    } catch (e) { /* private mode / disabled storage — ignore */ }
  }

  function saveState() {
    try {
      window.sessionStorage.setItem(STORE_KEY, JSON.stringify({
        messages: state.messages.slice(-40),
        chips: state.chips,
        open: state.open,
        context: state.context,
        flow: state.flow
      }));
    } catch (e) { /* ignore */ }
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // ES5-safe element removal (Element.remove() is missing in the same old
  // browsers this file's var/function convention otherwise supports).
  function detach(node) {
    if (node && node.parentNode) node.parentNode.removeChild(node);
  }

  // Internal hrefs in the KB are relative ("quote.html"). On 404.html —
  // which GitHub Pages serves for ARBITRARY nested URLs and which therefore
  // uses root-absolute links — a relative link would 404 again, so resolve
  // against the header nav's own quote CTA at render time (same trick as
  // site.js initCallBar). Render-time resolution also fixes transcripts
  // restored from sessionStorage onto the 404 page.
  var HREF_BASE = null;
  function resolveHref(href) {
    if (/^(https?:|mailto:|tel:|\/|#)/.test(href)) return href;
    if (HREF_BASE === null) {
      var cta = document.querySelector(".primary-nav__cta");
      var navHref = cta ? cta.getAttribute("href") || "" : "";
      HREF_BASE = /quote\.html$/.test(navHref)
        ? navHref.slice(0, navHref.length - "quote.html".length)
        : "";
    }
    return HREF_BASE + href;
  }

  function buildActions(items) {
    var wrap = el("div", "db-chat__actions");
    items.forEach(function (item) {
      var a = el("a", "db-chat__action" + (item.primary ? " db-chat__action--primary" : ""));
      a.setAttribute("href", resolveHref(item.href));
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
    if (els.chips) detach(els.chips);
    if (!state.chips || !state.chips.length) { els.chips = null; return; }
    var wrap = el("div", "db-chat__chips");
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", "Suggested questions");
    wrap.setAttribute("aria-live", "off"); // don't pad the log's announcements with chip labels
    state.chips.forEach(function (chip) {
      if (chip.href) {
        var a = el("a", "db-chat__chip db-chat__chip--link");
        a.setAttribute("href", resolveHref(chip.href));
        a.textContent = chip.label;
        if (chip.external) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
        wrap.appendChild(a);
      } else {
        var btn = el("button", "db-chat__chip", chip.label);
        btn.type = "button";
        btn.addEventListener("click", function () {
          handleUserText(chip.send || chip.label);
          // Keep keyboard users in flow. The tapped chip is gone from the
          // DOM now, so focus must land somewhere INSIDE the dialog: the
          // composer on desktop; on the phone sheet the Close button (like
          // openPanel), so the keyboard doesn't pop over the sheet.
          try {
            (isMobileSheet() ? els.close : els.input).focus({ preventScroll: true });
          } catch (e) { /* ignore */ }
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
      if (els.chips) { detach(els.chips); els.chips = null; }
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
    if (els.typing) { detach(els.typing); els.typing = null; }
  }

  // Core conversation step: echo the user, "think", then reply.
  function handleUserText(text) {
    text = String(text || "").trim();
    if (!text || state.busy) return;

    addMessage({ from: "user", blocks: text });
    state.chips = [];
    if (els.chips) { detach(els.chips); els.chips = null; }

    // An active guided flow consumes the message; otherwise the engine.
    // Computed at DELIVERY time (not now) so a Restart during the typing
    // delay can't resurface a stale reply, and flowRespond doesn't mutate
    // flow state before its question is actually rendered.
    var delay = prefersReducedMotion() ? 0 : 360 + Math.min(text.length * 6, 320);
    function produce() { return state.flow ? flowRespond(text) : respondTo(text); }

    if (delay === 0) {
      deliver(produce());
    } else {
      state.busy = true;
      showTyping();
      replyTimer = window.setTimeout(function () {
        replyTimer = null;
        hideTyping();
        state.busy = false;
        deliver(produce());
      }, delay);
    }
  }

  // Plain "post this reply" (also used directly by the guided flow).
  function say(reply) {
    state.chips = reply.chips || [];
    addMessage({ from: "bot", blocks: reply.blocks });
    // addMessage re-renders chips because state.chips is now set
  }

  function deliver(reply) {
    if (reply && reply.startFlow === "quote") { beginQuoteFlow(); return; }
    say(reply);
  }

  function onSubmit(e) {
    e.preventDefault();
    if (state.busy) return; // keep the draft — it would be silently dropped
    if (!els.input.value.trim()) return;
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
    var active = document.activeElement;
    if (!els.panel.contains(active)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); return; }
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
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
      greet();
    } else {
      scrollToBottom();
    }
    // Focus the input for keyboard users, without yanking the page scroll.
    // Skipped when silently restoring an already-open panel on page load.
    if (!silent) {
      window.setTimeout(function () {
        if (!isMobileSheet()) {
          try { els.input.focus({ preventScroll: true }); } catch (e) { els.input.focus(); }
        } else {
          // Don't pop the phone keyboard over the bottom sheet — the header
          // Close button keeps focus inside the panel for Esc / the tab trap.
          try { els.close.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
        }
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

  function greet() {
    state.chips = STARTER_CHIPS;
    addMessage({
      from: "bot",
      blocks: [
        p("Hi! 👋 I'm the Devine Builders assistant. I can help with our services, the areas we cover, or getting a free, no-obligation quote from Phil."),
        p("What can I help you with?")
      ]
    });
  }

  // Header "restart" button: wipe the conversation (and any in-progress
  // guided flow / remembered context) and greet afresh.
  function resetConversation() {
    state.messages = [];
    state.chips = [];
    state.flow = null;
    state.context = { service: "" };
    if (replyTimer) { window.clearTimeout(replyTimer); replyTimer = null; }
    hideTyping();
    state.busy = false;
    saveState();
    renderAll();
    // Announce the reset via the polite log (the next renderAll sweeps it).
    els.log.appendChild(el("div", "db-chat__sr", "Conversation restarted."));
    greet();
    if (!isMobileSheet()) { try { els.input.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

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
    var restartBtn = el("button", "db-chat__close db-chat__restart");
    restartBtn.type = "button";
    restartBtn.setAttribute("aria-label", "Restart conversation");
    restartBtn.title = "Restart conversation";
    var rIcon = svgIcon(ICONS.restart);
    rIcon.setAttribute("class", "db-chat__close-icon");
    restartBtn.appendChild(rIcon);
    restartBtn.addEventListener("click", function () {
      // Skip the prompt when only the greeting exists — nothing to lose.
      if (state.messages.length > 1 && !window.confirm("Restart the conversation? This clears the chat.")) return;
      resetConversation();
    });
    var closeBtn = el("button", "db-chat__close");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close chat");
    var cIcon = svgIcon(ICONS.close);
    cIcon.setAttribute("class", "db-chat__close-icon");
    closeBtn.appendChild(cIcon);
    closeBtn.addEventListener("click", function () { closePanel(); });
    header.appendChild(avatar);
    header.appendChild(hText);
    header.appendChild(restartBtn);
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
      panel: panel, log: log, form: form, input: input, close: closeBtn, chips: null, typing: null
    };

    // Esc closes the panel; Tab is trapped while the mobile sheet is open.
    // Document-level so it still fires when focus has strayed OUTSIDE the
    // aria-modal mobile sheet (trapTab's recovery branch pulls it back in).
    // The 'inside || isMobileSheet()' guard means the non-modal desktop
    // panel never steals Escape from the page, and the nav-open guard skips
    // it while the widget is display:none under the open mobile nav.
    document.addEventListener("keydown", function (e) {
      if (!state.open || root.classList.contains("db-chat--nav-open")) return;
      var inside = root.contains(document.activeElement);
      if (e.key === "Escape" || e.keyCode === 27) {
        if (inside || isMobileSheet()) { e.stopPropagation(); closePanel(); }
        return;
      }
      if ((e.key === "Tab" || e.keyCode === 9) && isMobileSheet()) trapTab(e);
    });

    // Restore any prior conversation for this browser session.
    renderAll();

    // Hide while the mobile nav menu is open (mirrors the call-bar / to-top).
    var nav = document.querySelector(".primary-nav");
    if (nav && "MutationObserver" in window) {
      var mo = new MutationObserver(function () {
        // Explicit add/remove, not toggle(name, force): old browsers at this
        // file's ES5 floor ignore toggle's second argument.
        if (nav.classList.contains("is-open")) root.classList.add("db-chat--nav-open");
        else root.classList.remove("db-chat--nav-open");
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

    // quote.js consumes the prefill key destructively on load, so after
    // browser-back the transcript's "tap continue and the form will be
    // pre-filled" promise would be false. bfcache restores keep JS memory
    // alive — re-stash so a second "Continue" tap still works.
    window.addEventListener("pageshow", function (e) {
      if (e.persisted && lastPrefill) {
        try { window.sessionStorage.setItem(PREFILL_KEY, JSON.stringify(lastPrefill)); } catch (err) { /* ignore */ }
        // One re-stash only: without this, the payload lives for the page's
        // whole lifetime and could silently prefill a later, unrelated
        // quote-form visit with stale chat data.
        lastPrefill = null;
      }
    });

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
