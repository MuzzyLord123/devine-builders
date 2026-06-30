/* =====================================================================
   Devine Builders — gallery.js
   Progressive enhancement for gallery.html. Vanilla JS, defer-loaded.

   The HTML owns the images so the gallery works with JS disabled.
   This script READS the existing figures and adds: a broken-image
   fallback, an accessible lightbox (open/close, prev/next with wrap,
   counter), full keyboard support (Esc / arrows), focus trapping +
   restore, and body scroll-lock.

   --------------------------------------------------------------------
   EXPECTED DOM (owned by gallery.html — do NOT generate it here)
   --------------------------------------------------------------------
   <ul class="gallery" id="gallery">                      <!-- grid container -->
     <li class="gallery__item">
       <button class="gallery__btn" type="button"
               data-full="images/gallery/project-1.jpg"   <!-- optional: full-size src; falls back to the <img> src -->
               data-caption="Full kitchen renovation, Connah's Quay">
         <img class="gallery__img"
              src="images/gallery/project-1.jpg"
              alt="Newly renovated kitchen with fitted units"
              loading="lazy" width="800" height="600">
         <figcaption class="gallery__caption">Kitchen renovation</figcaption>
       </button>
     </li>
     ... more .gallery__item entries ...
   </ul>

   And ONE lightbox shell present in gallery.html (hidden by default):

   <div class="lightbox" id="lightbox" role="dialog" aria-modal="true"
        aria-labelledby="lightbox-caption" hidden>
     <div class="lightbox__bar">
       <span class="lightbox__counter" id="lightbox-counter" aria-live="polite"></span>
       <button class="lightbox__control lightbox__close" id="lightbox-close"
               type="button" aria-label="Close gallery viewer"> ... svg ... </button>
     </div>
     <div class="lightbox__stage">
       <button class="lightbox__control lightbox__nav lightbox__nav--prev"
               id="lightbox-prev" type="button" aria-label="Previous image"> ... </button>
       <figure class="lightbox__figure">
         <img class="lightbox__img" id="lightbox-img" src="" alt="">
         <figcaption class="lightbox__caption" id="lightbox-caption"></figcaption>
       </figure>
       <button class="lightbox__control lightbox__nav lightbox__nav--next"
               id="lightbox-next" type="button" aria-label="Next image"> ... </button>
     </div>
   </div>

   Key hooks this script binds to (by id):
     #gallery, #lightbox, #lightbox-img, #lightbox-caption,
     #lightbox-counter, #lightbox-close, #lightbox-prev, #lightbox-next
   Per-thumbnail data attributes: data-full (optional), data-caption (optional)
   ===================================================================== */

