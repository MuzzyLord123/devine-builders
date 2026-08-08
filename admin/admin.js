/* =====================================================================
   Devine Builders — admin.js   (enquiry tracker, /admin/ only)

   Vanilla JS, no libraries, no network calls of any kind. Everything is
   kept in this browser's localStorage; nothing is uploaded or shared.

   NOTE ON STYLE: the public site files (site.js / quote.js / gallery.js /
   chatbot.js) are deliberately written in an ES5 style because they run in
   whatever browser a visitor turns up with. This file is different: it is
   an owner-only tool used on one modern device, so it uses const/let and
   arrow functions for readability. Keep that split if you edit either.

   ---------------------------------------------------------------------
   CHANGING THE ACCESS KEY

   Only the SHA-256 hash of the key is stored, never the key itself.
   The panel's "Change the access key" box sets a key for the CURRENT
   device. To change the built-in key for every device, replace
   DEFAULT_KEY_HASH below with the hash of your new key. Get the hash by
   pasting this into any browser's dev-tools console (F12 -> Console):

     crypto.subtle.digest('SHA-256', new TextEncoder().encode('your-new-key'))
       .then(b => console.log([...new Uint8Array(b)]
         .map(x => x.toString(16).padStart(2, '0')).join('')));

   Remember: this check runs in the visitor's own browser, so it is a
   privacy curtain for your device — not server-grade security.
   ===================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------- */
  /* 1. Constants                                                      */
  /* ---------------------------------------------------------------- */

  // SHA-256 of the key issued when this panel was built.
  const DEFAULT_KEY_HASH =
    "9058d51f69c76ca0e46fd3b1cc7f3709aa48dfd39fbf216e75ac7cc41cfe370d";

  const STORE_KEY = "db-admin-enquiries-v1";  // the enquiries themselves
  const KEYHASH_KEY = "db-admin-keyhash";     // per-device key override
  const UNLOCK_FLAG = "db-admin-unlocked";    // sessionStorage: this tab is unlocked
  const AUTO_LOCK_MS = 30 * 60 * 1000;        // re-lock after 30 min idle

  const STATUSES = { new: "New", quoted: "Quoted", won: "Won", lost: "Lost" };

  // Must match the quote form's <option> values (quote.html).
  const SERVICES = [
    "Extension", "Renovation", "Brickwork & Masonry", "Groundworks",
    "Roofing", "Driveway / Patio", "Landscaping", "Property Maintenance",
    "Other / Not sure"
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

  const todayISO = () => new Date().toISOString().slice(0, 10);

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

  function load() {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.items)) return [];
      return data.items.filter(valid).map(clean);
    } catch (e) {
      // Corrupt or unavailable storage must never brick the panel.
      return [];
    }
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
        "Could not save — this browser is blocking storage or is full. Back up your data, then free some space.", "bad");
      return false;
    }
  }

  /* Every change goes through here so that a FAILED write can never leave
     what's on screen out of step with what's actually stored. Without the
     rollback, a quota error would show the owner an enquiry that looked
     saved and would vanish on the next visit. */
  function commit(mutate) {
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
    } catch (e) { /* storage blocked — fall through to the built-in key */ }
    return DEFAULT_KEY_HASH;
  }

  let failedAttempts = 0;
  let lockTimer = null;

  function showApp() {
    $("admin-lock").hidden = true;
    $("admin-app").hidden = false;
    try { window.sessionStorage.setItem(UNLOCK_FLAG, "1"); } catch (e) { /* ignore */ }
    renderAll();
    resetIdleTimer();
  }

  function lock() {
    $("admin-app").hidden = true;
    $("admin-lock").hidden = false;
    $("admin-key").value = "";
    setStatus($("unlock-error"), "");
    $("unlock-error").className = "admin-lock__error";
    try { window.sessionStorage.removeItem(UNLOCK_FLAG); } catch (e) { /* ignore */ }
    if (lockTimer) { window.clearTimeout(lockTimer); lockTimer = null; }
    $("admin-key").focus();
  }

  function resetIdleTimer() {
    if (lockTimer) window.clearTimeout(lockTimer);
    lockTimer = window.setTimeout(lock, AUTO_LOCK_MS);
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
          if (labelOf(next) && next.trim().length <= 40) break;
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
    let received = todayISO();
    const dm = text.match(/^\s*(?:date|sent|received)\s*:\s*(.+)$/im);
    if (dm) {
      const d = new Date(dm[1].trim());
      const now = Date.now();
      // Only trust it if it's a real date, not in the future, not ancient.
      if (!isNaN(d.getTime()) && d.getTime() <= now + 864e5 && d.getTime() > now - 5 * 365 * 864e5) {
        received = d.toISOString().slice(0, 10);
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
    const winRate = decided ? Math.round((won.length / decided) * 100) + "%" : "—";
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

  function replyMailto(item) {
    const subject = "Your enquiry — " + BUSINESS.name;
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
    return "mailto:" + encodeURIComponent(item.email) +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  }

  function renderItem(item) {
    const li = el("li", "admin-item");

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
      const contact = el("p", "admin-item__meta");
      if (item.phone) {
        const a = el("a", null, item.phone);
        a.href = "tel:" + item.phone.replace(/[^\d+]/g, "");
        contact.appendChild(a);
      }
      if (item.phone && item.email) contact.appendChild(document.createTextNode(" · "));
      if (item.email) {
        const a = el("a", null, item.email);
        a.href = "mailto:" + item.email;
        contact.appendChild(a);
      }
      li.appendChild(contact);
    }

    if (item.details) li.appendChild(el("p", "admin-item__details", item.details));
    if (item.notes) li.appendChild(el("p", "admin-item__notes", "Notes: " + item.notes));

    /* --- actions --- */
    const actions = el("div", "admin-item__actions");
    if (item.email) {
      const reply = el("a", "admin-btn", "Reply by email");
      reply.href = replyMailto(item);
      actions.appendChild(reply);
    }
    if (item.phone) {
      const call = el("a", "admin-btn", "Call");
      call.href = "tel:" + item.phone.replace(/[^\d+]/g, "");
      actions.appendChild(call);
    }
    const editBtn = el("button", "admin-btn", "Update");
    editBtn.type = "button";
    editBtn.setAttribute("aria-expanded", "false");
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
      if (!open) statusField.control.focus();
    });

    saveBtn.addEventListener("click", () => {
      const ok = commit(() => {
        item.status = statusField.control.value;
        item.value = Math.max(0, Math.round(Number(valueField.control.value) || 0));
        item.followUp = followField.control.value || "";
        item.source = sourceField.control.value;
        item.notes = notesArea.value.slice(0, 2000);
      });
      if (ok) { renderAll(); announce("Enquiry updated."); }
    });

    delBtn.addEventListener("click", () => {
      confirmAction(
        "Delete this enquiry?",
        (item.name ? item.name + "'s" : "This") + " enquiry will be removed from this device. This can't be undone.",
        () => {
          const ok = commit(() => {
            enquiries = enquiries.filter((e) => e.id !== item.id);
          });
          if (ok) { renderAll(); announce("Enquiry deleted."); }
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
    const count = $("list-count");
    if (!enquiries.length) count.textContent = "";
    else if (items.length === enquiries.length) {
      count.textContent = enquiries.length === 1 ? "1 enquiry" : enquiries.length + " enquiries";
    } else {
      count.textContent = "Showing " + items.length + " of " + enquiries.length + " enquiries";
    }
  }

  function renderAll() { renderStats(); renderList(); }

  function announce(message) { setStatus($("data-status"), message, "good"); }

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
      "Found " + parsed.hits + " detail" + (parsed.hits === 1 ? "" : "s") + " — check them below before saving.", "good");
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
    announce("Enquiry saved.");
    $("admin-list").scrollIntoView({ behavior: "smooth", block: "start" });
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
    announce("Backup downloaded — keep it somewhere safe.");
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
      const incoming = (data && Array.isArray(data.items) ? data.items : []).filter(valid).map(clean);
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
      announce(added
        ? "Restored " + added + " enquir" + (added === 1 ? "y" : "ies") + " (duplicates skipped)."
        : "Nothing new to restore — those enquiries are already here.");
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
    dialog.showModal();
  }

  /* ---------------------------------------------------------------- */
  /* 10. Wiring                                                        */
  /* ---------------------------------------------------------------- */

  function switchTab(toManual) {
    $("tab-paste").classList.toggle("is-active", !toManual);
    $("tab-manual").classList.toggle("is-active", toManual);
    $("tab-paste").setAttribute("aria-selected", String(!toManual));
    $("tab-manual").setAttribute("aria-selected", String(toManual));
    $("panel-paste").hidden = toManual;
    $("panel-manual").hidden = !toManual;
    if (toManual) {
      fillForm({ received: todayISO(), source: "Phone", status: "new" });
      showForm("New enquiry");
    } else {
      hideForm();
    }
  }

  function init() {
    enquiries = load();

    /* Lock screen */
    $("unlock-form").addEventListener("submit", tryUnlock);
    $("lock-btn").addEventListener("click", lock);

    /* Add / paste */
    $("tab-paste").addEventListener("click", () => switchTab(false));
    $("tab-manual").addEventListener("click", () => switchTab(true));
    $("parse-btn").addEventListener("click", onParse);
    $("paste-clear").addEventListener("click", () => {
      $("paste-box").value = "";
      setStatus($("parse-status"), "");
      hideForm();
    });
    $("enquiry-form").addEventListener("submit", onSave);
    $("cancel-btn").addEventListener("click", hideForm);

    /* List controls */
    $("search").addEventListener("input", renderList);
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
      if (value.length < 8) {
        setStatus($("key-status"), "Use at least 8 characters.", "bad");
        return;
      }
      try {
        window.localStorage.setItem(KEYHASH_KEY, await sha256(value));
        $("new-key").value = "";
        setStatus($("key-status"), "New key saved for this device.", "good");
      } catch (err) {
        setStatus($("key-status"), "Couldn't save the new key — storage is blocked.", "bad");
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
    try { unlocked = window.sessionStorage.getItem(UNLOCK_FLAG) === "1"; } catch (e) { /* ignore */ }
    if (unlocked) showApp();
    else $("admin-key").focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
