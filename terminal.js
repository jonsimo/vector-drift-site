const output = document.getElementById("terminal-output");
const status = document.getElementById("terminal-status");
const terminalHeader = document.querySelector(".terminal-header");
const form = document.getElementById("terminal-form");
const input = document.getElementById("terminal-input");
const cursor = document.querySelector(".block-cursor");
const promptPrefix = document.querySelector(".prompt-prefix");

let bootStarted = false;

const locateCommand = "find /opt -iname 'vector_drift' $>/dev/null";
const loadCommand = "load /opt/unknown/vectordrift.sim";
const finalPrompt = "console>vector_drift;root/";
const initialCursorCycleMs = 815;
const bootDelayMultiplier = 1.725;

const loaderStatuses = [
  "io>loader/ auditing vector programmetry",
  "io>loader/ resolving vector programmetry",
  "io>loader/ loading vector programmetry",
];

const bootLines = [
  { text: "[    0.000000] Linux version 6.6.13-vd_64 (build@relay-node) #1 SMP PREEMPT_DYNAMIC" },
  { text: "[    0.004118] secureboot: Secure boot disabled" },
  { text: "[    0.013804] ACPI: Early table checksum verification enabled" },
  { text: "[    0.032001] smp: Brought up 8 processing units" },
  { text: "[  OK  ] Mounted /var/lib/vector-drift" },
  { text: "[  OK  ] Started Device Event Manager", delayAfter: 70 },
  { text: "Starting Vector Display Compositor..." },
  { text: "[  OK  ] Started Vector Drift Runtime Service" },
  { text: "[    0.706112] vd_input: render device /dev/vd0 registered" },
  { text: "[    0.884201] vd_render: loading out-of-tree module taints kernel" },
  { text: "[    0.934880] vd_render 0000:04:00.0: vector pipeline initialized" },
  { text: "[    0.958109] vd_render 0000:04:00.0: scan oscillator locked" },
  { text: "[    0.991045] vd_render: line-core calibration complete", delayAfter: 70 },
  { text: "Starting Simulation Asset Index..." },
  { text: "[    1.318001] vd_asset: 1187 records located" },
  { text: "[    1.362099] vd_asset: checksum manifest verified" },
  { text: "[    1.443817] vd_asset: warning: orphan record has no local owner", delayAfter: 140 },
  { text: "[    1.443841] vd_asset: continuing", delayAfter: 40 },
  { text: "[    1.512118] vd_asset: vector glyph table expanded to 4096 entries" },
  { text: "[    1.579223] vd_scope: sweep generator armed / phosphor decay nominal" },
  { text: "[    1.611904] combatd: intercept protocol matrix allocated" },
  { text: "Starting World-State Reconstruction..." },
  { text: "[    1.821803] vd_world: faction registry loaded / 4 declared signatures accepted" },
  { text: "[    1.946012] systemd[1]: Reached target Vector Simulation" },
  { text: "[    2.284499] vd_world: registry contains 5 signatures", delayAfter: 220 },
  { text: "[    2.284534] vd_world: registry normalized" },
  { text: "[    2.621183] input: auxiliary observer channel detected", delayAfter: 250 },
  { text: "[    2.621199] input: auxiliary observer channel closed" },
  { text: "[    2.668400] vd_trajectory: hostile spline buffer seeded" },
  { text: "[    2.702811] vectorscope: azimuth return stable / radial bloom contained" },
  { text: "vd-loader: ELF64 image valid / runtime checksum accepted", delayAfter: 50 },
  { text: "[    2.749113] vd_runtime: process image mapped at 0x00007f00" },
  { text: "[    2.790044] telemetryd[422]: localhost binding active" },
  { text: "[    2.844019] relay: target lead compensation table warmed" },
  { text: "[    2.908554] renderer: vector lattice quantized / drift error 0.0003" },
  { text: "[    3.001920] simnet: unknown pilot telemetry channel admitted", delayAfter: 120 },
  { text: "10.0.1.00>cortex interface online", interference: true, delayAfter: 100 },
  { text: "initializing render lattice / combat scheduler ... done" },
  { text: "initializing observer .......... [not found]", delayAfter: 220 },
  { text: "initializing observer .......... done" },
  { text: "[    3.118337] vd_state: runtime services synchronized" },
  { text: "[    3.204411] vd_state: simulation clock online" },
  { text: "[    3.281006] vectorscope: return vectors sorted by threat mass" },
  { text: "[    3.337810] combatd: proximity fuse simulation isolated" },
  { text: "[    3.402558] vd_motion: inertia frame rebuilt from ghost samples" },
  { text: "[    3.449775] vd_render: beam convergence within tolerance" },
  { text: "[  OK  ] Started Vector Drift Simulation", delayAfter: 50 },
  { text: "geometry models sequencing", finalSequence: true, delayAfter: 500 },
];

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  return line;
}

