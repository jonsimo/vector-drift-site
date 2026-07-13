// Vector Drift terminal — hidden operator/debug console (Pass 1)
// -----------------------------------------------------------------------------
// A developer-only channel, opened by typing exactly `debug`. It is NOT a player
// feature and is NOT part of intent classification: terminal.js intercepts it at
// the protected layer, before the intent resolver, and routes ALL input here
// while active. Nothing in this file lives in terminal-intents.js, and debug
// activity never touches player command history / intent counts / download state.
//
// All DOM/audio/boot side-effects go through an injected `api` object so this
// module owns no rendering of its own. Pure routing (normalizeDebug /
// resolveDebugCommand) is exported for tests.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.VDDebug = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const TRIGGER = "debug";

  function normalizeDebug(raw) {
    return String(raw == null ? "" : raw).replace(/[’‘]/g, "'").trim().replace(/\s+/g, " ").toLowerCase();
  }
  function isDebugTrigger(normalized) {
    return normalized === TRIGGER;
  }

  const MAIN_MENU = [
    "OPERATOR INTERFACE",
    "",
    "1. list commands",
    "2. restart console",
    "3. trigger glitch",
    "4. viewport tools",
    "5. audio sampler",
    "6. diagnostics",
    "7. session state",
    "8. response tester",
    "9. timing inspector",
    "10. download tools",
    "11. exit debug",
  ];

  // Pure routing tables per menu view. Numbered + textual aliases only — no fuzzy
  // matching. `exit`/`exit debug` and `help`/`menu` are global (handled first).
  const ROUTES = {
    root: {
      "1": "listCommands", "list commands": "listCommands", "commands": "listCommands",
      "2": "restart", "restart": "restart", "restart console": "restart",
      "3": "glitch", "trigger glitch": "glitch", "glitch": "glitch",
      "4": "viewport", "viewport": "viewport", "viewport tools": "viewport",
      "5": "audio", "audio": "audio", "audio sampler": "audio",
      "6": "diagnostics", "diagnostics": "diagnostics", "diag": "diagnostics",
      "7": "state", "state": "state", "session state": "state",
      "8": "responses", "responses": "responses", "response tester": "responses",
      "9": "timing", "timing": "timing", "timing inspector": "timing",
      "10": "download", "download": "download", "download tools": "download",
      "11": "exit",
    },
    restart: {
      "1": "restart.interactive", "interactive": "restart.interactive", "interactive session": "restart.interactive",
      "2": "restart.boot", "boot": "restart.boot", "full boot": "restart.boot", "full boot sequence": "restart.boot",
      "3": "restart.session", "clear": "restart.session", "clear session": "restart.session", "clear session state": "restart.session",
      "4": "cancel", "cancel": "cancel", "back": "cancel",
    },
    glitch: {
      "1": "glitch.scramble", "text scramble": "glitch.scramble", "scramble": "glitch.scramble",
      "2": "glitch.observer", "observer anomaly": "glitch.observer", "observer": "glitch.observer",
      "3": "glitch.status", "status anomaly": "glitch.status", "status": "glitch.status",
      "4": "glitch.boot", "boot corruption": "glitch.boot", "boot": "glitch.boot",
      "5": "cancel", "cancel": "cancel", "back": "cancel",
    },
    viewport: {
      "1": "viewport.desktop", "desktop": "viewport.desktop", "force desktop": "viewport.desktop",
      "2": "viewport.tablet", "tablet": "viewport.tablet", "force tablet": "viewport.tablet",
      "3": "viewport.mobile", "mobile": "viewport.mobile", "force mobile": "viewport.mobile",
      "4": "viewport.auto", "auto": "viewport.auto", "automatic": "viewport.auto", "automatic mode": "viewport.auto",
      "cancel": "cancel", "back": "cancel",
    },
    audio: {
      "1": "audio.boot", "boot": "audio.boot",
      "2": "audio.glitch", "glitch": "audio.glitch",
      "3": "audio.terminal", "terminal": "audio.terminal",
      "4": "audio.download", "download": "audio.download",
      "5": "audio.ui", "ui": "audio.ui",
      "6": "audio.all", "all": "audio.all",
      "cancel": "cancel", "back": "cancel",
    },
    responses: {
      "1": "responses.greeting", "greeting": "responses.greeting",
      "2": "responses.identity", "identity": "responses.identity",
      "3": "responses.status", "status": "responses.status",
      "4": "responses.humanity", "humanity": "responses.humanity",
      "5": "responses.unknown", "unknown": "responses.unknown",
      "6": "cancel", "cancel": "cancel", "back": "cancel",
      "mutate yes": "responses.mutateOn", "mutate no": "responses.mutateOff",
    },
    download: {
      "1": "download.validate", "validate": "download.validate", "validate package": "download.validate",
      "2": "download.transfer", "test transfer": "download.transfer", "transfer": "download.transfer",
      "3": "cancel", "cancel": "cancel", "back": "cancel",
    },
    // audiofiles is data-driven (numeric = play index); handled in the controller.
    audiofiles: { "back": "cancel", "cancel": "cancel" },
  };

  function resolveDebugCommand(normalized, view) {
    if (normalized === "exit" || normalized === "exit debug") {
      return "exit";
    }
    if (normalized === "help" || normalized === "menu") {
      return "menu";
    }
    const table = ROUTES[view] || ROUTES.root;
    return Object.prototype.hasOwnProperty.call(table, normalized) ? table[normalized] : null;
  }

  // ---------------------------------------------------------------------------
  // Controller — holds isolated debug state; executes actions via the injected
  // api. None of this state is shared with the player session.
  // ---------------------------------------------------------------------------
  function createDebugState() {
    return {
      debugModeActive: false,
      view: "root",
      debugCommandHistory: [],
      selectedDebugCategory: null,
      audioSelection: { category: null, files: [], index: 0 },
      viewportOverride: "auto",
      mutateResponses: false,
    };
  }

  const state = createDebugState();
  let api = null;

  function init(injected) {
    api = injected;
  }
  function isActive() {
    return state.debugModeActive;
  }

  function printLines(lines, className) {
    for (const line of lines) {
      api.print(line, className || "terminal-response");
    }
  }
  function renderMain() {
    state.view = "root";
    printLines(MAIN_MENU);
  }

  async function enter() {
    state.debugModeActive = true;
    state.view = "root";
    state.debugCommandHistory.length = 0;
    api.setPrompt("operator");
    printLines(["operator channel opened", "", "permission:", "LOCAL DEVELOPMENT", ""]);
    printLines(MAIN_MENU);
    printLines(["", "type a number or name  ·  menu to return  ·  exit debug to leave"]);
  }

  async function handle(raw) {
    const n = normalizeDebug(raw);
    state.debugCommandHistory.push(raw);
    if (!n) {
      return;
    }
    // Data-driven audio file view: a bare number plays that file.
    if (state.view === "audiofiles" && /^\d+$/.test(n) && n !== "0") {
      return playAudioIndex(parseInt(n, 10) - 1);
    }
    const action = resolveDebugCommand(n, state.view);
    if (!action) {
      api.print("unknown operator command", "terminal-error");
      return;
    }
    return dispatch(action);
  }

  async function dispatch(action) {
    switch (action) {
      case "menu": return renderMain();
      case "listCommands": return listCommands();

      case "restart":
        state.view = "restart";
        return printLines(["RESTART TARGET", "", "1. interactive session", "2. full boot sequence", "3. clear session state", "4. cancel"]);
      case "restart.interactive": return restartInteractive();
      case "restart.boot":
        api.print("restarting boot sequence...", "terminal-meta");
        await api.sleep(220);
        return api.restartBoot();
      case "restart.session":
        api.resetSession();
        state.view = "root";
        return api.print("session state cleared");

      case "glitch":
        state.view = "glitch";
        return printLines(["GLITCH TESTS", "", "1. text scramble", "2. observer anomaly", "3. status anomaly", "4. boot corruption", "5. cancel"]);
      case "glitch.scramble": return glitchScramble();
      case "glitch.observer": return glitchObserver();
      case "glitch.status": return glitchStatus();
      case "glitch.boot": return glitchBoot();

      case "viewport":
        state.view = "viewport";
        return printLines(["VIEWPORT CONTROL", "", "1. force desktop", "2. force tablet", "3. force mobile", "4. automatic mode", "", `current override: ${state.viewportOverride}`]);
      case "viewport.desktop": return setViewport("desktop");
      case "viewport.tablet": return setViewport("tablet");
      case "viewport.mobile": return setViewport("mobile");
      case "viewport.auto": return setViewport("auto");

      case "audio":
        state.view = "audio";
        return printLines(["AUDIO BANK", "", "1. boot", "2. glitch", "3. terminal", "4. download", "5. ui", "6. all"]);
      case "audio.boot": return openAudioCategory("boot");
      case "audio.glitch": return openAudioCategory("glitch");
      case "audio.terminal": return openAudioCategory("terminal");
      case "audio.download": return openAudioCategory("download");
      case "audio.ui": return openAudioCategory("ui");
      case "audio.all": return openAudioCategory("all");

      case "diagnostics": return diagnostics();
      case "state": return sessionState();

      case "responses":
        state.view = "responses";
        return printLines(["RESPONSE TESTER", "", "1. greeting", "2. identity", "3. status", "4. humanity", "5. unknown", "6. cancel", "", `run with state mutation: ${state.mutateResponses ? "yes" : "no"}`, "(type: mutate yes / mutate no)"]);
      case "responses.greeting": return testResponse("greeting", "hello");
      case "responses.identity": return testResponse("identity", "who are you");
      case "responses.status": return testResponse("status", "status");
      case "responses.humanity": return testResponse("humanity", "are you alive");
      case "responses.unknown": return testResponse("unknown", null);
      case "responses.mutateOn": state.mutateResponses = true; return api.print("state mutation: yes");
      case "responses.mutateOff": state.mutateResponses = false; return api.print("state mutation: no");

      case "timing": return timing();

      case "download":
        state.view = "download";
        return printLines(["DOWNLOAD TESTS", "", "1. validate package", "2. test transfer", "3. cancel"]);
      case "download.validate": return validatePackage();
      case "download.transfer":
        return api.print("test transfer is manual — not auto-started (run download.exe outside debug)", "terminal-meta");

      case "cancel": return renderMain();
      case "exit": return exitDebug();
      default: return api.print("unknown operator command", "terminal-error");
    }
  }

  // --- Actions ---------------------------------------------------------------
  function listCommands() {
    const registry = api.vdi.INTENTS;
    const aliasCount = registry.reduce((sum, it) => sum + it.aliases.length, 0);
    printLines([
      "PLAYER COMMANDS", "",
      ...api.playerCommands, "",
      "HIDDEN COMMANDS", "",
      ...api.loreCommands, "",
      "OPERATOR COMMANDS", "",
      "debug", "restart", "glitch", "viewport", "audio", "state", "responses", "timing", "download", "",
      `intent groups: ${registry.length}`,
      `aliases: ${aliasCount}`,
    ]);
  }

  function restartInteractive() {
    api.restartInteractive();
    exitDebug("interactive console reset");
  }

  async function glitchScramble() {
    api.print("starting visual anomaly test...", "terminal-meta");
    const samples = [
      "vd_scope   READY  local  beam convergence nominal",
      "vd_motion  READY  local  ghost samples: 1187",
      "lattice grid mounted / drift 0.0003",
    ].map((text) => ({ el: api.appendLine(text), text }));
    for (let frame = 0; frame < 6; frame += 1) {
      for (const s of samples) {
        api.rewrite(s.el, api.corrupt(s.text, 0.5, frame + 1));
      }
      await api.sleep(70);
    }
    for (const s of samples) {
      api.rewrite(s.el, s.text);
    }
  }

  async function glitchObserver() {
    api.print("starting observer anomaly test...", "terminal-meta");
    const observer = api.appendLine("vd_observer  MISSING  none        interface unavailable");
    const cortex = api.appendLine("vd_cortex    WAIT     unassigned  organic bridge detected");
    const resolving = api.appendLine("io>loader/ resolving missing interface ...");
    await api.sleep(200);
    await api.runAxiomReveal(observer, cortex, resolving);
  }

  async function glitchStatus() {
    api.print("starting status anomaly test...", "terminal-meta");
    // Reuse the REAL status builder on a throwaway session, forcing the anomaly.
    const throwaway = api.vdi.createSession();
    const forced = () => 0.1;
    const resolution = api.vdi.resolveCommand("status");
    const { steps } = api.vdi.selectResponse(resolution, throwaway, forced);
    return api.runResponse(steps);
  }

  async function glitchBoot() {
    api.print("starting boot corruption test...", "terminal-meta");
    const samples = [
      "VECTOR DRIFT RELAY BIOS 2.13 ............. NODE 10.0.1.00",
      "BASE MEMORY ............................. 640K / 8192K VECTOR PAGE",
      "KERNEL FAMILY ........................... UNRESOLVED",
    ].map((text) => ({ el: api.appendLine(text), text }));
    for (let frame = 0; frame < 8; frame += 1) {
      for (const s of samples) {
        api.rewrite(s.el, api.corrupt(s.text, 0.6, frame + 3));
      }
      await api.sleep(60);
    }
    for (const s of samples) {
      api.rewrite(s.el, s.text);
    }
  }

  function setViewport(mode) {
    state.viewportOverride = mode;
    api.setViewportOverride(mode);
    printLines([`viewport override: ${mode}`, "presentation flag set (live re-layout deferred; CSS frozen this pass)"], "terminal-meta");
  }

  function allAudio() {
    const bank = api.audioBank;
    return ["boot", "glitch", "terminal", "download", "ui"].reduce((acc, cat) => acc.concat(bank[cat] || []), []);
  }
  function openAudioCategory(cat) {
    const files = cat === "all" ? allAudio() : (api.audioBank[cat] || []);
    state.selectedDebugCategory = cat;
    state.audioSelection = { category: cat, files, index: 0 };
    state.view = "audiofiles";
    const header = [`${cat.toUpperCase()} AUDIO`, ""];
    if (!files.length) {
      return printLines(header.concat(["no audio in this category", "", "back to return"]), "terminal-meta");
    }
    const rows = files.map((f, i) => `${String(i + 1).padStart(2, "0")} ${f.name}`);
    return printLines(header.concat(rows, ["", "enter number to play / back to return"]));
  }
  function playAudioIndex(i) {
    const f = state.audioSelection.files[i];
    if (!f) {
      return api.print("invalid selection", "terminal-error");
    }
    state.audioSelection.index = i;
    const info = api.playAudio(f);
    const lines = ["playing:", "", f.name];
    if (info && info.unavailable) {
      return printLines([`${f.name} ..... unavailable`], "terminal-error");
    }
    if (info && info.duration) {
      lines.push("", `duration: ${info.duration}`);
    }
    return printLines(lines);
  }

  function diagnostics() {
    const session = api.session();
    printLines([
      "SYSTEM DIAGNOSTICS", "",
      "terminal ................. READY",
      "boot ..................... COMPLETE",
      "download ................. READY",
      `commands ................. ${api.playerCommands.length}`,
      `intents .................. ${api.vdi.INTENTS.length}`,
      `session commands ......... ${session.commandCount}`,
      `last intent .............. ${session.lastIntent || "none"}`,
    ]);
  }

  function sessionState() {
    const s = api.session();
    const ic = s.intentCounts || {};
    const yn = (v) => (v ? "used" : "not used");
    printLines([
      "SESSION STATE", "",
      `commands ................. ${s.commandCount}`,
      "", "intent counts:",
      `  greeting ............... ${ic.greeting || 0}`,
      `  identity ............... ${ic.identity || 0}`,
      `  status ................. ${ic.status || 0}`,
      "", "rare events:",
      `  identity anomaly ....... ${yn(s.anomaliesShown && s.anomaliesShown.identity_system)}`,
      `  status anomaly ......... ${yn(s.anomaliesShown && s.anomaliesShown.status)}`,
      `  fictional history ...... ${s.fictionalHistoryInserted ? "inserted" : "not inserted"}`,
    ]);
  }

  async function testResponse(intentId, alias) {
    const session = state.mutateResponses ? api.session() : api.vdi.createSession();
    api.print(`[response tester: ${intentId}${state.mutateResponses ? " / live session" : " / sandbox"}]`, "terminal-meta");
    let steps;
    if (intentId === "unknown") {
      steps = api.vdi.selectUnknown(session, Math.random).steps;
    } else {
      const resolution = api.vdi.resolveCommand(alias);
      steps = api.vdi.selectResponse(resolution, session, Math.random).steps;
    }
    return api.runResponse(steps);
  }

  function timing() {
    printLines([
      "TIMING STATUS", "",
      "boot ..................... frozen",
      "response system .......... active",
      `last response ............ ${api.lastResponseMs() ? api.lastResponseMs() + "ms" : "n/a"}`,
      `last command ............. ${api.lastCommand() || "none"}`,
      `current state ............ ${api.terminalState()}`,
    ]);
  }

  async function validatePackage() {
    api.print("validating package manifest...", "terminal-meta");
    try {
      const info = await api.resolveLatestPackage();
      printLines([
        "PACKAGE VALIDATION", "",
        `target ................... ${info.target.os} / ${info.target.arch}`,
        `asset .................... ${info.filename || "none"}`,
        `size ..................... ${info.size != null ? info.size + " bytes" : "unknown / streaming"}`,
        "manifest ................. OK",
      ]);
    } catch (error) {
      api.print(`manifest unavailable (${error.status || "error"})`, "terminal-error");
    }
  }

  function exitDebug(message) {
    state.debugModeActive = false;
    state.view = "root";
    state.selectedDebugCategory = null;
    api.setPrompt("console");
    api.print(message || "operator channel closed");
  }

  // Optional keyboard handling for the audio browser (up/down select, enter play,
  // escape back). Returns true if the key was consumed.
  function handleKey(event) {
    if (!state.debugModeActive || state.view !== "audiofiles") {
      return false;
    }
    const files = state.audioSelection.files;
    if (event.key === "Escape") {
      state.view = "audio";
      api.print("back");
      return true;
    }
    if (!files.length) {
      return false;
    }
    if (event.key === "ArrowUp") {
      state.audioSelection.index = Math.max(0, state.audioSelection.index - 1);
      api.print(`> ${files[state.audioSelection.index].name}`, "terminal-meta");
      return true;
    }
    if (event.key === "ArrowDown") {
      state.audioSelection.index = Math.min(files.length - 1, state.audioSelection.index + 1);
      api.print(`> ${files[state.audioSelection.index].name}`, "terminal-meta");
      return true;
    }
    return false;
  }

  return {
    // pure (tested)
    normalizeDebug,
    isDebugTrigger,
    resolveDebugCommand,
    createDebugState,
    MAIN_MENU,
    ROUTES,
    // controller
    init,
    isActive,
    enter,
    handle,
    handleKey,
  };
});
