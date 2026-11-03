/*
 * js/chart-hover-tooltips.js
 * Hover tooltips on charts.
 */

(function () {
  var st = document.createElement("style");
  st.textContent =
    ".ctip{position:fixed;z-index:99999;pointer-events:none;display:none;max-width:280px;padding:7px 10px;border-radius:9px;font-size:.78rem;line-height:1.45;white-space:pre-line;background:rgba(18,16,40,.96);color:#f3f1ff;border:1px solid rgba(197, 160, 89,.45);box-shadow:0 10px 30px rgba(0,0,0,.35)}" +
    ".card svg:not(#map):not(#smap) text,.panel svg:not(#map):not(#smap) text,.kpi svg text{pointer-events:none}" +
    "svg [data-ct]:hover,svg path[data-dn]:hover{filter:brightness(1.18);cursor:pointer}svg circle.lp{opacity:0;transition:opacity .1s}svg circle.lp:hover{opacity:1}" +
    ".hb[title]:hover,.hb[data-ct]:hover{background:rgba(127,127,160,.12);border-radius:6px}.kpi [data-ct]:hover{opacity:.8}";
  document.head.appendChild(st);
  var tip = document.createElement("div");
  tip.className = "ctip";
  document.body.appendChild(tip);
  var cur = null;
  function pull(el) {
    if (el.__ct !== undefined) return el.__ct;
    var t = "";
    if (el.namespaceURI === "http://www.w3.org/2000/svg") {
      var c = Array.prototype.find.call(el.childNodes, function (n) {
        return n.nodeName === "title";
      });
      if (c) {
        t = c.textContent;
        el.removeChild(c);
      }
    } else if (el.hasAttribute("title")) {
      t = el.getAttribute("title");
      el.removeAttribute("title");
    }
    if (!t && el.matches && el.matches("path[data-dn]")) {
      var dn = el.closest(".dn"),
        rows = dn ? dn.querySelectorAll(".hb") : [],
        n = +el.closest("svg").getAttribute("data-n"),
        i = +el.getAttribute("data-dn"),
        k = +el.getAttribute("data-dk");
      var r = rows.length === n ? rows[i] : rows[k];
      var lab = r ? ((r.querySelector("span") || {}).textContent || "").trim() : "";
      t =
        (lab ? lab + ": " : "") +
        Number(el.getAttribute("data-dv")).toLocaleString("en-US") +
        " (" +
        el.getAttribute("data-dp") +
        "%)";
    }
    el.__ct = t;
    if (t) el.setAttribute("data-ct", "1");
    return t;
  }
  function find(e) {
    for (var el = e.target; el && el !== document.body; el = el.parentNode) {
      if (!el.matches) continue;
      if (el.closest && el.closest("#map,#smap,.rmap")) return null;
      if (
        el.matches(
          "svg *:not(text):not(svg),.hb[title],.stk2 i[title],.kpi [title],.hb[data-ct],.stk2 i[data-ct],.kpi [data-ct]",
        )
      ) {
        if (el.matches("svg *") && !el.closest(".card,.panel,.kpi,.calw,.dn")) return null;
        var t = pull(el);
        if (t) return { el: el, t: t };
      }
    }
    return null;
  }
  function pos(e) {
    var w = tip.offsetWidth,
      h = tip.offsetHeight,
      x = e.clientX + 14,
      y = e.clientY + 16;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 12;
    tip.style.left = Math.max(6, x) + "px";
    tip.style.top = Math.max(6, y) + "px";
  }
  document.addEventListener("mousemove", function (e) {
    var f = find(e);
    if (!f) {
      tip.style.display = "none";
      cur = null;
      return;
    }
    if (cur !== f.el) {
      cur = f.el;
      tip.textContent = f.t;
    }
    tip.style.display = "block";
    pos(e);
  });
  document.addEventListener(
    "mouseleave",
    function () {
      tip.style.display = "none";
      cur = null;
    },
    true,
  );
  document.addEventListener(
    "scroll",
    function () {
      tip.style.display = "none";
    },
    true,
  );
})();
