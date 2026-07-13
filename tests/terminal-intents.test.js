"use strict";

// Tests for the pure intent layer (terminal-intents.js). No DOM: the module is
// DOM-free by design, so `node --test tests/` runs it directly.
const test = require("node:test");
const assert = require("node:assert/strict");
const VDI = require("../terminal-intents.js");

const norm = (s) => VDI.normalizeTerminalInput(s).normalized;
const resolve = (s) => VDI.resolveCommand(norm(s));
const classify = (s) => VDI.classifyIntent(norm(s));
// Collect the printed text of a response's steps.
const texts = (steps) => steps.filter((s) => s.type === "print").map((s) => s.text);
const hasRewrite = (steps) => steps.some((s) => s.type === "rewrite");

// --- Normalization ---------------------------------------------------------
test("normalization", () => {
  assert.equal(norm("Who are you?"), "who are you");
  assert.equal(norm("  WHO   ARE   YOU??? "), "who are you");
  assert.equal(norm("hello!"), "hello");
  assert.equal(norm("STATUS."), "status");
  assert.equal(norm("./download.exe"), "download.exe");
  assert.equal(norm("?"), "?"); // never stripped to empty (bare "?" is a help alias)
  assert.equal(norm("who’re you"), "who're you"); // curly apostrophe -> straight
  assert.equal(norm(""), "");
  assert.equal(norm("   "), "");
});

// --- Alias registry is clean ----------------------------------------------
test("no duplicate aliases across intents", () => {
  assert.deepEqual(VDI.findDuplicateAliases(), []);
});

test("every intent alias resolves back to its own intent", () => {
  for (const intent of VDI.INTENTS) {
    for (const alias of intent.aliases) {
      const r = VDI.resolveCommand(alias);
      assert.equal(r.kind, "intent", `alias "${alias}" should resolve to an intent`);
      assert.equal(r.id, intent.id, `alias "${alias}" should map to ${intent.id}`);
    }
  }
});

// --- Identity --------------------------------------------------------------
test("identity classification", () => {
  for (const s of ["whoami", "who am i?", "who is this", "what are you", "identify yourself"]) {
    assert.equal(classify(s), "identity", s);
  }
});

test("identity sub-classification (user vs system)", () => {
  assert.equal(resolve("whoami").subtype, "user");
  assert.equal(resolve("who am i").subtype, "user");
  assert.equal(resolve("who are you").subtype, "system");
  assert.equal(resolve("identify yourself").subtype, "system");
});

// --- Greeting --------------------------------------------------------------
test("greeting classification", () => {
  for (const s of ["hello", "hello?", "hi", "is anyone there"]) {
    assert.equal(classify(s), "greeting", s);
  }
});

// --- Help vs assistance ----------------------------------------------------
test("help classification", () => {
  assert.equal(classify("help"), "help");
  assert.equal(classify("what can i do"), "help");
  assert.equal(classify("?"), "help");
});

test("help me routes to assistance, not generic help", () => {
  assert.equal(classify("help me"), "assistance");
});

// --- Status / location / exit ---------------------------------------------
test("status classification", () => {
  assert.equal(classify("status"), "status");
  assert.equal(classify("system health"), "status");
});

test("location classification and sub-type", () => {
  assert.equal(classify("pwd"), "location");
  assert.equal(classify("where am i"), "location");
  assert.equal(resolve("pwd").subtype, "path");
  assert.equal(resolve("where am i").subtype, "query");
});

test("exit classification and soft sub-type", () => {
  assert.equal(classify("goodbye"), "exit");
  assert.equal(classify("disconnect"), "exit");
  assert.equal(resolve("goodbye").subtype, "soft");
  assert.equal(resolve("exit").subtype, "hard");
});

// --- Download safety -------------------------------------------------------
test("download.exe (and case/dotslash variants) hit the protected handler", () => {
  for (const s of ["download.exe", "DOWNLOAD.EXE", "./download.exe", "  download.exe  "]) {
    const r = resolve(s);
    assert.equal(r.kind, "protected", s);
    assert.equal(r.id, "download.exe", s);
  }
});

