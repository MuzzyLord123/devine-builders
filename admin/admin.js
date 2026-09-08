/* =====================================================================
   Devine Builders — admin.js   (enquiry tracker, /admin/ only)

   Vanilla JS, no libraries, no network calls of any kind. Everything is
   kept in this browser's localStorage; nothing is uploaded or shared.

   NOTE ON STYLE: the public site files (site.js / estimate.js / gallery.js /
   chatbot.js) are deliberately written in an ES5 style because they run in
   whatever browser a visitor turns up with. This file is different: it is
   an owner-only tool used on one modern device, so it uses const/let and
   arrow functions for readability. Keep that split if you edit either.

   ---------------------------------------------------------------------
   CHANGING THE ACCESS KEY

   Only the SHA-256 hash of the key is stored, never the key itself.
   Three sources are checked, in this order:

     1. A per-device key set in this panel's "Change the access key" box.
        Stored in this browser's localStorage; affects THIS device only.
     2. A key deployed from the host. On Vercel, set ADMIN_KEY (plain
        text) or ADMIN_KEY_HASH in the project's Environment Variables;
        build.js hashes it into admin/admin-key.js at deploy time, so the
        key never appears in this public repo. This is the one to use.
     3. BUILT_IN_KEY_HASH below — the fallback baked in when the panel was
        built, used when neither of the above is present.

   To change (3), replace the hash below. Get one by pasting this into
   any browser's dev-tools console (F12 -> Console):

     crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-new-key'))
       .then(b => console.log([...new Uint8Array(b)]
         .map(x => x.toString(16).padStart(2, '0')).join('')));

   Remember: this check runs in the visitor's own browser, so it is a
   privacy curtain for your device — not server-grade security. The
   enquiries themselves never leave this browser's localStorage, so the
   lock is what stops someone picking up your unlocked device; it is not
   protecting data that sits on a server.
   ===================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- */
  /* 1. Constants                                                      */
  /* ---------------------------------------------------------------- */

  // SHA-256 of the key issued when this panel was built — the LAST resort,
  // used only when the host has not deployed one (see the header).
  // NEVER write the key itself into this repo (or the README) — the repo is
  // public, so a plaintext key there is the same as having no key at all.
  // Even the hash is worth keeping out: published, it can be attacked
  // offline at leisure. That is what the ADMIN_KEY route above is for.
  const BUILT_IN_KEY_HASH =
    "483d31429d46e02a2e877f390bbca69c68a22c25462b896ce862c5e0b97e5ed4";

  // Injected by build.js from the host's ADMIN_KEY / ADMIN_KEY_HASH
  // environment variable (admin/admin-key.js). Absent when the site is
  // opened straight off disk, or when the variable was never set — hence
  // the fallback, so a missing build step can never lock Phil out.
  function deployedKeyHash() {
    const injected = String(window.__DB_ADMIN_KEY_HASH || "").toLowerCase();
    return /^[0-9a-f]{64}$/.test(injected) ? injected : "";
  }

  const STORE_KEY = "db-admin-enquiries-v1";  // the enquiries themselves
  const KEYHASH_KEY = "db-admin-keyhash";     // per-device key override
  const UNLOCK_FLAG = "db-admin-unlocked";    // sessionStorage: this tab is unlocked
  const AUTO_LOCK_MS = 30 * 60 * 1000;        // re-lock after 30 min idle

  const STATUSES = { new: "New", quoted: "Quoted", won: "Won", lost: "Lost" };

  // Must match the quote form's <option> values (estimate.html).
  const SERVICES = [
    "Extension", "Renovation", "Kitchen", "Garage Renovation",
    "Brickwork & Masonry", "Groundworks", "Roofing", "Driveway / Patio",
    "Landscaping", "Property Maintenance", "Other / Not sure"
  ];

  const BUSINESS = { name: "Devine Builders", contact: "Phil Devine", phone: "07956 547040" };

  /* ---------------------------------------------------------------- */
  /* 2. Small helpers                                                  */
  /* ---------------------------------------------------------------- */

  const $ = (id) => document.getElementById(id);

  /* Build an element. Text always goes in via textContent — pasted email
     content is untrusted, so nothing here ever touches innerHTML. */
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function newId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Local calendar date, NOT toISOString() — that converts to UTC first, so
     anything logged late in the evening during BST would be filed a day early. */
  function toLocalISO(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  const todayISO = () => toLocalISO(new Date());

  function formatDate(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  const money = (n) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency", currency: "GBP", maximumFractionDigits: 0
    }).format(n || 0);

  function setStatus(node, message, kind) {
    if (!node) return;
    node.textContent = message || "";
    node.className = "admin-status" + (kind ? " is-" + kind : "");
  }

  /* ---------------------------------------------------------------- */
  /* 3. Storage                                                        */
  /* ---------------------------------------------------------------- */

  let enquiries = [];

  /* If there IS stored data but it can't be read, we keep the raw text here
     and refuse to write over it. Silently showing "no enquiries yet" and
     then overwriting on the next save would destroy the owner's only copy
     of their customer list — the worst thing this tool could do. */
  let brokenRaw = null;

  function load() {
    let raw = null;
    try {
      raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.items)) throw new Error("unexpected shape");
      return data.items.filter(valid).map(clean);
    } catch (e) {
      if (raw) brokenRaw = raw;   // data is there, we just can't parse it
      return [];
    }
  }

  /* Blocking banner shown when the stored data is unreadable. The owner
     chooses: rescue the raw text, or knowingly start fresh. */
  function showBrokenBanner() {
    if (!brokenRaw || document.getElementById("broken-banner")) return;
    const box = el("div", "admin-card admin-broken");
    box.id = "broken-banner";
    box.appendChild(el("h2", "admin-h2", "Your saved enquiries couldn't be read"));
    box.appendChild(el("p", "admin-help",
      "There is saved data in this browser, but it isn't in a format this page understands, " +
      "so nothing is being shown. Nothing has been deleted, and saving is paused so it can't be " +
      "overwritten. Download the raw file first (it may still be readable by hand), then choose."));
    const row = el("div", "admin-row admin-row--wrap");
    const grab = el("button", "btn btn--primary", "Download the unreadable file");
    grab.type = "button";
    grab.addEventListener("click", () => {
      download("devine-builders-unreadable-" + stamp() + ".txt", brokenRaw, "text/plain");
    });
    const fresh = el("button", "admin-btn admin-btn--danger", "Start fresh (deletes it)");
    fresh.type = "button";
    fresh.addEventListener("click", () => {
      confirmAction("Start fresh?",
        "The unreadable saved data will be deleted from this device. Download it first if you haven't.",
        () => {
          brokenRaw = null;
          box.remove();
          if (save()) { renderAll(); announce("Started fresh."); }
        });
    });
    row.appendChild(grab);
    row.appendChild(fresh);
    box.appendChild(row);
    const main = $("admin-main");
    main.insertBefore(box, main.firstChild);
  }

  function valid(item) {
    return item && typeof item === "object" && typeof item.id === "string";
  }

  // Coerce every field to the expected type/length so a hand-edited or
  // truncated backup file can't produce odd rendering later.
  function clean(item) {
    const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
    return {
      id: str(item.id, 64),
      received: /^\d{4}-\d{2}-\d{2}$/.test(item.received) ? item.received : todayISO(),
      added: str(item.added, 32) || new Date().toISOString(),
      name: str(item.name, 120),
      email: str(item.email, 160),
      phone: str(item.phone, 40),
      postcode: str(item.postcode, 16),
      service: SERVICES.indexOf(item.service) !== -1 ? item.service : "",
      source: str(item.source, 40) || "Website",
      details: str(item.details, 4000),
      status: STATUSES[item.status] ? item.status : "new",
      value: typeof item.value === "number" && isFinite(item.value) ? item.value : 0,
      followUp: /^\d{4}-\d{2}-\d{2}$/.test(item.followUp) ? item.followUp : "",
      notes: str(item.notes, 2000)
    };
  }

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({ v: 1, items: enquiries }));
      return true;
    } catch (e) {
      // Most likely the storage quota, or storage blocked in private mode.
      setStatus($("data-status"),
        "Could not save. This browser is blocking storage or is full. Back up your data, then free some space.", "bad");
      return false;
    }
  }

  /* Every change goes through here so that a FAILED write can never leave
     what's on screen out of step with what's actually stored. Without the
     rollback, a quota error would show the owner an enquiry that looked
     saved and would vanish on the next visit. */
  function commit(mutate) {
    if (brokenRaw !== null) {
      setStatus($("data-status"),
        "Saving is paused: there is unreadable saved data in this browser. Deal with the message at the top of the page first.", "bad");
      return false;
    }
    const backup = JSON.stringify(enquiries);
    mutate();
    if (save()) return true;
    try { enquiries = JSON.parse(backup).map(clean); } catch (e) { /* keep memory as-is */ }
    renderAll();   // put the screen back to the last stored state
    return false;
  }

  /* ---------------------------------------------------------------- */
  /* 4. Access key                                                     */
  /* ---------------------------------------------------------------- */

  async function sha256(text) {
    const buf = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function currentKeyHash() {
    try {
      const override = window.localStorage.getItem(KEYHASH_KEY);
      if (override && /^[0-9a-f]{64}$/.test(override)) return override;
    } catch (e) { /* storage blocked — fall through to the deployed key */ }
    return deployedKeyHash() || BUILT_IN_KEY_HASH;
  }

  let failedAttempts = 0;
  let lockTimer = null;

  function showApp(silent) {
    $("admin-lock").hidden = true;
    $("admin-app").hidden = false;
    // Timestamped, so the unlock can't outlive the idle window — including
    // in a duplicated tab, which inherits a copy of sessionStorage.
    try { window.sessionStorage.setItem(UNLOCK_FLAG, String(Date.now())); } catch (e) { /* ignore */ }
    if (brokenRaw !== null) showBrokenBanner();
    renderAll();
    resetIdleTimer();
    // Move focus into the panel so keyboard and screen-reader users land in
    // the newly revealed content rather than back at the top of the document.
    if (!silent) {
      const heading = $("admin-main").querySelector(".admin-h2");
      if (heading) {
        heading.tabIndex = -1;
        try { heading.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
      }
    }
  }

  function lock(auto) {
    $("admin-app").hidden = true;
    $("admin-lock").hidden = false;
    $("admin-key").value = "";
    /* Locking must actually take the customer details off the page: hiding
       the panel still leaves every name, number and address in the DOM (and
       in the paste box) for anyone who opens dev tools or hits Find. */
    $("admin-list").textContent = "";
    $("paste-box").value = "";
    fillForm({});          // every add/edit field, not just the details box
    hideForm();
    setStatus($("parse-status"), "");
    setStatus($("list-status"), "");
    setStatus($("data-status"), "");
    setStatus($("unlock-error"), "");
    $("unlock-error").className = "admin-lock__error";
    try { window.sessionStorage.removeItem(UNLOCK_FLAG); } catch (e) { /* ignore */ }
    if (lockTimer) { window.clearTimeout(lockTimer); lockTimer = null; }
    // Say WHY the screen changed — an auto-lock that just appears is
    // baffling, especially to a screen-reader user who saw no reason for it.
    if (auto) $("unlock-error").textContent = "Locked automatically after 30 minutes without activity. Enter your key to carry on.";
    $("admin-key").focus();
  }

  function resetIdleTimer() {
    if (lockTimer) window.clearTimeout(lockTimer);
    lockTimer = window.setTimeout(() => lock(true), AUTO_LOCK_MS);
  }

  async function tryUnlock(e) {
    e.preventDefault();
    const err = $("unlock-error");
    const entered = $("admin-key").value;
    if (!entered) return;

    if (!window.crypto || !window.crypto.subtle) {
      err.textContent = "This browser can't check the key here. Open the page over https (or localhost).";
      return;
    }

    // Slow down repeated guesses. Not a real defence (the check is
    // client-side) — it just makes idle poking tedious.
    if (failedAttempts >= 3) {
      const wait = Math.min(failedAttempts - 2, 5) * 1000;
      $("unlock-btn").disabled = true;
      await new Promise((r) => window.setTimeout(r, wait));
      $("unlock-btn").disabled = false;
    }

    const hash = await sha256(entered);
    if (hash === currentKeyHash()) {
      failedAttempts = 0;
      err.textContent = "";
      showApp();
    } else {
      failedAttempts += 1;
      err.textContent = "That key wasn't right. Try again.";
      $("admin-key").select();
    }
  }

  /* ---------------------------------------------------------------- */
  /* 5. The email parser                                               */
  /*                                                                   */
  /* Handles both shapes the site produces:                            */
  /*   a) FormSubmit's table email  ("Name" / value on separate lines,  */
  /*      or tab-separated),                                           */
  /*   b) the mailto fallback body  ("Name:        Jane Smith").        */
  /* Anything it can't label is left for the owner to fill in — it      */
  /* never guesses a name.                                             */
  /* ---------------------------------------------------------------- */

  const FIELD_ALIASES = {
    name: ["name", "full name", "your name", "customer"],
    email: ["email", "e-mail", "email address", "your email"],
    phone: ["phone", "telephone", "phone number", "mobile", "tel", "contact number"],
    postcode: ["postcode", "post code", "post-code"],
    service: ["project", "project-type", "project type", "service", "job type", "type of work"],
    details: ["details", "message", "description", "your message", "project details", "what you need"]
  };

  // Lines that are boilerplate, not data.
  const NOISE = [
    /^-{3,}$/, /^={3,}$/, /^_{3,}$/,
    /^new quote request/i,
    /^sent from the devine builders/i,
    /^you.?ve got a new submission/i,
    /^powered by/i, /^formsubmit/i,
    /^devine builders$/i
  ];

  const isNoise = (line) => NOISE.some((re) => re.test(line.trim()));
  const isBlank = (v) => !v || /^\(?(not given|none|n\/a|-)\)?$/i.test(v.trim());

  function labelOf(line) {
    // "Name:", "Name", "Name\t..." -> "name"  (only for short lines, so a
    // sentence of details is never mistaken for a label)
    const head = line.split(/[:\t]/)[0].trim().toLowerCase();
    if (!head || head.length > 24) return null;
    for (const field in FIELD_ALIASES) {
      if (FIELD_ALIASES[field].indexOf(head) !== -1) return field;
    }
    return null;
  }

  function parseEnquiry(raw) {
    const text = String(raw || "").replace(/\r\n?/g, "\n").replace(/​/g, "");
    const lines = text.split("\n");
    const found = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isNoise(line)) continue;
      const field = labelOf(line);
      if (!field || found[field]) continue;

      // Value on the same line, after ":" or a tab?
      const sameLine = line.slice(line.split(/[:\t]/)[0].length).replace(/^[:\t]\s*/, "").trim();

      if (field === "details") {
        // Details run to the end of the block: collect following lines
        // until boilerplate, or a line that is clearly another label.
        const parts = sameLine ? [sameLine] : [];
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j];
          if (isNoise(next)) break;
          // Stop at a genuine field label — but NOT at one already captured
          // above, so a customer writing "Phone: best after 6pm" inside their
          // message doesn't truncate the rest of what they wrote.
          const nextLabel = labelOf(next);
          if (nextLabel && !found[nextLabel] && next.trim().length <= 40) break;
          parts.push(next);
        }
        const joined = parts.join("\n").trim();
        if (joined) found.details = joined;
        continue;
      }

      if (sameLine) {
        found[field] = sameLine;
      } else {
        // Stacked/table layout: the value is the next non-empty line,
        // provided that line isn't itself a label.
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j].trim();
          if (!next) continue;
          if (isNoise(next) || labelOf(lines[j])) break;
          found[field] = next;
          break;
        }
      }
    }

    // Last-resort scans, so even a messy paste captures the contact bits.
    if (!found.email) {
      const m = text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (m) found.email = m[0];
    }
    if (!found.phone) {
      const m = text.match(/(?:\+44\s?|\b0)\d[\d\s-]{8,13}\b/);
      if (m) found.phone = m[0].trim();
    }
    if (!found.postcode) {
      const m = text.match(/\b[A-Z]{1,2}\d[\dA-Z]?\s?\d[A-Z]{2}\b/i);
      if (m) found.postcode = m[0].toUpperCase();
    }

    // A "Date:" header, when the whole email was copied.
    /* A "Date:" header from a copied email. Only the written-month form
       ("6 Jul 2026") is accepted: a numeric 06/07/2026 is read as June 7th
       by Date.parse, which would silently misfile every UK enquiry. */
    let received = todayISO();
    const dm = text.match(/^\s*(?:date|sent|received)\s*:\s*(.+)$/im);
    if (dm && /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(dm[1])) {
      const d = new Date(dm[1].trim());
      const now = Date.now();
      // Only trust it if it's a real date, not in the future, not ancient.
      if (!isNaN(d.getTime()) && d.getTime() <= now + 864e5 && d.getTime() > now - 5 * 365 * 864e5) {
        received = toLocalISO(d);
      }
    }

    const out = {
      name: isBlank(found.name) ? "" : found.name.trim(),
      email: isBlank(found.email) ? "" : found.email.trim(),
      phone: isBlank(found.phone) ? "" : found.phone.trim(),
      postcode: isBlank(found.postcode) ? "" : found.postcode.trim().toUpperCase(),
      service: matchService(found.service),
      details: isBlank(found.details) ? "" : found.details.trim(),
      received: received
    };
    out.hits = ["name", "email", "phone", "postcode", "service", "details"]
      .filter((k) => out[k]).length;
    return out;
  }

  function matchService(value) {
    if (!value || isBlank(value)) return "";
    const v = value.trim().toLowerCase();
    for (const s of SERVICES) {
      if (s.toLowerCase() === v) return s;
    }
    // Loose match: "driveway", "patio", "extensions", "brickwork"…
    for (const s of SERVICES) {
      const first = s.toLowerCase().split(/[^a-z]+/)[0];
      if (first && (v.indexOf(first) !== -1 || first.indexOf(v) === 0)) return s;
    }
    return "";
  }

  /* ---------------------------------------------------------------- */
  /* 6. Rendering                                                      */
  /* ---------------------------------------------------------------- */

  function isOverdue(item) {
    return !!item.followUp &&
      item.followUp <= todayISO() &&
      item.status !== "won" && item.status !== "lost";
  }

  function renderStats() {
    const list = $("admin-stats");
    list.textContent = "";
    const month = todayISO().slice(0, 7);
    const count = (fn) => enquiries.filter(fn).length;

    const won = enquiries.filter((e) => e.status === "won");
    const decided = count((e) => e.status === "won" || e.status === "lost");
    const winRate = decided ? Math.round((won.length / decided) * 100) + "%" : "n/a";
    const wonValue = won.reduce((sum, e) => sum + (e.value || 0), 0);
    const dueCount = count(isOverdue);

    const tiles = [
      ["Enquiries", String(enquiries.length)],
      ["Awaiting reply", String(count((e) => e.status === "new"))],
      ["Quoted", String(count((e) => e.status === "quoted"))],
      ["Follow-ups due", String(dueCount), dueCount > 0],
      ["This month", String(count((e) => e.received.slice(0, 7) === month))],
      ["Jobs won", String(won.length)],
      ["Won value", money(wonValue)],
      ["Win rate", winRate]
    ];

    tiles.forEach(([label, num, alert]) => {
      const li = el("li", "admin-stat" + (alert ? " admin-stat--alert" : ""));
      li.appendChild(el("span", "admin-stat__num", num));
      li.appendChild(el("span", "admin-stat__label", label));
      list.appendChild(li);
    });
  }

  function visibleEnquiries() {
    const q = $("search").value.trim().toLowerCase();
    const status = $("filter-status").value;
    const sort = $("sort-by").value;

    let out = enquiries.filter((item) => {
      if (status && item.status !== status) return false;
      if (!q) return true;
      return [item.name, item.email, item.phone, item.postcode, item.service, item.details, item.notes]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    });

    out = out.slice();
    if (sort === "oldest") out.sort((a, b) => a.received.localeCompare(b.received));
    else if (sort === "name") out.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (sort === "followup") {
      out.sort((a, b) => (a.followUp || "9999").localeCompare(b.followUp || "9999"));
    } else out.sort((a, b) => b.received.localeCompare(a.received));
    return out;
  }

  /* Enquiry text is untrusted: it ultimately comes from the public quote
     form. Only link an address/number that really looks like one, so a
     crafted value such as "victim@x.com?bcc=attacker@evil.tld" can never
     become a live mailto link with hidden headers — it shows as plain text
     for the owner to see instead. */
  const EMAIL_RE = /^[^\s@"'<>,;:&?]+@[^\s@"'<>,;:&?]+\.[^\s@"'<>,;:&?]+$/;
  const isEmail = (v) => EMAIL_RE.test(String(v || "").trim());

  function telHref(phone) {
    const digits = String(phone || "").replace(/[^\d+]/g, "");
    return /^\+?\d{6,15}$/.test(digits) ? "tel:" + digits : null;
  }

  function replyMailto(item) {
    const subject = "Your enquiry: " + BUSINESS.name;
    const body = [
      "Hi " + (item.name ? item.name.split(" ")[0] : "there") + ",",
      "",
      "Thanks for getting in touch about " +
        (item.service ? item.service.toLowerCase() : "your project") +
        ". ",
      "",
      "",
      "Best regards,",
      BUSINESS.contact,
      BUSINESS.name,
      BUSINESS.phone
    ].join("\r\n");
    // The address is validated by isEmail() before this link is offered, so
    // it needs no escaping (and encoding the "@" breaks some mail clients).
    return "mailto:" + item.email +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  }

  function renderItem(item) {
    const li = el("li", "admin-item");
    li.setAttribute("data-id", item.id);

    /* --- headline: name + status --- */
    const head = el("div", "admin-item__head");
    head.appendChild(el("h3", "admin-item__name", item.name || "(no name given)"));
    head.appendChild(el("span", "admin-pill admin-pill--" + item.status, STATUSES[item.status]));
    if (isOverdue(item)) head.appendChild(el("span", "admin-pill admin-pill--due", "Follow up"));
    li.appendChild(head);

    /* --- meta --- */
    const bits = [];
    if (item.service) bits.push(item.service);
    if (item.postcode) bits.push(item.postcode);
    bits.push(formatDate(item.received));
    if (item.source && item.source !== "Website") bits.push("via " + item.source);
    if (item.value) bits.push("quoted " + money(item.value));
    if (item.followUp) bits.push("follow up " + formatDate(item.followUp));
    li.appendChild(el("p", "admin-item__meta", bits.join(" · ")));

    /* --- contact --- */
    if (item.phone || item.email) {
      const contact = el("p", "admin-item__meta admin-item__contact");
      if (item.phone) {
        const href = telHref(item.phone);
        if (href) {
          const a = el("a", null, item.phone);
          a.href = href;
          contact.appendChild(a);
        } else {
          contact.appendChild(el("span", null, item.phone));
        }
      }
      if (item.phone && item.email) contact.appendChild(document.createTextNode(" · "));
      if (item.email) {
        if (isEmail(item.email)) {
          const a = el("a", null, item.email);
          a.href = "mailto:" + item.email;
          contact.appendChild(a);
        } else {
          contact.appendChild(el("span", null, item.email));
        }
      }
      li.appendChild(contact);
    }

    if (item.details) li.appendChild(el("p", "admin-item__details", item.details));
    if (item.notes) li.appendChild(el("p", "admin-item__notes", "Notes: " + item.notes));

    /* --- actions --- */
    /* Every row has the same button labels, so each one carries the
       enquiry's name in its accessible name — otherwise a screen-reader
       user hears "Update, Update, Update…" with no way to tell them apart. */
    const who = item.name || "this enquiry";
    const actions = el("div", "admin-item__actions");
    if (isEmail(item.email)) {
      const reply = el("a", "admin-btn", "Reply by email");
      reply.href = replyMailto(item);
      reply.setAttribute("aria-label", "Reply by email to " + who);
      actions.appendChild(reply);
    }
    const callHref = telHref(item.phone);
    if (callHref) {
      const call = el("a", "admin-btn", "Call");
      call.href = callHref;
      call.setAttribute("aria-label", "Call " + who);
      actions.appendChild(call);
    }
    const editBtn = el("button", "admin-btn", "Update");
    editBtn.type = "button";
    editBtn.id = "update-" + item.id;
    editBtn.setAttribute("aria-expanded", "false");
    editBtn.setAttribute("aria-label", "Update " + who);
    actions.appendChild(editBtn);
    li.appendChild(actions);

    /* --- inline update panel --- */
    const edit = el("div", "admin-item__edit");
    edit.hidden = true;

    const grid = el("div", "admin-grid");
    const statusField = field("Status", selectOf(STATUSES, item.status), "status-" + item.id);
    const valueField = field("Quoted value (£)", numberInput(item.value), "value-" + item.id);
    const followField = field("Follow up on", dateInput(item.followUp), "follow-" + item.id);
    const sourceField = field("Came in via", sourceSelect(item.source), "source-" + item.id);
    [statusField, valueField, followField, sourceField].forEach((f) => grid.appendChild(f.wrap));
    edit.appendChild(grid);

    const notesArea = el("textarea", "admin-textarea");
    notesArea.rows = 3;
    notesArea.spellcheck = false;   // notes name a real customer — see index.html
    notesArea.value = item.notes;
    notesArea.id = "notes-" + item.id;
    const notesWrap = el("div", "admin-field");
    const notesLabel = el("label", "admin-label", "Notes");
    notesLabel.htmlFor = notesArea.id;
    notesWrap.appendChild(notesLabel);
    notesWrap.appendChild(notesArea);
    edit.appendChild(notesWrap);

    const editRow = el("div", "admin-row admin-row--wrap");
    const saveBtn = el("button", "btn btn--primary", "Save changes");
    saveBtn.type = "button";
    const delBtn = el("button", "admin-btn admin-btn--danger", "Delete");
    delBtn.type = "button";
    editRow.appendChild(saveBtn);
    editRow.appendChild(delBtn);
    edit.appendChild(editRow);
    li.appendChild(edit);

    editBtn.addEventListener("click", () => {
      const open = !edit.hidden;
      edit.hidden = open;
      editBtn.setAttribute("aria-expanded", String(!open));
      editBtn.textContent = open ? "Update" : "Close";
      editBtn.setAttribute("aria-label", (open ? "Update " : "Close update panel for ") + who);
      if (!open) statusField.control.focus();
    });

    saveBtn.addEventListener("click", () => {
      /* A half-typed number or date leaves the control "bad input", which
         reads back as "" — saving that would quietly wipe the value or
         follow-up date already stored. Refuse instead of destroying it. */
      const bad = [valueField.control, followField.control]
        .some((c) => c.validity && c.validity.badInput);
      if (bad) {
        setStatus($("list-status"), "Check the quoted value and follow-up date: one of them isn't a valid entry.", "bad");
        return;
      }
      const ok = commit(() => {
        item.status = statusField.control.value;
        item.value = Math.max(0, Math.round(Number(valueField.control.value) || 0));
        item.followUp = followField.control.value || "";
        item.source = sourceField.control.value;
        item.notes = notesArea.value.slice(0, 2000);
      });
      // Re-rendering destroys the button that was clicked, so send focus
      // back to the same row's control rather than letting it fall to <body>.
      if (ok) { focusAfterRender = "update-" + item.id; refreshItem(item); listAnnounce("Enquiry updated."); }
    });

    delBtn.addEventListener("click", () => {
      confirmAction(
        "Delete this enquiry?",
        (item.name ? item.name + "'s" : "This") + " enquiry will be removed from this device. This can't be undone.",
        () => {
          const ok = commit(() => {
            enquiries = enquiries.filter((e) => e.id !== item.id);
          });
          // The row (and its buttons) are gone — park focus somewhere stable.
          if (ok) { focusAfterRender = "search"; renderAll(); listAnnounce("Enquiry deleted."); }
        }
      );
    });

    return li;
  }

  /* Little builders for the inline update panel. */
  function field(labelText, control, id) {
    const wrap = el("div", "admin-field");
    const label = el("label", "admin-label", labelText);
    control.id = id;
    label.htmlFor = id;
    wrap.appendChild(label);
    wrap.appendChild(control);
    return { wrap: wrap, control: control };
  }
  function selectOf(map, current) {
    const sel = el("select", "admin-input");
    for (const value in map) {
      const opt = el("option", null, map[value]);
      opt.value = value;
      if (value === current) opt.selected = true;
      sel.appendChild(opt);
    }
    return sel;
  }
  function sourceSelect(current) {
    const sel = el("select", "admin-input");
    ["Website", "Phone", "Facebook", "Word of mouth", "Other"].forEach((s) => {
      const opt = el("option", null, s);
      opt.value = s;
      if (s === current) opt.selected = true;
      sel.appendChild(opt);
    });
    return sel;
  }
  function numberInput(value) {
    const input = el("input", "admin-input");
    input.type = "number";
    input.min = "0";
    input.step = "50";
    input.inputMode = "numeric";
    if (value) input.value = String(value);
    return input;
  }
  function dateInput(value) {
    const input = el("input", "admin-input");
    input.type = "date";
    if (value) input.value = value;
    return input;
  }

  function renderList() {
    const list = $("admin-list");
    list.textContent = "";
    const items = visibleEnquiries();
    items.forEach((item) => list.appendChild(renderItem(item)));

    $("admin-empty").hidden = enquiries.length !== 0;
    // Filters that match nothing must say so — otherwise the list just goes
    // blank and looks like the data has been lost.
    $("admin-nomatch").hidden = !(enquiries.length && !items.length);

    const count = $("list-count");
    if (!enquiries.length) count.textContent = "";
    else if (items.length === enquiries.length) {
      count.textContent = enquiries.length === 1 ? "1 enquiry" : enquiries.length + " enquiries";
    } else {
      count.textContent = "Showing " + items.length + " of " + enquiries.length + " enquiries";
    }
  }

  /* Element id to focus once the list has been rebuilt (set by actions that
     destroy the control the owner was using). */
  let focusAfterRender = null;

  function applyFocus() {
    if (!focusAfterRender) return;
    const target = $(focusAfterRender);
    focusAfterRender = null;
    if (target) { try { target.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  }

  function renderAll() { renderStats(); renderList(); applyFocus(); }

  /* Redraw ONE row instead of the whole list, so that saving one enquiry
     doesn't wipe out text the owner has typed into another open panel.
     Falls back to a full redraw if the change means the row should no
     longer be listed (e.g. its new status is filtered out). */
  function refreshItem(item) {
    const list = $("admin-list");
    const row = list.querySelector('[data-id="' + (window.CSS && CSS.escape ? CSS.escape(item.id) : item.id) + '"]');
    const stillListed = visibleEnquiries().some((e) => e.id === item.id);
    if (row && stillListed) {
      row.replaceWith(renderItem(item));
      renderStats();
      applyFocus();
    } else {
      renderAll();
    }
  }

  /* Two feedback spots, each next to the controls it describes: backup and
     key messages in the data card, list actions beside the list itself. */
  function announce(message) { setStatus($("data-status"), message, "good"); }
  function listAnnounce(message) { setStatus($("list-status"), message, "good"); }

  /* ---------------------------------------------------------------- */
  /* 7. Add / edit form                                                */
  /* ---------------------------------------------------------------- */

  let editingId = null;   // null = adding a new enquiry

  function fillForm(data) {
    $("f-name").value = data.name || "";
    $("f-email").value = data.email || "";
    $("f-phone").value = data.phone || "";
    $("f-postcode").value = data.postcode || "";
    $("f-service").value = data.service || "";
    $("f-source").value = data.source || "Website";
    $("f-received").value = data.received || todayISO();
    $("f-status").value = data.status || "new";
    $("f-details").value = data.details || "";
  }

  function showForm(lead) {
    $("form-lead").textContent = lead;
    $("enquiry-form").hidden = false;
    $("f-name").focus();
  }

  function hideForm() {
    $("enquiry-form").hidden = true;
    editingId = null;
    setStatus($("save-status"), "");
  }

  function onParse() {
    const raw = $("paste-box").value;
    if (!raw.trim()) {
      setStatus($("parse-status"), "Paste an enquiry email into the box first.", "bad");
      return;
    }
    const parsed = parseEnquiry(raw);
    if (!parsed.hits) {
      setStatus($("parse-status"),
        "Couldn't find any details in that. Try copying the whole email, or use “Type it in”.", "bad");
      return;
    }
    fillForm(Object.assign({ source: "Website", status: "new" }, parsed));
    setStatus($("parse-status"),
      "Found " + parsed.hits + " detail" + (parsed.hits === 1 ? "" : "s") + ". Check them below before saving.", "good");
    showForm("Check the details, then save.");
  }

  function onSave(e) {
    e.preventDefault();
    const record = {
      id: editingId || newId(),
      received: $("f-received").value || todayISO(),
      added: new Date().toISOString(),
      name: $("f-name").value.trim(),
      email: $("f-email").value.trim(),
      phone: $("f-phone").value.trim(),
      postcode: $("f-postcode").value.trim().toUpperCase(),
      service: $("f-service").value,
      source: $("f-source").value,
      details: $("f-details").value.trim(),
      status: $("f-status").value,
      value: 0,
      followUp: "",
      notes: ""
    };

    if (!record.name && !record.email && !record.phone) {
      setStatus($("save-status"), "Add at least a name, an email or a phone number.", "bad");
      return;
    }

    // Gentle duplicate warning — the same enquiry pasted twice.
    const dupe = enquiries.find((x) =>
      x.id !== record.id &&
      ((record.email && x.email.toLowerCase() === record.email.toLowerCase()) ||
       (record.phone && x.phone === record.phone)) &&
      x.received === record.received);
    if (dupe && !window.confirm(
      "There's already an enquiry from this person on that date. Save this one as well?")) {
      return;
    }

    if (!commit(() => { enquiries.push(clean(record)); })) return;
    $("paste-box").value = "";
    setStatus($("parse-status"), "");
    hideForm();
    renderAll();
    const trimmed = $("f-details").value.trim().length > 4000;
    listAnnounce("Enquiry saved." + (trimmed
      ? " Note: the details were longer than 4,000 characters and have been shortened."
      : ""));
    const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    $("admin-list").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }

  /* ---------------------------------------------------------------- */
  /* 8. Backup / restore                                               */
  /* ---------------------------------------------------------------- */

  function download(filename, text, type) {
    const blob = new Blob([text], { type: type });
    const url = URL.createObjectURL(blob);
    const a = el("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const stamp = () => todayISO().replace(/-/g, "");

  function exportJson() {
    if (!enquiries.length) { setStatus($("data-status"), "Nothing to back up yet.", "bad"); return; }
    download("devine-builders-enquiries-" + stamp() + ".json",
      JSON.stringify({ v: 1, exported: new Date().toISOString(), items: enquiries }, null, 2),
      "application/json");
    announce("Backup downloaded. Keep it somewhere safe.");
  }

  function csvCell(value) {
    let s = value == null ? "" : String(value);
    // Neutralise spreadsheet formula injection. Enquiry text arrives from the
    // PUBLIC quote form, so a visitor could submit details beginning with
    // "=", "+", "-" or "@" — which Excel/Sheets would run as a formula when
    // the export is opened. A leading apostrophe forces it to stay text.
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv() {
    if (!enquiries.length) { setStatus($("data-status"), "Nothing to export yet.", "bad"); return; }
    const head = ["Received", "Name", "Email", "Phone", "Postcode", "Service",
                  "Source", "Status", "Quoted value", "Follow up", "Details", "Notes"];
    const rows = enquiries.map((e) => [
      e.received, e.name, e.email, e.phone, e.postcode, e.service,
      e.source, STATUSES[e.status], e.value || "", e.followUp, e.details, e.notes
    ].map(csvCell).join(","));
    // The BOM makes Excel read the accents/£ signs correctly.
    download("devine-builders-enquiries-" + stamp() + ".csv",
      "﻿" + [head.join(","), ...rows].join("\r\n"), "text/csv");
    announce("CSV downloaded.");
  }

  function importJson(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(String(reader.result)); }
      catch (err) {
        setStatus($("data-status"), "That file isn't a backup this panel can read.", "bad");
        return;
      }
      const rawItems = data && Array.isArray(data.items) ? data.items : [];
      const incoming = rawItems.filter(valid).map(clean);
      const unreadable = rawItems.length - incoming.length;
      if (!incoming.length) {
        setStatus($("data-status"), "No enquiries found in that file.", "bad");
        return;
      }
      const seen = {};
      enquiries.forEach((e) => { seen[e.id] = true; });
      let added = 0;
      const ok = commit(() => {
        incoming.forEach((item) => {
          if (!seen[item.id]) { enquiries.push(item); seen[item.id] = true; added += 1; }
        });
      });
      if (!ok) return;
      renderAll();
      // Say exactly what happened — silently dropping records from a backup
      // is how someone discovers a gap months later.
      const skipped = incoming.length - added;
      const notes = [];
      if (skipped) notes.push(skipped + " already here");
      if (unreadable) notes.push(unreadable + " unreadable and not restored");
      announce((added
        ? "Restored " + added + " enquir" + (added === 1 ? "y" : "ies")
        : "Nothing new to restore") + (notes.length ? ": " + notes.join(", ") + "." : "."));
    };
    reader.onerror = () => setStatus($("data-status"), "Couldn't read that file.", "bad");
    reader.readAsText(file);
  }

  /* ---------------------------------------------------------------- */
  /* 9. Confirm dialog                                                 */
  /* ---------------------------------------------------------------- */

  let pendingConfirm = null;

  function confirmAction(title, text, onConfirm) {
    const dialog = $("confirm-dialog");
    if (!dialog || typeof dialog.showModal !== "function") {
      if (window.confirm(title + "\n\n" + text)) onConfirm();
      return;
    }
    $("confirm-title").textContent = title;
    $("confirm-text").textContent = text;
    pendingConfirm = onConfirm;
    // returnValue PERSISTS between openings. Without clearing it, dismissing
    // this dialog with Escape after a previous confirmed delete would replay
    // "confirm" and delete again — Escape must always mean cancel.
    dialog.returnValue = "";
    dialog.showModal();
  }

  /* ---------------------------------------------------------------- */
  /* 10. Wiring                                                        */
  /* ---------------------------------------------------------------- */

  function switchTab(toManual) {
    // Re-clicking the tab you're already on must not throw away a
    // half-filled enquiry.
    const alreadyThere = toManual === !$("panel-manual").hidden;
    if (alreadyThere) return;
    $("tab-paste").classList.toggle("is-active", !toManual);
    $("tab-manual").classList.toggle("is-active", toManual);
    $("tab-paste").setAttribute("aria-selected", String(!toManual));
    $("tab-manual").setAttribute("aria-selected", String(toManual));
    // Roving tabindex: only the selected tab stays in the tab order.
    $("tab-paste").tabIndex = toManual ? -1 : 0;
    $("tab-manual").tabIndex = toManual ? 0 : -1;
    $("panel-paste").hidden = toManual;
    $("panel-manual").hidden = !toManual;
    if (toManual) {
      fillForm({ received: todayISO(), source: "Phone", status: "new" });
      showForm("New enquiry");
    } else {
      hideForm();
    }
  }

  /* ---------------------------------------------------------------- */
  /* 10. Gallery images                                                */
  /* ---------------------------------------------------------------- */
  /*
     Lets the owner run the Work Carried Out gallery without touching code.

     WHY THERE IS A "PUBLISH" STEP AT ALL
     This site is static: there is no server to receive an upload, so a new
     photo only reaches visitors once the FILE reaches the host. Everything
     here is therefore a local draft — the manifest in localStorage, the
     images in IndexedDB — and Publish hands over the exact files to drop
     into the site's file store. Nothing pretends to be live that isn't:
     the list marks every unpublished change, so the owner can always see
     what visitors are still being served.

     Photos are re-encoded on import (long edge capped, JPEG quality 0.82).
     A phone photo is often 4-8MB, which would make the gallery crawl on
     mobile data; this keeps each one to roughly 150-350KB.
  */

  const GALLERY_STORE = "db-admin-gallery-v1";   // draft manifest (localStorage)
  const IDB_NAME = "db-admin-images";            // draft image blobs
  const IDB_STORE = "files";
  const MAX_EDGE = 1600;                         // px, long edge
  const JPEG_QUALITY = 0.82;

  let gallery = null;      // { items:[...] } currently being edited
  let published = null;    // what gallery.json holds right now, for comparison
  const objectUrls = [];   // revoked on re-render so previews don't leak

  /* ---- IndexedDB (blobs are far too big for localStorage) ---------- */

  function idb() {
    return new Promise((resolve, reject) => {
      let req;
      try { req = window.indexedDB.open(IDB_NAME, 1); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbDo(mode, fn) {
    return idb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, mode);
      const store = tx.objectStore(IDB_STORE);
      const out = fn(store);
      tx.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  const idbPut = (key, blob) => idbDo("readwrite", (s) => s.put(blob, key));
  const idbGet = (key) => idbDo("readonly", (s) => s.get(key));
  const idbDel = (key) => idbDo("readwrite", (s) => s.delete(key));
  const idbKeys = () => idbDo("readonly", (s) => s.getAllKeys());
  const idbClear = () => idbDo("readwrite", (s) => s.clear());

  /* ---- image processing ------------------------------------------- */

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("not an image")); };
      img.src = url;
    });
  }

  /* Cap the long edge and re-encode as JPEG. Returns a Blob. */
  function shrink(file) {
    return readImage(file).then((img) => new Promise((resolve, reject) => {
      const w = img.naturalWidth, h = img.naturalHeight;
      if (!w || !h) { reject(new Error("empty image")); return; }
      const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
      const cw = Math.round(w * scale), ch = Math.round(h * scale);
      const canvas = document.createElement("canvas");
      canvas.width = cw; canvas.height = ch;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, cw, ch);
      URL.revokeObjectURL(img.src);
      canvas.toBlob((blob) => {
        if (blob) resolve({ blob: blob, width: cw, height: ch });
        else reject(new Error("could not encode"));
      }, "image/jpeg", JPEG_QUALITY);
    }));
  }

  /* ---- manifest ---------------------------------------------------- */

  function textBox(value) {
    const input = el("input", "admin-input");
    input.type = "text";
    input.value = value || "";
    return input;
  }

  function slug(text) {
    return String(text || "photo").toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "photo";
  }

  function uniqueName(base) {
    const taken = {};
    (gallery.items || []).forEach((i) => { taken[i.src] = true; });
    let n = 0, name;
    do {
      n += 1;
      name = "images/gallery/" + base + (n > 1 ? "-" + n : "") + ".jpg";
    } while (taken[name]);
    return name;
  }

  function loadDraft() {
    try {
      const raw = window.localStorage.getItem(GALLERY_STORE);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) return parsed;
    } catch (e) { /* corrupt draft: fall back to the published file */ }
    return null;
  }

  function saveDraft() {
    try {
      window.localStorage.setItem(GALLERY_STORE, JSON.stringify(gallery));
    } catch (e) {
      setStatus($("img-status"), "Could not save your changes: this browser is blocking storage or is full.", "bad");
    }
  }

  /* An entry differs from the live site if it is new, moved, re-worded, or
     its image has been replaced (a replaced one has a blob in IndexedDB). */
  function publishedIndex(src) {
    if (!published) return -1;
    for (let i = 0; i < published.items.length; i++) {
      if (published.items[i].src === src) return i;
    }
    return -1;
  }

  function entryChanged(item, i) {
    if (item.pending) return true;                 // image replaced or added
    const j = publishedIndex(item.src);
    if (j === -1 || j !== i) return true;          // new, or moved
    const p = published.items[j];
    return p.caption !== item.caption || p.alt !== item.alt ||
           p.full !== item.full || !!p.illustrative !== !!item.illustrative;
  }

  function manifestChanged() {
    if (!published) return true;
    if (published.items.length !== gallery.items.length) return true;
    return gallery.items.some(entryChanged);
  }

  /* ---- rendering --------------------------------------------------- */

  function releasePreviews() {
    while (objectUrls.length) URL.revokeObjectURL(objectUrls.pop());
  }

  function thumbFor(item, img) {
    // A replaced/added photo is only in IndexedDB until it is published.
    if (!item.pending) { img.src = "/" + item.src; return; }
    idbGet(item.src).then((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      objectUrls.push(url);
      img.src = url;
    }).catch(() => { /* leave the broken-image box; the row still works */ });
  }

  function renderGallery() {
    const list = $("img-list");
    const empty = $("img-empty");
    if (!list) return;
    releasePreviews();
    list.textContent = "";

    const items = gallery.items;
    if (empty) empty.hidden = items.length > 0;

    items.forEach((item, i) => {
      const li = el("li", "img-row" + (entryChanged(item, i) ? " img-row--changed" : ""));

      const fig = el("div", "img-row__thumb");
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      thumbFor(item, img);
      fig.appendChild(img);
      if (entryChanged(item, i)) {
        fig.appendChild(el("span", "img-row__badge", "Not published yet"));
      }
      li.appendChild(fig);

      const body = el("div", "img-row__body");

      const capField = field("Caption (shown under the photo)", textBox(item.caption), "cap-" + i);
      const altField = field("Description for screen readers", textBox(item.alt), "alt-" + i);
      capField.control.addEventListener("input", (e) => {
        item.caption = e.target.value; saveDraft(); markDirty();
      });
      altField.control.addEventListener("input", (e) => {
        item.alt = e.target.value; saveDraft(); markDirty();
      });
      body.appendChild(capField.wrap);
      body.appendChild(altField.wrap);

      const tagWrap = el("label", "img-row__check");
      const tag = document.createElement("input");
      tag.type = "checkbox";
      tag.checked = !!item.illustrative;
      tag.addEventListener("change", () => {
        item.illustrative = tag.checked; saveDraft(); renderGallery();
      });
      tagWrap.appendChild(tag);
      tagWrap.appendChild(document.createTextNode(" Stock photo (shows an “Illustrative” badge)"));
      body.appendChild(tagWrap);

      const row = el("div", "admin-row img-row__actions");

      const replaceLabel = el("label", "admin-btn", "Replace photo…");
      const replaceInput = document.createElement("input");
      replaceInput.type = "file";
      replaceInput.accept = "image/jpeg,image/png,image/webp";
      replaceInput.hidden = true;
      replaceInput.id = "replace-" + i;
      replaceLabel.setAttribute("for", replaceInput.id);
      replaceInput.addEventListener("change", () => {
        const f = replaceInput.files && replaceInput.files[0];
        if (f) replacePhoto(item, f);
        replaceInput.value = "";
      });
      row.appendChild(replaceLabel);
      row.appendChild(replaceInput);

      const up = el("button", "admin-btn", "Move up");
      up.type = "button";
      up.disabled = i === 0;
      up.addEventListener("click", () => move(i, -1));
      row.appendChild(up);

      const down = el("button", "admin-btn", "Move down");
      down.type = "button";
      down.disabled = i === items.length - 1;
      down.addEventListener("click", () => move(i, 1));
      row.appendChild(down);

      const del = el("button", "admin-btn admin-btn--danger", "Remove");
      del.type = "button";
      del.addEventListener("click", () => removePhoto(i));
      row.appendChild(del);

      body.appendChild(row);
      body.appendChild(el("p", "img-row__file", item.src.replace("images/gallery/", "")));
      li.appendChild(body);
      list.appendChild(li);
    });

    markDirty();
  }

  function markDirty() {
    const btn = $("img-publish");
    if (!btn) return;
    const n = gallery.items.filter(entryChanged).length +
              (published && published.items.length > gallery.items.length ? 1 : 0);
    btn.textContent = n > 0 ? "Publish " + n + " change" + (n === 1 ? "" : "s") + "…" : "Publish…";
    btn.disabled = n === 0;
  }

  /* ---- actions ----------------------------------------------------- */

  function move(i, by) {
    const j = i + by;
    if (j < 0 || j >= gallery.items.length) return;
    const tmp = gallery.items[i];
    gallery.items[i] = gallery.items[j];
    gallery.items[j] = tmp;
    saveDraft();
    renderGallery();
    setStatus($("img-status"), "Order changed. Publish when you are happy with it.", "good");
  }

  function removePhoto(i) {
    const item = gallery.items[i];
    confirmAction(
      "Remove this photo?",
      "“" + (item.caption || "This photo") + "” comes out of your draft. It stays on " +
      "the website until you publish.",
      () => {
        gallery.items.splice(i, 1);
        if (item.pending) idbDel(item.src).catch(() => {});
        saveDraft();
        renderGallery();
        setStatus($("img-status"), "Removed from your draft. Publish to take it off the website.", "good");
      }
    );
  }

  function replacePhoto(item, file) {
    setStatus($("img-status"), "Preparing the photo…", "");
    shrink(file).then(({ blob }) => {
      // Keep the SAME filename: publishing then means overwriting one file
      // and the website picks it up with no other change.
      return idbPut(item.src, blob).then(() => {
        item.pending = true;
        item.illustrative = false;      // a real job photo, not stock
        saveDraft();
        renderGallery();
        setStatus($("img-status"),
          "Photo replaced (" + Math.round(blob.size / 1024) + "KB). Publish when you are ready.", "good");
      });
    }).catch(() => {
      setStatus($("img-status"), "That file could not be read as a photo. Try a JPG, PNG or WebP.", "bad");
    });
  }

  function addPhotos(files) {
    const list = Array.prototype.slice.call(files);
    if (!list.length) return;
    setStatus($("img-status"), "Preparing " + list.length + " photo" + (list.length === 1 ? "" : "s") + "…", "");
    let added = 0;
    const step = (n) => {
      if (n >= list.length) {
        saveDraft();
        renderGallery();
        setStatus($("img-status"),
          added ? "Added " + added + " photo" + (added === 1 ? "" : "s") + ". Publish when you are ready."
                : "None of those files could be read as photos.",
          added ? "good" : "bad");
        return;
      }
      const file = list[n];
      shrink(file).then(({ blob }) => {
        const name = uniqueName(slug(file.name.replace(/\.[^.]+$/, "")));
        return idbPut(name, blob).then(() => {
          gallery.items.push({
            src: name,
            caption: "New photo",
            alt: "",
            full: "",
            illustrative: false,
            pending: true
          });
          added += 1;
        });
      }).catch(() => { /* skip this file */ })
        .then(() => step(n + 1));
    };
    step(0);
  }

  /* ---- publish ------------------------------------------------------ */

  function downloadLink(name, blob, label) {
    const a = document.createElement("a");
    a.className = "admin-btn admin-btn--primary publish-dl";
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.textContent = label;
    objectUrls.push(a.href);
    return a;
  }

  function publish() {
    const box = $("publish-downloads");
    const where = $("publish-where");
    const note = $("publish-note");
    const dialog = $("publish-dialog");
    if (!box || !dialog) return;
    box.textContent = "";

    // The manifest the site will read. `pending` is a local-only flag.
    const clean = {
      _comment: "Gallery contents. Written by the Images tab in /admin/.",
      version: 1,
      updated: todayISO(),
      items: gallery.items.map((i) => ({
        src: i.src,
        caption: i.caption || "",
        alt: i.alt || "",
        full: i.full || "",
        illustrative: !!i.illustrative
      }))
    };
    const manifestBlob = new Blob([JSON.stringify(clean, null, 2)], { type: "application/json" });

    const pending = gallery.items.filter((i) => i.pending);
    let count = 0;

    const finish = () => {
      if (manifestChanged()) {
        box.appendChild(downloadLink("gallery.json", manifestBlob, "Download gallery.json"));
        count += 1;
      }
      where.textContent = "";
      const ul = el("ul", "publish-where__list");
      if (pending.length) {
        ul.appendChild(el("li", "",
          "Put the photo file" + (pending.length === 1 ? "" : "s") +
          " into the site's images/gallery folder, replacing anything with the same name."));
      }
      if (manifestChanged()) {
        ul.appendChild(el("li", "", "Put gallery.json in the site's main folder, replacing the old one."));
      }
      ul.appendChild(el("li", "",
        "On GitHub that is: open the folder, press “Add file → Upload files”, drag the " +
        "file in and press “Commit changes”. The site redeploys on its own."));
      where.appendChild(ul);

      note.textContent = count === 0
        ? "Nothing to publish: the gallery already matches the website."
        : "After the site rebuilds, check the gallery page, then press “Discard my changes” " +
          "here to clear this draft.";
      dialog.showModal();
    };

    if (!pending.length) { finish(); return; }

    let n = 0;
    const next = () => {
      if (n >= pending.length) { finish(); return; }
      const item = pending[n];
      idbGet(item.src).then((blob) => {
        if (blob) {
          box.appendChild(downloadLink(
            item.src.replace("images/gallery/", ""), blob,
            "Download " + item.src.replace("images/gallery/", "")));
          count += 1;
        }
      }).catch(() => {}).then(() => { n += 1; next(); });
    };
    next();
  }

  function revertGallery() {
    confirmAction(
      "Discard your changes?",
      "Your draft gallery is thrown away and this goes back to the photos currently on the website.",
      () => {
        try { window.localStorage.removeItem(GALLERY_STORE); } catch (e) { /* ignore */ }
        idbClear().catch(() => {});
        gallery = clonePublished();
        renderGallery();
        setStatus($("img-status"), "Draft discarded. This matches the website again.", "good");
      }
    );
  }

  function clonePublished() {
    return published
      ? { items: published.items.map((i) => Object.assign({}, i)) }
      : { items: [] };
  }

  /* ---- start-up ----------------------------------------------------- */

  function initGallery() {
    if (!$("img-list")) return;

    const fail = (msg) => {
      published = { items: [] };
      gallery = loadDraft() || { items: [] };
      renderGallery();
      setStatus($("img-status"), msg, "bad");
    };

    if (typeof window.fetch !== "function") {
      fail("This browser is too old to manage the gallery here.");
      return;
    }

    window.fetch("/gallery.json", { cache: "no-cache" })
      .then((res) => { if (!res.ok) throw new Error("HTTP " + res.status); return res.json(); })
      .then((data) => {
        if (!data || !Array.isArray(data.items)) throw new Error("bad manifest");
        published = { items: data.items.map((i) => Object.assign({}, i)) };
        gallery = loadDraft() || clonePublished();
        renderGallery();
        const changed = gallery.items.filter(entryChanged).length;
        if (changed) {
          setStatus($("img-status"),
            "You have " + changed + " unpublished change" + (changed === 1 ? "" : "s") +
            " from last time. Publish them, or discard them.", "good");
        }
      })
      .catch(() => fail("Could not read the current gallery (gallery.json). Open this page from the website rather than from a file on disk."));

    $("img-add").addEventListener("change", (e) => {
      addPhotos(e.target.files);
      e.target.value = "";
    });
    $("img-publish").addEventListener("click", publish);
    $("img-revert").addEventListener("click", revertGallery);
  }


  function init() {
    enquiries = load();

    /* Lock screen */
    $("unlock-form").addEventListener("submit", tryUnlock);
    $("lock-btn").addEventListener("click", () => lock(false));

    /* Add / paste */
    $("tab-paste").addEventListener("click", () => switchTab(false));
    $("tab-manual").addEventListener("click", () => switchTab(true));

    /* Arrow/Home/End movement between the tabs — the keyboard half of the
       ARIA tab pattern the roles promise. */
    const tabs = [$("tab-paste"), $("tab-manual")];
    tabs.forEach((tab, i) => {
      tab.addEventListener("keydown", (e) => {
        let next = null;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") next = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = tabs[(i + tabs.length - 1) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (!next) return;
        e.preventDefault();
        switchTab(next === $("tab-manual"));
        next.focus();
      });
    });
    $("parse-btn").addEventListener("click", onParse);
    $("paste-clear").addEventListener("click", () => {
      $("paste-box").value = "";
      setStatus($("parse-status"), "");
      hideForm();
    });
    $("enquiry-form").addEventListener("submit", onSave);
    $("cancel-btn").addEventListener("click", hideForm);

    /* List controls. The search box is debounced: #list-count is a live
       region, and re-writing it on every keystroke makes a screen reader
       read the running total over the letters being typed. */
    let searchTimer = null;
    $("search").addEventListener("input", () => {
      if (searchTimer) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(renderList, 300);
    });
    $("filter-status").addEventListener("change", renderList);
    $("sort-by").addEventListener("change", renderList);

    /* Data */
    $("export-json").addEventListener("click", exportJson);
    $("export-csv").addEventListener("click", exportCsv);
    $("import-btn").addEventListener("click", () => $("import-file").click());
    $("import-file").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) importJson(file);
      e.target.value = "";  // allow re-picking the same file
    });
    $("wipe-btn").addEventListener("click", () => {
      confirmAction("Delete every enquiry?",
        "All " + enquiries.length + " enquiries will be removed from this device. Back up first if you might want them again.",
        () => {
          if (commit(() => { enquiries = []; })) { renderAll(); announce("All enquiries deleted."); }
        });
    });

    /* Confirm dialog result */
    const dialog = $("confirm-dialog");
    if (dialog) {
      dialog.addEventListener("close", () => {
        const run = dialog.returnValue === "confirm" && pendingConfirm;
        const fn = pendingConfirm;
        pendingConfirm = null;
        if (run) fn();
      });
    }

    /* Access key */
    $("save-key").addEventListener("click", async () => {
      const value = $("new-key").value;
      const again = $("new-key-confirm").value;
      if (value.length < 8) {
        setStatus($("key-status"), "Use at least 8 characters.", "bad");
        return;
      }
      // Only the hash is kept, so a typo here would be unrecoverable.
      if (value !== again) {
        setStatus($("key-status"), "The two keys don't match. Type the same one in both boxes.", "bad");
        return;
      }
      try {
        window.localStorage.setItem(KEYHASH_KEY, await sha256(value));
        $("new-key").value = "";
        $("new-key-confirm").value = "";
        setStatus($("key-status"), "New key saved for this device. Make sure you've written it down.", "good");
      } catch (err) {
        setStatus($("key-status"), "Couldn't save the new key. Storage is blocked.", "bad");
      }
    });
    $("reset-key").addEventListener("click", () => {
      try { window.localStorage.removeItem(KEYHASH_KEY); } catch (err) { /* ignore */ }
      setStatus($("key-status"), "Back to the built-in key.", "good");
    });

    /* Idle auto-lock */
    ["click", "keydown", "input"].forEach((evt) => {
      document.addEventListener(evt, () => { if (!$("admin-app").hidden) resetIdleTimer(); }, true);
    });

    /* Stay unlocked across a refresh in the same tab, but not a new one. */
    let unlocked = false;
    try {
      const since = Number(window.sessionStorage.getItem(UNLOCK_FLAG));
      unlocked = !!since && Date.now() - since < AUTO_LOCK_MS;
    } catch (e) { /* ignore */ }
    initGallery();

    if (unlocked) showApp(true);
    else $("admin-key").focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
