/*!
 * NFO Forge 2.0 picture tab. Pure logic, no DOM: takes RGBA pixels and options, returns text and colours.
 * The page (app2.js) feeds it pixels from a canvas; the tests feed it synthetic images.
 * Licence: MIT.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./art.js"), require("./painter.js"));
  else root.NFOPicture = factory(root.NFOArt, root.NFOPainter);
})(typeof self !== "undefined" ? self : this, function (Art, Painter) {
  "use strict";

  var MODES = [
    { id: "paint",  label: "Painted symbols (! @ # % & * ( ))", note: "Keyboard symbols only, the classic hand-painted scene look" },
    { id: "shade",  label: "Shade blocks",                       note: "Four-level shading, solid and readable" },
    { id: "half",   label: "Half blocks",                        note: "Doubles vertical detail, best with colour" },
    { id: "ramp",   label: "Character ramp",                     note: "Light to dark ASCII, plain and portable" },
    { id: "edge",   label: "Outline",                            note: "Line drawing from the strong edges" }
  ];

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Tone grid (0..1) for the painter. Mirrors how the engine sizes its grid so every mode lines up.
  function toneGrid(img, cols, o) {
    var g = Art.gridFor(img, cols, o.aspect || 2, "ramp");
    var small = Art.resample(img, cols, g.rows), tones = [];
    var c = (o.contrast || 0) / 100, br = (o.brightness || 0) / 100, gm = o.gamma || 1;
    for (var y = 0; y < g.rows; y++) {
      var row = [];
      for (var x = 0; x < cols; x++) {
        var v = Art.lumaAt(small, x, y) / 255;
        v = Math.pow(clamp(v, 0, 1), 1 / gm);
        v = (v - 0.5) * (1 + c * 2) + 0.5 + br;
        v = clamp(v, 0, 1);
        row.push(o.invert ? 1 - v : v);
      }
      tones.push(row);
    }
    return tones;
  }

  // opts: { mode, cols, contrast, brightness, invert, dither, ramp, colour (bool), symbols ("punct"|"classic"|"mixed"), seed }
  function convert(img, opts) {
    var o = opts || {}, cols = clamp(parseInt(o.cols, 10) || 60, 20, 120), mode = o.mode || "paint";
    var res;
    if (mode === "paint") {
      var tones = toneGrid(img, cols, o);
      res = { lines: Painter.paint(tones, { set: o.symbols || "punct", seed: o.seed == null ? 7 : o.seed, blank: 0.05 }), cols: cols, rows: tones.length, mode: "paint" };
    } else {
      res = Art.convert(img, { cols: cols, mode: mode, contrast: o.contrast, brightness: o.brightness, invert: o.invert, dither: o.dither, ramp: o.ramp, gamma: o.gamma });
    }
    var colors = null;
    if (mode === "half" && o.colour) {
      // True half-block colour: every cell is the upper-half block, its foreground the colour of the upper pixel and its
      // background the colour of the lower pixel. That is two colours per cell and twice the vertical colour detail.
      var rows2 = res.rows, both = Art.colorGrid(img, cols, rows2 * 2), fg = [], bg = [], lines2 = [];
      for (var yy = 0; yy < rows2; yy++) {
        var frow = [], brow = [], line = "";
        for (var xx = 0; xx < cols; xx++) {
          var top = both[yy * 2][xx], bot = both[yy * 2 + 1][xx];
          frow.push(top); brow.push(bot);
          line += top === bot ? (top === 0 ? " " : "\u2588") : "\u2580";   // same colour both halves: a full block (or blank on black)
        }
        fg.push(frow); bg.push(brow); lines2.push(line);
      }
      // a full block is drawn in the shared colour; blank cells keep the shared (black) colour as background
      for (var y3 = 0; y3 < rows2; y3++) for (var x3 = 0; x3 < cols; x3++) if (fg[y3][x3] === bg[y3][x3]) { bg[y3][x3] = 0; }
      return { lines: lines2, cols: cols, rows: rows2, mode: mode, colors: { fg: fg, bg: bg } };
    }
    if (o.colour) colors = { fg: Art.colorGrid(img, cols, res.rows), bg: null };
    return { lines: res.lines, cols: res.cols, rows: res.rows, mode: mode, colors: colors };
  }

  return { convert: convert, toneGrid: toneGrid, MODES: MODES };
});
