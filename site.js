/* =====================================================================
   Devine Builders — site.js  (SHARED, loaded on every page)
   Vanilla JS, defer-safe, no libraries, fully offline.

   Two progressive enhancements, both no-ops if their markup is absent:

   1) BRICKLAYING INTERACTIVE BACKGROUND
      A <canvas class="bg-canvas"> moved INSIDE the hero and positioned
      absolutely there (scoped to the hero box, NOT the whole viewport, so
      the rest of the page stays solid white and never flashes dark on fast
      scroll). It paints a dark "construction at dusk" running-bond brick
      wall. A blue "work light" follows the pointer; while the wall builds in it
      drifts on a slow Lissajous, then eases to a resting centre and the
      loop stops once nothing is moving. Brightens nearby bricks with a
      cool blue edge + subtle parallax. On first paint the wall "builds itself"
      bottom-up. Honours prefers-reduced-motion (single static frame, no
      rAF), pauses when the tab is hidden, and goes idle (rAF stops, CPU
      returns to ~0) when nothing is happening.

   2) ACCESSIBLE MOBILE HAMBURGER NAV
      Wires the <button class="nav-toggle"> in the shared header:
      aria-expanded sync, label swap, ESC + outside-click + link-click
      close, focus moved into the menu on open and back to the toggle on
      close, and an automatic reset to "closed" when the viewport grows
      to desktop.

   This file does NOT touch gallery.js or quote.js state. It only adds
   the .no-scroll class while the *menu* is open and removes it on close
   (the same class gallery.js uses) — and only on pages without a
   lightbox open, which never overlap in practice.
   ===================================================================== */

