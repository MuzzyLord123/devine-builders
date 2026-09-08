/* =====================================================================
   Devine Builders — build.js

   The site is plain static files with no build step. This script is the
   one exception: it bakes the /admin/ access key into the deployment so
   the key does NOT have to live in this public repo.

   Vercel runs it via the "buildCommand" in vercel.json. Set ONE of these
   Environment Variables in the Vercel project (Settings -> Environment
   Variables), for the Production and Preview environments:

     ADMIN_KEY        the key Phil actually types, in plain text.
                      This script hashes it; the plaintext never leaves
                      Vercel and is never written into the deployment.

     ADMIN_KEY_HASH   a SHA-256 hex digest you generated yourself, if you
                      would rather not put the plaintext key into Vercel
                      at all. Takes precedence over ADMIN_KEY.

   Output: admin/admin-key.js, which sets window.__DB_ADMIN_KEY_HASH.
   admin.js reads that and falls back to its built-in hash when it is
   absent, so a build with NEITHER variable set is safe — the panel keeps
   working with the key it already had, and this script says so loudly.

   Run it locally the same way:   node build.js
   (but do NOT commit an admin/admin-key.js containing a real hash — the
   committed copy is deliberately empty.)
   ===================================================================== */

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const OUT = path.join(__dirname, "admin", "admin-key.js");
const HEX64 = /^[0-9a-f]{64}$/;

function resolveHash() {
  const rawHash = (process.env.ADMIN_KEY_HASH || "").trim().toLowerCase();
  if (rawHash) {
    if (!HEX64.test(rawHash)) {
      throw new Error(
        "ADMIN_KEY_HASH is set but is not a 64-character SHA-256 hex digest. " +
        "Got " + rawHash.length + " characters. Fix it or unset it."
      );
    }
    return { hash: rawHash, source: "ADMIN_KEY_HASH" };
  }

  const key = process.env.ADMIN_KEY || "";
  if (key) {
    if (key.length < 8) {
      throw new Error("ADMIN_KEY must be at least 8 characters. Pick a longer key.");
    }
    return {
      hash: crypto.createHash("sha256").update(key, "utf8").digest("hex"),
      source: "ADMIN_KEY"
    };
  }

  return { hash: "", source: null };
}

function write(hash, source) {
  const banner =
    "/* GENERATED AT DEPLOY TIME BY build.js — DO NOT EDIT, DO NOT COMMIT A REAL HASH.\n" +
    "   The copy committed to the repo is deliberately empty; Vercel overwrites it\n" +
    "   from the ADMIN_KEY / ADMIN_KEY_HASH environment variable at build time.\n" +
    "   With no hash here, admin.js falls back to its own built-in key. */\n";

  const body = hash
    ? 'window.__DB_ADMIN_KEY_HASH = "' + hash + '";\n'
    : "/* no key injected — admin.js uses its built-in fallback */\n";

  fs.writeFileSync(OUT, banner + body, "utf8");

  if (hash) {
    console.log("build.js: admin key injected from " + source + " (sha256 " + hash.slice(0, 8) + "…).");
  } else {
    console.warn(
      "build.js: WARNING — neither ADMIN_KEY nor ADMIN_KEY_HASH is set, so /admin/ " +
      "will keep using the built-in key committed in admin/admin.js. Set one of " +
      "them in the Vercel project's Environment Variables to take the key out of " +
      "the public repo."
    );
  }
}

try {
  const { hash, source } = resolveHash();
  write(hash, source);
} catch (err) {
  console.error("build.js: " + err.message);
  process.exit(1);
}
