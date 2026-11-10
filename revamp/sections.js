/* Vector Drift site shell: directory sections, console dock, programs.
   Network use: the email signup posts one address to Kit (uplink.js) when the
   visitor presses SIGN UP, and nothing else. */
(() => {
  "use strict";
  const params = new URLSearchParams(location.search);
  const layout = ["split", "tree", "desk"].includes(params.get("layout")) ? params.get("layout") : "split";
  document.body.dataset.layout = layout;
  const content = document.getElementById("section-content");
  const input = document.getElementById("section-command");
  const consoleHistory = document.getElementById("console-history");
  const consoleResponse = document.querySelector(".console-response");
  const consoleDock = document.querySelector(".console-dock");
  const consoleLines = document.querySelector(".console-lines");
  const commandForm = document.querySelector(".command-form");
  const caretMeasure = document.querySelector(".caret-measure");
  const caret = document.querySelector(".console-caret");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const Engine = window.VDConsoleEngine;
  const consoleSession = Engine.createSession();
  const PROGRAMS = ["snake", "pi", "ost"];
  const CONTACT = { email: "yo@jonsimo.com", site: "https://www.jonsimo.com", instagram: "https://www.instagram.com/jonsimo" };
  const DISCORD_URL = "https://discord.gg/Z8Kt8cDUX8"; // permanent invite (no expiry), supplied by Jon 2026-11-06
  let pendingPrefill = "";
  const sections = ["root", "about", "media", "soundtrack", "devlog", "links", "download", "discord", "email", "contact", "reference"];
  const paths = { root: "", about: "about.txt", media: "media/", soundtrack: "soundtrack/", devlog: "devlog/", links: "links.lnk", download: "download.exe", discord: "discord", email: "email", contact: "contact", reference: "console/reference" };
  const Routes = window.VDRouteState;
  const parseHash = (hash = location.hash) => Routes.parseHash(hash, sections);
  const routeKey = Routes.routeKey;
  const initialRoute = parseHash();
  let current = initialRoute.section;
  let currentReader = null;
  let routeNotice = "";
  const readers = Routes.createReaderStore();
  let pointerHeld = false;
  let sizePending = false;
  let lastSiteSection = "root";
  let selectedFile = 1;
  let generation = 0;
  let directoryIndex = 1;
  let commandEpoch = 0;
  let programName = null;   // "snake" | "pi" while a console program owns the window
  let historyIndex = 0;
  let draft = "";
  // Up / Down in an empty console cycles through commands that do something fun.
  const SUGGEST = ["show me the game", "play the ost", "tell me about the game", "what's new", "hello", "play snake", "who made this", "how do i get the beta", "tell me a joke", "join the discord", "status", "whoami"];
  let suggestIndex = -1;
  let consoleState = "collapsed"; // collapsed -> hover preview -> active input
  let transcriptAnchor = null;
  let pointerInConsole = false;
  let dismissedWhileHovered = false;
  let collapseTimer = 0;
  let greenStep = ["0", "1", "2"].includes(params.get("green")) ? +params.get("green") : 1;
  let bloom = params.get("bloom") !== "off";

  function updateReviewLinks() {
    const query = `layout=${layout}&green=${greenStep}&bloom=${bloom ? "on" : "off"}`;

    document.querySelectorAll("[data-layout-link]").forEach(a => {
      a.href = `?layout=${a.dataset.layoutLink}&green=${greenStep}&bloom=${bloom ? "on" : "off"}#${routeHash()}`;
    });
  }
  const routeHash = () => Routes.routeHash({ section: current, reader: currentReader });
  const currentKey = () => routeKey({ section: current, reader: currentReader });
  function writeRoute(mode = "push") {
    const query = `layout=${layout}&green=${greenStep}&bloom=${bloom ? "on" : "off"}`;
    const url = `?${query}#${routeHash()}`;
    const state = { section: current, reader: currentReader, frame: selectedFile };
    if (mode === "none") return;
    if (mode === "replace") history.replaceState(state,"",url);
    else {
      const here = history.state?.section ? routeKey(history.state) : routeKey(parseHash());
      if (here !== currentKey()) history.pushState(state,"",url);
    }
  }
  function expireChoices(clearQuestion = false) {
    consoleLines.querySelectorAll("button[data-contextual]").forEach(button => {
      button.disabled = true;
      button.title = "This question is no longer current. Use the latest reply options.";
    });
    if (clearQuestion) consoleSession.followup = null;
  }
  function applyPalette() {
    const shift = greenStep * 4;
    const root = document.documentElement.style;
    root.setProperty("--phos", `rgb(17,202,${184-shift})`);
    root.setProperty("--phos-rgb", `17,202,${184-shift}`);
    root.setProperty("--hot", `rgb(174,249,${230-shift})`);
    root.setProperty("--hot-rgb", `174,249,${230-shift}`);
    root.setProperty("--logo-drift", `rgb(143,245,${220-shift})`);
    document.body.dataset.bloom = bloom ? "on" : "off";
    document.querySelectorAll("[data-green]").forEach(button => button.setAttribute("aria-pressed", String(+button.dataset.green === greenStep)));
    const toggle = document.querySelector(".bloom-toggle");
    if (toggle) { toggle.setAttribute("aria-pressed", String(bloom)); toggle.textContent = bloom ? "LIGHT: TIGHT" : "LIGHT: ORIGINAL"; }
    writeRoute("replace");
    updateReviewLinks();
  }
  document.querySelectorAll("[data-green]").forEach(button => button.addEventListener("click", () => { greenStep = +button.dataset.green; applyPalette(); }));
  const bloomToggle = document.querySelector(".bloom-toggle");
  if (bloomToggle) bloomToggle.addEventListener("click", () => { bloom = !bloom; applyPalette(); });
  applyPalette();

  function updateCaret() {
    const shell = input.closest(".console-input-shell"); if (shell) shell.classList.toggle("has-text", input.value.length > 0);
    caretMeasure.textContent = input.value.slice(0, input.selectionStart ?? input.value.length);
    const x = caretMeasure.getBoundingClientRect().width - input.scrollLeft;
    caret.style.transform = `translateX(${Math.max(0, x)}px)`;
    caret.classList.toggle("selected", input.selectionStart !== input.selectionEnd);
  }
  function sizeHistory(follow = false, instant = false) {
    if (follow) transcriptAnchor = "bottom";
    // Never move or resize the transcript between a press and its release:
    // a target that shifts under the pointer turns the click into nothing.
    if (pointerHeld) { sizePending = true; return; }
    // the transcript sits above the prompt, so the prompt drops down as lines arrive; once the window is full it scrolls
    const formH = programName ? 0 : commandForm.offsetHeight + 20;
    const room = Math.max(80, innerHeight * (programName ? .8 : .56) - formH);
    const height = consoleState !== "collapsed" ? Math.min(consoleLines.scrollHeight, room) : 0;
    if (instant) consoleHistory.style.transition = "none";
    consoleHistory.style.height = `${height}px`;
    if (instant) { void consoleHistory.offsetHeight; requestAnimationFrame(() => { consoleHistory.style.transition = ""; }); }
    requestAnimationFrame(() => {
      if (pointerHeld) return;
      if (transcriptAnchor === "bottom") consoleHistory.scrollTop = consoleHistory.scrollHeight;
      else if (transcriptAnchor?.isConnected) consoleHistory.scrollTop = transcriptAnchor.getBoundingClientRect().top - consoleLines.getBoundingClientRect().top;
    });
    updateCaret();
  }
  function setConsoleOpen(open, engage = false) {
    clearTimeout(collapseTimer);
    const reopening = open && consoleState === "collapsed";
    if (open && consoleDock.dataset.expanded !== "true") consoleDock.style.height = consoleDock.offsetHeight + "px";
    if (!open) consoleDock.style.height = "";
    consoleState = !open ? "collapsed" : engage || consoleState === "active" ? "active" : "preview";
    consoleDock.dataset.expanded = String(open);
    document.body.classList.toggle("console-open", open);
    consoleDock.dataset.mode = consoleState;
    consoleHistory.setAttribute("aria-hidden", String(!open));
    consoleHistory.inert = !open;
    sizeHistory(reopening);
  }
  function focusConsole() {
    dismissedWhileHovered = false;
    setConsoleOpen(true, true);
    input.focus({ preventScroll: true });
  }
  function closeConsole() {
    dismissedWhileHovered = true;
    if (consoleDock.contains(document.activeElement)) document.activeElement.blur();
    setConsoleOpen(false);
  }
  function scheduleCollapse() {
    clearTimeout(collapseTimer);
    collapseTimer = setTimeout(() => {
      if (!programName && !pointerInConsole && !pointerHeld && !consoleDock.contains(document.activeElement)) setConsoleOpen(false);
    }, 280);
  }
  consoleDock.addEventListener("pointerenter", e => {
    if (e.pointerType !== "mouse" || !matchMedia("(min-width: 681px) and (hover: hover)").matches) return;
    pointerInConsole = true;
  });
  consoleDock.addEventListener("pointerleave", () => {
    pointerInConsole = false;
    dismissedWhileHovered = false;
    scheduleCollapse();
  });
  consoleDock.addEventListener("focusin", e => {
    clearTimeout(collapseTimer);
    if (e.target === input) { dismissedWhileHovered = false; setConsoleOpen(true, true); }
  });
  consoleDock.addEventListener("focusout", scheduleCollapse);
  ["wheel","touchmove"].forEach(event => consoleHistory.addEventListener(event, () => { transcriptAnchor=null; }, {passive:true}));
  consoleHistory.addEventListener("pointerdown", event => { pointerHeld = true; if(!event.target.closest("button"))transcriptAnchor=null; }, true);
  // Release after the click has been dispatched, then apply any deferred sizing.
  ["pointerup","pointercancel"].forEach(name => window.addEventListener(name, () => {
    if (!pointerHeld) return;
    setTimeout(() => { pointerHeld = false; if (sizePending) { sizePending = false; sizeHistory(); } scheduleCollapse(); }, 0);
  }, true));
  ["input", "keyup", "click", "select", "scroll"].forEach(name => input.addEventListener(name, updateCaret));
  new ResizeObserver(() => sizeHistory()).observe(consoleLines);
  new ResizeObserver(() => updateCaret()).observe(document.querySelector(".console-input-shell"));
  document.documentElement.style.setProperty("--review-height", "0px");
  window.addEventListener("resize", () => sizeHistory());

  function openReader(lines, title) {
    const text = /^help /i.test(title||"") ? lines.map(line=>line.replace(/ {2,}/g," — ")) : lines;
    const id = readers.add({ title, lines: text, from: current === "reference" ? lastSiteSection : current });
    showSection("reference", false, "ui", "push", { reader: id });
  }
  // The first line reads console>; once something has been entered the prompt is just the path (root:/ ...).
  let consoleUsed = false;
  function promptLabel() { return consoleUsed ? (document.getElementById("prompt-path").textContent || "root:/") : "console>"; }
  function markUsed() { if (!consoleUsed) { consoleUsed = true; document.body.classList.add("console-used"); } }
  function report(text, command, suggestions = []) {
    suggestions = [];   // no hint buttons under responses: the console only says "input command here" and answers
    const entry = element("div", "console-entry");
    if (command) entry.append(element("div", "console-echo", `${promptLabel()} ${command}`));
    const lines = Array.isArray(text) ? text : [text];
    const lengthy = false;   // long answers print in full, inline: the console scrolls instead of opening a reader page
    if (lengthy) {
      const read = element("button", "vd-quick read-response", `[ READ ALL ${lines.length} LINES ]`);
      read.type = "button";
      read.addEventListener("click", () => openReader(lines, command));
      entry.append(read);
    }
    for (const line of lengthy ? lines.slice(0,3) : lines) entry.append(element("div", "", line || " "));
    if (suggestions.length) {
      const actions = element("div", "console-suggestions");
      actions.setAttribute("role", "group");
      actions.setAttribute("aria-label", "Suggested requests");
      for (const command of suggestions.slice(0, 5)) {
        const button = element("button", "vd-quick", `[ ${window.VDConsoleLanguage.label(command)} ]`);
        button.type = "button";
        button.title = command;
        if (["yes please","no thanks","vector drift","something here"].includes(command.toLowerCase())) button.dataset.contextual = "true";
        button.addEventListener("click", () => executeConsole(command));
        actions.append(button);
      }
      entry.append(actions);
    }
    consoleLines.append(entry);
    while (consoleLines.childElementCount > 80) consoleLines.firstElementChild.remove();
    transcriptAnchor = "bottom";
    setConsoleOpen(true);
    sizeHistory(false, true);
    consoleResponse.textContent = lengthy ? lines.slice(0,2).join("\n")+" Full response available with Read all." : lines.join("\n");
  }

  const V = ["██╗   ██╗███████╗ ██████╗████████╗ ██████╗ ██████╗ ", "██║   ██║██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗", "██║   ██║█████╗  ██║        ██║   ██║   ██║██████╔╝", "╚██╗ ██╔╝██╔══╝  ██║        ██║   ██║   ██║██╔══██╗", " ╚████╔╝ ███████╗╚██████╗   ██║   ╚██████╔╝██║  ██║", "  ╚═══╝  ╚══════╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝"];
  const D = ["██████╗ ██████╗ ██╗███████╗████████╗", "██╔══██╗██╔══██╗██║██╔════╝╚══██╔══╝", "██║  ██║██████╔╝██║█████╗     ██║   ", "██║  ██║██╔══██╗██║██╔══╝     ██║   ", "██████╔╝██║  ██║██║██║        ██║   ", "╚═════╝ ╚═╝  ╚═╝╚═╝╚═╝        ╚═╝   "];
  const logo = document.querySelector(".small-logo");
  V.forEach((v, i) => {
    logo.append(document.createTextNode(v.padEnd(49, " ") + "  "));
    const d = document.createElement("span"); d.className = "drift"; d.textContent = D[i]; logo.append(d);
    if (i < V.length - 1) logo.append(document.createTextNode("\n"));
  });
  document.querySelectorAll("[data-layout-link]").forEach(a => {
    if (a.dataset.layoutLink === layout) a.setAttribute("aria-current", "page");
  });

  function art(seed) {
    let state = seed * 7919 + 73;
    const rand = () => ((state = (state * 9301 + 49297) % 233280) / 233280);
    let svg = '<svg viewBox="0 0 800 450" aria-hidden="true" fill="none" stroke="var(--phos)" stroke-width="1.3">';
    for (let i = 0; i < 70; i++) {
      svg += `<circle cx="${rand()*800}" cy="${rand()*400}" r="${.6+rand()*1.4}" fill="var(--logo-drift)" opacity="${.3+rand()*.6}" stroke="none"/>`;
    }
    for (let i = -8; i <= 8; i++) svg += `<path d="M400 260 L${400+i*150} 450" opacity=".16"/>`;
    for (let i = 0; i < 7; i++) svg += `<path d="M0 ${265+i*i*5} H800" opacity=".16"/>`;
    for (let i = 0; i < 12; i++) {
      const x=70+rand()*660,y=65+rand()*240,r=12+rand()*23;
      svg += `<path d="M${x-r} ${y} L${x} ${y-r} L${x+r} ${y} L${x} ${y+r} Z M${x-r} ${y} L${x+r} ${y} M${x} ${y-r} L${x} ${y+r}" opacity="${.35+rand()*.5}"/>`;
    }
    svg += '<path d="M400 250 L427 333 L400 312 L373 333 Z M400 250 L400 312 M386 329 L400 353 L414 329" stroke="var(--hot)" stroke-width="2"/>';
    svg += '<path d="M397 210 L400 184 L403 210 M398 165 L400 148 L402 165" stroke="var(--hot)"/>';
    return svg + '</svg>';
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function heading(title, meta) {
    const h = element("div", "section-heading");
    h.append(element("h1", "", title));
    if (meta) h.append(element("span", "media-note", meta));
    return h;
  }
  function statusLine(text) {
    let status = content.querySelector(".feedback");
    if (!status) { status = element("p", "feedback"); status.setAttribute("role", "status"); content.append(status); }
    status.textContent = text;
  }
  // Stand-in screenshots supplied by Jon on 2026-11-06 (web copies under media/).
  const FRAMES = [null,"MAIN MENU","SPECTRAL MESH VISUALIZER","AUDIO OPTIONS","GAMEPLAY","GAMEPLAY","GAMEPLAY / LEVEL 5"];
  function fileName(n) { return `frame_0${n}.jpg`; }
  function renderViewer(viewer, caption) {
    viewer.replaceChildren();
    const img = element("img", "frame-image");
    img.src = `media/frame_0${selectedFile}.jpg`;
    img.alt = `Vector Drift framegrab: ${FRAMES[selectedFile].toLowerCase()}`;
    img.decoding = "async";
    viewer.append(img, element("span", "view-label", `FRAME / 0${selectedFile}`));
    caption.textContent = fileName(selectedFile) + "  /  " + FRAMES[selectedFile];
    document.querySelectorAll("[data-file]").forEach(button => {
      const chosen = +button.dataset.file === selectedFile;
      button.classList.toggle("current", chosen);
      button.setAttribute("aria-pressed", String(chosen));
    });
  }
  function chooseFile(n) {
    selectedFile = n;
    if (current !== "media") { showSection("media"); return; }
    const viewer = content.querySelector(".viewer");
    const caption = content.querySelector(".file-caption");
    if (viewer && caption) renderViewer(viewer, caption);
    history.replaceState({ section: "media", reader: null, frame: selectedFile }, "", location.href);
  }
  function media() {
    const mediaHead = heading("MEDIA ARCHIVE", "06 FRAMES");
    content.append(mediaHead);
    const grid = element("div", "media-layout");
    const wrap = element("div", "viewer-wrap");
    const viewer = element("div", "viewer");
    const cap = element("div", "viewer-caption");
    const caption = element("span", "file-caption");
    cap.append(caption);
    const step = element("span", "frame-step");
    for (const [label, delta] of [["[ PREV ]", -1], ["[ NEXT ]", 1]]) {
      const b = element("button", "vd-quick", label); b.type = "button";
      b.addEventListener("click", () => chooseFile((selectedFile - 1 + delta + 6) % 6 + 1)); step.append(b);
    }
    cap.append(step);
    wrap.append(viewer, cap);
    grid.append(wrap);
    const strip = element("div", "thumbnail-strip");
    strip.setAttribute("aria-label", "Framegrabs");
    for (let n=1;n<=6;n++) {
      const button = element("button", "thumb vd-thumb");
      button.type = "button"; button.dataset.file = String(n); button.setAttribute("aria-label", `View frame ${n}`);
      const thumb = element("img"); thumb.src = `media/thumb_0${n}.jpg`; thumb.alt = ""; thumb.loading = "lazy"; thumb.decoding = "async";
      button.append(thumb, element("span", "", `FRAME 0${n}`));
      button.addEventListener("click", () => chooseFile(n));
      strip.append(button);
    }
    grid.append(strip);
    content.append(grid);
    onward([["GET EMAIL UPDATES","email"],["HOME","root"]]);
    renderViewer(viewer,caption);
  }
  const tree = document.querySelector(".tree-files");
  for (let n=1;n<=6;n++) {
    const button = element("button", "file-link vd-quick", fileName(n));
    button.type = "button"; button.dataset.file = String(n);
    button.addEventListener("click", () => chooseFile(n)); tree.append(button);
  }
  function extLink(label, value, url, tag) {
    const a = element("a", "vd-quick ext-link"); a.href = url;
    if (!url.startsWith("mailto:")) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
    a.append(element("span", "", label), element("span", "ext-value", value), element("span", "", tag));
    return a;
  }
  function onward(targets) {
    const row = element("div", "home-actions onward");
    for (const [label, target] of targets) {
      const b = element("button", "vd-quick", `[ ${label} ]`); b.type = "button";
      b.addEventListener("click", () => showSection(target)); row.append(b);
    }
    content.append(row);
  }
  if (DISCORD_URL) document.querySelectorAll('a[data-section="discord"]').forEach(a => { a.removeAttribute("data-section"); a.href = DISCORD_URL; a.target = "_blank"; a.rel = "noopener noreferrer"; });
  function copy(title, paragraphs) {
    content.append(heading(title));
    const page = element("div", "copy-page");
    paragraphs.forEach((p,i)=>page.append(element("p", i === 0 ? "lede" : "", p)));
    content.append(page); return page;
  }
  function build(section) {
    if (section === "root") {
      content.append(buildHome());
      return;
    }
    if (section === "reference") {
      const record = currentReader ? readers.get(currentReader) : null;
      content.append(heading(record ? record.title.toUpperCase() : "CONSOLE GUIDE", record ? "FULL CONSOLE RESPONSE" : "ALL COMMANDS"));
      const back=element("button","vd-quick","[ BACK TO SITE ]");back.type="button";
      back.addEventListener("click",()=>showSection(record?.from && record.from !== "reference" ? record.from : lastSiteSection));content.append(back);
      if(routeNotice) statusLine(routeNotice);
      if(record) content.append(element("pre","response-reader",record.lines.join("\n")));
      else {
        content.append(element("p","","Type commands or everyday requests. Try open media / show me the game. Tab completes names, Up/Down recalls input, Escape folds the console. Stop ends a running console game; fold only hides the console."));
        for(const category of Engine.CATEGORIES) {
          content.append(element("h2","",category.toUpperCase()));
          const list=element("dl","command-reference");
          for(const command of Engine.COMMANDS.filter(c=>c.category===category)) {
            list.append(element("dt","",command.usage),element("dd","",command.description));
          }
          content.append(list);
        }
      }
      return;
    }
    if (section === "media") { media(); return; }
    if (section === "about") {
      const page = copy("VECTOR DRIFT", ["A retro vector space shooter.", "Precision. Momentum. Escalating enemy formations.", "Vector Drift is being built for macOS, Windows and Linux. The alpha demo is not available yet."]);
      [["PLATFORMS", "macOS / WINDOWS / LINUX"], ["DOWNLOAD", "NOT YET AVAILABLE"]].forEach(([a,b])=>{
        const row = element("div", "fact-row"); row.append(element("span","",a),element("span","",b)); page.append(row);
      });
      onward([["SEE THE GAME","media"],["GET EMAIL UPDATES","email"],["HOME","root"]]);
    } else if (section === "soundtrack") {
      const head = element("div", "section-heading inline-tag");
      head.append(element("h1", "", "OST.EXE"));
      content.append(head, element("p", "ost-sub", "ORIGINAL SCORE BY GAME CREATOR JON SIMO"));
      const host = element("div", "ost-host");
      content.append(host);
      ostPlayer = window.VDOst.mount(host, { base: "ost/" });
    } else if (section === "devlog") {
      copy("TRANSMISSION LOG", ["Development updates.", "Nothing has been posted yet. Sign up for email updates and the first post will reach you when it is out."]);
      onward([["GET EMAIL UPDATES","email"],["SEE THE GAME","media"],["HOME","root"]]);
    } else if (section === "download") {
      copy("DOWNLOAD", ["ALPHA DEMO IS NOT YET AVAILABLE.", "Email updates will tell you the moment it is."]);
      onward([["GET EMAIL UPDATES","email"],["SEE THE GAME","media"],["HOME","root"]]);
    } else if (section === "discord") {
      if (DISCORD_URL) {
        copy("DISCORD", ["Join the Vector Drift community.", "Chat with Jon and other players, follow development, and be first to hear about the demo."]);
        const links = element("div", "link-list"); links.append(extLink("DISCORD", "JOIN THE SERVER", DISCORD_URL, "[ VISIT ]")); content.append(links);
      } else copy("DISCORD", ["The community Discord is not open yet.", "Email updates will announce it when it is. Until then, you can reach Jon directly."]);
      onward([["GET EMAIL UPDATES","email"],["CONTACT","contact"],["HOME","root"]]);
    } else if (section === "links") {
      copy("LINKS", ["Connect with Vector Drift and its developer."]);
      const links = element("div", "link-list");
      [["EMAIL UPDATES","email"],["SCREENSHOTS","media"],["CONTACT","contact"]].forEach(([label,target])=>{
        const b=element("button","vd-quick"); b.type="button"; b.append(element("span","",label),element("span","","[ OPEN ]")); b.addEventListener("click",()=>showSection(target)); links.append(b);
      });
      links.append(extLink("DISCORD", "JOIN THE SERVER", DISCORD_URL, "[ VISIT ]"), extLink("JON SIMO", "jonsimo.com", CONTACT.site, "[ VISIT ]"), extLink("INSTAGRAM", "@jonsimo", CONTACT.instagram, "[ VISIT ]"));
      content.append(links);
      onward([["GET EMAIL UPDATES","email"],["HOME","root"]]);
    } else if (section === "contact") {
      copy("CONTACT", ["Questions, press, or just saying hello.", "Vector Drift is made by Jon Simo."]);
      const links = element("div", "link-list");
      links.append(extLink("DISCORD", "JOIN THE SERVER", DISCORD_URL, "[ VISIT ]"), extLink("EMAIL", CONTACT.email, "mailto:" + CONTACT.email, "[ SEND ]"), extLink("WEBSITE", "jonsimo.com", CONTACT.site, "[ VISIT ]"), extLink("INSTAGRAM", "@jonsimo", CONTACT.instagram, "[ VISIT ]"));
      content.append(links);
      const copyBtn = element("button", "vd-quick copy-address", "[ COPY EMAIL ADDRESS ]"); copyBtn.type = "button";
      copyBtn.addEventListener("click", async () => {
        let ok = false;
        try { await navigator.clipboard.writeText(CONTACT.email); ok = true; } catch (e) {}
        statusLine(ok ? "COPIED " + CONTACT.email : "COULD NOT COPY. THE ADDRESS IS " + CONTACT.email);
      });
      content.append(copyBtn);
      statusLine("");
      onward([["GET EMAIL UPDATES","email"],["SEE THE GAME","media"],["HOME","root"]]);
    } else if (section === "email") {
      const emailPage = copy("EMAIL UPDATES", ["Get Vector Drift news.", "Alpha demo and release announcements by email."]);
      // "Unsubscribe any time." always sits on its own second line, at any width
      const sub = emailPage.children[1]; sub.append(document.createElement("br"), "Unsubscribe any time.");
      const form = element("form", "email-form"); form.noValidate = true;
      const label = element("label", "sr-only", "Email address"); label.htmlFor = "email-address";
      const field = element("input"); field.id = "email-address"; field.type = "email"; field.required = true; field.autocomplete = "email"; field.inputMode = "email"; field.autocapitalize = "none"; field.spellcheck = false; field.placeholder = "you@example.com";
      if (pendingPrefill) { field.value = pendingPrefill; pendingPrefill = ""; }
      const button = element("button", "vd-quick", "[ SIGN UP ]"); button.type = "submit";
      form.append(label, field, button); content.append(form);
      statusLine("");
      const myGeneration = generation; let sending = false;
      form.addEventListener("submit", async e => {
        e.preventDefault();
        if (sending) return;
        const address = field.value.trim();
        if (!window.VDUplink || !window.VDUplink.valid(address)) { statusLine("THAT DOES NOT LOOK LIKE AN EMAIL ADDRESS. CHECK IT AND TRY AGAIN."); field.focus(); return; }
        sending = true; button.disabled = true; button.textContent = "[ SENDING... ]"; statusLine("TRANSMITTING ...");
        const ok = await window.VDUplink.subscribe(address);
        if (myGeneration !== generation) return;
        sending = false;
        if (ok) {
          form.hidden = true;
          statusLine("HANDSHAKE ACCEPTED. Node user added to the alpha manifest. Await a future transmission for the demo. If a confirmation email arrives, open it to finish signing up.");
        } else {
          button.disabled = false; button.textContent = "[ SIGN UP ]";
          statusLine("UPLINK ERROR. SIGNAL LOST — NOTHING WAS SAVED. Try again, or email " + CONTACT.email + " and ask to be added.");
        }
      });
      onward([["SEE THE GAME","media"],["CONTACT","contact"],["HOME","root"]]);
    }
  }
  let homeTimer = 0;
  function stopHome() { if (homeTimer) { clearInterval(homeTimer); homeTimer = 0; } }
  // Home: a slideshow of real gameplay beside the pitch, then four doors into the site.
  function buildHome() {
    const page = element("div", "home");
    const beta = element("div", "home-beta", "EARLY ACCESS BETA ON DISCORD // DEC 2026");
    const text = element("div", "home-text");
    text.append(element("h1", "home-title", "A RETRO VECTOR SPACE SHOOTER"), element("p", "home-lede", "Precision. Momentum. Escalating enemy formations."));
    text.append(element("p", "home-sub", "Built for macOS, Windows and Linux. The alpha demo is not out yet."));
    const actions = element("div", "home-actions");
    const join = element("a", "vd-quick home-primary", "[ JOIN THE DISCORD ]"); join.href = DISCORD_URL; join.target = "_blank"; join.rel = "noopener noreferrer";
    const mail = element("button", "vd-quick", "[ GET EMAIL UPDATES ]"); mail.type = "button"; mail.addEventListener("click", () => showSection("email"));
    actions.append(join, mail);
    text.append(actions);
    // slideshow: gameplay first, then the menus
    const order = [4, 5, 6, 1, 2, 3];
    const shot = element("button", "home-shot"); shot.type = "button"; shot.setAttribute("aria-label", "Open the media archive");
    const imgA = element("img", "shot-img on"), imgB = element("img", "shot-img");
    for (const i of [imgA, imgB]) { i.alt = ""; i.decoding = "async"; }
    const label = element("span", "shot-label");
    shot.append(imgA, imgB, label);
    let at = 0, front = imgA, back = imgB;
    const set = (img, n) => { img.src = `media/frame_0${n}.jpg`; };
    set(imgA, order[0]); label.textContent = `FRAME / 0${order[0]}  ${FRAMES[order[0]]}`;
    const advance = () => {
      at = (at + 1) % order.length; const n = order[at];
      set(back, n);
      back.onload = () => { back.classList.add("on"); front.classList.remove("on"); [front, back] = [back, front]; label.textContent = `FRAME / 0${n}  ${FRAMES[n]}`; back.onload = null; };
    };
    shot.addEventListener("click", () => { selectedFile = order[at]; showSection("media"); });
    if (!reduceMotion.matches) homeTimer = setInterval(advance, 4200);
    const doors = element("div", "home-doors");
    for (const [num, name, hint, target] of [["01", "THE GAME", "what it is", "about"], ["02", "STILLS + VIDEO", "framegrabs", "media"], ["03", "SOUNDTRACK", "23 tracks, 45s previews", "soundtrack"], ["04", "DEVLOG", "development updates", "devlog"]]) {
      const door = element("button", "vd-quick home-door"); door.type = "button";
      door.append(element("span", "door-n", num), element("span", "door-name", name), element("span", "door-hint", hint));
      door.addEventListener("click", () => showSection(target));
      doors.append(door);
    }
    page.append(beta, text, shot, doors);
    return page;
  }
  let ostPlayer = null;
  function stopOst() { if (ostPlayer) { try { ostPlayer.destroy(); } catch (e) {} ostPlayer = null; } }
  function syncNavigation() {
    document.querySelectorAll("[data-section]").forEach(a=>{
      const active=a.dataset.section===current;
      a.classList.toggle("current",active);
      if (active) a.setAttribute("aria-current","page"); else a.removeAttribute("aria-current");
      const mark=a.querySelector(".mark"); if(mark)mark.textContent=active?">":" ";
    });
    document.getElementById("section-path").textContent="/root/"+(PROGRAMS.includes(current)?current+".exe":paths[current]);
    document.getElementById("prompt-path").textContent="root:/"+(current === "root" || PROGRAMS.includes(current) ? "" : paths[current].replace(/\/$/,""));
    document.getElementById("section-count").textContent=current === "media"?"06 FILES":current === "soundtrack"?"23 TRACKS":"";
    document.getElementById("terminal-output").classList.toggle("is-soundtrack",current === "soundtrack");
    tree.hidden=current !== "media";
    if (window.VDAmbient) window.VDAmbient.setDuck(current === "soundtrack");
  }
  function closeDirectory() {
    document.body.classList.remove("nav-open");
    document.querySelector(".mobile-toggle").setAttribute("aria-expanded","false");
  }
  async function showSection(section, initial=false, source="ui", routeMode="push", view={}) {
    if (!sections.includes(section)) return;
    if (source !== "console") { commandEpoch++;expireChoices(true); }
    if (section !== "reference") lastSiteSection = section;
    endProgram();
    stopOst();
    stopHome();
    const id=++generation;
    current=section;
    currentReader=section==="reference"?(view.reader||null):null;
    routeNotice=view.notice||"";
    writeRoute(initial?"replace":routeMode);
    content.classList.add("changing");
    if (!initial && !reduceMotion.matches) await new Promise(resolve=>setTimeout(resolve,60));
    if (id !== generation) return;
    content.replaceChildren();
    syncNavigation();
    build(section);
    if(matchMedia("(max-height:560px)").matches)window.scrollTo({top:0,left:0,behavior:"instant"});
    content.classList.remove("changing");
    document.getElementById("terminal-output").scrollTop = 0;
    document.querySelector(".site-body").scrollTop = 0;
    closeDirectory();
    updateReviewLinks();
  }
  document.querySelectorAll("[data-section]").forEach(a=>a.addEventListener("click",e=>{
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||e.button!==0)return;
    e.preventDefault();
    showSection(a.dataset.section);
  }));
  document.querySelector(".mobile-toggle").addEventListener("click",e=>{
    const open=document.body.classList.toggle("nav-open");e.currentTarget.setAttribute("aria-expanded",String(open));
  });
  // Snake and pi run inside the console window itself: the prompt steps aside, the
  // program draws in the transcript, and the prompt comes back when it ends.
  let programEntry = null;
  const PROGRAM_KEYS = {
    snake: [["UP","ArrowUp"],["LEFT","ArrowLeft"],["DOWN","ArrowDown"],["RIGHT","ArrowRight"],["PAUSE","p"],["RESTART","Enter"],["QUIT","Escape"]],
    pi: [["STOP","Escape"]]
  };
  const pressKey = key => document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  function endProgram() { if (programName) pressKey("Escape"); }
  function fitProgram() {
    // snake is 48 columns by ~22 lines of text: size the type so the whole board fits the window
    const w = Math.max(160, consoleLines.clientWidth - 8), h = innerHeight * .8 - 70;
    consoleDock.style.setProperty("--program-font", Math.max(6, Math.min(18, w / (50 * .6), h / (23 * 1.1))) + "px");
  }
  async function runProgram(name) {
    if (programName) return;
    const runner = name === "snake" ? window.VDSnake : window.VDPi;
    if (!runner) { report(name.toUpperCase() + ".EXE NOT AVAILABLE."); return; }
    const entry = element("div", "console-entry console-program");
    const out = element("div", "program-out");
    const keys = element("div", "program-keys");
    for (const [label, key] of PROGRAM_KEYS[name]) {
      const b = element("button", "vd-quick", `[ ${label} ]`); b.type = "button";
      b.addEventListener("click", () => pressKey(key));
      keys.append(b);
    }
    entry.append(out, keys);
    consoleLines.append(entry);
    programEntry = entry; programName = name;
    consoleDock.dataset.program = name;
    if (document.activeElement === input) input.blur();
    fitProgram();
    setConsoleOpen(true, true);
    sizeHistory(true, true);
    let result = {};
    try { result = await runner.launch({ output: out, base: "ost/" }) || {}; } catch (e) {}
    programEntry = null; programName = null;
    delete consoleDock.dataset.program;
    entry.remove();
    const stat = name === "snake" ? result.score : result.digits;
    report(name + ".exe // session ended" + (Number.isFinite(stat) ? ` // ${name === "snake" ? "score" : "digits"} ${stat}` : ""));
    focusConsole();
    sizeHistory(true, true);
  }
  window.addEventListener("resize", () => { if (programName) fitProgram(); });
  function launchProgram(name) {
    if (name === "ost") { showSection("soundtrack", false, "console"); return; }
    runProgram(name);
  }
  const topicSession = window.VDIntents ? window.VDIntents.createSession() : null;
  function topicAnswer(raw) {
    if (!topicSession) return null;
    const normalized = window.VDIntents.normalizeTerminalInput(raw).normalized;
    if (!normalized) return null;
    const { steps } = window.VDIntents.selectUnknown(topicSession, Math.random, normalized, raw);
    const lines = [], effects = [];
    for (const st of steps) {
      if (st.type === "print" || st.type === "typed") lines.push(st.text || "");
      else if (st.type === "link" || st.type === "open") lines.push(st.text || "");
      else if (st.type === "goto") effects.push({ type: "navigate", section: st.section });
      else if (st.type === "run") {
        if (st.command === "email.exe") effects.push({ type: "navigate", section: "email" });
        else if (st.command === "snake" || st.command === "pi") effects.push({ type: "program", name: st.command });
      }
    }
    return lines.length ? { lines, effects } : null;
  }
  // Text pages open inline, the way a command line opens a file: "load about.txt", then its text.
  // Media, soundtrack and the forms are not text, so those still take you to the page.
  const FILE_TEXT = {
    about: ["about.txt", ["VECTOR DRIFT", "A retro vector space shooter.", "Precision. Momentum. Escalating enemy formations.", "Built for macOS, Windows and Linux. The alpha demo is not available yet.", "", "platforms ........ macOS / windows / linux", "download ......... not yet available"]],
    devlog: ["devlog/", ["TRANSMISSION LOG", "Development updates.", "Nothing has been posted yet. Sign up for email updates and the first post will reach you when it is out."]],
    download: ["download.exe", ["DOWNLOAD", "ALPHA DEMO IS NOT YET AVAILABLE.", "Email updates will tell you the moment it is."]],
    links: ["links.lnk", ["LINKS", "", "discord ......... " + DISCORD_URL.replace("https://", ""), "website ......... jonsimo.com", "instagram ....... @jonsimo", "email updates ... type: email"]],
    contact: ["contact", ["CONTACT", "Questions, press, or just saying hello.", "Vector Drift is made by Jon Simo.", "", "mail ............ " + CONTACT.email, "website ......... jonsimo.com", "instagram ....... @jonsimo", "discord ......... " + DISCORD_URL.replace("https://", "")]],
  };
  function openInline(response) {
    const nav = response.effects.find(e => e.type === "navigate" && FILE_TEXT[e.section]);
    if (!nav) return response;
    const [name, text] = FILE_TEXT[nav.section];
    return { ...response, lines: ["load " + name, ...text], suggestions: [], effects: response.effects.filter(e => e !== nav) };
  }
  async function executeConsole(raw) {
    expireChoices();
    const epoch = ++commandEpoch;
    input.value = "";
    focusConsole();
    const now = new Date();
    const logged = window.VDCmdLog ? window.VDCmdLog.command(raw) : null;
    if (logged) { report(logged, String(raw).trim()); markUsed(); updateCaret(); return; }
    let response = Engine.execute(raw, consoleSession, { section: current === "soundtrack" ? "ost" : current, frame: selectedFile, now: now.getTime(), date: now.toLocaleDateString(), time: now.toLocaleTimeString() });
    // anything the site's own commands do not know is answered by the shared topics layer
    if (/^REQUEST NOT RECOGNIZED/.test(response.lines[0] || "")) {
      const extra = topicAnswer(raw);
      if (extra) response = { lines: extra.lines, echo: response.echo, suggestions: [], effects: extra.effects };
    }
    response = openInline(response);
    historyIndex = consoleSession.history.length;
    draft = "";
    if (window.VDCmdLog) window.VDCmdLog.add(raw, /^REQUEST NOT RECOGNIZED/.test(response.lines[0] || "") ? "none" : "ok", "site");
    if (response.lines.length || response.echo || response.suggestions.length) report(response.lines.length ? response.lines : ["CHANNEL READY."], response.echo, response.suggestions);
    markUsed();
    updateCaret();
    for (const effect of response.effects) {
      if (epoch !== commandEpoch) return;
      if (effect.type === "navigate") {
        if (effect.section === "email") { const typed = (String(raw).match(/[^\s@]+@[^\s@]+\.[^\s@]+/) || [""])[0]; if (window.VDUplink && window.VDUplink.valid(typed)) pendingPrefill = typed; }
        await showSection(effect.section, false, "console");
        if (epoch !== commandEpoch || current !== effect.section) return;
      } else if (effect.type === "frame") chooseFile(effect.number);
      else if (effect.type === "green") { greenStep = effect.step; applyPalette(); }
      else if (effect.type === "glow") { bloom = effect.mode === "tight"; applyPalette(); }
      else if (effect.type === "motion") document.body.classList.toggle("console-reduced-motion", effect.mode === "reduce");
      else if (effect.type === "clear") { consoleLines.replaceChildren(); consoleResponse.textContent = ""; sizeHistory(); }
      else if (effect.type === "collapse") closeConsole();
      else if (effect.type === "program") launchProgram(effect.name);
    }
  }
  document.querySelector(".command-form").addEventListener("submit", e => {
    e.preventDefault();
    executeConsole(input.value);
  });
  input.addEventListener("keydown",e=>{
    if (e.key === "Tab" && !e.shiftKey) {
      const matches = Engine.complete(input.value);
      if (matches.length) {
        e.preventDefault();
        if (matches.length === 1) { input.value = matches[0]+" "; updateCaret(); }
        else report("COMPLETIONS: "+matches.join(" / "), null, matches.slice(0,5));
      }
      return;
    }
    if (e.ctrlKey && e.key.toLowerCase() === "c" && input.selectionStart === input.selectionEnd) {
      e.preventDefault(); input.value = ""; draft = ""; updateCaret(); report("INPUT CANCELLED. Session retained."); return;
    }
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && (input.value === "" || SUGGEST.includes(input.value))) {
      e.preventDefault();
      const down = e.key === "ArrowDown";
      suggestIndex = input.value === "" ? (down ? 0 : SUGGEST.length - 1) : (SUGGEST.indexOf(input.value) + (down ? 1 : -1) + SUGGEST.length) % SUGGEST.length;
      input.value = SUGGEST[suggestIndex];
      input.setSelectionRange(input.value.length, input.value.length);
      updateCaret();
      return;
    }
    const commandHistory = consoleSession.history;
    if (!commandHistory.length || !["ArrowUp","ArrowDown"].includes(e.key)) return;
    if(historyIndex === commandHistory.length)draft=input.value;
    historyIndex=Math.max(0,Math.min(commandHistory.length,historyIndex+(e.key === "ArrowUp"?-1:1)));
    input.value=historyIndex === commandHistory.length?draft:commandHistory[historyIndex];
    e.preventDefault();
  });
  window.addEventListener("keydown",e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;
    const editable=e.target.closest("input,textarea");
    if(e.key === "/" && !editable) {e.preventDefault();closeDirectory();focusConsole();return;}
    if(e.key === "Escape") {
      if (consoleState !== "collapsed" && consoleDock.contains(e.target)) { e.preventDefault();closeConsole(); }
      else if(document.body.classList.contains("nav-open")){closeDirectory();document.querySelector(".mobile-toggle").focus();}
      else if(!editable&&current!=="root")showSection("root");
      return;
    }
    if(editable)return;
    const entries=Array.from(document.querySelectorAll(".vd-dir > [data-section]"));
    if(e.key === "ArrowDown" || e.key === "ArrowUp") {
      const focused=entries.indexOf(document.activeElement);if(focused>=0)directoryIndex=focused;
      directoryIndex=(directoryIndex+(e.key === "ArrowDown"?1:-1)+entries.length)%entries.length;
      entries[directoryIndex].focus();e.preventDefault();
    }
  });
  // Back/Forward restores a snapshot (section, response id, media frame). It
  // never re-runs a command, so counters and game state are untouched.
  function restoreRoute(event) {
    const state = event?.state?.section ? event.state : null;
    const route = state ? { section: state.section, reader: state.reader || null } : parseHash();
    if (routeKey(route) === currentKey()) return;
    const resolved = Routes.resolveRoute(route, readers);
    if (route.section === "media" && Number.isInteger(state?.frame)) selectedFile = state.frame;
    showSection(resolved.route.section,false,"history",resolved.notice?"replace":"none",{ reader: resolved.route.reader, notice: resolved.notice });
  }
  window.addEventListener("popstate",restoreRoute);
  window.addEventListener("hashchange",()=>restoreRoute());
  showSection(current,true,"ui","push",initialRoute.reader?{notice:Routes.MISSING}:{});
  window.addEventListener("load",()=>window.dispatchEvent(new Event("vd:console-ready")),{once:true});
})();
