/* NFO Forge 2.0: runs the leaf showcase off the main thread. The leaf takes about two seconds to paint, and a page that
 * freezes for two seconds on every click is not acceptable. The result is identical to calling NFOShowcase.compose() directly. */
importScripts("art.js", "density.js", "painter.js", "fonts.js", "leaf.js", "paint-leaf.js", "showcase.js");
self.onmessage = function (e) {
  var id = e.data.id;
  try { self.postMessage({ id: id, ok: true, result: self.NFOShowcase.compose(e.data.opts) }); }
  catch (err) { self.postMessage({ id: id, ok: false, error: String(err && err.message || err) }); }
};