(function () {
  "use strict";

  /* Inline SVG placeholder shown when a photo fails to load, so a
     missing image looks intentional rather than broken. */
  var PLACEHOLDER_SVG =
    'data:image/svg+xml;charset=UTF-8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" ' +
      'role="img" aria-label="Devine Builders project photo placeholder">' +
      '<rect width="800" height="600" fill="#f1f5f9"/>' +
      '<rect x="1" y="1" width="798" height="598" fill="none" ' +
      'stroke="#cbd5e1" stroke-width="2"/>' +
      '<g fill="none" stroke="#94a3b8" stroke-width="10" ' +
      'stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M250 360h300M250 360l70-90 55 65 45-55 80 80M250 360v0"/>' +
      '<circle cx="330" cy="250" r="26"/></g>' +
      '<text x="400" y="450" text-anchor="middle" ' +
      'font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="34" ' +
      'font-weight="700" fill="#475569">Devine Builders</text>' +
      '<text x="400" y="492" text-anchor="middle" ' +
      'font-family="system-ui,Segoe UI,Arial,sans-serif" font-size="24" ' +
      'fill="#94a3b8">Project Photo</text></svg>'
    );

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function init() {
    var gallery = document.getElementById("gallery");
    var lightbox = document.getElementById("lightbox");

    /* ---- broken-image fallback (works even with no lightbox) ---- */
    attachImageFallbacks(document);

    if (!gallery || !lightbox) {
      // Nothing to enhance, or no viewer present. Fallbacks still applied.
      return;
    }

    var lbImg = document.getElementById("lightbox-img");
    var lbCaption = document.getElementById("lightbox-caption");
    var lbCounter = document.getElementById("lightbox-counter");
    var btnClose = document.getElementById("lightbox-close");
    var btnPrev = document.getElementById("lightbox-prev");
    var btnNext = document.getElementById("lightbox-next");

    // If the viewer shell is incomplete, fail safe and bail.
    if (!lbImg || !lbCaption || !lbCounter || !btnClose || !btnPrev || !btnNext) {
      return;
    }

    // Collect the trigger buttons in DOM order.
    var triggers = Array.prototype.slice.call(
      gallery.querySelectorAll(".gallery__btn")
    );

    // Defensive: zero images → nothing to wire up, viewer stays hidden.
    if (triggers.length === 0) {
      return;
    }

    // Build a model of each slide from the existing DOM.
    var slides = triggers.map(function (btn) {
      var img = btn.querySelector("img");
      var capEl = btn.querySelector("figcaption");
      var full =
        btn.getAttribute("data-full") ||
        (img && img.getAttribute("src")) ||
        "";
      var caption =
        btn.getAttribute("data-caption") ||
        (capEl ? capEl.textContent.trim() : "") ||
        (img ? img.getAttribute("alt") || "" : "");
      var alt = (img && img.getAttribute("alt")) || caption || "Project photo";
      return { trigger: btn, full: full, caption: caption, alt: alt };
    });

    var current = -1;
    var lastFocused = null;
    var isOpen = false;

    /* ---------------- open / close ---------------- */

    function open(index) {
      current = wrap(index);
      lastFocused = document.activeElement;

      render(current);

      lightbox.hidden = false;
      // Force reflow so the opacity transition runs from 0 → 1.
      // eslint-disable-next-line no-unused-expressions
      lightbox.offsetWidth;
      lightbox.classList.add("is-open");

      lockScroll(true);
      isOpen = true;

      // Mark the rest of the page inert to AT where supported.
      setBackgroundHidden(true);

      // Move focus into the dialog (close button is a safe default).
      btnClose.focus();

      document.addEventListener("keydown", onKeydown, true);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;

      lightbox.classList.remove("is-open");
      document.removeEventListener("keydown", onKeydown, true);
      setBackgroundHidden(false);
      lockScroll(false);

      var finish = function () {
        lightbox.hidden = true;
        lightbox.removeEventListener("transitionend", finish);
        // Restore focus to the thumbnail that opened the viewer.
        if (lastFocused && typeof lastFocused.focus === "function") {
          lastFocused.focus();
        }
      };

      // Respect reduced-motion / no-transition environments.
      var dur = prefersReducedMotion() ? 0 : transitionMs(lightbox);
      if (dur > 0) {
        lightbox.addEventListener("transitionend", finish);
        // Safety net if transitionend doesn't fire.
        window.setTimeout(function () {
          if (lightbox.hidden === false) finish();
        }, dur + 80);
      } else {
        finish();
      }
    }

    function show(index) {
      current = wrap(index);
      render(current);
    }

    function render(index) {
      var slide = slides[index];

      // Reset error state, then set source; fallback handler covers misses.
      lbImg.removeAttribute("data-fallback-applied");
      lbImg.alt = slide.alt;
      lbImg.src = slide.full || PLACEHOLDER_SVG;

      lbCaption.textContent = slide.caption || "";
      lbCaption.hidden = slide.caption === "";

      lbCounter.textContent = (index + 1) + " of " + slides.length;
    }

    function wrap(index) {
      var n = slides.length;
      return ((index % n) + n) % n; // always positive, wraps both ways
    }

    /* ---------------- keyboard & focus trap ---------------- */

    function onKeydown(e) {
      if (!isOpen) return;
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          close();
          break;
        case "ArrowRight":
          e.preventDefault();
          show(current + 1);
          break;
        case "ArrowLeft":
          e.preventDefault();
          show(current - 1);
          break;
        case "Tab":
          trapFocus(e);
          break;
        default:
          break;
      }
    }

    function focusableInDialog() {
      var sel =
        'a[href], button:not([disabled]), textarea, input, select, ' +
        '[tabindex]:not([tabindex="-1"])';
      return Array.prototype.filter.call(
        lightbox.querySelectorAll(sel),
        function (el) {
          return (
            el.offsetWidth > 0 ||
            el.offsetHeight > 0 ||
            el === document.activeElement
          );
        }
      );
    }

    function trapFocus(e) {
      var items = focusableInDialog();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      var first = items[0];
      var last = items[items.length - 1];
      var active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || !lightbox.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last || !lightbox.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    /* ---------------- wiring ---------------- */

    triggers.forEach(function (btn, i) {
      btn.addEventListener("click", function () {
        open(i);
      });
    });

    btnClose.addEventListener("click", close);
    btnNext.addEventListener("click", function () { show(current + 1); });
    btnPrev.addEventListener("click", function () { show(current - 1); });

    // Click on the overlay (but not on the figure/controls) closes.
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox || e.target.classList.contains("lightbox__stage")) {
        close();
      }
    });

    /* ---------------- helpers ---------------- */

    function setBackgroundHidden(hidden) {
      // Mark siblings of the lightbox inert/aria-hidden so AT and tabbing
      // stay within the dialog. The lightbox itself is left interactive.
      var nodes = document.body.children;
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        // Never inert the lightbox itself OR any ancestor that contains it —
        // otherwise the open viewer (incl. its close button) becomes inert.
        if (el === lightbox || el.contains(lightbox)) continue;
        if (hidden) {
          if (el.getAttribute("aria-hidden") === null) {
            el.setAttribute("data-lb-hidden", "1");
            el.setAttribute("aria-hidden", "true");
          }
          if ("inert" in HTMLElement.prototype) el.inert = true;
        } else {
          if (el.getAttribute("data-lb-hidden") === "1") {
            el.removeAttribute("aria-hidden");
            el.removeAttribute("data-lb-hidden");
          }
          if ("inert" in HTMLElement.prototype) el.inert = false;
        }
      }
    }
  });

  /* =================================================================
     Module-level utilities (shared, no closure state needed)
     ================================================================= */

  function attachImageFallbacks(scope) {
    var imgs = scope.querySelectorAll(".gallery__img, .lightbox__img");
    Array.prototype.forEach.call(imgs, function (img) {
      // If already failed before this script ran, fix immediately.
      if (img.complete && img.naturalWidth === 0 && img.getAttribute("src")) {
        applyPlaceholder(img);
      }
      img.addEventListener("error", function () {
        applyPlaceholder(img);
      });
    });
  }

  function applyPlaceholder(img) {
    if (img.getAttribute("data-fallback-applied") === "1") return;
    img.setAttribute("data-fallback-applied", "1");
    img.src = PLACEHOLDER_SVG;
  }

  function lockScroll(on) {
    document.documentElement.classList.toggle("no-scroll", !!on);
    document.body.classList.toggle("no-scroll", !!on);
  }

  function prefersReducedMotion() {
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function transitionMs(el) {
    var v = window.getComputedStyle(el).transitionDuration || "0s";
    // Take the first listed duration.
    var first = v.split(",")[0].trim();
    if (first.indexOf("ms") > -1) return parseFloat(first);
    return parseFloat(first) * 1000;
  }
})();
