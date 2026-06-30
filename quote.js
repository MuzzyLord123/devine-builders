/* =====================================================================
   Devine Builders — quote.js
   Progressive enhancement for quote.html. Vanilla JS, defer-loaded.

   Accessible client-side validation (aria-live / aria-describedby /
   aria-invalid, focus-the-first-invalid-field), then — on a valid submit —
   sends the enquiry straight to Phil via FormSubmit.co (free, no account)
   and shows the thank-you page. If that network send ever fails, it falls
   back to opening the visitor's email app with a pre-filled message so the
   enquiry can still get through. The no-JS path posts the plain <form>
   directly to FormSubmit.

   ONE-TIME SETUP (FormSubmit.co): the first submission emails Phil a
   confirmation link; once he clicks it, every enquiry is delivered to his
   inbox. No signup, dashboard, or endpoint key required.
   --------------------------------------------------------------------
   EXPECTED FORM CONTRACT (owned by quote.html)
   --------------------------------------------------------------------
   <form id="quote-form" novalidate method="POST"
         action="https://formsubmit.co/phildevine24@icloud.com">
     <p class="form-status" id="form-status" role="status" aria-live="polite"></p>
     ... fields named: name, email, phone, postcode (optional),
         project-type, details ...
     <button id="quote-submit" type="submit">Get my free quote</button>
   </form>
   <div class="form-success" id="form-success" hidden></div>

   Error elements share id "<fieldId>-error" and are referenced by each
   control's aria-describedby.
   ===================================================================== */

