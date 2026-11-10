/* Expo page console: the same command engine as the site's console, no boot.
   Anything that opens a section or program takes the visitor to the site. */
(function () {
  "use strict";
  var Engine = window.VDConsoleEngine, Lang = window.VDConsoleLanguage;
  var form = document.getElementById("cf"), input = document.getElementById("ci"), log = document.getElementById("log"), tx = document.getElementById("tx");
  function mirror() { tx.textContent = input.value; form.classList.toggle("has", input.value.length > 0); }
  input.addEventListener("input", mirror);
  form.addEventListener("click", function () { input.focus(); });
  // Phone keyboard: on focus fold the links and older lines away so the console
  // sits near the top instead of under the keyboard. SHOW LINKS brings them back.
  // Rows shrink and fade (and grow back) rather than cutting.
  var ex = document.getElementById("ex"), body = document.body;
  var T = 340, EASE = "cubic-bezier(.4,0,.2,1)", PROPS = ["height", "opacity", "marginTop", "marginBottom", "paddingTop", "paddingBottom", "overflow", "transition"];
  function still() { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function clear(n) { PROPS.forEach(function (p) { n.style[p] = ""; }); n._f = 0; }
  function foldEl(n, d) {
    if (n.classList.contains("gone") || n._f) return;
    var h = n.getBoundingClientRect().height;
    if (!h || still()) { n.classList.add("gone"); return; }
    var s = n.style, t = T + "ms " + EASE + " " + d + "ms"; n._f = 1;
    s.height = h + "px"; s.overflow = "hidden"; void n.offsetHeight;
    s.transition = "height " + t + ",margin " + t + ",padding " + t + ",opacity " + Math.round(T * 0.7) + "ms linear " + d + "ms";
    s.height = "0px"; s.opacity = "0"; s.marginTop = s.marginBottom = s.paddingTop = s.paddingBottom = "0px";
    n._t = setTimeout(function () { clear(n); n.classList.add("gone"); }, T + d + 40);
  }
  function unfoldEl(n, d) {
    if (n._f) { clearTimeout(n._t); clear(n); n.classList.add("gone"); }
    if (!n.classList.contains("gone")) return;
    n.classList.remove("gone");
    if (still()) return;
    var h = n.getBoundingClientRect().height; if (!h) return;
    var s = n.style, t = T + "ms " + EASE + " " + d + "ms"; n._f = 1;
    s.height = "0px"; s.overflow = "hidden"; s.opacity = "0"; s.marginTop = s.marginBottom = s.paddingTop = s.paddingBottom = "0px"; void n.offsetHeight;
    s.transition = "height " + t + ",margin " + t + ",padding " + t + ",opacity " + Math.round(T * 0.8) + "ms linear " + d + "ms";
    s.height = h + "px"; s.opacity = "1"; s.marginTop = s.marginBottom = s.paddingTop = s.paddingBottom = "";
    n._t = setTimeout(function () { clear(n); }, T + d + 40);
  }
  function statics() { return [].slice.call(document.querySelectorAll(".sub, .sys, .list, .foot")); }
  function olds() { var e = log.children, r = []; for (var i = 0; i < e.length - 1; i++) r.push(e[i]); return r; }
  function fold() { olds().concat(statics().reverse()).forEach(function (n, i) { foldEl(n, Math.min(i * 28, 220)); }); }
  function typing(on) {
    body.classList.toggle("typing", on);
    if (on) fold();
    else [].slice.call(document.querySelectorAll(".gone")).forEach(function (n, i) { unfoldEl(n, Math.min(i * 28, 220)); });
    if (ex) ex.setAttribute("aria-hidden", on ? "false" : "true"), ex.tabIndex = on ? 0 : -1;
    window.scrollTo(0, on ? 0 : window.scrollY);
    if (on) [60, 300].forEach(function (ms) { setTimeout(function () { if (body.classList.contains("typing")) window.scrollTo(0, 0); }, ms); });
  }
  if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
    input.addEventListener("focus", function () { typing(true); });
    if (ex) ex.addEventListener("click", function () { input.blur(); typing(false); });
  }
  if (!Engine || !form) return;
  var session = Engine.createSession(), history = [], hi = 0, draft = "", leaving = false;
  var topicSession = window.VDIntents ? window.VDIntents.createSession() : null;
  var SITE = "/revamp/?ref=expo#";
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function render(res, raw) {
    var ent = el("div", "ent");
    if (res.echo || raw) ent.appendChild(el("div", "echo", "console> " + (res.echo || raw)));
    (res.lines.length ? res.lines : ["ready"]).forEach(function (l) { ent.appendChild(el("div", "", l || " ")); });
    if (res.suggestions && res.suggestions.length) {
      var s = el("div", "sug");
      res.suggestions.slice(0, 4).forEach(function (c) {
        var b = el("button", "", "[ " + (Lang && Lang.label ? Lang.label(c) : c) + " ]"); b.type = "button";
        b.addEventListener("click", function () { run(c); }); s.appendChild(b);
      });
      ent.appendChild(s);
    }
    log.appendChild(ent);
    if (body.classList.contains("typing")) olds().forEach(function (n, i) { foldEl(n, Math.min(i * 28, 220)); });
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
    var cl = window.VDCmdLog ? window.VDCmdLog.command(raw) : null;
    if (cl) { render({ lines: cl, effects: [], suggestions: [] }, raw); return; }
    var now = new Date();
    var res = Engine.execute(raw, session, { section: "root", frame: 0, now: now.getTime(), date: now.toLocaleDateString(), time: now.toLocaleTimeString() });
    var miss = /^REQUEST NOT RECOGNIZED/.test(res.lines[0] || "");
    var unrecognised = miss;
    // at a booth, "controls" and "how do i play" mean the game, not the console
    if ((/\b(controls?|keybinds?|key bindings|gamepad|controller)\b/i.test(raw) && !/console|website|site/i.test(raw)) || /\bhow (do i|to|can i) (play|fly|steer|control)\b/i.test(raw)) miss = true;
    var fromTopics = false;
    // anything the engine does not know goes to the shared topics layer, same as the site console
    if (miss && window.VDIntents && window.VDIntents.selectUnknown) {
      var norm = window.VDIntents.normalizeTerminalInput(raw).normalized, extra = null;
      if (norm) {
        var sel = window.VDIntents.selectUnknown(topicSession, Math.random, norm, raw), lines = [], fx = [];
        sel.steps.forEach(function (st) {
          if (st.type === "print" || st.type === "typed" || st.type === "link" || st.type === "open") lines.push(st.text || "");
          else if (st.type === "goto") fx.push({ type: "navigate", section: st.section });
          else if (st.type === "run" && (st.command === "snake" || st.command === "pi")) fx.push({ type: "program", name: st.command });
          else if (st.type === "run" && st.command === "email.exe") fx.push({ type: "navigate", section: "email" });
        });
        if (lines.length) extra = { lines: lines, effects: fx };
      }
      if (extra) { res = { lines: extra.lines, echo: res.echo, suggestions: res.suggestions, effects: extra.effects }; fromTopics = true; }
    }
    // bare-bones terminal voice for the engine's own sentences
    if (!fromTopics && window.VDConsoleVoice) res = { lines: window.VDConsoleVoice.apply(res.lines, raw), echo: res.echo, suggestions: res.suggestions, effects: res.effects };
    history = session.history.slice(); hi = history.length; draft = "";
    if (window.VDCmdLog) window.VDCmdLog.add(raw, unrecognised && !fromTopics ? "none" : "ok", "go");
    var clear = res.effects.some(function (e) { return e.type === "clear"; });
    if (clear) log.replaceChildren(); else render(res, raw);
    var dest = null;
    res.effects.forEach(function (e) {
      if (e.type === "navigate") dest = e.section === "root" ? null : e.section === "reference" ? "reference" : e.section;
      else if (e.type === "program") dest = e.name;
    });
    if (dest) { log.lastChild && log.lastChild.appendChild(el("div", "echo", "load site")); go(SITE + dest); }
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
