/*!
 * NFO Forge 2.0 symbol painter. Builds a picture from ordinary keyboard symbols, in the hand-painted
 * scene style: for each cell it picks, from all symbols whose measured ink density is close to the wanted
 * tone, one chosen by a deterministic hash of the cell position. Neighbouring cells therefore vary, which
 * gives the grainy painted texture instead of a banded ramp.
 *
 * DENSITY is the measured ink fraction of each glyph (see ascii-density.json), not a remembered ordering.
 * Licence: MIT.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./ascii-density.json"));
  else root.NFOPainter = factory(root.NFO_DENSITY);
})(typeof self !== "undefined" ? self : this, function (DENSITY) {
  "use strict";
  // Sets of symbols the painter may use. "classic" is the symbols scene artists leaned on.
  var SETS = {
    classic: "`.-',:\";~^_!*\\/()|+<>?=[]{}1ilrtfjcvxzsunoaeyIYTLJCFVwkhXZS234569AUPGKbdpqmOHDQREgW8#@NMB%&$0",
    punct:   "`.-',:\";~^_!*\\/()|+<>?=[]{}%&$#@",
    letters: "`.-',:ilrtfjcvxzsunoaeyIYTLJCFVwkhXZSAUPGKbdpqmOHDQREgWNMB",
    mixed:   "`.-',:\";~^_!*\\/()|+<>?=[]{}%&$#@0123456789"
  };

  function hash(x, y, seed) {
    var h = (x * 374761393 + y * 668265263 + (seed || 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }

  function build(setName, tone) {
    // tone resolution: 64 levels, each holds the candidate symbols within `tol` of that density
    var chars = (SETS[setName] || SETS.classic).split("").filter(function (c, i, a) { return a.indexOf(c) === i && DENSITY[c] != null; });
    var lo = Infinity, hi = -Infinity;
    chars.forEach(function (c) { if (DENSITY[c] < lo) lo = DENSITY[c]; if (DENSITY[c] > hi) hi = DENSITY[c]; });
    return { chars: chars, lo: lo, hi: hi };
  }

  // tone: 0 (blank) .. 1 (densest). Returns a symbol. tol: how wide a band of "near equal" densities to draw from.
  function pick(pal, tone, x, y, opts) {
    opts = opts || {};
    if (tone <= (opts.blank != null ? opts.blank : 0.04)) return " ";
    var target = pal.lo + Math.min(1, tone) * (pal.hi - pal.lo);
    // Start from a narrow band of near-equal densities, then widen until at least `minVariety` symbols qualify.
    // Without this a gap in the symbol set leaves one candidate and the area prints as a flat run of one character.
    var tol = opts.tolerance != null ? opts.tolerance : 0.022, minVariety = opts.minVariety != null ? opts.minVariety : 4, cands = [];
    var byDist = pal.chars.map(function (c) { return [c, Math.abs(DENSITY[c] - target)]; }).sort(function (a, b) { return a[1] - b[1]; });
    for (var i = 0; i < byDist.length; i++) {
      if (byDist[i][1] <= tol || cands.length < minVariety) cands.push(byDist[i][0]);
      else break;
    }
    return cands[Math.floor(hash(x, y, opts.seed) * cands.length) % cands.length];
  }

  // Paint a tone grid (rows of 0..1 numbers) into lines of symbols.
  function paint(tones, opts) {
    opts = opts || {};
    var pal = build(opts.set || "classic"), lines = [];
    for (var y = 0; y < tones.length; y++) {
      var s = "";
      for (var x = 0; x < tones[y].length; x++) s += pick(pal, tones[y][x], x, y, opts);
      lines.push(s);
    }
    return lines;
  }
  return { paint: paint, pick: pick, build: build, SETS: SETS, DENSITY: DENSITY, hash: hash };
});
