"use strict";

// Tests for the operator/debug console routing (terminal-debug.js). Pure layer
// only — normalizeDebug + resolveDebugCommand + trigger. Side-effecting actions
// go through an injected api and are exercised by the in-browser drive.
const test = require("node:test");
const assert = require("node:assert/strict");
const D = require("../terminal-debug.js");
const VDI = require("../terminal-intents.js");

// --- Entering debug --------------------------------------------------------
test("debug trigger normalizes case/whitespace, exact only", () => {
  // entry uses the PLAYER normalizer in terminal.js; both agree on these:
  for (const s of ["debug", "DEBUG", "  debug  ", "Debug"]) {
    assert.equal(VDI.normalizeTerminalInput(s).normalized, "debug", s);
    assert.equal(D.isDebugTrigger("debug"), true);
  }
  assert.equal(D.isDebugTrigger("debug now"), false);
  assert.equal(D.isDebugTrigger("debugger"), false);
});

test("debug is NOT a player intent", () => {
  // resolveCommand must never classify `debug` as intent/protected/utility.
  const r = VDI.resolveCommand("debug");
  assert.equal(r.kind, "unknown");
  assert.equal(VDI.classifyIntent("debug"), null);
});

// --- Menu routing ----------------------------------------------------------
test("main menu: numbered + textual route identically", () => {
  const cases = [
    ["1", "listCommands"], ["list commands", "listCommands"], ["commands", "listCommands"],
    ["2", "restart"], ["restart console", "restart"],
    ["3", "glitch"], ["trigger glitch", "glitch"],
    ["4", "viewport"], ["5", "audio"], ["6", "diagnostics"], ["7", "state"],
    ["8", "responses"], ["9", "timing"], ["10", "download"], ["11", "exit"],
    ["help", "menu"], ["menu", "menu"],
  ];
  for (const [input, expected] of cases) {
    assert.equal(D.resolveDebugCommand(input, "root"), expected, input);
  }
});

test("submenu routing (restart / glitch / viewport / audio / responses / download)", () => {
  assert.equal(D.resolveDebugCommand("1", "restart"), "restart.interactive");
  assert.equal(D.resolveDebugCommand("2", "restart"), "restart.boot");
  assert.equal(D.resolveDebugCommand("3", "restart"), "restart.session");
  assert.equal(D.resolveDebugCommand("4", "restart"), "cancel");
  assert.equal(D.resolveDebugCommand("1", "glitch"), "glitch.scramble");
  assert.equal(D.resolveDebugCommand("3", "glitch"), "glitch.status");
  assert.equal(D.resolveDebugCommand("3", "viewport"), "viewport.mobile");
  assert.equal(D.resolveDebugCommand("6", "audio"), "audio.all");
  assert.equal(D.resolveDebugCommand("2", "responses"), "responses.identity");
  assert.equal(D.resolveDebugCommand("mutate yes", "responses"), "responses.mutateOn");
  assert.equal(D.resolveDebugCommand("1", "download"), "download.validate");
});

// --- Exit ------------------------------------------------------------------
test("exit works from any view", () => {
  for (const view of ["root", "restart", "glitch", "audio", "download"]) {
    assert.equal(D.resolveDebugCommand("exit", view), "exit", view);
    assert.equal(D.resolveDebugCommand("exit debug", view), "exit", view);
  }
  assert.equal(D.resolveDebugCommand("11", "root"), "exit");
});

// --- Safety ----------------------------------------------------------------
test("download.exe inside debug never routes to a download", () => {
  // In every debug view, download.exe resolves to null -> "unknown operator
  // command"; it can never reach the real transfer.
  for (const view of ["root", "restart", "glitch", "audio", "download", "responses"]) {
    assert.equal(D.resolveDebugCommand("download.exe", view), null, view);
  }
  // Meanwhile, OUTSIDE debug, download.exe is still the protected handler.
  assert.equal(VDI.resolveCommand("download.exe").kind, "protected");
});

test("unknown operator input resolves to null (no fuzzy matching)", () => {
  assert.equal(D.resolveDebugCommand("zxcv", "root"), null);
  assert.equal(D.resolveDebugCommand("downlo", "root"), null);
  assert.equal(D.resolveDebugCommand("glit", "root"), null);
});

// --- State isolation -------------------------------------------------------
test("debug state is created independent of player session", () => {
  const s = D.createDebugState();
  assert.equal(s.debugModeActive, false);
  assert.equal(s.view, "root");
  assert.deepEqual(s.debugCommandHistory, []);
  assert.equal(s.viewportOverride, "auto");
  // no overlap with player-session field names
  assert.ok(!("intentCounts" in s));
  assert.ok(!("commandCount" in s));
  assert.ok(!("downloadStarted" in s));
});
