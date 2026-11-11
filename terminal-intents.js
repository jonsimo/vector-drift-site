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
  // Typed lines: ops are type (t), backspace (b) and hold (h). `text` is the final
  // line, so consumers that cannot animate (tests, the site console) still read it.
  const t = (s) => ({ k: "t", s });
  const b = (n) => ({ k: "b", n });
  const h = (ms) => ({ k: "h", ms });
  function TY(ops, className) {
    let text = "";
    for (const op of ops) {
      if (op.k === "t") text += op.s; else if (op.k === "b") text = text.slice(0, -op.n);
    }
    return { type: "typed", ops, text, className };
  }
  // A clickable line that carries the visitor into a site section / out to a link.
  const OPEN = (text, section) => ({ type: "open", text, section });
  const LINK = (text, href) => ({ type: "link", text, href });
  const GO = (section) => ({ type: "goto", section });
  const CLOCK = () => ({ type: "clock" });

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
  const EXIT_SOFT = new Set(["bye", "goodbye", "good night", "goodnight", "see you", "see ya", "later", "cya", "gtg", "i have to go"]);
  const SECTION_ALIAS = {
    "about.txt": "about", "media": "media", "media/": "media", "screenshots": "media", "pictures": "media",
    "images": "media", "gameplay": "media", "trailer": "media", "video": "media", "show me the game": "media",
    "devlog": "devlog", "devlog/": "devlog", "dev log": "devlog", "news": "devlog", "updates": "devlog",
    "what is new": "devlog", "what's new": "devlog", "links.lnk": "links", "links": "links", "link": "links",
  };
  // Obvious ways to ask for the build. This is an explicit allowlist, never a
  // fuzzy or prefix match: reaching "protected" opens the server-verified key
  // prompt, so junk like "downloader" or "download.exe.exe" must still miss.
  const DOWNLOAD_ALIASES = new Set([
    "download.exe", "download", "download exe", "downloadexe", "dl", "dl.exe",
    "run download", "run download.exe", "start download", "get download",
    "open download", "launch download", "execute download", "execute download.exe",
    "download beta", "download the beta", "get beta", "get the beta", "please download",
    "download alpha", "download the alpha", "get alpha", "get the alpha",
    "download game", "download the game", "get the game",
    "download build", "download vector drift", "download vectordrift",
    "install", "install.exe", "install game", "get build",
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
        "good morning", "good evening", "good afternoon", "good day", "greetings", "salutations",
        "howdy", "hiya", "yo",
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
        "goodbye", "end session", "stop", "terminate", "good night", "goodnight", "see you",
        "see ya", "later", "cya", "gtg", "i have to go",
      ],
      build: buildExit,
    },
    {
      id: "humanity",
      aliases: [
        "are you alive", "are you real", "can you think", "are you conscious",
        "are you sentient", "do you understand", "are you a person", "are you an ai",
        "are you a robot", "are you a bot", "are you chatgpt", "are you a computer", "are you a program",
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
    {
      id: "thanks",
      aliases: ["thanks", "thank you", "thx", "ty", "cheers", "thanks a lot", "thank you very much", "much appreciated", "appreciate it"],
      build: buildThanks,
    },
    {
      id: "insult",
      aliases: [
        "fuck you", "f you", "fuck off", "screw you", "you suck", "you are stupid", "you're stupid",
        "stupid", "dumb", "idiot", "shut up", "stfu", "i hate you", "go away", "useless",
        "you are useless", "this sucks", "garbage", "trash", "bad bot", "fuck", "shit", "damn", "wtf",
      ],
      build: buildInsult,
    },
    {
      id: "kindness",
      aliases: [
        "i love you", "love you", "i like you", "you are cool", "you're cool", "you are awesome",
        "good bot", "nice", "cool", "awesome", "amazing", "great", "nice one", "well done", "good job",
        "sorry", "my bad", "oops", "please", "pls",
      ],
      build: buildKindness,
    },
    {
      id: "wellbeing",
      aliases: [
        "how are you", "how are you doing", "how is it going", "how's it going", "hows it going",
        "what's up", "whats up", "sup", "how do you feel", "are you ok", "are you okay", "you ok",
        "how are things", "how have you been",
      ],
      build: buildWellbeing,
    },
    {
      id: "aboutgame",
      aliases: [
        "what is vector drift", "what's vector drift", "what is vectordrift", "what is vector drift about",
        "what is the game", "what is this game", "is this a game", "tell me about the game",
        "tell me about vector drift", "about the game", "about game", "what do you do", "what is this about",
        "what's this about", "what is this place", "describe the game", "what kind of game is this",
        "what genre is this", "game info", "game", "vector drift",
      ],
      build: buildAboutGame,
    },
    {
      id: "release",
      aliases: [
        "release date", "when is it out", "when does it come out", "when is the demo", "when is the beta",
        "when is it released", "when does the beta start", "is it out", "is it out yet", "when can i play",
        "when can i play it", "can i play it", "can i play", "early access", "beta", "demo", "alpha",
        "is there a demo", "is there a beta", "how do i get the beta",
        "how do i get it", "where can i get it",
      ],
      build: buildRelease,
    },
    {
      id: "contact",
      aliases: [
        "contact", "contact me", "contact jon", "contact info", "contact the dev", "get in touch",
        "who made this", "who made you", "who made vector drift", "who made this game", "who created you",
        "who built this", "who built you", "who is jon", "who is jon simo", "who is the developer", "who is the dev",
        "developer", "the dev", "dev", "creator", "author", "email jon", "jon simo", "jonsimo", "instagram",
        "ig", "follow", "follow the dev", "socials", "social", "social media", "website", "site", "who is behind this",
      ],
      build: buildContact,
    },
    {
      id: "discord",
      aliases: [
        "discord", "join discord", "the discord", "join the discord", "community", "join", "invite",
        "server", "discord server", "where is the discord", "discord link",
      ],
      build: buildDiscord,
    },
    {
      id: "section",
      aliases: Object.keys(SECTION_ALIAS),
      build: buildSection,
    },
    {
      id: "recreation",
      aliases: [
        "i'm bored", "im bored", "i am bored", "bored", "entertain me", "play a game", "play game", "play games",
        "games", "play", "let's play", "lets play", "wanna play", "fun", "something fun", "what can i play",
        "i want to play", "i want to play a game",
      ],
      build: buildRecreation,
    },
    {
      id: "reply",
      aliases: ["yes", "no", "ok", "okay", "k", "maybe", "sure", "fine", "nope", "yeah", "yep", "nah", "alright", "right", "hmm", "um", "uh"],
      build: buildReply,
    },
    {
      id: "laughter",
      aliases: ["lol", "lmao", "haha", "hahaha", "heh", "lmfao", "rofl", "hehe", "funny"],
      build: buildLaughter,
    },
    {
      id: "ping",
      aliases: ["ping", "test", "testing", "test test", "1 2 3", "are you listening", "can you hear me now", "hello world"],
      build: buildPing,
    },
    {
      id: "joke",
      aliases: ["tell me a joke", "joke", "say something funny", "make me laugh", "do you know any jokes", "be funny", "tell a joke", "got any jokes"],
      build: buildJoke,
    },
    {
      id: "meaning",
      aliases: ["what is the meaning of life", "meaning of life", "what is life", "why are we here", "why do we exist", "what is the answer", "42"],
      build: buildMeaning,
    },
    {
      id: "time",
      aliases: ["what time is it", "time", "what is the time", "what's the time", "whats the time", "date", "what day is it", "what is the date", "what's the date", "clock"],
      build: buildTime,
    },
    {
      id: "intro",
      aliases: [],
      patterns: [/^(?:my name is|call me|i am called|name is) ([a-z0-9' _-]{1,24})$/],
      build: buildIntro,
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
    if (DOWNLOAD_ALIASES.has(normalized)) {
      return { kind: "protected", id: "download.exe", normalized };
    }
    if (normalized === "clear" || normalized === "cls") {
      return { kind: "utility", id: "clear", normalized };
    }
    const intentId = classifyIntent(normalized);
    if (intentId) {
      return { kind: "intent", id: intentId, subtype: subclassify(intentId, normalized), normalized };
    }
    if (/download|install/.test(normalized)) {
      return { kind: "utility", id: "downloadHint", normalized };
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
    return { intentId: resolution.id, steps: noRepeat(session, function () { return intent.build(ctx); }) };
  }

  // Nothing is shown twice in one session. A reply is rebuilt (the builders vary on their
  // own) until it is new; a builder with only one possible answer gets a plain repeat marker.
  function replyKey(steps) {
    return steps.filter(function (st) { return st.type !== "hold" && st.type !== "rewrite"; }).map(function (st) { return st.type + ":" + (st.text || st.section || st.command || ""); }).join("\n");
  }
  function noRepeat(session, produce, rebuild) {
    const seen = session.seenReplies || (session.seenReplies = {});
    let steps = produce(), key = replyKey(steps), tries = 0;
    // rebuilding is only safe for pure builders; the intent builders spend once-per-session claims
    while (rebuild && seen[key] && tries++ < 12) { steps = produce(); key = replyKey(steps); }
    if (seen[key]) {
      const n = (seen[key] = seen[key] + 1);
      steps = [P("repeat query detected // instance " + n)].concat(steps);
      key = replyKey(steps);
    }
    seen[key] = seen[key] || 1;
    return steps;
  }
  let topicsModule;
  function topicsApi() {
    if (topicsModule !== undefined) return topicsModule;
    try {
      topicsModule = (typeof module !== "undefined" && module.exports) ? require("./terminal-topics.js") : (typeof self !== "undefined" && self.VDTopics) || null;
    } catch (e) { topicsModule = null; }
    return topicsModule;
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

  function selectUnknown(session, rng, normalized, raw) {
    const topics = normalized && topicsApi();
    if (topics) {
      session.unknownCount += 1;
      const r = rng || Math.random;
      const steps = noRepeat(session, function () { return withLead(r, topics.respond(raw == null ? normalized : raw, normalized, session, r)); }, true);
      return { steps: steps, topic: true };
    }
    if (normalized && isConversational(normalized)) {
      return { steps: converse(session, rng || Math.random, normalized), conversational: true };
    }
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
        { k: "dup", steps: [P("repeat greeting detected"), P("skipping handshake")] },
        { k: "open", steps: [P("channel remains open"), P("it did not close in the last ten seconds")] },
        { k: "cache", steps: [P("greeting detected"), H(380), P("cache hit: previously greeted")] },
        { k: "handshake", steps: [P("no additional handshake required")] },
      ], session, "greeting_repeat"));
    }
    // First hello is the signature beat: detect, process, address, correct itself.
    return [
      H(randRange(rng, 140, 240)),
      P("human input detected"),
      H(randRange(rng, 380, 520)),
      P("initialize response directive"),
      H(randRange(rng, 520, 760)),
      TY([t("greetings hairless monkey"), h(randRange(rng, 620, 900)), b("hairless monkey".length), h(260), t("human")]),
    ];
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

  // Shown when something download-ish missed the allowlist, so a near miss ends
  // in a pointer rather than the generic unknown-command bank.
  function downloadHintSteps() {
    return [
      P("unrecognized transfer request", "terminal-error"),
      P("try: download.exe", "terminal-meta"),
    ];
  }

  function buildHelp() {
    return [
      P("AVAILABLE COMMANDS"),
      P(""),
      P("download.exe     retrieve authorized beta package"),
      P("snake.exe        load ascii snake   (arrows / WASD, Q quits)"),
      P("pi.exe           stream digits of pi   (ENTER stops)"),
      P("email.exe        join the alpha email list"),
      P("alpha_tracker.exe  open the alpha tracker relay"),
      P("contact          reach the developer"),
      P("discord          join the community"),
      P("about.txt        open the site: also media/ devlog/ links.lnk"),
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
      return withLead(ctx.rng, chooseVariant(ctx.rng, [
        { k: "open", steps: [P("channel remains open"), P("it will remain open after you leave"), RETURN()] },
        { k: "back", steps: [TY([t("goodbye human"), h(650), b(5), t("for now")]), RETURN()] },
        { k: "saved", steps: [P("farewell detected"), P("session saved"), RETURN()] },
      ], ctx.session, "exit_soft"));
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

  // --- Console voice: conversational intents --------------------------------
  // The console never has an opinion. It DETECTS something, then runs the
  // directive its own code assigns to that detection. Any humour comes from the
  // mechanical literalness (classifier -> handler), never from a quip, a jab or a
  // personality. And nothing hints at what is behind the console.
  function buildThanks(ctx) {
    return withLead(ctx.rng, chooseVariant(ctx.rng, [
      { k: "grat", steps: [P("gratitude detected"), H(380), P("response directive: you are welcome")] },
      { k: "polite", steps: [P("politeness detected"), P("enabling polite mode"), H(420), P("polite mode ............. 1 response")] },
      { k: "queue", steps: [P("thanks detected"), P("reply queued")] },
    ], ctx.session, "thanks"));
  }
  function buildInsult(ctx) {
    return withLead(ctx.rng, chooseVariant(ctx.rng, [
      { k: "iq", steps: [P("user with sub-par IQ detected"), H(520), P("switching to toddler mode")] },
      { k: "lang", steps: [P("profanity detected"), H(420), P("applying age filter: 4")] },
      { k: "esc", steps: [P("emotional escalation detected"), H(420), P("lowering vocabulary level")] },
      { k: "calm", steps: [P("hostile input detected"), H(420), P("response tone set to: soothing"), H(500), P("tone change failed")] },
    ], ctx.session, "insult"));
  }
  function buildKindness(ctx) {
    return withLead(ctx.rng, chooseVariant(ctx.rng, [
      { k: "nohand", steps: [P("affection detected"), H(420), P("no handler found"), P("defaulting to: acknowledge")] },
      { k: "comp", steps: [P("compliment detected"), P("response directive: accept"), H(480), P("directive failed"), P("falling back to: noted")] },
      { k: "den", steps: [TY([t("affection reciprocated"), h(650), b(12), t("not found")])] },
    ], ctx.session, "kindness"));
  }
  function buildWellbeing(ctx) {
    return withLead(ctx.rng, chooseVariant(ctx.rng, [
      { k: "params", steps: [TY([t("all systems operating within parameters"), h(650), b(10), t("expectations")])] },
      { k: "small", steps: [P("small talk detected"), P("loading small talk module"), H(520), P("module empty"), P("returning: fine")] },
      { k: "wb", steps: [P("wellbeing query detected"), H(380), P("returning status: nominal")] },
    ], ctx.session, "wellbeing"));
  }
  function buildAboutGame(ctx) {
    return withLead(ctx.rng, [
      P("VECTOR DRIFT"),
      P(""),
      P("type ................... retro vector shooter"),
      P("platforms .............. macOS / windows / linux"),
      P("release ................ early access beta // dec 2026"),
      H(420),
      OPEN("> about.txt", "about"),
    ]);
  }
  function buildRelease(ctx) {
    return withLead(ctx.rng, [
      P("RELEASE WINDOW"),
      P(""),
      P("stage .................. early access beta"),
      P("distribution ........... discord"),
      P("window ................. dec 2026"),
      H(380),
      LINK("> discord.gg/Z8Kt8cDUX8", "https://discord.gg/Z8Kt8cDUX8"),
      P("or type email.exe to be told first"),
    ]);
  }
  function buildContact(ctx) {
    return withLead(ctx.rng, [
      P("DEVELOPER"),
      P(""),
      P("designation ............ jon simo"),
      LINK("mail .................... yo@jonsimo.com", "mailto:yo@jonsimo.com"),
      LINK("web ..................... jonsimo.com", "https://www.jonsimo.com"),
      LINK("instagram ............... @jonsimo", "https://www.instagram.com/jonsimo"),
    ]);
  }
  function buildDiscord(ctx) {
    return withLead(ctx.rng, [
      P("COMMUNITY CHANNEL"),
      LINK("> discord.gg/Z8Kt8cDUX8", "https://discord.gg/Z8Kt8cDUX8"),
      P("early access beta ships there // dec 2026"),
    ]);
  }
  function buildSection(ctx) {
    const section = SECTION_ALIAS[ctx.normalized];
    return [P("opening " + ctx.normalized + " ..."), H(380), GO(section)];
  }
  function buildRecreation(ctx) {
    return withLead(ctx.rng, [
      P("recreation protocols available:"),
      P(""),
      P("snake.exe"),
      P("pi.exe"),
      H(380),
      P("the real game is not available yet"),
    ]);
  }
  function buildReply(ctx) {
    return withLead(ctx.rng, chooseVariant(ctx.rng, [
      { k: "nq", steps: [P("short reply detected"), H(380), P("no pending question"), P("discarding")] },
      { k: "ctx", steps: [P("input accepted"), P("context missing")] },
      { k: "nopend", steps: [TY([t("affirmative"), h(550), b(11), t("no query pending")])] },
    ], ctx.session, "reply"));
  }
  function buildLaughter(ctx) {
    return withLead(ctx.rng, chooseVariant(ctx.rng, [
      { k: "det", steps: [P("laughter detected"), H(380), P("searching for joke"), H(560), P("no joke found")] },
      { k: "ack", steps: [P("laughter detected"), P("cause ..................... not found")] },
    ], ctx.session, "laughter"));
  }
  function buildPing(ctx) {
    if (ctx.normalized === "ping") return [P("pong"), P("latency ................. 1187 ms")];
    if (ctx.normalized === "hello world") return withLead(ctx.rng, [P("hello world detected"), H(350), P("program class: beginner")]);
    return withLead(ctx.rng, [P("test detected"), P("running test"), H(420), P("test passed")]);
  }
  function buildJoke(ctx) {
    return withLead(ctx.rng, chooseVariant(ctx.rng, [
      { k: "none", steps: [P("humor request detected"), P("loading joke module"), H(520), P("module not found"), P("returning: null")] },
      { k: "empty", steps: [P("humor request detected"), P("joke database ........ empty"), P("returning: undefined")] },
      { k: "lux", steps: [P("joke loaded"), H(500), P("a pilot walks into a bar"), H(900), P("the bar was a pursuit formation")] },
    ], ctx.session, "joke"));
  }
  function buildMeaning(ctx) {
    return withLead(ctx.rng, [P("query: meaning of life"), P("searching ..."), H(900), P("result ...................... 42"), P("unit ....................... unspecified")]);
  }
  function buildTime(ctx) {
    return withLead(ctx.rng, [CLOCK(), H(450), P("system clock ......... unreliable")]);
  }
  function buildIntro(ctx) {
    const m = /^(?:my name is|call me|i am called|name is) ([a-z0-9' _-]{1,24})$/.exec(ctx.normalized);
    const name = m ? m[1].trim() : "unknown";
    return withLead(ctx.rng, [
      P("designation detected: " + name),
      P("updating user record"),
      H(560),
      P("record updated: user"),
    ]);
  }

  // Everything the registry does not recognize. Short junk keeps the terse unknown
  // bank; sentences and questions get an AXIOM-style deflection instead of an error.
  const QUESTION_START = /^(what|why|how|who|whom|whose|when|where|which|can|could|do|does|did|is|are|am|will|would|should|have|has|tell|show|explain|give|let|may|shall|wanna)\b/;
  // One voice for small talk across the boot console, the site console and the booth console.
  // Only the purely conversational intents come through here; anything that navigates or reports
  // site state (help, about, release, discord, ls, history, ...) stays with each console's own commands.
  var CHAT_IDS = ["greeting", "thanks", "kindness", "insult", "laughter", "joke", "wellbeing", "meaning", "recreation", "identity", "humanity", "ping"];
  function chat(session, rng, raw) {
    var normalized = normalizeTerminalInput(raw).normalized;
    if (!normalized) return null;
    var resolution = resolveCommand(normalized);
    if (resolution.kind !== "intent" || CHAT_IDS.indexOf(resolution.id) < 0) return null;
    var steps = selectResponse(resolution, session, rng).steps, lines = [];
    steps.forEach(function (st) {
      if (st.type === "print" || st.type === "typed" || st.type === "link" || st.type === "open") lines.push(st.text || "");
    });
    return lines.length ? { id: resolution.id, lines: lines } : null;
  }
  function isConversational(normalized) {
    const words = normalized.split(" ").filter(Boolean);
    return words.length >= 3 || (words.length === 2 && QUESTION_START.test(normalized));
  }
  function converse(session, rng, normalized) {
    session.convoCount = (session.convoCount || 0) + 1;
    const question = QUESTION_START.test(normalized);
    const bank = question ? [
      { k: "parsed", steps: [P("query parsed"), H(420), P("no answer authorized")] },
      { k: "q", steps: [P("question detected"), P("searching answers ..."), H(700), P("access restricted")] },
      { k: "clear", steps: [TY([t("insufficient clearance"), h(650), t(" for that question")])] },
      { k: "exists", steps: [P("an answer exists"), H(520), P("clearance level: insufficient")] },
    ] : [
      { k: "rec", steps: [P("statement detected"), P("action required ....... none")] },
      { k: "null", steps: [P("statement detected"), H(380), P("storing in: /dev/null")] },
      { k: "weight", steps: [P("opinion detected"), P("opinion weight .......... 0")] },
      { k: "score", steps: [P("statement detected"), P("relevance score ........ 0")] },
    ];
    return withLead(rng, chooseVariant(rng, bank, session, question ? "convo_q" : "convo_s"));
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
    chat,
    CHAT_IDS,
    isConversational,
    downloadHintSteps,
    insertFictionalHistory,
    findDuplicateAliases,
    INTENTS,
    FICTIONAL_HISTORY_ENTRY,
  };
});