test("download hints never trigger the protected handler", () => {
  assert.equal(resolve("download").id, "downloadHint");
  assert.equal(resolve("download beta").id, "downloadBetaHint");
  assert.equal(resolve("please download").id, "downloadBetaHint");
  assert.equal(resolve("get beta").id, "downloadBetaHint");
});

test("dangerous near-misses never download", () => {
  for (const s of ["download.exe now", "run download.exe", "/download.exe", "download.exe.exe", "downloader", "download file"]) {
    const r = resolve(s);
    assert.notEqual(r.kind, "protected", `"${s}" must not be protected`);
    assert.ok(r.id !== "download.exe", `"${s}" must not be download.exe`);
  }
});

// --- Unknown / empty -------------------------------------------------------
test("unknown and empty", () => {
  assert.equal(resolve("zxcvbnm qwerty").kind, "unknown");
  assert.equal(resolve("").kind, "empty");
  assert.equal(classify(""), null);
});

// --- Session state: repeat greeting ---------------------------------------
test("repeat greeting produces a different (repeat) variant, then exhausts", () => {
  const s = VDI.createSession();
  const rng = VDI.makeRng(1);
  const r = VDI.resolveCommand("hello");
  const first = texts(VDI.selectResponse(r, s, rng).steps);
  const second = texts(VDI.selectResponse(r, s, rng).steps);
  const third = VDI.selectResponse(r, s, rng).steps;
  const repeatBank = ["channel remains open", "input already acknowledged", "still connected", "no additional handshake required"];
  assert.ok(repeatBank.includes(second[0]), `2nd greeting should be a repeat variant, got ${second[0]}`);
  assert.notDeepEqual(second, first);
  assert.equal(texts(third)[0], "greeting protocol exhausted");
});

// --- Session state: rare response cannot repeat ----------------------------
test("a rare response fires at most once per session", () => {
  const s = VDI.createSession();
  const alwaysRare = () => 0.01; // < humanity rare threshold (0.06)
  const r = VDI.resolveCommand("are you alive");
  const first = texts(VDI.selectResponse(r, s, alwaysRare).steps);
  const second = texts(VDI.selectResponse(r, s, alwaysRare).steps);
  assert.ok(first.includes("not for you"), "first should be the rare response");
  assert.ok(!second.includes("not for you"), "rare must not fire twice");
});

// --- Session state: status anomaly only once -------------------------------
test("status anomaly is rare and fires at most once per session", () => {
  let sessionsWithAnomaly = 0;
  for (let seed = 0; seed < 40; seed += 1) {
    const s = VDI.createSession();
    const rng = VDI.makeRng(seed);
    const r = VDI.resolveCommand("status");
    let rewrites = 0;
    for (let i = 0; i < 6; i += 1) {
      if (hasRewrite(VDI.selectResponse(r, s, rng).steps)) rewrites += 1;
    }
    assert.ok(rewrites <= 1, `session ${seed} had ${rewrites} status anomalies`);
    if (rewrites === 1) sessionsWithAnomaly += 1;
  }
  // Genuinely rare, but not impossible and not every session.
  assert.ok(sessionsWithAnomaly > 0, "anomaly never fired across 40 seeds");
  assert.ok(sessionsWithAnomaly < 40, "anomaly fired every session (not rare)");
});

test("conversational replies carry a processing lead; diagnostics are instant", () => {
  const s = VDI.createSession();
  const help = VDI.selectResponse(VDI.resolveCommand("help"), s, VDI.makeRng(1)).steps;
  assert.equal(help[0].type, "print", "diagnostics dump immediately");
  const s2 = VDI.createSession();
  const greet = VDI.selectResponse(VDI.resolveCommand("hello"), s2, () => 0.9).steps;
  assert.equal(greet[0].type, "hold", "neutral greeting leads with a short hold");
});

// --- Session state: identity system contradiction once ---------------------
test("identity system anomaly appears once", () => {
  const s = VDI.createSession();
  const rng = VDI.makeRng(3);
  const r = VDI.resolveCommand("who are you");
  const first = VDI.selectResponse(r, s, rng).steps;
  assert.ok(hasRewrite(first), "first system identity should flip the owner field");
  const second = VDI.selectResponse(r, s, rng).steps;
  // second identity query is the repeat bank, no table / no rewrite
  assert.ok(!hasRewrite(second));
  assert.ok(["identity data unchanged", "no additional identity record available"].includes(texts(second)[0]));
});

