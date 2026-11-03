/*
 * js/bootstrap-grid-layout.js
 * Applies the Bootstrap grid classes to page layouts.
 */

/* Bootstrap grid layer: turns the report screens' card grids, KPI tiles and filter bars into row / col-* markup */
(function () {
  var CFG = [
    [
      ".fr .g2,.fr .wz-g2",
      "row g-3 mb-3",
      function () {
        return "col-12 col-lg-6";
      },
    ],
    [
      ".fr .kp",
      "row g-2 mb-3",
      function () {
        return "col-6 col-md-4 col-xl";
      },
      "kt",
    ],
    [
      ".fr .pfk",
      "row g-2 mb-2",
      function () {
        return "col-4";
      },
      "kt0",
    ],
    [
      ".fr .wz-ty",
      "row g-3 mb-3",
      function () {
        return "col-12 col-md-6";
      },
    ],
    [
      ".fr .wz-stt",
      "row g-2",
      function () {
        return "col-12";
      },
    ],
    [
      ".fr .flt",
      "row g-2 align-items-end",
      function (ch) {
        return ch.tagName == "LABEL" ? "col-12 col-sm-6 col-lg-3" : "col-12 col-sm-auto";
      },
    ],
  ];
  function wrapAll(el, rowCls, colFn, tile) {
    if (el.dataset.bsx) return;
    el.dataset.bsx = "1";
    var kids = Array.prototype.slice.call(el.children);
    rowCls.split(" ").forEach(function (c) {
      el.classList.add(c);
    });
    kids.forEach(function (ch) {
      var w = document.createElement("div");
      w.className = colFn(ch);
      if (tile && tile != "kt0") {
        ch.classList.add(tile, "h-100");
      }
      el.insertBefore(w, ch);
      w.appendChild(ch);
    });
  }
  function kpi() {
    document.querySelectorAll(".fr .kpi:not([data-bsx])").forEach(function (el) {
      el.dataset.bsx = "1";
      var r = document.createElement("div");
      r.className = "row g-3 align-items-center justify-content-around w-100";
      Array.prototype.slice.call(el.children).forEach(function (ch) {
        var w = document.createElement("div");
        w.className = "col-12 col-sm-6 col-xl";
        r.appendChild(w);
        w.appendChild(ch);
      });
      el.appendChild(r);
    });
  }
  var pend = false;
  function run() {
    pend = false;
    CFG.forEach(function (c) {
      document.querySelectorAll(c[0]).forEach(function (el) {
        wrapAll(el, c[1], c[2], c[3]);
      });
    });
    kpi();
  }
  function sched() {
    if (pend) return;
    pend = true;
    requestAnimationFrame(run);
  }
  new MutationObserver(sched).observe(document.body, { childList: true, subtree: true });
  sched();
})();