function updateCursor() {
  const measure = document.createElement("span");
  const style = window.getComputedStyle(input);
  measure.style.cssText = "position:absolute;visibility:hidden;white-space:pre;";
  measure.style.font = style.font;
  measure.style.letterSpacing = style.letterSpacing;
  measure.textContent = input.value || " ";
  document.body.appendChild(measure);
  cursor.style.left = `${Math.min(measure.getBoundingClientRect().width, input.clientWidth - 8)}px`;
  measure.remove();
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

async function typeLocateCommand() {
  const commandStart = "find";

  for (const character of commandStart) {
    input.value += character;
    updateCursor();
    await sleep(52 + Math.random() * 16);
  }

  await sleep(170);

  for (const character of locateCommand.slice(commandStart.length)) {
    input.value += character;
    updateCursor();
    await sleep(25 + Math.random() * 12);
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
  for (let dot = 1; dot <= 3; dot += 1) {
    await sleep(220);
    setPhosphorText(line, `geometry models sequencing${" .".repeat(dot)}`);
  }

  await sleep(260);
  setPhosphorText(line, "geometry models sequencing . . . OK");
}

async function runBoot() {
  if (bootStarted) {
    return;
  }

  bootStarted = true;
  const startedAt = performance.now();
  input.disabled = true;
  promptPrefix.textContent = "";
  input.focus();
  updateCursor();

  await sleep(initialCursorCycleMs * 2);
  await typePromptPrefix("console> ");
  await sleep(180);
  await typeLocateCommand();
  await sleep(400);

  for (const dotDelay of [220, 300, 400]) {
    input.value += " .";
    updateCursor();
    await sleep(dotDelay);
  }

  await sleep(280);
  const openingLines = [`console> ${locateCommand} . . .`];
  setPhosphorText(status, openingLines.join("\n"));
  status.hidden = false;
  terminalHeader.classList.add("status-stack");
  form.classList.add("loading");

  await sleep(260);
  openingLines.push("");
  await typeStatusLine(openingLines, 1, "[found] /opt/unknown/vectordrift.sim", 18);
  await sleep(240);
  openingLines.push("");
  await typeStatusLine(openingLines, 2, `console> ${loadCommand}`, 29);
  await sleep(850);
  await runLoaderPreamble();

  for (let index = 0; index < bootLines.length; index += 1) {
    const entry = bootLines[index];
    updateLoaderStatus(index, bootLines.length);

    const line = appendLine(entry.text, entry.className);

    if (entry.interference) {
      await runCortexInterference(line);
    }

    if (entry.finalSequence) {
      await runFinalSequence(line);
    }

    const delay = entry.finalSequence
      ? entry.delayAfter ?? 500
      : Math.round((entry.delayAfter ?? 12) * bootDelayMultiplier);
    await sleep(delay);
  }

  output.innerHTML = "";
  status.textContent = "";
  status.hidden = true;
  terminalHeader.hidden = true;
  output.after(form);
  promptPrefix.textContent = finalPrompt;
  input.value = "";
  form.classList.remove("loading");
  input.disabled = false;
  input.focus();
  updateCursor();
  document.documentElement.dataset.bootDuration = String(Math.round(performance.now() - startedAt));
}

function submitCurrentCommand() {
  const command = input.value;
  input.value = "";
  updateCursor();

  if (!command) {
    appendLine("");
    return;
  }

  appendLine(`${finalPrompt}${command}`, "command prompt-history");
  appendLine("command not found", "error prompt-history");
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
  }
});

window.addEventListener("resize", updateCursor);
window.addEventListener("load", runBoot, { once: true });
