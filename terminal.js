const output = document.getElementById("terminal-output");
const status = document.getElementById("terminal-status");
const terminalHeader = document.querySelector(".terminal-header");
const form = document.getElementById("terminal-form");
const input = document.getElementById("terminal-input");
const cursor = document.querySelector(".block-cursor");
const promptPrefix = document.querySelector(".prompt-prefix");
const commandText = document.getElementById("terminal-command");

let bootStarted = false;
let terminalState = "booting";
let activeTransfer = null;
let fallbackDownload = null;
let commandHistory = [];
let historyCursor = 0;
let axiomUseCount = 0;
let sudoUseCount = 0;
let unknownCount = 0;
let specialUnknownStep = 0;

const locateCommand = "find /opt -iname 'vector_drift' $>/dev/null";
const loadCommand = "load /opt/unknown/vectordrift.sim";
const finalPrompt = "console>vector_drift:/root";
const initialCursorCycleMs = 815;
const releasesApiUrl = "https://api.github.com/repos/jonsimo/codex-jr-downloads/releases/latest";
const releasesPageUrl = "https://github.com/jonsimo/codex-jr-downloads/releases";
// CORS proxy for the release asset. GitHub's asset host sends no
// Access-Control-Allow-Origin, so the browser cannot stream the bytes directly;
// the Worker in worker/dl-proxy.js re-streams them with CORS. Set this to the
// deployed Worker URL (workers.dev or dl.vectordrift.io). If empty or
// unreachable, the fetch falls back to the native browser handoff below.
const packageProxyUrl = "https://vd-dl-proxy.codexjr.workers.dev/";
const barWidth = 28;

const loaderStatuses = [
  "io>loader/ acquiring execution context",
  "io>loader/ resolving vector programmetry . . .",
  "io>loader/ loading vector programmetry . . .",
  "io>loader/ resolving missing interface",
  "io>loader/ vector programmetry loaded",
];

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function setPhosphorText(element, text) {
  element.replaceChildren();

  const lines = text.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    for (let index = 0; index < line.length; index += 4) {
      const block = document.createElement("span");
      const seed = line.charCodeAt(index) + index + lineIndex;
      block.className = `phosphor-block phosphor-block-${seed % 5}`;
      block.textContent = line.slice(index, index + 4);
      element.appendChild(block);
    }

    if (lineIndex < lines.length - 1) {
      element.appendChild(document.createElement("br"));
    }
  }
}

function renderStatusLines(lines, cursorLine = -1) {
  status.replaceChildren();

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];

    for (let index = 0; index < line.length; index += 4) {
      const block = document.createElement("span");
      const seed = line.charCodeAt(index) + index + lineIndex;
      block.className = `phosphor-block phosphor-block-${seed % 5}`;
      block.textContent = line.slice(index, index + 4);
      status.appendChild(block);
    }

    if (lineIndex === cursorLine) {
      const bootCursor = document.createElement("span");
      bootCursor.className = "inline-cursor";
      status.appendChild(bootCursor);
    }

    if (lineIndex < lines.length - 1) {
      status.appendChild(document.createElement("br"));
    }
  }
}

function scrambleText(text) {
  const glyphs = "!@#$%^&*+=?/\\|~<>[]{}:;";

  return [...text].map((character, index) => {
    if (character === " ") {
      return " ";
    }

    return glyphs[(character.charCodeAt(0) + index * 7) % glyphs.length];
  }).join("");
}

function appendLine(text, className = "") {
  const line = document.createElement("div");
  line.className = `output-line ${className}`.trim();
  setPhosphorText(line, text);
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
  output.scrollLeft = 0;
  return line;
}

function appendRawLine(className = "") {
  const line = document.createElement("div");
  line.className = `output-line ${className}`.trim();
  output.appendChild(line);
  output.scrollTop = output.scrollHeight;
  output.scrollLeft = 0;
  return line;
}

function appendCommandLine(command) {
  const line = appendRawLine("command prompt-history");
  const consolePart = document.createElement("span");
  consolePart.className = "prompt-console";
  consolePart.textContent = "console>";
  const pathPart = document.createElement("span");
  pathPart.className = "prompt-path";
  pathPart.textContent = "vector_drift:/root";
  const commandPart = document.createElement("span");
  commandPart.textContent = ` ${command}`;
  line.append(consolePart, pathPart, commandPart);
  return line;
}

function appendResponse(text, className = "terminal-response") {
  return appendLine(text, className);
}

function setPromptPrefix() {
  promptPrefix.replaceChildren();
  const consolePart = document.createElement("span");
  consolePart.className = "prompt-console";
  consolePart.textContent = "console>";
  const pathPart = document.createElement("span");
  pathPart.className = "prompt-path";
  pathPart.textContent = "vector_drift:/root";
  promptPrefix.append(consolePart, pathPart);
}

function setTerminalState(nextState) {
  terminalState = nextState;
  const processing = nextState === "executing" || nextState === "downloading";
  form.classList.toggle("processing", processing);
  input.disabled = processing;
}

function updateCommandRender() {
  commandText.textContent = input.value;
}

function updateCursor() {
  updateCommandRender();
}

async function typeCommand(command, characterDelay) {
  input.value = "";
  updateCursor();

  for (const character of command) {
    input.value += character;
    updateCursor();
    await sleep(characterDelay + Math.random() * 18);
  }
}

async function typePromptPrefix(prefix) {
  promptPrefix.textContent = "";

  for (const character of prefix) {
    promptPrefix.textContent += character;
    await sleep(58 + Math.random() * 14);
  }
}

async function typeStatusLine(lines, lineIndex, text, characterDelay) {
  lines[lineIndex] = "";

  for (const character of text) {
    lines[lineIndex] += character;
    setPhosphorText(status, lines.join("\n"));
    await sleep(characterDelay + Math.random() * 16);
  }
}

