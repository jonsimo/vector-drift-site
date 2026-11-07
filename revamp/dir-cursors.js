/* MOCKUP ONLY — five mouse-pointer options for the console site, switchable
   from the chip at the bottom (or ?cursor=system|arrow|block|reticle|ship).
   Every option keeps the mouse fully working: hover selects, click runs.
   The custom ones hide while the arrow keys are driving, and come back on the
   next mouse move, so keyboard and mouse never fight over the highlight. */
(function () {
  "use strict";

  const OPTIONS = {
    system: "1 · system pointer",
    arrow: "2 · phosphor arrow",
    block: "3 · block cell (snaps to the text grid)",
    reticle: "4 · reticle (locks onto targets)",
    ship: "5 · vector ship + trail",
  };
  const CLICKABLE = ".vd-dir .vd-row, .vd-quick, .vd-close, .vd-video, .vd-thumb, .vd-prog .vd-row, .vd-banner";
  const PHOS = "#11cab8", HOT = "#aef9e6";

  // --- 2: CSS cursor from an SVG pixel arrow (no DOM, zero lag) -------------
  // 1 = fill, 2 = dark outline. Hotspot is the tip at (1,1).
  const ARROW = [
    "2", "22", "212", "2112", "21112", "211112", "2111112", "21111112", "211111112",
    "2111111112", "21111122222", "2112112", "212 2112", "22  2112", "2    2112", "     2112", "      22",
  ];
  function arrowSVG(fill) {
    const px = 2;
    let s = `<svg xmlns='http://www.w3.org/2000/svg' width='${12 * px + 4}' height='${ARROW.length * px + 4}'>`;
    ARROW.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === " ") return;
      s += `<rect x='${x * px + 1}' y='${y * px + 1}' width='${px}' height='${px}' fill='${c === "1" ? fill : "#011510"}'/>`;
    }));
    return `url("data:image/svg+xml,${encodeURIComponent(s + "</svg>")}") 2 2`;
  }

  // --- shared DOM layer for 3/4/5 --------------------------------------------
  const layer = document.createElement("div");
  layer.id = "vd-cursor-layer";
  document.body.appendChild(layer);
  const style = document.createElement("style");
  style.textContent = `
    #vd-cursor-layer { position: fixed; inset: 0; pointer-events: none; z-index: 9999; }
    #vd-cursor-layer > * { position: absolute; left: 0; top: 0; will-change: transform; }
    html.vd-cur-hide, html.vd-cur-hide *, html.vd-cur-boot, html.vd-cur-boot * { cursor: none !important; }
    html.vd-cur-boot #vd-cursor-layer { visibility: hidden; }
    #vd-cursor-layer.idle { opacity: 0; transition: opacity 120ms; }
    .vd-cur-block { width: var(--cw); height: var(--lh); background: ${PHOS}; mix-blend-mode: difference;
      box-shadow: 0 0 6px rgba(17,202,184,.7), 0 0 16px rgba(17,202,184,.3); }
    .vd-cur-block.rest { animation: vdCurBlink 1.06s steps(1, end) infinite; }
    @keyframes vdCurBlink { 50% { opacity: 0; } }
    .vd-cur-ret { width: 22px; height: 22px; transition: width 130ms, height 130ms, transform 60ms linear; }
    .vd-cur-ret i { position: absolute; width: 7px; height: 7px; border: 0 solid ${PHOS};
      filter: drop-shadow(0 0 3px rgba(17,202,184,.9)); }
    .vd-cur-ret i:nth-child(1) { left: 0; top: 0; border-left-width: 2px; border-top-width: 2px; }
    .vd-cur-ret i:nth-child(2) { right: 0; top: 0; border-right-width: 2px; border-top-width: 2px; }
    .vd-cur-ret i:nth-child(3) { left: 0; bottom: 0; border-left-width: 2px; border-bottom-width: 2px; }
    .vd-cur-ret i:nth-child(4) { right: 0; bottom: 0; border-right-width: 2px; border-bottom-width: 2px; }
    .vd-cur-dot { width: 3px; height: 3px; background: ${HOT}; box-shadow: 0 0 5px ${HOT}; }
    .vd-cur-ret.lock i { border-color: ${HOT}; }
    .vd-cur-ship svg { display: block; overflow: visible; }
    #vd-cursor-chip, #vd-feel-chip { position: fixed; bottom: 12px; left: 50%; transform: translateX(-50%); z-index: 10000;
      display: flex; gap: 6px; font: 12px/1 monospace; letter-spacing: 1px; }
    #vd-cursor-chip button, #vd-feel-chip button { white-space: nowrap; color: ${PHOS}; background: rgba(17,202,184,.06); border: 1px solid rgba(17,202,184,.4);
      border-radius: 3px; padding: 7px 10px; cursor: pointer; font: inherit; text-shadow: 0 0 6px rgba(17,202,184,.6); }
    #vd-cursor-chip button.on, #vd-feel-chip button.on { background: ${PHOS}; color: #011510; text-shadow: none; }
  `;
  document.head.appendChild(style);

  let mode = null, mx = -100, my = -100, onMove = null, raf = 0;
  const html = document.documentElement;

  // No pointer at all through the boot and the logo. When the console comes
  // up (terminal fires "vd:console-ready"), the pointer flickers in the way the
  // connect-gate words do: on/off/on with jittered gaps, then holds.
  html.classList.add("vd-cur-boot");
  const rnd = (a, b) => a + Math.random() * (b - a);
  async function flickerIn() {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(rnd(380, 620));                     // let the prompt land first
    for (const on of [true, false, true, false, true]) {
      html.classList.toggle("vd-cur-boot", !on);
      await wait(on ? rnd(40, 90) : rnd(50, 110));
    }
    html.classList.remove("vd-cur-boot");
  }
  window.addEventListener("vd:console-ready", flickerIn, { once: true });

  function clear() {
    layer.replaceChildren();
    layer.classList.remove("idle");
    html.classList.remove("vd-cur-hide");
    html.style.cursor = "";
    document.querySelectorAll(".vd-row, .vd-video, .vd-thumb").forEach((n) => (n.style.cursor = ""));
    cancelAnimationFrame(raf);
    onMove = null;
  }

  function set(next) {
    if (!OPTIONS[next]) next = "system";
    clear();
    mode = next;
    try { localStorage.setItem("vd_cursor_mock", mode); } catch (e) {}
    document.querySelectorAll("#vd-cursor-chip button").forEach((b) => b.classList.toggle("on", b.dataset.c === mode));

    if (mode === "system") return;

    if (mode === "arrow") {
      // Plain CSS: same arrow everywhere, a hot (brighter) one over targets.
      const normal = arrowSVG(PHOS), hot = arrowSVG(HOT);
      html.style.cursor = `${normal}, default`;
      const paint = () => document.querySelectorAll(CLICKABLE).forEach((n) => (n.style.cursor = `${hot}, pointer`));
      paint();
      onMove = paint;   // new rows appear as programs open/close
      return;
    }

    html.classList.add("vd-cur-hide");

    if (mode === "block") {
      // A console cell that snaps to the character grid of the output.
      const out = document.getElementById("terminal-output");
      const probe = document.createElement("span");
      probe.textContent = "MMMMMMMMMM";
      probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
      out.appendChild(probe);
      const cw = probe.getBoundingClientRect().width / 10;
      probe.remove();
      const lh = parseFloat(getComputedStyle(out).fontSize) * 1.42;
      const b = document.createElement("div");
      b.className = "vd-cur-block rest";
      b.style.setProperty("--cw", cw + "px");
      b.style.setProperty("--lh", lh + "px");
      layer.appendChild(b);
      let restTimer = 0;
      onMove = (e) => {
        const r = out.getBoundingClientRect();
        const gx = r.left + Math.floor((mx - r.left) / cw) * cw;
        const gy = r.top + Math.floor((my - r.top + (out.scrollTop % lh)) / lh) * lh - (out.scrollTop % lh);
        b.style.transform = `translate(${gx}px, ${gy}px)`;
        // over a target the row highlight IS the cursor, so the cell steps aside
        b.style.opacity = e && e.target.closest && e.target.closest(CLICKABLE) ? "0" : "1";
        b.classList.remove("rest");
        clearTimeout(restTimer);
        restTimer = setTimeout(() => b.classList.add("rest"), 500);
      };
      return;
    }

    if (mode === "reticle") {
      // Corner brackets around the pointer that expand to frame whatever
      // clickable thing is underneath — a target lock.
      // Subtle trail: two faint bracket ghosts and a few decaying dots chase the
      // live reticle, like phosphor persistence. Driven by one rAF loop (no CSS
      // transitions) so the ghosts lag the lead by a frame or two and settle.
      const mkRet = (opacity) => {
        const r = document.createElement("div");
        r.className = "vd-cur-ret";
        r.style.transition = "none";
        r.style.opacity = String(opacity);
        r.innerHTML = "<i></i><i></i><i></i><i></i>";
        return r;
      };
      const mkDot = (opacity) => {
        const d = document.createElement("div");
        d.className = "vd-cur-dot";
        d.style.opacity = String(opacity);
        return d;
      };
      const rets = [mkRet(0.12), mkRet(0.22), mkRet(0.36), mkRet(1)];          // ghosts first so the lead draws on top
      const dots = [mkDot(0.1), mkDot(0.16), mkDot(0.24), mkDot(0.34), mkDot(0.46), mkDot(1)];
      layer.append(...rets, ...dots);
      // box state per bracket set: lead eases to the target, each ghost eases to the one ahead
      const box = rets.map(() => ({ x: mx - 11, y: my - 11, w: 22, h: 22 }));
      const pts = dots.map(() => ({ x: mx, y: my }));
      let target = { x: mx - 11, y: my - 11, w: 22, h: 22 };
      onMove = (e) => {
        const t = e && e.target.closest && e.target.closest(CLICKABLE);
        rets[rets.length - 1].classList.toggle("lock", !!t);
        if (t) {
          const r = t.getBoundingClientRect(), pad = 5;
          target = { x: r.left - pad, y: r.top - pad, w: r.width + pad * 2, h: r.height + pad * 2 };
        } else {
          target = { x: mx - 11, y: my - 11, w: 22, h: 22 };
        }
      };
      const ease = (a, b, k) => {
        a.x += (b.x - a.x) * k; a.y += (b.y - a.y) * k;
        if (b.w !== undefined) { a.w += (b.w - a.w) * k; a.h += (b.h - a.h) * k; }
      };
      const tick = () => {
        for (let i = box.length - 1; i >= 0; i--) {
          ease(box[i], i === box.length - 1 ? target : box[i + 1], i === box.length - 1 ? 0.5 : 0.24);
          const b = box[i], el = rets[i];
          el.style.width = b.w + "px";
          el.style.height = b.h + "px";
          el.style.transform = `translate(${b.x}px, ${b.y}px)`;
        }
        for (let i = pts.length - 1; i >= 0; i--) {
          ease(pts[i], i === pts.length - 1 ? { x: mx, y: my } : pts[i + 1], i === pts.length - 1 ? 1 : 0.32);
          dots[i].style.transform = `translate(${pts[i].x - 1.5}px, ${pts[i].y - 1.5}px)`;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return;
    }

    if (mode === "ship") {
      // The player ship as the pointer, tip at the hotspot, with a short
      // phosphor-decay trail. Brightens and grows a touch over targets.
      const ghosts = [];
      const shipSVG = (o, w) => `<svg width="22" height="26" viewBox="-11 -2 22 26">
        <path d="M0 0 L9 22 L0 16 L-9 22 Z" fill="rgba(1,21,16,.6)" stroke="${HOT}" stroke-width="${w}"
          style="filter:drop-shadow(0 0 3px rgba(17,202,184,.95))" opacity="${o}"/></svg>`;
      for (let i = 0; i < 5; i++) {
        const g = document.createElement("div");
        g.className = "vd-cur-ship";
        g.innerHTML = shipSVG(i === 0 ? 1 : 0.38 - i * 0.07, i === 0 ? 1.6 : 1.1);
        g.style.zIndex = String(10 - i);
        layer.appendChild(g);
        ghosts.push({ el: g, x: mx, y: my });
      }
      let lock = false;
      onMove = (e) => { lock = !!(e && e.target.closest && e.target.closest(CLICKABLE)); };
      const tick = () => {
        ghosts.forEach((g, i) => {
          const lead = i === 0 ? { x: mx, y: my } : ghosts[i - 1];
          const k = i === 0 ? 1 : 0.45;
          g.x += (lead.x - g.x) * k;
          g.y += (lead.y - g.y) * k;
          const s = i === 0 && lock ? 1.18 : 1;
          // tilt toward the upper-left like a pointer; tip sits on the hotspot
          g.el.style.transform = `translate(${g.x - 11}px, ${g.y}px) rotate(-28deg) scale(${s})`;
          g.el.style.transformOrigin = "11px 0";
        });
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
  }

  document.addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    layer.classList.remove("idle");
    if (onMove) onMove(e);
  }, { passive: true });
  // Keyboard is driving: hide the custom pointer until the mouse moves again.
  window.addEventListener("keydown", (e) => {
    if (e.key.startsWith("Arrow")) layer.classList.add("idle");
  }, true);
  document.addEventListener("mouseleave", () => layer.classList.add("idle"));
  // Re-evaluate after the console redraws under a still mouse (program open/quit).
  new MutationObserver(() => { if (onMove && mode !== "ship") onMove({ target: document.elementFromPoint(mx, my) || document.body }); })
    .observe(document.getElementById("terminal-output"), { childList: true, subtree: true });

  const chip = document.createElement("div");
  chip.id = "vd-cursor-chip";
  chip.innerHTML = Object.entries(OPTIONS).map(([k, v]) => `<button data-c="${k}" title="${v}">${v.split(" (")[0]}</button>`).join("");
  chip.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) set(b.dataset.c); });
  document.body.appendChild(chip);

  // FEEL switch (console log vs hybrid pages) -- reloads with ?feel=
  const feelChip = document.createElement("div");
  feelChip.id = "vd-feel-chip";
  feelChip.style.bottom = "48px";
  const qf = new URLSearchParams(location.search);
  const feel = qf.get("feel") === "console" ? "console" : "hybrid";
  feelChip.innerHTML = ["console", "hybrid"].map((f) => `<button class="${f === feel ? "on" : ""}" data-f="${f}">feel · ${f}</button>`).join("");
  feelChip.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    qf.set("feel", b.dataset.f); location.search = qf.toString();
  });
  document.body.appendChild(feelChip);

  let start = new URLSearchParams(location.search).get("cursor");
  if (!start) { try { start = localStorage.getItem("vd_cursor_mock"); } catch (e) {} }
  set(start || "reticle");
  // initial placement for screenshots: ?mx=..&my=..
  const q = new URLSearchParams(location.search);
  if (q.has("mx")) {
    setTimeout(() => {
      mx = +q.get("mx"); my = +q.get("my");
      const t = document.elementFromPoint(mx, my) || document.body;
      t.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: mx, clientY: my }));
      t.dispatchEvent(new MouseEvent("mouseenter", { clientX: mx, clientY: my }));
      if (onMove) onMove({ target: t });
    }, 2600);
  }
})();