(function () {
  "use strict";

  /* ---- shared tiny utils ------------------------------------------- */

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

  ready(function () {
    initBrickBackground();
    initMobileNav();
    initConversionEnhancements();
    initBeforeAfter();
    initBackToTop();
    initHeaderScrollState();
    initScrollProgress();
    initStatCounters();
    initServiceFilter();
    initQuoteHelper();
  });

  /* =================================================================
     FEATURE 1 — Bricklaying interactive background
     ================================================================= */

  function initBrickBackground() {
    var canvas = document.querySelector("canvas.bg-canvas");

    /* Scope the wall to the HERO only. Confining a dark/animated layer to the
       hero box means the rest of the page is solid white and can never "flash"
       a dark background while scrolling quickly. EVERY page now carries a hero:
       the home hero on index, or a `.hero hero--inner` band at the top of the
       interior pages (services/gallery/quote/thank-you/404). A page with no
       `.hero` at all simply gets no wall (the canvas is removed below). */
    var hero = document.querySelector(".hero");
    if (!hero) {
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
      return;
    }

    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.className = "bg-canvas";
    }
    // Live INSIDE the hero so position:absolute / inset:0 maps to the hero box.
    if (canvas.parentNode !== hero) {
      hero.insertBefore(canvas, hero.firstChild);
    }
    canvas.setAttribute("aria-hidden", "true");
    canvas.tabIndex = -1;
    canvas.style.display = "block";

    var ctx = canvas.getContext("2d");
    if (!ctx) return; // No 2D context — bail gracefully, CSS bg remains.

    var reduce = prefersReducedMotion();

    /* ----- tunables ----- */
    var DPR = 1;                 // set per resize, capped at 2
    var W = 0, H = 0;            // CSS pixels
    var bricks = [];            // precomputed geometry + base colours
    var courseH = 36;           // brick height incl. mortar (set per resize)
    var LIGHT_R = 260;          // work-light radius (CSS px, set per resize)
    var backdropGrad = null;    // cached vertical backdrop gradient (per resize)
    var heroVisible = true;     // is the hero on screen? (gates drawing for perf)

    /* Pointer / work-light state. */
    var pointer = { x: 0, y: 0, has: false };
    var light = { x: 0, y: 0 }; // eased light position
    var drift = { t: Math.random() * 1000 };

    /* Animation/scheduling state. */
    var rafId = 0;
    var running = false;
    var buildStart = 0;
    var buildDur = reduce ? 0 : 1200; // ms, bottom-up reveal

    /* Brand colours (kept in sync with CSS tokens; literal here so the
       canvas works even if custom-prop lookup is unavailable). */
    var SLATE_BG_TOP = [12, 18, 33];   // ~ #0c1221 (just under --color-dark)
    var SLATE_BG_BOT = [7, 11, 20];    // deeper toward the floor
    var AMBER = [96, 165, 250];        // blue-400 work-light (--color-accent family)

    /* Palette of muted brick base colours: steel / Staffordshire-blue
       tones so it reads as a real, slightly weathered cool-toned wall
       rather than a candy grid. Values are deliberately dark. */
    var BRICK_TONES = [
      [38, 54, 84],    // steel blue
      [44, 62, 96],    // Staffordshire blue
      [52, 70, 104],   // lighter steel blue
      [40, 50, 70],    // dark blue-grey
      [58, 74, 102],   // cool slate-blue
      [34, 46, 72],    // deep navy-grey
      [48, 66, 96]     // mid blue-grey
    ];

    /* ---- helpers ---- */

    function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }

    function pickTone(seed) {
      return BRICK_TONES[Math.abs(seed) % BRICK_TONES.length];
    }

    // Deterministic pseudo-random from integer seed (stable per brick).
    function rnd(seed) {
      var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    }

    /* ---- geometry: build the running-bond wall once per resize ---- */

    function buildWall() {
      bricks.length = 0;

      // Scale brick width sensibly with viewport (60–110px), narrower on
      // small screens. Height keeps a bricky ~2.2:1 ratio.
      var small = W < 640;
      var targetW = clamp(W / (small ? 7 : 13), 60, 110);
      var brickW = targetW;
      courseH = clamp(brickW / 2.2, 26, 48);

      var mortar = clamp(brickW * 0.06, 3, 6); // gap between bricks
      var rows = Math.ceil(H / courseH) + 1;
      var cols = Math.ceil(W / brickW) + 2;

      // Cap total bricks on very large screens for performance.
      var MAX_BRICKS = small ? 420 : 1100;

      var count = 0;
      for (var r = 0; r < rows; r++) {
        // Running bond: offset alternate courses by half a brick.
        var offset = (r % 2 === 0) ? 0 : -brickW / 2;
        var y = r * courseH;
        for (var c = -1; c < cols; c++) {
          if (count >= MAX_BRICKS) break;
          var x = c * brickW + offset;
          if (x > W || x + brickW < 0) continue;

          var seed = r * 131 + (c + 7) * 17;
          var tone = pickTone(seed + (r % 2));
          // Per-brick lightness wobble so no two bricks match exactly.
          var lv = (rnd(seed) - 0.5) * 26;       // -13..+13
          var base = [
            clamp(tone[0] + lv, 0, 255),
            clamp(tone[1] + lv * 0.8, 0, 255),
            clamp(tone[2] + lv * 0.7, 0, 255)
          ];

          bricks.push({
            x: x,
            y: y,
            w: brickW - mortar,
            h: courseH - mortar,
            cx: x + brickW / 2,
            cy: y + courseH / 2,
            r: base[0], g: base[1], b: base[2],
            // Per-brick reveal delay for the bottom-up build (0..1).
            delay: 0, // filled below once H known
            row: r,
            // small static parallax weight so depth varies per brick
            depth: 0.4 + rnd(seed + 5) * 0.6
          });
          count++;
        }
        if (count >= MAX_BRICKS) break;
      }

      // Bottom-up reveal ordering: bottom rows start first.
      var maxY = H;
      for (var i = 0; i < bricks.length; i++) {
        var bk = bricks[i];
        // 0 at the very bottom → ~0.7 near the top, plus a little jitter.
        var frac = 1 - (bk.cy / maxY);
        bk.delay = clamp(frac * 0.72 + rnd(bk.row * 3.3) * 0.12, 0, 0.92);
      }

      LIGHT_R = clamp(Math.min(W, H) * 0.42, 180, 360);

      // The vertical backdrop gradient is fixed for a given height, so build
      // it once here (per resize) instead of allocating it every frame.
      backdropGrad = ctx.createLinearGradient(0, 0, 0, H);
      backdropGrad.addColorStop(0, "rgb(" + SLATE_BG_TOP.join(",") + ")");
      backdropGrad.addColorStop(1, "rgb(" + SLATE_BG_BOT.join(",") + ")");
    }

    /* ---- sizing ---- */

    function resize() {
      // Size to the HERO box, not the viewport (the canvas lives inside it).
      var rect = hero.getBoundingClientRect();
      W = Math.max(1, Math.round(rect.width));
      H = Math.max(1, Math.round(hero.offsetHeight || rect.height));
      DPR = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

      buildWall();

      // Keep the light centred until the pointer is first seen.
      if (!pointer.has) {
        pointer.x = light.x = W * 0.5;
        pointer.y = light.y = H * 0.42;
      }
    }

    /* ---- painting ---- */

    function paintBackdrop() {
      // Cached gradient (rebuilt per resize in buildWall); avoids a per-frame
      // allocation. Fall back to a flat fill if it hasn't been built yet.
      ctx.fillStyle = backdropGrad || ("rgb(" + SLATE_BG_BOT.join(",") + ")");
      ctx.fillRect(0, 0, W, H);

      // Mortar field: a slightly lighter slate behind the bricks so the
      // gaps read as mortar lines.
      ctx.fillStyle = "rgba(40, 48, 64, 0.55)";
      ctx.fillRect(0, 0, W, H);
    }

    // Draw one brick. `reveal` 0..1 fades+slides it in; `lit` 0..1 is the
    // work-light influence; px/py is a small parallax shift.
    function drawBrick(bk, reveal, lit, px, py) {
      if (reveal <= 0) return;

      var a = reveal;                  // opacity
      var slide = (1 - reveal) * 10;   // px, slides up into place

      var x = bk.x + px * bk.depth;
      var y = bk.y + py * bk.depth + slide;

      // Cool the brick toward the blue work-light as it hits it (additive
      // term biased toward the blue channel so lit bricks brighten cooler).
      var rr = bk.r + (AMBER[0] - bk.r) * 0.30 * lit + 10 * lit;
      var gg = bk.g + (AMBER[1] - bk.g) * 0.45 * lit + 26 * lit;
      var bb = bk.b + (AMBER[2] - bk.b) * 0.55 * lit + 40 * lit;
      rr = rr < 0 ? 0 : rr > 255 ? 255 : rr;
      gg = gg < 0 ? 0 : gg > 255 ? 255 : gg;
      bb = bb < 0 ? 0 : bb > 255 ? 255 : bb;

      ctx.globalAlpha = a;
      ctx.fillStyle = "rgb(" + (rr | 0) + "," + (gg | 0) + "," + (bb | 0) + ")";
      ctx.fillRect(x, y, bk.w, bk.h);

      // Subtle top highlight + bottom shade give the brick a bit of body.
      ctx.globalAlpha = a * (0.18 + 0.22 * lit);
      ctx.fillStyle = "rgba(226,236,255," + (0.5) + ")";
      ctx.fillRect(x, y, bk.w, Math.max(1, bk.h * 0.16));

      ctx.globalAlpha = a * 0.16;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x, y + bk.h - Math.max(1, bk.h * 0.16), bk.w, Math.max(1, bk.h * 0.16));

      // Cool blue mortar-edge glint when strongly lit (work-lamp glint).
      if (lit > 0.25) {
        ctx.globalAlpha = a * (lit - 0.25) * 0.9;
        ctx.lineWidth = 1;
        ctx.strokeStyle = "rgba(" + (AMBER[0] + 60) + "," + (AMBER[1] + 30) + "," + Math.min(255, AMBER[2] + 5) + ",0.9)";
        ctx.strokeRect(x + 0.5, y + 0.5, bk.w - 1, bk.h - 1);
      }

      ctx.globalAlpha = 1;
    }

    function frame(now) {
      rafId = 0;
      if (document.hidden) { running = false; return; }
      // Don't draw an off-screen hero; the IntersectionObserver resumes us.
      if (!heroVisible) { running = false; return; }

      // Reveal progress 0..1 across the whole build (computed early so the
      // idle drift can run while the wall is still building in).
      var t = 0;
      if (buildDur > 0) {
        t = clamp((now - buildStart) / buildDur, 0, 1);
      } else {
        t = 1;
      }
      var building = t < 1;

      // Ease the work-light toward the pointer (or, with no pointer, an idle
      // target). While the wall is building we let the light wander on a slow
      // Lissajous so the reveal feels alive; once the build finishes and the
      // pointer is absent we park the target at a fixed idle centre so the
      // light eases to rest and the rAF loop can genuinely settle (idle).
      var tx = pointer.x, ty = pointer.y;
      if (!pointer.has && !reduce) {
        if (building) {
          drift.t += 0.006;
          tx = W * (0.5 + 0.34 * Math.sin(drift.t));
          ty = H * (0.42 + 0.26 * Math.cos(drift.t * 0.8));
        } else {
          tx = W * 0.5;
          ty = H * 0.42;
        }
      }
      light.x += (tx - light.x) * 0.12;
      light.y += (ty - light.y) * 0.12;

      // Parallax: bricks lean slightly away from the light for depth.
      var pxBase = (light.x - W / 2) / W;   // -0.5..0.5
      var pyBase = (light.y - H / 2) / H;
      var PARA = 8; // max parallax px

      paintBackdrop();

      var R2 = LIGHT_R * LIGHT_R;
      for (var i = 0; i < bricks.length; i++) {
        var bk = bricks[i];

        // Per-brick reveal with its staggered delay (ease-out).
        var local = building
          ? clamp((t - bk.delay) / (1 - bk.delay || 1), 0, 1)
          : 1;
        var reveal = local <= 0 ? 0 : 1 - Math.pow(1 - local, 3);

        // Work-light influence (squared falloff, smooth).
        var dx = bk.cx - light.x;
        var dy = bk.cy - light.y;
        var d2 = dx * dx + dy * dy;
        var lit = 0;
        if (d2 < R2) {
          var f = 1 - d2 / R2;     // 1 at centre → 0 at edge
          lit = f * f;             // soften
        }

        var px = -pxBase * PARA;
        var py = -pyBase * PARA;
        drawBrick(bk, reveal, lit, px, py);
      }

      // Soft blue work-light glow over the wall.
      paintGlow();

      // Decide whether to keep animating. The light eases to rest at the
      // last (drift or pointer) target; once it is no longer building and no
      // longer moving, we stop scheduling so the loop genuinely idles.
      // Pointer / visibility handlers call schedule() to resume.
      var moving =
        Math.abs(light.x - tx) > 0.4 || Math.abs(light.y - ty) > 0.4;
      var alive = building || moving;

      if (alive) {
        schedule();
      } else {
        // Settle: stop scheduling. Pointer/visibility handlers resume us.
        running = false;
      }
    }

    function paintGlow() {
      var grd = ctx.createRadialGradient(
        light.x, light.y, 0,
        light.x, light.y, LIGHT_R
      );
      grd.addColorStop(0, "rgba(191, 219, 254, 0.32)");
      grd.addColorStop(0.4, "rgba(59, 130, 246, 0.18)");
      grd.addColorStop(1, "rgba(59, 130, 246, 0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(light.x, light.y, LIGHT_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    function schedule() {
      if (rafId || document.hidden) return;
      running = true;
      rafId = window.requestAnimationFrame(frame);
    }

    /* ---- static single-frame render (reduced motion) ---- */

    function renderStatic() {
      // Centre a faint static glow; no parallax, full reveal, mild light.
      light.x = W * 0.5;
      light.y = H * 0.4;
      paintBackdrop();
      var R2 = LIGHT_R * LIGHT_R;
      for (var i = 0; i < bricks.length; i++) {
        var bk = bricks[i];
        var dx = bk.cx - light.x, dy = bk.cy - light.y;
        var d2 = dx * dx + dy * dy;
        var lit = d2 < R2 ? (1 - d2 / R2) * (1 - d2 / R2) * 0.6 : 0;
        drawBrick(bk, 1, lit, 0, 0);
      }
      paintGlow();
    }

    /* ---- input ---- */

    // Map a viewport point into hero-local coords, CLAMPED to the hero box.
    // Clamping (instead of bailing) means the work-light keeps tracking the
    // cursor even when it's out over the white content below the hero — it
    // eases to the nearest edge, so the motion stays smooth and connected
    // instead of snapping back to an idle drift.
    function toLocal(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      var x = clientX - rect.left;
      var y = clientY - rect.top;
      if (x < 0) x = 0; else if (x > rect.width) x = rect.width;
      if (y < 0) y = 0; else if (y > rect.height) y = rect.height;
      return { x: x, y: y };
    }

    function onPointerMove(e) {
      var p = toLocal(e.clientX, e.clientY);
      if (!p) return;
      pointer.has = true;
      pointer.x = p.x;
      pointer.y = p.y;
      // Only spend frames while the hero is actually on screen.
      if (!reduce && heroVisible) schedule();
    }

    function onTouchMove(e) {
      if (!e.touches || !e.touches.length) return;
      var p = toLocal(e.touches[0].clientX, e.touches[0].clientY);
      if (!p) return;
      pointer.has = true;
      pointer.x = p.x;
      pointer.y = p.y;
      if (!reduce && heroVisible) schedule();
    }

    function onPointerLeave() {
      // Hand control back to the idle drift.
      pointer.has = false;
      if (!reduce) schedule();
    }

    /* ---- resize (debounced) ---- */

    var resizeTimer = 0;
    function onResize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        resize();
        if (reduce) {
          renderStatic();
        } else {
          schedule();
        }
      }, 150);
    }

    /* ---- visibility: pause when hidden, resume + rebuild clock ---- */

    function onVisibility() {
      if (document.hidden) {
        if (rafId) { window.cancelAnimationFrame(rafId); rafId = 0; }
        running = false;
      } else if (!reduce) {
        // Resume; if the build was mid-flight, let it finish from now.
        schedule();
      }
    }

    /* ---- boot ---- */

    resize();

    if (reduce) {
      renderStatic();
      // No rAF loop, no listeners that animate — just keep it crisp on
      // resize (single static repaint, already debounced above).
      window.addEventListener("resize", onResize);
      return;
    }

    buildStart = (window.performance && performance.now)
      ? performance.now()
      : Date.now();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchstart", onTouchMove, { passive: true });
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);

    // Pause the loop while the hero is scrolled out of view (cheap when the
    // visitor is reading the white content), resume it the moment it returns.
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        heroVisible = entries[0].isIntersecting;
        if (heroVisible) schedule();
      }, { threshold: 0 });
      io.observe(hero);
    }

    schedule(); // kick off the build + interactive loop
  }

  /* =================================================================
     FEATURE 2 — Accessible mobile hamburger nav
     ================================================================= */

  function initMobileNav() {
    var toggle = document.querySelector(".nav-toggle");
    var header = document.querySelector(".site-header");
    if (!toggle || !header) return;

    // The element that actually shows/hides is the <nav class="primary-nav">
    // (we toggle .is-open on it and the CSS open/closed states live there), so
    // that is what aria-controls points at. The <ul> inside it is still where
    // the focusable links live, resolved directly rather than via aria-controls.
    var nav = header.querySelector(".primary-nav");
    var list = nav ? nav.querySelector(".primary-nav__list") : null;
    if (!list || !nav) return;

    var DESKTOP_QUERY = "(min-width: 48em)"; // matches CSS breakpoint
    var mql = window.matchMedia ? window.matchMedia(DESKTOP_QUERY) : null;

    var LABEL_OPEN = "Open menu";
    var LABEL_CLOSE = "Close menu";

    var isOpen = false;

    function firstLink() {
      return list.querySelector("a, button");
    }

    function isDesktop() {
      return mql ? mql.matches : window.innerWidth >= 768;
    }

    // Only manage scroll-lock when no lightbox is currently open, so we
    // never fight gallery.js. (Lightbox + mobile menu never coexist, but
    // this keeps the contract airtight.)
    function lightboxOpen() {
      var lb = document.getElementById("lightbox");
      return !!(lb && !lb.hidden);
    }

    function lockScroll(on) {
      if (lightboxOpen()) return; // defer entirely to gallery.js
      document.documentElement.classList.toggle("no-scroll", !!on);
      document.body.classList.toggle("no-scroll", !!on);
    }

    function open() {
      if (isOpen || isDesktop()) return;
      isOpen = true;
      nav.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      toggle.setAttribute("aria-label", LABEL_CLOSE);
      lockScroll(true);

      // Move focus to the first menu item.
      var f = firstLink();
      if (f) f.focus();

      document.addEventListener("keydown", onKeydown, true);
      document.addEventListener("click", onDocClick, true);
    }

    function close(restoreFocus) {
      if (!isOpen) return;
      isOpen = false;
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", LABEL_OPEN);
      lockScroll(false);

      document.removeEventListener("keydown", onKeydown, true);
      document.removeEventListener("click", onDocClick, true);

      if (restoreFocus !== false) toggle.focus();
    }

    function onKeydown(e) {
      if (!isOpen) return;
      if (e.key === "Escape" || e.key === "Esc") {
        e.preventDefault();
        close(true);
      }
    }

    function onDocClick(e) {
      if (!isOpen) return;
      // Click/tap outside the header closes the menu.
      if (!header.contains(e.target)) {
        close(false);
      }
    }

    // Activating any link inside the panel closes it (let navigation run).
    list.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a") : null;
      if (a && list.contains(a)) {
        close(false);
      }
    });

    toggle.addEventListener("click", function () {
      if (isOpen) close(true);
      else open();
    });

    // Reset to a clean, closed desktop state when the viewport grows.
    function onBreakpoint() {
      if (isDesktop() && isOpen) {
        // Close without yanking focus around on a resize.
        isOpen = false;
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", LABEL_OPEN);
        lockScroll(false);
        document.removeEventListener("keydown", onKeydown, true);
        document.removeEventListener("click", onDocClick, true);
      }
    }

    if (mql) {
      if (mql.addEventListener) mql.addEventListener("change", onBreakpoint);
      else if (mql.addListener) mql.addListener(onBreakpoint); // legacy
    } else {
      window.addEventListener("resize", onBreakpoint);
    }
  }

  /* =================================================================
     FEATURE 3 — Conversion enhancements
       (a) scroll-reveal   (b) sticky mobile call bar
       (c) smooth in-page scroll
     Each part is independently guarded and degrades to a safe no-op
     when its prerequisites (markup / browser features) are absent.
     Reuses the IIFE-scope helpers `ready` and `prefersReducedMotion`.
     ================================================================= */

  function initConversionEnhancements() {
    initScrollReveal();
    initCallBar();
    initSmoothScroll();
  }

  /* ---- (a) scroll-reveal ------------------------------------------- *
   * No-JS safe and reduced-motion safe: the CSS only hides `.reveal`
   * once the root carries the `.js-reveal` flag class, which we add
   * here ONLY when JS runs AND motion is allowed. So no-JS users and
   * reduced-motion users always see fully-visible content.
   *
   * SITE-WIDE: on top of any `.reveal` sections authored in the HTML, we
   * programmatically tag the remaining top-level <main> content SECTIONS
   * (and, on pages whose <main> is itself a single section, its safe intro
   * block) with the SAME `.reveal` class, then hand them to the SAME
   * IntersectionObserver — so the whole site eases in on scroll without a
   * second, competing system. Auto-tagging is strictly opt-OUT: the hero,
   * header, footer, canvas, lightbox, call bar, back-to-top, skip-link and
   * the scroll sentinel are excluded, and any block that hosts a form, the
   * before/after slider or other critical interactive UI is left fully
   * visible and untouched. It is idempotent (never re-tags an element that
   * is already `.reveal` or sits inside one), CLS-safe (transform/opacity
   * only, via the shared CSS) and never hides content that is already in
   * the viewport on load (those are marked visible synchronously, so there
   * is no flash and nothing can get stuck hidden).                       */
  function initScrollReveal() {
    var canAnimate = !prefersReducedMotion();
    if (!canAnimate) return; // leave content visible; never add the flag.

    var hasIO = "IntersectionObserver" in window;

    // Only add the hidden-state flag + auto-tag extra sections when we can
    // actually observe them back into view. Without IntersectionObserver we
    // skip both, so nothing is ever hidden that we couldn't reveal again.
    if (hasIO) {
      document.documentElement.classList.add("js-reveal");
      autoTagReveal();
    }

    var nodes = document.querySelectorAll(".reveal");
    if (!nodes.length) return;

    var i;
    if (hasIO) {
      var io = new IntersectionObserver(
        function (entries, obs) {
          for (var e = 0; e < entries.length; e++) {
            var entry = entries[e];
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              obs.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
      );
      for (i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        // Anything already on screen at load reveals immediately (no flash,
        // never stuck at opacity:0); everything below the fold animates in.
        if (node.classList.contains("is-visible") || inViewportNow(node)) {
          node.classList.add("is-visible");
        } else {
          io.observe(node);
        }
      }
    } else {
      // No IntersectionObserver: just show everything, no animation. (We also
      // never added `js-reveal` above, so these were never hidden to begin
      // with — this is purely belt-and-braces.)
      for (i = 0; i < nodes.length; i++) nodes[i].classList.add("is-visible");
    }
  }

  /* Is the element's top edge already within (or above) the current viewport?
   * Used so above-the-fold reveals are shown synchronously and never flash. */
  function inViewportNow(el) {
    var r = el.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight || 0;
    // Mirror the observer's "-10% bottom" bias: count it visible if its top is
    // above 90% of the viewport height (and it isn't entirely above us).
    return r.top < vh * 0.9 && r.bottom > 0;
  }

  /* Programmatically extend the reveal to every eligible top-level <main>
   * content SECTION that the HTML didn't already tag. Reuses the existing
   * `.reveal` contract end-to-end — we only add the class; the shared CSS +
   * IntersectionObserver do the rest. Excludes all decorative/interactive
   * chrome and never touches the hero or anything inside an existing reveal. */
  function autoTagReveal() {
    var mains = document.querySelectorAll("main");
    if (!mains.length) return;

    for (var m = 0; m < mains.length; m++) {
      var main = mains[m];
      var sections = directChildSections(main);

      if (sections.length) {
        // Normal pages: tag each eligible top-level <section>.
        for (var s = 0; s < sections.length; s++) {
          tagIfEligible(sections[s]);
        }
      } else {
        // Single-section pages (e.g. the quote form, the 404 page) where
        // <main> IS the section. We must NEVER hide the form/critical block,
        // so we only reveal the safe intro/heading block(s) and leave the
        // rest (form, error actions, contact panel) permanently visible.
        // tagIfEligible still refuses any block that hosts a form/slider, and
        // anything already on screen reveals instantly (no flash), so these
        // small above-the-fold pages stay solid and usable either way.
        var heads = main.querySelectorAll(".section__head, .error-page");
        if (heads.length) {
          for (var h = 0; h < heads.length; h++) tagIfEligible(heads[h]);
        }
      }
    }
  }

  /* Direct <section> children of an element (no querySelector descendant
   * surprises — only the page's true top-level section blocks). */
  function directChildSections(parent) {
    var out = [];
    var kids = parent.children;
    for (var i = 0; i < kids.length; i++) {
      if (kids[i].tagName === "SECTION") out.push(kids[i]);
    }
    return out;
  }

  /* Add `.reveal` to a block IFF it is safe to animate. Idempotent and
   * conservative: bail on anything already revealed (or inside a reveal),
   * the hero, excluded chrome, or any block that hosts critical interactive
   * UI (a form, the before/after slider or the lightbox) which must always
   * stay fully visible and functional. */
  function tagIfEligible(el) {
    if (!el || el.nodeType !== 1) return;

    // Idempotent: already animated, or nested inside an existing reveal.
    if (el.classList.contains("reveal")) return;
    if (el.closest && el.closest(".reveal")) return;

    // The hero owns its own entrance — never auto-reveal it or its contents.
    if (el.classList.contains("hero")) return;
    if (el.closest && el.closest(".hero")) return;

    // Excluded chrome / decorative / floating UI. Bail if the candidate IS,
    // CONTAINS, or sits INSIDE any of these.
    var EXCLUDE = [
      ".site-header", ".site-footer", "header", "footer",
      "canvas.bg-canvas", ".lightbox", "#lightbox",
      ".call-bar", "#call-bar", "#to-top", ".skip-link",
      "#header-scroll-sentinel"
    ].join(",");
    if (el.matches && el.matches(EXCLUDE)) return;
    if (el.closest && el.closest(EXCLUDE)) return;
    if (el.querySelector && el.querySelector(EXCLUDE)) return;

    // Critical interactive UI must never be hidden behind a reveal. Reveal at
    // SECTION granularity only — if this block hosts a form or the
    // before/after slider, leave it permanently visible.
    if (el.querySelector && el.querySelector("form, [data-ba-slider]")) return;
    if (el.matches && el.matches("form, [data-ba-slider]")) return;

    el.classList.add("reveal");
  }

  /* ---- (b) sticky mobile call bar ---------------------------------- *
   * Injected into <body> on every page. Idempotent. Built with DOM
   * APIs (static strings only). Hidden via CSS while the mobile nav
   * is open, observed without coupling to initMobileNav internals.    */
  function initCallBar() {
    if (!document.body) return;
    if (document.getElementById("call-bar")) return; // idempotent

    var SVG_NS = "http://www.w3.org/2000/svg";

    function svg(paths) {
      var el = document.createElementNS(SVG_NS, "svg");
      el.setAttribute("viewBox", "0 0 24 24");
      el.setAttribute("fill", "none");
      el.setAttribute("stroke", "currentColor");
      el.setAttribute("stroke-width", "2");
      el.setAttribute("stroke-linecap", "round");
      el.setAttribute("stroke-linejoin", "round");
      el.setAttribute("aria-hidden", "true");
      for (var p = 0; p < paths.length; p++) {
        var path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", paths[p]);
        el.appendChild(path);
      }
      return el;
    }

    function btn(modifier, href, ariaLabel, svgEl, text) {
      var a = document.createElement("a");
      a.className = "call-bar__btn call-bar__btn--" + modifier;
      a.setAttribute("href", href);
      a.setAttribute("aria-label", ariaLabel);
      a.appendChild(svgEl);
      var span = document.createElement("span");
      span.textContent = text;
      a.appendChild(span);
      return a;
    }

    var bar = document.createElement("div");
    bar.className = "call-bar";
    bar.id = "call-bar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "Quick contact");

    var phoneSvg = svg([
      "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"
    ]);
    bar.appendChild(
      btn("call", "tel:+447956547040", "Call Phil on +44 7956 547040", phoneSvg, "Call Phil")
    );

    // On the quote page itself the 'Get a quote' button would link to the
    // current page — a dead, redundant control. Offer a genuine alternative
    // action (email Phil) instead, while keeping the two-up grid intact.
    var onQuote = !!document.getElementById("quote-form");
    if (onQuote) {
      var mailSvg = svg([
        "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
        "M22 7 12 13 2 7"
      ]);
      bar.appendChild(
        btn("quote", "mailto:phildevine24@icloud.com", "Email Phil at phildevine24@icloud.com", mailSvg, "Email Phil")
      );
    } else {
      var quoteSvg = svg([
        "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
        "M14 2v6h6",
        "M9 13h6",
        "M9 17h4"
      ]);
      bar.appendChild(
        btn("quote", "quote.html", "Get a quote — free, no obligation", quoteSvg, "Get a quote")
      );
    }

    // Append as the LAST child of <body> so it is a sibling AFTER
    // #lightbox where present; gallery.js's setBackgroundHidden iterates
    // body.children and will inert/aria-hide it when the lightbox opens.
    document.body.appendChild(bar);
    document.body.classList.add("has-call-bar");

    // Hide while the mobile nav menu is open, without coupling to
    // initMobileNav internals — observe the nav's class list.
    var nav = document.querySelector(".primary-nav");
    if (nav && "MutationObserver" in window) {
      var mo = new MutationObserver(function () {
        bar.classList.toggle("is-hidden", nav.classList.contains("is-open"));
      });
      mo.observe(nav, { attributes: true, attributeFilter: ["class"] });
    }
  }

  /* ---- (c) smooth scroll for in-page anchors ----------------------- *
   * Optional; reduced-motion safe. The global CSS already sets
   * scroll-behavior:smooth (and resets it under reduced motion), so
   * this only adds focus management for keyboard users.               */
  function initSmoothScroll() {
    if (prefersReducedMotion()) return;

    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!a) return;

      var id = a.getAttribute("href").slice(1);
      if (!id) return;

      var target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });

      // Focus management for keyboard users. Only add a temporary tabindex
      // when the target isn't already focusable, and remove it again on blur
      // so we don't leave a lingering focus target in the DOM.
      var hadTabindex = target.hasAttribute("tabindex");
      if (!hadTabindex) {
        target.setAttribute("tabindex", "-1");
        target.addEventListener("blur", function onBlur() {
          target.removeAttribute("tabindex");
          target.removeEventListener("blur", onBlur);
        });
      }
      target.focus({ preventScroll: true });
    });
  }

  /* =================================================================
     FEATURE 4 — Before/after comparison slider (gallery only)

     Progressive enhancement over a fully no-JS-safe section: both the
     BEFORE and AFTER photos are always rendered and labelled, and the
     control is a native <input type="range">. With JS, dragging the
     range clips how much of the AFTER image is revealed over the BEFORE
     image by driving a single CSS custom property, --ba-pos, that the
     CSS reads for BOTH the clip wrapper and the divider position.

     A native range gives pointer-drag, touch-drag AND keyboard
     (arrows / Home / End / PageUp-Down) for free, so no pointer/touch
     listeners are needed. Nothing animates here (a 1:1 reveal), so no
     reduced-motion guard is required. Scoped per [data-ba-slider]:
     multiple sliders are independent, no globals are added, and the
     whole feature is a no-op when no [data-ba-slider] exists (so the
     call is safe to register on every page).
     ================================================================= */

  function initBeforeAfter() {
    var sliders = document.querySelectorAll("[data-ba-slider]");
    if (!sliders.length) return; // no-op on pages without the section

    for (var i = 0; i < sliders.length; i++) {
      setup(sliders[i]);
    }

    function setup(root) {
      var range = root.querySelector("[data-ba-range]");
      if (!range) return; // markup contract not met -> leave static (no-JS-safe view)

      // Progressive enhancement flag (lets CSS know JS clipping is active, if needed).
      root.setAttribute("data-ba-ready", "true");

      function apply() {
        var v = parseFloat(range.value);
        if (isNaN(v)) v = 50;
        if (v < 0) v = 0; else if (v > 100) v = 100;
        // Drive the single CSS custom property the CSS reads for BOTH the
        // clip wrapper width/clip-path AND the divider position.
        root.style.setProperty("--ba-pos", v + "%");
      }

      // 'input' fires continuously while dragging (pointer) and on every
      // arrow-key step (keyboard) — covers mouse, touch and keyboard for free.
      range.addEventListener("input", apply, { passive: true });
      // 'change' as a belt-and-braces sync (some old browsers).
      range.addEventListener("change", apply, { passive: true });

      apply(); // initialise from the markup's value (50)
    }
  }

  /* =================================================================
     FEATURE 5 — "Back to top" button (all pages)

     A self-contained injected floating button that appears once the
     visitor scrolls down and returns them to the top. Pure progressive
     enhancement: needs no markup or styles.css edit (styles injected
     once), idempotent, keyboard-accessible, reduced-motion safe, sits
     clear of the sticky mobile call bar, and hides while the mobile nav
     menu is open. No-JS users simply never see it.
     ================================================================= */
  function initBackToTop() {
    if (!document.body) return;
    if (document.getElementById("to-top")) return; // idempotent

    // Inject styles once (keeps this feature fully self-contained in site.js).
    if (!document.getElementById("to-top-styles")) {
      var style = document.createElement("style");
      style.id = "to-top-styles";
      style.textContent = [
        ".to-top{position:fixed;right:1rem;bottom:1rem;z-index:85;",
        "display:inline-flex;align-items:center;justify-content:center;",
        "width:2.875rem;height:2.875rem;padding:0;border:0;border-radius:999px;",
        "background:var(--color-accent-dark,#1d4ed8);color:#fff;cursor:pointer;",
        "box-shadow:0 6px 16px rgba(15,23,42,.28);",
        "opacity:0;visibility:hidden;transform:translateY(8px);",
        "transition:opacity .2s ease,transform .2s ease,visibility .2s ease,background .16s ease;}",
        ".to-top:hover{background:var(--color-accent-darker,#1e40af);}",
        ".to-top:focus-visible{outline:3px solid var(--color-focus,#1e3a8a);outline-offset:2px;}",
        ".to-top.is-visible{opacity:1;visibility:visible;transform:translateY(0);}",
        ".to-top.is-hidden{opacity:0 !important;visibility:hidden !important;}",
        ".to-top svg{width:1.25rem;height:1.25rem;display:block;}",
        "@media (max-width:47.99em){.to-top{bottom:calc(4.75rem + env(safe-area-inset-bottom,0px));}}",
        "@media (prefers-reduced-motion:reduce){.to-top{transition:none;}}"
      ].join("");
      (document.head || document.body).appendChild(style);
    }

    var btn = document.createElement("button");
    btn.type = "button";
    btn.id = "to-top";
    btn.className = "to-top";
    btn.setAttribute("aria-label", "Back to top");

    var SVG_NS = "http://www.w3.org/2000/svg";
    var icon = document.createElementNS(SVG_NS, "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("fill", "none");
    icon.setAttribute("stroke", "currentColor");
    icon.setAttribute("stroke-width", "2.5");
    icon.setAttribute("stroke-linecap", "round");
    icon.setAttribute("stroke-linejoin", "round");
    icon.setAttribute("aria-hidden", "true");
    var path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", "M12 19V5M5 12l7-7 7 7");
    icon.appendChild(path);
    btn.appendChild(icon);
    document.body.appendChild(btn);

    var SHOW_AT = 600; // px scrolled before the button appears

    function onScroll() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      btn.classList.toggle("is-visible", y > SHOW_AT);
    }

    btn.addEventListener("click", function () {
      var reduce = prefersReducedMotion();
      window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      // Send focus to the top of the page for keyboard users (the brand link).
      // Programmatic focus won't show a ring for mouse users (no :focus-visible).
      var top = document.querySelector(".brand");
      if (top && typeof top.focus === "function") top.focus({ preventScroll: true });
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // set initial state

    // Hide while the mobile nav menu is open (mirrors the call-bar behaviour).
    var nav = document.querySelector(".primary-nav");
    if (nav && "MutationObserver" in window) {
      var mo = new MutationObserver(function () {
        btn.classList.toggle("is-hidden", nav.classList.contains("is-open"));
      });
      mo.observe(nav, { attributes: true, attributeFilter: ["class"] });
    }
  }

  /* =================================================================
     FEATURE 6 — Scroll-aware header (all pages)

     Toggles ".is-scrolled" on the sticky ".site-header" once the page is
     scrolled down off the very top, and removes it again on return to the
     top — the CSS uses that state to make the bar a touch more compact with
     a crisper hairline/shadow while staying solid white and legible.

     Done with an IntersectionObserver watching a 1px sentinel inserted at
     the very top of <body>, NOT a scroll-event loop, so it costs nothing
     while scrolling. The sentinel is visually hidden and aria-hidden, so it
     adds no visible box, no layout shift, and nothing for assistive tech.

     Fully degrade-safe: no header → no-op; no IntersectionObserver → no-op
     (the header simply keeps its default, un-scrolled state). Idempotent.
     ================================================================= */
  function initHeaderScrollState() {
    var header = document.querySelector(".site-header");
    if (!header) return; // pages without the shared header: nothing to do.
    if (!("IntersectionObserver" in window)) return; // old browser: stay default.
    if (!document.body) return;
    if (document.getElementById("header-scroll-sentinel")) return; // idempotent.

    // A zero-impact marker at the very top of the page. When it scrolls out
    // of view the page is no longer at the top; when it's back in view we're
    // at (or near) the top again. 1px tall, visually hidden and aria-hidden
    // so it never paints, never shifts layout, and never reaches AT.
    var sentinel = document.createElement("div");
    sentinel.id = "header-scroll-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.style.position = "absolute";
    sentinel.style.top = "0";
    sentinel.style.left = "0";
    sentinel.style.width = "1px";
    sentinel.style.height = "1px";
    sentinel.style.pointerEvents = "none";
    document.body.insertBefore(sentinel, document.body.firstChild);

    var io = new IntersectionObserver(function (entries) {
      // Sentinel OUT of view → scrolled down → compact state on.
      // Sentinel back IN view → at the top → compact state off.
      header.classList.toggle("is-scrolled", !entries[0].isIntersecting);
    }, { threshold: 0 });

    io.observe(sentinel);
  }

  /* =================================================================
     FEATURE — Scroll progress bar (all pages)
     A 3px accent bar at the very top that tracks reading progress.
     Injected here so no per-page markup is needed; rAF-throttled.
     ================================================================= */
  function initScrollProgress() {
    var bar = document.createElement("div");
    bar.className = "scroll-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);

    var ticking = false;
    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - doc.clientHeight;
      var y = window.pageYOffset || doc.scrollTop || 0;
      var p = max > 0 ? y / max : 0;
      if (p < 0) p = 0; else if (p > 1) p = 1;
      bar.style.transform = "scaleX(" + p + ")";
      ticking = false;
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* =================================================================
     FEATURE — Animated stat count-up (home "About" stats)
     Counts each .stat__num up from 0 when scrolled into view. Only
     touches pure-integer values (e.g. "8", "100%") and leaves things
     like "1:1" alone. Honours reduced-motion / no-IntersectionObserver
     by leaving the real values untouched (no reset, no flash).
     ================================================================= */
  function initStatCounters() {
    var nums = document.querySelectorAll(".stat__num");
    if (!nums.length) return;
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) return;

    var items = [];
    for (var i = 0; i < nums.length; i++) {
      var raw = nums[i].textContent.trim();
      var m = raw.match(/^(\d+)(\D*)$/);     // integer with optional suffix (e.g. %)
      if (!m) continue;                       // skip non-numeric like "1:1"
      items.push({ el: nums[i], target: parseInt(m[1], 10), suffix: m[2], raw: raw });
    }
    if (!items.length) return;

    function find(el) {
      for (var j = 0; j < items.length; j++) { if (items[j].el === el) return items[j]; }
      return null;
    }
    function animate(item) {
      var start = null, dur = 1100;
      function step(ts) {
        if (start === null) start = ts;
        var t = (ts - start) / dur;
        if (t > 1) t = 1;
        var eased = 1 - Math.pow(1 - t, 3);   // ease-out cubic
        item.el.textContent = Math.round(eased * item.target) + item.suffix;
        if (t < 1) requestAnimationFrame(step);
        else item.el.textContent = item.raw;  // land on the exact original text
      }
      requestAnimationFrame(step);
    }

    var io = new IntersectionObserver(function (entries) {
      for (var k = 0; k < entries.length; k++) {
        if (!entries[k].isIntersecting) continue;
        var item = find(entries[k].target);
        io.unobserve(entries[k].target);
        if (item) animate(item);
      }
    }, { threshold: 0.6 });

    for (var n = 0; n < items.length; n++) {
      items[n].el.textContent = "0" + items[n].suffix;   // reset just before it reveals
      io.observe(items[n].el);
    }
  }

  /* =================================================================
     FEATURE — Services live filter (services.html capabilities list)
     Type to filter the capability cards by title OR any listed
     sub-service. No-op on pages without the filter input. Shows a live
     count and a friendly empty state. Esc clears.
     ================================================================= */
  function initServiceFilter() {
    var input = document.getElementById("service-filter");
    var grid = document.getElementById("capabilities-grid");
    if (!input || !grid) return;
    var countEl = document.getElementById("service-filter-count");
    var emptyEl = document.getElementById("services-empty");

    var cardEls = grid.querySelectorAll(".service-card");
    var data = [];
    for (var i = 0; i < cardEls.length; i++) {
      data.push({ el: cardEls[i], text: (cardEls[i].textContent || "").toLowerCase() });
    }
    var total = data.length;

    function apply() {
      var q = input.value.replace(/\s+/g, " ").trim().toLowerCase();
      var shown = 0;
      for (var j = 0; j < data.length; j++) {
        var match = !q || data[j].text.indexOf(q) !== -1;
        data[j].el.hidden = !match;
        if (match) shown++;
      }
      if (emptyEl) emptyEl.hidden = (shown !== 0);
      if (countEl) countEl.textContent = q ? ("Showing " + shown + " of " + total) : "";
    }

    input.addEventListener("input", apply);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape" || e.keyCode === 27) { input.value = ""; apply(); }
    });
    apply();
  }

  /* =================================================================
     FEATURE — Quote-form smart helper (quote.html)
     When a project type is chosen, show a short, honest tip on what
     helps Phil quote it accurately. No prices, no commitments.
     ================================================================= */
  function initQuoteHelper() {
    var select = document.getElementById("project-type");
    var tip = document.getElementById("project-type-tip");
    if (!select || !tip) return;

    var tips = {
      "Extension": "A rough idea of the size and how you'll use the new space helps Phil scope it — photos or any plans are a bonus.",
      "Renovation": "Tell us which rooms and roughly what you'd like done; photos of the current space help Phil quote accurately.",
      "Brickwork & Masonry": "A photo of the wall or area and rough measurements help Phil price new brickwork or repairs.",
      "Groundworks": "Let us know the site access and roughly the area involved — photos help with drainage, foundations or concrete work.",
      "Roofing": "For a repair, a photo of the issue (from the ground is fine) really helps; for a new roof, the rough size and type.",
      "Driveway / Patio": "The rough area and your preferred finish — block paving, resin, tarmac or concrete — help Phil quote.",
      "Landscaping": "Describe the space and what you'd like (lawn, decking, fencing, walls); photos of the garden help.",
      "Property Maintenance": "A quick description of the job and a photo of the problem help Phil tell you what's needed.",
      "Other / Not sure": "No problem — just describe what you're after and Phil will point you in the right direction."
    };

    function update() {
      var msg = tips[select.value];
      if (msg) { tip.textContent = msg; tip.hidden = false; }
      else { tip.hidden = true; tip.textContent = ""; }
    }
    select.addEventListener("change", update);
    update();   // in case the browser restored a previous selection
  }
})();