async function typeStatusLineWithCursor(lines, lineIndex, text, characterDelay) {
  lines[lineIndex] = "";

  for (const character of text) {
    lines[lineIndex] += character;
    renderStatusLines(lines, lineIndex);
    await sleep(characterDelay + Math.random() * 16);
  }
}

async function typeHumanStatusAppend(lines, lineIndex, text, options = {}) {
  const baseDelay = options.baseDelay ?? 64;
  const jitterMin = options.jitterMin ?? -12;
  const jitterMax = options.jitterMax ?? 18;
  const pauses = options.pauses ?? [];

  for (const character of text) {
    lines[lineIndex] += character;
    renderStatusLines(lines, lineIndex);
    const isFastGlyph = /[/'">\\.:]/.test(character);
    const hesitate = character === " " && Math.random() > 0.68 ? randomBetween(22, 54) : 0;
    await sleep(Math.max(18, baseDelay + randomBetween(jitterMin, jitterMax) - (isFastGlyph ? 12 : 0) + hesitate));
    for (const pause of pauses) {
      if (lines[lineIndex].endsWith(pause.after)) {
        await sleep(randomBetween(pause.min, pause.max));
      }
    }
  }
}

async function runLoaderPreamble() {
  status.hidden = false;
  terminalHeader.classList.remove("status-stack");

  for (let dot = 1; dot <= 3; dot += 1) {
    setPhosphorText(status, `${loaderStatuses[0]}${" .".repeat(dot)}`);
    await sleep(145);
  }

  await sleep(250);
}

function updateLoaderStatus(bootIndex, bootTotal) {
  const progress = bootIndex / Math.max(1, bootTotal - 1);
  const statusIndex = progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2;
  setPhosphorText(status, `${loaderStatuses[statusIndex]} . . .`);
}

async function runCortexInterference(cortexLine) {
  const visibleLines = [...output.querySelectorAll(".output-line")];
  const originalLines = visibleLines
    .filter((line) => line !== cortexLine)
    .map((line) => ({
    line,
    text: line.textContent,
  }));
  const chunkSize = Math.max(1, Math.ceil(originalLines.length / 3));
  const sections = [
    originalLines.slice(0, chunkSize),
    originalLines.slice(chunkSize, chunkSize * 2),
    originalLines.slice(chunkSize * 2),
  ];

  const flicker = (entries, corrupted) => {
    for (const entry of entries) {
      setPhosphorText(entry.line, corrupted ? scrambleText(entry.text) : entry.text);
    }
  };

  const events = [
    [0, 0, true],
    [45, 1, true],
    [90, 2, true],
    [125, 0, false],
    [155, 1, false],
    [185, 2, false],
    [220, 0, true],
    [255, 2, true],
    [290, 1, true],
    [330, 0, false],
    [365, 2, false],
    [400, 1, false],
    [455, 0, true],
    [500, 1, true],
    [545, 2, true],
    [650, 0, false],
    [700, 1, false],
    [750, 2, false],
    [810, 1, true],
    [860, 1, false],
    [900, 0, true],
    [930, 2, true],
    [965, 0, false],
    [1000, 2, false],
  ];

  let elapsed = 0;
  for (const [at, sectionIndex, corrupted] of events) {
    await sleep(Math.max(0, at - elapsed));
    flicker(sections[sectionIndex], corrupted);
    elapsed = at;
  }

  for (const section of sections) {
    flicker(section, false);
  }
}

async function runFinalSequence(line) {
  await sleep(900);
}

async function typeBodyLine(text, characterDelay = 28) {
  const line = appendLine("");

  for (const character of text) {
    line.textContent += character;
    setPhosphorText(line, line.textContent);
    await sleep(characterDelay + Math.random() * 12);
  }

  return line;
}

async function printCommand(text, hold = 36) {
  const line = await typeBodyLine(text, 8);
  await sleep(hold);
  return line;
}

async function printBurst(lines, delay = 70) {
  const printed = [];

  for (const line of lines) {
    printed.push(appendLine(line));
    await sleep(delay);
  }

  return printed;
}

async function printLines(lines, delay = 70) {
  return printBurst(lines, delay);
}

function rewriteLine(line, text) {
  setPhosphorText(line, text);
  output.scrollLeft = 0;
}

function rewriteStatus(text) {
  setPhosphorText(status, text);
}

function corruptText(text, amount = 0.35, shift = 0) {
  const glyphs = "!@#$%^&*+=/\\<>[]{}:;?|";

  return [...text].map((character, index) => {
    if (character === " ") {
      return shift > 0 && index % 17 === 0 ? " ".repeat(1 + (shift % 3)) : character;
    }

    if (Math.random() > amount) {
      return character;
    }

    return glyphs[(character.charCodeAt(0) + index * 11 + shift) % glyphs.length];
  }).join("").slice(0, text.length + 2);
}

async function runScrambleFrame(entries, amount, duration, shift = 0) {
  for (const entry of entries) {
    rewriteLine(entry.line, corruptText(entry.text, amount, shift));
  }
  await sleep(duration);
}

async function runAxiomReveal(observerLine, cortexLine, resolvingLine) {
  // Snapshot every visible line, then split the block into 3 contiguous chunks.
  const visible = [...output.querySelectorAll(".output-line")].slice(-16);
  const snapshot = visible.map((line) => ({ line, text: line.textContent }));
  const size = Math.ceil(snapshot.length / 3);
  const chunks = [
    snapshot.slice(0, size),
    snapshot.slice(size, size * 2),
    snapshot.slice(size * 2),
  ].filter((chunk) => chunk.length);

  const glitchChunk = (chunk, amount, shift) => {
    for (const entry of chunk) {
      rewriteLine(entry.line, corruptText(entry.text, amount, shift));
    }
  };
  const clearChunk = (chunk) => {
    for (const entry of chunk) {
      rewriteLine(entry.line, entry.text);
    }
  };

  // Phase 1 - the 3 chunks flicker glitch, staggered so all three churn.
  const flicker = [
    [0, 0.45], [1, 0.5], [2, 0.55],
    [0, 0], [1, 0.6], [2, 0],
    [1, 0], [0, 0.55], [2, 0.62],
    [0, 0], [2, 0], [1, 0],
  ];
  for (let i = 0; i < flicker.length; i += 1) {
    const [chunkIndex, amount] = flicker[i];
    const chunk = chunks[chunkIndex];
    if (!chunk) {
      continue;
    }
    if (amount > 0) {
      glitchChunk(chunk, amount, i + 1);
    } else {
      clearChunk(chunk);
    }
    await sleep(randomBetween(55, 85));
  }

  // Phase 2 - hold a static corrupted frame across the whole block.
  chunks.forEach((chunk, index) => glitchChunk(chunk, 0.6, index + 5));
  await sleep(380);

  // Phase 3 - the hidden line resolves to the readable reveal while the rest
  // of the block holds its static corruption.
  rewriteLine(observerLine, "vd_observer         PRESENT     0x0000B7A0    axiom          remote observer attached");
  rewriteLine(cortexLine, "vd_cortex           LINKED      0x0000AF10    axiom          organic interface accepted");
  rewriteLine(resolvingLine, "io>loader/ resolving missing interface ... linked");
  observerLine.classList.add("axiom-reveal");
  cortexLine.classList.add("axiom-reveal");
  await sleep(1050);
  observerLine.classList.remove("axiom-reveal");
  cortexLine.classList.remove("axiom-reveal");

  // Phase 4 - the 3 chunks flicker back out, then settle to the false-normal.
  const flickerOut = [[2, 0.5], [0, 0.5], [1, 0.55], [2, 0], [0, 0], [1, 0]];
  for (let i = 0; i < flickerOut.length; i += 1) {
    const [chunkIndex, amount] = flickerOut[i];
    const chunk = chunks[chunkIndex];
    if (!chunk) {
      continue;
    }
    if (amount > 0) {
      glitchChunk(chunk, amount, i + 9);
    } else {
      clearChunk(chunk);
    }
    await sleep(randomBetween(50, 80));
  }

  // The reveal lines snap to the false-normal (hidden) state.
  rewriteLine(observerLine, "vd_observer         MISSING     --------      none           interface unavailable");
  rewriteLine(cortexLine, "vd_cortex           WAIT        0x0000AF10    unassigned     organic bridge detected");
  rewriteLine(resolvingLine, "io>loader/ resolving missing interface ... unresolved");
  await sleep(90);

  const mismatchLine = appendLine("io>loader/ integrity mismatch detected");
  await sleep(150);
  rewriteLine(mismatchLine, "io>loader/ integrity mismatch ignored");
  await sleep(200);
}

async function runFinalOnlineSummary() {
  // Final fast completion burst.
  await printBurst([
    "[ OK ] runtime checksum ...................... accepted",
    "[ OK ] renderer lattice ..................... synchronized",
    "[ OK ] simulation root ...................... mounted",
    "[ OK ] local input channel .................. available",
    "[ OK ] transfer executable .................. download.exe",
  ], 60);
  await sleep(300);

  // Ceremonial summary: each line lands slower than the last so every system
  // is felt coming online.
  appendLine("SYSTEMS ONLINE");
  await sleep(340);
  appendLine("render lattice ............................ ONLINE");
  await sleep(300);
  appendLine("combat matrix ............................. ONLINE");
  await sleep(330);
  appendLine("motion field .............................. ONLINE");
  await sleep(370);
  appendLine("observer interface ........................ ONLINE");
  await sleep(420);
  appendLine("cortex bridge ............................. ONLINE");
  await sleep(480);
  appendLine("root context .............................. vector_drift");
  await sleep(600);

  appendLine("10.0.1.00> all local systems nominal");
  await sleep(540);
  appendLine("10.0.1.00> command channel transferred");
  await sleep(620);
  appendLine("10.0.1.00> entering vector_drift root");
  await sleep(680);
}

function waitForContinue() {
  appendLine("");
  const line = appendLine("PRESS ANY KEY TO CONTINUE", "press-any-key");

  return new Promise((resolve) => {
    const modifiers = new Set(["Shift", "Alt", "Control", "Meta", "CapsLock"]);
    const done = (event) => {
      if (event.type === "keydown" && modifiers.has(event.key)) {
        return;
      }
      if (event.type === "keydown") {
        event.preventDefault();
      }
      window.removeEventListener("keydown", done);
      window.removeEventListener("pointerdown", done);
      line.classList.remove("press-any-key");
      resolve();
    };
    window.addEventListener("keydown", done);
    window.addEventListener("pointerdown", done);
  });
}

async function activateRootPrompt(startedAt) {
  output.innerHTML = "";
  output.scrollTop = 0;
  output.scrollLeft = 0;
  output.style.transform = "none";
  status.replaceChildren();
  status.hidden = true;
  terminalHeader.hidden = false;
  terminalHeader.classList.remove("status-stack");
  promptPrefix.textContent = "";
  input.value = "";
  form.classList.remove("loading");
  setTerminalState("booting");
  input.disabled = true;
  // Hard clear -> short black-screen hold.
  await sleep(randomBetween(180, 240));
  // Root prompt appears; cursor blinks alone before input is accepted.
  setPromptPrefix();
  updateCursor();
  await sleep(randomBetween(150, 190));
  input.disabled = false;
  input.focus();
  setTerminalState("ready");
  document.documentElement.dataset.bootDuration = String(Math.round(performance.now() - startedAt));
}

async function runBoot() {
  if (bootStarted) {
    return;
  }

  bootStarted = true;
  const startedAt = performance.now();
  input.disabled = true;
  promptPrefix.textContent = "";
  input.value = "";
  form.classList.add("loading");
  status.hidden = false;
  terminalHeader.classList.remove("status-stack");

  // A lone cursor blinks by itself (~2 blinks) before anything is typed.
  const openingLines = [""];
  renderStatusLines(openingLines, 0);
  await sleep(randomBetween(1750, 2050));

  // The prompt itself types on deliberately from nothing...
  await typeHumanStatusAppend(openingLines, 0, "console>", {
    baseDelay: 58,
    jitterMin: -14,
    jitterMax: 28,
  });
  await sleep(randomBetween(180, 260));
  // ...then the command flows in faster, still with phrase-level pauses.
  await typeHumanStatusAppend(openingLines, 0, ` ${locateCommand}`, {
    baseDelay: 30,
    jitterMin: -10,
    jitterMax: 20,
    pauses: [
      { after: "console> find", min: 110, max: 170 },
      { after: "console> find /opt", min: 70, max: 120 },
      { after: "console> find /opt -iname", min: 90, max: 150 },
      { after: "console> find /opt -iname 'vector_drift'", min: 120, max: 190 },
      { after: "console> find /opt -iname 'vector_drift' ", min: 80, max: 130 },
    ],
  });
  await sleep(randomBetween(420, 600));
  terminalHeader.classList.add("status-stack");
  renderStatusLines(openingLines);
  await sleep(45);
  openingLines.push("[scan] /opt");
  renderStatusLines(openingLines);
  await sleep(40);
  openingLines.push("[scan] /opt/local");
  renderStatusLines(openingLines);
  await sleep(42);
  openingLines.push("[scan] /opt/unknown");
  renderStatusLines(openingLines);
  await sleep(80);
  openingLines.push("[found] /opt/unknown/vectordrift.sim");
  renderStatusLines(openingLines);
  await sleep(120);
  openingLines.push("");
  await typeStatusLine(openingLines, openingLines.length - 1, `console> ${loadCommand}`, 6);
  await sleep(55);

  terminalHeader.classList.remove("status-stack");
  rewriteStatus(loaderStatuses[1]);
  await printLines([
    "VECTOR DRIFT RELAY BIOS 2.13 ................. BUILD 01-01-1980 / NODE 10.0.1.00",
    "BASE MEMORY ................................. 640K CONVENTIONAL / 8192K VECTOR PAGE",
    "HOST ABI .................................... ELF64 / LITTLE-ENDIAN / 64-BIT",
    "BOOT VOLUME ................................. A:\\VD / READ-ONLY / SECTOR MAP VALID",
  ], 18);
  const kernelLine = appendLine("KERNEL FAMILY ............................... UNRESOLVED");
  await sleep(120);
  await printLines([
    "COMPATIBILITY LAYER ........................ ACTIVE / DOS-UNIX BRIDGE / MODE 03",
    "SYSTEM CLOCK ................................ 00:00:06.09 / RTC SOURCE UNKNOWN",
  ], 18);

  await printCommand("A:\\>probe /bus:all /quiet", 42);
  await printBurst([
    "[BUS 00] VECTOR DISPLAY ADAPTER ............. FOUND  IRQ 05  DMA 01  PORT 03C0",
    "[BUS 01] PHOSPHOR SWEEP GENERATOR ........... FOUND  IRQ 07  DMA 03  PORT 02E0",
    "[BUS 02] COMBAT INTERCEPT PROCESSOR ......... FOUND  IRQ 11  DMA 05  PORT 0A20",
    "[BUS 03] MOTION FIELD INTEGRATOR ............ FOUND  IRQ 09  DMA 02  PORT 07F0",
    "[BUS 04] GHOST SAMPLE BUFFER ................ FOUND  1187 ENTRIES / 1 UNRESOLVED",
    "[BUS 05] OBSERVER INTERFACE ................. ABSENT / ENUMERATION DEFERRED",
    "[BUS 06] CORTEX BRIDGE ...................... PRESENT / OWNER UNASSIGNED",
    "[BUS 07] REMOTE CONTROL CHANNEL ............. CLOSED / AUTHORITY NONE",
  ], 10);
  appendLine("8 devices scanned / 6 active / 1 deferred / 1 unassigned");
  await sleep(65);

  await printCommand("A:\\>dir A:\\VD /w /s", 36);
  await printLines([
    " Volume in drive A is VECTOR_DRIFT",
    " Volume serial number is 10A0-01F0",
    " Directory of A:\\VD",
  ], 18);
  await printBurst([
    "VDRENDER SYS     18432  01-01-80 00:00    VDSCOPE  COM      4096  01-01-80 00:00",
    "COMBAT   MOD     12288  01-01-80 00:00    LATTICE BIN      8192  01-01-80 00:00",
    "COHORT   DAT       512  01-01-80 00:00    OBSERVER NUL       512  01-01-80 00:00",
    "CORTEX   SYS      2048  01-01-80 00:00    AXIOM    IDX       128  01-01-80 00:00",
  ], 12);
  appendLine("8 File(s) / 48128 bytes / 0 bytes free / filesystem geometry inconsistent");
  await sleep(65);

  await printCommand("A:\\>mem /classify /map", 38);
  await printLines([
    "CONVENTIONAL MEMORY ......................... 640K / 612K AVAILABLE",
    "VECTOR PAGE MEMORY ........................ 8192K / 7996K AVAILABLE",
    "RENDER COMMAND BUFFER ....................... 256K / DOUBLE-PAGED",
    "GHOST SAMPLE BUFFER ......................... 1187 ENTRIES / CRC ACCEPTED",
    "COMBAT PREDICTION TABLE ..................... 4096 NODES / WARM",
    "SIMULATION ROOT ............................. 0x00007F00-0x0000BFFF",
  ], 18);
  const foreignLine = appendLine("FOREIGN ADDRESS SPACE ....................... 1 REGION / OWNER UNKNOWN");
  await sleep(120);
  rewriteLine(foreignLine, "FOREIGN ADDRESS SPACE ....................... 0 REGIONS");
  await sleep(70);

  rewriteStatus(loaderStatuses[2]);
  await printCommand("A:\\>loadhigh VDSTACK.SYS /auto /silent", 38);
  await printBurst([
    "[ OK ] VDSCOPE.COM ............ sweep generator armed / radial scan nominal",
    "[ OK ] VDRENDER.SYS ........... vector pipeline initialized / core oscillator locked",
    "[ OK ] PHOSPHOR.TBL ........... persistence curves loaded / decay profile SLOW",
    "[ OK ] LATTICE.BIN ............ quantization grid mounted / drift 0.0003",
    "[ OK ] ENDPOINT.SYS ........... convergence calibrated / residual 0.0007",
    "[ OK ] RASTER.NUL ............. fallback suppressed / vector-only path active",
  ], 9);
  await sleep(35);
  await printBurst([
    "[ OK ] VDMOTION.MOD ........... field integrator online / timestep locked",
    "[ OK ] DRIFT.SYS .............. inertial correction table loaded / bias neutral",
    "[ OK ] GHOSTBUF.DAT ........... 1187 samples indexed / 1 unassigned signature",
    "[ OK ] TRAJECTORY.MOD ......... spline cache allocated / 4096 path nodes",
    "[ OK ] FORMATION.DAT .......... cohort geometry loaded / 12 templates",
    "[ OK ] WARPTRACE.SYS .......... residual vector history enabled",
  ], 9);
  await sleep(38);
  await printBurst([
    "[ OK ] COMBAT.MOD ............. intercept matrix allocated / protocol INTERCEPT",
    "[ OK ] THREAT.SYS ............. mass sorter active / six priority bands",
    "[ OK ] LEADCOMP.DAT ........... target lead table warmed / error below threshold",
    "[ OK ] PROXFUSE.SYS ........... proximity channel isolated / safing active",
    "[ OK ] WEAPONBUS.MOD .......... emitter lanes synchronized / discharge inhibited",
    "[ OK ] HOSTILE.IDX ............ known signatures loaded / unknown signatures 5",
  ], 10);
  await sleep(38);
  await printBurst([
    "[ OK ] WORLD.MOD .............. simulation space allocated / root read-only",
    "[ OK ] COHORT.DAT ............. population groups indexed / owner field blank",
    "[ OK ] OBSERVER.NUL ........... local observer interface missing",
    "[WAIT] CORTEX.SYS ............. organic bridge present / interface unassigned",
  ], 10);
  await sleep(110);
  await printBurst([
    "[----] PILOT.CHANNEL .......... no local pilot detected",
    "[----] REMOTE.AUTH ............ authority source unresolved",
  ], 10);

  await printBurst([
    "MODULE              STATE       ADDRESS       OWNER          DETAIL",
    "----------------------------------------------------------------------------",
  ], 16);
  await printLines([
    "vd_world            READY       0x00007F00    local          signatures: 5",
    "vd_motion           READY       0x00008120    local          ghost samples: 1187",
    "vd_combat           READY       0x00009200    local          intercept matrix armed",
    "vd_scope            READY       0x0000A100    local          beam convergence nominal",
  ], 18);
  // Decelerate: the last rows drop out of the fast sequence and land slowly,
  // easing into the stillness right before the glitch.
  await sleep(280);
  const observerLine = appendLine("vd_observer         MISSING     --------      none           interface unavailable");
  await sleep(380);
  const cortexLine = appendLine("vd_cortex           WAIT        0x0000AF10    unassigned     organic bridge detected");
  await sleep(500);
  const resolvingLine = appendLine("io>loader/ resolving missing interface ...");
  await sleep(640);

  rewriteStatus(loaderStatuses[3]);
  await sleep(70);
  await runAxiomReveal(observerLine, cortexLine, resolvingLine);

  rewriteStatus(loaderStatuses[4]);
  await runFinalOnlineSummary();
  await waitForContinue();
  await activateRootPrompt(startedAt);
}

function normalizeCommand(command) {
  const trimmed = command.trim().replace(/\s+/g, " ");
  const withoutDotSlash = trimmed.startsWith("./") ? trimmed.slice(2) : trimmed;
  return withoutDotSlash.toLowerCase();
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 || unitIndex === 0 ? value.toFixed(unitIndex === 0 ? 0 : 1) : value.toFixed(2)} ${units[unitIndex]}`;
}

function streamUrlFor(directUrl) {
  if (!packageProxyUrl || !directUrl) {
    return directUrl;
  }

  return `${packageProxyUrl}?url=${encodeURIComponent(directUrl)}`;
}

function sanitizeFilename(filename) {
  return (filename || "vector-drift-beta-package")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, 160) || "vector-drift-beta-package";
}

function filenameFromDisposition(disposition) {
  if (!disposition) {
    return "";
  }

  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch) {
    try {
      return decodeURIComponent(utfMatch[1].trim());
    } catch {
      return utfMatch[1].trim();
    }
  }

  return disposition.match(/filename="?([^";]+)"?/i)?.[1] || "";
}

function detectPlatform() {
  const platform = `${navigator.userAgentData?.platform || navigator.platform || ""}`.toLowerCase();
  const ua = navigator.userAgent.toLowerCase();
  const isMac = platform.includes("mac") || ua.includes("mac os");
  const isWindows = platform.includes("win") || ua.includes("windows");
  const isArm = ua.includes("arm64") || ua.includes("aarch64");

  return {
    os: isMac ? "macOS" : isWindows ? "Windows" : "unsupported",
    arch: isArm ? "arm64" : "x64",
  };
}

async function detectTarget() {
  const detected = detectPlatform();

  if (navigator.userAgentData?.getHighEntropyValues) {
    try {
      const values = await navigator.userAgentData.getHighEntropyValues(["architecture", "bitness", "platform"]);
      const architecture = `${values.architecture || ""}`.toLowerCase();
      const platform = `${values.platform || ""}`.toLowerCase();
      detected.os = platform.includes("mac") ? "macOS" : platform.includes("win") ? "Windows" : detected.os;
      detected.arch = architecture.includes("arm") ? "arm64" : values.bitness === "32" ? "x86" : "x64";
    } catch {
      // Browser declined high entropy hints; low entropy detection above is enough for asset choice.
    }
  }

  return detected;
}

function scoreAsset(asset, target) {
  const name = asset.name.toLowerCase();

  if (target.os === "macOS") {
    if (!name.includes("osx") && !name.includes("mac")) return -1;
    let score = name.endsWith(".dmg") ? 50 : name.endsWith(".zip") ? 30 : 0;
    score += target.arch === "arm64" && name.includes("arm64") ? 40 : 0;
    score += target.arch !== "arm64" && name.includes("x64") ? 40 : 0;
    return score;
  }

  if (target.os === "Windows") {
    if (!name.includes("win")) return -1;
    let score = name.includes("setup.exe") ? 60 : name.endsWith(".exe") ? 50 : name.endsWith(".zip") ? 25 : 0;
    score += target.arch === "x86" && name.includes("x86") ? 35 : 0;
    score += target.arch !== "x86" && name.includes("x64") ? 35 : 0;
    return score;
  }

  return name.endsWith(".zip") ? 5 : -1;
}

async function resolveLatestPackage() {
  const target = await detectTarget();
  const response = await fetch(releasesApiUrl, {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const error = new Error("release manifest rejected");
    error.status = response.status;
    throw error;
  }

  const release = await response.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const ranked = assets
    .map((asset) => ({ asset, score: scoreAsset(asset, target) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score);
  const selected = ranked[0]?.asset;

  if (!selected) {
    return {
      target,
      release,
      asset: null,
      filename: "codex-jr-downloads-latest",
      directUrl: release.html_url || releasesPageUrl,
      size: null,
    };
  }

  return {
    target,
    release,
    asset: selected,
    filename: sanitizeFilename(selected.name),
    directUrl: selected.browser_download_url,
    size: Number.isFinite(selected.size) ? selected.size : null,
  };
}

function renderProgress(line, receivedBytes, totalBytes, scannerPosition = 0) {
  if (Number.isFinite(totalBytes) && totalBytes > 0) {
    const progress = Math.min(1, Math.max(0, receivedBytes / totalBytes));
    const filled = Math.min(barWidth, Math.floor(progress * barWidth));
    const bar = `${"#".repeat(filled)}${"-".repeat(barWidth - filled)}`;
    const percent = `${Math.min(100, Math.floor(progress * 100))}`.padStart(3, " ");
    rewriteLine(line, `fetching package sectors [${bar}] ${percent}%\n${formatBytes(receivedBytes)} / ${formatBytes(totalBytes)}`);
    line.setAttribute("role", "progressbar");
    line.setAttribute("aria-valuemin", "0");
    line.setAttribute("aria-valuemax", "100");
    line.setAttribute("aria-valuenow", String(Math.min(100, Math.floor(progress * 100))));
    return;
  }

  const marker = "=".repeat(Math.min(scannerPosition, barWidth - 1)) + ">";
  const bar = `${marker}${"-".repeat(Math.max(0, barWidth - marker.length))}`.slice(0, barWidth);
  rewriteLine(line, `fetching package sectors [${bar}]\n${formatBytes(receivedBytes)} received`);
}

function activateFallbackDownload() {
  if (!fallbackDownload) {
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = fallbackDownload.url;
  anchor.download = fallbackDownload.filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function appendFallbackAction(label = "[ open latest os package ]") {
  const line = appendRawLine("terminal-action terminal-response");
  line.tabIndex = 0;
  line.textContent = label;
  line.addEventListener("click", activateFallbackDownload);
  line.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      activateFallbackDownload();
    }
  });
  return line;
}

async function downloadPackage() {
  if (activeTransfer) {
    appendResponse("transfer already active", "terminal-error");
    return;
  }

  setTerminalState("executing");
  fallbackDownload = null;
  appendResponse("executing download.exe");
  await sleep(320);
  const resolvingLine = appendResponse("resolving package manifest ...");
  await sleep(560);

  let packageInfo;
  try {
    packageInfo = await resolveLatestPackage();
  } catch (error) {
    rewriteLine(resolvingLine, "resolving preview package ............... rejected");
    appendResponse(`HTTP STATUS: ${error.status || "unavailable"}`, "terminal-error");
    appendResponse("package not retrieved", "terminal-error");
    setTerminalState("ready");
    input.focus();
    return;
  }

  const targetLabel = `${packageInfo.target.os} / ${packageInfo.target.arch}`;
  const expectedSize = packageInfo.size;
  rewriteLine(resolvingLine, "resolving package manifest .............. found");
  await sleep(300);
  const channelLine = appendResponse("opening private relay ................... connected");
  await sleep(520);
  const sizeLine = appendResponse(`package size ............................ ${Number.isFinite(expectedSize) ? formatBytes(expectedSize) : "unknown / streaming"}`);
  await sleep(420);
  const manifestLine = appendResponse("requesting package stream ...");
  await sleep(280);

  let response;
  let controller = new AbortController();
  activeTransfer = controller;

  try {
    response = await fetch(streamUrlFor(packageInfo.directUrl), { signal: controller.signal });
  } catch (error) {
    activeTransfer = null;
    rewriteLine(manifestLine, "requesting package stream ................ blocked");
    await sleep(320);
    appendResponse("package stream .......................... unavailable", "terminal-error");
    await sleep(300);
    appendResponse("release host requires browser handoff", "terminal-meta");
    await sleep(260);
    appendResponse("progress meter unavailable on this relay", "terminal-meta");
    await sleep(320);
    appendResponse(`TARGET           ${targetLabel}`, "terminal-meta");
    await sleep(180);
    appendResponse(`PACKAGE          ${packageInfo.filename}`, "terminal-meta");
    await sleep(320);
    appendResponse("browser handoff ......................... ready");
    fallbackDownload = { url: packageInfo.directUrl || releasesPageUrl, filename: packageInfo.filename };
    appendFallbackAction();
    setTerminalState("handoffReady");
    input.disabled = false;
    input.focus();
    return;
  }

  if (!response.ok) {
    activeTransfer = null;
    rewriteLine(manifestLine, "requesting package stream ................ rejected");
    appendResponse("transfer channel rejected", "terminal-error");
    appendResponse(`HTTP STATUS: ${response.status}`, "terminal-error");
    appendResponse("package not retrieved", "terminal-error");
    setTerminalState("ready");
    input.focus();
    return;
  }

  if (!response.body) {
    activeTransfer = null;
    rewriteLine(manifestLine, "requesting package stream ................ unavailable");
    await sleep(320);
    appendResponse("stream interface unavailable", "terminal-error");
    await sleep(260);
    appendResponse("progress meter unavailable on this relay", "terminal-meta");
    await sleep(260);
    appendResponse("browser handoff ......................... ready");
    fallbackDownload = { url: packageInfo.directUrl || releasesPageUrl, filename: packageInfo.filename };
    appendFallbackAction();
    setTerminalState("handoffReady");
    input.disabled = false;
    input.focus();
    return;
  }

  rewriteLine(manifestLine, "requesting package stream ................ accepted");
  await sleep(320);
  const headerSize = Number(response.headers.get("Content-Length"));
  const totalBytes = Number.isFinite(headerSize) && headerSize > 0 ? headerSize : expectedSize;
  const contentDisposition = response.headers.get("Content-Disposition");
  const filename = sanitizeFilename(filenameFromDisposition(contentDisposition) || packageInfo.filename);
  rewriteLine(sizeLine, `package size ............................ ${Number.isFinite(totalBytes) ? formatBytes(totalBytes) : "unknown / streaming"}`);
  appendResponse("PACKAGE          vector_drift_beta", "terminal-meta");
  await sleep(180);
  appendResponse(`TARGET           ${targetLabel}`, "terminal-meta");
  await sleep(180);
  appendResponse("CHANNEL          private beta", "terminal-meta");
  await sleep(180);
  appendResponse(`SIZE             ${Number.isFinite(totalBytes) ? formatBytes(totalBytes) : "unknown / streaming"}`, "terminal-meta");
  await sleep(320);

  setTerminalState("downloading");
  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;
  let scannerPosition = 0;
  let lastRender = 0;
  const progressLine = appendResponse("");
  renderProgress(progressLine, receivedBytes, totalBytes, scannerPosition);

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      chunks.push(value);
      receivedBytes += value.byteLength;
      const now = performance.now();
      if (now - lastRender >= 80) {
        scannerPosition = (scannerPosition + 1) % barWidth;
        renderProgress(progressLine, receivedBytes, totalBytes, scannerPosition);
        lastRender = now;
      }
    }
  } catch (error) {
    activeTransfer = null;
    if (error.name === "AbortError") {
      appendResponse("transfer aborted by local observer", "terminal-error");
    } else {
      appendResponse("transfer interrupted", "terminal-error");
      appendResponse(`received: ${formatBytes(receivedBytes)}`, "terminal-meta");
    }
    appendResponse("partial package discarded", "terminal-error");
    setTerminalState("ready");
    input.focus();
    return;
  }

  renderProgress(progressLine, receivedBytes, totalBytes, barWidth);
  activeTransfer = null;

  const blob = new Blob(chunks, {
    type: response.headers.get("Content-Type") || packageInfo.asset?.content_type || "application/octet-stream",
  });
  const objectUrl = URL.createObjectURL(blob);
  fallbackDownload = { url: objectUrl, filename };
  await sleep(260);
  appendResponse("package checksum ........................ valid");
  await sleep(240);
  appendResponse("transfer buffer ......................... complete");
  await sleep(240);
  appendResponse("browser handoff ......................... ready");
  await sleep(280);
  activateFallbackDownload();
  appendResponse("download request ........................ dispatched");
  appendFallbackAction("[ retry download ]");
  window.setTimeout(() => {
    if (fallbackDownload?.url === objectUrl) {
      URL.revokeObjectURL(objectUrl);
      fallbackDownload = null;
    }
  }, 60000);
  setTerminalState("handoffReady");
  input.disabled = false;
  input.focus();
}

function responseLines(lines, className = "terminal-response") {
  for (const line of lines) {
    appendResponse(line, className);
  }
}

async function runCommand(command, normalized) {
  if (!normalized) {
    appendLine("");
    return;
  }

  if (normalized === "download.exe") {
    await downloadPackage();
    return;
  }

  if (normalized === "download") {
    responseLines(["executable extension required", "try: download.exe"], "terminal-error");
    return;
  }

  if (normalized === "help") {
    responseLines([
      "AVAILABLE COMMANDS",
      "",
      "download.exe     retrieve authorized beta package",
      "status           inspect simulation state",
      "ls               list mounted system objects",
      "whoami           resolve active observer",
      "history          display command history",
      "version          display relay build information",
      "clear            clear terminal output",
      "exit             terminate current session",
    ]);
    return;
  }

  if (normalized === "status") {
    responseLines([
      "SIMULATION STATUS",
      "",
      "vector runtime .............. active",
      "render lattice .............. synchronized",
      "combat matrix ............... idle",
      "observer interface .......... unresolved",
    ]);
    const remoteLine = appendResponse("remote process .............. none");
    appendResponse("integrity state ............. nominal");
    await sleep(220);
    rewriteLine(remoteLine, "remote process .............. present");
    await sleep(180);
    rewriteLine(remoteLine, "remote process .............. none");
    return;
  }

  if (normalized === "ls" || normalized === "dir") {
    responseLines(["world/", "motion/", "cortex/", "combat.mod", "vectordrift.sim", "observer.nul", "download.exe"]);
    const axiomLine = appendResponse("axiom/", "terminal-meta");
    await sleep(120);
    rewriteLine(axiomLine, "a#iom/");
    await sleep(70);
    rewriteLine(axiomLine, "axiom/");
    return;
  }

  if (normalized === "whoami") {
    responseLines([
      "operator ................. local",
      "identity ................. observer",
      "authority ................ inherited",
    ]);
    const consentLine = appendResponse("consent token ............ absent");
    await sleep(260);
    rewriteLine(consentLine, "consent token ............ assumed");
    await sleep(500);
    return;
  }

  if (normalized === "version" || normalized === "ver") {
    responseLines([
      "VECTOR DRIFT RELAY",
      "",
      "loader ................... 2.13",
      "simulation ............... beta preview",
      "renderer drift ........... 0.0003",
      "observer protocol ........ active",
      "build origin ............. unknown",
    ]);
    return;
  }

  if (normalized === "history") {
    const visibleHistory = [...commandHistory];
    const insertAt = Math.min(visibleHistory.length, 1);
    if (!visibleHistory.includes("bind cortex --organic")) {
      visibleHistory.splice(insertAt, 0, "bind cortex --organic");
    }
    visibleHistory.forEach((entry, index) => appendResponse(`${index + 1}  ${entry}`));
    return;
  }

  if (normalized === "clear" || normalized === "cls") {
    output.innerHTML = "";
    output.scrollTop = 0;
    return;
  }

  if (normalized === "exit") {
    responseLines(["termination request denied", "observer session remains active"], "terminal-error");
    return;
  }

  await runLoreOrUnknown(normalized);
}

async function runLoreOrUnknown(normalized) {
  if (normalized === "axiom") {
    axiomUseCount += 1;
    const line = appendResponse(axiomUseCount === 1 ? "namespace not found" : "you are not expected to know that identifier", "terminal-error");
    if (axiomUseCount === 1) {
      await sleep(180);
      rewriteLine(line, "namespace access denied");
      await sleep(220);
      rewriteLine(line, "namespace does not exist");
    } else {
      await sleep(600);
      rewriteLine(line, "command not found");
    }
    return;
  }

  if (normalized === "observer") {
    responseLines(["OBSERVER INTERFACE", "", "local endpoint ............... detected", "cortex handshake ............. incomplete", "recording state .............. active", "consent token ................ assumed"]);
    return;
  }

  if (normalized === "cortex") {
    responseLines(["cortex interface state ....... linked", "organic endpoint ............. present"]);
    const line = appendResponse("binding authority ............ remote");
    await sleep(350);
    const interrupt = appendResponse("do not interrupt", "terminal-error");
    await sleep(450);
    rewriteLine(line, "binding authority ............ none");
    return;
  }

  const staticLore = {
    pilot: ["pilot channel ................ none", "observer channel ............. active"],
    root: ["local root unavailable", "remote root already mounted"],
    consent: ["observer consent ............. inherited"],
    organic: ["classification accepted"],
    ghost: ["ghost buffer contains one unassigned motion signature"],
    "1980": ["system date predates system origin"],
    "1187": ["ghost sample 1187 remains active"],
    "0x00007f00": ["address belongs to a process outside local memory"],
  };

  if (normalized === "sudo") {
    sudoUseCount += 1;
    appendResponse(sudoUseCount === 1 ? "sudo: local authority unavailable" : sudoUseCount === 2 ? "sudo: remote authority declined" : "sudo: request recorded", "terminal-error");
    return;
  }

  if (normalized === "hello") {
    const line = appendResponse("no response");
    await sleep(500);
    rewriteLine(line, "hello, observer");
    return;
  }

  if (normalized === "is anyone there") {
    appendResponse("no");
    await sleep(700);
    return;
  }

  if (staticLore[normalized]) {
    responseLines(staticLore[normalized]);
    return;
  }

  const unknownResponses = ["command not found", "unknown instruction", "parser could not resolve token", "no executable object matches that request"];
  unknownCount += 1;
  if (unknownCount >= 4 && specialUnknownStep === 0) {
    specialUnknownStep = 1;
    appendResponse("the interface is not designed for conversation", "terminal-error");
    return;
  }
  if (specialUnknownStep === 1) {
    specialUnknownStep = 2;
    appendResponse("yet", "terminal-error");
    return;
  }
  appendResponse(unknownResponses[(unknownCount - 1) % unknownResponses.length], "terminal-error");
}

async function submitCurrentCommand() {
  if (terminalState === "downloading" || terminalState === "executing") {
    return;
  }

  if (terminalState === "handoffReady" && !input.value.trim()) {
    activateFallbackDownload();
    return;
  }

  const command = input.value;
  const normalized = normalizeCommand(command);
  input.value = "";
  updateCursor();

  if (!normalized) {
    appendLine("");
    return;
  }

  appendCommandLine(command.trim());
  commandHistory.push(command.trim());
  historyCursor = commandHistory.length;
  setTerminalState("ready");
  await runCommand(command, normalized);
  if (terminalState !== "downloading" && terminalState !== "executing") {
    setTerminalState(terminalState === "handoffReady" ? "handoffReady" : "ready");
    input.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  submitCurrentCommand();
});

input.addEventListener("input", updateCursor);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    submitCurrentCommand();
    return;
  }

  if (event.key === "Escape" && activeTransfer) {
    event.preventDefault();
    activeTransfer.abort();
    return;
  }

  if (event.key === "ArrowUp" && commandHistory.length > 0 && terminalState !== "downloading" && terminalState !== "executing") {
    event.preventDefault();
    historyCursor = Math.max(0, historyCursor - 1);
    input.value = commandHistory[historyCursor] || "";
    updateCursor();
    return;
  }

  if (event.key === "ArrowDown" && commandHistory.length > 0 && terminalState !== "downloading" && terminalState !== "executing") {
    event.preventDefault();
    historyCursor = Math.min(commandHistory.length, historyCursor + 1);
    input.value = commandHistory[historyCursor] || "";
    updateCursor();
  }
});

document.querySelector(".terminal-content").addEventListener("pointerdown", () => {
  if (!input.disabled) {
    input.focus();
  }
});

window.addEventListener("resize", updateCursor);
window.addEventListener("load", runBoot, { once: true });
