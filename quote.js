/* =====================================================================
   Devine Builders — quote.js
   Progressive enhancement for quote.html. Vanilla JS, defer-loaded.

   Client-side validation with accessible inline errors (aria-live /
   aria-describedby / aria-invalid), focus-the-first-invalid-field, and
   — on a valid submit — composes a mailto: to phildevine24@icloud.com
   with a prefilled subject + body so the default action works as a
   fallback. A clearly commented Formspree swap is included below.

   --------------------------------------------------------------------
   EXPECTED FORM CONTRACT (owned by quote.html)
   --------------------------------------------------------------------
   <form id="quote-form" novalidate
         action="mailto:phildevine24@icloud.com" method="post"
         enctype="text/plain">

     <!-- form-level status, polite live region -->
     <p class="form-status" id="form-status" role="status" aria-live="polite"></p>

     Each field follows this pattern (input/select/textarea):

     <div class="field">
       <label class="label" for="name">Full name <span class="req">*</span></label>
       <input class="input" id="name" name="name" type="text"
              autocomplete="name" required
              aria-describedby="name-error">
       <span class="error" id="name-error" role="alert"></span>
     </div>

     Required fields by id/name:
       name      — text
       email     — email (regex-validated)
       phone     — tel  (basic length/charset check)
       project-type — select; first <option value=""> is the placeholder
       details   — textarea

     Optional:
       postcode  — text (not required, included in the email if present)

     The project-type <select> options (value="label"):
       ""                     → "Please choose a service…" (placeholder, disabled)
       "Home Renovation"      → "Home Renovation"
       "Property Maintenance" → "Property Maintenance"
       "Garage Conversion"    → "Garage Conversion"
       "Other / Not sure"     → "Other / Not sure"

     <button class="btn btn--primary btn--lg" id="quote-submit" type="submit">
       Get my free quote
     </button>
   </form>

   Error elements MUST share the id "<fieldId>-error" and be referenced
   by the control's aria-describedby for the wiring below to work.
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

      /* ----------------------------------------------------------------
         VALID. Build the values object.
         ---------------------------------------------------------------- */
      var data = collect(form);

      /* === DEFAULT BEHAVIOUR: mailto fallback ===
         Opens the visitor's email client with a prefilled message to
         Phil. Works with no backend / no server. */
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
        "Sent from devinebuilders.co.uk quote form"
      ];
      var body = bodyLines.join("\r\n");

      var mailto =
        "mailto:" + RECIPIENT +
        "?subject=" + encodeURIComponent(subject) +
        "&body=" + encodeURIComponent(body);

      // Trigger the email client once. We do NOT auto-redirect afterwards:
      // a mailto: can silently fail (no mail client configured, the protocol
      // dialog cancelled, etc.), and an unconditional timer would whisk the
      // visitor away from their typed details to thank-you.html regardless.
      // Instead we render a persistent success panel and let the visitor
      // choose their next step. The form is intentionally NOT cleared, so
      // nothing is lost if the email app didn't open. (NO-JS path: the
      // <form> mailto action still works without this.)
      window.location.href = mailto;

      // Keep #form-status purely for the short polite announcement, and render
      // the persistent panel (heading + links) into a separate, non-live
      // container so the interactive controls aren't placed inside a live region.
      if (status) {
        setStatus(status, "Your email app should now be open.", "is-success");
      }
      if (successPanel) {
        showSuccessPanel(successPanel, mailto);
      }

      /* ================================================================
         OPTIONAL: send via a backend instead of (or as well as) mailto.
         ----------------------------------------------------------------
         To use Formspree (or any compatible JSON endpoint):

         1. Create a form at https://formspree.io and copy your endpoint,
            e.g. https://formspree.io/f/abcdwxyz
         2. Comment OUT the `window.location.href = mailto;` line above.
         3. Uncomment and adapt the block below.

         var ENDPOINT = "https://formspree.io/f/your-id-here";

         fetch(ENDPOINT, {
           method: "POST",
           headers: { "Accept": "application/json" },
           body: new FormData(form)
         })
           .then(function (res) {
             if (res.ok) {
               // On success, send the visitor to the thank-you page.
               window.location.assign("thank-you.html");
             } else {
               return res.json().then(function (j) {
                 throw new Error((j && j.error) || "Submission failed");
               });
             }
           })
           .catch(function () {
             setStatus(status,
               "Sorry, something went wrong sending the form. " +
               "Please call or email us directly.",
               "is-error");
           });

         ALTERNATIVELY: instead of redirecting in JS, add a hidden field
         to the <form> so Formspree redirects after a successful POST
         (this also covers the no-JS path):

           <input type="hidden" name="_next"
                  value="https://devinebuilders.co.uk/thank-you.html">

         NOTE: if you switch to Formspree, also set the <form> action to
         the endpoint and remove enctype="text/plain" so the no-JS
         fallback posts correctly too.
         ================================================================ */
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
      if (!el.name) return;
      out[el.name] = (el.value || "").trim();
    });
    return out;
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

  /* Render a persistent success panel after the mailto: is triggered, into a
     NON-live container (not role=status / aria-live) so its interactive links
     aren't treated as transient status announcements. Focus is moved to the
     panel heading so keyboard/AT users are taken to it deterministically.
     Built with DOM nodes (not innerHTML) so the user-derived mailto link
     can't inject markup. The panel stays put — no auto-redirect — and the
     form is left untouched so nothing is lost if the email app didn't open. */
  function showSuccessPanel(el, mailto) {
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

    // Move focus to the panel so it isn't lost after the mailto: navigation
    // attempt, and AT users land on the heading rather than relying on the
    // (now intentionally brief) live-region announcement.
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
