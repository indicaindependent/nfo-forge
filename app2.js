/* NFO Forge 2.0 page glue for the Picture tab. Kept separate from app.js so the text-release flow is untouched. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var img = null, last = null, name = "picture";
  var MAXSIDE = 1600;                         // downscale large photos before sampling: keeps the page quick, loses nothing at 120 columns

  function setStatus(msg, cls) { var el = $("status"); el.textContent = msg; el.className = "status " + (cls || ""); }
  function download(file, bytes, type) {
    var url = URL.createObjectURL(new Blob([bytes], { type: type || "application/octet-stream" }));
    var a = document.createElement("a"); a.href = url; a.download = file;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function slug() { return (($("picTitle").value || name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "picture"); }

  function opts() {
    return {
      mode: $("picMode").value, cols: parseInt($("picCols").value, 10) || 76,
      contrast: +$("picContrast").value, brightness: +$("picBright").value, invert: $("picInvert").checked,
      colour: $("picColour").checked, symbols: $("picSymbols").value, dither: false
    };
  }

  function render() {
    if (!img) { setStatus("Choose an image to begin.", ""); return null; }
    var o = opts(), r = NFOPicture.convert(img, o);
    last = r;
    var out = $("out"), stage = $("stage");
    if (r.colors) {
      stage.className = "stage ansi";
      out.innerHTML = NFOAnsi.toHtml(r.lines, r.colors);        // toHtml escapes < > & in every run; nothing user-controlled reaches here unescaped
    } else {
      stage.className = "stage theme-" + $("theme").value;
      out.textContent = r.lines.join("\n");
    }
    var enc = NFO.cp437Encode(r.lines.join("\n"), true);
    var msg = r.cols + " x " + r.rows + " cells. ";
    msg += r.colors ? "16-colour: save as .ans to keep the colour." : "Mono: save as .txt or .nfo.";
    if (enc.lossy.length) msg += " Not in CP437: " + enc.lossy.join(" ");
    setStatus(msg, enc.lossy.length ? "warn" : "good");
    return r;
  }

  // The leaf is not a live preview of the controls, so saving it must not re-render the picture over it.
  function current() { return last && last.mode === "leaf" ? last : render(); }

  function loadFile(f) {
    if (!f) return;
    if (!/^image\//.test(f.type)) { setStatus("That file is not an image.", "bad"); return; }
    name = f.name.replace(/\.[^.]+$/, "");
    var url = URL.createObjectURL(f), im = new Image();
    im.onload = function () {
      var s = Math.min(1, MAXSIDE / Math.max(im.naturalWidth, im.naturalHeight));
      var w = Math.max(1, Math.round(im.naturalWidth * s)), h = Math.max(1, Math.round(im.naturalHeight * s));
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      var cx = cv.getContext("2d", { willReadFrequently: true });
      cx.fillStyle = "#000"; cx.fillRect(0, 0, w, h); cx.drawImage(im, 0, 0, w, h);
      var d = cx.getImageData(0, 0, w, h);
      img = { width: w, height: h, data: d.data };
      URL.revokeObjectURL(url);
      render();
    };
    im.onerror = function () { URL.revokeObjectURL(url); setStatus("The browser could not read that image.", "bad"); };
    im.src = url;
  }

  function show(pic) {
    $("picturePanel").hidden = !pic; $("editorPanel").hidden = pic;
    $("tabPic").className = "tab" + (pic ? " on" : ""); $("tabText").className = "tab" + (pic ? "" : " on");
    $("tabPic").setAttribute("aria-pressed", pic); $("tabText").setAttribute("aria-pressed", !pic);
    document.querySelector("main").style.gridTemplateColumns = "";
    if (pic) { render(); } else { $("stage").className = "stage theme-" + $("theme").value; if (window.dispatchEvent) $("width").dispatchEvent(new Event("input")); }
  }

  // ---- Leaf showcase -------------------------------------------------------------------------------------------
  // The leaf takes about two seconds to paint, so it runs in a Web Worker and the page never freezes. Results are cached by
  // their options: changing nothing, or going back to an earlier setting, costs nothing. If Workers are unavailable it
  // falls back to a direct call, which blocks the page for those two seconds, and the status line says so.
  var worker = null, jobId = 0, leafCache = {}, leafBusy = false;
  function leafOpts() {
    return { title: $("leafTitle").value.trim(), letters: $("leafLetters").value.trim(), tagline: $("leafTag").value.trim(), seed: parseInt($("leafSeed").value, 10) || 7 };
  }
  function leafKey(o) { return JSON.stringify([o.title, o.letters, o.tagline, o.seed]); }
  function showLeaf(res) {
    last = { lines: res.lines, cols: res.cols, rows: res.rows, mode: "leaf", colors: null };
    $("stage").className = "stage theme-" + $("theme").value;
    $("out").textContent = res.lines.join("\n");
    var enc = NFO.cp437Encode(res.lines.join("\n"), true);
    setStatus(res.cols + " x " + res.rows + " cells. Keyboard symbols only." + (enc.lossy.length ? " Not in CP437: " + enc.lossy.join(" ") : ""), enc.lossy.length ? "warn" : "good");
  }
  function paintLeaf() {
    if (leafBusy) return;
    var o = leafOpts(), key = leafKey(o), ls = $("leafStatus");
    if (leafCache[key]) { showLeaf(leafCache[key]); ls.textContent = "Shown from cache."; return; }
    leafBusy = true; $("leafMake").disabled = true; ls.textContent = "Painting. The page stays usable while this runs.";
    var done = function (res, ms) { leafCache[key] = res; leafBusy = false; $("leafMake").disabled = false; ls.textContent = "Painted in " + (ms / 1000).toFixed(1) + " s."; showLeaf(res); };
    var fail = function (msg) { leafBusy = false; $("leafMake").disabled = false; ls.textContent = "Could not paint the leaf: " + msg; setStatus("Leaf failed: " + msg, "bad"); };
    var t0 = performance.now();
    try { if (!worker) worker = new Worker("showcase-worker.js"); } catch (e) { worker = null; }
    if (worker) {
      var id = ++jobId;
      worker.onmessage = function (e) { if (e.data.id !== id) return; e.data.ok ? done(e.data.result, performance.now() - t0) : fail(e.data.error); };
      worker.onerror = function (e) { worker = null; fail(e.message || "the background worker failed to load"); };
      worker.postMessage({ id: id, opts: o });
    } else {
      ls.textContent = "No background worker available, painting directly. The page may pause for a couple of seconds.";
      setTimeout(function () { try { done(NFOShowcase.compose(o), performance.now() - t0); } catch (e) { fail(String(e.message || e)); } }, 30);
    }
  }

  function init() {
    $("leafMake").onclick = paintLeaf;
    NFOPicture.MODES.forEach(function (m) { var o = document.createElement("option"); o.value = m.id; o.textContent = m.label; $("picMode").appendChild(o); });
    var noteFor = function () { var m = NFOPicture.MODES.filter(function (x) { return x.id === $("picMode").value; })[0]; $("picNote").textContent = m ? m.note : ""; $("picSymbols").disabled = $("picMode").value !== "paint"; };
    noteFor();
    $("tabText").onclick = function () { show(false); };
    $("tabPic").onclick = function () { show(true); };
    $("picFile").onchange = function (e) { loadFile(e.target.files[0]); };
    ["picMode", "picCols", "picSymbols", "picContrast", "picBright", "picInvert", "picColour"].forEach(function (id) {
      $(id).addEventListener("input", function () { noteFor(); if (!$("picturePanel").hidden) { if (last && last.mode === "leaf") last = null; render(); } });
    });
    // The shared output toolbar's Theme select should also refresh a mono picture.
    $("theme").addEventListener("change", function () { if (!$("picturePanel").hidden && last && !last.colors) $("stage").className = "stage theme-" + $("theme").value; });

    $("picDlTxt").onclick = function () { var r = current(); if (!r) return; download(slug() + ".txt", new TextEncoder().encode(r.lines.join("\n") + "\n"), "text/plain;charset=utf-8"); };
    $("picDlNfo").onclick = function () {
      var r = current(); if (!r) return;
      var f = NFO.toFile({ text: r.lines.join("\n"), lines: r.lines, width: r.cols }, { title: $("picTitle").value, author: $("picAuthor").value, group: $("picGroup").value, date: "", comments: [] });
      download(slug() + ".nfo", f.bytes);
    };
    $("picDlAns").onclick = function () {
      var r = current(); if (!r) return;
      var f = NFOAnsi.toFile(r.lines, r.colors || null, { title: $("picTitle").value, author: $("picAuthor").value, group: $("picGroup").value, comments: [] });
      download(slug() + ".ans", f.bytes);
    };
    // Drag and drop an image anywhere while the Picture tab is open.
    document.addEventListener("drop", function (e) {
      if ($("picturePanel").hidden) return;
      var f = e.dataTransfer && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) { e.stopImmediatePropagation(); loadFile(f); }
    }, true);
  }
  document.addEventListener("DOMContentLoaded", init);
})();
