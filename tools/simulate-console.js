"use strict";
/* Console simulation. Feeds many human-looking inputs through the same path terminal.js uses
   (resolveCommand -> selectResponse | selectUnknown) in sessions, and reports crashes, empty
   replies and replies repeated inside one session.
   CLI: node tools/simulate-console.js [--clinc data_full.json] [--n 10000] [--session 125] */
const fs = require("fs");
const path = require("path");
const VDI = require("../terminal-intents.js");
const T = require("../terminal-topics.js");

const TOPICS = ["powerups", "bosses", "enemies", "levels", "the soundtrack", "the story", "co-op", "multiplayer", "the leaderboard", "the controls", "the release date", "the demo", "the beta", "the price", "the developer", "the trailer", "screenshots", "the devlog", "the discord", "the engine", "secrets", "cheats", "weapons", "ships", "the music", "the lore", "upgrades", "achievements", "the map", "difficulty", "saves", "mac support", "windows support", "linux", "steam", "mobile", "the ending", "xenophage", "varrax", "nethyr", "skulls", "ranks"];
const FRAMES = ["what are {t}", "tell me about {t}", "show me {t}", "is there {t}", "do you have {t}", "how do i get {t}", "where can i find {t}", "can i see {t}", "i want {t}", "{t}", "{t}?", "what about {t}", "explain {t}", "list {t}", "how many {t}", "when is {t}", "who made {t}", "play {t}", "open {t}", "go to {t}", "info on {t}", "whats {t}", "any {t}", "is {t} good", "looking for {t}"];
const SHELL = ["ls -la", "cd /root", "cd media", "cd ..", "cat about.txt", "cat readme", "rm -rf /", "sudo su", "sudo apt install games", "git status", "npm install", "python3 game.py", "ssh root@localhost", "curl google.com", "vim", "nano notes", "top", "ps aux", "kill -9 1", "chmod 777 root", "mkdir test", "touch file", "echo hello world", "man help", "uname -a", "df -h", "ping 8.8.8.8", "whoami", "pwd", "history", "exit", "quit", "clear", "reboot", "shutdown now", "docker ps", "brew install vd", "make", "gcc main.c", "grep vector *", "which snake", "ifconfig", "nmap localhost"];
const SHAPE = ["asdfghjkl", "qwerty", "zxcvbnm", "aaaaaaaa", "lol", "LOL", "HELLO???", "WHY IS THIS NOT WORKING", "42", "3.14159", "1187", "???", "!!!", "...", "🙂", "👾👾", "<3", "hola", "bonjour", "hallo", "ciao", "http://google.com", "www.example.org", "a", "x", "test123", "blah", "wat", "huh", "meh", "ok", "k", "cool", "nice", "wow", "omg", "idk", "brb", "afk", "gg", "ty", "np", "pls", "plz", "uh", "um", "hmm", "lmao", "sup", "yeet", "bruh", "nope", "yep", "nah", "yup", "sure", "fine", "whatever", "i am bored", "this is boring", "i love this", "you suck", "im lost", "what is the capital of france", "do ducks sleep", "how do i remove a coffee stain"];
const MATHS = ["2+2", "12*12", "100/7", "what is 5 times 7", "calculate 9*9", "3 plus 4", "2^10", "7 x 8", "(3+4)*5", "1/0", "0/0", "what is 15% of 200", "sqrt 16"];

function rngFor(seed) { return VDI.makeRng(seed); }
function buildInputs(n, seed, extra) {
  const R = rngFor(seed), pick = (a) => a[Math.floor(R() * a.length)];
  const out = (extra || []).slice();
  while (out.length < n) {
    const r = R();
    if (r < 0.5) out.push(pick(FRAMES).replace("{t}", pick(TOPICS)));
    else if (r < 0.7) out.push(pick(SHELL));
    else if (r < 0.88) out.push(pick(SHAPE));
    else if (r < 0.94) out.push(pick(MATHS));
    else { let k = 3 + Math.floor(R() * 9), s = ""; while (k--) s += "abcdefghijklmnopqrstuvwxyz"[Math.floor(R() * 26)]; out.push(s); }
  }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out.slice(0, n);
}
function reply(session, rng, raw) {
  const normalized = VDI.normalizeTerminalInput(raw).normalized;
  const res = VDI.resolveCommand(normalized);
  if (res.kind === "empty") return { kind: "empty", steps: [{ type: "print", text: "-" }] };
  if (res.kind === "protected" || res.kind === "utility") return { kind: res.kind, builtin: true, steps: [{ type: "print", text: "[" + res.id + "]" }] };
  if (res.kind === "intent") return { kind: "intent:" + res.id, steps: VDI.selectResponse(res, session, rng).steps };
  return { kind: "topic:" + T.lastRoute(), steps: VDI.selectUnknown(session, rng, normalized, raw).steps };
}
const textOf = (steps) => steps.filter((s) => ["print", "link", "open", "typed"].includes(s.type)).map((s) => s.text || "").join(" | ");

function run(inputs, sessionSize, seed) {
  const stats = { total: 0, crashes: [], empties: [], dups: [], actions: 0, routes: {} };
  for (let i = 0; i < inputs.length; i += sessionSize) {
    const session = VDI.createSession(), rng = rngFor(seed + i), seen = new Map();
    for (const raw of inputs.slice(i, i + sessionSize)) {
      stats.total++;
      let r;
      try { r = reply(session, rng, raw); } catch (e) { stats.crashes.push([raw, e.message]); continue; }
      const t = textOf(r.steps);
      const hasAction = r.steps.some((s) => ["goto", "open", "link", "run", "historyRender", "clock"].includes(s.type));
      if (!t.trim() && !hasAction) { stats.empties.push([raw, r.kind]); continue; }
      if (hasAction) stats.actions++;
      const route = r.kind.split(":")[0] + ":" + (r.kind.split(":")[1] || "").replace(/^(family|game|shell).*/, "$1");
      stats.routes[route] = (stats.routes[route] || 0) + 1;
      if (r.builtin) continue;   // clear/download builtins redraw the screen
      if (seen.has(t)) stats.dups.push([raw, seen.get(t), t.slice(0, 80)]); else seen.set(t, raw);
    }
  }
  return stats;
}
module.exports = { buildInputs, run, reply, textOf };

if (require.main === module) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const n = +arg("--n", 10000), sess = +arg("--session", 125), clinc = arg("--clinc", null);
  let extra = [];
  const fx = path.join(__dirname, "..", "tests", "fixtures", "human-inputs.txt");
  if (fs.existsSync(fx)) extra = fs.readFileSync(fx, "utf8").split("\n").filter(Boolean);
  if (clinc) {
    const d = JSON.parse(fs.readFileSync(clinc, "utf8"));
    const all = [].concat(d.train, d.val, d.test, d.oos_test, d.oos_val, d.oos_train).map((x) => x[0]);
    const R = rngFor(11);
    for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
    extra = extra.concat(all.slice(0, Math.floor(n * 0.6)));
  }
  const inputs = buildInputs(n, 3, extra);
  const st = run(inputs, sess, 1000);
  console.log({ total: st.total, crashes: st.crashes.length, empties: st.empties.length, repeatedInSession: st.dups.length, withAction: st.actions });
  console.log(Object.entries(st.routes).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + "=" + v).join("  "));
  st.crashes.slice(0, 5).forEach((x) => console.log("CRASH", x));
  st.empties.slice(0, 5).forEach((x) => console.log("EMPTY", x));
  st.dups.slice(0, 5).forEach((x) => console.log("DUP", x));
  process.exitCode = st.crashes.length || st.empties.length || st.dups.length ? 1 : 0;
}
