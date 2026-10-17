// Procedural cannabis leaf: 7 serrated leaflets fanning from a petiole. Pure geometry, no source art.
// Returns an RGBA image {width,height,data}. Brightness encodes depth: veins bright, blade mid, edge dark.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./art.js"));
  else root.NFOLeaf = factory(root.NFOArt);
})(typeof self !== "undefined" ? self : this, function (A) {
"use strict";
function leaf(W, H, o) {
  o = o || {};
  const INK = !!o.ink;                            // ink mode: blade dense, veins light, rim darkest (for symbol painting)
  const d = new Uint8ClampedArray(W * H * 4);
  const cx = W / 2, cy = H * 0.80;                 // hub where leaflets meet
  const S = Math.min(W, H) * 0.74;                  // overall scale
  // [angle from vertical in degrees, length, max half-width] ; centre largest, outer pair smallest
  const L = [[0, 1.00, 0.078], [-23, 0.93, 0.072], [23, 0.93, 0.072], [-47, 0.76, 0.060], [47, 0.76, 0.060], [-72, 0.50, 0.046], [72, 0.50, 0.046]];
  const teeth = o.teeth || (INK ? 6 : 9);                    // ink mode (painted symbols): fewer, deeper teeth, since a cell is a coarse unit
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = 0, vein = 0, edge = 0, inkVein = 0, inkEdge = 0, inkRel = 0, bestInk = -1;
    for (const [deg, len, hw] of L) {
      const a = deg * Math.PI / 180;
      // coordinates in the leaflet's own frame: u along its axis, v across
      const dx = x - cx, dy = cy - y;
      const u = (dx * Math.sin(a) + dy * Math.cos(a)) / S;
      const v = (dx * Math.cos(a) - dy * Math.sin(a)) / S;
      if (u < 0.02 || u > len) continue;
      const t = u / len;                                        // 0 at hub, 1 at tip
      // lance shape: widest about a third of the way out, tapering to a point
      const base = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.85);
      // serrations: a saw-tooth along the margin, deeper toward the middle, absent at the very tip
      const phase = (t * teeth * (0.6 + len * 0.55)) % 1;                // sawtooth, leaning toward the tip
      const toothAmp = INK ? 1.15 : 0.62, floor = INK ? 0.50 : 0.74;           // painted symbols need a much deeper notch to register
      const tooth = Math.pow(phase, INK ? 1.2 : 1.6) * toothAmp * Math.sin(Math.PI * Math.min(1, t * 1.08));
      const w = hw * base * (floor + tooth);
      const av = Math.abs(v);
      if (av < w) {
        const rel = av / Math.max(w, 1e-6);
        let b = 0.34 + 0.40 * Math.pow(1 - rel, 0.8) + 0.10 * (1 - t);   // blade: bright at the midrib, dim at the margin, lighter near the hub
        if (av < 0.0058 * (1.15 - t * 0.6)) { b = 1.0; vein = 1; }   // midrib, thicker near the hub
        const sv = ((u * 22 - av * 9) % 1);                          // side veins slant toward the tip
        if (sv < 0.11 && av > 0.008 && t > 0.10 && t < 0.90) b = Math.max(b, 0.90);
        if (rel > 0.86) { b = Math.min(b, 0.26); edge = 1; }      // darker margin gives the leaf a rim
        if (b > best) best = b;
        // material for ink mode, taken from the leaflet that is drawing this pixel (the one that wins on brightness)
        if (b >= best) {
          inkVein = (av < 0.0058 * (1.15 - t * 0.6)) || ((((u * 22 - av * 9) % 1) < 0.11) && av > 0.008 && t > 0.10 && t < 0.90) ? 1 : 0;
          inkEdge = rel > 0.86 ? 1 : 0; inkRel = rel;
        }
      }
    }
    // petiole: a slim stem running down from the hub
    const px = (x - cx) / S, py = (y - cy) / S;
    if (py >= -0.01 && py < 0.46 && Math.abs(px) < 0.012 * (1.15 - py)) best = Math.max(best, 0.95);
    const v = Math.round(255 * best), i = (y * W + x) * 4;
    if (INK) {
      // Rebuild the tone from the material flags collected above instead of the display brightness.
      let ink = 0;
      if (best > 0) {
        if (inkVein) ink = 0.18;                                  // veins are carved out of the blade: light
        else if (inkEdge) ink = 1.0;                              // rim: darkest line round every leaflet
        else ink = 0.46 + 0.34 * inkRel;                          // blade: dense, deepening toward the margin (form shading)
      }
      if (px >= -0.01 && py >= -0.01 && py < 0.46 && Math.abs(px) < 0.012 * (1.15 - py)) ink = 0.85;   // stem
      d[i] = d[i + 1] = d[i + 2] = Math.round(255 * ink); d[i + 3] = 255; continue;
    }
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  return { width: W, height: H, data: d };
}
return leaf;
});
