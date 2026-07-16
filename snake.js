/* Vector Drift — loadable ASCII SNAKE. Self-contained; window.VDSnake.
   Loads INLINE in the console output (does not clear the logo banner). Renders
   with pure ASCII glyphs (all present in the console's Glass TTY font) so it
   inherits the exact console look — phosphor colour, glow, scanlines. Snake body
   uses '#', the same fill glyph as the boot gauges.
   launch() resolves when quit/over, so the console prompt returns after. */
(function () {
  "use strict";

  var COLS = 48, ROWS = 17;
  var BODY = "#";                        // same fill glyph as the boot gauges
  // placeholders (bright spans applied at render): \x01 head, \x02 food
  var H = "\x01", F = "\x02";
  // ASCII box border (Glass-TTY-native so it aligns + matches the console)
  var TL = "+", TR = "+", BL = "+", BR = "+", HZ = "=", VT = "|";

  // Subtle self-contained "eat" blip — soft triangle tick with a fast, clean
  // decay (replaces the lingering HTMLAudio console beep).
  var _actx = null;
  function _ac() { if (!_actx) { try { _actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return _actx; }
  function playEat() {
    var ac = _ac(); if (!ac) return;
    try {
      if (ac.state === "suspended") ac.resume();
      var t = ac.currentTime;
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(620, t);
      o.frequency.exponentialRampToValueAtTime(920, t + 0.025);   // tiny upward blip
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.006);       // soft attack
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);       // quick clean decay
      o.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + 0.12);
    } catch (e) {}
  }

  function padR(s, n) { s = String(s); return s.length >= n ? s : s + " ".repeat(n - s.length); }

  function launch(opts) {
    opts = opts || {};
    var output = opts.output || document.getElementById("terminal-output");
    if (!output) return Promise.resolve({ score: 0 });

    return new Promise(function (resolve) {
      var box = document.createElement("pre");
      box.className = "vd-snake";
      output.appendChild(box);

      var cx = (COLS / 2) | 0, cy = (ROWS / 2) | 0;
      var snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
      var dir = { x: 1, y: 0 }, nextDir = { x: 1, y: 0 };
      var food = spawnFood(snake);
      var score = 0, best = 0;
      var paused = false, over = false, started = false, timer = null, tickMs = 145;

      try { best = parseInt(localStorage.getItem("vd_snake_best") || "0", 10) || 0; } catch (e) {}

      function spawnFood(sn) {
        var f;
        do { f = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 }; }
        while (sn.some(function (s) { return s.x === f.x && s.y === f.y; }));
        return f;
      }

      function blankField() {
        var g = [];
        for (var y = 0; y < ROWS; y++) g.push(new Array(COLS).fill(" "));
        return g;
      }

      function putCenter(field, row, text) {
        if (row < 0 || row >= ROWS) return;
        var start = Math.max(0, ((COLS - text.length) / 2) | 0);
        for (var i = 0; i < text.length && start + i < COLS; i++) field[row][start + i] = text[i];
      }

      function render() {
        var w = COLS + 2;
        var titleLine = " VECTOR_DRIFT // SNAKE.EXE";
        var left = " SCORE " + score;
        var right = "BEST " + Math.max(best, score) + " ";
        var scoreLine = left + " ".repeat(Math.max(1, w - left.length - right.length)) + right;

        var field;
        if (over) {
          field = blankField();
          var r0 = (ROWS / 2 | 0) - 2;
          putCenter(field, r0, "G A M E   O V E R");
          putCenter(field, r0 + 2, "SCORE   " + score);
          putCenter(field, r0 + 3, "BEST    " + Math.max(best, score));
          putCenter(field, r0 + 5, "[ ENTER play again    Q quit ]");
        } else {
          field = blankField();
          field[food.y][food.x] = F;
          snake.forEach(function (s, i) { field[s.y][s.x] = i === 0 ? H : BODY; });
        }

        var lines = [titleLine, scoreLine, TL + HZ.repeat(COLS) + TR];
        for (var r = 0; r < ROWS; r++) lines.push(VT + field[r].join("") + VT);
        lines.push(BL + HZ.repeat(COLS) + BR);

        var footer;
        if (over) footer = " game over   ·   ENTER play again   ·   Q quit";
        else if (paused) footer = " ‖ PAUSED ‖   ·   P resume   ·   Q quit";
        else if (!started) footer = " press an arrow / WASD to start   ·   Q quit";
        else footer = " ← ↑ ↓ → / WASD move   ·   P pause   ·   Q quit";
        lines.push(footer);

        var html = lines.join("\n")
          .replace(/\x01/g, '<span class="s-head">#</span>')
          .replace(/\x02/g, '<span class="s-food">*</span>');
        box.innerHTML = html;
      }

      function tick() {
        if (paused || over || !started) return;
        dir = nextDir;
        var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) return gameOver();
        if (snake.some(function (s) { return s.x === head.x && s.y === head.y; })) return gameOver();
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
          score += 10;
          food = spawnFood(snake);
          playEat();
          if (tickMs > 75) { tickMs -= 4; clearInterval(timer); timer = setInterval(tick, tickMs); }
        } else {
          snake.pop();
        }
        render();
      }

      function gameOver() {
        over = true;
        clearInterval(timer);
        if (score > best) { best = score; try { localStorage.setItem("vd_snake_best", String(best)); } catch (e) {} }
        render();
      }

      function exit() {
        clearInterval(timer);
        document.removeEventListener("keydown", onKey, true);
        box.remove();
        resolve({ score: score });
      }

      // Play again — reset to a fresh round (keeps best + the same box/listener).
      function reset() {
        clearInterval(timer);
        cx = (COLS / 2) | 0; cy = (ROWS / 2) | 0;
        snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
        dir = { x: 1, y: 0 }; nextDir = { x: 1, y: 0 };
        food = spawnFood(snake);
        score = 0; over = false; started = false; paused = false; tickMs = 145;
        render();
        timer = setInterval(tick, tickMs);
      }

      function turn(nd) { started = true; if (nd.x !== -dir.x || nd.y !== -dir.y) nextDir = nd; }

      function block(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }
      function onKey(e) {
        var k = e.key;
        if (over) {
          block(e);
          if (k === "q" || k === "Q" || k === "Escape") exit();
          else if (k === "Enter" || k === " " || k === "r" || k === "R") reset();
          return;   // ignore other keys on the game-over screen
        }
        if (k === "Escape" || k === "q" || k === "Q") { block(e); exit(); return; }
        if (k === "p" || k === "P") { block(e); if (started) { paused = !paused; render(); } return; }
        if (k === "ArrowUp" || k === "w" || k === "W") { block(e); turn({ x: 0, y: -1 }); }
        else if (k === "ArrowDown" || k === "s" || k === "S") { block(e); turn({ x: 0, y: 1 }); }
        else if (k === "ArrowLeft" || k === "a" || k === "A") { block(e); turn({ x: -1, y: 0 }); }
        else if (k === "ArrowRight" || k === "d" || k === "D") { block(e); turn({ x: 1, y: 0 }); }
      }

      if (new URLSearchParams(location.search).has("snakeover")) { score = 120; over = true; }
      document.addEventListener("keydown", onKey, true);
      render();
      output.scrollTop = output.scrollHeight;
      timer = setInterval(tick, tickMs);
    });
  }

  window.VDSnake = { launch: launch };

  // Dev: ?snakedemo clears the output + launches into it for headless screenshots.
  if (new URLSearchParams(location.search).has("snakedemo")) {
    window.addEventListener("load", function () {
      setTimeout(function () {
        var out = document.getElementById("terminal-output");
        if (out) out.innerHTML = "";
        launch({});
      }, 500);
    });
  }
  // Dev: ?snakeinline launches inline AFTER the end sequence (logo banner stays).
  if (new URLSearchParams(location.search).has("snakeinline")) {
    window.addEventListener("load", function () { setTimeout(function () { launch({}); }, 6500); });
  }
})();
