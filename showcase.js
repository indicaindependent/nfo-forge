/*!
 * NFO Forge 2.0 leaf showcase. Composes the painted-symbol cannabis leaf, a three-letter banner and a frame
 * into one 80-column piece of pure keyboard ASCII. Pure function, no DOM, no files: the page and the Node
 * build script call the same code, so what you see is what the build produces.
 * Licence: MIT.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./painter.js"), require("./paint-leaf.js"), require("./fonts.js"));
  else root.NFOShowcase = factory(root.NFOPainter, root.NFOPaintLeaf, root.NFOFonts);
})(typeof self !== "undefined" ? self : this, function (P, L, F) {
  "use strict";
  var W = 80, COLS = 76, STEM = 4;
  var DEFAULTS = { title: "INDICA INDEPENDENT MEDIA", letters: "IIM", tagline: "100% CREATIVE CLARITY", footer: "made with NFO Forge 2.0  ::  fork it, paint your own", leafRows: 44, seed: 7 };

  function center(s, w) { var l = Math.floor((w - s.length) / 2); return " ".repeat(l) + s + " ".repeat(w - s.length - l); }
  // The frame is fixed at 80 columns. Anything that would not fit is cut, never allowed to widen a row.
  function fit(s, w) { s = String(s == null ? "" : s); return s.length > w ? s.slice(0, w) : s; }
  function keyboardOnly(s) { return String(s).replace(/[^\x20-\x7e]/g, "?"); }

  // opts: { title, letters (1-5 chars, A-Z 0-9), tagline, footer, leafRows (24..60), seed }
  function compose(opts) {
    var o = {}, k;
    for (k in DEFAULTS) o[k] = opts && opts[k] != null && opts[k] !== "" ? opts[k] : DEFAULTS[k];
    o.leafRows = Math.max(24, Math.min(60, parseInt(o.leafRows, 10) || DEFAULTS.leafRows));
    var title = keyboardOnly(fit("~ " + o.title + " ~", W - 4)), tagline = keyboardOnly(fit(o.tagline, W - 4)), footer = keyboardOnly(fit(o.footer, W - 4));

    var leaf = P.paint(L.toneMap(COLS, o.leafRows), { set: "punct", seed: +o.seed });
    // trim fully blank rows at the top and bottom of the leaf so no dead space is left
    var a = 0, b = leaf.length;
    while (a < b && /^ *$/.test(leaf[a])) a++;
    while (b > a && /^ *$/.test(leaf[b - 1])) b--;
    // a leaf has a short petiole: keep the stem to at most STEM rows below the last row where the blade is wide
    var wideEnough = function (r) { return r.replace(/ /g, "").length >= 6; };
    var lastBlade = b - 1; while (lastBlade > a && !wideEnough(leaf[lastBlade])) lastBlade--;
    b = Math.min(b, lastBlade + 1 + STEM);
    var body = leaf.slice(a, b);

    var word = F.render(String(o.letters).toUpperCase().slice(0, 5), "shadow");
    var ox = Math.max(0, Math.floor((COLS - word.width) / 2));
    var third = word.width / 3;                                    // per-letter symbol choice follows the letter's third of the banner
    var heavyFor = function (X, Y) { var letter = X < ox + third ? 0 : X < ox + 2 * third ? 1 : 2; return P.hash(X, Y, 11) < 0.82 ? "#@#"[letter] : "&$%"[letter]; };
    var banner = word.lines.map(function (ln, y) {
      var row = " ".repeat(COLS).split("");
      Array.from(ln).forEach(function (ch, x) {
        var X = ox + x; if (X >= COLS) return;
        if (ch === "\u2588") row[X] = heavyFor(X, y); else if (ch === "\u2593") row[X] = ":.'"[Math.floor(P.hash(X, y, 9) * 3)];
      });
      return row.join("");
    });

    var out = [];
    out.push("." + "-".repeat(W - 2) + ".");
    out.push("|" + center(title, W - 2) + "|");
    out.push("+" + "=".repeat(W - 2) + "+");
    body.forEach(function (r) { out.push("| " + r + " |"); });
    out.push("| " + " ".repeat(COLS) + " |");
    banner.forEach(function (r) { out.push("| " + r + " |"); });
    out.push("| " + " ".repeat(COLS) + " |");
    out.push("|" + center(tagline, W - 2) + "|");
    out.push("+" + "=".repeat(W - 2) + "+");
    out.push("|" + center(footer, W - 2) + "|");
    out.push("'" + "-".repeat(W - 2) + "'");
    return { lines: out, cols: W, rows: out.length, leafRows: body.length, missing: word.missing || [] };
  }
  return { compose: compose, DEFAULTS: DEFAULTS, WIDTH: W };
});
