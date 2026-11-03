/*
 * js/report-search.js
 * Report search box helper.
 */

/* ===================== Create-a-report: search box for "Report for" ===================== */
(function () {
  "use strict";
  const q = document.getElementById("rd-sq"),
    sel = document.getElementById("rd-sc");
  if (!q || !sel) return;
  const btns = ["rd-go", "rd-xl", "rd-dx"].map((i) => document.getElementById(i)).filter(Boolean);
  const norm = (s) =>
    String(s)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  let ALL = [];
  function snap() {
    ALL = [];
    [...sel.children].forEach((n) => {
      if (n.tagName === "OPTGROUP")
        [...n.children].forEach((o) => ALL.push({ v: o.value, t: o.textContent, g: n.label }));
      else ALL.push({ v: n.value, t: n.textContent, g: "" });
    });
  }
  function render() {
    const keep = sel.value,
      k = norm(q.value.trim()),
      ws = k.split(/\s+/).filter(Boolean);
    const m = ALL.filter((o) => ws.every((w) => norm(o.t + " " + o.g).includes(w)));
    sel.innerHTML = "";
    let grp = null,
      gn = null;
    m.forEach((o) => {
      if (o.g) {
        if (gn !== o.g) {
          grp = document.createElement("optgroup");
          grp.label = o.g;
          sel.appendChild(grp);
          gn = o.g;
        }
        grp.appendChild(new Option(o.t, o.v));
      } else {
        gn = null;
        sel.appendChild(new Option(o.t, o.v));
      }
    });
    if (!m.length) {
      const op = new Option("No matches found", "");
      op.disabled = true;
      sel.appendChild(op);
      sel.value = "";
    } else sel.value = m.some((o) => o.v === keep) ? keep : m[0].v;
    sel.size = k ? Math.min(8, Math.max(2, m.length)) : 1;
    btns.forEach((b) => (b.disabled = !m.length));
  }
  q.addEventListener("input", render);
  q.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (sel.options.length && !sel.options[0].disabled) {
        sel.focus();
      }
    }
  });
  sel.addEventListener("change", () => {
    sel.size = 1;
  });
  sel.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sel.size = 1;
    }
  });
  const _o = openRepDlg;
  openRepDlg = function () {
    _o();
    q.value = "";
    snap();
    sel.size = 1;
    btns.forEach((b) => (b.disabled = false));
    try {
      if (matchMedia("(pointer:fine)").matches) q.focus();
    } catch (e) {}
  };
})();
