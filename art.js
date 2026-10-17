/*!
 * NFO Forge 2.0 picture engine. Zero dependencies, browser and Node.
 *
 * Turns RGBA pixel data into CP437 text art. Input is plain
 * { width, height, data: Uint8ClampedArray|Array } so the same code runs from a
 * canvas in the browser and from synthetic images in the tests.
 *
 * Modes (all emit characters that exist in CP437):
 *   ramp   - brightness mapped to a character ramp
 *   shade  - four-level shade blocks  (space, light, medium, dark, full)
 *   half   - upper/lower half blocks, doubling vertical resolution
 *   edge   - outline: strong gradients become line characters
 *
 * Licence: MIT.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NFOArt = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RAMPS = {
    // dark to light on a LIGHT-ON-DARK display (so "dark" pixels get space)
    classic: " .:-=+*#%@",
    blocks: " \u2591\u2592\u2593\u2588",
    fine: " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
  };

  // The 16 classic VGA text colours, index = ANSI colour number order used by
  // CGA/VGA attributes (0 black, 1 blue, 2 green, 3 cyan, 4 red, 5 magenta, 6 brown, 7 grey,
  // then the bright set).
  var VGA = [
    [0, 0, 0], [0, 0, 170], [0, 170, 0], [0, 170, 170],
    [170, 0, 0], [170, 0, 170], [170, 85, 0], [170, 170, 170],
    [85, 85, 85], [85, 85, 255], [85, 255, 85], [85, 255, 255],
    [255, 85, 85], [255, 85, 255], [255, 255, 85], [255, 255, 255]
  ];

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Rec. 709 luma on 0-255 input, alpha composited over black so transparent
  // pixels read as background rather than as whatever RGB sits under them.
  function lumaAt(img, x, y) {
    var i = (y * img.width + x) * 4, a = img.data[i + 3] / 255;
    return (0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]) * a;
  }
  function rgbAt(img, x, y) {
    var i = (y * img.width + x) * 4, a = img.data[i + 3] / 255;
    return [img.data[i] * a, img.data[i + 1] * a, img.data[i + 2] * a];
  }

  // Box-filter resample to cols x rows. Averaging (not nearest-neighbour) is what
  // keeps thin features from vanishing when a large image is shrunk to a small grid.
  function resample(img, cols, rows) {
    var out = { width: cols, height: rows, data: new Float32Array(cols * rows * 4) };
    for (var oy = 0; oy < rows; oy++) {
      var y0 = Math.floor(oy * img.height / rows), y1 = Math.max(y0 + 1, Math.floor((oy + 1) * img.height / rows));
      for (var ox = 0; ox < cols; ox++) {
        var x0 = Math.floor(ox * img.width / cols), x1 = Math.max(x0 + 1, Math.floor((ox + 1) * img.width / cols));
        var r = 0, g = 0, b = 0, a = 0, n = 0;
        for (var y = y0; y < y1; y++) for (var x = x0; x < x1; x++) {
          var i = (y * img.width + x) * 4, al = img.data[i + 3] / 255;
          r += img.data[i] * al; g += img.data[i + 1] * al; b += img.data[i + 2] * al; a += img.data[i + 3]; n++;
        }
        var o = (oy * cols + ox) * 4;
        out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
        // colours are already alpha-premultiplied against black above
      }
    }
    return out;
  }

  function adjust(v, o) {
    // v is 0-255 luma. brightness -100..100, contrast -100..100, gamma > 0
    var x = v / 255;
    x = Math.pow(clamp(x, 0, 1), 1 / (o.gamma || 1));
    var c = (o.contrast || 0) / 100;
    x = (x - 0.5) * (1 + c * 2) + 0.5;
    x += (o.brightness || 0) / 100;
    x = clamp(x, 0, 1);
    return o.invert ? 1 - x : x;
  }

  // Ordered (Bayer 4x4) dither. Deterministic, so tests can assert exact output.
  var BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  function bayer(x, y) { return (BAYER4[y & 3][x & 3] + 0.5) / 16 - 0.5; }

  // Character cells are taller than wide. VGA text is 8x16, so a cell is twice as tall
  // as it is wide. aspect = cell height / cell width.
  function gridFor(img, cols, aspect, mode) {
    var rows = Math.max(1, Math.round(cols * (img.height / img.width) / (aspect || 2)));
    return { cols: cols, rows: rows };
  }

  function convert(img, opt) {
    opt = opt || {};
    var cols = clamp(parseInt(opt.cols, 10) || 60, 4, 200);
    var mode = opt.mode || "shade";
    var aspect = opt.aspect || 2;
    var dither = (mode === "shade" || mode === "ramp") ? !!opt.dither : false;
    var g = gridFor(img, cols, aspect, mode);
    var rows = g.rows;
    // half mode samples twice as many rows, then pairs them
    var sampleRows = mode === "half" ? rows * 2 : rows;
    var small = resample(img, cols, sampleRows);
    var lum = new Float32Array(cols * sampleRows);
    for (var i = 0; i < lum.length; i++) {
      var l = (0.2126 * small.data[i * 4] + 0.7152 * small.data[i * 4 + 1] + 0.0722 * small.data[i * 4 + 2]);
      lum[i] = adjust(l, opt);
    }
    var lines = [], y, x;

    if (mode === "half") {
      var thr = opt.threshold != null ? opt.threshold : 0.5;
      for (y = 0; y < rows; y++) {
        var s = "";
        for (x = 0; x < cols; x++) {
          var dh = opt.dither ? bayer(x, y * 2) * 0.5 : 0, dl = opt.dither ? bayer(x, y * 2 + 1) * 0.5 : 0;
          var t = lum[(y * 2) * cols + x] + dh > thr, b = lum[(y * 2 + 1) * cols + x] + dl > thr;
          s += t && b ? "\u2588" : t ? "\u2580" : b ? "\u2584" : " ";
        }
        lines.push(s);
      }
    } else if (mode === "edge") {
      // 1. Work on LOG luma so a step from 8 to 30 counts about as much as a step from 150 to 200.
      //    This is what makes a dim edge on a dark ground visible, as it is to the eye.
      var lg = new Float32Array(cols * rows);
      for (i = 0; i < lg.length; i++) lg[i] = Math.log(0.04 + lum[i]);
      function G(xx, yy) { return lg[clamp(yy, 0, rows - 1) * cols + clamp(xx, 0, cols - 1)]; }
      var mag = new Float32Array(cols * rows), dir = new Float32Array(cols * rows), maxMag = 1e-6;
      for (y = 0; y < rows; y++) for (x = 0; x < cols; x++) {
        var sx = (G(x + 1, y - 1) + 2 * G(x + 1, y) + G(x + 1, y + 1)) - (G(x - 1, y - 1) + 2 * G(x - 1, y) + G(x - 1, y + 1));
        var sy = (G(x - 1, y + 1) + 2 * G(x, y + 1) + G(x + 1, y + 1)) - (G(x - 1, y - 1) + 2 * G(x, y - 1) + G(x + 1, y - 1));
        // cells are `aspect` times taller than wide, so a vertical step spans more screen distance
        sy = sy / aspect;
        var m = Math.sqrt(sx * sx + sy * sy) / 4; mag[y * cols + x] = m; dir[y * cols + x] = Math.atan2(sy, sx);
        if (m > maxMag) maxMag = m;
      }
      var thrE = (opt.threshold != null ? opt.threshold : 0.3) * maxMag;
      // 2. Thin: keep a cell only if it is the strongest along its own gradient direction,
      //    so each edge is one cell wide instead of a smeared band.
      for (y = 0; y < rows; y++) {
        var e = "";
        for (x = 0; x < cols; x++) {
          var mm = mag[y * cols + x];
          if (mm < thrE) { e += " "; continue; }
          var a = dir[y * cols + x], dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a) * (aspect > 1 ? 1 : 1));
          var m1 = (x + dx >= 0 && x + dx < cols && y + dy >= 0 && y + dy < rows) ? mag[(y + dy) * cols + x + dx] : 0;
          var m2 = (x - dx >= 0 && x - dx < cols && y - dy >= 0 && y - dy < rows) ? mag[(y - dy) * cols + x - dx] : 0;
          if (mm < m1 || mm < m2) { e += " "; continue; }
          var ang = a * 180 / Math.PI; if (ang < 0) ang += 180;      // gradient angle 0-180
          // the edge runs perpendicular to the gradient
          // Screen y points DOWN, so a gradient pointing down-right (angle 0-90) belongs to an edge that
          // runs down-LEFT to up-right, which is "/".
          e += (ang < 22.5 || ang >= 157.5) ? "\u2502" : (ang < 67.5) ? "/" : (ang < 112.5) ? "\u2500" : "\\";
        }
        lines.push(e);
      }
    } else {
      var ramp = mode === "ramp" ? (RAMPS[opt.ramp] || RAMPS.classic) : RAMPS.blocks;
      var n = ramp.length;
      for (y = 0; y < rows; y++) {
        var r = "";
        for (x = 0; x < cols; x++) {
          var v = lum[y * cols + x], idx;
          if (dither) {
            // Levels are points spaced 1/(n-1) apart, so add the threshold offset in
            // that unit and round to the nearest level. A tone that falls between two
            // levels then splits between them in proportion; one that lands on a level stays put.
            // The offset is damped near the ends of the tone range so a near-black ground stays
            // blank and a near-white one stays solid. Only mid-tones, which genuinely sit
            // between two levels, are split.
            var edgeDamp = Math.min(1, v * 6, (1 - v) * 6);
            idx = Math.round(clamp(v + edgeDamp * bayer(x, y) / (n - 1), 0, 1) * (n - 1));
          } else {
            idx = Math.min(n - 1, Math.floor(v * n));
          }
          r += ramp.charAt(idx);
        }
        lines.push(r);
      }
    }
    return { lines: lines, cols: cols, rows: rows, mode: mode };
  }

  // Colour layer: pick the nearest VGA colour per cell. Distance is weighted so that
  // green differences count most, which is how the eye behaves. Returns a parallel grid of
  // foreground colour indices 0-15.
  function nearestVGA(r, g, b) {
    var best = 0, bd = 1e9;
    for (var i = 0; i < 16; i++) {
      var dr = r - VGA[i][0], dg = g - VGA[i][1], db = b - VGA[i][2];
      var d = 0.3 * dr * dr + 0.59 * dg * dg + 0.11 * db * db;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function colorGrid(img, cols, rows) {
    var small = resample(img, cols, rows), grid = [];
    for (var y = 0; y < rows; y++) {
      var row = [];
      for (var x = 0; x < cols; x++) {
        var o = (y * cols + x) * 4;
        row.push(nearestVGA(small.data[o], small.data[o + 1], small.data[o + 2]));
      }
      grid.push(row);
    }
    return grid;
  }

  return { convert: convert, colorGrid: colorGrid, resample: resample, nearestVGA: nearestVGA, VGA: VGA, RAMPS: RAMPS, gridFor: gridFor, lumaAt: lumaAt, rgbAt: rgbAt };
});