test("user table and system table each reveal once, independently", () => {
  const s = VDI.createSession();
  const rng = VDI.makeRng(2);
  const user1 = texts(VDI.selectResponse(VDI.resolveCommand("whoami"), s, rng).steps);
  const sys1 = texts(VDI.selectResponse(VDI.resolveCommand("who are you"), s, rng).steps);
  // asking about the user first must NOT suppress the distinct system table
  assert.ok(user1.includes("IDENTITY QUERY"), "user query shows IDENTITY QUERY");
  assert.ok(sys1.includes("SYSTEM QUERY"), "system query still shows SYSTEM QUERY");
  const user2 = texts(VDI.selectResponse(VDI.resolveCommand("whoami"), s, rng).steps);
  assert.ok(!user2.includes("IDENTITY QUERY"), "second user query falls to repeat bank");
});

test("awareness probes route to humanity, not greeting", () => {
  for (const s of ["can you hear me", "are you alive", "are you watching me"]) {
    assert.equal(classify(s), "humanity", s);
  }
});

// --- Fictional history -----------------------------------------------------
test("history inserts exactly one fictional entry, never into recall", () => {
  const s = VDI.createSession();
  const raw = ["status", "who are you?", "history"];
  const display = VDI.insertFictionalHistory(raw, s);
  assert.deepEqual(raw, ["status", "who are you?", "history"], "raw history must not be mutated");
  assert.ok(display.includes(VDI.FICTIONAL_HISTORY_ENTRY), "display should include the fictional entry");
  assert.equal(display.length, raw.length + 1);
  // placed just before the current history command
  assert.equal(display[display.length - 2], VDI.FICTIONAL_HISTORY_ENTRY);
  assert.equal(display[display.length - 1], "history");
  // re-running does not double-insert
  const again = VDI.insertFictionalHistory(raw.concat([VDI.FICTIONAL_HISTORY_ENTRY]), s);
  assert.equal(again.filter((x) => x === VDI.FICTIONAL_HISTORY_ENTRY).length, 1);
});

// --- Unknown special sequence once -----------------------------------------
test("unknown special two-part beat fires once after 4 unknowns", () => {
  const s = VDI.createSession();
  const rng = VDI.makeRng(9);
  const out = () => texts(VDI.selectUnknown(s, rng).steps)[0];
  assert.equal(out(), "command not found"); // 1
  out(); // 2
  out(); // 3
  assert.equal(out(), "the interface is not designed for conversation"); // 4
  assert.equal(out(), "yet"); // 5
  const sixth = out(); // 6 -> back to normal bank
  assert.notEqual(sixth, "yet");
  assert.notEqual(sixth, "the interface is not designed for conversation");
  // it never fires again
  const rest = [out(), out(), out(), out(), out()];
  assert.ok(!rest.includes("the interface is not designed for conversation"));
  assert.ok(!rest.includes("yet"));
});

// --- Determinism -----------------------------------------------------------
test("same seed -> same selection", () => {
  const run = () => {
    const s = VDI.createSession();
    const rng = VDI.makeRng(42);
    return texts(VDI.selectResponse(VDI.resolveCommand("hello"), s, rng).steps);
  };
  assert.deepEqual(run(), run());
});

// --- No story terminology leaks in authored intent text --------------------
test("no forbidden story terms in intent response banks", () => {
  const forbidden = /\b(axiom|alien|sentient being|faction)\b/i;
  const s = VDI.createSession();
  for (const intent of VDI.INTENTS) {
    if (intent.id === "history") continue; // live data, rendered by terminal.js
    // exercise first-use, repeat, and exhausted paths
    for (let i = 0; i < 4; i += 1) {
      const r = { kind: "intent", id: intent.id, subtype: VDI.subclassify(intent.id, intent.aliases[0]), normalized: intent.aliases[0] };
      for (const t of texts(VDI.selectResponse(r, s, VDI.makeRng(i + 1)).steps)) {
        assert.ok(!forbidden.test(t), `intent ${intent.id} leaked: "${t}"`);
      }
    }
  }
});
