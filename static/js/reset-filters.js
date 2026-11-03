/*
 * js/reset-filters.js
 * Reset buttons for all filter bars.
 */

(function () {
  var LIST = ["ivr-q", "ilr-q", "dq", "mdq", "ivq", "tq", "tz"];
  function bars() {
    var out = [];
    document.querySelectorAll("#abody .flt").forEach(function (f) {
      if (f.querySelector("[data-fa=rsf]")) return;
      var has =
        LIST.some(function (id) {
          return f.querySelector("#" + id);
        }) || f.querySelector("#ay");
      if (!has) return;
      if (
        Array.prototype.some.call(f.querySelectorAll("button"), function (b) {
          return /^\s*(reset|clear)/i.test(b.textContent) && !b.dataset.fa;
        })
      )
        return;
      out.push(f);
    });
    return out;
  }
  function add() {
    bars().forEach(function (f) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "btn";
      b.setAttribute("data-fa", "rsf");
      b.innerHTML = '<i class="bx bx-reset"></i> Reset filters';
      f.appendChild(b);
    });
  }
  function wrap() {
    var a = window.admRender;
    if (!a || a.__rs) return;
    var w = function () {
      var r = a.apply(this, arguments);
      try {
        add();
      } catch (e) {}
      return r;
    };
    w.__rs = 1;
    window.admRender = w;
  }
  wrap();
  document.addEventListener("DOMContentLoaded", wrap);
  setTimeout(wrap, 0);
  document.addEventListener(
    "click",
    function (e) {
      var b = e.target.closest && e.target.closest("[data-fa=rsf]");
      if (!b) return;
      e.preventDefault();
      var f = b.closest(".flt"),
        list = [];
      f.querySelectorAll("select,input").forEach(function (el) {
        if (!el.id || el.readOnly || el.type == "file" || el.type == "button") return;
        list.push({
          id: el.id,
          def: el.tagName == "SELECT" ? (el.options[0] ? el.options[0].value : "") : "",
        });
      });
      list.forEach(function (x) {
        var el = document.getElementById(x.id);
        if (!el || el.value === x.def) return;
        el.value = x.def;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      if (window.toast) window.toast("Filters reset");
    },
    true,
  );
})();
