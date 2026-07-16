// Vector Drift terminal — intent layer (Pass 1)
// -----------------------------------------------------------------------------
// PURE, DOM-FREE. Owns normalization, the intent registry, command resolution,
// session state, and response *selection*. Responses are returned as structured
// step data ({ steps: [...] }); terminal.js interprets those steps against the
// DOM. Nothing here touches the document, so the whole module is require-able in
// Node for `node --test` and is deterministic when handed a seeded rng.
//
// UMD-ish wrapper: assigns window.VDIntents in the browser (loaded as a plain
// <script> before terminal.js) and module.exports under Node/CommonJS.
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.VDIntents = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // --- Normalization ---------------------------------------------------------
  // Preserve raw separately; matching text is trimmed, whitespace-collapsed,
  // lowercased, curly-apostrophe-straightened, leading "./" stripped, and has
  // trailing sentence punctuation (? ! .) removed — but never stripped to empty
  // (so a bare "?" survives as a help alias).
  function normalizeTerminalInput(raw) {
    const rawInput = raw == null ? "" : String(raw);
    const collapsed = rawInput.replace(/[’‘]/g, "'").trim().replace(/\s+/g, " ");
    const withoutDotSlash = collapsed.startsWith("./") ? collapsed.slice(2) : collapsed;
    const lowered = withoutDotSlash.toLowerCase();
    const stripped = lowered.replace(/[?!.]+$/, "");
    const normalized = stripped.length ? stripped : lowered;
    return { raw: rawInput, normalized };
  }

  // --- Deterministic rng (mulberry32) ---------------------------------------
  // Runtime uses Math.random; tests inject makeRng(seed) for repeatable output.
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // --- Step builders ---------------------------------------------------------
  const P = (text, className) => ({ type: "print", text, className });
  const PI = (id, text, className) => ({ type: "print", id, text, className });
  const H = (durationMs) => ({ type: "hold", durationMs });
  const RW = (targetId, text, className) => ({ type: "rewrite", targetId, text, className });
  const RETURN = () => ({ type: "returnPrompt" });

  // --- Selection helpers -----------------------------------------------------
  function pick(rng, arr) {
    return arr[Math.floor(rng() * arr.length)];
  }
  function randRange(rng, min, max) {
    return Math.round(min + rng() * (max - min));
  }
  // Choose a variant (keyed by .k) avoiding an immediate repeat for that key.
  function chooseVariant(rng, variants, session, key) {
    const last = session.lastResponseByIntent[key];
    const pool = variants.length > 1 ? variants.filter((v) => v.k !== last) : variants;
    const chosen = pool[Math.floor(rng() * pool.length)] || variants[0];
    session.lastResponseByIntent[key] = chosen.k;
    return chosen.steps.map((s) => Object.assign({}, s));
  }
  // A small "processing" beat prepended to conversational replies so they don't
  // land at zero latency (which reads chatbot-ish). Diagnostics stay instant.
  function withLead(rng, steps) {
    return [H(randRange(rng, 140, 260))].concat(steps);
  }
  // A rare response may fire at most once per session for a given key.
  function claimRare(session, key) {
    if (session.rareResponsesUsed[key]) {
      return false;
    }
    session.rareResponsesUsed[key] = true;
    return true;
  }
  // An anomaly rewrite may fire at most once per session for a given key.
  function claimAnomaly(session, key) {
    if (session.anomaliesShown[key]) {
      return false;
    }
    session.anomaliesShown[key] = true;
    return true;
  }

  // --- Sub-classification sets ----------------------------------------------
  const IDENTITY_USER = new Set([
    "whoami", "who am i", "identify me", "what am i", "do you know me", "do you know who i am",
  ]);
  const LOCATION_PATH = new Set(["pwd", "current directory", "path", "location"]);
  const EXIT_SOFT = new Set(["bye", "goodbye"]);
  const DOWNLOAD_BETA_ALIASES = new Set([
    "download beta", "get beta", "please download", "download the beta", "get the beta",
  ]);

  // --- Intent registry -------------------------------------------------------
  // Order matters only for pattern precedence and for which intent wins a
  // duplicate exact alias (earlier = higher priority). Exact aliases are unique
  // across intents (asserted in tests); patterns are anchored and intentional.
  const INTENTS = [
    {
      id: "greeting",
      aliases: [
        "hello", "hi", "hey", "hello there", "hi there", "hey there",
        "is anyone there", "anyone there", "are you there",
        "respond", "talk to me",
        "good morning", "good evening", "yo",
      ],
      build: buildGreeting,
    },
    {
      id: "identity",
      aliases: [
        "whoami", "who am i", "who is this", "who are you", "what are you",
        "identify", "identity", "identify yourself", "what is your name",
        "what are you called", "who is speaking", "what is this system",
        "who is responding", "identify me", "what am i", "do you know me",
        "do you know who i am",
      ],
      build: buildIdentity,
    },
    {
      id: "help",
      aliases: [
        "help", "?", "commands", "command list", "show commands", "what can i do",
        "what do i do", "options", "menu", "assist", "instructions",
        "how does this work", "what now",
      ],
      build: buildHelp,
    },
    {
      id: "status",
      aliases: [
        "status", "state", "system status", "runtime status", "health",
        "system health", "diagnostics", "diag", "check status", "check system",
        "is it working", "are you working", "online", "systems", "system",
      ],
      build: buildStatus,
    },
    {
      id: "inspect",
      aliases: [
        "inspect", "list", "ls", "dir", "tree", "show files", "show systems",
        "modules", "devices", "files", "what is loaded", "what is running",
      ],
      patterns: [/^ls( .+)?$/, /^dir( .+)?$/, /^tree( .+)?$/, /^inspect( .+)?$/],
      build: buildInspect,
    },
    {
      id: "location",
      aliases: [
        "where am i", "where is this", "what is this", "where are we",
        "what place is this", "pwd", "current directory", "path", "location",
      ],
      build: buildLocation,
    },
    {
      id: "version",
      aliases: [
        "version", "ver", "about", "info", "information", "build", "build info",
        "release", "system version", "what version is this",
      ],
      build: buildVersion,
    },
    {
      id: "history",
      aliases: [
        "history", "command history", "recent commands", "recent", "previous",
        "log", "logs", "journal", "events", "what did i type", "show history",
      ],
      build: buildHistory,
    },
    {
      id: "exit",
      aliases: [
        "exit", "quit", "logout", "close", "disconnect", "leave", "bye",
        "goodbye", "end session", "stop", "terminate",
      ],
      build: buildExit,
    },
    {
      id: "humanity",
      aliases: [
        "are you alive", "are you real", "can you think", "are you conscious",
        "are you sentient", "do you understand", "are you a person",
        "are you human", "what do you want", "are you watching me", "can you see me",
        "can you hear me", "can anyone hear me",
      ],
      build: buildHumanity,
    },
    {
      id: "assistance",
      aliases: [
        "help me", "can you help me", "please help", "i need help",
        "what should i do", "tell me what to do", "guide me", "assist me",
      ],
      build: buildAssistance,
    },
    {
      id: "explanation",
      aliases: [
        "why", "how", "explain", "explain this", "what happened",
        "what is happening", "tell me", "tell me more", "why is this happening",
        "what does this mean",
      ],
      build: buildExplanation,
    },
  ];

  const INTENT_BY_ID = {};
  const ALIAS_TO_INTENT = {};
  for (const intent of INTENTS) {
    INTENT_BY_ID[intent.id] = intent;
    for (const alias of intent.aliases) {
      if (!(alias in ALIAS_TO_INTENT)) {
        ALIAS_TO_INTENT[alias] = intent.id;
      }
    }
  }

  function classifyIntent(normalized) {
    if (!normalized) {
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(ALIAS_TO_INTENT, normalized)) {
      return ALIAS_TO_INTENT[normalized];
    }
    for (const intent of INTENTS) {
      if (intent.patterns) {
        for (const re of intent.patterns) {
          if (re.test(normalized)) {
            return intent.id;
          }
        }
      }
    }
    return null;
  }

  function subclassify(intentId, normalized) {
    if (intentId === "identity") {
      return IDENTITY_USER.has(normalized) ? "user" : "system";
    }
    if (intentId === "location") {
      return LOCATION_PATH.has(normalized) ? "path" : "query";
    }
    if (intentId === "exit") {
      return EXIT_SOFT.has(normalized) ? "soft" : "hard";
    }
    return null;
  }

  // --- Command resolution order ---------------------------------------------
  // 1 empty  2 protected (exact download.exe)  3 utility (DOM side-effects)
  // 4 intent classifier  5 unknown.  No fuzzy match can reach a protected id.
  function resolveCommand(normalized) {
    if (!normalized) {
      return { kind: "empty" };
    }
    if (normalized === "download.exe") {
      return { kind: "protected", id: "download.exe", normalized };
    }
    if (normalized === "clear" || normalized === "cls") {
      return { kind: "utility", id: "clear", normalized };
    }
    if (normalized === "download") {
      return { kind: "utility", id: "downloadHint", normalized };
    }
    if (DOWNLOAD_BETA_ALIASES.has(normalized)) {
      return { kind: "utility", id: "downloadBetaHint", normalized };
    }
    const intentId = classifyIntent(normalized);
    if (intentId) {
      return { kind: "intent", id: intentId, subtype: subclassify(intentId, normalized), normalized };
    }
    return { kind: "unknown", normalized };
  }

  // --- Session ---------------------------------------------------------------
  function createSession() {
    return {
      commandCount: 0,
      unknownCount: 0,
      lastIntent: null,
      lastResponseId: null,
      intentCounts: {},
      lastResponseByIntent: {},
      rawCommandHistory: [],
      normalizedCommandHistory: [],
      rareResponsesUsed: {},
      anomaliesShown: {},
      fictionalHistoryInserted: false,
      fictionalHistoryEntry: null,
      downloadStarted: false,
      downloadCompleted: false,
      specialUnknownStep: 0,
      flags: {},
    };
  }

  // Selection entry point for the 12 intent groups. Increments per-intent count
  // and delegates to the intent's build(), which reads that count for repeat /
  // rare / anomaly gating. Returns { intentId, steps }.
  function selectResponse(resolution, session, rng) {
    const intent = INTENT_BY_ID[resolution.id];
    session.intentCounts[resolution.id] = (session.intentCounts[resolution.id] || 0) + 1;
    session.lastIntent = resolution.id;
    const ctx = {
      session,
      rng: rng || Math.random,
      subtype: resolution.subtype,
      normalized: resolution.normalized,
      n: session.intentCounts[resolution.id],
    };
    return { intentId: resolution.id, steps: intent.build(ctx) };
  }

  // --- Unknown-command bank --------------------------------------------------
  const UNKNOWN_BANK = [
    "command not found",
    "unknown instruction",
    "unable to resolve request",
    "parser could not resolve token",
    "no executable object matches request",
    "interface unavailable",
    "instruction ignored",
  ];

  function selectUnknown(session, rng) {
    session.unknownCount += 1;
    // The two-part "...not designed for conversation" / "yet" beat fires once
    // per session, only after 4 unknowns, never when an intent matched.
    if (session.unknownCount >= 4 && session.specialUnknownStep === 0) {
      session.specialUnknownStep = 1;
      return { steps: [P("the interface is not designed for conversation", "terminal-error")] };
    }
    if (session.specialUnknownStep === 1) {
      session.specialUnknownStep = 2;
      return { steps: [P("yet", "terminal-error")] };
    }
    const text = UNKNOWN_BANK[(session.unknownCount - 1) % UNKNOWN_BANK.length];
    return { steps: [P(text, "terminal-error")] };
  }

  // --- Utility hint responses (rendered by terminal.js) ----------------------
  function downloadHintSteps() {
    return [P("executable extension required", "terminal-error"), P("try: download.exe", "terminal-error")];
  }
  function downloadBetaHintSteps() {
    return [P("authorized transfer executable:"), P(""), P("download.exe")];
  }

  // --- Fictional history (pure) ---------------------------------------------
  // Returns a display copy of the raw history with exactly one fictional entry
  // inserted just before the current `history` command. NEVER mutates rawHistory
  // (so Up/Down recall stays honest). The chosen entry + flag persist on session.
  const FICTIONAL_HISTORY_ENTRY = "accept --session";
  function insertFictionalHistory(rawHistory, session) {
    const display = rawHistory.slice();
    if (!session.fictionalHistoryEntry) {
      session.fictionalHistoryEntry = FICTIONAL_HISTORY_ENTRY;
    }
    const entry = session.fictionalHistoryEntry;
    if (!display.includes(entry)) {
      const insertAt = Math.max(0, display.length - 1);
      display.splice(insertAt, 0, entry);
      session.fictionalHistoryInserted = true;
    }
    return display;
  }

  // ===========================================================================
  // Intent builders. Each returns TerminalResponseStep[]. ctx = { session, rng,
  // subtype, normalized, n } where n is this intent's 1-based occurrence count.
  // ===========================================================================

  function buildGreeting(ctx) {
    const { rng, session, n } = ctx;
    if (n >= 3) {
      return [P("greeting protocol exhausted")];
    }
    if (n === 2) {
      return withLead(rng, chooseVariant(rng, [
        { k: "open", steps: [P("channel remains open")] },
        { k: "already", steps: [P("input already acknowledged")] },
        { k: "still", steps: [P("still connected")] },
        { k: "handshake", steps: [P("no additional handshake required")] },
      ], session, "greeting_repeat"));
    }
    // First use — weighted: 55% neutral, 25% minimal, 15% delayed, 5% rare.
    const roll = rng();
    if (roll < 0.05 && claimRare(session, "greeting")) {
      return [H(550), P("recognized."), H(400), P("continue")];
    }
    if (roll < 0.2) {
      return [H(randRange(rng, 380, 520)), P(pick(rng, ["recognized.", "signal traced", "carrier present"]))];
    }
    if (roll < 0.45) {
      return withLead(rng, [P("...")]);
    }
    return withLead(rng, chooseVariant(rng, [
      { k: "signal", steps: [P("signal received")] },
      { k: "input", steps: [P("input acknowledged")] },
      { k: "channel", steps: [P("communication channel open")] },
      { k: "recognized", steps: [P("recognized")] },
    ], session, "greeting"));
  }

  function buildIdentity(ctx) {
    const { session, subtype, rng } = ctx;
    // The user table and the system table are distinct and each reveals once —
    // gated per-subtype (not by overall count) so asking one never suppresses the
    // other. Repeats of an already-seen table fall to the neutral repeat bank.
    const shownKey = subtype === "user" ? "identityUserShown" : "identitySystemShown";
    if (session.flags[shownKey]) {
      return withLead(rng, chooseVariant(rng, [
        { k: "unchanged", steps: [P("identity data unchanged")] },
        { k: "norecord", steps: [P("no additional identity record available")] },
      ], session, "identity_repeat"));
    }
    session.flags[shownKey] = true;
    if (subtype === "user") {
      return [
        P("IDENTITY QUERY"),
        P(""),
        P("operator ................. local"),
        P("session .................. active"),
        P("authority ................ inherited"),
        PI("id", "identity ................. unresolved"),
        H(300),
        RW("id", "identity ................. unverified"),
      ];
    }
    const steps = [
      P("SYSTEM QUERY"),
      P(""),
      P("interface ................ relay console"),
      P("runtime .................. vector_drift"),
      P("origin ................... unavailable"),
      PI("owner", "owner .................... unresolved"),
    ];
    if (claimAnomaly(session, "identity_system")) {
      steps.push(H(350), RW("owner", "owner .................... remote"), H(140), RW("owner", "owner .................... unresolved"));
    }
    return steps;
  }

  function buildHelp() {
    return [
      P("AVAILABLE COMMANDS"),
      P(""),
      P("download.exe     retrieve authorized beta package"),
      P("snake.exe        load ascii snake   (arrows / WASD, Q quits)"),
      P("pi.exe           stream digits of pi   (ENTER stops)"),
      P("status           inspect current runtime state"),
      P("inspect          inspect mounted system objects"),
      P("whoami           resolve local session identity"),
      P("history          display current command memory"),
      P("version          display relay build information"),
      P("clear            clear terminal output"),
      P("exit             request session termination"),
      P(""),
      P("the parser also answers plain language — try asking it things"),
    ];
  }

  function buildStatus(ctx) {
    const { rng, session, n } = ctx;
    const steps = [
      P("VECTOR DRIFT RUNTIME STATUS"),
      P(""),
      P("simulation ................. ACTIVE"),
      P("render lattice ............. ONLINE"),
      P("motion field ............... ONLINE"),
      P("combat matrix .............. STANDBY"),
      P("command channel ............ OPEN"),
      PI("obs", "observer count ............. 1"),
      PI("rem", "remote processes ........... NONE"),
      P("integrity state ............ NOMINAL"),
    ];
    // At most one anomaly per session, and only *probably* within the first few
    // status queries — so it reads as a rare glitch, not a guaranteed reveal.
    if (n <= 3 && rng() < 0.4 && claimAnomaly(session, "status")) {
      if (rng() < 0.5) {
        steps.push(H(300), RW("obs", "observer count ............. 2"), H(180), RW("obs", "observer count ............. 1"));
      } else {
        steps.push(H(randRange(rng, 120, 180)), RW("rem", "remote processes ........... 1"), H(randRange(rng, 120, 180)), RW("rem", "remote processes ........... NONE"));
      }
    }
    return steps;
  }

  function buildInspect() {
    return [
      P("MOUNTED SYSTEM OBJECTS"),
      P(""),
      P("/world"),
      P("/motion"),
      P("/combat"),
      P("/scope"),
      P("/observer"),
      P("/runtime"),
      P("/download.exe"),
      P(""),
      P("7 objects mounted"),
      P("1 object unavailable"),
    ];
  }

  function buildLocation(ctx) {
    const { session, subtype, n } = ctx;
    if (subtype === "path") {
      return [P("/root/vector_drift")];
    }
    const steps = [
      P("LOCATION QUERY"),
      P(""),
      P("local path ............... /root/vector_drift"),
      PI("host", "host location ............ unavailable"),
      P("network origin ........... unresolved"),
      P("session boundary ......... active"),
    ];
    if (n === 1 && claimAnomaly(session, "location")) {
      steps.push(H(300), RW("host", "host location ............ remote"), H(160), RW("host", "host location ............ unavailable"));
    }
    return steps;
  }

  // Version fiction lives here only (single source; not duplicated in terminal.js).
  function buildVersion() {
    return [
      P("VECTOR DRIFT RELAY"),
      P(""),
      P("loader ................... 2.13"),
      P("simulation ............... beta preview"),
      P("renderer ................. lattice vector core"),
      P("runtime drift ............ 0.0003"),
      P("build origin ............. unknown"),
      P("network node ............. 10.0.1.00"),
    ];
  }

  // History renders live session data; the marker tells terminal.js to build the
  // display (with the fictional entry) from the real command history.
  function buildHistory() {
    return [{ type: "historyRender" }];
  }

  function buildExit(ctx) {
    if (ctx.subtype === "soft") {
      return withLead(ctx.rng, [P("channel remains open"), RETURN()]);
    }
    return [
      PI("term", "termination request received", "terminal-error"),
      H(450),
      RW("term", "termination request denied"),
      P("session remains active"),
      RETURN(),
    ];
  }

  function buildHumanity(ctx) {
    const { rng, session } = ctx;
    if (rng() < 0.06 && claimRare(session, "humanity")) {
      return [P("processing"), H(700), P("not for you")];
    }
    return withLead(rng, chooseVariant(rng, [
      { k: "philo", steps: [P("query classification ........ philosophical"), P("result ...................... unavailable")] },
      { k: "incomplete", steps: [P("input received"), P("interpretation incomplete")] },
      { k: "unsupported", steps: [P("awareness test unsupported")] },
      { k: "recorded", steps: [P("observer query recorded")] },
      { k: "nocompat", steps: [P("no compatible answer")] },
    ], session, "humanity"));
  }

  function buildAssistance(ctx) {
    const { rng, session, n } = ctx;
    // First request never pushes the download; repeats may surface the hint.
    if (n >= 2 && rng() < 0.6) {
      return withLead(rng, [P("authorized action available:"), P(""), P("download.exe")]);
    }
    return withLead(rng, chooseVariant(rng, [
      { k: "channel", steps: [P("request received"), P("assistance channel unavailable")] },
      { k: "guidance", steps: [P("guidance package not mounted")] },
    ], session, "assistance"));
  }

  function buildExplanation(ctx) {
    const { rng, session } = ctx;
    if (rng() < 0.15 && claimRare(session, "explanation")) {
      return [P("insufficient context"), H(500), P("or insufficient permission")];
    }
    return withLead(rng, chooseVariant(rng, [
      { k: "context", steps: [P("insufficient context")] },
      { k: "module", steps: [P("explanation module unavailable")] },
      { k: "record", steps: [P("event record incomplete")] },
    ], session, "explanation"));
  }

  // --- Dev consistency check (used by tests) --------------------------------
  function findDuplicateAliases() {
    const seen = {};
    const dupes = [];
    for (const intent of INTENTS) {
      for (const alias of intent.aliases) {
        if (seen[alias]) {
          dupes.push({ alias, intents: [seen[alias], intent.id] });
        } else {
          seen[alias] = intent.id;
        }
      }
    }
    return dupes;
  }

  return {
    normalizeTerminalInput,
    makeRng,
    classifyIntent,
    subclassify,
    resolveCommand,
    createSession,
    selectResponse,
    selectUnknown,
    downloadHintSteps,
    downloadBetaHintSteps,
    insertFictionalHistory,
    findDuplicateAliases,
    INTENTS,
    FICTIONAL_HISTORY_ENTRY,
  };
});
