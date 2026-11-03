/*
 * js/analytics-page.js
 * Analytics page: scopes (national, state, county), bands, charts and tables.
 */

(function () {
  "use strict";

  const analysisState = window.__an,
    selectOne = (s) => document.querySelector(s),
    analyticsOverlay = selectOne("#ana"),
    analyticsContent = selectOne("#ana-in"),
    body = selectOne("#ana-body"),
    scopeSelect = selectOne("#ana-sc"),
    tabsEl = selectOne("#ana-tabs"),
    analyticsDrawer = selectOne("#ana-drw");
  if (!analysisState || !analyticsOverlay) return;
  const BANDS = analysisState.BANDS,
    percentOf = (a, b) => (b ? Math.round((a / b) * 100) : 0),
    sumOf = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
  const rgba = (h, a) => {
    const n = parseInt(h.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const chip = (b) =>
    __tpl(
      "analytics:chip.1",
      `<span class="achip" style="background:{{s1: rgba(b.c, 0.18)}};color:{{s2: b.c}}">{{s3: b.n}}</span>`,
      [() => rgba(b.c, 0.18), () => b.c, () => b.n],
    );
  const bandOf = (s) => BANDS.find((b) => s >= b.min),
    scoreColor = (v) => bandOf(v).c;
  const TABS = [
    ["ov", "Overview"],
    ["dep", "Deployment"],
    ["risk", "Risk & access"],
    ["loc", "Locations"],
    ["sites", "Registration sites"],
    ["dq", "Data quality"],
  ];
  let scope = "nat",
    selectedCounty = "",
    phSt = null,
    tab = "ov",
    filt = "all",
    siteQuickSearch = "",
    siteSortKey = "e",
    siteSortDirection = -1,
    allScopeRows = [],
    scopeRows = [];
  const ctySel = selectOne("#ana-cty");
  const hasSites = () => SITES.length > 0;
  const label = () =>
    scope === "nat"
      ? "South Sudan"
      : selectedCounty
        ? selectedCounty + ", " + DATA[+scope].n
        : DATA[+scope].n;
  const calc = () => {
    allScopeRows = analysisState.allRows();
    scopeRows =
      scope === "nat"
        ? allScopeRows
        : allScopeRows.filter(
            (r) => r.si === +scope && (!selectedCounty || r.c.n === selectedCounty),
          );
  };
  function syncCty() {
    if (scope === "nat") {
      selectedCounty = "";
      ctySel.hidden = true;
      ctySel.innerHTML = "";
      return;
    }
    const L = allScopeRows
      .filter((r) => r.si === +scope)
      .slice()
      .sort((a, b) => a.c.n.localeCompare(b.c.n));
    if (selectedCounty && !L.some((r) => r.c.n === selectedCounty)) selectedCounty = "";
    ctySel.innerHTML =
      __tpl("analytics:syncCty.1", `<option value="">All counties ({{s1: L.length}})</option>`, [
        () => L.length,
      ]) +
      L.map((r) =>
        __tpl(
          "analytics:syncCty.2",
          `<option value="{{s1: esc(r.c.n)}}">{{s2: esc(r.c.n)}}</option>`,
          [() => esc(r.c.n), () => esc(r.c.n)],
        ),
      ).join("");
    ctySel.value = selectedCounty;
    ctySel.hidden = !L.length;
  }
  const bulletListHtml = (a) =>
    a.length
      ? __tpl("analytics:bulletListHtml.2", `<ul class="al">{{s1: a.map(…)}}</ul>`, [
          () =>
            a
              .map((t) => __tpl("analytics:bulletListHtml.1", `<li>{{s1: t}}</li>`, [() => t]))
              .join(""),
        ])
      : '<p class="em">Nothing to show.</p>';
  const legend = () =>
    __tpl("analytics:legend.2", `<div class="lgd">{{s1: BANDS.map(…)}}</div>`, [
      () =>
        BANDS.map((b) =>
          __tpl(
            "analytics:legend.1",
            `<span><i style="background:{{s1: b.c}}"></i>{{s2: b.n}}</span>`,
            [() => b.c, () => b.n],
          ),
        ).join(""),
    ]);
  /* ---------- components ---------- */
  function gauge(score) {
    const b = bandOf(score);
    return apxEl(
      {
        t: "gauge",
        v: score,
        col: b.c,
        label: b.n.toUpperCase(),
        show: 1,
        text: score,
      },
      170,
      230,
    );
  }
  function donut(vals, cols, ctr, sub) {
    return apxEl(
      {
        t: "donut",
        vals: vals,
        cols: cols,
        ctr: String(ctr),
        sub: String(sub),
      },
      170,
      170,
    );
  }
  function hbars(items, fv) {
    const mx = Math.max(...items.map((i) => i.v), 1);
    fv = fv || fmt;
    return items.length
      ? items
          .map((i) =>
            __tpl(
              "analytics:hbars.1",
              `<div class="hb{{s1: i.k != null || i.ph != null ? ' c…}}"{{s2: i.k != null ? …}}{{s3: i.ph != null ? …}} title="{{s4: esc(i.t || i.l)}}"><span class="hl">{{s5: esc(i.l)}}</span><span class="ht"><i style="width:{{s6: Math.max(2, (i.v / mx) * 100)}}%;background:{{s7: i.c}}"></i></span><b>{{s8: fv(i.v)}}</b></div>`,
              [
                () => (i.k != null || i.ph != null ? " clk" : ""),
                () => (i.k != null ? ` data-scope="${i.k}"` : ""),
                () => (i.ph != null ? ` data-ph="${i.ph}"` : ""),
                () => esc(i.t || i.l),
                () => esc(i.l),
                () => Math.max(2, (i.v / mx) * 100),
                () => i.c,
                () => fv(i.v),
              ],
            ),
          )
          .join("")
      : '<p class="em">No data.</p>';
  }
  function stackRow(l, segs) {
    return __tpl(
      "analytics:stackRow.2",
      `<div class="hs"><span>{{s1: esc(l)}}</span><div class="stk2">{{s2: segs.map(…)}}</div></div>`,
      [
        () => esc(l),
        () =>
          segs
            .map((s) =>
              __tpl(
                "analytics:stackRow.1",
                `<i style="width:{{s1: s.v * 100}}%;background:{{s2: s.c}}" title="{{s3: esc(s.t || '')}}"></i>`,
                [() => s.v * 100, () => s.c, () => esc(s.t || "")],
              ),
            )
            .join(""),
      ],
    );
  }
  function scatter(rows) {
    const W = 700,
      H = 320,
      L = 50,
      B = 38,
      T = 14,
      Rr = 14,
      mx = Math.log10(Math.max(10, ...rows.map((r) => r.e)) + 1),
      px = (s) => L + (s / 100) * (W - L - Rr),
      py = (e) => T + (H - T - B) * (1 - Math.log10(e + 1) / mx);
    let o = __tpl(
      "analytics:scatter.1",
      `<svg viewBox="0 0 {{s1: W}} {{s2: H}}" style="width:100%;height:auto">`,
      [() => W, () => H],
    );
    BANDS.slice()
      .reverse()
      .forEach((b, i, a) => {
        const lo = Math.max(0, b.min),
          hi = i === a.length - 1 ? 100 : a[i + 1].min;
        o += __tpl(
          "analytics:scatter.2",
          `<rect x="{{s1: px(lo)}}" y="{{s2: T}}" width="{{s3: px(hi) - px(lo)}}" height="{{s4: H - T - B}}" fill="{{s5: rgba(b.c, 0.09)}}"/>`,
          [() => px(lo), () => T, () => px(hi) - px(lo), () => H - T - B, () => rgba(b.c, 0.09)],
        );
      });
    [0, 25, 50, 75, 100].forEach(
      (v) =>
        (o += __tpl(
          "analytics:scatter.3",
          `<text class="mu" x="{{s1: px(v)}}" y="{{s2: H - B + 14}}" text-anchor="middle" font-size="9">{{s3: v}}</text>`,
          [() => px(v), () => H - B + 14, () => v],
        )),
    );
    [1, 10, 100, 1000, 10000]
      .filter((v) => Math.log10(v + 1) <= mx)
      .forEach(
        (v) =>
          (o += __tpl(
            "analytics:scatter.4",
            `<line x1="{{s1: L}}" x2="{{s2: W - Rr}}" y1="{{s3: py(v)}}" y2="{{s4: py(v)}}" stroke="rgba(127,127,160,.25)"/><text class="mu" x="{{s5: L - 6}}" y="{{s6: py(v) + 3}}" text-anchor="end" font-size="9">{{s7: fmt(v)}}</text>`,
            [
              () => L,
              () => W - Rr,
              () => py(v),
              () => py(v),
              () => L - 6,
              () => py(v) + 3,
              () => fmt(v),
            ],
          )),
      );
    o += __tpl(
      "analytics:scatter.5",
      `<text class="mu" x="{{s1: (L + W - Rr) / 2}}" y="{{s2: H - 6}}" text-anchor="middle" font-size="10">Readiness score →</text><text class="mu" transform="translate(11,{{s3: (T + H - B) / 2}}) rotate(-90)" text-anchor="middle" font-size="10">Employees (log) →</text>`,
      [() => (L + W - Rr) / 2, () => H - 6, () => (T + H - B) / 2],
    );
    const P = rows.slice().sort((a, b) => b.e - a.e);
    P.slice()
      .reverse()
      .forEach(
        (r) =>
          (o += __tpl(
            "analytics:scatter.6",
            `<circle cx="{{s1: px(r.score).toFixed(1)}}" cy="{{s2: py(r.e).toFixed(1)}}" r="{{s3: (3 + Math.min(5, Math.log10(r.e +…}}" fill="{{s4: r.b.c}}" fill-opacity=".75" stroke="var(--bg)" stroke-width="1" data-loc="{{s5: r.si}}|{{s6: esc(r.c.n)}}" style="cursor:pointer"><title>{{s7: esc(r.c.n)}} ({{s8: esc(r.st)}}) · {{s9: fmt(r.e)}} employees · score {{s10: r.score}}</title></circle>`,
            [
              () => px(r.score).toFixed(1),
              () => py(r.e).toFixed(1),
              () => (3 + Math.min(5, Math.log10(r.e + 1))).toFixed(1),
              () => r.b.c,
              () => r.si,
              () => esc(r.c.n),
              () => esc(r.c.n),
              () => esc(r.st),
              () => fmt(r.e),
              () => r.score,
            ],
          )),
      );
    P.slice(0, 6).forEach(
      (r) =>
        (o += __tpl(
          "analytics:scatter.7",
          `<text x="{{s1: (px(r.score) + 9).toFixed(1)}}" y="{{s2: (py(r.e) + 3).toFixed(1)}}" font-size="9" font-weight="700" style="paint-order:stroke;stroke:var(--bg);stroke-width:3px">{{s3: esc(r.c.n)}}</text>`,
          [() => (px(r.score) + 9).toFixed(1), () => (py(r.e) + 3).toFixed(1), () => esc(r.c.n)],
        )),
    );
    return o + "</svg>";
  }
  const kpiCardHtml = (l, v, s, p, c) =>
    __tpl(
      "analytics:kpiCardHtml.1",
      `<div class="panel ak"><small>{{s1: l}}</small><b>{{s2: v}}</b><em>{{s3: s}}</em><div class="bar"><i style="width:{{s4: Math.min(100, p)}}%;background:{{s5: c || 'linear-gradient(90deg,var(-…}}"></i></div></div>`,
      [
        () => l,
        () => v,
        () => s,
        () => Math.min(100, p),
        () => c || "linear-gradient(90deg,var(--v),var(--c))",
      ],
    );
  const panelHtml = (t, h, sub) =>
    __tpl(
      "analytics:panelHtml.2",
      `<div class="panel"><h2>{{s1: t}}{{s2: sub ? …}}</h2>{{s3: h}}</div>`,
      [
        () => t,
        () =>
          sub ? __tpl("analytics:panelHtml.1", `<small>{{s1: sub}}</small>`, [() => sub]) : "",
        () => h,
      ],
    );
  /* ---------- tabs ---------- */
  function pPhase(i) {
    const d = DATA[i],
      rows = allScopeRows.filter((r) => r.si === i),
      PH = [
        [1, "Phase 1", "Low risk"],
        [2, "Phase 2", "Risk"],
        [3, "Phase 3", "High risk"],
        [0, "Unclassified", ""],
      ];
    const G = analysisState.agg(rows),
      items = [],
      tr = [];
    PH.forEach(([k, n, sub]) => {
      const g = rows.filter((r) => (r.c.ph || 0) === k);
      if (!g.length && k === 0) return;
      const a = analysisState.agg(g);
      items.push({
        l: n,
        v: g.length ? a.score : 0,
        c: g.length ? a.b.c : "#988fc3",
        t: g.length
          ? (sub ? sub + " · " : "") +
            g.length +
            " location" +
            (g.length == 1 ? "" : "s") +
            " · " +
            fmt(a.emp) +
            " employees · " +
            a.b.n
          : "No locations in this phase",
      });
      tr.push(
        __tpl(
          "analytics:pPhase.3",
          `<tr><td><b>{{s1: n}}</b>{{s2: sub ? …}}</td><td class="n">{{s3: g.length}}</td><td class="n">{{s4: fmt(a.emp)}}</td><td>{{s5: g.length ? …}}</td><td class="n">{{s6: a.by.ready.n}}</td><td class="n">{{s7: a.by.cond.n}}</td><td class="n">{{s8: a.by.risk.n}}</td><td class="n">{{s9: a.by.crit.n}}</td></tr>`,
          [
            () => n,
            () =>
              sub
                ? __tpl("analytics:pPhase.1", ` <span class="mu">{{s1: sub}}</span>`, [() => sub])
                : "",
            () => g.length,
            () => fmt(a.emp),
            () =>
              g.length
                ? __tpl(
                    "analytics:pPhase.2",
                    `<span class="mini"><i style="width:{{s1: a.score}}%;background:{{s2: a.b.c}}"></i></span>{{s3: a.score}}`,
                    [() => a.score, () => a.b.c, () => a.score],
                  )
                : "—",
            () => a.by.ready.n,
            () => a.by.cond.n,
            () => a.by.risk.n,
            () => a.by.crit.n,
          ],
        ),
      );
    });
    const body =
      __tpl(
        "analytics:pPhase.4",
        `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px"><button class="btn" data-phback="1"><i class="bx bx-left-arrow-alt"></i> All states</button><button class="btn" data-scope="{{s1: i}}">Open {{s2: esc(d.n)}} analytics <i class="bx bx-right-arrow-alt"></i></button></div>`,
        [() => i, () => esc(d.n)],
      ) +
      __tpl(
        "analytics:pPhase.5",
        `<p class="em" style="text-align:left;margin:0 0 8px"><b>{{s1: esc(d.n)}}</b> · overall readiness <b>{{s2: G.score}}</b> ({{s3: esc(G.b.n)}}) · {{s4: G.n}} locations · {{s5: fmt(G.emp)}} employees</p>`,
        [() => esc(d.n), () => G.score, () => esc(G.b.n), () => G.n, () => fmt(G.emp)],
      ) +
      hbars(items, (v) => String(v)) +
      __tpl(
        "analytics:pPhase.6",
        `<table class="atb" style="margin-top:12px"><thead><tr><th>Security phase</th><th class="n">Locations</th><th class="n">Employees</th><th>Readiness</th><th class="n">Ready</th><th class="n">Cond.</th><th class="n">Risk</th><th class="n">Critical</th></tr></thead><tbody>{{s1: tr.join('')}}</tbody></table>`,
        [() => tr.join("")],
      );
    return panelHtml(
      "Readiness by security phase · " + esc(SH[d.n] || d.n),
      body,
      "use the Back button to return",
    );
  }
  function pPhaseAll() {
    const PH = [
        [1, "Phase 1", "Low risk"],
        [2, "Phase 2", "Risk"],
        [3, "Phase 3", "High risk"],
      ],
      cols = allScopeRows.some((r) => !r.c.ph) ? PH.concat([[0, "Unclassified", ""]]) : PH;
    const S = DATA.map((d, i) => ({
      d,
      i,
      rows: allScopeRows.filter((r) => r.si === i),
    }))
      .filter((x) => x.rows.length)
      .map((x) => ({
        d: x.d,
        i: x.i,
        rows: x.rows,
        a: analysisState.agg(x.rows),
      }))
      .sort((a, b) => b.a.score - a.a.score);
    const cell = (g) => {
      if (!g.length) return '<td class="mu">—</td>';
      const a = analysisState.agg(g);
      return __tpl(
        "analytics:cell.1",
        `<td title="{{s1: g.length}} location{{s2: g.length == 1 ? '' : 's'}} · {{s3: fmt(a.emp)}} employees · {{s4: a.b.n}}"><span class="mini"><i style="width:{{s5: a.score}}%;background:{{s6: a.b.c}}"></i></span><b>{{s7: a.score}}</b> <span class="mu">· {{s8: g.length}} loc</span></td>`,
        [
          () => g.length,
          () => (g.length == 1 ? "" : "s"),
          () => fmt(a.emp),
          () => a.b.n,
          () => a.score,
          () => a.b.c,
          () => a.score,
          () => g.length,
        ],
      );
    };
    const head = __tpl(
      "analytics:pPhaseAll.3",
      `<tr><th>State / area</th><th>Overall</th>{{s1: cols.map(…)}}</tr>`,
      [
        () =>
          cols
            .map(([k, n, sub]) =>
              __tpl("analytics:pPhaseAll.2", `<th>{{s1: n}}{{s2: sub ? …}}</th>`, [
                () => n,
                () =>
                  sub
                    ? __tpl("analytics:pPhaseAll.1", ` <span class="mu">{{s1: sub}}</span>`, [
                        () => sub,
                      ])
                    : "",
              ]),
            )
            .join(""),
      ],
    );
    const tot = __tpl(
      "analytics:pPhaseAll.4",
      `<tr><td><b>All states</b></td><td><span class="mini"><i style="width:{{s1: analysisState.agg(allScopeRows).s…}}%;background:{{s2: analysisState.agg(allScopeRows).b…}}"></i></span><b>{{s3: analysisState.agg(allScopeRows).s…}}</b></td>{{s4: cols.map(…)}}</tr>`,
      [
        () => analysisState.agg(allScopeRows).score,
        () => analysisState.agg(allScopeRows).b.c,
        () => analysisState.agg(allScopeRows).score,
        () => cols.map(([k]) => cell(allScopeRows.filter((r) => (r.c.ph || 0) === k))).join(""),
      ],
    );
    const rows = S.map((x) =>
      __tpl(
        "analytics:pPhaseAll.5",
        `<tr class="clk" data-ph="{{s1: x.i}}"><td><b>{{s2: esc(SH[x.d.n] || x.d.n)}}</b></td><td><span class="mini"><i style="width:{{s3: x.a.score}}%;background:{{s4: x.a.b.c}}"></i></span><b>{{s5: x.a.score}}</b></td>{{s6: cols.map(…)}}</tr>`,
        [
          () => x.i,
          () => esc(SH[x.d.n] || x.d.n),
          () => x.a.score,
          () => x.a.b.c,
          () => x.a.score,
          () => cols.map(([k]) => cell(x.rows.filter((r) => (r.c.ph || 0) === k))).join(""),
        ],
      ),
    ).join("");
    return panelHtml(
      "Readiness by security phase · all states",
      __tpl(
        "analytics:pPhaseAll.6",
        `<div style="overflow-x:auto"><table class="atb"><thead>{{s1: head}}</thead><tbody>{{s2: tot}}{{s3: rows}}</tbody></table></div><p class="em" style="text-align:left">Each cell is the readiness score (0–100) of that state's locations in the security phase, with the number of locations. Click a row for the full phase breakdown.</p>`,
        [() => head, () => tot, () => rows],
      ),
      "click a row",
    );
  }
  function tOv() {
    const G = analysisState.agg(scopeRows),
      by = G.by,
      tot = G.emp;
    let h =
      __tpl(
        "analytics:tOv.1",
        `<div class="ag kg"><div class="panel gp"><h2 style="margin-bottom:0">Readiness index</h2>{{s1: gauge(G.score)}}<small>{{s2: esc(label())}} · weighted by employees</small></div>`,
        [() => gauge(G.score), () => esc(label())],
      ) +
      kpiCardHtml("Employees", fmt(tot), G.n + " locations", 100) +
      kpiCardHtml(
        "Ready workforce",
        fmt(by.ready.emp),
        percentOf(by.ready.emp, tot) + "% · " + by.ready.n + " locations",
        percentOf(by.ready.emp, tot),
        BANDS[0].c,
      ) +
      kpiCardHtml(
        "Ready + Conditional",
        percentOf(by.ready.emp + by.cond.emp, tot) + "%",
        fmt(by.ready.emp + by.cond.emp) + " employees",
        percentOf(by.ready.emp + by.cond.emp, tot),
        BANDS[1].c,
      ) +
      kpiCardHtml(
        "Critical workforce",
        fmt(by.crit.emp),
        percentOf(by.crit.emp, tot) + "% · " + by.crit.n + " locations",
        percentOf(by.crit.emp, tot),
        BANDS[3].c,
      ) +
      kpiCardHtml("Data completeness", G.dq + "%", "across scored fields", G.dq) +
      "</div>";
    h +=
      '<div class="ag c3">' +
      panelHtml(
        "Locations by band",
        __tpl(
          "analytics:tOv.3",
          `<div class="dn">{{s1: donut( BANDS.map(…)}}<div style="flex:1;min-width:140px">{{s2: BANDS.map(…)}}</div></div>`,
          [
            () =>
              donut(
                BANDS.map((b) => by[b.k].n),
                BANDS.map((b) => b.c),
                G.n,
                "locations",
              ),
            () =>
              BANDS.map((b) =>
                __tpl(
                  "analytics:tOv.2",
                  `<div class="hb" style="grid-template-columns:12px 1fr 40px"><i style="width:10px;height:10px;border-radius:50%;background:{{s1: b.c}}"></i><span>{{s2: b.n}}</span><b>{{s3: by[b.k].n}}</b></div>`,
                  [() => b.c, () => b.n, () => by[b.k].n],
                ),
              ).join(""),
          ],
        ),
      ) +
      panelHtml(
        "Employees by band",
        hbars(
          BANDS.map((b) => ({
            l: b.n,
            v: by[b.k].emp,
            c: b.c,
            t: percentOf(by[b.k].emp, tot) + "% of workforce",
          })),
        ),
      ) +
      panelHtml(
        "Key findings",
        bulletListHtml(analysisState.insights(G, label(), scope === "nat")),
      ) +
      "</div>";
    if (scope === "nat") {
      const S = DATA.map((d, i) => ({
        d,
        i,
        a: analysisState.agg(allScopeRows.filter((r) => r.si === i)),
      })).filter((x) => x.a.n);
      h +=
        '<div class="ag c2">' +
        (phSt != null && S.some((x) => x.i === phSt)
          ? pPhase(phSt)
          : panelHtml(
              "State readiness ranking",
              hbars(
                S.slice()
                  .sort((x, y) => y.a.score - x.a.score)
                  .map((x) => ({
                    l: SH[x.d.n] || x.d.n,
                    v: x.a.score,
                    c: x.a.b.c,
                    ph: x.i,
                    t: x.d.n + " · click for readiness by phase",
                  })),
                (v) => String(v),
              ),
              "click a bar for phases",
            )) +
        pMix() +
        "</div>" +
        pPhaseAll();
    } else
      h +=
        '<div class="ag c2">' +
        panelHtml(
          "Readiness by location",
          hbars(
            scopeRows
              .slice()
              .sort((a, b) => b.e - a.e)
              .slice(0, 14)
              .map((r) => ({
                l: r.c.n,
                v: r.score,
                c: r.b.c,
                t: fmt(r.e) + " employees",
              })),
            (v) => String(v),
          ),
          "largest 14",
        ) +
        panelHtml(
          "Employees by location",
          hbars(
            scopeRows
              .slice()
              .sort((a, b) => b.e - a.e)
              .slice(0, 14)
              .map((r) => ({
                l: r.c.n,
                v: r.e,
                c: r.b.c,
              })),
          ),
        ) +
        "</div>";
    h += pScatter();
    h += '<div class="ag c2">' + pRoute() + pHeat() + "</div>";
    return h;
  }
  function tDep() {
    const G = analysisState.agg(scopeRows),
      by = G.by,
      tot = G.emp;
    const W = [
      ["Wave 1", "Deploy now", "ready", "Normal planning is enough."],
      ["Wave 2", "Deploy with coordination", "cond", "Approvals or light coordination first."],
      ["Wave 3", "Prepare first", "risk", "Resolve security or access gaps before travel."],
      ["Hold", "Resolve blockers", "crit", "Cannot be registered on site yet."],
    ];
    let cum = 0;
    let h =
      '<div class="wv">' +
      W.map(([a, t, k, d]) => {
        const x = by[k];
        cum += x.emp;
        const b = BANDS.find((z) => z.k === k);
        return __tpl(
          "analytics:tDep.1",
          `<div class="panel wc" style="border-top:3px solid {{s1: b.c}}"><small>{{s2: a}}</small><h3>{{s3: t}}</h3><div class="big">{{s4: fmt(x.emp)}}</div><p>{{s5: x.n}} locations · {{s6: percentOf(x.emp, tot)}}% of workforce<br>{{s7: d}}</p><div class="bar"><i style="width:{{s8: percentOf(cum, tot)}}%;background:{{s9: b.c}}"></i></div><small style="margin-top:6px;display:block">Cumulative {{s10: percentOf(cum, tot)}}%</small></div>`,
          [
            () => b.c,
            () => a,
            () => t,
            () => fmt(x.emp),
            () => x.n,
            () => percentOf(x.emp, tot),
            () => d,
            () => percentOf(cum, tot),
            () => b.c,
            () => percentOf(cum, tot),
          ],
        );
      }).join("") +
      "</div>";
    const Pr = scopeRows
      .map((r) => ({
        r,
        u: Math.round((r.e * (100 - r.score)) / 100),
      }))
      .filter((x) => x.u > 0)
      .sort((a, b) => b.u - a.u)
      .slice(0, 10);
    h +=
      '<div class="ag c21">' +
      panelHtml(
        "Where to focus first",
        Pr.length
          ? __tpl(
              "analytics:tDep.4",
              `<table class="atb"><thead><tr><th>#</th><th>Location</th>{{s1: scope === 'nat' ? ' th State /th…}}<th class="n">Employees</th><th>Score</th><th class="n">Workforce gap</th><th>Main blocker</th></tr></thead><tbody>{{s2: Pr.map(…)}}</tbody></table><p class="em" style="text-align:left">Workforce gap = employees × (100 − score) ÷ 100: where extra effort removes the most risk.</p>`,
              [
                () => (scope === "nat" ? "<th>State</th>" : ""),
                () =>
                  Pr.map((x, i) =>
                    __tpl(
                      "analytics:tDep.3",
                      `<tr class="clk" data-loc="{{s1: x.r.si}}|{{s2: esc(x.r.c.n)}}"><td class="mu">{{s3: i + 1}}</td><td><b>{{s4: esc(x.r.c.n)}}</b></td>{{s5: scope === 'nat' ? …}}<td class="n">{{s6: fmt(x.r.e)}}</td><td><span class="mini"><i style="width:{{s7: x.r.score}}%;background:{{s8: x.r.b.c}}"></i></span>{{s9: x.r.score}}</td><td class="n"><b>{{s10: fmt(x.u)}}</b></td><td class="mu">{{s11: esc(x.r.lead)}}</td></tr>`,
                      [
                        () => x.r.si,
                        () => esc(x.r.c.n),
                        () => i + 1,
                        () => esc(x.r.c.n),
                        () =>
                          scope === "nat"
                            ? __tpl(
                                "analytics:tDep.2",
                                `<td class="mu">{{s1: esc(SH[x.r.st] || x.r.st)}}</td>`,
                                [() => esc(SH[x.r.st] || x.r.st)],
                              )
                            : "",
                        () => fmt(x.r.e),
                        () => x.r.score,
                        () => x.r.b.c,
                        () => x.r.score,
                        () => fmt(x.u),
                        () => esc(x.r.lead),
                      ],
                    ),
                  ).join(""),
              ],
            )
          : '<p class="em">No outstanding gap.</p>',
      ) +
      panelHtml("Recommended actions", bulletListHtml(analysisState.actions(G, label()))) +
      "</div>";
    return h;
  }
  const callout = (t) =>
    __tpl("analytics:callout.1", `<div class="cal">{{s1: t}}</div>`, [() => t]);
  function pScatter() {
    const rows = scopeRows.filter((r) => r.e > 0),
      W = 760,
      L = 122,
      Rr = 14,
      T = 40,
      LH = 64,
      ls = [
        [2000, 1e12, "2,000+ employees"],
        [500, 2000, "500 – 1,999"],
        [100, 500, "100 – 499"],
        [0, 100, "Under 100"],
      ],
      H = T + LH * 4 + 40,
      X = (s) => L + (s / 100) * (W - L - Rr);
    let o = __tpl(
      "analytics:pScatter.1",
      `<svg viewBox="0 0 {{s1: W}} {{s2: H}}" style="width:100%;max-width:900px;height:auto;display:block;margin:0 auto">`,
      [() => W, () => H],
    );
    [
      [0, 35, BANDS[3]],
      [35, 55, BANDS[2]],
      [55, 75, BANDS[1]],
      [75, 100, BANDS[0]],
    ].forEach(([a, b, bd]) => {
      const m = (X(a) + X(b)) / 2;
      o += __tpl(
        "analytics:pScatter.2",
        `<rect x="{{s1: X(a)}}" y="{{s2: T}}" width="{{s3: X(b) - X(a)}}" height="{{s4: LH * 4}}" fill="{{s5: rgba(bd.c, 0.1)}}"/><text x="{{s6: m}}" y="{{s7: T - 14}}" text-anchor="middle" font-size="12" font-weight="700" style="fill:{{s8: bd.c}}">{{s9: bd.n}}</text><text class="mu" x="{{s10: m}}" y="{{s11: T - 3}}" text-anchor="middle" font-size="10">score {{s12: a}}–{{s13: b}}</text>`,
        [
          () => X(a),
          () => T,
          () => X(b) - X(a),
          () => LH * 4,
          () => rgba(bd.c, 0.1),
          () => m,
          () => T - 14,
          () => bd.c,
          () => bd.n,
          () => m,
          () => T - 3,
          () => a,
          () => b,
        ],
      );
    });
    ls.forEach(([lo, hi, nm], i) => {
      const y = T + i * LH,
        g = rows.filter((r) => r.e >= lo && r.e < hi);
      o += __tpl(
        "analytics:pScatter.3",
        `<line x1="{{s1: L}}" x2="{{s2: W - Rr}}" y1="{{s3: y}}" y2="{{s4: y}}" stroke="rgba(127,127,160,.3)"/><text x="{{s5: L - 10}}" y="{{s6: y + LH / 2 - 1}}" text-anchor="end" font-size="12" font-weight="600">{{s7: nm}}</text><text class="mu" x="{{s8: L - 10}}" y="{{s9: y + LH / 2 + 14}}" text-anchor="end" font-size="10.5">{{s10: g.length}} location{{s11: g.length == 1 ? '' : 's'}}</text>`,
        [
          () => L,
          () => W - Rr,
          () => y,
          () => y,
          () => L - 10,
          () => y + LH / 2 - 1,
          () => nm,
          () => L - 10,
          () => y + LH / 2 + 14,
          () => g.length,
          () => (g.length == 1 ? "" : "s"),
        ],
      );
      g.forEach((r, k) => {
        const j = (((k * 7 + Math.round(r.score)) % 5) - 2) * 10;
        o += __tpl(
          "analytics:pScatter.4",
          `<circle cx="{{s1: X(r.score).toFixed(1)}}" cy="{{s2: y + LH / 2 + j}}" r="6" fill="{{s3: r.b.c}}" fill-opacity=".85" stroke="var(--bg)" stroke-width="1.2" data-loc="{{s4: r.si}}|{{s5: esc(r.c.n)}}" style="cursor:pointer"><title>{{s6: esc(r.c.n)}} ({{s7: esc(r.st)}})
{{s8: fmt(r.e)}} employees · score {{s9: r.score}} · {{s10: r.b.n}}</title></circle>`,
          [
            () => X(r.score).toFixed(1),
            () => y + LH / 2 + j,
            () => r.b.c,
            () => r.si,
            () => esc(r.c.n),
            () => esc(r.c.n),
            () => esc(r.st),
            () => fmt(r.e),
            () => r.score,
            () => r.b.n,
          ],
        );
      });
    });
    o += __tpl(
      "analytics:pScatter.5",
      `<line x1="{{s1: L}}" x2="{{s2: W - Rr}}" y1="{{s3: T + LH * 4}}" y2="{{s4: T + LH * 4}}" stroke="rgba(127,127,160,.3)"/><rect x="{{s5: X(0) + 1}}" y="{{s6: T + 1}}" width="{{s7: X(55) - X(0) - 2}}" height="{{s8: LH * 2 - 2}}" fill="none" stroke="#d62f58" stroke-width="1.5" stroke-dasharray="5 4" rx="6"/><text x="{{s9: X(0) + 8}}" y="{{s10: T + 15}}" font-size="10.5" font-weight="700" style="fill:#d62f58">ACT FIRST: large and not ready</text>`,
      [
        () => L,
        () => W - Rr,
        () => T + LH * 4,
        () => T + LH * 4,
        () => X(0) + 1,
        () => T + 1,
        () => X(55) - X(0) - 2,
        () => LH * 2 - 2,
        () => X(0) + 8,
        () => T + 15,
      ],
    );
    [0, 25, 50, 75, 100].forEach(
      (v) =>
        (o += __tpl(
          "analytics:pScatter.6",
          `<text class="mu" x="{{s1: X(v)}}" y="{{s2: T + LH * 4 + 16}}" text-anchor="middle" font-size="10.5">{{s3: v}}</text>`,
          [() => X(v), () => T + LH * 4 + 16, () => v],
        )),
    );
    o += __tpl(
      "analytics:pScatter.7",
      `<text class="mu" x="{{s1: (L + W - Rr) / 2}}" y="{{s2: H - 6}}" text-anchor="middle" font-size="11">Readiness score (0 = not ready, 100 = fully ready) →</text></svg>`,
      [() => (L + W - Rr) / 2, () => H - 6],
    );
    const big = rows.filter((r) => r.e >= 500),
      f = big.filter((r) => r.score < 55),
      fe = sumOf(f, (r) => r.e),
      te = sumOf(rows, (r) => r.e);
    const msg = f.length
      ? __tpl(
          "analytics:pScatter.8",
          `<b>{{s1: f.length}}</b> large location{{s2: f.length == 1 ? '' : 's'}} (500+ employees) score below 55, holding <b>{{s3: fmt(fe)}}</b> employees ({{s4: percentOf(fe, te)}}% of the workforce). Start there.`,
          [
            () => f.length,
            () => (f.length == 1 ? "" : "s"),
            () => fmt(fe),
            () => percentOf(fe, te),
          ],
        )
      : __tpl(
          "analytics:pScatter.9",
          `No large location (500+ employees) scores below 55. <b>{{s1: big.filter((r) = r.score = 75).le…}}</b> of {{s2: big.length}} large locations are fully ready.`,
          [() => big.filter((r) => r.score >= 75).length, () => big.length],
        );
    return panelHtml(
      "Readiness vs workforce size",
      callout(msg) +
        o +
        legend() +
        '<p class="em" style="text-align:left;padding:8px 0 0">Each dot is one location. Rows group locations by number of employees; left to right shows how ready they are. Click a dot for details.</p>',
    );
  }
  function pMix() {
    let rowsH;
    if (scope === "nat") {
      const S = DATA.map((d, i) => ({
        d,
        i,
        a: analysisState.agg(allScopeRows.filter((r) => r.si === i)),
      }))
        .filter((x) => x.a.n)
        .sort((x, y) => y.a.emp - x.a.emp);
      rowsH =
        __tpl(
          "analytics:pMix.1",
          `<div class="sx hd"><span>State</span><span>Share of employees by readiness</span><span class="n">Employees</span><span class="n">Ready</span></div>`,
          [],
        ) +
        S.map((x) => {
          const t = x.a.emp,
            rd = percentOf(x.a.by.ready.emp, t);
          return __tpl(
            "analytics:pMix.3",
            `<div class="sx clk" data-scope="{{s1: x.i}}" title="{{s2: esc(x.d.n)}} · click to open"><span class="sl">{{s3: esc(SH[x.d.n] || x.d.n)}}</span><div class="stk3">{{s4: BANDS.map(…)}}</div><b class="n">{{s5: fmt(t)}}</b><span class="n" style="color:{{s6: scoreColor(x.a.score)}};font-weight:700">{{s7: rd}}%</span></div>`,
            [
              () => x.i,
              () => esc(x.d.n),
              () => esc(SH[x.d.n] || x.d.n),
              () =>
                BANDS.map((b) => {
                  const p = t ? (x.a.by[b.k].emp / t) * 100 : 0;
                  return p
                    ? __tpl(
                        "analytics:pMix.2",
                        `<i style="width:{{s1: p}}%;background:{{s2: b.c}}" title="{{s3: b.n}}: {{s4: fmt(x.a.by[b.k].emp)}} employees ({{s5: Math.round(p)}}%)">{{s6: p = 11 ? Math.round(p) + '%' : ''}}</i>`,
                        [
                          () => p,
                          () => b.c,
                          () => b.n,
                          () => fmt(x.a.by[b.k].emp),
                          () => Math.round(p),
                          () => (p >= 11 ? Math.round(p) + "%" : ""),
                        ],
                      )
                    : "";
                }).join(""),
              () => fmt(t),
              () => scoreColor(x.a.score),
              () => rd,
            ],
          );
        }).join("");
      return panelHtml(
        "Workforce by state",
        rowsH +
          legend() +
          '<p class="em" style="text-align:left;padding:8px 0 0">Each bar is 100% of a state\'s employees, split by how ready their location is. Longer green means more of the workforce can be registered now. Click a row to open that state.</p>',
        "largest first",
      );
    }
    const L2 = scopeRows.slice().sort((a, b) => b.e - a.e),
      top = L2.slice(0, 14),
      mx = Math.max(1, ...L2.map((r) => r.e));
    rowsH =
      __tpl(
        "analytics:pMix.4",
        `<div class="sx hd"><span>Location</span><span>Employees</span><span class="n">Employees</span><span class="n">Score</span></div>`,
        [],
      ) +
      top
        .map((r) =>
          __tpl(
            "analytics:pMix.5",
            `<div class="sx clk" data-loc="{{s1: r.si}}|{{s2: esc(r.c.n)}}"><span class="sl">{{s3: esc(r.c.n)}}</span><div class="stk3"><i style="width:{{s4: Math.max(2, (r.e / mx) * 100)}}%;background:{{s5: r.b.c}}" title="{{s6: r.b.n}}"></i></div><b class="n">{{s7: fmt(r.e)}}</b><span class="n" style="color:{{s8: r.b.c}};font-weight:700">{{s9: r.score}}</span></div>`,
            [
              () => r.si,
              () => esc(r.c.n),
              () => esc(r.c.n),
              () => Math.max(2, (r.e / mx) * 100),
              () => r.b.c,
              () => r.b.n,
              () => fmt(r.e),
              () => r.b.c,
              () => r.score,
            ],
          ),
        )
        .join("");
    return panelHtml(
      "Workforce by area",
      rowsH +
        legend() +
        (L2.length > 14
          ? __tpl(
              "analytics:pMix.6",
              `<p class="em" style="text-align:left;padding:8px 0 0">Showing the largest 14 of {{s1: L2.length}} locations.</p>`,
              [() => L2.length],
            )
          : ""),
      "colour = readiness band",
    );
  }
  function pRoute() {
    const by = {};
    scopeRows.forEach((r) => {
      const k = r.mode || "Not specified";
      by[k] = by[k] || {
        e: 0,
        n: 0,
      };
      by[k].e += r.e;
      by[k].n++;
    });
    const tot = sumOf(scopeRows, (r) => r.e) || 1;
    const nm = {
        Air: ["By air", "Flight recommended"],
        Road: ["By road", "Travel overland"],
        River: ["By river", "Boat or river transport"],
        "Needs discussion": ["Needs discussion", "Route must be agreed first"],
        "Not specified": ["Not set", "No recommendation recorded"],
      },
      mc = {
        Air: "#2F353B",
        Road: "#b45309",
        River: "#3a9ad0",
        "Needs discussion": "#d62f58",
        "Not specified": "#C5A059",
      };
    const it = Object.entries(by).sort((a, b) => b[1].e - a[1].e);
    return panelHtml(
      "Workforce by travel route",
      __tpl(
        "analytics:pRoute.2",
        `<div class="stk3" style="margin-bottom:14px">{{s1: it.map(…)}}</div>`,
        [
          () =>
            it
              .map(([k, v]) =>
                __tpl(
                  "analytics:pRoute.1",
                  `<i style="width:{{s1: (v.e / tot) * 100}}%;background:{{s2: mc[k] || '#C5A059'}}" title="{{s3: (nm[k] || [k])[0]}}: {{s4: fmt(v.e)}}">{{s5: v.e / tot = 0.1 ? Math.round((v.e…}}</i>`,
                  [
                    () => (v.e / tot) * 100,
                    () => mc[k] || "#C5A059",
                    () => (nm[k] || [k])[0],
                    () => fmt(v.e),
                    () => (v.e / tot >= 0.1 ? Math.round((v.e / tot) * 100) + "%" : ""),
                  ],
                ),
              )
              .join(""),
        ],
      ) +
        it
          .map(([k, v]) =>
            __tpl(
              "analytics:pRoute.3",
              `<div class="rt"><i style="background:{{s1: mc[k] || '#C5A059'}}"></i><div><b>{{s2: (nm[k] || [k, ''])[0]}}</b><small>{{s3: (nm[k] || ['', ''])[1]}}</small></div><div class="n"><b>{{s4: fmt(v.e)}}</b><small>{{s5: Math.round((v.e / tot) * 100)}}% · {{s6: v.n}} location{{s7: v.n == 1 ? '' : 's'}}</small></div></div>`,
              [
                () => mc[k] || "#C5A059",
                () => (nm[k] || [k, ""])[0],
                () => (nm[k] || ["", ""])[1],
                () => fmt(v.e),
                () => Math.round((v.e / tot) * 100),
                () => v.n,
                () => (v.n == 1 ? "" : "s"),
              ],
            ),
          )
          .join(""),
      "how people are recommended to travel",
    );
  }
  function pHeat() {
    const cols = [
        ["Easy to reach", /^easily/i],
        ["Accessible", /^accessible/i],
        ["Hard to reach", /in\s?a?c+ess|inacc/i],
        ["Not recorded", null],
      ],
      ph = [
        [1, "Phase 1", "low risk"],
        [2, "Phase 2", "medium risk"],
        [3, "Phase 3", "high risk"],
        [0, "Not classified", ""],
      ],
      SV = ["#16a56d", "#5aa84a", "#e29a0b", "#e8683a", "#d62f58"];
    const ci = (r) => {
      const a = String(r.c.ac || "");
      const i = cols.findIndex((c) => c[1] && c[1].test(a));
      return i < 0 ? 3 : i;
    };
    const sev = (p, c) => (p === 0 ? 1 : p - 1) + (c === 3 ? 1 : c),
      tot = sumOf(scopeRows, (r) => r.e) || 1;
    const cell = (p, c) => scopeRows.filter((r) => (r.ph || 0) === p && ci(r) === c);
    const mx = Math.max(
      1,
      ...ph.flatMap(([p]) => cols.map((_, c) => sumOf(cell(p, c), (r) => r.e))),
    );
    let hardE = 0;
    const g = "grid-template-columns:minmax(0,1.15fr) repeat(4,minmax(0,1fr)) minmax(0,.8fr)";
    let h = __tpl(
      "analytics:pHeat.2",
      `<div class="hm"><div class="r" style="{{s1: g}}"><span></span>{{s2: cols.map(…)}}<span class="hd">Total</span></div>`,
      [
        () => g,
        () =>
          cols
            .map((c) =>
              __tpl("analytics:pHeat.1", `<span class="hd">{{s1: c[0]}}</span>`, [() => c[0]]),
            )
            .join(""),
      ],
    );
    ph.forEach(([p, n, s]) => {
      const rt = sumOf(
        scopeRows.filter((r) => (r.ph || 0) === p),
        (r) => r.e,
      );
      h +=
        __tpl(
          "analytics:pHeat.3",
          `<div class="r" style="{{s1: g}}"><span class="rl"><span>{{s2: n}}<small>{{s3: s}}</small></span></span>`,
          [() => g, () => n, () => s],
        ) +
        cols
          .map((_, c) => {
            const m = cell(p, c),
              e = sumOf(m, (r) => r.e),
              sv = sev(p, c);
            if (sv >= 3) hardE += e;
            return m.length
              ? __tpl(
                  "analytics:pHeat.4",
                  `<div class="cl" style="background:{{s1: rgba(SV[sv], 0.14 + (0.5 * e) / m…}};box-shadow:inset 0 0 0 1px {{s2: rgba(SV[sv], 0.5)}}" title="{{s3: n}} + {{s4: cols[c][0]}}: {{s5: fmt(e)}} employees in {{s6: m.length}} locations"><b>{{s7: fmt(e)}}</b><small>{{s8: Math.round((e / tot) * 100)}}% · {{s9: m.length}} loc.</small></div>`,
                  [
                    () => rgba(SV[sv], 0.14 + (0.5 * e) / mx),
                    () => rgba(SV[sv], 0.5),
                    () => n,
                    () => cols[c][0],
                    () => fmt(e),
                    () => m.length,
                    () => fmt(e),
                    () => Math.round((e / tot) * 100),
                    () => m.length,
                  ],
                )
              : __tpl("analytics:pHeat.5", `<div class="cl" style="opacity:.45">–</div>`, []);
          })
          .join("") +
        __tpl("analytics:pHeat.6", `<div class="cl tt"><b>{{s1: fmt(rt)}}</b></div></div>`, [
          () => fmt(rt),
        ]);
    });
    h += __tpl(
      "analytics:pHeat.8",
      `<div class="r" style="{{s1: g}}"><span class="rl"><span>Total</span></span>{{s2: cols .map(…)}}<div class="cl tt"><b>{{s3: fmt(tot === 1 !scopeRows.length ?…}}</b></div></div></div>`,
      [
        () => g,
        () =>
          cols
            .map((_, c) =>
              __tpl(
                "analytics:pHeat.7",
                `<div class="cl tt"><b>{{s1: fmt( sumOf( scopeRows.filter((r)…}}</b></div>`,
                [
                  () =>
                    fmt(
                      sumOf(
                        scopeRows.filter((r) => ci(r) === c),
                        (r) => r.e,
                      ),
                    ),
                ],
              ),
            )
            .join(""),
        () => fmt(tot === 1 && !scopeRows.length ? 0 : sumOf(scopeRows, (r) => r.e)),
      ],
    );
    const lg = __tpl(
      "analytics:pHeat.9",
      `<div class="lgd"><span style="display:flex;align-items:center;gap:6px">Easier to deploy<span style="display:inline-block;width:120px;height:9px;border-radius:5px;background:linear-gradient(90deg,{{s1: SV.join(',')}})"></span>Harder to deploy</span></div>`,
      [() => SV.join(",")],
    );
    return panelHtml(
      "Security × access exposure",
      callout(
        __tpl(
          "analytics:pHeat.10",
          `<b>{{s1: fmt(hardE)}}</b> employees ({{s2: percentOf(hardE, tot)}}%) are in the red and orange cells, where security is risky and the location is hard to reach.`,
          [() => fmt(hardE), () => percentOf(hardE, tot)],
        ),
      ) +
        h +
        lg +
        '<p class="em" style="text-align:left;padding:8px 0 0">Rows are security phase, columns are how reachable the location is. Each box shows employees, share of the total and number of locations. Darker colour = more people.</p>',
    );
  }
  function tRisk() {
    const G = analysisState.agg(scopeRows),
      fm = {};
    scopeRows.forEach((r) => r.fl.forEach((f) => (fm[f] = (fm[f] || 0) + r.e)));
    let h = '<div class="ag c2">' + pHeat() + pRoute() + "</div>";
    h +=
      '<div class="ag c2">' +
      panelHtml(
        "What is blocking registration",
        Object.keys(fm).length
          ? hbars(
              Object.entries(fm)
                .sort((a, b) => b[1] - a[1])
                .map(([l, v]) => ({
                  l,
                  v,
                  c: "#d62f58",
                })),
            )
          : '<p class="em">No constraints recorded.</p>',
        "employees affected",
      );
    if (scope === "nat") {
      const S = DATA.map((d, i) => ({
        d,
        i,
        a: analysisState.agg(allScopeRows.filter((r) => r.si === i)),
      }))
        .filter((x) => x.a.n)
        .sort((x, y) => y.a.by.crit.emp / (y.a.emp || 1) - x.a.by.crit.emp / (x.a.emp || 1));
      h += panelHtml(
        "Critical share of workforce by state",
        hbars(
          S.map((x) => ({
            l: SH[x.d.n] || x.d.n,
            v: percentOf(x.a.by.crit.emp, x.a.emp),
            c: "#d62f58",
            k: x.i,
            t: x.d.n,
          })),
          (v) => v + "%",
        ),
        "click a bar",
      );
    } else
      h += panelHtml(
        "Security phase of locations",
        __tpl(
          "analytics:tRisk.2",
          `<div class="dn">{{s1: donut( [1, 2, 3, 0].map(…)}}<div style="flex:1;min-width:140px">{{s2: [ [1, 'Phase 1', '#16a56d'], [2,…}}</div></div>`,
          [
            () =>
              donut(
                [1, 2, 3, 0].map((p) => scopeRows.filter((r) => (r.ph || 0) === p).length),
                ["#16a56d", "#e29a0b", "#d62f58", "#C5A059"],
                scopeRows.length,
                "locations",
              ),
            () =>
              [
                [1, "Phase 1", "#16a56d"],
                [2, "Phase 2", "#e29a0b"],
                [3, "Phase 3", "#d62f58"],
                [0, "Not classified", "#C5A059"],
              ]
                .map(([p, n, c]) =>
                  __tpl(
                    "analytics:tRisk.1",
                    `<div class="hb" style="grid-template-columns:12px 1fr 40px"><i style="width:10px;height:10px;border-radius:50%;background:{{s1: c}}"></i><span>{{s2: n}}</span><b>{{s3: scopeRows.filter((r) = (r.ph || 0…}}</b></div>`,
                    [() => c, () => n, () => scopeRows.filter((r) => (r.ph || 0) === p).length],
                  ),
                )
                .join(""),
          ],
        ),
      );
    return h + "</div>";
  }
  function locRows() {
    let L = scopeRows.filter(
      (r) =>
        (filt === "all" || r.b.k === filt) &&
        (!siteQuickSearch || (r.c.n + " " + r.st).toLowerCase().includes(siteQuickSearch)),
    );
    const f = {
      n: (r) => r.c.n.toLowerCase(),
      st: (r) => r.st,
      e: (r) => r.e,
      score: (r) => r.score,
      ph: (r) => r.ph || 0,
    };
    L.sort((a, b) => {
      const x = f[siteSortKey](a),
        y = f[siteSortKey](b);
      return (x < y ? -1 : x > y ? 1 : 0) * siteSortDirection;
    });
    return L;
  }
  function locBody() {
    const L = locRows();
    selectOne("#loc-cnt").textContent = L.length + " of " + scopeRows.length + " locations";
    selectOne("#loc-tb").innerHTML = L.length
      ? L.map((r) =>
          __tpl(
            "analytics:locBody.1",
            `<tr class="clk" data-loc="{{s1: r.si}}|{{s2: esc(r.c.n)}}"><td><b>{{s3: esc(r.c.n)}}</b></td><td class="mu">{{s4: esc(SH[r.st] || r.st)}}</td><td class="n">{{s5: fmt(r.e)}}</td><td><span class="mini"><i style="width:{{s6: r.score}}%;background:{{s7: r.b.c}}"></i></span>{{s8: r.score}}</td><td>{{s9: chip(r.b)}}</td><td class="mu">{{s10: r.ph ? 'Phase ' + r.ph : 'n/c'}}</td><td class="mu">{{s11: esc(r.c.ac || '—')}}</td><td class="mu">{{s12: esc(r.mode)}}</td><td class="n mu" title="{{s13: esc([...new Set((r.sites || []).m…}}">{{s14: (r.sites || []).length || '—'}}</td><td class="mu">{{s15: esc(r.lead)}}</td></tr>`,
            [
              () => r.si,
              () => esc(r.c.n),
              () => esc(r.c.n),
              () => esc(SH[r.st] || r.st),
              () => fmt(r.e),
              () => r.score,
              () => r.b.c,
              () => r.score,
              () => chip(r.b),
              () => (r.ph ? "Phase " + r.ph : "n/c"),
              () => esc(r.c.ac || "—"),
              () => esc(r.mode),
              () => esc([...new Set((r.sites || []).map((s) => s.mda).filter(Boolean))].join(", ")),
              () => (r.sites || []).length || "—",
              () => esc(r.lead),
            ],
          ),
        ).join("")
      : '<tr><td colspan="10" class="em">No locations match.</td></tr>';
  }
  function tLoc() {
    const th = (k, t, n) =>
      __tpl(
        "analytics:th.1",
        `<th class="s{{s1: siteSortKey === k ? ' on' : ''}}{{s2: n ? ' n' : ''}}" data-sort="{{s3: k}}">{{s4: t}}{{s5: siteSortKey === k ? (siteSortDire…}}</th>`,
        [
          () => (siteSortKey === k ? " on" : ""),
          () => (n ? " n" : ""),
          () => k,
          () => t,
          () =>
            siteSortKey === k
              ? siteSortDirection > 0
                ? ' <i class="bx bx-caret-up"></i>'
                : ' <i class="bx bx-caret-down"></i>'
              : "",
        ],
      );
    return panelHtml(
      "All locations",
      __tpl(
        "analytics:tLoc.2",
        `<div class="fb"><input id="loc-q" placeholder="Search location or state…" value="{{s1: esc(siteQuickSearch)}}"><div class="chips" id="loc-f"><button data-f="all" class="{{s2: filt === 'all' ? 'on' : ''}}">All</button>{{s3: BANDS.map(…)}}</div><span class="cnt" id="loc-cnt"></span></div><div class="tw3"><table class="atb"><thead><tr>{{s4: th('n', 'Location')}}{{s5: th('st', 'State')}}{{s6: th('e', 'Employees', 1)}}{{s7: th('score', 'Readiness')}}<th>Status</th>{{s8: th('ph', 'Security')}}<th>Access</th><th>Route</th><th class="n">Sites</th><th>Main blocker</th></tr></thead><tbody id="loc-tb"></tbody></table></div>`,
        [
          () => esc(siteQuickSearch),
          () => (filt === "all" ? "on" : ""),
          () =>
            BANDS.map((b) =>
              __tpl(
                "analytics:tLoc.1",
                `<button data-f="{{s1: b.k}}" class="{{s2: filt === b.k ? 'on' : ''}}">{{s3: b.n}}</button>`,
                [() => b.k, () => (filt === b.k ? "on" : ""), () => b.n],
              ),
            ).join(""),
          () => th("n", "Location"),
          () => th("st", "State"),
          () => th("e", "Employees", 1),
          () => th("score", "Readiness"),
          () => th("ph", "Security"),
        ],
      ),
    );
  }
  function tDq() {
    const n = scopeRows.length,
      ok = (f) => scopeRows.filter(f).length;
    const chk = [
      ["Employee figure missing", ok((r) => !r.e), "No target to measure against"],
      ["Security phase not classified", ok((r) => !r.ph), "Scored conservatively"],
      [
        "Access not recorded",
        ok((r) => !/^(easily|accessible|in\s?a?c)/i.test(String(r.c.ac || ""))),
        "Scored as unknown",
      ],
      [
        "Recommendation missing or unclear",
        ok((r) => !r.c.rc || /not sure/i.test(String(r.c.rc))),
        "Travel route cannot be confirmed",
      ],
      [
        "Label spelling variants",
        ok(
          (r) =>
            (r.c.sf && !/^(safer|safe|unsafe|\?)$/i.test(r.c.sf)) ||
            (r.c.ac && !/^(easily accessible|accessible|inaccessible|\?)$/i.test(r.c.ac)),
        ),
        "Read correctly; fix at source",
      ],
    ];
    if (hasSites())
      chk.push([
        "No registration site mapped",
        ok((r) => !r.sites.length),
        "Site coverage cannot be assessed",
      ]);
    const G = analysisState.agg(scopeRows),
      w = hasSites() ? [35, 25, 15, 15, 10] : [39, 28, 17, 0, 11],
      names = [
        "Security phase",
        "Access",
        "Travel-route clarity",
        "Registration-site coverage",
        "Data completeness",
      ];
    let h =
      '<div class="ag c2">' +
      panelHtml(
        "Data checks",
        hbars(
          chk.map((x) => ({
            l: x[0],
            v: percentOf(x[1], n),
            c: x[1] ? "#e29a0b" : "#16a56d",
            t: x[2] + " · " + x[1] + " locations",
          })),
          (v) => v + "%",
        ) +
          bulletListHtml(
            chk
              .filter((x) => x[1])
              .map((x) =>
                __tpl(
                  "analytics:tDq.1",
                  `<b>{{s1: x[1]}}</b> location{{s2: x[1] == 1 ? '' : 's'}}: {{s3: esc(x[0].toLowerCase())}} — {{s4: esc(x[2])}}.`,
                  [
                    () => x[1],
                    () => (x[1] == 1 ? "" : "s"),
                    () => esc(x[0].toLowerCase()),
                    () => esc(x[2]),
                  ],
                ),
              ),
          ),
      ) +
      panelHtml(
        "How the readiness score works",
        __tpl(
          "analytics:tDq.3",
          `<div class="dn" style="align-items:flex-start">{{s1: donut( w.filter(Boolean), ['#a78b…}}<div style="flex:1;min-width:200px">{{s2: names.map(…)}}</div></div><p class="em" style="text-align:left">Each location scores 0–100. Bands: Ready ≥ 75 · Conditional 55–74 · At risk 35–54 · Critical &lt; 35. Area and state scores are weighted by employees. It is a planning aid, not an official rating.{{s3: hasSites() ? '' : ' No registrati…}}</p>`,
          [
            () =>
              donut(
                w.filter(Boolean),
                ["#C5A059", "#c9744a", "#5fcf9a", "#d9a441", "#e5594f"].filter((_, i) => w[i]),
                G.dq + "%",
                "complete",
              ),
            () =>
              names
                .map((t, i) =>
                  w[i]
                    ? __tpl(
                        "analytics:tDq.2",
                        `<div class="hb" style="grid-template-columns:1fr 44px"><span>{{s1: t}}</span><b>{{s2: w[i]}}%</b></div>`,
                        [() => t, () => w[i]],
                      )
                    : "",
                )
                .join(""),
            () =>
              hasSites()
                ? ""
                : " No registration sites are recorded, so site coverage is left out.",
          ],
        ),
      ) +
      "</div>";
    if (scope === "nat")
      h += panelHtml(
        "Completeness by state",
        hbars(
          DATA.map((d, i) => ({
            d,
            i,
            a: analysisState.agg(allScopeRows.filter((r) => r.si === i)),
          }))
            .filter((x) => x.a.n)
            .sort((x, y) => x.a.dq - y.a.dq)
            .map((x) => ({
              l: SH[x.d.n] || x.d.n,
              v: x.a.dq,
              c: scoreColor(x.a.dq),
              k: x.i,
              t: x.d.n,
            })),
          (v) => v + "%",
        ),
      );
    return h;
  }
  const T = {
    ov: tOv,
    dep: tDep,
    risk: tRisk,
    loc: tLoc,
    sites: tSites,
    dq: tDq,
  };
  function render(keep) {
    const y = keep ? body.scrollTop : 0;
    calc();
    tabsEl.innerHTML = TABS.map(([k, t]) =>
      __tpl(
        "analytics:render.1",
        `<button data-t="{{s1: k}}" class="{{s2: tab === k ? 'on' : ''}}">{{s3: t}}</button>`,
        [() => k, () => (tab === k ? "on" : ""), () => t],
      ),
    ).join("");
    analyticsContent.innerHTML = T[tab]();
    if (tab === "loc") locBody();
    if (tab === "sites") siteBody();
    body.scrollTop = y;
  }
  /* ---------- drawer ---------- */
  function openLoc(si, name) {
    const r = allScopeRows.find((x) => x.si === +si && x.c.n === name);
    if (!r) return;
    const w = hasSites() ? [35, 25, 15, 15, 10] : [39, 28, 17, 0, 11],
      c = r.c;
    const f = [
      [
        "Security phase",
        r.sec,
        w[0],
        c.ph ? "Phase " + c.ph + " · " + (c.st || "") : "Not classified",
      ],
      ["Access", r.acc, w[1], c.ac || "Not recorded"],
      ["Travel-route clarity", r.path, w[2], c.rc || "No recommendation recorded"],
    ];
    if (hasSites())
      f.push([
        "Registration-site coverage",
        r.site,
        w[3],
        r.sites.length
          ? r.sites.length + " site" + (r.sites.length == 1 ? "" : "s") + " mapped"
          : "No site mapped",
      ]);
    f.push(["Data completeness", r.data, w[4], r.data + "% of key fields recorded"]);
    analyticsDrawer.innerHTML = __tpl(
      "analytics:openLoc.2",
      `<div style="display:flex;justify-content:space-between;gap:10px"><div><h3>{{s1: esc(c.n)}}</h3><div class="sub">{{s2: esc(r.st)}} · {{s3: fmt(r.e)}} employees</div></div><button class="btn" id="drw-x" style="margin:0;height:34px"><i class="bx bx-x"></i></button></div><div class="gp">{{s4: gauge(r.score)}}</div><div>{{s5: chip(r.b)}} <span class="sub">{{s6: r.fl.length ? 'Constraints: ' + r…}}</span></div>
 <div><h2>What drives the score</h2>{{s7: f.map(…)}}</div>
 {{s8: siteList(r)}}<div><h2>Next steps</h2>{{s9: bulletListHtml(analysisState.acti…}}</div><button class="btn pri" id="drw-map" style="margin:0">Show state on map</button>`,
      [
        () => esc(c.n),
        () => esc(r.st),
        () => fmt(r.e),
        () => gauge(r.score),
        () => chip(r.b),
        () =>
          r.fl.length
            ? "Constraints: " + r.fl.map(esc).join(" · ")
            : "No major constraint recorded.",
        () =>
          f
            .map((x) =>
              __tpl(
                "analytics:openLoc.1",
                `<div class="fr"><b>{{s1: x[0]}}</b><span>{{s2: x[1]}} <span class="sub">· weight {{s3: x[2]}}%</span></span><div class="bar"><i style="width:{{s4: x[1]}}%;background:{{s5: scoreColor(x[1])}}"></i></div><span class="ev">{{s6: esc(x[3])}}</span></div>`,
                [
                  () => x[0],
                  () => x[1],
                  () => x[2],
                  () => x[1],
                  () => scoreColor(x[1]),
                  () => esc(x[3]),
                ],
              ),
            )
            .join(""),
        () => siteList(r),
        () => bulletListHtml(analysisState.actions(analysisState.agg([r]), c.n)),
      ],
    );
    analyticsDrawer.hidden = false;
    selectOne("#drw-x").onclick = () => (analyticsDrawer.hidden = true);
    selectOne("#drw-map").onclick = () => {
      close();
      pick(r.si);
      zoomState(r.si);
      selectOne("#mapsec").scrollIntoView({
        behavior: "smooth",
      });
    };
  }
  /* ---------- sites code ---------- */
  /* ---------- registration sites by MDA ---------- */
  let mdaF = "all",
    mdaGroupBy = "tg",
    siteSearchText = "",
    siteScopeKey = "tg",
    siteScopeDirection = -1;
  const MPAL = [
    "#C5A059",
    "#c9744a",
    "#5fcf9a",
    "#d9a441",
    "#e5594f",
    "#9c94c5",
    "#c58bff",
    "#9be15d",
  ];
  function siteRows() {
    const DLY = window.__dly();
    return SITES.map((s, i) => {
      let si = s._st ? DATA.findIndex((d) => K(d.n) === K(s._st)) : stAt(s.lon, s.lat),
        c = null,
        cn = "—";
      if (si < 0 && s._st)
        si = DATA.findIndex((d) => K(d.n).includes(K(s._st)) || K(s._st).includes(K(d.n)));
      if (si >= 0) {
        if (s._cn) cn = s._cn;
        else {
          c = cntyNear(s.lon, s.lat, si);
          cn = c ? c.n : "—";
        }
      }
      const ex = !!s._excelKey,
        dr = DLY.get(s.id),
        rg = dr ? dr.n : s.registered == null || s.registered === "" ? null : +s.registered;
      return {
        s,
        i,
        name: s.name || "Site",
        mda: String(s.mda || "").trim() || "Not assigned",
        st: si,
        stn: si >= 0 ? DATA[si].n : "Unplaced",
        cn,
        status: s.status || "Planned",
        tg: ex ? +s.cap || 0 : 0,
        cap: ex ? 0 : +s.cap || 0,
        rg,
        ok: dr ? dr.ok : 0,
        pend: dr ? dr.pend : 0,
        fail: dr ? dr.fail : 0,
        hasDr: !!dr,
      };
    });
  }
  const inScope = (x) =>
    scope === "nat" || (x.st === +scope && (!selectedCounty || x.cn === selectedCounty));
  function mdaAgg(rows) {
    const m = new Map();
    rows.forEach((x) => {
      let a = m.get(x.mda);
      if (!a) {
        a = {
          mda: x.mda,
          n: 0,
          tg: 0,
          rg: 0,
          ok: 0,
          pend: 0,
          fail: 0,
          hasRg: false,
          areas: new Set(),
          act: 0,
        };
        m.set(x.mda, a);
      }
      a.n++;
      a.tg += x.tg;
      a.ok += x.ok || 0;
      a.pend += x.pend || 0;
      a.fail += x.fail || 0;
      if (x.rg != null) {
        a.rg += x.rg;
        a.hasRg = true;
      }
      a.areas.add(scope === "nat" ? x.stn : x.cn);
      if (x.status === "Active") a.act++;
    });
    return [...m.values()];
  }
  function mbars(items, fv, sel) {
    const mx = Math.max(...items.map((i) => i.v), 1);
    return items.length
      ? items
          .map((i) =>
            __tpl(
              "analytics:mbars.1",
              `<div class="hb{{s1: i.mda ? ' clk' : ''}}{{s2: sel sel === i.mda ? ' msel' : ''}}"{{s3: i.mda ? …}} style="grid-template-columns:minmax(150px,250px) 1fr 62px" title="{{s4: esc(i.t || i.l)}}"><span class="hl">{{s5: esc(i.l)}}</span><span class="ht"><i style="width:{{s6: Math.max(2, (i.v / mx) * 100)}}%;background:{{s7: i.c}}"></i></span><b>{{s8: fv(i.v)}}</b></div>`,
              [
                () => (i.mda ? " clk" : ""),
                () => (sel && sel === i.mda ? " msel" : ""),
                () => (i.mda ? ` data-mda="${esc(i.mda)}"` : ""),
                () => esc(i.t || i.l),
                () => esc(i.l),
                () => Math.max(2, (i.v / mx) * 100),
                () => i.c,
                () => fv(i.v),
              ],
            ),
          )
          .join("")
      : '<p class="em">No data.</p>';
  }
  function tSites() {
    const all = siteRows(),
      base = all.filter(inScope),
      rows = base.filter((x) => mdaF === "all" || x.mda === mdaF);
    if (!SITES.length)
      return panelHtml(
        "Registration sites",
        '<p class="em">No registration sites are recorded yet. Add them in the admin page and they will appear here with their MDAs.</p>',
      );
    const tg = sumOf(rows, (x) => x.tg),
      hasRg = rows.some((x) => x.rg != null),
      rg = sumOf(rows, (x) => x.rg || 0),
      mdas = mdaAgg(rows);
    const areas = new Set(rows.map((x) => (scope === "nat" ? x.stn : x.cn))),
      totAreas = scope === "nat" ? DATA.filter((d) => d.cty.length).length : scopeRows.length;
    const lab = scope === "nat" ? "states" : "locations";
    const top = mdas.slice().sort((a, b) => b.tg - a.tg)[0];
    let h = "";
    if (mdaF !== "all")
      h += __tpl(
        "analytics:tSites.1",
        `<div class="cal">Showing one MDA: <b>{{s1: esc(mdaF)}}</b> <button class="btn" id="md-clear" style="margin:0 0 0 10px;height:28px;padding:0 12px">Show all MDAs <i class="bx bx-x"></i></button></div>`,
        [() => esc(mdaF)],
      );
    h +=
      '<div class="ag kg2">' +
      kpiCardHtml("Registration sites", fmt(rows.length), esc(label()), 100) +
      kpiCardHtml(
        "MDAs covered",
        fmt(mdas.length),
        mdaF === "all" ? "ministries, commissions and services" : "selected MDA",
        100,
        "#c9744a",
      ) +
      kpiCardHtml(
        "Employee target",
        fmt(tg),
        top && mdaF === "all"
          ? "largest: " + esc(top.mda.length > 34 ? top.mda.slice(0, 32) + "…" : top.mda)
          : "across mapped sites",
        100,
        "#5fcf9a",
      ) +
      kpiCardHtml(
        "Registered so far",
        hasRg ? fmt(rg) : "—",
        hasRg
          ? (tg ? percentOf(rg, tg) + "% of target" : "from daily reports") +
              " \u00b7 " +
              fmt(sumOf(rows, (x) => x.ok)) +
              " completed"
          : "no daily report yet",
        hasRg ? percentOf(rg, tg) : 0,
        "#d9a441",
      ) +
      kpiCardHtml(
        "Area coverage",
        percentOf(areas.size, totAreas) + "%",
        areas.size + " of " + totAreas + " " + lab + " have sites",
        percentOf(areas.size, totAreas),
        "#e5594f",
      ) +
      "</div>";
    /* MDA ranking */
    const ma = mdaAgg(base),
      mk = mdaGroupBy === "n" ? "n" : "tg",
      ord = ma.slice().sort((a, b) => b[mk] - a[mk] || b.n - a.n),
      TOP = 14,
      shown = ord.slice(0, TOP),
      rest = ord.slice(TOP);
    const items = shown.map((a, i) => ({
      l: a.mda,
      v: a[mk],
      c: MPAL[i % MPAL.length],
      mda: a.mda,
      t: a.mda + " · " + a.n + " sites · " + fmt(a.tg) + " employees · " + a.areas.size + " " + lab,
    }));
    if (rest.length)
      items.push({
        l: "Other (" + rest.length + " MDAs)",
        v: sumOf(rest, (a) => a[mk]),
        c: "#C5A059",
        t: rest.map((a) => a.mda).join(", "),
      });
    const chips = __tpl(
      "analytics:tSites.2",
      `<div class="chips" id="md-by"><button data-by="tg" class="{{s1: mdaGroupBy === 'tg' ? 'on' : ''}}">Employee target</button><button data-by="n" class="{{s2: mdaGroupBy === 'n' ? 'on' : ''}}">Number of sites</button></div>`,
      [() => (mdaGroupBy === "tg" ? "on" : ""), () => (mdaGroupBy === "n" ? "on" : "")],
    );
    h +=
      '<div class="ag c21">' +
      panelHtml(
        "Registration sites by MDA",
        chips + '<div style="height:10px"></div>' + mbars(items, fmt, mdaF !== "all" ? mdaF : ""),
        "click an MDA to focus",
      ) +
      panelHtml(
        scope === "nat" ? "Sites by state" : "Sites by location",
        (() => {
          const m = {};
          rows.forEach((x) => {
            const k = scope === "nat" ? x.stn : x.cn;
            m[k] = m[k] || {
              n: 0,
              tg: 0,
              si: x.st,
            };
            m[k].n++;
            m[k].tg += x.tg;
          });
          const it = Object.entries(m)
            .sort((a, b) => b[1].n - a[1].n)
            .slice(0, 16)
            .map(([k, v]) => ({
              l: scope === "nat" ? SH[k] || k : k,
              v: v.n,
              c: "#c9744a",
              k: scope === "nat" && v.si >= 0 ? v.si : null,
              t: k + " · " + v.n + " sites · " + fmt(v.tg) + " employees",
            }));
          return hbars(it);
        })(),
        scope === "nat" ? "click a bar" : "",
      ) +
      "</div>";
    /* status + completion */
    const stc = {
      Planned: 0,
      Active: 0,
      Closed: 0,
    };
    rows.forEach((x) => {
      stc[x.status] = (stc[x.status] || 0) + 1;
    });
    const SC = [
      ["Planned", "#e29a0b"],
      ["Active", "#16a56d"],
      ["Closed", "#C5A059"],
    ].filter(([k]) => stc[k] != null);
    const dts = panelHtml(
      "Site status",
      __tpl(
        "analytics:tSites.4",
        `<div class="dn">{{s1: donut( SC.map(…)}}<div style="flex:1;min-width:130px">{{s2: SC.map(…)}}</div></div><p class="em" style="text-align:left;padding-top:8px">{{s3: stc.Active ? '' : 'No site is mar…}}Change a site's status in the admin page when it opens.</p>`,
        [
          () =>
            donut(
              SC.map(([k]) => stc[k]),
              SC.map((x) => x[1]),
              rows.length,
              "sites",
            ),
          () =>
            SC.map(([k, c]) =>
              __tpl(
                "analytics:tSites.3",
                `<div class="hb" style="grid-template-columns:12px 1fr 40px"><i style="width:10px;height:10px;border-radius:50%;background:{{s1: c}}"></i><span>{{s2: k}}</span><b>{{s3: stc[k]}}</b></div>`,
                [() => c, () => k, () => stc[k]],
              ),
            ).join(""),
          () => (stc.Active ? "" : "No site is marked Active yet. "),
        ],
      ),
    );
    const sz = [
        [1, 1, "1 site"],
        [2, 3, "2–3 sites"],
        [4, 9, "4–9 sites"],
        [10, 1e9, "10+ sites"],
      ],
      per = {};
    rows.forEach((x) => {
      const k = scope === "nat" ? x.stn : x.cn;
      per[k] = (per[k] || 0) + 1;
    });
    const dist =
      panelHtml(
        "Sites per " + (scope === "nat" ? "state" : "location"),
        hbars(
          sz.map(([a, b, t], i) => ({
            l: t,
            v: Object.values(per).filter((n) => n >= a && n <= b).length,
            c: MPAL[i],
          })),
        ),
        "how many areas",
      ) + "";
    const TK = sumOf(rows, (x) => x.ok),
      TP = sumOf(rows, (x) => x.pend),
      TF = sumOf(rows, (x) => x.fail),
      TKT = TK + TP + TF;
    const prog =
      panelHtml(
        "Registration status",
        TKT
          ? __tpl(
              "analytics:tSites.6",
              `<div class="dn">{{s1: donut([TK, TP, TF], ['#16a56d', '…}}<div style="flex:1;min-width:130px">{{s2: [ ['Completed', TK, '#16a56d'], […}}</div></div><p class="em" style="text-align:left;padding-top:8px">From the daily reports of the sites shown.</p>`,
              [
                () =>
                  donut([TK, TP, TF], ["#16a56d", "#C5A059", "#e5484d"], fmt(TKT), "registered"),
                () =>
                  [
                    ["Completed", TK, "#16a56d"],
                    ["Pending", TP, "#C5A059"],
                    ["Failed", TF, "#e5484d"],
                  ]
                    .map(([k, v, c]) =>
                      __tpl(
                        "analytics:tSites.5",
                        `<div class="hb" style="grid-template-columns:12px 1fr 60px"><i style="width:10px;height:10px;border-radius:50%;background:{{s1: c}}"></i><span>{{s2: k}}</span><b>{{s3: fmt(v)}}</b></div>`,
                        [() => c, () => k, () => fmt(v)],
                      ),
                    )
                    .join(""),
              ],
            )
          : '<p class="em">No daily report has been submitted for the sites shown yet.</p>',
        "completed \u00b7 pending \u00b7 failed",
      ) + "";
    const prog_old = panelHtml(
      "Registration progress",
      hasRg
        ? mbars(
            mdas
              .filter((a) => a.hasRg || a.tg)
              .sort((a, b) => b.tg - a.tg)
              .slice(0, 10)
              .map((a, i) => ({
                l: a.mda,
                v: a.tg ? Math.round((a.rg / a.tg) * 100) : 0,
                c: "#d9a441",
                t: fmt(a.rg) + " of " + fmt(a.tg),
              })),
            (v) => v + "%",
          )
        : __tpl(
            "analytics:tSites.7",
            `<div class="cal">No registered counts have been entered yet, so progress is 0%. When registrations are recorded per site, completion by MDA will appear here.</div><p class="em" style="text-align:left">Target employees on mapped sites: <b>{{s1: fmt(tg)}}</b>.</p>`,
            [() => fmt(tg)],
          ),
      "registered ÷ target",
    );
    h += '<div class="ag c3">' + dts + dist + prog + "</div>";
    {
      const TR = mdas
          .slice()
          .sort((a, b) => (b.rg || 0) - (a.rg || 0) || (b.tg || 0) - (a.tg || 0)),
        seg = (v, t, c) =>
          t
            ? __tpl(
                "analytics:seg.1",
                `<i style="display:block;height:100%;width:{{s1: Math.min(100, (v / t) * 100).toFi…}}%;background:{{s2: c}}"></i>`,
                [() => Math.min(100, (v / t) * 100).toFixed(2), () => c],
              )
            : "";
      h += panelHtml(
        "Registration progress by MDA \u2014 track",
        __tpl(
          "analytics:tSites.9",
          `<div class="tw3"><table class="atb"><thead><tr><th>MDA</th><th class="n">Sites</th><th class="n">Employee target</th><th class="n">Registered</th><th class="n">Completed</th><th class="n">Pending</th><th class="n">Failed</th><th style="min-width:220px">Progress (completed · pending · failed)</th></tr></thead><tbody>{{s1: TR.map(…)}}</tbody><tfoot><tr><td><b>Total</b></td><td class="n">{{s2: rows.length}}</td><td class="n">{{s3: fmt(tg)}}</td><td class="n">{{s4: hasRg ? fmt(rg) : '\\u2014'}}</td><td class="n">{{s5: fmt(TK)}}</td><td class="n">{{s6: fmt(TP)}}</td><td class="n">{{s7: fmt(TF)}}</td><td></td></tr></tfoot></table></div><p class="em" style="text-align:left;padding-top:8px">Registered numbers come from the daily reports submitted for each registration site (rejected reports are left out). Completion = completed ÷ employee target. Click an MDA to focus on it.</p>`,
          [
            () =>
              TR.map((a) => {
                const t = a.tg || a.ok + a.pend + a.fail || 1;
                return __tpl(
                  "analytics:tSites.8",
                  `<tr class="clk" data-mda="{{s1: esc(a.mda)}}"><td><b>{{s2: esc(a.mda)}}</b></td><td class="n">{{s3: a.n}}</td><td class="n">{{s4: a.tg ? fmt(a.tg) : '\\u2014'}}</td><td class="n">{{s5: a.hasRg ? fmt(a.rg) : '\\u2014'}}</td><td class="n">{{s6: fmt(a.ok)}}</td><td class="n">{{s7: fmt(a.pend)}}</td><td class="n">{{s8: fmt(a.fail)}}</td><td><div style="display:flex;align-items:center;gap:8px"><div style="flex:1;display:flex;height:10px;border-radius:6px;overflow:hidden;background:rgba(127,127,160,.2)">{{s9: seg(a.ok, t, '#16a56d')}}{{s10: seg(a.pend, t, '#C5A059')}}{{s11: seg(a.fail, t, '#e5484d')}}</div><b style="width:42px;text-align:right">{{s12: a.tg ? percentOf(a.ok, a.tg) + '%…}}</b></div></td></tr>`,
                  [
                    () => esc(a.mda),
                    () => esc(a.mda),
                    () => a.n,
                    () => (a.tg ? fmt(a.tg) : "\u2014"),
                    () => (a.hasRg ? fmt(a.rg) : "\u2014"),
                    () => fmt(a.ok),
                    () => fmt(a.pend),
                    () => fmt(a.fail),
                    () => seg(a.ok, t, "#16a56d"),
                    () => seg(a.pend, t, "#C5A059"),
                    () => seg(a.fail, t, "#e5484d"),
                    () => (a.tg ? percentOf(a.ok, a.tg) + "%" : "\u2014"),
                  ],
                );
              }).join(""),
            () => rows.length,
            () => fmt(tg),
            () => (hasRg ? fmt(rg) : "\u2014"),
            () => fmt(TK),
            () => fmt(TP),
            () => fmt(TF),
          ],
        ),
      );
    }
    /* heatmap MDA x area */
    const cols =
      scope === "nat"
        ? DATA.map((d, i) => ({
            k: d.n,
            l: SH[d.n] || d.n,
          })).filter((c) => rows.some((x) => x.stn === c.k))
        : [...new Set(rows.map((x) => x.cn))].sort().map((n) => ({
            k: n,
            l: n,
          }));
    const rowsM = mdaAgg(rows)
        .sort((a, b) => b.n - a.n)
        .slice(0, 14),
      cell = {};
    rows.forEach((x) => {
      const k = x.mda + "|" + (scope === "nat" ? x.stn : x.cn);
      cell[k] = cell[k] || {
        n: 0,
        tg: 0,
      };
      cell[k].n++;
      cell[k].tg += x.tg;
    });
    const mxc = Math.max(1, ...Object.values(cell).map((c) => c.n)),
      g = `grid-template-columns:minmax(150px,240px) repeat(${cols.length},minmax(44px,1fr)) 54px`;
    let hm = __tpl(
      "analytics:tSites.11",
      `<div class="mxs"><div class="r" style="{{s1: g}}"><span></span>{{s2: cols.map(…)}}<span class="hd">Total</span></div>`,
      [
        () => g,
        () =>
          cols
            .map((c) =>
              __tpl(
                "analytics:tSites.10",
                `<span class="hd" title="{{s1: esc(c.k)}}">{{s2: esc(c.l)}}</span>`,
                [() => esc(c.k), () => esc(c.l)],
              ),
            )
            .join(""),
      ],
    );
    rowsM.forEach((a) => {
      hm +=
        __tpl(
          "analytics:tSites.12",
          `<div class="r" style="{{s1: g}}"><span class="rl clk" data-mda="{{s2: esc(a.mda)}}" title="{{s3: esc(a.mda)}}">{{s4: esc(a.mda)}}</span>`,
          [() => g, () => esc(a.mda), () => esc(a.mda), () => esc(a.mda)],
        ) +
        cols
          .map((c) => {
            const v = cell[a.mda + "|" + c.k];
            return v
              ? __tpl(
                  "analytics:tSites.13",
                  `<div class="cl" style="background:rgba(167,139,250,{{s1: (0.14 + (0.7 * v.n) / mxc).toFixe…}})" title="{{s2: esc(a.mda)}} · {{s3: esc(c.k)}}: {{s4: v.n}} sites · {{s5: fmt(v.tg)}} employees"><b>{{s6: v.n}}</b></div>`,
                  [
                    () => (0.14 + (0.7 * v.n) / mxc).toFixed(2),
                    () => esc(a.mda),
                    () => esc(c.k),
                    () => v.n,
                    () => fmt(v.tg),
                    () => v.n,
                  ],
                )
              : '<div class="cl" style="opacity:.35">–</div>';
          })
          .join("") +
        __tpl("analytics:tSites.14", `<div class="cl tt"><b>{{s1: a.n}}</b></div></div>`, [
          () => a.n,
        ]);
    });
    hm += "</div>";
    h += panelHtml(
      "MDA × " + (scope === "nat" ? "state" : "location") + " — number of sites",
      hm +
        __tpl(
          "analytics:tSites.15",
          `<p class="em" style="text-align:left;padding-top:8px">{{s1: mdas.length 14 ? 'Showing the 14…}}Each box is the number of registration sites an MDA has in that area. Darker = more sites.</p>`,
          [() => (mdas.length > 14 ? "Showing the 14 MDAs with the most sites. " : "")],
        ),
    );
    /* table */
    const mlist = mdaAgg(base).sort((a, b) => a.mda.localeCompare(b.mda));
    const th = (k, t, n) =>
      __tpl(
        "analytics:th.2",
        `<th class="s{{s1: siteScopeKey === k ? ' on' : ''}}{{s2: n ? ' n' : ''}}" data-sort2="{{s3: k}}">{{s4: t}}{{s5: siteScopeKey === k ? (siteScopeDi…}}</th>`,
        [
          () => (siteScopeKey === k ? " on" : ""),
          () => (n ? " n" : ""),
          () => k,
          () => t,
          () =>
            siteScopeKey === k
              ? siteScopeDirection > 0
                ? ' <i class="bx bx-caret-up"></i>'
                : ' <i class="bx bx-caret-down"></i>'
              : "",
        ],
      );
    h += panelHtml(
      "Registration sites and their MDAs",
      __tpl(
        "analytics:tSites.17",
        `<div class="fb"><input id="st-q" placeholder="Search site, MDA, state or county…" value="{{s1: esc(siteSearchText)}}"><select id="st-mda" aria-label="MDA"><option value="all">All MDAs ({{s2: base.length}})</option>{{s3: mlist.map(…)}}</select><span class="cnt" id="st-cnt"></span></div><div class="tw3"><table class="atb"><thead><tr>{{s4: th('name', 'Site')}}{{s5: th('mda', 'MDA')}}{{s6: th('stn', 'State')}}{{s7: th('cn', 'County')}}<th>Status</th>{{s8: th('tg', 'Employee target', 1)}}{{s9: th('rg', 'Registered', 1)}}<th class="n">Completion</th></tr></thead><tbody id="st-tb"></tbody></table></div>`,
        [
          () => esc(siteSearchText),
          () => base.length,
          () =>
            mlist
              .map((a) =>
                __tpl(
                  "analytics:tSites.16",
                  `<option value="{{s1: esc(a.mda)}}"{{s2: a.mda === mdaF ? ' selected' : ''}}>{{s3: esc(a.mda)}} ({{s4: a.n}})</option>`,
                  [
                    () => esc(a.mda),
                    () => (a.mda === mdaF ? " selected" : ""),
                    () => esc(a.mda),
                    () => a.n,
                  ],
                ),
              )
              .join(""),
          () => th("name", "Site"),
          () => th("mda", "MDA"),
          () => th("stn", "State"),
          () => th("cn", "County"),
          () => th("tg", "Employee target", 1),
          () => th("rg", "Registered", 1),
        ],
      ),
    );
    return h;
  }
  function siteBody() {
    const all = siteRows()
      .filter(inScope)
      .filter((x) => mdaF === "all" || x.mda === mdaF);
    let L = all.filter(
      (x) =>
        !siteSearchText ||
        (x.name + " " + x.mda + " " + x.stn + " " + x.cn).toLowerCase().includes(siteSearchText),
    );
    const f = {
      name: (x) => x.name.toLowerCase(),
      mda: (x) => x.mda.toLowerCase(),
      stn: (x) => x.stn,
      cn: (x) => x.cn.toLowerCase(),
      tg: (x) => x.tg,
      rg: (x) => (x.rg == null ? -1 : x.rg),
    };
    L.sort((a, b) => {
      const x = f[siteScopeKey](a),
        y = f[siteScopeKey](b);
      return (x < y ? -1 : x > y ? 1 : 0) * siteScopeDirection;
    });
    selectOne("#st-cnt").textContent = L.length + " of " + all.length + " sites";
    const stc = {
      Planned: "#e29a0b",
      Active: "#16a56d",
      Closed: "#C5A059",
    };
    selectOne("#st-tb").innerHTML = L.length
      ? L.slice(0, 500)
          .map((x) => {
            const si = x.st,
              ok = si >= 0 && DATA[si].cty.some((c) => c.n === x.cn);
            return __tpl(
              "analytics:siteBody.1",
              `<tr{{s1: ok ? …}}><td><b>{{s2: esc(x.name)}}</b></td><td>{{s3: esc(x.mda)}}</td><td class="mu">{{s4: esc(SH[x.stn] || x.stn)}}</td><td class="mu">{{s5: esc(x.cn)}}</td><td><span class="achip" style="background:{{s6: rgba(stc[x.status] || '#C5A059',…}};color:{{s7: stc[x.status] || '#C5A059'}}">{{s8: esc(x.status)}}</span></td><td class="n">{{s9: x.tg ? fmt(x.tg) : '—'}}</td><td class="n">{{s10: x.rg == null ? '—' : fmt(x.rg)}}</td><td class="n">{{s11: x.tg x.rg != null ? percentOf(x.r…}}</td></tr>`,
              [
                () => (ok ? ` class="clk" data-loc="${si}|${esc(x.cn)}"` : ""),
                () => esc(x.name),
                () => esc(x.mda),
                () => esc(SH[x.stn] || x.stn),
                () => esc(x.cn),
                () => rgba(stc[x.status] || "#C5A059", 0.18),
                () => stc[x.status] || "#C5A059",
                () => esc(x.status),
                () => (x.tg ? fmt(x.tg) : "—"),
                () => (x.rg == null ? "—" : fmt(x.rg)),
                () => (x.tg && x.rg != null ? percentOf(x.rg, x.tg) + "%" : "—"),
              ],
            );
          })
          .join("")
      : '<tr><td colspan="8" class="em">No sites match.</td></tr>';
  }
  function siteList(r) {
    const L = r.sites || [];
    if (!L.length)
      return __tpl(
        "analytics:siteList.1",
        `<div><h2>Registration sites</h2><p class="sub">No registration site is mapped in {{s1: esc(r.c.n)}} yet.</p></div>`,
        [() => esc(r.c.n)],
      );
    const g = new Map();
    L.forEach((s) => {
      const m = String(s.mda || "").trim() || "Not assigned";
      const a = g.get(m) || {
        n: 0,
        tg: 0,
        names: [],
      };
      a.n++;
      a.tg += s._excelKey ? +s.cap || 0 : 0;
      a.names.push(s.name);
      g.set(m, a);
    });
    const tgt = sumOf(L, (s) => (s._excelKey ? +s.cap || 0 : 0));
    return __tpl(
      "analytics:siteList.5",
      `<div><h2>Registration sites <span class="sub">· {{s1: L.length}} site{{s2: L.length == 1 ? '' : 's'}} · {{s3: g.size}} MDA{{s4: g.size == 1 ? '' : 's'}}{{s5: tgt ? ' · ' + fmt(tgt) + ' employ…}}</span></h2>{{s6: [ ...g.entries(), ] .sort((a, b)…}}{{s7: g.size 12 ? …}}</div>`,
      [
        () => L.length,
        () => (L.length == 1 ? "" : "s"),
        () => g.size,
        () => (g.size == 1 ? "" : "s"),
        () => (tgt ? " · " + fmt(tgt) + " employee" + (tgt == 1 ? "" : "s") : ""),
        () =>
          [...g.entries()]
            .sort((a, b) => b[1].n - a[1].n)
            .slice(0, 12)
            .map(([m, a]) =>
              __tpl(
                "analytics:siteList.3",
                `<div class="fr"><b>{{s1: esc(m)}}</b><span>{{s2: a.n}} site{{s3: a.n == 1 ? '' : 's'}}{{s4: a.tg ? …}}</span><span class="ev">{{s5: esc(a.names.slice(0, 3).join(', '…}}{{s6: a.names.length 3 ? ' +' + (a.name…}}</span></div>`,
                [
                  () => esc(m),
                  () => a.n,
                  () => (a.n == 1 ? "" : "s"),
                  () =>
                    a.tg
                      ? __tpl(
                          "analytics:siteList.2",
                          ` <span class="sub">· {{s1: fmt(a.tg)}} employee{{s2: a.tg == 1 ? '' : 's'}}</span>`,
                          [() => fmt(a.tg), () => (a.tg == 1 ? "" : "s")],
                        )
                      : "",
                  () => esc(a.names.slice(0, 3).join(", ")),
                  () => (a.names.length > 3 ? " +" + (a.names.length - 3) + " more" : ""),
                ],
              ),
            )
            .join(""),
        () =>
          g.size > 12
            ? __tpl("analytics:siteList.4", `<p class="sub">+{{s1: g.size - 12}} more MDAs</p>`, [
                () => g.size - 12,
              ])
            : "",
      ],
    );
  }
  analyticsContent.addEventListener("click", (e) => {
    const m = e.target.closest("[data-mda]");
    if (m && tab === "sites") {
      const v = m.dataset.mda;
      mdaF = mdaF === v ? "all" : v;
      render(true);
      return;
    }
    if (e.target.id === "md-clear") {
      mdaF = "all";
      render(true);
      return;
    }
    const by = e.target.closest("#md-by button");
    if (by) {
      mdaGroupBy = by.dataset.by;
      render(true);
      return;
    }
    const th2 = e.target.closest("th[data-sort2]");
    if (th2) {
      const k = th2.dataset.sort2;
      if (siteScopeKey === k) siteScopeDirection = -siteScopeDirection;
      else {
        siteScopeKey = k;
        siteScopeDirection = k === "name" || k === "mda" || k === "stn" || k === "cn" ? 1 : -1;
      }
      render(true);
    }
  });
  analyticsContent.addEventListener("input", (e) => {
    if (e.target.id === "st-q") {
      siteSearchText = e.target.value.trim().toLowerCase();
      siteBody();
    }
  });
  analyticsContent.addEventListener("change", (e) => {
    if (e.target.id === "st-mda") {
      mdaF = e.target.value;
      render(true);
    }
  });

  /* ---------- events ---------- */
  tabsEl.onclick = (e) => {
    const b = e.target.closest("button");
    if (b) {
      tab = b.dataset.t;
      analyticsDrawer.hidden = true;
      render();
    }
  };
  scopeSelect.onchange = () => {
    mdaF = "all";
    scope = scopeSelect.value;
    selectedCounty = "";
    phSt = null;
    calc();
    syncCty();
    analyticsDrawer.hidden = true;
    render();
  };
  ctySel.onchange = () => {
    mdaF = "all";
    selectedCounty = ctySel.value;
    analyticsDrawer.hidden = true;
    render();
  };
  analyticsContent.addEventListener("click", (e) => {
    const pb = e.target.closest("[data-ph]");
    if (pb) {
      phSt = +pb.dataset.ph;
      render();
      return;
    }
    if (e.target.closest("[data-phback]")) {
      phSt = null;
      render();
      return;
    }
    const s = e.target.closest("[data-scope]");
    if (s) {
      mdaF = "all";
      scope = String(s.dataset.scope);
      selectedCounty = "";
      phSt = null;
      scopeSelect.value = scope;
      calc();
      syncCty();
      render();
      return;
    }
    const l = e.target.closest("[data-loc]");
    if (l) {
      const i = l.dataset.loc.indexOf("|");
      openLoc(l.dataset.loc.slice(0, i), l.dataset.loc.slice(i + 1));
      return;
    }
    const th = e.target.closest("th[data-sort]");
    if (th) {
      const k = th.dataset.sort;
      if (siteSortKey === k) siteSortDirection = -siteSortDirection;
      else {
        siteSortKey = k;
        siteSortDirection = k === "n" || k === "st" ? 1 : -1;
      }
      render(true);
      return;
    }
    const fb = e.target.closest("#loc-f button");
    if (fb) {
      filt = fb.dataset.f;
      render(true);
    }
  });
  analyticsContent.addEventListener("input", (e) => {
    if (e.target.id === "loc-q") {
      siteQuickSearch = e.target.value.trim().toLowerCase();
      locBody();
    }
  });
  function open(sc, county) {
    calc();
    scopeSelect.innerHTML =
      '<option value="nat">South Sudan — national</option>' +
      DATA.map((d, i) =>
        __tpl("analytics:open.1", `<option value="{{s1: i}}">{{s2: esc(d.n)}}</option>`, [
          () => i,
          () => esc(d.n),
        ]),
      ).join("");
    if (sc == null) {
      sc = "nat";
      try {
        if (view !== null) sc = String(view);
      } catch (x) {}
    }
    scope = sc;
    selectedCounty = "";
    phSt = null;
    scopeSelect.value = scope;
    tab = "ov";
    analyticsDrawer.hidden = true;
    syncCty();
    render();
    analyticsOverlay.hidden = false;
    document.body.classList.add("noscroll");
    try {
      if (county == null && selC && view !== null) county = selC;
    } catch (x) {}
    if (county) {
      const r = allScopeRows.find((x) => x.si === +scope && K(x.c.n) === K(county));
      if (r) openLoc(r.si, r.c.n);
    }
  }
  function close() {
    analyticsOverlay.hidden = true;
    analyticsDrawer.hidden = true;
    if (selectOne("#adm").hidden && selectOne("#rep").hidden)
      document.body.classList.remove("noscroll");
  }
  selectOne("#ana-x").onclick = close;
  selectOne("#nAna").onclick = (e) => {
    e.preventDefault();
    openAdmin("anl");
  };
  const openButton = selectOne("#anOpen");
  if (openButton) {
    openButton.onclick = () => openAdmin("anl");
    openButton.innerHTML = 'Open analytics page <i class="bx bx-link-external"></i>';
  }
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || analyticsOverlay.hidden) return;
    if (/INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || "")) return;
    if (!selectOne("#rep").hidden) return;
    if (!analyticsDrawer.hidden) analyticsDrawer.hidden = true;
    else close();
  });
  window.openAnalytics = open;
})();
