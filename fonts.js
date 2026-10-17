/*!
 * NFO Forge 2.0 lettering. Original designs, drawn for this project. Zero dependencies.
 *
 * Each style is generated from a small stroke definition (a 5x5 or 7x7 dot-matrix of 0/1) and
 * then DRESSED: solid, outline, shadow, or gradient fill. Dot-matrix source keeps every glyph
 * the same height and lets the tests check them mechanically.
 *
 * Licence: MIT.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NFOFonts = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // 5 wide x 7 tall dot matrix. Rows are strings of 0/1. One definition per character.
  var M = {
    A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    G: ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
    H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
    "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
    ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
    "/": ["00001", "00001", "00010", "00100", "01000", "10000", "10000"],
    "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
    "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
    "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
    " ": ["000", "000", "000", "000", "000", "000", "000"]
  };

  // Strip a glyph's width to its ink so letters pack tightly: most are 5 wide; space is 3.
  var STYLES = {
    // solid: every dot is a full block, one blank column between letters
    solid:   { gap: 1, cell: 1 },
    // chunky: every dot is two columns wide, so letters read as bold and wide
    chunky:  { gap: 2, cell: 2 },
    // slab: half-block rendering that doubles vertical resolution (7 dots -> 4 rows)
    slab:    { gap: 1, cell: 1, half: true },
    // bold: 2-dot strokes, 14 rows tall, for big banners
    bold:    { gap: 1, cell: 1, bold: true },
    // shadow: bold letters with a dark drop shadow down and to the right
    shadow:  { gap: 1, cell: 1, bold: true, shadow: true },
    // outline: a one-dot frame around each letter, the letter itself left hollow
    outline: { gap: 2, cell: 1, outline: true }
  };

  function glyph(ch) { return M[ch] || M[ch.toUpperCase()] || null; }
  function canRender(text) { for (var i = 0; i < text.length; i++) if (!glyph(text.charAt(i))) return false; return true; }
  function missing(text) { var m = []; for (var i = 0; i < text.length; i++) if (!glyph(text.charAt(i)) && m.indexOf(text.charAt(i)) < 0) m.push(text.charAt(i)); return m; }

  // Thicken a bitmap 2x in both directions, then add a one-dot border of padding so a shadow or
  // outline has room. Strokes become 2 dots thick, which is what the outline and shadow styles need.
  function embolden(bm) {
    var out = [];
    bm.forEach(function (row) {
      var wide = [];
      row.forEach(function (v) { wide.push(v, v); });
      out.push(wide, wide.slice());
    });
    return out;
  }

  // Build the bitmap for a string: array of rows, each an array of 0/1, with a 1-dot gap between letters.
  function bitmap(text, gapDots) {
    var rows = [[], [], [], [], [], [], []];
    for (var i = 0; i < text.length; i++) {
      var g = glyph(text.charAt(i));
      for (var r = 0; r < 7; r++) {
        for (var c = 0; c < g[r].length; c++) rows[r].push(g[r].charAt(c) === "1" ? 1 : 0);
        if (i < text.length - 1) for (var k = 0; k < gapDots; k++) rows[r].push(0);
      }
    }
    return rows;
  }

  var FULL = "\u2588", UP = "\u2580", LO = "\u2584", SHADE = "\u2593", LIGHT = "\u2591";

  // Render `text` in `style`. Returns {lines, width, height, missing}. Unknown characters are
  // reported and the call returns lines: null, so a caller must handle it and nothing is dropped silently.
  function render(text, style) {
    text = String(text == null ? "" : text);
    var s = STYLES[style] || STYLES.solid;
    var miss = missing(text);
    if (miss.length) return { lines: null, missing: miss, width: 0, height: 0 };
    var bm = bitmap(text, s.gap);
    if (s.bold) bm = embolden(bm);
    var H = bm.length, W = bm[0].length, lines = [], y, x;
    function at(xx, yy) { return xx >= 0 && yy >= 0 && yy < H && xx < W && bm[yy][xx] === 1; }

    if (s.half) {
      for (y = 0; y < H; y += 2) {
        var ln = "";
        for (x = 0; x < W; x++) {
          var t = at(x, y), b = at(x, y + 1);
          ln += t && b ? FULL : t ? UP : b ? LO : " ";
        }
        lines.push(ln);
      }
    } else if (s.outline) {
      // Outline = the one-dot ring around every stroke (dilate by one dot, subtract the letter).
      // The letter itself is left hollow, framed by a line. Work on a bitmap padded by 1 dot on every
      // side so the ring is never clipped at the edges.
      var PW = W + 2, PH = H + 2;
      function pat(xx, yy) { return xx >= 1 && yy >= 1 && xx <= W && yy <= H && bm[yy - 1][xx - 1] === 1; }
      function ring(xx, yy) {
        if (pat(xx, yy)) return false;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) if ((dx || dy) && pat(xx + dx, yy + dy)) return true;
        return false;
      }
      for (y = 0; y < PH; y++) {
        var lo = "";
        for (x = 0; x < PW; x++) lo += ring(x, y) ? FULL : " ";
        lines.push(lo);
      }
    } else {
      var cell = s.cell;
      for (y = 0; y < H; y++) {
        var row = "";
        for (x = 0; x < W; x++) row += (bm[y][x] ? FULL : " ").repeat(cell);
        lines.push(row);
      }
      if (s.shadow) {
        // shadow dots: off dots whose up-left neighbour is on, drawn one dot right and one down
        var sh = [];
        for (y = 0; y < H + 1; y++) {
          var sr = "";
          for (x = 0; x < W + 1; x++) {
            var on = at(x, y), sOn = at(x - 1, y - 1);
            sr += on ? FULL : sOn ? SHADE : " ";
          }
          sh.push(sr);
        }
        lines = sh;
      }
    }
    var width = 0; lines.forEach(function (l) { if (l.length > width) width = l.length; });
    // pad rows to equal width so callers can centre without ragged edges
    lines = lines.map(function (l) { return l + " ".repeat(width - l.length); });
    return { lines: lines, missing: [], width: width, height: lines.length };
  }

  return { render: render, canRender: canRender, missing: missing, glyph: glyph, STYLES: STYLES, MATRIX: M };
});
