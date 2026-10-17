(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var state = null;

  var FIELDS = ["width", "border", "shade", "logo", "title", "tagline", "footer"];

  function fromForm() {
    var s = {
      width: parseInt($("width").value, 10) || 79,
      border: $("border").value, shade: $("shade").value,
      logo: $("logo").value, title: $("title").value, tagline: $("tagline").value, footer: $("footer").value,
      fields: [], sections: [],
      greets: $("greets").value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean),
      sauce: {
        title: $("s_title").value, author: $("s_author").value, group: $("s_group").value,
        date: $("s_date").value.replace(/-/g, ""),
        comments: $("s_comments").value.split("\n").filter(function (x) { return x.length; })
      }
    };
    document.querySelectorAll(".fieldrow").forEach(function (r) {
      var k = r.querySelector(".fk").value, v = r.querySelector(".fv").value;
      if (k.trim() !== "") s.fields.push([k, v]);
    });
    try { s.sections = JSON.parse($("sections").value || "[]"); }
    catch (e) { s.sections = []; s._sectionsError = e.message; }
    return s;
  }

  function toForm(s) {
    FIELDS.forEach(function (k) { if (s[k] !== undefined) $(k).value = s[k]; });
    $("greets").value = (s.greets || []).join("\n");
    $("sections").value = JSON.stringify(s.sections || [], null, 2);
    var sa = s.sauce || {};
    $("s_title").value = sa.title || ""; $("s_author").value = sa.author || ""; $("s_group").value = sa.group || "";
    var d = sa.date || ""; $("s_date").value = /^\d{8}$/.test(d) ? d.slice(0, 4) + "-" + d.slice(4, 6) + "-" + d.slice(6) : "";
    $("s_comments").value = (sa.comments || []).join("\n");
    var box = $("fields"); box.innerHTML = "";
    (s.fields || []).forEach(function (f) { addField(f[0], f[1]); });
  }

  function addField(k, v) {
    var r = document.createElement("div"); r.className = "fieldrow";
    r.innerHTML = '<input class="fk" aria-label="Field name"><input class="fv" aria-label="Field value"><button type="button" aria-label="Remove field">x</button>';
    r.querySelector(".fk").value = k || ""; r.querySelector(".fv").value = v || "";
    r.querySelector("button").onclick = function () { r.remove(); update(); };
    r.addEventListener("input", update);
    $("fields").appendChild(r);
  }

  function status(msg, cls) { var el = $("status"); el.textContent = msg; el.className = "status " + (cls || ""); }

  function update() {
    state = fromForm();
    var r = NFO.render(state);
    $("out").textContent = r.text;
    var msgs = r.warnings.slice();
    if (state._sectionsError) msgs.push("Sections JSON is invalid: " + state._sectionsError);
    var enc = NFO.cp437Encode(r.text, true);
    if (enc.lossy.length) msgs.push("Not in CP437, will save as '?': " + enc.lossy.join(" "));
    var sa = state.sauce || {};
    ["title:35", "author:20", "group:20"].forEach(function (p) {
      var k = p.split(":")[0], n = +p.split(":")[1];
      if ((sa[k] || "").length > n) msgs.push("SAUCE " + k + " is " + sa[k].length + " chars; the spec allows " + n + ". It will be cut.");
    });
    if (msgs.length) status(msgs.join("  |  "), "warn");
    else status(r.lines.length + " lines x " + r.width + " columns. " + enc.bytes.length + " bytes. All characters fit CP437.", "good");
    return r;
  }

  function download(name, bytes, type) {
    var url = URL.createObjectURL(new Blob([bytes], { type: type || "application/octet-stream" }));
    var a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function slug() { return (($("title").value || "release").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "release"); }

  function loadTemplate(url) {
    return fetch(url).then(function (r) { if (!r.ok) throw new Error(url + " returned " + r.status); return r.json(); })
      .then(function (j) { toForm(j); update(); })
      .catch(function (e) { status("Could not load template: " + e.message, "bad"); });
  }

  function openBytes(bytes, name) {
    var sa = NFO.readSauce(bytes);
    var body = NFO.stripSauce(bytes);
    var text = NFO.cp437Decode(body);
    $("out").textContent = text;
    var info = name + ": " + text.split("\n").length + " lines.";
    if (sa) info += " SAUCE: \"" + sa.title + "\" by " + sa.author + " / " + sa.group + " " + sa.date + " (" + sa.columns + "x" + sa.rows + ")";
    status(info + " Viewing only. Use the form to build a new one.", "good");
  }

  function init() {
    document.querySelectorAll("input,select,textarea").forEach(function (el) { el.addEventListener("input", update); });
    $("addField").onclick = function () { addField("", ""); update(); };
    $("theme").onchange = function () { $("stage").className = "stage theme-" + $("theme").value; };
    $("dlNfo").onclick = function () {
      var r = update(), s = state.sauce || {};
      var f = NFO.toFile(r, s);
      download(slug() + ".nfo", f.bytes);
    };
    $("dlTxt").onclick = function () { download(slug() + ".txt", new TextEncoder().encode(update().text), "text/plain;charset=utf-8"); };
    $("dlJson").onclick = function () {
      var s = fromForm(); delete s._sectionsError;
      download(slug() + ".json", new TextEncoder().encode(JSON.stringify(s, null, 2)), "application/json");
    };
    $("copy").onclick = function () { navigator.clipboard.writeText($("out").textContent).then(function () { status("Copied.", "good"); }, function () { status("Clipboard blocked by the browser.", "bad"); }); };
    $("openFile").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { openBytes(new Uint8Array(rd.result), f.name); }; rd.readAsArrayBuffer(f);
    };
    $("loadJson").onchange = function (e) {
      var f = e.target.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () {
        try { toForm(JSON.parse(rd.result)); update(); status("Loaded " + f.name, "good"); }
        catch (err) { status("That JSON would not parse: " + err.message, "bad"); }
      }; rd.readAsText(f);
    };
    document.querySelectorAll("[data-template]").forEach(function (b) { b.onclick = function () { loadTemplate(b.getAttribute("data-template")); }; });
    ["dragover", "drop"].forEach(function (ev) { document.addEventListener(ev, function (e) { e.preventDefault(); }); });
    document.addEventListener("drop", function (e) {
      var f = e.dataTransfer && e.dataTransfer.files[0]; if (!f) return;
      var rd = new FileReader(); rd.onload = function () { openBytes(new Uint8Array(rd.result), f.name); }; rd.readAsArrayBuffer(f);
    });
    var q = new URLSearchParams(location.search).get("t");
    loadTemplate(q && /^[a-z0-9-]+$/.test(q) ? "templates/" + q + ".json" : "templates/blank.json");
  }
  document.addEventListener("DOMContentLoaded", init);
})();
