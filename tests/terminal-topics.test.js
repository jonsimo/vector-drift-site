"use strict";
// The topics layer answers everything the exact-match intents do not know.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const VDI = require("../terminal-intents.js");
const T = require("../terminal-topics.js");
const L = require("../terminal-lexicon.js");
const sim = require("../tools/simulate-console.js");

function ask(raw, session, rng) {
  session = session || VDI.createSession();
  rng = rng || VDI.makeRng(4);
  return sim.reply(session, rng, raw);
}
const printed = (r) => sim.textOf(r.steps);

test("game facts are stated plainly and include linux", () => {
  assert.match(printed(ask("when is vector drift coming out")), /dec 2026/);
  assert.match(printed(ask("what platforms is it on")), /macOS \/ windows \/ linux/);
  assert.match(printed(ask("is there a linux version")), /linux/);
  assert.match(printed(ask("is it on the switch")), /not announced/);
  assert.match(printed(ask("who made this")), /jon simo/);
  assert.match(printed(ask("how much does it cost")), /not announced/);
});

test("real gameplay facts from the design notes are stated", () => {
  assert.match(printed(ask("what are the powerups")), /berserker/);
  assert.match(printed(ask("how many lives do i have")), /hull .* does not regenerate/);
  assert.match(printed(ask("is there co-op")), /team power-ups .* death tether/);
  assert.match(printed(ask("how many levels are there")), /asteroid belts/);
  assert.match(printed(ask("what is lux")), /LUX/);
  assert.match(printed(ask("how do i play")), /secondary fire/);
});

test("requests are routed to the right place", () => {
  assert.ok(ask("play some music").steps.some((s) => s.type === "goto" && s.section === "soundtrack"));
  assert.ok(ask("show me screenshots").steps.some((s) => s.type === "goto" && s.section === "media"));
  assert.ok(ask("cd media").steps.some((s) => s.type === "goto" && s.section === "media"));
  assert.ok(ask("tell me about the devlog").steps.some((s) => s.type === "goto" && s.section === "devlog"));
  assert.ok(ask("how do i sign up for the newsletter").steps.some((s) => s.type === "run" && s.command === "email.exe"));
});

test("sections are not triggered by the bare word 'about'", () => {
  const r = ask("what do you know about axiom");
  assert.ok(!r.steps.some((s) => s.type === "goto"), "no navigation");
  assert.equal(T.lastRoute(), "game:lore");
});

test("arithmetic, dice and coin give real results", () => {
  assert.match(printed(ask("12*12")), /144/);
  assert.match(printed(ask("what is 15% of 200")), /30/);
  assert.match(printed(ask("sqrt 16")), /4/);
  assert.match(printed(ask("1/0")), /infinity/);
  assert.match(printed(ask("roll a d20")), /d20/);
  assert.match(printed(ask("flip a coin")), /heads|tails/);
});

test("shell commands are recognised and never executed", () => {
  assert.match(printed(ask("rm -rf /")), /removal|permissions/);
  assert.match(printed(ask("git status")), /repository|tracked/);
  assert.match(printed(ask("echo hello there")), /hello there/);
  assert.match(printed(ask("cd nowhere")), /nowhere/);
});

test("short answers are only believed for short inputs", () => {
  assert.notEqual(T.lastRoute() && (ask("i am so hungry"), T.lastRoute()), "family:name_user");
  ask("my name is jon");
  assert.equal(VDI.resolveCommand("my name is jon").id, "intro");
  ask("what is the capital of france");
  assert.notEqual(T.lastRoute(), "family:math");
});

test("sentiment gets a fitting answer", () => {
  assert.match(printed(ask("this isnt fun")), /dissatisfaction|negative|complaint|criticism/);
  assert.match(printed(ask("i love this game")), /positive|approval|praise|favourable/);
  assert.match(printed(ask("im so confused")), /disorientation|confusion|assistance/);
});

test("the lexicon sorts ordinary requests into families", () => {
  assert.equal(L.classify("what is the weather today").family, "weather");
  assert.equal(L.classify("book me a flight to paris").family, "travel");
  assert.equal(L.classify("tell me a joke").family, "joke");
});

test("nothing is repeated inside a session, even when the same thing is asked again and again", () => {
  const session = VDI.createSession(), rng = VDI.makeRng(9), seen = new Set();
  for (const raw of ["what are the powerups", "what are the powerups", "what are the powerups", "powerups?", "any powerups", "status", "status", "status", "hello", "hello", "hello", "zzzz", "zzzz", "weather", "weather", "weather"]) {
    const t = printed(ask(raw, session, rng));
    assert.ok(!seen.has(t), `repeated reply for "${raw}": ${t}`);
    seen.add(t);
  }
});

test("simulation: thousands of human-looking inputs, no crash, no empty reply, no repeat per session", () => {
  const fx = path.join(__dirname, "fixtures", "human-inputs.txt");
  const extra = fs.readFileSync(fx, "utf8").split("\n").filter(Boolean);
  const st = sim.run(sim.buildInputs(5000, 3, extra), 125, 1000);
  assert.equal(st.total, 5000);
  assert.deepEqual(st.crashes, []);
  assert.deepEqual(st.empties, []);
  assert.deepEqual(st.dups, []);
  assert.ok(st.actions > 500, "a good share of replies carry an action (route, link, program)");
});
