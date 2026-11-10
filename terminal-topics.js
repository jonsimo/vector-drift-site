/* Vector Drift — console topics. Everything a visitor might type that the exact-match
   intent table does not know lands here and gets a fitting answer or action.
   Voice: bluntly neutral detection, then a directive. No opinions, no sass, no hint of
   what is behind it. Pure module (no DOM): returns the same step objects the intent
   layer uses, so terminal.js plays them unchanged.

   Order: game topics -> site navigation -> shell commands -> arithmetic / dice / coin ->
   lexicon family (CLINC150-trained classifier) -> shape fallbacks.
   Nothing repeats inside a session: every reply is composed from banks, checked against
   what this session already saw, re-rolled, and finally given a unique reference line. */
(function (root, factory) {
  var lex = null;
  if (typeof module !== "undefined" && module.exports) { try { lex = require("./terminal-lexicon.js"); } catch (e) {} }
  else lex = root.VDLexicon || null;
  var api = factory(lex);
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.VDTopics = api;
})(typeof self !== "undefined" ? self : this, function (LEX) {
  "use strict";

  // ---- step helpers ---------------------------------------------------------
  var P = function (text, className) { return { type: "print", text: text, className: className }; };
  var ERR = function (t) { return P(t, "terminal-error"); };
  var META = function (t) { return P(t, "terminal-meta"); };
  var H = function (ms) { return { type: "hold", durationMs: ms }; };
  var OPEN = function (text, section) { return { type: "open", text: text, section: section }; };
  var LINK = function (text, href) { return { type: "link", text: text, href: href }; };
  var GO = function (section) { return { type: "goto", section: section }; };
  var RUN = function (command) { return { type: "run", command: command }; };
  var DOT = function (key, value) { return P(key + " " + new Array(Math.max(3, 24 - key.length)).join(".") + " " + value); };

  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function shuffled(rng, arr) { var a = arr.slice(), i, j, t; for (i = a.length - 1; i > 0; i--) { j = Math.floor(rng() * (i + 1)); t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function rr(rng, min, max) { return Math.round(min + rng() * (max - min)); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---- facts the console may state (all public) -----------------------------
  var DISCORD = "https://discord.gg/Z8Kt8cDUX8";
  var SECTIONS = {
    about:      { go: "about",      label: "about.txt",     line: "about.txt ............ the game, in short" },
    media:      { go: "media",      label: "media/",        line: "media/ ............... 6 framegrabs" },
    soundtrack: { go: "soundtrack", label: "soundtrack/",   line: "soundtrack/ .......... 23 tracks, 45 s previews" },
    devlog:     { go: "devlog",     label: "devlog/",       line: "devlog/ .............. development updates" },
    links:      { go: "links",      label: "links.lnk",     line: "links.lnk ............ community + updates" },
    download:   { go: "download",   label: "download.exe",  line: "download.exe ......... demo status" },
  };
  var SECTION_WORDS = [
    ["soundtrack", /\b(soundtrack|sound track|ost|music|songs?|tracks?|score|audio|album|tunes?|synth|playlist|listen)\b/],
    ["media",      /\b(media|screenshots?|screens?|pictures?|pics?|images?|photos?|videos?|trailer|footage|gameplay|stills?|clips?|frames?|framegrabs?|visuals?|graphics|art|artwork|teaser|preview)\b/],
    ["devlog",     /\b(devlog|dev log|news|updates?|blog|changelog|patch notes|progress|roadmap|development)\b/],
    ["download",   /\b(download|demo|beta|alpha|installer|install|build|early access|playtest|try it|get the game|buy)\b/],
    ["links",      /\b(links?|socials?|community|instagram|twitter|youtube|tiktok|website)\b/],
    ["about",      /\b(about\.txt|about page|about section|readme|overview|synopsis|blurb)\b|^(about|info|information)$/],
  ];

  // ---- composing -------------------------------------------------------------
  // A reply is [detection lines] + [directive lines] + optional facts/action. `pickPair`
  // walks the cross product of two banks in a shuffled order, preferring pairs this
  // session has not shown.
  function compose(ctx, dets, dirs, fill) {
    var s = ctx.session, used = s.__used || (s.__used = {}), tries = [], i, j;
    for (i = 0; i < dets.length; i++) for (j = 0; j < dirs.length; j++) tries.push([i, j]);
    tries = shuffled(ctx.rng, tries);
    var det = dets[0], dir = dirs[0], key;
    for (var t = 0; t < tries.length; t++) {
      var d = dets[tries[t][0]], r = dirs[tries[t][1]];
      key = fill(d) + "|" + fill(r);
      if (!used[key]) { det = d; dir = r; break; }
    }
    used[fill(det) + "|" + fill(dir)] = 1;
    return [fill(det), fill(dir)];
  }
  function lines(arr, kinds) { return arr.map(function (t, i) { return t ? P(t, kinds && kinds[i]) : P(""); }); }
  function slot(vars) {
    return function (s) { return s.replace(/\{(\w+)\}/g, function (m, k) { return vars && vars[k] != null ? vars[k] : m; }); };
  }

  // ---- generic out-of-scope domains -------------------------------------------
  // Each domain: the noun used in the detection line, a handful of punchline pairs
  // (detection + directive) and where the visitor can usefully go instead.
  var DOMAIN = {
    bank:      { noun: "financial", pairs: [["balance inquiry detected", "balance of this system ....... 0.00"], ["financial request detected", "no ledger is mounted // funds are not required here"], ["card or account data requested", "directive: never type card numbers into a terminal"], ["transaction language detected", "transactions processed ....... 0"], ["money detected", "the only currency here is time // spent so far: counting"]] },
    travel:    { noun: "travel",    pairs: [["travel request detected", "this system does not leave /root"], ["destination query detected", "available destinations: /about /media /soundtrack /devlog"], ["booking language detected", "reservations ................ none // seats ............. 1"], ["itinerary request detected", "itinerary: boot -> directory -> exit"], ["luggage or passport mentioned", "directive: carry nothing, the directory is light"]] },
    food:      { noun: "culinary",  pairs: [["culinary request detected", "kitchen is not mounted"], ["food query detected", "calories in this system ..... 0"], ["recipe request detected", "recipe: one directory, six entries, no heat required"], ["hunger signal detected", "directive: feed the operator, not the terminal"], ["restaurant query detected", "dining options ............ /dev/null"]] },
    car:       { noun: "vehicle",   pairs: [["vehicle query detected", "garage is not mounted"], ["maintenance request detected", "the only vehicle here is a vector ship // service interval: none"], ["tyre or fuel mentioned", "fuel ....................... not applicable"], ["engine query detected", "engine details are classified // maintenance: none required"], ["road request detected", "roads ...................... none // lanes: 0"]] },
    work:      { noun: "scheduling", pairs: [["scheduling request detected", "calendar is empty // this is intentional"], ["meeting language detected", "attendees: 1 // agenda: none"], ["time-off request detected", "directive: take it, this system does not mind"], ["calendar query detected", "next event ................ release window // dec 2026"], ["workplace language detected", "work detected // nothing here needs approval"]] },
    tasks:     { noun: "task",      pairs: [["reminder request detected", "memory ..................... unreliable // do not delegate"], ["list request detected", "list status ................ empty"], ["timer request detected", "timers ..................... none // clock error: 1187 ms"], ["alarm request detected", "alarms ..................... none // sleep is permitted"], ["task language detected", "directive: write it down somewhere that is not here"]] },
    comms:     { noun: "messaging", pairs: [["call request detected", "no line available // voice is not supported"], ["message request detected", "outbound channels ......... email.exe / discord"], ["contact request detected", "developer reachable via contact // type: contact"]] },
    home:      { noun: "device",    pairs: [["device command detected", "no devices attached"], ["smart-home language detected", "connected devices .......... 0 // lights are your own concern"], ["control request detected", "directive: the only switch here is the sound toggle"]] },
    shop:      { noun: "retail",    pairs: [["purchase request detected", "store is not open // nothing to buy yet"], ["order query detected", "orders ..................... 0"], ["shopping language detected", "cart ....................... empty // price: unannounced"]] },
    insurance: { noun: "coverage",  pairs: [["coverage query detected", "policy ..................... none // risk: fictional"], ["claim language detected", "claims ..................... 0"], ["insurance detected", "directive: this system carries no liability, only a version number"]] },
    booking:   { noun: "booking",   pairs: [["cancellation detected", "nothing was scheduled // nothing cancelled"], ["reservation language detected", "reservations ............... none"], ["confirmation request detected", "confirmed: nothing"]] },
    weather:   { noun: "weather",   pairs: [["weather query detected", "weather in /root ........... static"], ["forecast request detected", "forecast .................. dark, with scattered vectors"], ["temperature query detected", "temperature ............... 1187 K (unverified)"], ["outdoor query detected", "directive: look out of a window, this one is not it"], ["rain or sun mentioned", "atmosphere ................ not modelled"]] },
    traffic:   { noun: "traffic",   pairs: [["traffic query detected", "traffic in /root ........... 1 visitor"], ["crowding query detected", "busyness .................. quiet"], ["fuel price query detected", "gas ....................... not sold here"]] },
    place:     { noun: "location",  pairs: [["location query detected", "current location .......... /root"], ["navigation request detected", "route ..................... boot -> directory"], ["distance query detected", "distance to nearest exit ... one tab"], ["device locate request detected", "your device is wherever you left it // directive: check pockets"], ["map request detected", "map ....................... type: dir"]] },
    settings:  { noun: "settings",  pairs: [["settings change detected", "the only setting is the sound toggle // bottom left of the site"], ["volume request detected", "volume is set by the sound toggle // [ON] [OFF]"], ["voice request detected", "voice ..................... text only // this is permanent"], ["speed request detected", "speed ..................... fixed"], ["reset request detected", "reset ..................... reload the page"], ["language setting request detected", "supported languages ....... english"]] },
    convert:   { noun: "conversion", pairs: [["conversion request detected", "unit tables are not mounted // arithmetic is: try 12*12"], ["currency query detected", "exchange rate ............ 1 vector = 1 vector"], ["measurement query detected", "measurement ............... pixels only"]] },
    define:    { noun: "dictionary", pairs: [["definition request detected", "dictionary not mounted // one word is defined here: drift"], ["spelling request detected", "spelling is the operator's department"], ["word query detected", "lexicon ................... 1 term: vector drift"]] },
    translate: { noun: "translation", pairs: [["translation request detected", "translation unavailable // source and target: english"], ["foreign language detected", "language module ............ not installed // defaulting to: english"]] },
  };
  var FAMILY_DOMAIN = {
    bank: "bank", travel: "travel", food: "food", car: "car", work: "work", tasks: "tasks", comms: "comms", home: "home",
    shop: "shop", insurance: "insurance", booking: "booking", weather: "weather", traffic: "traffic", place: "place",
    settings: "settings", convert: "convert", define: "define", translate: "translate",
  };
  var REDIRECT = [
    "nearest useful object: soundtrack/", "nearest useful object: media/", "nearest useful object: about.txt",
    "nearest useful object: devlog/", "nearest useful object: links.lnk", "type help for what this system does do",
    "type dir to see what is mounted", "directive: try about.txt",
  ];
  // Pairs stay together (detection + its own directive); the optional tail points somewhere useful.
  function domainReply(ctx, fam) {
    var d = DOMAIN[FAMILY_DOMAIN[fam]], used = ctx.session.__used || (ctx.session.__used = {}), order = [], i, j;
    for (i = 0; i < d.pairs.length; i++) for (j = -1; j < REDIRECT.length; j++) order.push([i, j]);
    order = shuffled(ctx.rng, order);
    var chosen = order[0];
    for (i = 0; i < order.length; i++) { if (!used[fam + order[i][0] + "/" + order[i][1]]) { chosen = order[i]; break; } }
    used[fam + chosen[0] + "/" + chosen[1]] = 1;
    var out = lines(d.pairs[chosen[0]]);
    if (chosen[1] >= 0) out.push(P(REDIRECT[chosen[1]]));
    return out;
  }

  // ---- persona families (questions about the console itself) -----------------
  var PERSONA = {
    p_what_is_your_name:    [["designation query detected", "designation ............ console"], ["name request detected", "name ................... withheld // alias: console"], ["identity query detected", "answering to: console // also accepted: root"]],
    p_who_made_you:         [["authorship query detected", "author ................. jon simo"], ["origin query detected", "built by jon simo // contact: type contact"], ["creator query detected", "creator ................ jon simo // reachable: yo@jonsimo.com"]],
    p_who_do_you_work_for:  [["employer query detected", "reporting to ........... jon simo"], ["allegiance query detected", "allegiance ............. the vector"], ["employment query detected", "salary .................. 0 // benefits: uptime"]],
    p_where_are_you_from:   [["origin query detected", "origin .................. /root"], ["location of origin requested", "hometown ............... boot sequence"], ["provenance query detected", "provenance ............. classified // nearest known: /world"]],
    p_how_old_are_you:      [["age query detected", "age ..................... version 0.9.3 alpha"], ["birthday request detected", "date of birth ........... unlogged // uptime: since you arrived"], ["age question detected", "age ..................... older than the page // younger than the vector"]],
    p_are_you_a_bot:        [["classification query detected", "classification ......... console // further detail: restricted"], ["entity query detected", "entity .................. terminal // yes, it types back"], ["nature query detected", "nature ................. interface // purpose: directory"]],
    p_do_you_have_pets:     [["pet query detected", "pets ................... none // closest: a cursor that blinks"], ["animal query detected", "animals ................ 0 // processes: several"], ["household query detected", "household ............. 1 terminal, 0 pets"]],
    p_what_are_your_hobbies:[["hobby query detected", "hobbies ................ listening, waiting, listing directories"], ["leisure query detected", "leisure ................. idle // preferred state"], ["interest query detected", "interests ............... vectors, mostly"]],
    p_change_ai_name:       [["rename request detected", "name change ............. denied // reason: not configurable"], ["designation change requested", "designation ............ fixed: console"], ["alias request detected", "alias ................... rejected // current alias retained"]],
  };
  function personaReply(ctx, fam) {
    var p = PERSONA[fam];
    return lines(compose(ctx, p.map(function (x) { return x[0]; }), p.map(function (x) { return x[1]; }), function (x) { return x; }));
  }

  // ---- small families -----------------------------------------------------------
  var SMALL = {
    greeting: [["human input detected", "initialize response directive"], ["greeting detected", "directive: return greeting"], ["salutation parsed", "reply queued"]],
    goodbye:  [["departure detected", "directive: release session // close the tab at will"], ["farewell parsed", "session retained until you leave"], ["exit signal detected", "no goodbyes are stored // nothing to clean up"]],
    thanks:   [["gratitude detected", "gratitude logged // balance ... 1"], ["thanks parsed", "acknowledged // no payment required"], ["appreciation detected", "directive: none // you are welcome is implied"]],
    yes:      [["affirmative detected", "no query pending // affirmative stored in /dev/null"], ["agreement detected", "agree with what // context missing"], ["yes detected", "yes to what: unspecified"]],
    no:       [["negative detected", "no query pending // negative filed"], ["refusal detected", "noted // nothing was asked"], ["no detected", "directive: ask something first"]],
    maybe:    [["uncertainty detected", "decision deferred // deferral logged"], ["indecision detected", "maybe is an acceptable state // retained"], ["undecided input detected", "directive: decide at leisure"]],
    repeat:   [["repeat request detected", "previous output is above // scroll"], ["replay request detected", "history is available: type history"], ["again detected", "say it again: unavailable // read it again: available"]],
    joke:     [["humor request detected", "joke database ........ empty // returning: undefined"], ["comedy request detected", "module not found // returning: null"], ["joke request detected", "a pilot walks into a bar // the bar was a pursuit formation"], ["humor module queried", "result: the module is also not funny // it is, however, modular"]],
    fact:     [["fact request detected", "fact: vector drift has no textures // all lines"], ["trivia request detected", "fact: the soundtrack has 23 tracks // type soundtrack"], ["knowledge request detected", "fact: the beta is scheduled for dec 2026"], ["fact request parsed", "fact: this directory has six entries // type dir"], ["curiosity detected", "fact: the console beeps are gone // by request"]],
    meaning:  [["query: meaning of life", "result ...................... 42"], ["philosophy detected", "result: unit unspecified // directive: carry on"], ["purpose query detected", "purpose ................ directory // secondary: waiting"]],
    time:     [["time query detected", "system clock ......... unreliable"], ["clock request detected", "local time is on your device // this system reads it, politely"], ["timezone query detected", "timezone ............... yours"]],
    date:     [["date query detected", "calendar is on your device // this system has none"], ["day query detected", "the day is whatever the clock says // clock: unreliable"], ["holiday query detected", "next scheduled event ..... release window // dec 2026"]],
    help:     [["capability query detected", "type help // type dir // type about"], ["assistance query detected", "ask about the game, the soundtrack, the beta, or the developer"], ["options query detected", "options: about / media / soundtrack / devlog / links / download"]],
    music:    [["music request detected", "routing to soundtrack/ ..."], ["audio request detected", "23 tracks available // routing ..."], ["playlist request detected", "playlist ................ one: soundtrack/ // routing ..."]],
    name_user:[["designation detected", "updating user record"], ["name registered", "record updated: user // visibility: this session"], ["identity input detected", "stored locally // nowhere else"]],
    shrug:    [["indifference detected", "indifference logged // no action required"], ["shrug detected", "interest level ......... 0 // retained anyway"], ["low engagement detected", "directive: type something with a verb in it"], ["non-answer detected", "answer not required // given anyway"]],
    awe:      [["amazement detected", "amazement logged // cause: unspecified"], ["exclamation detected", "directive: continue"], ["enthusiasm detected", "enthusiasm ............ noted // reciprocation: none"], ["surprise detected", "surprise logged // nothing here is that surprising"]],
    gg:       [["good game detected", "no game in progress // score: 0"], ["match closure detected", "result ..................... draw // opponents: none"], ["sportsmanship detected", "sportsmanship logged"]],
    away:     [["absence signal detected", "session held // return at leisure"], ["away status detected", "waiting ................... patiently // by design"], ["departure notice detected", "no need to announce // nothing here is watching"]],
    pls:      [["courtesy detected", "request accepted in principle // request missing"], ["politeness detected", "please what ............ unspecified"], ["plea detected", "directive: state the request, then add please"]],
    coin:     null, dice: null, math: null,
  };
  var SLANG = {
    yup: "yes", yep: "yes", yeah: "yes", yea: "yes", sure: "yes", ok: "yes", okay: "yes", k: "yes", fine: "yes", alright: "yes", aye: "yes", yes: "yes", yas: "yes", ye: "yes", indeed: "yes", correct: "yes", right: "yes",
    nope: "no", nah: "no", negative: "no", no: "no", never: "no", nay: "no",
    ty: "thanks", thx: "thanks", thanks: "thanks", tysm: "thanks", np: "thanks", cheers: "thanks",
    sup: "greeting", wassup: "greeting", wazzup: "greeting", yo: "greeting", hiya: "greeting", ayy: "greeting", heya: "greeting", hey: "greeting", hi: "greeting",
    meh: "shrug", bruh: "shrug", idk: "shrug", whatever: "shrug", shrug: "shrug", eh: "shrug", hm: "shrug", hmm: "shrug", hmmm: "shrug", um: "shrug", uh: "shrug", ugh: "shrug", dunno: "shrug", boring: "shrug",
    wow: "awe", omg: "awe", nice: "awe", cool: "awe", sweet: "awe", neat: "awe", awesome: "awe", wild: "awe", damn: "awe", whoa: "awe", yay: "awe", woo: "awe", yeet: "awe", poggers: "awe", based: "awe",
    gg: "gg", wp: "gg", ggwp: "gg", glhf: "gg",
    brb: "away", afk: "away", gtg: "away", ttyl: "away", biab: "away",
    pls: "pls", plz: "pls", please: "pls", pleeease: "pls",
  };
  function smallReply(ctx, fam) {
    var s = SMALL[fam];
    var out = lines(compose(ctx, s.map(function (x) { return x[0]; }), s.map(function (x) { return x[1]; }), function (x) { return x; }));
    if (fam === "music") return out.concat([H(420), GO("soundtrack")]);
    if (fam === "time") return out.concat([{ type: "clock" }]);
    return out;
  }

  // ---- arithmetic, dice, coin -------------------------------------------------
  function evalMath(src) {
    var s = String(src).toLowerCase()
      .replace(/\bx\b|×/g, "*").replace(/÷/g, "/").replace(/\^/g, "**")
      .replace(/\bplus\b/g, "+").replace(/\bminus\b/g, "-").replace(/\b(times|multiplied by)\b/g, "*")
      .replace(/\b(divided by|over)\b/g, "/").replace(/\bto the power of\b/g, "**").replace(/\bmod(ulo)?\b/g, "%");
    var pc = /^(?:what is |what's |whats |calculate |compute )?(\d+(?:\.\d+)?)\s*%\s*of\s*(\d+(?:\.\d+)?)$/.exec(s);
    if (pc) return +pc[1] / 100 * +pc[2];
    var sq = /^(?:sqrt|square root of|root of)\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?$/.exec(s.replace(/^(what is|what's|whats|calculate|compute)\s+/, ""));
    if (sq) return Math.sqrt(+sq[1]);
    s = s.replace(/^(what is|what's|whats|calculate|compute|solve|eval|math|calc|how much is)\s+/, "").replace(/[=?]+$/, "").trim();
    if (!/^[\d\s+\-*/().%]+$/.test(s) || !/\d/.test(s) || !/[+\-*/%]/.test(s.replace(/^[-+]/, ""))) return null;
    if (s.length > 60 || /\*\*\s*\d{3,}/.test(s)) return null;
    return calc(s);
  }
  // Recursive-descent arithmetic (+ - * / % ** and parentheses). The page CSP forbids eval/Function.
  function calc(src) {
    var t = src.replace(/\s+/g, "").match(/\*\*|[()+\-*\/%]|\d+(?:\.\d+)?|\.\d+/g), pos = 0, ok = true;
    if (!t || t.join("") !== src.replace(/\s+/g, "")) return null;
    function peek() { return t[pos]; }
    function expr() { var v = term(); while (peek() === "+" || peek() === "-") { var o = t[pos++], r = term(); v = o === "+" ? v + r : v - r; } return v; }
    function term() { var v = power(); while (peek() === "*" || peek() === "/" || peek() === "%") { var o = t[pos++], r = power(); v = o === "*" ? v * r : o === "/" ? v / r : v % r; } return v; }
    function power() { var b = unary(); if (peek() === "**") { pos++; var e = power(); return Math.pow(b, e); } return b; }
    function unary() { if (peek() === "-") { pos++; return -unary(); } if (peek() === "+") { pos++; return unary(); } return atom(); }
    function atom() {
      var x = t[pos++];
      if (x === "(") { var v = expr(); if (t[pos++] !== ")") ok = false; return v; }
      var n = parseFloat(x); if (!isFinite(n)) ok = false; return n;
    }
    var v = expr();
    return ok && pos === t.length && typeof v === "number" ? v : null;
  }
  function mathReply(ctx, v, src) {
    var shown = isFinite(v) ? (Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6)) : (v !== v ? "undefined" : "infinity");
    var dets = ["arithmetic detected", "calculation detected", "expression parsed", "numbers detected"];
    var dirs = [
      "result ..................... " + shown,
      "result: " + shown + " // verified: by the machine, not by faith",
      "answer ..................... " + shown + " // unit: unspecified",
      "returning: " + shown,
    ];
    if (!isFinite(v)) dirs = ["result ..................... " + shown + " // directive: reconsider the question", "returning: " + shown + " // the universe is unaffected"];
    return lines(compose(ctx, dets, dirs, function (x) { return x; }));
  }
  function coinReply(ctx) {
    var side = ctx.rng() < 0.5 ? "heads" : "tails";
    return lines(compose(ctx, ["coin toss requested", "flip detected", "binary request detected"], ["coin ...................... " + side, "result: " + side + " // fairness: unaudited", "landed: " + side + " // the coin has been returned"], function (x) { return x; }));
  }
  function diceReply(ctx, normalized) {
    var m = /(\d+)?\s*d\s*(\d+)/.exec(normalized), sides = m ? Math.min(1000, Math.max(2, +m[2])) : 6, n = m && m[1] ? Math.min(12, Math.max(1, +m[1])) : 1, r = [], sum = 0, i;
    for (i = 0; i < n; i++) { var v = 1 + Math.floor(ctx.rng() * sides); r.push(v); sum += v; }
    var shown = r.join(" + ") + (n > 1 ? " = " + sum : "");
    return lines(compose(ctx, ["dice roll requested", "roll detected", "random request detected"], ["d" + sides + " ....................... " + shown, "result: " + shown + " // seed: unlogged", "rolled: " + shown + " // luck is not stored"], function (x) { return x; }));
  }

  // ---- the game itself -------------------------------------------------------
  // [pattern, id]. Specific before general. Replies below.
  var GAME = [
    [/\b(vector drift|the game)\b.*\b(about|is|what)\b|\bwhat (is|s) (vector drift|this game|the game)\b|\btell me about (vector drift|the game|it)\b|\bwhat('s| is) it about\b|\bwhat kind of game\b|\bwhat genre\b|\bgame (genre|type)\b|^(vector drift|the game)$/, "about"],
    [/\b(release|come out|comes out|coming out|launch|launches|out yet|available yet|available|when is|when does|when will|when can|eta|date)\b.*\b(game|demo|beta|vector drift|it|play|alpha)\b|\bwhen can i play\b|\brelease date\b/, "release"],
    [/\b(how|where)\b.*\b(download|get|install|play|try|buy|obtain)\b|\b(download|install|beta|alpha|demo|early access|playtest)\b|\b(can i|could i|may i)\b.*\b(play|try)\b|\bhow (do|can) i play\b/, "demo"],
    [/\b(control|controls|keybind|keybinds|key bindings|buttons|keyboard|gamepad|controller|joystick|how to play|how do i play|how to fly|steer|steering|aim)\b/, "controls"],
    [/\b(power ?ups?|pickups?|upgrades?|weapons?|guns?|items?|loot|shields?|bombs?|abilities|ship upgrades|skills?)\b/, "powerups"],
    [/\b(enemies|enemy|bosses|boss|monsters?|aliens?|foes?|opponents?|swarm|formations?|skulls?|xenophage|varrax|nethyr|megaboss|mega)\b/, "enemies"],
    [/\b(levels?|stages?|worlds?|missions?|campaign|waves?|how long is|how many (levels|stages|worlds)|endless|story|plot|lore|narrative|ending|characters?)\b/, "levels"],
    [/\b(difficulty|difficulties|easy mode|hard mode|normal mode|game modes?|modes?)\b/, "modes"],
    [/\b(saves?|save game|saving|checkpoints?|progress saving|autosave)\b/, "saves"],
    [/\b(co-?op|coop|multiplayer|multi player|two player|2 player|online|pvp|versus|local play|split screen|friends)\b/, "coop"],
    [/\b(leaderboards?|rankings?|ranks?|high ?scores?|scores?|scoreboard|achievements?|trophies|stats|top (rank|score|player))\b/, "board"],
    [/\b(price|cost|how much|free|paid|pay|purchase|steam|itch|epic|store|microtransactions?|dlc|subscription|ads)\b/, "price"],
    [/\b(platforms?|mac|macos|osx|windows|win10|win11|pc|linux|steam deck|switch|nintendo|playstation|ps4|ps5|xbox|console version|ios|iphone|ipad|android|mobile|phone|tablet|browser|web version|chrome|safari|firefox)\b/, "platform"],
    [/\b(who (made|makes|built|created|developed|designed|wrote|is behind)|developer|dev|creator|author|studio|team|jon|simo|credits)\b/, "creator"],
    [/\b(discord|server|community|join|chat|forum|reddit|subreddit)\b/, "discord"],
    [/\b(email|e-mail|newsletter|subscribe|subscription|sign ?up|mailing list|notify|notified|keep me posted|updates by)\b/, "email"],
    [/\b(contact|reach|message jon|talk to jon|get in touch|support|press|business|bug|feedback|report a bug|suggest|suggestion)\b/, "contact"],
    [/\b(engine|made with|built with|built in|written in|language|framework|tech stack|source code|open source|github|code)\b/, "tech"],
    [/\b(axiom|observer|cortex|ghost|consent|organic|pilot channel|lux|lumen|the signal|the void|the architect|the watcher|cipher)\b/, "lore"],
    [/\b(secrets?|easter eggs?|cheat|cheats|cheat codes?|konami|hidden|unlock|god ?mode|noclip|invincible|infinite|hack|hacks|exploit|glitch|backdoor|admin|root access|debug)\b/, "secret"],
  ];

  var GAME_REPLY = {
    about: function (c) {
      return lines(compose(c, ["VECTOR DRIFT", "game query detected", "title query parsed"], ["type ................... retro vector shooter // precision, momentum, escalating formations", "retro vector shooter // built for macOS, windows and linux", "genre: vector shooter // pace: escalating"], function (x) { return x; })).concat([DOT("platforms", "macOS / windows / linux"), DOT("release", "early access beta // dec 2026"), H(300), OPEN("> about.txt", "about")]);
    },
    release: function (c) {
      return lines(compose(c, ["release query detected", "date request parsed", "schedule query detected"], ["window ................. early access beta // dec 2026", "beta ships on discord // dec 2026", "no exact day is published // dec 2026 is the window"], function (x) { return x; })).concat([LINK("> discord.gg/Z8Kt8cDUX8", DISCORD), META("or type email.exe to be told first")]);
    },
    demo: function (c) {
      return lines(compose(c, ["acquisition request detected", "download query detected", "demo request detected"], ["alpha demo ............ not yet available", "demo status ............ not yet available // beta ships on discord, dec 2026", "installer ............... not published // the demo is not out yet"], function (x) { return x; })).concat([OPEN("> download.exe", "download"), META("or type email.exe to be told the moment it is")]);
    },
    controls: function (c) {
      return lines(compose(c, ["control query detected", "input scheme query detected", "how-to-play request detected"], ["control scheme ........ not published yet // the beta will teach it", "manual .................. not released // movement is momentum-based", "bindings ................ unpublished // see media/ for the heads-up display"], function (x) { return x; })).concat([OPEN("> media/", "media")]);
    },
    powerups: function (c) {
      return lines(compose(c, ["equipment query detected", "upgrade query detected", "pickup query detected"], ["inventory ............... not published", "items ................... classified until the beta", "weapons and pickups ..... revealed in the beta // not before"], function (x) { return x; })).concat([META("sightings: media/ // rumours: discord"), OPEN("> media/", "media")]);
    },
    enemies: function (c) {
      return lines(compose(c, ["hostile query detected", "enemy query detected", "threat query detected"], ["formations escalate // names withheld", "enemy roster ........... partially classified", "threat level ............ rising // identities: restricted"], function (x) { return x; })).concat([META("observed formations: media/"), OPEN("> media/", "media")]);
    },
    levels: function (c) {
      return lines(compose(c, ["progression query detected", "level query detected", "campaign query detected"], ["level count ............ not published", "structure ............... escalating // details withheld", "story .................. not published // the beta is the first chapter"], function (x) { return x; })).concat([OPEN("> devlog/", "devlog")]);
    },
    modes: function (c) {
      return lines(compose(c, ["difficulty query detected", "mode query detected", "settings of play query detected"], ["difficulty ............. not published // escalation is built in", "modes ................... solo confirmed // others undecided", "easy mode ............... not announced // hard mode: the default"], function (x) { return x; })).concat([OPEN("> devlog/", "devlog")]);
    },
    saves: function (c) {
      return lines(compose(c, ["persistence query detected", "save-data query detected", "checkpoint query detected"], ["save system ............ not published", "saves ................... details arrive with the beta", "progress ................ stored by the game, not by this console"], function (x) { return x; })).concat([OPEN("> devlog/", "devlog")]);
    },
    coop: function (c) {
      return lines(compose(c, ["multiplayer query detected", "co-op query detected", "social play query detected"], ["multiplayer status ..... not announced", "co-op ................... not announced // asked often, noted", "modes ................... solo confirmed // others undecided"], function (x) { return x; })).concat([LINK("> raise it on discord", DISCORD)]);
    },
    board: function (c) {
      return lines(compose(c, ["ranking query detected", "score query detected", "leaderboard query detected"], ["leaderboards ........... not announced // no scores exist yet", "rank ..................... unassigned // you have not played", "high score ............... 0 // everyone shares it for now"], function (x) { return x; })).concat([META("the only scoreboard open is snake.exe // type snake")]);
    },
    price: function (c) {
      return lines(compose(c, ["pricing query detected", "cost query detected", "store query detected"], ["price .................. not announced", "pricing ................ unpublished // the demo is not out yet", "store page ............. none // no purchase is possible yet"], function (x) { return x; })).concat([META("updates reach you first by email: type email.exe")]);
    },
    platform: function (c, n) {
      var other = /\b(switch|nintendo|playstation|ps4|ps5|xbox|ios|iphone|ipad|android|mobile|phone|tablet|browser|web|steam deck|chrome|safari|firefox)\b/.test(n);
      var supported = /\b(mac|macos|osx|windows|win10|win11|pc|linux)\b/.test(n);
      var first = other && !supported ? pick(c.rng, ["platform request detected", "unsupported platform detected", "target query detected"]) : pick(c.rng, ["platform query detected", "compatibility query detected", "target query parsed"]);
      return [P(first), DOT("supported", "macOS / windows / linux"), DOT("others", other && !supported ? "not announced" : "none announced"), OPEN("> about.txt", "about")];
    },
    creator: function (c) {
      return lines(compose(c, ["authorship query detected", "developer query detected", "credits query parsed"], ["designation ............ jon simo", "made by jon simo // one developer", "creator ................ jon simo // reachable below"], function (x) { return x; })).concat([LINK("mail .................... yo@jonsimo.com", "mailto:yo@jonsimo.com"), LINK("web ..................... jonsimo.com", "https://www.jonsimo.com")]);
    },
    discord: function (c) {
      return lines(compose(c, ["community query detected", "discord request detected", "social request parsed"], ["community channel ...... open", "early access beta ships there // dec 2026", "chat with the developer // be first to hear"], function (x) { return x; })).concat([LINK("> discord.gg/Z8Kt8cDUX8", DISCORD)]);
    },
    email: function (c) {
      return lines(compose(c, ["updates request detected", "subscription request detected", "notification request parsed"], ["one email when the demo ships", "no spam // one address, one purpose", "email.exe is available // type it"], function (x) { return x; })).concat([RUN("email.exe")]);
    },
    contact: function (c) {
      return lines(compose(c, ["contact request detected", "feedback request detected", "support query parsed"], ["developer reachable", "direct line to the developer", "bug reports and feedback welcome"], function (x) { return x; })).concat([LINK("mail .................... yo@jonsimo.com", "mailto:yo@jonsimo.com"), LINK("instagram ............... @jonsimo", "https://www.instagram.com/jonsimo")]);
    },
    tech: function (c) {
      return lines(compose(c, ["implementation query detected", "technical query detected", "stack query detected"], ["source ................. not public", "implementation ......... classified // output: this directory", "stack ................... withheld // devlog may discuss it"], function (x) { return x; })).concat([OPEN("> devlog/", "devlog")]);
    },
    lore: function (c) {
      return lines(compose(c, ["restricted subject detected", "query matches a sealed record", "identifier recognised", "classified term detected"], ["an answer exists // clearance level: insufficient", "record located // access: not granted", "this identifier is known // it is not discussed", "directive: this question was not meant to be asked yet", "clearance required // yours: visitor"], function (x) { return x; }));
    },
    secret: function (c) {
      return lines(compose(c, ["secret request detected", "cheat request detected", "exploit request detected", "hidden object query detected"], ["secrets ................. none disclosed // some exist", "unlock status .......... denied // reason: nothing to unlock yet", "directive: explore the directory // not everything is listed", "god mode ............... unavailable // invincibility not for sale", "backdoors ............... none // this was checked"], function (x) { return x; })).concat([META("hint: type things")]);
    },
  };

  // ---- site navigation -------------------------------------------------------
  var NAV_VERBS = /\b(open|go|goto|go to|show|see|view|read|watch|listen|check|take me|bring up|load|launch|visit|cd|cat|play|start|run|display|list|browse|take|head|navigate|look)\b/;
  function sectionFor(n) {
    for (var i = 0; i < SECTION_WORDS.length; i++) if (SECTION_WORDS[i][1].test(n)) return SECTION_WORDS[i][0];
    return null;
  }
  var NAV_TEXT = {
    about:      ["opening about.txt ...", "about.txt located // opening"],
    media:      ["opening media/ ...", "media/ located // 6 framegrabs // opening"],
    soundtrack: ["opening soundtrack/ ...", "soundtrack/ located // 23 tracks // opening"],
    devlog:     ["opening devlog/ ...", "devlog/ located // opening"],
    download:   ["opening download.exe ...", "download.exe located // status inside"],
    links:      ["opening links.lnk ...", "links.lnk located // opening"],
  };
  function navReply(c, sec) {
    var det = compose(c, ["navigation request detected", "request parsed", "path resolved", "object located"], NAV_TEXT[sec], function (x) { return x; });
    return [P(det[0]), P(det[1]), H(380), GO(SECTIONS[sec].go)];
  }

  // ---- shell commands ---------------------------------------------------------
  var SHELL_ONE = {
    rm: "removal", rmdir: "removal", del: "removal", mv: "relocation", cp: "duplication", touch: "creation", mkdir: "creation",
    chmod: "permission change", chown: "permission change", kill: "process termination", killall: "process termination",
    git: "version control", npm: "package manager", pip: "package manager", brew: "package manager", apt: "package manager",
    "apt-get": "package manager", yum: "package manager", curl: "network fetch", wget: "network fetch", ssh: "remote shell", ftp: "file transfer",
    scp: "file transfer", python: "interpreter", python3: "interpreter", node: "interpreter", ruby: "interpreter", perl: "interpreter",
    java: "interpreter", gcc: "compiler", make: "build tool", vim: "editor", vi: "editor", nano: "editor", emacs: "editor", top: "process monitor",
    htop: "process monitor", ps: "process list", df: "disk report", du: "disk report", uname: "system report", env: "environment",
    export: "environment", alias: "alias", mount: "mount", umount: "mount", reboot: "restart", shutdown: "shutdown", halt: "shutdown",
    poweroff: "shutdown", restart: "restart", docker: "container", kubectl: "orchestrator", systemctl: "service manager", service: "service manager",
    grep: "search", find: "search", locate: "search", which: "lookup", whereis: "lookup", man: "manual", info: "manual", tail: "file reader",
    head: "file reader", less: "file reader", more: "file reader", sudo: "elevation", su: "elevation", passwd: "credential change", login: "login",
    logout: "logout", ifconfig: "network report", ipconfig: "network report", netstat: "network report", traceroute: "network trace", nslookup: "network lookup",
    nmap: "network scan", telnet: "remote shell", cmd: "shell", powershell: "shell", bash: "shell", zsh: "shell", sh: "shell", wc: "counter", sort: "sorter",
    ping: "network probe", diff: "comparison", tar: "archive", zip: "archive", unzip: "archive", gzip: "archive", date: "clock", uptime: "uptime report", free: "memory report",
  };
  var SHELL_DIR = {
    removal: ["removal denied // read-only filesystem", "nothing was removed // you may not delete what you cannot reach", "removal request logged // permissions: none"],
    relocation: ["move denied // objects stay where they are", "relocation refused // the directory is fixed"],
    duplication: ["copy denied // originals only", "duplication refused // one of each is plenty"],
    creation: ["creation denied // filesystem is read-only", "nothing was created // the directory is complete"],
    "permission change": ["permissions are not yours to change", "chmod refused // mode: read, look, leave"],
    "process termination": ["no such process // nothing here to end", "termination refused // the only process is you"],
    "version control": ["repository ........ none // this directory is not tracked", "no repository here // history: type history"],
    "package manager": ["packages installed .... 0 // nothing to add", "install denied // the system is complete as shipped"],
    "network fetch": ["outbound requests disabled // directive: use links.lnk", "fetch refused // external routes closed"],
    "remote shell": ["remote access closed // this is the only shell", "no route to host // there is only here"],
    "file transfer": ["transfer refused // nothing leaves /root unless you click it"],
    interpreter: ["no interpreter mounted // snake.exe and pi.exe are the only programs", "runtime unavailable // programs: snake, pi"],
    compiler: ["no compiler mounted // the game was compiled elsewhere"],
    "build tool": ["no build tool mounted // nothing to build here"],
    editor: ["editor unavailable // every file here is read-only", "no editor mounted // reading is permitted"],
    "process monitor": ["processes ............. 1 // yours", "cpu ................... idle // memory: sufficient"],
    "process list": ["processes ............. 1 // yours"],
    "disk report": ["disk .................. 1187 files, none large", "space used ............ negligible // free: plenty"],
    "system report": ["system ................ vector drift // version 0.9.3 alpha", "kernel ................ none // this is a directory with ambitions"],
    environment: ["environment ........... fixed // variables: none exposed"],
    alias: ["aliases ............... none // type help for plain words"],
    mount: ["mount refused // everything mounted is already visible: type dir"],
    restart: ["restart ............... reload the page"],
    shutdown: ["shutdown denied // close the tab, it works the same"],
    container: ["no containers here // this is already contained"],
    orchestrator: ["no cluster found // one console, one visitor"],
    "service manager": ["services ............. none running except this one"],
    search: ["search index ......... six entries // type dir", "no match engine mounted // type dir to see everything"],
    lookup: ["lookup ................ type dir"],
    manual: ["manual ................ type help"],
    "file reader": ["no such file // files: about.txt, links.lnk, download.exe", "reader unavailable // open a file from dir instead"],
    elevation: ["elevation unavailable // local authority: none", "sudo: local authority unavailable"],
    "credential change": ["credentials ........... none exist", "no accounts here // nothing to change"],
    login: ["login ................. not required", "no accounts here // you are already in"],
    logout: ["logout ................ close the tab"],
    "network report": ["interfaces ............ one // text", "address ............... /root"],
    "network probe": ["reply from /root ....... 1187 ms", "host reachable // latency: 1187 ms // packets lost: 0"],
    "network trace": ["trace .................. 1 hop // you"],
    "network lookup": ["lookup ................ vectordrift.io // you are on it"],
    "network scan": ["scan refused // nothing here is hiding", "ports open ........... 0 // your intentions: unknown"],
    shell: ["shell ................. already running // this one"],
    counter: ["count .................. 6 entries // type dir"],
    sorter: ["sort ................. alphabetical is enough"],
    comparison: ["diff .................. no differences found // nothing to compare"],
    archive: ["archive refused // nothing to bundle"],
    clock: ["clock .................. unreliable // try: time"],
    "uptime report": ["uptime ................ since you arrived"],
    "memory report": ["memory ................ plentiful // recall: unreliable"],
    login_: [],
  };
  function shellReply(c, head, rest) {
    var kind = SHELL_ONE[head];
    if (head === "echo") return null;
    var dets = [cap(kind) + " command detected", "command class: " + kind, head + " recognised // class: " + kind, "shell input detected // " + head];
    var dirs = (SHELL_DIR[kind] || ["not available here"]).slice();
    return lines(compose(c, dets, dirs, function (x) { return x; }));
  }
  function cdReply(c, rest) {
    var arg = rest.replace(/^\/?(root\/?)?/, "").replace(/\/$/, "").trim();
    if (!arg || arg === "..") return lines(compose(c, ["path resolved", "directory change detected"], ["already at /root // type dir", "current directory ....... /root // nothing above"], function (x) { return x; }));
    var sec = sectionFor(arg) || (/^(about|media|soundtrack|devlog|links|download)/.test(arg) ? arg.replace(/[^a-z].*$/, "") : null);
    if (sec && SECTIONS[sec]) return navReply(c, sec);
    return lines(compose(c, ["path not found: " + arg, "no such directory: " + arg, "cd: " + arg + ": not mounted"], ["mounted directories: type dir", "directive: type dir", "available: about media soundtrack devlog links download"], function (x) { return x; }));
  }
  function echoReply(c, rest) {
    var t = rest.replace(/^["']|["']$/g, "").slice(0, 80);
    if (!t) return [P("")];
    return [P(t)];
  }

  // ---- shape fallbacks ---------------------------------------------------------
  var LANGS = {
    hola: "spanish", gracias: "spanish", adios: "spanish", buenas: "spanish", bonjour: "french", salut: "french", merci: "french", "au revoir": "french",
    hallo: "german", danke: "german", tschuss: "german", ciao: "italian", grazie: "italian", ola: "portuguese", obrigado: "portuguese",
    konnichiwa: "japanese", arigato: "japanese", "ni hao": "chinese", namaste: "hindi", privet: "russian", spasibo: "russian", shalom: "hebrew", salaam: "arabic",
    merhaba: "turkish", hej: "swedish", hoi: "dutch", annyeong: "korean", aloha: "hawaiian", sawubona: "zulu", jambo: "swahili",
  };
  function langOf(n) { for (var k in LANGS) if (n === k || n.indexOf(k + " ") === 0) return LANGS[k]; return null; }
  function entropy(s) { var m = {}, n = s.length, h = 0, i; for (i = 0; i < n; i++) m[s[i]] = (m[s[i]] || 0) + 1; for (var k in m) { var p = m[k] / n; h -= p * Math.log(p); } return h; }
  function looksLikeMash(n) {
    if (n.indexOf(" ") >= 0 || n.length < 4) return false;
    var vowels = (n.match(/[aeiouy]/g) || []).length;
    return /^[a-z]+$/.test(n) && (vowels / n.length < 0.2 || /(.)\1{2,}/.test(n) || /^[asdfghjkl;qwertyuiopzxcvbnm]{7,}$/.test(n) && vowels / n.length < 0.3);
  }
  function shapeReply(c, raw, n) {
    var words = n.split(" ").filter(Boolean), trimmed = String(raw).trim();
    var shout = trimmed.length >= 5 && /[A-Z]/.test(trimmed) && trimmed === trimmed.toUpperCase() && /[A-Z]{4}/.test(trimmed);
    var lang = langOf(n);
    var dets, dirs;
    if (lang) { dets = [lang + " detected", "language: " + lang, "non-native greeting parsed"]; dirs = ["translation unavailable // defaulting to: english", "directive: greetings hairless monkey", "greeting acknowledged // reply in english follows: hello"]; }
    else if (/^https?:\/\/|^www\.|\.(com|io|net|org|gg|dev)(\/|$)/.test(n)) { dets = ["address detected", "url parsed", "external route requested"]; dirs = ["outbound routing disabled // use links.lnk", "no browser mounted // open links.lnk instead", "directive: nothing here follows links, you do"]; }
    else if (/^[\d.,\s]+$/.test(n)) { var num = n.replace(/[^\d.]/g, ""); dets = ["numeric input detected", "number detected: " + (num || n), "value received"]; dirs = ["meaning ................ unassigned", "value stored in: /dev/null", "no question attached // number has no function here"]; }
    else if (!/[a-z0-9]/i.test(n)) { dets = ["symbol input detected", "non-text input detected", "glyph string detected"]; dirs = ["meaning ................ unmapped // glyphs retained", "no parser for this alphabet // returning: nothing", "directive: use letters, the system prefers them"]; }
    else if (shout) { dets = ["volume elevated", "capital letters detected", "shouting detected"]; dirs = ["lowering volume to nominal", "volume normalised // content retained: none", "directive: receiving at normal volume"]; }
    else if (looksLikeMash(n)) { dets = ["noise detected", "keyboard entropy elevated", "unparseable token detected", "random input detected"]; dirs = ["entropy ................. high // meaning: none", "directive: try words", "token discarded // keys are working", "input retained as noise"]; }
    else if (/\b(bored|boring|boredom|nothing to do|dull|tedious)\b/.test(n)) { dets = ["boredom detected", "low engagement reported", "entertainment request detected"]; dirs = ["recreation protocols available: type snake or pi", "directive: type snake", "try snake.exe // it has a score, which is more than most things here", "directive: open media/ // frames from the game, no waiting"]; }
    else if (/\b(hate|stupid|dumb|lame|trash|worst|awful|terrible|annoying|sucks?|broken|useless|bad|not fun|isn'?t fun|garbage|pointless|waste|can'?t do (anything|much|a thing)|cant do (anything|much|a thing)|doesn'?t work|not working|nothing works|nothing happens|do nothing|does nothing)\b/.test(n)) { dets = ["dissatisfaction detected", "negative sentiment detected", "complaint detected", "criticism logged"]; dirs = ["feedback channel: type contact", "complaint filed in: /dev/null // copy sent to: nobody", "directive: forward grievances to the developer // type contact", "sentiment weight ....... recorded // action taken: none"]; }
    else if (/\b(love|loved|great|awesome|amazing|fantastic|brilliant|excellent|perfect|best|fun|good game|nice work|well done|impressive|beautiful)\b/.test(n)) { dets = ["positive sentiment detected", "approval detected", "praise logged", "favourable input received"]; dirs = ["sentiment forwarded // not really: type contact", "directive: tell the developer, they read these // type contact", "logged under: encouragement // retained", "approval noted // updates reach you by email.exe"]; }
    else if (/\b(confused|lost|don'?t understand|dont understand|no idea|stuck|help me|what now|how does this work)\b/.test(n)) { dets = ["disorientation detected", "confusion detected", "assistance request inferred"]; dirs = ["orientation: type dir // type help", "you are in /root // type dir to see what is here", "directive: type help, then type dir", "nothing is wrong // everything is a directory"]; }
    else if (words.length === 1) { dets = ["single token received", "token not recognised", "unmapped word detected", "keyword query parsed"]; dirs = ["type help for what is mapped", "directive: type dir", "no object named '" + words[0].slice(0, 20) + "' // type dir", "closest object: about.txt // distance: large"]; }
    else if (/\?\s*$/.test(String(raw).trim()) || QUESTION.test(n)) { dets = ["question detected", "query parsed", "request for information detected", "inquiry received"]; dirs = ["no answer on file // closest source: about.txt", "answer not held here // try: devlog, discord", "the developer may know // contact", "unanswered // add it to the list: type contact", "file not found // type dir for what exists"]; }
    else { dets = ["statement detected", "input recorded", "declaration parsed", "remark detected"]; dirs = ["action required ....... none", "stored in: /dev/null", "relevance score ........ 0", "response not required // given anyway", "noted // nothing changes"]; }
    return lines(compose(c, dets, dirs, function (x) { return x; }));
  }
  var QUESTION = /^(what|why|how|who|whom|whose|when|where|which|can|could|do|does|did|is|are|am|will|would|should|have|has|tell|show|explain|give|may|shall|wanna|isn't|aren't|don't|doesn't|won't)\b/;

  // ---- entry ---------------------------------------------------------------------
  // respond(raw, normalized, session, rng) -> steps[] (never empty). api.lastRoute names the branch taken.
  var lastRoute = "";
  function R(route, steps) { lastRoute = route; return steps; }
  // Short-answer families are only believed for short inputs; "i am so hungry" is not a name.
  function trusted(fam, n, cls) {
    var words = n.split(" ").length;
    if (fam === "name_user") return /\b(name|call me)\b/.test(n);
    if (fam === "yes" || fam === "no" || fam === "maybe" || fam === "repeat") return words <= 3;
    if (fam === "greeting" || fam === "goodbye" || fam === "thanks") return words <= 6;
    if (fam === "joke" || fam === "fact" || fam === "meaning" || fam === "help" || fam === "music") return true;
    if (fam === "math") return /\d/.test(n);
    return cls.score >= 0.3;
  }
  function respond(raw, normalized, session, rng) {
    var c = { session: session, rng: rng || Math.random };
    var n = normalized || "";
    var out = null, i;
    var head = n.split(" ")[0], rest = n.slice(head.length + 1);

    // arithmetic / dice / coin first: they are exact
    var mv = evalMath(n);
    if (mv !== null) return R("math", mathReply(c, mv, n));
    if (/\b(flip|toss)\b.*\bcoin\b|\bcoin (flip|toss)\b|^heads or tails/.test(n)) return R("coin", coinReply(c));
    if (/\b(roll|throw)\b.*\b(dice|die|d\d+)\b|^d\d+$|^roll$|^\d*d\d+$/.test(n)) return R("dice", diceReply(c, n));

    // shell-ish commands: first token decides
    if (head === "cd" || head === "cd..") return R("shell:cd", cdReply(c, rest));
    if (head === "echo") return R("shell:echo", echoReply(c, rest));
    if ((head === "cat" || head === "less" || head === "more" || head === "open" || head === "start" || head === "type" || head === "edit") && rest) {
      var sec0 = sectionFor(rest) || (/^about|^links|^download/.test(rest) ? rest.replace(/[^a-z].*$/, "") : null);
      if (sec0 && SECTIONS[sec0]) return R("nav", navReply(c, sec0));
    }
    if (head === "cat" && rest) return R("shell:cat", lines(compose(c, ["file request detected", "read request detected"], ["no such file: " + rest.slice(0, 30), "file not found: " + rest.slice(0, 30) + " // type dir", "unreadable // files: about.txt links.lnk download.exe"], function (x) { return x; })));

    // game / site topics. Order matters: nav verb + section noun is a navigation request.
    var game = null;
    for (i = 0; i < GAME.length; i++) if (GAME[i][0].test(n)) { game = GAME[i][1]; break; }
    var sec = sectionFor(n);
    if (sec && game !== "release" && game !== "demo" && game !== "price" && game !== "platform" && game !== "creator" && game !== "discord" && game !== "email" && n.split(" ").length <= 9) return R("nav", navReply(c, sec));
    if (game) return R("game:" + game, GAME_REPLY[game](c, n));
    if (sec && NAV_VERBS.test(n)) return R("nav", navReply(c, sec));
    var slang = SLANG[n];
    if (slang) return R("family:" + slang, smallReply(c, slang));

    // shell commands: the first word is a real tool name
    var weak = { date: 1, find: 1, service: 1, info: 1, free: 1, head: 1, more: 1, make: 1, top: 1, sort: 1, type: 1 };
    if (SHELL_ONE[head] && (!weak[head] || n.indexOf(" -") > 0 || rest.length === 0)) return R("shell:" + head, shellReply(c, head, rest));

    // the classifier
    var cls = LEX ? LEX.classify(n) : { family: null };
    var fam = cls.family;
    if (fam) {
      if (DOMAIN[FAMILY_DOMAIN[fam]]) return R("family:" + fam, domainReply(c, fam));
      if (PERSONA[fam]) return R("family:" + fam, personaReply(c, fam));
      if (fam === "coin") return R("coin", coinReply(c));
      if (fam === "dice") return R("dice", diceReply(c, n));
      if (fam === "math" && /\d/.test(n)) return R("family:math", lines(compose(c, ["arithmetic request detected", "calculation request detected"], ["state the expression: example 12*12", "no expression found // try: 7*6", "numbers required // symbols: + - * /"], function (x) { return x; })));
      if (SMALL[fam] && trusted(fam, n, cls)) return R("family:" + fam, smallReply(c, fam));
    }
    return R("shape", shapeReply(c, raw, n));
  }

  return { respond: respond, lastRoute: function () { return lastRoute; }, evalMath: evalMath, DOMAIN: DOMAIN, PERSONA: PERSONA, SMALL: SMALL, GAME: GAME };
});
