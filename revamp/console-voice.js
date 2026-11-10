/* Vector Drift — site console voice. The console engine writes friendly sentences; a
   command line does not. This pass runs over every line before it is printed and turns
   it into bare-bones terminal output: lowercase, no full stops, no pleading, key .... value
   rows, "load <file>" for anything that opens, "<cmd>: command not found" for misses.
   Pure module (no DOM) so it is testable. VDConsoleVoice.apply(lines, raw) -> lines. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VDConsoleVoice = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var FILE = { about: "about.txt", media: "media/", soundtrack: "soundtrack/", devlog: "devlog/", links: "links.lnk", download: "download.exe", contact: "contact", discord: "discord", email: "email.exe" };

  // exact line -> replacement (null drops the line). Matched case-insensitively, trailing . ? ! ignored.
  var EXACT = {
    "link established. what would you like to do": "session open // type help",
    "sure. what would you like to do": "ok // type help",
    "understood. we can try something else": "ok",
    "want to see it or check whether you can play": "type about // type download",
    "vector drift is a retro vector space shooter for macos, windows and linux": "vector drift ......... retro vector shooter // macOS / windows / linux",
    "opening the media view": null,
    "opening the framegrabs instead": null,
    "there is no trailer yet": "trailer ............... none yet",
    "pick something to play": "type snake or pi",
    "no confirmed release date, price or steam page is configured here": "release date ........... dec 2026 // price: none yet // steam page: none yet",
    "no release date is confirmed here": "release date ........... dec 2026",
    "use email for announcements; the demo remains held": "type email for updates",
    "pick a request, or type help all for every command": "type help all for every command",
    "no matching action found. you can choose a request below or type help": "__NF__",
    "unknown category. try help, help all, or man <command>": "help: unknown category // try: help all",
    "opening the ost previews": "load soundtrack/",
    "23 tracks, 45-second clips, each with its own cover. space pauses, n skips, esc leaves": "23 tracks // 45s previews // space pause, n next, esc exit",
    "opening console guide": "load console/reference",
    "channel remains open. session retained": "session retained // close the tab to leave",
    "console folded. progress retained": "console closed",
    "nothing to cancel": "cancel: nothing running",
    "no question, game or program is active. fold hides the console; ctrl+c clears typed input": "esc closes the console // ctrl+c clears input",
    "acknowledged": "ok",
    "courtesy recorded. no surcharge": "ok // no charge",
    "you are welcome. the channel remains open": "ok",
    "alpha demo is not yet available": "alpha demo ............ not yet available",
    "want email updates when there is news": "type email for updates",
    "looking for the demo": null,
    "ask normally or use commands. use help all for the full catalog; tab completes names": "type help all // tab completes",
    "this console is a self-contained interface": "this console runs inside the page",
    "nothing typed here runs on your computer as a shell command": "nothing typed here touches your computer",
    "the directory is a complete inventory": "the directory is the whole inventory",
    "nothing is hidden here": "hidden files ........... none",
    "this is a scripted, stateful terminal": "terminal ............... scripted",
    "no remote ai service interprets your commands": "remote services ........ none",
    "one instruction at a time": "one command at a time",
    "this relay is not a shell; pasted code and command chains are never executed": "chains and pasted code are never run",
    "request refused": "permission denied",
    "the archive prefers to remain an archive. nothing was deleted or restarted": "read-only filesystem // nothing changed",
    "only virtual site files are mounted": null,
    "this is a virtual archive, not access to your device files": "no access to local files",
    "interface stable. no complaints logged": "status: stable",
    "the channel is clear. that is as close as i get to fine": "status: nominal",
    "frustration acknowledged": "input logged",
    "try something with a more predictable outcome": "try: help",
    "channel ready": "ready",
    "no matching command. try help all": "apropos: no match // try: help all",
    "no matching virtual files": "find: no match",
    "no manual entry for that name": "man: no entry",
    "command handler unavailable": "error: handler unavailable",
    "input too long. keep a command under 512 characters": "error: input too long // max 512",
    "numbers game ended": "guess: ended",
  };

  var KEEP_CASE = /\b(macOS|Windows|Linux|Vector Drift|LUX|Axiom|Xenophage|ASCII|OST|Discord|Instagram|Jon Simo|Steam|ROT13|HTML|URL)\b/;

  function plain(s) { return s.toLowerCase().replace(/\s+/g, " ").replace(/[.?!]+$/, "").trim(); }

  function one(line, raw, head) {
    if (line == null) return line;
    var p = plain(line);
    if (EXACT[p] === "__NF__") return (head || "input") + ": command not found";
    if (Object.prototype.hasOwnProperty.call(EXACT, p)) return EXACT[p];
    var m;
    if ((m = /^OPENED \/root\/?(.*)$/.exec(line))) return "load " + (m[1] ? (FILE[m[1].replace(/\/$/, "")] || m[1]) : "/root");
    if ((m = /^FRAME 0?(\d) SELECTED\.?$/.exec(line))) return "load frame_0" + m[1] + ".jpg";
    if (/^REQUEST NOT RECOGNIZED/i.test(line) || p === "no matching action found. you can choose a request below or type help" || /^no matching action found/i.test(line) || /^the relay could not match/i.test(line)) return (head || "input") + ": command not found";
    if ((m = /^UNRESOLVED: (.+)$/.exec(line))) return m[1].split(" ")[0] + ": command not found";
    if ((m = /^Did you mean ([^?]+)\?.*$/.exec(line))) return "did you mean: " + m[1].replace(/, /g, " / ");
    if ((m = /^USAGE: (.+)$/.exec(line))) return "usage: " + m[1];
    if ((m = /^FILE NOT FOUND: (.+)$/.exec(line))) return m[1] + ": no such file";
    if ((m = /^LOADING (.+)$/.exec(line))) return "load " + m[1];
    if ((m = /^(.+)\.exe \/\/ program closed$/.exec(line))) return m[1] + ".exe: closed";
    if ((m = /^SESSION UPTIME: (\d+) seconds$/.exec(line))) return "up " + m[1] + "s";
    if ((m = /^GREEN STEP (\d)\.?$/.exec(line))) return "green = " + m[1];
    if ((m = /^LIGHT: (.+)$/.exec(line))) return "glow = " + m[1].toLowerCase();
    if (/^REDUCED MOTION ENABLED\.?$/.test(line)) return "motion = reduced";
    if (/^FOLLOWING YOUR SYSTEM MOTION/.test(line)) return "motion = system";
    // rows like "interface ............. ONLINE": keep the dots, lowercase the value
    if ((m = /^(.*?\S) (\.{3,}) (.+)$/.exec(line)) && !/[a-z]{3,} [a-z]{3,} [a-z]{3,}/.test(m[3])) return m[1].toLowerCase() + " " + m[2] + " " + (KEEP_CASE.test(m[3]) ? m[3] : m[3].toLowerCase());
    // headline in capitals -> lowercase
    if (line === line.toUpperCase() && /[A-Z]/.test(line) && line.length < 60) return line.toLowerCase().replace(/[.]+$/, "");
    // sentences: no full stop, no capital start (proper nouns excepted)
    var out = line.replace(/\s*[.]+$/, "");
    var lead = KEEP_CASE.exec(out);
    if (!(lead && lead.index === 0) && /^[A-Z]([a-z]| )/.test(out)) out = out.charAt(0).toLowerCase() + out.slice(1);
    return out.replace(/ — /g, " // ").replace(/\. ([A-Z])/g, function (_, c) { return " // " + c.toLowerCase(); }).replace(/\?$/, "");
  }

  function apply(lines, raw) {
    var head = String(raw || "").trim().split(/\s+/)[0] || "";
    var out = [];
    (lines || []).forEach(function (l) { var v = one(l, raw, head); if (v !== null && v !== undefined) out.push(v); });
    return out.length || !(lines || []).length ? out : ["ok"];
  }
  return { apply: apply, one: one };
});
