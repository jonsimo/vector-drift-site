/* Vector Drift — phosphor text. The boot console draws its text in 4-character
   blocks whose brightness varies a little from block to block, so the glow
   never looks flat. This does the same for the site's text. Plain DOM splitting
   (no layout change: the blocks are inline), done again for anything the site
   adds later. Skips the logo, inputs, media, the OST list and anything that
   updates every frame. */
(function () {
  "use strict";
  var ROOTS = [".content-pane", ".directory", ".console-lines", ".masthead .tagline"];
  var SKIP = "script, style, svg, input, textarea, pre, .small-logo, .sr-only, .caret-measure, .ost-host, .sound-toggle, .console-hint, .console-program, .pb";
  var counter = 0, observer = null, busy = false;

  function wrap(node) {
    var text = node.nodeValue;
    if (!text || text.length < 2 || !/\S/.test(text)) return;
    // inside a flex or grid box every span would become its own item and swallow the spaces
    // between blocks, so the whole text node gets one block instead of several
    var disp = getComputedStyle(node.parentElement).display;
    if (/flex|grid/.test(disp)) {
      var one = document.createElement("span");
      one.className = "pb pb" + ((text.charCodeAt(0) + counter++) % 5);
      one.textContent = text;
      node.parentNode.replaceChild(one, node);
      return;
    }
    var frag = document.createDocumentFragment();
    for (var i = 0; i < text.length; i += 4) {
      var s = document.createElement("span");
      var seed = text.charCodeAt(i) + i + counter;
      s.className = "pb pb" + (seed % 5);
      s.textContent = text.slice(i, i + 4);
      frag.appendChild(s);
    }
    counter += 1;
    node.parentNode.replaceChild(frag, node);
  }
  function walk(root) {
    if (!root || root.nodeType !== 1) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        return p && !p.closest(SKIP) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    var nodes = [], n;
    while ((n = w.nextNode())) nodes.push(n);
    nodes.forEach(wrap);
  }
  function process(target) {
    busy = true;
    if (observer) observer.disconnect();
    try {
      if (target.nodeType === 3) { var p = target.parentElement; if (p && !p.closest(SKIP)) wrap(target); }
      else walk(target);
    } finally { observe(); busy = false; }
  }
  function observe() {
    if (!observer) return;
    ROOTS.forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) { observer.observe(el, { childList: true, subtree: true }); });
    });
  }
  function start() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { document.documentElement.classList.add("pb-off"); }
    observer = new MutationObserver(function (list) {
      if (busy) return;
      var seen = new Set();
      list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (!(n.nodeType === 1 && n.classList.contains("pb"))) seen.add(n); }); });
      seen.forEach(function (n) { if (n.isConnected) process(n); });
    });
    ROOTS.forEach(function (sel) { Array.prototype.forEach.call(document.querySelectorAll(sel), walk); });
    observe();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
