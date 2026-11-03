/*
 * js/daily-analysis.js
 * Daily analysis page (bands, priorities, pathway, data quality).
 */

/* ===================== ADVANCED ANALYSIS (readiness, priorities, deployment waves) ===================== */
(function () {
  "use strict";

  const BANDS = [
    {
      k: "ready",
      n: "Ready",
      min: 75,
      c: "#16a56d",
      t: "#d3f0e3",
    },
    {
      k: "cond",
      n: "Conditional",
      min: 55,
      c: "#c9744a",
      t: "#ebeef0",
    },
    {
      k: "risk",
      n: "At risk",
      min: 35,
      c: "#e29a0b",
      t: "#fbebc7",
    },
    {
      k: "crit",
      n: "Critical",
      min: -1,
      c: "#d62f58",
      t: "#f9d3dc",
    },
  ];
  const band = (s) => BANDS.find((b) => s >= b.min);
  const bandBy = (k) => BANDS.find((b) => b.k === k);
  const SCORE_WEIGHTS = {
    sec: 0.35,
    acc: 0.25,
    path: 0.15,
    site: 0.15,
    data: 0.1,
  };
  const percentOf = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const p1 = (a, b) => (b ? ((a / b) * 100).toFixed(1) : "0.0");
  const sumOf = (a, f) => a.reduce((s, x) => s + (f ? f(x) : x), 0);
  const ord = (n) =>
    n + ["th", "st", "nd", "rd"][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0];
  const chip = (s) => {
    const b = band(s);
    return __tpl(
      "analysis:chip.1",
      `<span class="r-ph" style="background:{{s1: b.t}};color:{{s2: b.c}}">{{s3: b.n}}</span>`,
      [() => b.t, () => b.c, () => b.n],
    );
  };
  const scoreBarHtml = (v, c) =>
    __tpl(
      "analysis:scoreBarHtml.1",
      `<span class="an-bar" data-v="{{s1: v}}"><i style="width:{{s2: Math.max(0, Math.min(100, v))}}%;background:{{s3: c}}"></i></span>`,
      [() => v, () => Math.max(0, Math.min(100, v)), () => c],
    );
  const scoreColor = (v) =>
    v >= 75 ? "#16a56d" : v >= 55 ? "#c9744a" : v >= 35 ? "#e29a0b" : "#d62f58";
  const hasSites = () => SITES.length > 0;

  /* ---------- scoring ---------- */
  function weakest(f) {
    const L = {
      sec: "Security phase is not fully low-risk",
      acc: "Access is limited",
      path: "Travel route still to be confirmed",
      site: "Registration sites not yet active",
      data: "Some data fields are missing",
    };
    const k = Object.keys(f).sort((a, b) => f[a] - f[b])[0];
    return f[k] >= 100 ? "No major constraint" : L[k];
  }
  function scoreCty(si, c) {
    const ph = c.ph || 0,
      ac = String(c.ac || ""),
      rc = String(c.rc || "");
    const sec = [40, 100, 60, 15][ph];
    const acc = /^easily/i.test(ac)
      ? 100
      : /^accessible/i.test(ac)
        ? 70
        : /in\s?a?c+ess|inacc/i.test(ac)
          ? 15
          : 40;
    const further = /further|futher|not sure|public personel/i.test(rc);
    const path = c.md
      ? /approval|consultation/i.test(rc)
        ? 75
        : 100
      : further
        ? 25
        : /no need|staff|RAA/i.test(rc)
          ? 70
          : 50;
    let sites = [];
    try {
      sites = countySites(si, c) || [];
    } catch (e) {}
    const site = !sites.length
      ? 0
      : sites.some((s) => s.status === "Active")
        ? 100
        : sites.some((s) => s.status !== "Closed")
          ? 60
          : 20;
    const known = [
      +c.e > 0,
      ph > 0,
      /^(easily|accessible|in\s?a?c)/i.test(ac),
      !!rc && !/not sure/i.test(rc),
    ];
    const data = Math.round((sumOf(known, (x) => (x ? 1 : 0)) / known.length) * 100);
    const W = Object.assign({}, SCORE_WEIGHTS);
    if (!hasSites()) {
      W.site = 0;
    }
    const tw = sumOf(Object.values(W));
    const score = Math.round(
      (sec * W.sec + acc * W.acc + path * W.path + site * W.site + data * W.data) / tw,
    );
    const fl = [];
    if (ph === 3) fl.push("Phase 3 high risk");
    else if (!ph) fl.push("Security not classified");
    if (acc <= 15) fl.push("Inaccessible");
    if (further) fl.push("Needs security consultation");
    if (hasSites() && !sites.length) fl.push("No registration site mapped");
    const mode = c.md || (further ? "Needs discussion" : "Not specified");
    return {
      c,
      si,
      e: +c.e || 0,
      ph,
      sec,
      acc,
      path,
      site,
      data,
      score,
      b: band(score),
      sites,
      fl,
      mode,
      further,
      st: DATA[si].n,
      lead:
        fl[0] ||
        weakest({
          sec,
          acc,
          path,
          site: hasSites() ? site : 100,
          data,
        }),
    };
  }
  const allRows = () => DATA.flatMap((d, si) => d.cty.map((c) => scoreCty(si, c)));
  function aggregateBands(rows) {
    const emp = sumOf(rows, (r) => r.e),
      by = {};
    BANDS.forEach(
      (b) =>
        (by[b.k] = {
          n: 0,
          emp: 0,
        }),
    );
    rows.forEach((r) => {
      by[r.b.k].n++;
      by[r.b.k].emp += r.e;
    });
    const score = rows.length
      ? Math.round(
          emp ? sumOf(rows, (r) => r.score * r.e) / emp : sumOf(rows, (r) => r.score) / rows.length,
        )
      : 0;
    const fm = {};
    rows.forEach((r) => r.fl.forEach((f) => (fm[f] = (fm[f] || 0) + r.e)));
    const top = Object.entries(fm).sort((a, b) => b[1] - a[1])[0];
    return {
      rows,
      n: rows.length,
      emp,
      by,
      score,
      b: band(score),
      lead: top && top[1] > 0 ? top[0] : "No major constraint",
      dq: rows.length ? Math.round(sumOf(rows, (r) => r.data) / rows.length) : 0,
    };
  }

  /* ---------- small graphics ---------- */
  function gauge(score, w) {
    w = w || 210;
    const b = band(score),
      r = w / 2 - 16,
      cx = w / 2,
      cy = w / 2;
    const pt = (a) => [(cx + r * Math.cos(a)).toFixed(1), (cy + r * Math.sin(a)).toFixed(1)];
    const arc = (a0, a1) => {
      const p = pt(a0),
        q = pt(a1);
      return `M${p[0]} ${p[1]}A${r} ${r} 0 0 1 ${q[0]} ${q[1]}`;
    };
    const a1 = Math.PI + Math.PI * Math.max(0.004, Math.min(1, score / 100));
    return __tpl(
      "analysis:gauge.1",
      `<svg class="an-g" viewBox="0 0 {{s1: w}} {{s2: w / 2 + 34}}" width="{{s3: w}}" font-family="Inter,Segoe UI,Arial,sans-serif"><path d="{{s4: arc(Math.PI, 2 * Math.PI - 0.0001)}}" fill="none" stroke="#f0f2f4" stroke-width="16" stroke-linecap="round"/><path d="{{s5: arc(Math.PI, a1)}}" fill="none" stroke="{{s6: b.c}}" stroke-width="16" stroke-linecap="round"/><text x="{{s7: cx}}" y="{{s8: cy - 4}}" text-anchor="middle" font-size="36" font-weight="800" fill="{{s9: RINK}}">{{s10: score}}</text><text x="{{s11: cx}}" y="{{s12: cy + 14}}" text-anchor="middle" font-size="11" font-weight="700" fill="{{s13: b.c}}">{{s14: b.n.toUpperCase()}}</text><text x="{{s15: cx - r}}" y="{{s16: cy + 30}}" text-anchor="middle" font-size="9" fill="#6b7592">0</text><text x="{{s17: cx + r}}" y="{{s18: cy + 30}}" text-anchor="middle" font-size="9" fill="#6b7592">100</text></svg>`,
      [
        () => w,
        () => w / 2 + 34,
        () => w,
        () => arc(Math.PI, 2 * Math.PI - 0.0001),
        () => arc(Math.PI, a1),
        () => b.c,
        () => cx,
        () => cy - 4,
        () => RINK,
        () => score,
        () => cx,
        () => cy + 14,
        () => b.c,
        () => b.n.toUpperCase(),
        () => cx - r,
        () => cy + 30,
        () => cx + r,
        () => cy + 30,
      ],
    );
  }
  const bandLegend = (A) =>
    legendDots(
      BANDS.map((b) => b.n),
      BANDS.map((b) => b.c),
      BANDS.map((b) => A.by[b.k].n),
    );
  const bandDonut = (A) =>
    chDonut(
      BANDS.map((b) => A.by[b.k].n),
      BANDS.map((b) => b.c),
    );
  const bandBars = (A) =>
    chBars(
      BANDS.map((b) => ({
        l: b.n,
        v: A.by[b.k].emp,
        c: b.c,
      })),
      400,
    );

  /* ---------- narrative ---------- */
  function insights(A, label, all) {
    const L = [],
      tot = A.emp,
      by = A.by,
      R = A.rows;
    if (!R.length) return ["No locations are recorded for this scope yet."];
    L.push(
      __tpl(
        "analysis:insights.1",
        `<b>{{s1: percentOf(by.ready.emp, tot)}}%</b> of the workforce ({{s2: fmt(by.ready.emp)}} employees in {{s3: by.ready.n}} location{{s4: by.ready.n == 1 ? '' : 's'}}) is in <b>Ready</b> locations; including <b>Conditional</b> ones, <b>{{s5: percentOf(by.ready.emp + by.cond.…}}%</b> can be reached with normal planning or light coordination.`,
        [
          () => percentOf(by.ready.emp, tot),
          () => fmt(by.ready.emp),
          () => by.ready.n,
          () => (by.ready.n == 1 ? "" : "s"),
          () => percentOf(by.ready.emp + by.cond.emp, tot),
        ],
      ),
    );
    if (by.crit.n)
      L.push(
        __tpl(
          "analysis:insights.2",
          `<b>{{s1: by.crit.n}}</b> location{{s2: by.crit.n == 1 ? ' is' : 's are'}} <b>Critical</b> — {{s3: fmt(by.crit.emp)}} employees ({{s4: percentOf(by.crit.emp, tot)}}%) cannot be registered on site until blocking issues are resolved. Biggest blocker: <b>{{s5: esc(A.lead)}}</b>.`,
          [
            () => by.crit.n,
            () => (by.crit.n == 1 ? " is" : "s are"),
            () => fmt(by.crit.emp),
            () => percentOf(by.crit.emp, tot),
            () => esc(A.lead),
          ],
        ),
      );
    else
      L.push(
        __tpl(
          "analysis:insights.3",
          `No location is rated <b>Critical</b> in {{s1: esc(label)}}.`,
          [() => esc(label)],
        ),
      );
    const top = R.slice().sort((a, b) => b.e - a.e),
      t5 = top.slice(0, 5),
      s5 = sumOf(t5, (r) => r.e);
    if (tot)
      L.push(
        __tpl(
          "analysis:insights.4",
          `The five largest locations hold <b>{{s1: percentOf(s5, tot)}}%</b> of the workforce — {{s2: t5.map(…)}}.`,
          [
            () => percentOf(s5, tot),
            () => t5.map((r) => `${esc(r.c.n)} (${fmt(r.e)}, ${r.b.n})`).join(", "),
          ],
        ),
      );
    const fu = R.filter((r) => r.further),
      fe = sumOf(fu, (r) => r.e);
    if (fu.length)
      L.push(
        __tpl(
          "analysis:insights.5",
          `<b>{{s1: fu.length}}</b> location{{s2: fu.length == 1 ? '' : 's'}} ({{s3: fmt(fe)}} employees) still need a security consultation before a travel route can be fixed.`,
          [() => fu.length, () => (fu.length == 1 ? "" : "s"), () => fmt(fe)],
        ),
      );
    if (all) {
      const S = DATA.map((d, i) => aggregateBands(R.filter((r) => r.si === i)))
        .map((a, i) => ({
          a,
          n: DATA[i].n,
        }))
        .filter((x) => x.a.n);
      if (S.length > 1) {
        S.sort((a, b) => b.a.score - a.a.score);
        L.push(
          __tpl(
            "analysis:insights.6",
            `Strongest state: <b>{{s1: esc(S[0].n)}}</b> (score {{s2: S[0].a.score}}). Weakest: <b>{{s3: esc(S[S.length - 1].n)}}</b> (score {{s4: S[S.length - 1].a.score}}).`,
            [
              () => esc(S[0].n),
              () => S[0].a.score,
              () => esc(S[S.length - 1].n),
              () => S[S.length - 1].a.score,
            ],
          ),
        );
      }
    }
    if (!hasSites())
      L.push(
        __tpl(
          "analysis:insights.7",
          `No registration sites are recorded yet, so site coverage is <b>not part of the score</b>. Add sites in the admin page to make the index more accurate.`,
          [],
        ),
      );
    return L;
  }
  function actions(A, label) {
    const L = [],
      R = A.rows,
      by = A.by;
    if (!R.length) return L;
    const rd = R.filter((r) => r.b.k === "ready").sort((a, b) => b.e - a.e);
    if (rd.length)
      L.push(
        __tpl(
          "analysis:actions.1",
          `<b>Start with the Ready locations.</b> {{s1: rd .slice(0, 4) .map(…)}}{{s2: rd.length 4 ? ' and ' + (rd.lengt…}} give the fastest progress with the least risk.`,
          [
            () =>
              rd
                .slice(0, 4)
                .map((r) => `${esc(r.c.n)} (${fmt(r.e)})`)
                .join(", "),
            () => (rd.length > 4 ? " and " + (rd.length - 4) + " more" : ""),
          ],
        ),
      );
    const cr = R.filter((r) => r.b.k === "crit").sort((a, b) => b.e - a.e);
    if (cr.length)
      L.push(
        __tpl(
          "analysis:actions.2",
          `<b>Unblock the largest Critical locations.</b> {{s1: cr .slice(0, 3) .map(…)}}. Consider moving staff to a nearby safe registration point where the recommendation allows it.`,
          [
            () =>
              cr
                .slice(0, 3)
                .map((r) => `${esc(r.c.n)} (${fmt(r.e)} · ${esc(r.lead)})`)
                .join("; "),
          ],
        ),
      );
    const fu = R.filter((r) => r.further);
    if (fu.length)
      L.push(
        __tpl(
          "analysis:actions.3",
          `<b>Hold consultations with the security focal persons</b> for {{s1: fu.length}} location{{s2: fu.length == 1 ? '' : 's'}} ({{s3: fmt(sumOf(fu, (r) = r.e))}} employees) so a route can be confirmed.`,
          [() => fu.length, () => (fu.length == 1 ? "" : "s"), () => fmt(sumOf(fu, (r) => r.e))],
        ),
      );
    if (hasSites()) {
      const ns = R.filter((r) => !r.sites.length && (r.b.k === "ready" || r.b.k === "cond"));
      if (ns.length)
        L.push(
          __tpl(
            "analysis:actions.4",
            `<b>Map registration sites</b> for {{s1: ns.length}} Ready / Conditional location{{s2: ns.length == 1 ? '' : 's'}} that have none yet ({{s3: fmt(sumOf(ns, (r) = r.e))}} employees).`,
            [() => ns.length, () => (ns.length == 1 ? "" : "s"), () => fmt(sumOf(ns, (r) => r.e))],
          ),
        );
    } else
      L.push(
        __tpl(
          "analysis:actions.5",
          `<b>Record registration sites.</b> Adding sites with status and capacity unlocks the site-coverage factor and a capacity-vs-target check.`,
          [],
        ),
      );
    const un = R.filter((r) => !r.ph || !r.e);
    if (un.length)
      L.push(
        __tpl(
          "analysis:actions.6",
          `<b>Complete the data</b> for {{s1: un.length}} location{{s2: un.length == 1 ? '' : 's'}} with a missing security phase or employee figure: {{s3: un .slice(0, 5) .map(…)}}{{s4: un.length 5 ? '…' : ''}}.`,
          [
            () => un.length,
            () => (un.length == 1 ? "" : "s"),
            () =>
              un
                .slice(0, 5)
                .map((r) => esc(r.c.n))
                .join(", "),
            () => (un.length > 5 ? "…" : ""),
          ],
        ),
      );
    return L;
  }

  /* ---------- tables ---------- */
  function wavesTable(A) {
    const rows = [
      ["Wave 1 · Deploy now", "ready", "Ready locations"],
      ["Wave 2 · Deploy with coordination", "cond", "Conditional locations"],
      ["Wave 3 · Prepare first", "risk", "At-risk locations"],
      ["Hold · Resolve blockers", "crit", "Critical locations"],
    ];
    let cum = 0;
    return __tpl(
      "analysis:wavesTable.2",
      `<table class="r-t sm"><thead><tr><th>Phase of work</th><th>Scope</th><th class="n">Locations</th><th class="n">Employees</th><th class="n">Share</th><th class="n">Cumulative</th></tr></thead><tbody>{{s1: rows .map(…)}}</tbody><tfoot><tr><td colspan="2">Total</td><td class="n">{{s2: A.n}}</td><td class="n">{{s3: fmt(A.emp)}}</td><td class="n">100%</td><td></td></tr></tfoot></table>`,
      [
        () =>
          rows
            .map(([t, k, s]) => {
              const x = A.by[k];
              cum += x.emp;
              return __tpl(
                "analysis:wavesTable.1",
                `<tr><td><b>{{s1: t}}</b></td><td>{{s2: s}}</td><td class="n">{{s3: x.n}}</td><td class="n">{{s4: fmt(x.emp)}}</td><td class="n">{{s5: percentOf(x.emp, A.emp)}}%</td><td class="n">{{s6: percentOf(cum, A.emp)}}%</td></tr>`,
                [
                  () => t,
                  () => s,
                  () => x.n,
                  () => fmt(x.emp),
                  () => percentOf(x.emp, A.emp),
                  () => percentOf(cum, A.emp),
                ],
              );
            })
            .join(""),
        () => A.n,
        () => fmt(A.emp),
      ],
    );
  }
  function priorityTable(R, n, showState) {
    const P = R.map((r) => ({
      r,
      u: Math.round((r.e * (100 - r.score)) / 100),
    }))
      .filter((x) => x.u > 0)
      .sort((a, b) => b.u - a.u)
      .slice(0, n);
    if (!P.length) return '<p class="r-mu">No outstanding workforce gap.</p>';
    return __tpl(
      "analysis:priorityTable.3",
      `<table class="r-t sm"><thead><tr><th>#</th><th>Location</th>{{s1: showState ? ' th State /th ' : ''}}<th class="n">Employees</th><th class="n">Score</th><th>Status</th><th class="n">Workforce gap</th><th>Main blocker</th></tr></thead><tbody>{{s2: P.map(…)}}</tbody></table><p class="r-mu an-note">Workforce gap = employees × (100 − readiness score) ÷ 100. It shows where extra effort removes the most risk.</p>`,
      [
        () => (showState ? "<th>State</th>" : ""),
        () =>
          P.map((x, i) =>
            __tpl(
              "analysis:priorityTable.2",
              `<tr><td>{{s1: i + 1}}</td><td><b>{{s2: esc(x.r.c.n)}}</b></td>{{s3: showState ? …}}<td class="n">{{s4: fmt(x.r.e)}}</td><td class="n">{{s5: x.r.score}}</td><td>{{s6: chip(x.r.score)}}</td><td class="n"><b>{{s7: fmt(x.u)}}</b></td><td>{{s8: esc(x.r.lead)}}</td></tr>`,
              [
                () => i + 1,
                () => esc(x.r.c.n),
                () =>
                  showState
                    ? __tpl(
                        "analysis:priorityTable.1",
                        `<td>{{s1: esc(SH[x.r.st] || x.r.st)}}</td>`,
                        [() => esc(SH[x.r.st] || x.r.st)],
                      )
                    : "",
                () => fmt(x.r.e),
                () => x.r.score,
                () => chip(x.r.score),
                () => fmt(x.u),
                () => esc(x.r.lead),
              ],
            ),
          ).join(""),
      ],
    );
  }
  function matrixTable(R) {
    const cols = [
        ["Easily accessible", /^easily/i],
        ["Accessible", /^accessible/i],
        ["Inaccessible", /in\s?a?c+ess|inacc/i],
      ],
      rows = [1, 2, 3, 0];
    const cell = (ph, re) => {
      const m = R.filter((r) => (r.ph || 0) === ph && re.test(String(r.c.ac || "")));
      return m.length
        ? __tpl(
            "analysis:cell.1",
            `{{s1: fmt(sumOf(m, (r) = r.e))}}<span class="r-mu"> · {{s2: m.length}}</span>`,
            [() => fmt(sumOf(m, (r) => r.e)), () => m.length],
          )
        : '<span class="r-mu">—</span>';
    };
    const other = (ph) => {
      const m = R.filter(
        (r) => (r.ph || 0) === ph && !cols.some((c) => c[1].test(String(r.c.ac || ""))),
      );
      return m.length
        ? __tpl(
            "analysis:other.1",
            `{{s1: fmt(sumOf(m, (r) = r.e))}}<span class="r-mu"> · {{s2: m.length}}</span>`,
            [() => fmt(sumOf(m, (r) => r.e)), () => m.length],
          )
        : '<span class="r-mu">—</span>';
    };
    return __tpl(
      "analysis:matrixTable.4",
      `<table class="r-t sm an-mx"><thead><tr><th>Security \\ Access</th>{{s1: cols.map(…)}}<th class="n">Not recorded</th></tr></thead><tbody>{{s2: rows.map(…)}}</tbody></table><p class="r-mu an-note">Cells show employees · number of locations.</p>`,
      [
        () =>
          cols
            .map((c) =>
              __tpl("analysis:matrixTable.1", `<th class="n">{{s1: c[0]}}</th>`, [() => c[0]]),
            )
            .join(""),
        () =>
          rows
            .map((ph) =>
              __tpl(
                "analysis:matrixTable.3",
                `<tr><td><span class="r-ph" style="background:{{s1: RTINT[ph]}};color:{{s2: RC[ph]}}">{{s3: ph ? 'Phase ' + ph : 'Not classif…}}</span></td>{{s4: cols.map(…)}}<td class="n">{{s5: other(ph)}}</td></tr>`,
                [
                  () => RTINT[ph],
                  () => RC[ph],
                  () => (ph ? "Phase " + ph : "Not classified"),
                  () =>
                    cols
                      .map((c) =>
                        __tpl(
                          "analysis:matrixTable.2",
                          `<td class="n">{{s1: cell(ph, c[1])}}</td>`,
                          [() => cell(ph, c[1])],
                        ),
                      )
                      .join(""),
                  () => other(ph),
                ],
              ),
            )
            .join(""),
      ],
    );
  }
  function pathwayBars(R) {
    const m = {};
    R.forEach((r) => (m[r.mode] = (m[r.mode] || 0) + r.e));
    const col = {
      Air: "#2F353B",
      Road: "#b45309",
      River: "#3a9ad0",
      "Needs discussion": "#d62f58",
      "Not specified": "#C5A059",
    };
    return chBars(
      Object.entries(m)
        .sort((a, b) => b[1] - a[1])
        .map(([l, v]) => ({
          l:
            l === "Needs discussion"
              ? "Needs discussion"
              : l === "Not specified"
                ? "No route set"
                : "By " + l.toLowerCase(),
          v,
          c: col[l] || "#C5A059",
        })),
      400,
    );
  }
  function dqTable(R) {
    const n = R.length,
      ok = (f) => R.filter(f).length;
    const chk = [
      ["Employee figure missing", ok((r) => !r.e), "No target to measure against"],
      ["Security phase not classified", ok((r) => !r.ph), "Scored conservatively (40/100)"],
      [
        "Access not recorded",
        ok((r) => !/^(easily|accessible|in\s?a?c)/i.test(String(r.c.ac || ""))),
        "Scored as unknown (40/100)",
      ],
      [
        "Recommendation missing or unclear",
        ok((r) => !r.c.rc || /not sure/i.test(String(r.c.rc))),
        "Travel route cannot be confirmed",
      ],
      [
        "Source labels with spelling variants",
        ok(
          (r) =>
            (r.c.sf && !/^(safer|safe|unsafe|\?)$/i.test(r.c.sf)) ||
            (r.c.ac && !/^(easily accessible|accessible|inaccessible|\?)$/i.test(r.c.ac)),
        ),
        "Read correctly by the analysis; fix at source",
      ],
    ];
    if (hasSites())
      chk.push([
        "Locations with no registration site",
        ok((r) => !r.sites.length),
        "Site coverage cannot be assessed",
      ]);
    return __tpl(
      "analysis:dqTable.2",
      `<table class="r-t sm"><thead><tr><th>Data check</th><th class="n">Locations</th><th class="n">Share</th><th>Effect on the analysis</th></tr></thead><tbody>{{s1: chk.map(…)}}</tbody></table>`,
      [
        () =>
          chk
            .map((x) =>
              __tpl(
                "analysis:dqTable.1",
                `<tr><td>{{s1: x[0]}}</td><td class="n">{{s2: x[1]}}</td><td class="n">{{s3: percentOf(x[1], n)}}%</td><td class="r-mu">{{s4: x[2]}}</td></tr>`,
                [() => x[0], () => x[1], () => percentOf(x[1], n), () => x[2]],
              ),
            )
            .join(""),
      ],
    );
  }
  const methodNote = () =>
    __tpl(
      "analysis:methodNote.1",
      `<p class="r-mu an-note"><b>How the readiness index works.</b> Each location scores 0–100 from: security phase ({{s1: hasSites() ? '35' : '39'}}%), access ({{s2: hasSites() ? '25' : '28'}}%), travel-route clarity ({{s3: hasSites() ? '15' : '17'}}%), {{s4: hasSites() ? 'registration-site c…}}data completeness ({{s5: hasSites() ? '10' : '11'}}%). Bands: Ready ≥ 75 · Conditional 55–74 · At risk 35–54 · Critical &lt; 35. Area and state scores are weighted by government employees. The index is a planning aid built from the dashboard data, not an official rating.</p>`,
      [
        () => (hasSites() ? "35" : "39"),
        () => (hasSites() ? "25" : "28"),
        () => (hasSites() ? "15" : "17"),
        () => (hasSites() ? "registration-site coverage (15%), " : ""),
        () => (hasSites() ? "10" : "11"),
      ],
    );
  const listHtml = (a) =>
    a.length
      ? __tpl("analysis:listHtml.2", `<ul class="r-ul">{{s1: a.map(…)}}</ul>`, [
          () =>
            a.map((t) => __tpl("analysis:listHtml.1", `<li>{{s1: t}}</li>`, [() => t])).join(""),
        ])
      : "";
  const head = (t, lead, pb) =>
    __tpl(
      "analysis:head.1",
      `<section class="r-sec an-sec{{s1: pb ? ' pb' : ''}}"><h2>{{s2: t}}</h2><p class="r-lead">{{s3: lead}}</p>`,
      [() => (pb ? " pb" : ""), () => t, () => lead],
    );
  const kpis = (A) =>
    __tpl(
      "analysis:kpis.1",
      `<div class="r-kg">{{s1: rKpi('Readiness index', A.score +…}}{{s2: rKpi('Ready workforce', fmt(A.by.…}}{{s3: rKpi('Ready + Conditional', perce…}}{{s4: rKpi('Critical workforce', fmt(A.…}}{{s5: rKpi( 'Largest 5 locations', perc…}}{{s6: rKpi('Data completeness', A.dq +…}}</div>`,
      [
        () => rKpi("Readiness index", A.score + " / 100", A.b.n),
        () =>
          rKpi(
            "Ready workforce",
            fmt(A.by.ready.emp),
            percentOf(A.by.ready.emp, A.emp) + "% · " + A.by.ready.n + " locations",
          ),
        () =>
          rKpi(
            "Ready + Conditional",
            percentOf(A.by.ready.emp + A.by.cond.emp, A.emp) + "%",
            fmt(A.by.ready.emp + A.by.cond.emp) + " employees",
          ),
        () =>
          rKpi(
            "Critical workforce",
            fmt(A.by.crit.emp),
            percentOf(A.by.crit.emp, A.emp) + "% · " + A.by.crit.n + " locations",
          ),
        () =>
          rKpi(
            "Largest 5 locations",
            percentOf(
              sumOf(
                A.rows
                  .slice()
                  .sort((a, b) => b.e - a.e)
                  .slice(0, 5),
                (r) => r.e,
              ),
              A.emp,
            ) + "%",
            "of the workforce",
          ),
        () => rKpi("Data completeness", A.dq + "%", "across all fields scored"),
      ],
    );
  const statusRow = (A) =>
    __tpl(
      "analysis:statusRow.1",
      `<div class="r-2"><div><h3>Overall status</h3><div class="r-dn">{{s1: gauge(A.score)}}</div><div class="an-lg">{{s2: bandLegend(A)}}</div><p class="r-mu an-note">Weighted by employees. The average location scores <b>{{s3: A.n ? Math.round(sumOf(A.rows, (r…}}</b>{{s4: A.n Math.abs(Math.round(sumOf(A.r…}}.</p></div><div><h3>Employees by readiness band</h3>{{s5: bandBars(A)}}<h3 style="margin-top:14px">Locations by readiness band</h3><div class="r-dn">{{s6: bandDonut(A)}}</div></div></div>`,
      [
        () => gauge(A.score),
        () => bandLegend(A),
        () => (A.n ? Math.round(sumOf(A.rows, (r) => r.score) / A.n) : 0),
        () =>
          A.n && Math.abs(Math.round(sumOf(A.rows, (r) => r.score) / A.n) - A.score) >= 8
            ? " — a few large locations lift the weighted index, so smaller locations need separate attention"
            : "",
        () => bandBars(A),
        () => bandDonut(A),
      ],
    );

  /* ---------- section builders ---------- */
  function anNational(o, pb) {
    const R = allRows(),
      A = aggregateBands(R);
    const S = DATA.map((d, i) => {
      const a = aggregateBands(R.filter((r) => r.si === i));
      return {
        d,
        i,
        a,
      };
    })
      .filter((x) => x.a.n)
      .sort((x, y) => y.a.score - x.a.score);
    let h = head(
      "Advanced analysis — national status",
      `Readiness, risk exposure and deployment priorities across ${DATA.length} states and administrative areas and ${A.n} locations.`,
      pb,
    );
    h += kpis(A) + statusRow(A);
    h += __tpl(
      "analysis:anNational.1",
      `<h3>Key findings</h3>{{s1: listHtml(insights(A, 'the country…}}`,
      [() => listHtml(insights(A, "the country", true))],
    );
    h += __tpl(
      "analysis:anNational.3",
      `<h3>State readiness ranking</h3><table class="r-t sm"><thead><tr><th>#</th><th>State / area</th><th>Readiness</th><th>Status</th><th class="n">Employees</th><th class="n">Ready</th><th class="n">Critical locs</th><th>Main constraint</th></tr></thead><tbody>{{s1: S.map(…)}}</tbody></table>`,
      [
        () =>
          S.map((x, i) =>
            __tpl(
              "analysis:anNational.2",
              `<tr><td>{{s1: i + 1}}</td><td><b>{{s2: esc(x.d.n)}}</b></td><td class="an-sc">{{s3: scoreBarHtml(x.a.score, scoreColo…}}<b>{{s4: x.a.score}}</b></td><td>{{s5: chip(x.a.score)}}</td><td class="n">{{s6: fmt(x.a.emp)}}</td><td class="n">{{s7: percentOf(x.a.by.ready.emp, x.a.e…}}%</td><td class="n">{{s8: x.a.by.crit.n}}</td><td>{{s9: esc(x.a.lead)}}</td></tr>`,
              [
                () => i + 1,
                () => esc(x.d.n),
                () => scoreBarHtml(x.a.score, scoreColor(x.a.score)),
                () => x.a.score,
                () => chip(x.a.score),
                () => fmt(x.a.emp),
                () => percentOf(x.a.by.ready.emp, x.a.emp),
                () => x.a.by.crit.n,
                () => esc(x.a.lead),
              ],
            ),
          ).join(""),
      ],
    );
    h += __tpl(
      "analysis:anNational.4",
      `<div class="an-keep"><h3>Suggested deployment sequence</h3>{{s1: wavesTable(A)}}</div>`,
      [() => wavesTable(A)],
    );
    h += __tpl(
      "analysis:anNational.5",
      `<h3>Where to focus first</h3>{{s1: priorityTable(R, 10, true)}}`,
      [() => priorityTable(R, 10, true)],
    );
    h += __tpl(
      "analysis:anNational.6",
      `<div class="an-keep"><h3>Workforce by travel route</h3><div class="an-pw">{{s1: pathwayBars(R)}}</div></div><div class="an-keep"><h3>Security × access exposure</h3>{{s2: matrixTable(R)}}</div>`,
      [() => pathwayBars(R), () => matrixTable(R)],
    );
    h += __tpl(
      "analysis:anNational.7",
      `<h3>Recommended actions</h3>{{s1: listHtml(actions(A, 'the country'…}}`,
      [() => listHtml(actions(A, "the country"))],
    );
    h += __tpl(
      "analysis:anNational.8",
      `<div class="an-keep"><h3>Data quality</h3>{{s1: dqTable(R)}}</div>{{s2: methodNote()}}</section>`,
      [() => dqTable(R), () => methodNote()],
    );
    return h;
  }
  function anState(si, o, pb) {
    const d = DATA[si],
      ALL = allRows(),
      R = ALL.filter((r) => r.si === si),
      A = aggregateBands(R),
      N = aggregateBands(ALL);
    const rank =
      DATA.map((x, i) => ({
        i,
        a: aggregateBands(ALL.filter((r) => r.si === i)),
      }))
        .filter((x) => x.a.n)
        .sort((a, b) => b.a.score - a.a.score)
        .findIndex((x) => x.i === si) + 1;
    let h = head(
      `Advanced analysis — ${esc(d.n)}`,
      __tpl(
        "analysis:anState.1",
        `Readiness and priorities for {{s1: A.n}} location{{s2: A.n == 1 ? '' : 's'}} · ranked <b>{{s3: ord(rank)}}</b> of {{s4: DATA.length}} by readiness (national index {{s5: N.score}}).`,
        [() => A.n, () => (A.n == 1 ? "" : "s"), () => ord(rank), () => DATA.length, () => N.score],
      ),
      pb,
    );
    if (!A.n) return h + '<p class="r-mu">No locations recorded for this area.</p></section>';
    h += kpis(A) + statusRow(A);
    h += __tpl(
      "analysis:anState.3",
      `<h3>Key findings</h3>{{s1: listHtml(insights(A, d.n, false).…}}`,
      [
        () =>
          listHtml(
            insights(A, d.n, false).concat([
              __tpl(
                "analysis:anState.2",
                `Compared with the national index (<b>{{s1: N.score}}</b>), {{s2: esc(d.n)}} is <b>{{s3: A.score N.score ? 'above' : A.sco…}}</b> the average{{s4: A.score !== N.score ? ' by ' + Ma…}}.`,
                [
                  () => N.score,
                  () => esc(d.n),
                  () => (A.score > N.score ? "above" : A.score < N.score ? "below" : "level with"),
                  () =>
                    A.score !== N.score ? " by " + Math.abs(A.score - N.score) + " points" : "",
                ],
              ),
            ]),
          ),
      ],
    );
    h += __tpl(
      "analysis:anState.6",
      `<h3>Location scorecard</h3><table class="r-t sm"><thead><tr><th>Location</th><th class="n">Employees</th><th>Readiness</th><th>Status</th><th>Security</th><th>Access</th><th>Route</th>{{s1: hasSites() ? ' th Sites /th ' : ''}}<th>Main blocker</th></tr></thead><tbody>{{s2: R.slice() .sort((a, b) = b.e - a.…}}</tbody></table>`,
      [
        () => (hasSites() ? "<th>Sites</th>" : ""),
        () =>
          R.slice()
            .sort((a, b) => b.e - a.e)
            .map((r) =>
              __tpl(
                "analysis:anState.5",
                `<tr><td><b>{{s1: esc(r.c.n)}}</b></td><td class="n">{{s2: fmt(r.e)}}</td><td class="an-sc">{{s3: scoreBarHtml(r.score, scoreColor(…}}<b>{{s4: r.score}}</b></td><td>{{s5: chip(r.score)}}</td><td>{{s6: scoreBarHtml(r.sec, scoreColor(r.…}}</td><td>{{s7: scoreBarHtml(r.acc, scoreColor(r.…}}</td><td>{{s8: scoreBarHtml(r.path, scoreColor(r…}}</td>{{s9: hasSites() ? …}}<td>{{s10: esc(r.lead)}}</td></tr>`,
                [
                  () => esc(r.c.n),
                  () => fmt(r.e),
                  () => scoreBarHtml(r.score, scoreColor(r.score)),
                  () => r.score,
                  () => chip(r.score),
                  () => scoreBarHtml(r.sec, scoreColor(r.sec)),
                  () => scoreBarHtml(r.acc, scoreColor(r.acc)),
                  () => scoreBarHtml(r.path, scoreColor(r.path)),
                  () =>
                    hasSites()
                      ? __tpl(
                          "analysis:anState.4",
                          `<td>{{s1: scoreBarHtml(r.site, scoreColor(r…}}</td>`,
                          [() => scoreBarHtml(r.site, scoreColor(r.site))],
                        )
                      : "",
                  () => esc(r.lead),
                ],
              ),
            )
            .join(""),
      ],
    );
    h += __tpl(
      "analysis:anState.7",
      `<div class="an-keep"><h3>Suggested deployment sequence</h3>{{s1: wavesTable(A)}}</div>`,
      [() => wavesTable(A)],
    );
    h += __tpl(
      "analysis:anState.8",
      `<h3>Where to focus first</h3>{{s1: priorityTable(R, 6, false)}}`,
      [() => priorityTable(R, 6, false)],
    );
    h += __tpl(
      "analysis:anState.9",
      `<div class="an-keep"><h3>Workforce by travel route</h3><div class="an-pw">{{s1: pathwayBars(R)}}</div></div><div class="an-keep"><h3>Security × access exposure</h3>{{s2: matrixTable(R)}}</div>`,
      [() => pathwayBars(R), () => matrixTable(R)],
    );
    h += __tpl(
      "analysis:anState.10",
      `<h3>Recommended actions</h3>{{s1: listHtml(actions(A, d.n))}}`,
      [() => listHtml(actions(A, d.n))],
    );
    h += __tpl(
      "analysis:anState.11",
      `<div class="an-keep"><h3>Data quality</h3>{{s1: dqTable(R)}}</div>{{s2: methodNote()}}</section>`,
      [() => dqTable(R), () => methodNote()],
    );
    return h;
  }
  function anCounty(scope, pb) {
    const p = countyScopeParts(scope);
    if (!p) return "";
    const ALL = allRows(),
      R = ALL.filter((r) => r.si === p.si),
      me = R.find((r) => r.c === p.county),
      SA = aggregateBands(R),
      NA = aggregateBands(ALL);
    const rank =
      R.slice()
        .sort((a, b) => b.score - a.score)
        .findIndex((r) => r === me) + 1;
    const target = me.e,
      cap = sumOf(me.sites, (s) => +s.cap || 0);
    const fac = [
      [
        "Security phase",
        me.sec,
        hasSites() ? 35 : 39,
        p.county.ph ? PHN[p.county.ph] : "Not classified",
      ],
      ["Access", me.acc, hasSites() ? 25 : 28, p.county.ac || "Not recorded"],
      [
        "Travel-route clarity",
        me.path,
        hasSites() ? 15 : 17,
        p.county.rc || "No recommendation recorded",
      ],
    ];
    if (hasSites())
      fac.push([
        "Registration-site coverage",
        me.site,
        15,
        me.sites.length
          ? me.sites.length + " site" + (me.sites.length == 1 ? "" : "s") + " mapped"
          : "No site mapped",
      ]);
    fac.push([
      "Data completeness",
      me.data,
      hasSites() ? 10 : 11,
      me.data + "% of key fields recorded",
    ]);
    let h = head(
      `Advanced analysis — ${esc(p.county.n)}`,
      __tpl(
        "analysis:anCounty.1",
        `Readiness of this location within {{s1: esc(p.state.n)}} — ranked <b>{{s2: ord(rank)}}</b> of {{s3: R.length}} (state index {{s4: SA.score}}, national {{s5: NA.score}}).`,
        [() => esc(p.state.n), () => ord(rank), () => R.length, () => SA.score, () => NA.score],
      ),
      pb,
    );
    h += __tpl(
      "analysis:anCounty.2",
      `<div class="r-2"><div><h3>Readiness status</h3><div class="r-dn">{{s1: gauge(me.score)}}</div><p style="margin:6px 0 0">{{s2: chip(me.score)}} <span class="r-mu">{{s3: me.fl.length ? 'Constraints: ' +…}}</span></p></div><div><h3>Position</h3>{{s4: chBars( [ l: p.county.n, v: me.sc…}}<div class="r-kg" style="grid-template-columns:1fr 1fr;margin-top:10px">{{s5: rKpi('Employees', fmt(target), pe…}}{{s6: rKpi('Share of country', p1(targe…}}</div></div></div>`,
      [
        () => gauge(me.score),
        () => chip(me.score),
        () =>
          me.fl.length
            ? "Constraints: " + me.fl.map(esc).join(" · ")
            : "No major constraint recorded.",
        () =>
          chBars(
            [
              {
                l: p.county.n,
                v: me.score,
                c: band(me.score).c,
              },
              {
                l: p.state.n + " (avg)",
                v: SA.score,
                c: band(SA.score).c,
              },
              {
                l: "National (avg)",
                v: NA.score,
                c: band(NA.score).c,
              },
            ],
            400,
            (v) => String(v),
          ),
        () => rKpi("Employees", fmt(target), percentOf(target, SA.emp) + "% of " + esc(p.state.n)),
        () => rKpi("Share of country", p1(target, NA.emp) + "%", ""),
      ],
    );
    h += __tpl(
      "analysis:anCounty.4",
      `<h3>What drives the score</h3><table class="r-t sm"><thead><tr><th>Factor</th><th class="n">Weight</th><th>Score</th><th>Evidence</th></tr></thead><tbody>{{s1: fac.map(…)}}</tbody></table>`,
      [
        () =>
          fac
            .map((f) =>
              __tpl(
                "analysis:anCounty.3",
                `<tr><td><b>{{s1: f[0]}}</b></td><td class="n">{{s2: f[2]}}%</td><td class="an-sc">{{s3: scoreBarHtml(f[1], scoreColor(f[1…}}<b>{{s4: f[1]}}</b></td><td class="r-mu">{{s5: esc(f[3])}}</td></tr>`,
                [
                  () => f[0],
                  () => f[2],
                  () => scoreBarHtml(f[1], scoreColor(f[1])),
                  () => f[1],
                  () => esc(f[3]),
                ],
              ),
            )
            .join(""),
      ],
    );
    const L = [];
    L.push(
      __tpl(
        "analysis:anCounty.5",
        `{{s1: esc(p.county.n)}} is rated <b>{{s2: me.b.n}}</b> ({{s3: me.score}}/100), {{s4: me.score = SA.score ? 'at or abov…}} the {{s5: esc(p.state.n)}} average of {{s6: SA.score}}.`,
        [
          () => esc(p.county.n),
          () => me.b.n,
          () => me.score,
          () => (me.score >= SA.score ? "at or above" : "below"),
          () => esc(p.state.n),
          () => SA.score,
        ],
      ),
    );
    if (me.fl.length)
      L.push(
        __tpl(
          "analysis:anCounty.6",
          `Main blocker: <b>{{s1: esc(me.lead)}}</b>{{s2: me.fl.length 1 ? ' (plus ' + me.f…}}.`,
          [
            () => esc(me.lead),
            () => (me.fl.length > 1 ? " (plus " + me.fl.slice(1).map(esc).join(", ") + ")" : ""),
          ],
        ),
      );
    if (me.b.k === "ready")
      L.push("It can be scheduled in the first deployment wave with normal planning.");
    else if (me.b.k === "cond")
      L.push(
        "It can be scheduled in the second wave once approvals or coordination are confirmed.",
      );
    else
      L.push(
        "It should not be scheduled until the blocking issues above are resolved or an alternative registration point is agreed.",
      );
    if (hasSites()) {
      if (me.sites.length)
        L.push(
          __tpl(
            "analysis:anCounty.7",
            `Mapped sites provide a recorded capacity of <b>{{s1: fmt(cap)}}</b> against a target of <b>{{s2: fmt(target)}}</b> ({{s3: percentOf(cap, target)}}%).{{s4: cap cap target ? ' Capacity is be…}}`,
            [
              () => fmt(cap),
              () => fmt(target),
              () => percentOf(cap, target),
              () =>
                cap && cap < target ? " Capacity is below the target — add sites or sessions." : "",
            ],
          ),
        );
      else
        L.push(
          "No registration site is mapped here yet — add at least one to track capacity against the target.",
        );
    }
    h += __tpl("analysis:anCounty.8", `<h3>Key findings</h3>{{s1: listHtml(L)}}`, [
      () => listHtml(L),
    ]);
    h += __tpl(
      "analysis:anCounty.9",
      `<h3>Recommended next steps</h3>{{s1: listHtml(actions(aggregateBands([…}}{{s2: methodNote()}}</section>`,
      [() => listHtml(actions(aggregateBands([me]), p.county.n)), () => methodNote()],
    );
    return h;
  }

  /* ---------- plug into the existing report ---------- */
  const STD = ["sum", "map", "chart", "table", "infra", "sites"],
    hasStd = (o) => STD.some((k) => o[k]);
  const _N = secNational,
    _S = secState,
    _C = secCounty;
  secNational = function (o) {
    const base = !o.analysis || hasStd(o);
    return (base ? _N(o) : "") + (o.analysis ? anNational(o, base) : "");
  };
  secState = function (si, o, first) {
    const base = !o.analysis || hasStd(o);
    return (base ? _S(si, o, first) : "") + (o.analysis ? anState(si, o, base) : "");
  };
  secCounty = function (scope, o) {
    const base = !o.analysis || hasStd(o);
    return (base ? _C(scope, o) : "") + (o.analysis ? anCounty(scope, base) : "");
  };

  /* dashboard shortcut: open the analysis for whatever is currently on screen */
  function openAnalysis() {
    let scope = "nat";
    try {
      if (view !== null) {
        scope = String(view);
        if (selC) {
          const ci = DATA[view].cty.findIndex((c) => K(c.n) === K(selC));
          if (ci >= 0) scope = "county:" + view + ":" + ci;
        }
      }
    } catch (e) {}
    showReport(scope, {
      cover: true,
      analysis: true,
      notes: false,
    });
  }
  const b = document.getElementById("anOpen");
  if (b) b.onclick = openAnalysis;
  window.openAnalysis = openAnalysis;
  window.__an = {
    allRows,
    agg: aggregateBands,
    BANDS,
    insights,
    actions,
  };
  /* running footer printed in the page margin so it never overlaps report content */
  const _show = showReport;
  showReport = function (sc, sec) {
    _show(sc, sec);
    try {
      const t = (document.querySelector("#rep .rbar b") || {}).textContent || "",
        ref = t.replace(/^Report preview\s*·\s*/, ""),
        txt = ((REP && REP.cls) || "Internal") + " · " + ref + " · BM Monitor";
      let st = document.getElementById("rep-page-foot");
      if (!st) {
        st = document.createElement("style");
        st.id = "rep-page-foot";
        document.head.appendChild(st);
      }
      st.textContent =
        '@page{@bottom-left{content:"' +
        txt.replace(/["\\]/g, "") +
        '";font:9px Roboto,Arial,sans-serif;color:#6b7592}}';
    } catch (e) {}
  };
})();