(function () {
  "use strict";

  /* Where enquiries are sent. */
  var RECIPIENT = "phildevine24@icloud.com";

  /* Reasonable email pattern (intentionally permissive but catches typos). */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  /* Phone: at least 7 digits; allows +, spaces, (), -, . */
  var PHONE_RE = /^[+()\d][\d\s().-]{6,}$/;

  /* Field definitions: id, friendly label, and a validator. */
  var FIELDS = [
    {
      id: "name",
      label: "your name",
      validate: function (v) {
        if (!v) return "Please enter your name.";
        if (v.length < 2) return "Please enter your full name.";
        return "";
      }
    },
    {
      id: "email",
      label: "your email",
      validate: function (v) {
        if (!v) return "Please enter your email address.";
        if (!EMAIL_RE.test(v)) return "Please enter a valid email address.";
        return "";
      }
    },
    {
      id: "phone",
      label: "your phone number",
      validate: function (v) {
        if (!v) return "Please enter a contact phone number.";
        if (!PHONE_RE.test(v)) return "Please enter a valid phone number.";
        return "";
      }
    },
    {
      id: "project-type",
      label: "a project type",
      validate: function (v) {
        if (!v) return "Please choose the type of work.";
        return "";
      }
    },
    {
      id: "details",
      label: "some details",
      validate: function (v) {
        if (!v) return "Please tell us a little about the job.";
        if (v.length < 10) return "Please add a little more about the job (a sentence or two is plenty).";
        return "";
      }
    }
  ];

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function init() {
    var form = document.getElementById("quote-form");
    if (!form) return; // Nothing to enhance.

    var status = document.getElementById("form-status");
    var successPanel = document.getElementById("form-success");

    // Cache control + error element references per field.
    var refs = FIELDS.map(function (f) {
      return {
        def: f,
        control: document.getElementById(f.id),
        error: document.getElementById(f.id + "-error")
      };
    }).filter(function (r) { return r.control; });

    // Honest, advisory "do we cover your area?" hint as the user types a postcode.
    // Outward codes for Flintshire / Deeside / the wider North Wales area.
    var postcode = document.getElementById("postcode");
    var areaMsg = document.getElementById("postcode-area");
    if (postcode && areaMsg) {
      var COVERED = /^(CH4|CH5|CH6|CH7|CH8|LL)/i;
      postcode.addEventListener("input", function () {
        var v = postcode.value.replace(/\s+/g, "").toUpperCase();
        if (v.length < 2) { areaMsg.textContent = ""; areaMsg.className = "field__area"; return; }
        if (COVERED.test(v)) {
          areaMsg.textContent = "Great — that's within the area we cover. Phil will confirm when he's in touch.";
          areaMsg.className = "field__area is-yes";
        } else {
          areaMsg.textContent = "We're based in Connah's Quay and cover Flintshire & North Wales — pop it in and Phil will let you know either way.";
          areaMsg.className = "field__area is-maybe";
        }
      });
    }

    // Deep-link: quote.html?service=Roofing pre-selects the matching project type
    // and triggers the helper tip (initQuoteHelper in site.js listens for change).
    var select = document.getElementById("project-type");
    try {
      var wanted = new URLSearchParams(window.location.search).get("service") ||
                   new URLSearchParams(window.location.search).get("type");
      if (wanted && select) {
        var norm = wanted.trim().toLowerCase();
        var ALIAS = {
          "extensions": "Extension", "extension": "Extension",
          "renovations": "Renovation", "renovation": "Renovation",
          "brickwork": "Brickwork & Masonry", "brickwork & masonry": "Brickwork & Masonry", "masonry": "Brickwork & Masonry",
          "groundworks": "Groundworks",
          "roofing": "Roofing", "roof": "Roofing",
          "driveways & patios": "Driveway / Patio", "driveways": "Driveway / Patio", "driveway / patio": "Driveway / Patio", "patios": "Driveway / Patio",
          "landscaping": "Landscaping",
          "property maintenance": "Property Maintenance", "maintenance": "Property Maintenance"
        };
        var match = ALIAS[norm] || "";
        if (!match) {
          Array.prototype.forEach.call(select.options, function (o) {
            if (o.value && o.value.toLowerCase() === norm) match = o.value;
          });
        }
        if (match) {
          select.value = match;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } catch (e) { /* URLSearchParams unsupported — ignore */ }

    // Clear a field's error as the user fixes it (on input/change).
    refs.forEach(function (r) {
      var evt = r.control.tagName === "SELECT" ? "change" : "input";
      r.control.addEventListener(evt, function () {
        if (r.control.getAttribute("aria-invalid") === "true") {
          var msg = r.def.validate(getValue(r.control));
          if (!msg) clearError(r);
        }
      });
    });

    form.addEventListener("submit", function (e) {
      // We control submission entirely.
      e.preventDefault();
      clearStatus(status);
      hideSuccessPanel(successPanel);

      var firstInvalid = null;

      refs.forEach(function (r) {
        var msg = r.def.validate(getValue(r.control));
        if (msg) {
          setError(r, msg);
          if (!firstInvalid) firstInvalid = r;
        } else {
          clearError(r);
        }
      });

      if (firstInvalid) {
        if (status) {
          setStatus(
            status,
            "Please fix the highlighted field" +
              (countErrors(refs) > 1 ? "s" : "") + " and try again.",
            "is-error"
          );
        }
        firstInvalid.control.focus();
        return;
      }

      /* ---- VALID ---- */
      var submitBtn = document.getElementById("quote-submit");

      // If a photo/plan is attached, submit the real multipart <form> natively:
      // FormSubmit emails the file(s) and redirects to _next (thank-you.html).
      // The background JSON path below cannot carry file uploads.
      var fileInput = document.getElementById("attachment");
      if (fileInput && fileInput.files && fileInput.files.length) {
        if (status) setStatus(status, "Sending your enquiry…", "");
        if (submitBtn) submitBtn.disabled = true;
        form.submit();
        return;
      }

      var data = collect(form);

      /* Build a mailto: link as a guaranteed FALLBACK if the live send fails
         (no connection, FormSubmit unreachable, etc.). */
      var mailto = buildMailto(data);

      function fallbackToEmailApp(note) {
        if (submitBtn) submitBtn.disabled = false;
        window.location.href = mailto;
        if (status) setStatus(status, note, "is-success");
        if (successPanel) showSuccessPanel(successPanel, mailto);
      }

      // Very old browser without fetch: go straight to the email-app method.
      if (!window.fetch) {
        fallbackToEmailApp("Your email app should now be open.");
        return;
      }

      /* PRIMARY: send straight to Phil via FormSubmit.co's CORS-friendly
         /ajax/ endpoint, in the background, then show the thank-you page. */
      var ENDPOINT = "https://formsubmit.co/ajax/" + RECIPIENT;
      var payload = {
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        postcode: data.postcode || "",
        "project-type": data["project-type"] || "",
        details: data.details || "",
        _subject: "New quote request — Devine Builders website",
        _template: "table",
        _captcha: "false",
        _honey: (function () { var h = form.querySelector('[name="_honey"]'); return h ? h.value : ""; })()
      };

      if (submitBtn) submitBtn.disabled = true;
      if (status) setStatus(status, "Sending your enquiry…", "");

      fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          if (submitBtn) submitBtn.disabled = false; // leave a usable form on back-navigation
          // Sent (or queued pending the one-time confirmation) → confirmation page.
          window.location.assign("thank-you.html");
        })
        .catch(function () {
          // Couldn't reach the backend — fall back to the email-app method
          // so the enquiry can still reach Phil, without losing typed details.
          fallbackToEmailApp(
            "We couldn't send it directly just now — your email app should be open as a backup, " +
            "or call or email us using the details opposite."
          );
        });
    });
  });

  /* ---------------- helpers ---------------- */

  function getValue(control) {
    return (control.value || "").trim();
  }

  function collect(form) {
    var out = {};
    var els = form.querySelectorAll("input, select, textarea");
    Array.prototype.forEach.call(els, function (el) {
      if (!el.name || el.name.charAt(0) === "_") return; // skip FormSubmit _config fields
      out[el.name] = (el.value || "").trim();
    });
    return out;
  }

  /* Build a mailto: link from the collected field values — the offline
     fallback used only if the live (FormSubmit) send fails. */
  function buildMailto(data) {
    var subject =
      "Quote request — " + (data["project-type"] || "General enquiry") +
      " (" + (data.name || "Website enquiry") + ")";
    var bodyLines = [
      "New quote request from the Devine Builders website",
      "------------------------------------------------------",
      "Name:        " + (data.name || ""),
      "Email:       " + (data.email || ""),
      "Phone:       " + (data.phone || ""),
      "Postcode:    " + (data.postcode || "(not given)"),
      "Project:     " + (data["project-type"] || ""),
      "",
      "Details:",
      data.details || "",
      "",
      "------------------------------------------------------",
      "Sent from the Devine Builders website quote form"
    ];
    var body = bodyLines.join("\r\n");
    return "mailto:" + RECIPIENT +
      "?subject=" + encodeURIComponent(subject) +
      "&body=" + encodeURIComponent(body);
  }

  function setError(r, msg) {
    r.control.setAttribute("aria-invalid", "true");
    var field = r.control.closest(".field");
    if (field) field.classList.add("has-error");
    if (r.error) {
      r.error.textContent = msg;
      r.error.classList.add("is-visible");
    }
  }

  function clearError(r) {
    r.control.setAttribute("aria-invalid", "false");
    var field = r.control.closest(".field");
    if (field) field.classList.remove("has-error");
    if (r.error) {
      r.error.textContent = "";
      r.error.classList.remove("is-visible");
    }
  }

  function countErrors(refs) {
    return refs.filter(function (r) {
      return r.control.getAttribute("aria-invalid") === "true";
    }).length;
  }

  function setStatus(el, msg, cls) {
    if (!el) return;
    el.className = "form-status " + (cls || "");
    el.textContent = msg;
  }

  /* Persistent success panel for the email-app FALLBACK path (rendered into a
     NON-live container so its links aren't announced as transient status).
     Built with DOM nodes (not innerHTML) so the user-derived mailto link can't
     inject markup. Focus moves to the heading; the form is left untouched. */
  function showSuccessPanel(el, mailto) {
    if (!el) return;
    el.className = "form-success";
    el.textContent = "";
    el.hidden = false;

    var heading = document.createElement("strong");
    heading.className = "form-success__heading";
    heading.setAttribute("tabindex", "-1");
    heading.textContent = "Your enquiry is ready to send.";
    el.appendChild(heading);

    var hint = document.createElement("p");
    hint.textContent =
      "Just press Send in your email app to get this enquiry to Phil. " +
      "Nothing opened? Use the button below, or call or email us directly.";
    el.appendChild(hint);

    var actions = document.createElement("p");
    actions.className = "form-success__actions";

    var cont = document.createElement("a");
    cont.className = "btn btn--secondary";
    cont.href = "thank-you.html";
    cont.textContent = "Continue";
    actions.appendChild(cont);

    var retry = document.createElement("a");
    retry.className = "form-success__retry";
    retry.href = mailto;
    retry.textContent = "Open my email app again";
    actions.appendChild(retry);

    el.appendChild(actions);
    heading.focus();
  }

  function hideSuccessPanel(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    el.className = "form-success";
  }

  function clearStatus(el) {
    if (!el) return;
    el.className = "form-status";
    el.textContent = "";
  }
})();
