// Tone map of the leaf with real light and shade, painted with keyboard symbols.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./leaf.js"), require("./art.js"));
  else root.NFOPaintLeaf = factory(root.NFOLeaf, root.NFOArt);
})(typeof self !== "undefined" ? self : this, function (leaf, A) {
"use strict";
function toneMap(cols, rows) {
  const img = leaf(cols * 16, rows * 32, { ink: true }), sm = A.resample(img, cols, rows * 2), tones = [];
  // Averaging dilutes thin features. The rim is about 9 source pixels wide inside a 16-pixel cell, so the
  // box filter blends it into the blade and no cell ever reads as rim. Count the share of each sub-cell that is
  // rim in the SOURCE instead, and treat a cell as rim when a meaningful part of it is.
  const subW = img.width / cols, subH = img.height / (rows * 2), rimShare = new Float32Array(cols * rows * 2);
  for (let sy = 0; sy < rows * 2; sy++) for (let sx = 0; sx < cols; sx++) {
    let r = 0, n = 0;
    for (let yy = Math.floor(sy * subH); yy < Math.floor((sy + 1) * subH); yy += 2) for (let xx = Math.floor(sx * subW); xx < Math.floor((sx + 1) * subW); xx += 2) { n++; if (img.data[(yy * img.width + xx) * 4] >= 250) r++; }
    rimShare[sy * cols + sx] = n ? r / n : 0;
  }
  // The leaf image encodes material: ~0.18 veins, 0.46-0.80 blade (rising toward the margin), 1.0 rim.
  // Re-map it to a painter's tonal range. Veins become pale highlights, the blade is modelled as a
  // folded surface that gets darker away from the centre ridge, and the rim is the deepest line.
  const remap = (m) => {
    if (m < 0.07) return 0;
    if (m < 0.30) return 0.10 + m * 0.5;                  // vein: pale, carved out of the blade
    if (m > 0.93) return 1.00;                            // rim: the darkest line round each leaflet
    const k = (m - 0.46) / 0.34;                          // 0 at the ridge, 1 at the margin
    return 0.34 + 0.50 * Math.pow(Math.max(0, Math.min(1, k)), 0.85);   // ridge mid-light, slope to deep
  };
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const a = sm.data[((y * 2) * cols + x) * 4] / 255, b = sm.data[((y * 2 + 1) * cols + x) * 4] / 255;
      const rimHere = Math.max(rimShare[(y * 2) * cols + x], rimShare[(y * 2 + 1) * cols + x]);
      const m = rimHere >= 0.22 ? 1.0 : (a + b) / 2;                        // a cell that is a fifth rim or more IS rim
      let v = remap(m);
      if (v === 0) { row.push(0); continue; }
      // light from the upper left: lit side lifts toward highlight, far side sinks. Wider swing than before.
      const light = 0.80 + 0.42 * (1 - (x / cols * 0.55 + y / rows * 0.45));
      row.push(Math.max(0.06, Math.min(1, v * light)));
    }
    tones.push(row);
  }
  return tones;
}
return { toneMap: toneMap };
});
