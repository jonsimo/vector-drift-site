/* Vector Drift — local command log. Every command typed into any console on the
   site is kept in THIS browser only (localStorage, newest last, capped), with a
   status: ok (an intent answered it), generic (it got the catch-all deflection)
   or none (nothing matched). Nothing is sent anywhere. Type `cmdlog` in a
   console to copy the log to the clipboard, `cmdlog clear` to wipe it. */
(function () {
  "use strict";
  var KEY = "vd_cmdlog", CAP = 800;
  function read() { try { var a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function write(a) { try { localStorage.setItem(KEY, JSON.stringify(a.slice(-CAP))); } catch (e) {} }
  function add(command, status, where) {
    command = String(command || "").trim().slice(0, 200);
    if (!command || /@/.test(command) || command.toLowerCase() === "cmdlog" || command.toLowerCase() === "cmdlog clear") return;   // never log an email address
    var a = read();
    a.push({ t: Date.now(), c: command, s: status || "ok", w: where || "" });
    write(a);
  }
  // re-label the newest entry once the response type is known
  function mark(status) {
    var a = read();
    if (a.length) { a[a.length - 1].s = status; write(a); }
  }
  function text() {
    return read().map(function (e) { return e.s + "\t" + (e.w || "-") + "\t" + e.c; }).join("\n");
  }
  function summary() {
    var a = read(), none = a.filter(function (e) { return e.s === "none"; }).length, gen = a.filter(function (e) { return e.s === "generic"; }).length;
    return { total: a.length, none: none, generic: gen };
  }
  // Handle the `cmdlog` command. Returns console lines, or null if it is not that command.
  function command(raw) {
    var r = String(raw || "").trim().toLowerCase();
    if (r !== "cmdlog" && r !== "cmdlog clear") return null;
    if (r === "cmdlog clear") { write([]); return ["COMMAND LOG CLEARED."]; }
    var s = summary(), body = text();
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(body).catch(function () {}); } catch (e) {}
    try { console.log("[vd cmdlog]\n" + body); } catch (e) {}
    return ["COMMAND LOG // " + s.total + " commands, " + s.none + " unanswered, " + s.generic + " generic", "COPIED TO CLIPBOARD (also in the browser console).", "cmdlog clear  wipes it."];
  }
  window.VDCmdLog = { add: add, mark: mark, text: text, summary: summary, command: command };
})();
