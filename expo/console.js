/* Expo page console: the same command engine as the site's console, no boot.
   Anything that opens a section or program takes the visitor to the site. */
(function () {
  "use strict";
  var Engine = window.VDConsoleEngine, Lang = window.VDConsoleLanguage;
  var form = document.getElementById("cf"), input = document.getElementById("ci"), log = document.getElementById("log"), tx = document.getElementById("tx");
  function mirror() { tx.textContent = input.value; form.classList.toggle("has", input.value.length > 0); }
  input.addEventListener("input", mirror);
  form.addEventListener("click", function () { input.focus(); });
  if (!Engine || !form) return;
  var session = Engine.createSession(), history = [], hi = 0, draft = "", leaving = false;
  var SITE = "/revamp/?ref=expo#";
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function render(res, raw) {
    var ent = el("div", "ent");
    if (res.echo || raw) ent.appendChild(el("div", "echo", "console> " + (res.echo || raw)));
    (res.lines.length ? res.lines : ["CHANNEL READY."]).forEach(function (l) { ent.appendChild(el("div", "", l || " ")); });
    if (res.suggestions && res.suggestions.length) {
      var s = el("div", "sug");
      res.suggestions.slice(0, 4).forEach(function (c) {
        var b = el("button", "", "[ " + (Lang && Lang.label ? Lang.label(c) : c) + " ]"); b.type = "button";
        b.addEventListener("click", function () { run(c); }); s.appendChild(b);
      });
      ent.appendChild(s);
    }
    log.appendChild(ent);
    while (log.children.length > 12) log.removeChild(log.firstChild);
    ent.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  function go(url, ent) {
    if (leaving) return; leaving = true;
    setTimeout(function () { location.assign(url); }, 650);
  }
  function run(raw) {
    raw = String(raw || "").trim();
    if (!raw || leaving) return;
    var now = new Date();
    var res = Engine.execute(raw, session, { section: "root", frame: 0, now: now.getTime(), date: now.toLocaleDateString(), time: now.toLocaleTimeString() });
    history = session.history.slice(); hi = history.length; draft = "";
    var clear = res.effects.some(function (e) { return e.type === "clear"; });
    if (clear) log.replaceChildren(); else render(res, raw);
    var dest = null;
    res.effects.forEach(function (e) {
      if (e.type === "navigate") dest = e.section === "root" ? null : e.section === "reference" ? "reference" : e.section;
      else if (e.type === "program") dest = e.name;
    });
    if (dest) { log.lastChild && log.lastChild.appendChild(el("div", "echo", "opening the site ...")); go(SITE + dest); }
  }
  form.addEventListener("submit", function (e) { e.preventDefault(); var v = input.value; input.value = ""; mirror(); run(v); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "Tab" && !e.shiftKey) {
      var m = Engine.complete(input.value);
      if (m.length === 1) { e.preventDefault(); input.value = m[0] + " "; mirror(); }
      return;
    }
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    if (!history.length) return;
    e.preventDefault();
    if (hi === history.length) draft = input.value;
    hi = Math.max(0, Math.min(history.length, hi + (e.key === "ArrowUp" ? -1 : 1)));
    input.value = hi === history.length ? draft : history[hi]; mirror();
  });
})();
