/*
 * js/ui-kit-tables-buttons.js
 * Shared table and button helpers: DataTables footer totals, Bootstrap buttons, date pickers, searchable selects.
 */

(function () {
  "use strict";

  const jq = window.jQuery,
    bootstrapLib = window.bootstrap,
    Q = (s) => document.querySelector(s);
  /* ---------- Bootstrap buttons ---------- */
  const BUTTON_SELECTOR = ".btn,.ib,.sn-ib,.thm";
  const ICON = [
    [/^(export|download)/i, "bx-download"],
    [/^import/i, "bx-upload"],
    [/^delete|^remove/i, "bx-trash"],
    [/^edit$/i, "bx-edit-alt"],
    [/^cancel$/i, "bx-x"],
    [/^(save|update|submit)/i, "bx-save"],
    [/^add /i, "bx-plus"],
    [/reset/i, "bx-reset"],
    [/^(sign in|log in)/i, "bx-log-in"],
    [/^(log out|sign out)/i, "bx-log-out"],
    [/^print/i, "bx-printer"],
    [/^(generate|create)/i, "bx-file"],
    [/^(account)/i, "bx-user-circle"],
    [/^(search)/i, "bx-search"],
  ];
  function bsBtn(el) {
    if (el._bs) return;
    el._bs = 1;
    const c = el.classList;
    if (c.contains("ib")) {
      c.add("btn", "btn-sm");
      c.add(c.contains("dg") ? "btn-outline-danger" : "btn-outline-secondary");
      return;
    }
    if (c.contains("sn-ib") || c.contains("thm")) {
      c.add("btn", "btn-outline-secondary");
      return;
    }
    if (!c.contains("btn")) return;
    if (
      !/(^|\s)btn-(primary|secondary|success|danger|warning|info|light|dark|outline|link)/.test(
        el.className,
      )
    ) {
      c.add(
        c.contains("pri")
          ? "btn-primary"
          : el.id === "cfm-ok"
            ? "btn-danger"
            : c.contains("dng") || c.contains("dg")
              ? "btn-outline-danger"
              : "btn-outline-secondary",
      );
    }
    if (el.closest("table") || el.closest(".dt-container")) c.add("btn-sm");
    if (el.tagName === "BUTTON" && !el.querySelector(".bx") && !el.closest("#rep")) {
      const n = el.firstChild;
      if (n && n.nodeType === 3) {
        if (/^\s*\+\s/.test(n.nodeValue)) {
          n.nodeValue = n.nodeValue.replace(/^\s*\+\s*/, " ");
          el.insertBefore(makeButton("bx-plus"), n);
        } else {
          const t = n.nodeValue.trim();
          if (t && t.length < 32 && !el.dataset.noicon) {
            const m = ICON.find((x) => x[0].test(t));
            if (m) {
              el.insertBefore(makeButton(m[1]), n);
              n.nodeValue = " " + n.nodeValue.replace(/^\s+/, "");
            }
          }
        }
      }
    }
  }
  function makeButton(cls) {
    const i = document.createElement("i");
    i.className = "bx " + cls;
    return i;
  }
  /* ---------- single date pickers ---------- */
  const pickerInputs = new Set();
  function fireInputEvents(i) {
    i.dispatchEvent(
      new Event("input", {
        bubbles: true,
      }),
    );
    i.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );
  }
  function purgeDetachedPickers() {
    pickerInputs.forEach((i) => {
      if (!i.isConnected) {
        try {
          const d = jq(i).data("daterangepicker");
          d && d.remove();
        } catch (x) {}
        pickerInputs.delete(i);
      }
    });
  }
  function initDate(inp) {
    if (inp._drp || !jq || !jq.fn.daterangepicker || !window.moment) return;
    inp._drp = 1;
    const val = inp.value,
      max = inp.getAttribute("max"),
      min = inp.getAttribute("min");
    inp.type = "text";
    inp.readOnly = true;
    inp.autocomplete = "off";
    if (!inp.placeholder) inp.placeholder = "YYYY-MM-DD";
    inp.classList.add("drp-in");
    const o = {
      singleDatePicker: true,
      showDropdowns: true,
      autoUpdateInput: false,
      autoApply: false,
      minYear: 2000,
      maxYear: 2040,
      startDate: /^\d{4}-\d\d-\d\d$/.test(val) ? moment(val) : moment(),
      locale: {
        format: "YYYY-MM-DD",
        applyLabel: "Select",
        cancelLabel: "Clear",
        firstDay: 1,
      },
      applyButtonClasses: "btn-primary",
      cancelButtonClasses: "btn-outline-secondary",
    };
    if (max) o.maxDate = moment(max);
    if (min) o.minDate = moment(min);
    jq(inp)
      .daterangepicker(o)
      .on("apply.daterangepicker", (e, p) => {
        inp.value = p.startDate.format("YYYY-MM-DD");
        fireInputEvents(inp);
      })
      .on("cancel.daterangepicker", () => {
        inp.value = "";
        fireInputEvents(inp);
      })
      .on("show.daterangepicker", (e, p) => {
        if (/^\d{4}-\d\d-\d\d$/.test(inp.value)) {
          p.setStartDate(moment(inp.value));
          p.setEndDate(moment(inp.value));
        }
      });
    pickerInputs.add(inp);
  }
  /* ---------- DataTables ---------- */
  const dataTableState = {};
  function dtApply() {
    if (!jq || !jq.fn.DataTable) return;
    purgeDetachedPickers();
    document.querySelectorAll("#abody table").forEach((t, idx) => {
      if (
        t.closest(".dt-container") ||
        t.closest("#wz") ||
        t.hasAttribute("data-nodt") ||
        jq.fn.dataTable.isDataTable(t)
      )
        return;
      const tb = t.tBodies[0],
        hd = t.tHead;
      if (!tb || !hd || !tb.rows.length || tb.querySelector("td.em")) return;
      const n = hd.rows[0].cells.length;
      let tot = null;
      const last = tb.rows[tb.rows.length - 1];
      if (
        !t.tFoot &&
        last &&
        /^total\b/i.test(
          (
            last.cells[0] || {
              textContent: "",
            }
          ).textContent.trim(),
        )
      )
        tot = last;
      if (hd.querySelector("[colspan]")) return;
      const bad = [...tb.querySelectorAll("[colspan]")].some((c) => c.parentNode !== tot);
      if (bad) return;
      if (tot) {
        const tf = t.createTFoot(),
          r = tf.insertRow();
        [...tot.cells].forEach((c) => {
          const k = +c.getAttribute("colspan") || 1;
          c.removeAttribute("colspan");
          r.appendChild(c);
          for (let i = 1; i < k; i++) r.appendChild(document.createElement("td"));
        });
        while (r.cells.length < n) r.appendChild(document.createElement("td"));
        while (r.cells.length > n) r.deleteCell(-1);
        r.className = tot.className;
        r.setAttribute("style", tot.getAttribute("style") || "");
        tot.remove();
      }
      const rows = tb.rows.length,
        key =
          (window.ADM
            ? ADM.tab +
              "|" +
              (ADM.q || "") +
              "|" +
              (ADM.st || "") +
              "|" +
              (document.getElementById("fdr") ? document.getElementById("fdr").value : "") +
              "|" +
              Array.from(document.querySelectorAll(".fr select"))
                .map((x) => x.value)
                .join(",")
            : "") +
          ":" +
          idx,
        st = dataTableState[key] || {},
        isAt = t.classList.contains("at"),
        big = rows > 10,
        srch = !isAt;
      const nos = [...hd.rows[0].cells]
        .map((c, i) => (c.textContent.trim() === "" ? i : -1))
        .filter((i) => i >= 0);
      try {
        const dt = jq(t).DataTable({
          autoWidth: false,
          order: st.order || [],
          pageLength: st.len || 25,
          lengthMenu: [10, 25, 50, 100],
          paging: big,
          info: big,
          searching: srch,
          ordering: true,
          layout: {
            topStart: big ? "pageLength" : null,
            topEnd: srch ? "search" : null,
            bottomStart: big ? "info" : null,
            bottomEnd: big ? "paging" : null,
          },
          columnDefs: [
            {
              targets: nos,
              orderable: false,
              searchable: false,
            },
          ],
          language: {
            search: "",
            searchPlaceholder: "Search table…",
            lengthMenu: "_MENU_ per page",
            info: "_START_ to _END_ of _TOTAL_",
            infoEmpty: "No entries",
            infoFiltered: "(from _MAX_)",
            emptyTable: "No data",
            zeroRecords: "No matching rows",
          },
        });
        if (t.tFoot && t.tFoot.rows[0]) {
          const fr = t.tFoot.rows[0],
            hs = [...hd.rows[0].cells].map((c) => c.textContent.trim().toLowerCase()),
            NUM = /^[\d,]+$/,
            fix = () => {
              const nd = dt
                  .rows({
                    search: "applied",
                  })
                  .nodes()
                  .toArray(),
                V = (ci) =>
                  nd.map((r) =>
                    (
                      r.cells[ci] || {
                        textContent: "",
                      }
                    ).textContent.trim(),
                  ),
                S = [];
              hs.forEach((h, ci) => {
                const f = fr.cells[ci];
                if (!f) return;
                const ft = f.textContent.trim(),
                  vs = V(ci);
                if (NUM.test(ft) && vs.every((v) => NUM.test(v) || /^(—|·|-)$/.test(v))) {
                  const sm = vs.reduce((a, v) => a + (NUM.test(v) ? +v.replace(/,/g, "") : 0), 0);
                  S[ci] = sm;
                  f.textContent = sm.toLocaleString("en-US");
                }
              });
              const ix = (n) => hs.indexOf(n),
                pct = (a, b) => (b ? Math.round((a / b) * 100) + "%" : "—");
              if (
                ix("progress") >= 0 &&
                S[ix("total registered")] != null &&
                S[ix("total number to register")] != null
              )
                fr.cells[ix("progress")].textContent = pct(
                  S[ix("total registered")],
                  S[ix("total number to register")],
                );
              if (ix("complete %") >= 0 && S[ix("complete")] != null) {
                const c = S[ix("complete")] + (S[ix("pending")] || 0) + (S[ix("failed")] || 0);
                fr.cells[ix("complete %")].textContent = pct(S[ix("complete")], c);
              }
              const f0 = fr.cells[0];
              if (f0 && /\(\d+ MDAs\)/.test(f0.textContent))
                f0.textContent = f0.textContent.replace(/\(\d+ MDAs\)/, "(" + nd.length + " MDAs)");
            };
          dt.on("draw.dt", fix);
          fix();
        }
        dt.on("page.dt length.dt order.dt", () => {
          dataTableState[key] = {
            page: dt.page(),
            len: dt.page.len(),
            order: dt.order(),
          };
        });
        if (st.page && big && st.page < dt.page.info().pages) dt.page(st.page).draw("page");
      } catch (x) {
        console.warn("DataTable skipped", x);
      }
    });
    document.querySelectorAll("#abody table").forEach(rspFix);
  }
  /* Bootstrap: table-responsive wrapper + text-nowrap on every table in the admin pages */
  function rspFix(t) {
    if (t.dataset.rsp || t.closest("#wz")) return;
    t.dataset.rsp = 1;
    t.classList.add("text-nowrap");
    const p = t.parentNode;
    if (!p || p.classList.contains("table-responsive")) return;
    const w = document.createElement("div");
    w.className = "table-responsive";
    p.insertBefore(w, t);
    w.appendChild(t);
  }
  /* ---------- Bootstrap modals ---------- */
  const MODAL_CONFIG = {
    rdlg: {
      close: "#rd-x",
    },
    cfm: {
      close: "#cfm-no",
      size: "sm",
    },
    amod: {
      close: "[data-m=x]",
    },
    acct: {
      close: "#ac-x",
      size: "sm",
    },
    prof: {
      close: "[data-pp=x]",
    },
    mre: {
      close: "#mre-x",
      size: "xl",
    },
    pop: {
      close: "[data-a=x]",
      size: "sm",
    },
  };
  function normalize(box, cfg) {
    const kids = [...box.childNodes],
      h = kids.find((k) => k.nodeType === 1 && /^H[1-6]$/.test(k.tagName)),
      f = kids
        .slice()
        .reverse()
        .find((k) => k.nodeType === 1 && k.matches(".row2,.pf-ft,.pa"));
    const head = document.createElement("div");
    head.className = "modal-header";
    const t = document.createElement("h5");
    t.className = "modal-title";
    t.innerHTML = h ? h.innerHTML : "";
    const x = document.createElement("button");
    x.type = "button";
    x.className = "btn-close";
    x.setAttribute("aria-label", "Close");
    head.append(t, x);
    const body = document.createElement("div");
    body.className = "modal-body";
    kids.forEach((k) => {
      if (k !== h && k !== f) body.appendChild(k);
    });
    box.textContent = "";
    box.append(head, body);
    if (f) {
      f.classList.remove("row2");
      f.classList.add("modal-footer");
      box.appendChild(f);
    }
  }
  function modalize(el, cfg) {
    el.classList.add("modal");
    el.setAttribute("tabindex", "-1");
    el.removeAttribute("style");
    const fix = () => {
      let dlg = [...el.children].find((k) => k.classList.contains("modal-dialog"));
      if (!dlg) {
        const raw = [...el.children].find((k) => k.nodeType === 1);
        if (!raw) return;
        dlg = document.createElement("div");
        dlg.className =
          "modal-dialog modal-dialog-centered modal-dialog-scrollable" +
          (cfg.size ? " modal-" + cfg.size : "");
        raw.removeAttribute("style");
        raw.classList.remove("box");
        raw.classList.add("modal-content");
        el.insertBefore(dlg, raw);
        dlg.appendChild(raw);
      }
      const box = dlg.firstElementChild;
      if (box && !box.querySelector(":scope > .modal-body")) normalize(box, cfg);
    };
    let q = 0;
    const mo = new MutationObserver(() => {
      if (q) return;
      q = 1;
      queueMicrotask(() => {
        q = 0;
        mo.disconnect();
        try {
          fix();
        } finally {
          mo.observe(el, {
            childList: true,
            subtree: true,
          });
        }
      });
    });
    mo.observe(el, {
      childList: true,
      subtree: true,
    });
    fix();
    new MutationObserver(() => {
      if (el.hidden) {
        const i = bootstrapLib.Modal.getInstance(el);
        i && i.hide();
      } else {
        fix();
        bootstrapLib.Modal.getOrCreateInstance(el, {
          backdrop: "static",
          keyboard: false,
          focus: false,
        }).show();
      }
    }).observe(el, {
      attributes: true,
      attributeFilter: ["hidden"],
    });
    el.addEventListener("show.bs.modal", () => {
      const n = document.querySelectorAll(".modal.show").length;
      el.style.zIndex = 1055 + n * 20;
      requestAnimationFrame(() => {
        const b = [...document.querySelectorAll(".modal-backdrop")].pop();
        if (b) b.style.zIndex = 1050 + n * 20;
      });
    });
    el.addEventListener("click", (e) => {
      if (e.target.closest(".btn-close")) {
        const b = el.querySelector(cfg.close);
        b ? b.click() : (el.hidden = true);
      }
    });
    if (!el.hidden)
      bootstrapLib.Modal.getOrCreateInstance(el, {
        backdrop: "static",
        keyboard: false,
        focus: false,
      }).show();
  }
  /* ---------- boot ---------- */
  if (bootstrapLib)
    Object.keys(MODAL_CONFIG).forEach((id) => {
      const el = document.getElementById(id);
      if (el) modalize(el, MODAL_CONFIG[id]);
    });
  document.querySelectorAll(BUTTON_SELECTOR).forEach(bsBtn);
  document.querySelectorAll("input[type=date]").forEach(initDate);

  /* ---------- searchable selects (more than 10 options) ---------- */
  const SS_MIN = 10;
  let ssOpen = null;
  const ssPanel = document.createElement("div");
  ssPanel.className = "ss-panel";
  ssPanel.hidden = true;
  ssPanel.innerHTML =
    '<input type="search" class="ss-q" placeholder="Search…" autocomplete="off"><div class="ss-l" role="listbox"></div>';
  document.body.appendChild(ssPanel);
  const ssQ = ssPanel.querySelector(".ss-q"),
    ssL = ssPanel.querySelector(".ss-l");
  function ssLabel(sel) {
    const o = sel.options[sel.selectedIndex];
    return o ? o.textContent.trim() : "";
  }
  function ssRefresh(sel) {
    const b = sel._ssb;
    if (!b) return;
    const t = ssLabel(sel);
    b.querySelector("span").textContent = t || "Select…";
    b.classList.toggle("ss-ph", !sel.value);
    b.disabled = sel.disabled;
  }
  function ssSync(sel) {
    if (!sel.isConnected) return;
    const n = sel.options.length,
      ok =
        !sel.multiple &&
        (n > SS_MIN || sel.hasAttribute("data-search")) &&
        !sel.closest(".dt-length,.daterangepicker,.ss-panel") &&
        !sel.hasAttribute("data-nosearch");
    if (ok) {
      if (!sel._ssb) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ss-btn";
        b.innerHTML = "<span></span><i class='bx bx-chevron-down'></i>";
        b.addEventListener("click", () => ssShow(sel));
        sel.after(b);
        sel._ssb = b;
        sel.classList.add("ss-h");
        sel.addEventListener("change", () => ssRefresh(sel));
      }
      ssRefresh(sel);
    } else if (sel._ssb) {
      sel._ssb.remove();
      sel._ssb = null;
      sel.classList.remove("ss-h");
    }
  }
  function ssWatch(sel) {
    if (sel._ssw) return;
    sel._ssw = 1;
    new MutationObserver(() => ssSync(sel)).observe(sel, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
    ssSync(sel);
  }
  function ssList(sel, q) {
    q = (q || "").toLowerCase();
    const f = [];
    [...sel.options].forEach((o, i) => {
      const t = o.textContent.trim();
      if (!q || t.toLowerCase().includes(q)) f.push([i, t, o.value]);
    });
    ssL.innerHTML = f.length
      ? f
          .map(
            ([i, t, v]) =>
              `<div class="ss-o${i == sel.selectedIndex ? " on" : ""}${v === "" ? " ss-ph" : ""}" data-i="${i}" role="option">${
                t.replace(
                  /[&<>]/g,
                  (c) =>
                    ({
                      "&": "&amp;",
                      "<": "&lt;",
                      ">": "&gt;",
                    })[c],
                ) || "&nbsp;"
              }</div>`,
          )
          .join("")
      : '<div class="ss-none">No match</div>';
    const on = ssL.querySelector(".on") || ssL.querySelector(".ss-o");
    if (on) {
      ssL.querySelectorAll(".hl").forEach((x) => x.classList.remove("hl"));
      on.classList.add("hl");
    }
  }
  function ssPlace(sel) {
    const r = sel._ssb.getBoundingClientRect(),
      h = Math.min(320, innerHeight * 0.5),
      below = innerHeight - r.bottom,
      up = below < h && r.top > below;
    ssPanel.style.width = Math.max(r.width, 340) + "px";
    ssPanel.style.left = Math.min(r.left, innerWidth - Math.max(r.width, 340) - 8) + "px";
    if (up) {
      ssPanel.style.top = "auto";
      ssPanel.style.bottom = innerHeight - r.top + 4 + "px";
    } else {
      ssPanel.style.bottom = "auto";
      ssPanel.style.top = r.bottom + 4 + "px";
    }
  }
  function ssShow(sel) {
    if (sel.disabled) return;
    ssOpen = sel;
    ssQ.value = "";
    ssList(sel, "");
    ssPanel.hidden = false;
    ssPlace(sel);
    const top = [...document.querySelectorAll(".modal.show")].length;
    ssPanel.style.zIndex = 1200 + top * 20;
    ssQ.focus();
    const on = ssL.querySelector(".on");
    if (on)
      on.scrollIntoView({
        block: "nearest",
      });
  }
  function ssHide() {
    ssPanel.hidden = true;
    if (ssOpen && ssOpen._ssb)
      ssOpen._ssb.focus({
        preventScroll: true,
      });
    ssOpen = null;
  }
  function ssPick(i) {
    const sel = ssOpen;
    if (!sel) return;
    sel.selectedIndex = +i;
    sel.dispatchEvent(
      new Event("input", {
        bubbles: true,
      }),
    );
    sel.dispatchEvent(
      new Event("change", {
        bubbles: true,
      }),
    );
    ssRefresh(sel);
    ssHide();
  }
  ssQ.addEventListener("input", () => ssList(ssOpen, ssQ.value));
  ssL.addEventListener("mousedown", (e) => {
    const o = e.target.closest(".ss-o");
    if (o) {
      e.preventDefault();
      ssPick(o.dataset.i);
    }
  });
  ssQ.addEventListener("keydown", (e) => {
    const os = [...ssL.querySelectorAll(".ss-o")];
    let c = os.findIndex((x) => x.classList.contains("hl"));
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!os.length) return;
      os[c] && os[c].classList.remove("hl");
      c = e.key === "ArrowDown" ? Math.min(os.length - 1, c + 1) : Math.max(0, c - 1);
      os[c].classList.add("hl");
      os[c].scrollIntoView({
        block: "nearest",
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (os[c]) ssPick(os[c].dataset.i);
    } else if (e.key === "Escape" || e.key === "Tab") {
      e.stopPropagation();
      ssHide();
    }
  });
  document.addEventListener(
    "mousedown",
    (e) => {
      if (!ssPanel.hidden && !e.target.closest(".ss-panel,.ss-btn")) ssHide();
    },
    true,
  );
  addEventListener("resize", () => {
    if (!ssPanel.hidden) ssHide();
  });
  document.addEventListener(
    "scroll",
    (e) => {
      if (!ssPanel.hidden && !e.target.closest?.(".ss-panel")) ssHide();
    },
    true,
  );
  const ssScan = (root) => {
    (root.matches && root.matches("select") ? [root] : [])
      .concat(root.querySelectorAll ? [...root.querySelectorAll("select")] : [])
      .forEach(ssWatch);
  };
  ssScan(document);
  new MutationObserver((ms) => {
    for (const m of ms)
      for (const n of m.addedNodes) if (n.nodeType === 1 && !(n instanceof SVGElement)) ssScan(n);
  }).observe(document.body, {
    childList: true,
    subtree: true,
  });
  let applyTimer = 0;
  const scheduleApply = () => {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(dtApply, 25);
  };
  new MutationObserver((ms) => {
    let t = false;
    for (const m of ms) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || n instanceof SVGElement) continue;
        if (n.matches && n.matches(BUTTON_SELECTOR)) bsBtn(n);
        if (n.querySelectorAll) {
          n.querySelectorAll(BUTTON_SELECTOR).forEach(bsBtn);
          n.querySelectorAll("input[type=date]").forEach(initDate);
          if (n.matches("input[type=date]")) initDate(n);
        }
        if (n.tagName === "TABLE" || (n.querySelector && n.querySelector("table"))) t = true;
      }
    }
    if (t) scheduleApply();
  }).observe(document.body, {
    childList: true,
    subtree: true,
  });
  window.UIKIT = {
    reg: (i) => pickerInputs.add(i),
    purge: purgeDetachedPickers,
    dtApply,
    kick: scheduleApply,
  };
  scheduleApply();
})();
