/*
 * js/field-reports-admin.js
 * ADMIN APP: users, permissions, daily reports, review, targets, MDAs, DCAs, inventory, deployment plan, notifications, backup.
 */

(function () {
  "use strict";

  const USERS_KEY = "bioreg.users",
    REPORTS_KEY = "bioreg.reports",
    DCA_PROFILES_KEY = "bioreg.dcap",
    MDAS_KEY = "bioreg.mdas",
    DCA_LIST_KEY = "bioreg.dcalist",
    MAIN_PROFILE_KEY = "bioreg.mainprof",
    ROLE_LABELS = {
      admin: "Admin",
      subadmin: "Sub admin",
      supervisor: "Supervisor",
      reader: "Reader",
    };
  const selectOne = (s) => document.querySelector(s),
    escapeHtml = (s) =>
      String(s == null ? "" : s).replace(
        /[&<>"]/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
          })[c],
      );
  const loadFromStorage = (k, d) => {
      try {
        return JSON.parse(localStorage.getItem(k)) || d;
      } catch (e) {
        return d;
      }
    },
    saveToStorage = (k, v) => {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {
        toast("Could not save in this browser");
      }
    };
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const toIsoDate = (d) =>
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0"),
    today = () => toIsoDate(new Date()),
    daysAgoIso = (n) => {
      const d = new Date();
      d.setDate(d.getDate() - n);
      return toIsoDate(d);
    };
  let USERS = loadFromStorage(USERS_KEY, []),
    REPORTS = loadFromStorage(REPORTS_KEY, []),
    pageFilters = {
      from: daysAgoIso(29),
      to: today(),
      state: "",
      county: "",
      tst: "",
      site: "",
      q: "29",
      sup: "",
      per: "all",
      grp: "mda",
    },
    editingReportId = null,
    editingSiteTargetId = null,
    siteTargetSearch = "",
    siteTargetState = "",
    siteTargetCounty = "",
    targetMdaFilter = "",
    targetStatusFilter = "",
    targetSupervisorFilter = "",
    targetProgressFilter = "",
    editingDcaId = null,
    dcaSearch = "",
    DS = "",
    dcaStatusFilter = "",
    editingUserId = null,
    pendingPhoto = "",
    dcaProfiles = loadFromStorage(DCA_PROFILES_KEY, {}),
    mainAdminProfile = loadFromStorage(MAIN_PROFILE_KEY, {}),
    mdaRecords = loadFromStorage(MDAS_KEY, []),
    dataCollectors = loadFromStorage(DCA_LIST_KEY, null);
  if (!Array.isArray(dataCollectors)) {
    dataCollectors = [];
    const seen = {},
      add = (n, p) => {
        const k = String(n || "").toLowerCase();
        if (!k || seen[k]) return;
        seen[k] = 1;
        dataCollectors.push(
          Object.assign(
            {
              id: newId(),
              name: n,
              phone: "",
              photo: "",
              status: "Active",
            },
            p || {},
          ),
        );
      };
    SITES.forEach((s) =>
      (s.dcas || []).forEach((n) => {
        const p = dcaProfiles[s.id + "|" + String(n).toLowerCase()] || {};
        add(n, {
          phone: p.phone || "",
          photo: p.photo || "",
          status: p.status || "Active",
        });
      }),
    );
    REPORTS.forEach((r) => r.dcas.forEach((d) => add(d.name)));
    saveToStorage(DCA_LIST_KEY, dataCollectors);
  }
  const dlOpts = () =>
    dataCollectors
      .filter((x) => x.status != "Inactive")
      .map((x) =>
        __tpl("dlOpts.1", `<option value="{{s1: escapeHtml(x.name)}}">`, [
          () => escapeHtml(x.name),
        ]),
      )
      .join("");
  const mainAcc = (u) => {
    const a = getAcc();
    return a && u && a.u.toLowerCase() == u.toLowerCase();
  };
  const currentRole = () => {
    if (!AUTHED) return "";
    if (mainAcc(AUSER)) return "admin";
    const u = USERS.find((x) => x.u.toLowerCase() == AUSER.toLowerCase());
    return u && u.status != "Inactive" ? u.role : "reader";
  };
  window.__role = () => currentRole();
  window.__users = () => USERS;
  window.__saveUsers = () => saveToStorage(USERS_KEY, USERS);
  const currentUserRecord = () =>
    AUTHED && !mainAcc(AUSER)
      ? USERS.find((x) => String(x.u).toLowerCase() == String(AUSER).toLowerCase())
      : null;
  const PMSUP = ["supr", "dcar", "regt", "myrep", "new"],
    PMREAD = ["dash", "supr", "dcar", "rep", "ana", "anl", "mda", "msum", "regt"];
  function permissionDefaults(r) {
    const o = {};
    allTabs.forEach((t) => {
      const k = t[0];
      let v = 0,
        e = 0,
        d = 0;
      if (r == "admin") {
        v = e = d = 1;
      } else if (r == "subadmin") {
        if (k != "users" && k != "myrep") {
          v = e = d = 1;
        }
      } else if (r == "supervisor") {
        if (PMSUP.includes(k)) {
          v = 1;
          e = k == "new" ? 1 : 0;
        }
      } else {
        if (PMREAD.includes(k)) v = 1;
      }
      o[k] = {
        v,
        e,
        d,
      };
    });
    return o;
  }
  function pmOf() {
    if (!AUTHED) return {};
    if (mainAcc(AUSER)) return null;
    const u = currentUserRecord();
    if (!u || u.status == "Inactive") return permissionDefaults("reader");
    const b = permissionDefaults(u.role),
      p = u.perms;
    if (!p) return b;
    const o = {};
    allTabs.forEach((t) => {
      const k = t[0];
      o[k] = p[k]
        ? {
            v: +!!p[k].v,
            e: +!!p[k].e,
            d: +!!p[k].d,
          }
        : {
            v: 0,
            e: 0,
            d: 0,
          };
    });
    return o;
  }
  function canDoAction(tab, act) {
    if (window.__supMode && act == "v" && !["supr", "dcar", "regt", "new"].includes(tab))
      return false;
    const p = pmOf();
    if (p === null) return true;
    const x = p[tab];
    return !!(x && x.v && (act == "v" || x[act]));
  }
  const collectorTypes = ["adm", "nat", "sup"];
  function collectorDefaults(r) {
    return {
      adm: +(r == "admin" || r == "subadmin"),
      nat: 1,
      sup: +(r == "admin" || r == "subadmin" || r == "supervisor"),
    };
  }
  window.__cards = function () {
    if (!AUTHED) return null;
    if (mainAcc(AUSER))
      return {
        adm: 1,
        nat: 1,
        sup: 1,
      };
    const u = currentUserRecord();
    if (!u || u.status == "Inactive") return collectorDefaults("reader");
    const d = collectorDefaults(u.role);
    if (!u.cards) return d;
    const o = {};
    collectorTypes.forEach((k) => (o[k] = +!!u.cards[k]));
    return o;
  };
  const isAdmin = () =>
      currentRole() == "admin" || (canDoAction("users", "e") && currentRole() != "reader"),
    isSubadminOrAdmin = () =>
      isAdmin() ||
      currentRole() == "subadmin" ||
      (() => {
        const u = currentUserRecord();
        return !!(
          u &&
          u.perms &&
          Object.keys(u.perms).some((t) => t != "new" && t != "myrep" && u.perms[t] && u.perms[t].e)
        );
      })(),
    canEnter = () =>
      isSubadminOrAdmin() || currentRole() == "supervisor" || canDoAction("new", "e"),
    canMap = isSubadminOrAdmin;
  const allTabs = [
    ["dash", "Daily dashboard"],
    ["supr", "Supervisor report"],
    ["dcar", "DCA report"],
    ["rep", "Daily reports"],
    ["ana", "Daily analysis"],
    ["anl", "Analytics"],
    ["mda", "MDA registrations"],
    ["msum", "Inventory report"],
    ["regt", "Incident log report"],
    ["myrep", "My report"],
    ["new", "Enter daily report"],
    ["targets", "Site targets"],
    ["mdam", "MDAs"],
    ["inv", "Inventory"],
    ["dplan", "Deployment plan"],
    ["dca", "Data collectors"],
    ["counties", "Counties"],
    ["places", "Cities & towns"],
    ["airports", "Airports"],
    ["sites", "Registration sites"],
    ["roads", "Roads"],
    ["users", "Users & roles"],
    ["bak", "Backup & logo"],
  ];
  const mapDataTables = ["counties", "places", "airports", "sites", "roads"];
  const okTabs = () =>
    allTabs
      .map((t) => t[0])
      .filter((k) => canDoAction(k, "v") && (k != "myrep" || currentRole() == "supervisor"));
  /* ---------- connect to the existing sign-in page, admin page and data ---------- */
  const originalNeedAuth = window.needAuth;
  window.needAuth = (cb) =>
    originalNeedAuth(() => {
      if (canMap()) cb();
      else toast("Your role (" + ROLE_LABELS[currentRole()] + ") cannot edit map data");
    });
  window.openAdmin = (t, qq) => originalNeedAuth(() => openAdminNow(t, qq));
  const originalOpenLogin = window.openLogin;
  window.openLogin = (cb) => {
    originalOpenLogin(cb);
    if (getAcc())
      selectOne("#lg-p").textContent =
        "Sign in with the administrator account or a user account created by the administrator.";
  };
  const originalLoginClick = selectOne("#lg-go").onclick;
  selectOne("#lg-go").onclick = async function () {
    const acc = getAcc(),
      u = selectOne("#lg-u").value.trim(),
      pw = selectOne("#lg-pw").value;
    if (!acc || !u || u.toLowerCase() == acc.u.toLowerCase()) return originalLoginClick.call(this);
    const er = (m) => (selectOne("#lg-e").textContent = m),
      now = Date.now();
    if (now < lockUntil)
      return er("Too many attempts. Try again in " + Math.ceil((lockUntil - now) / 1000) + " s.");
    const x = USERS.find((v) => v.u.toLowerCase() == u.toLowerCase());
    selectOne("#lg-go").disabled = true;
    const ok = x && (await checkPw(x, pw));
    selectOne("#lg-go").disabled = false;
    if (ok && x.status == "Inactive")
      return er("This account is inactive. Contact the administrator.");
    if (ok) return signedIn(x.u);
    failN++;
    if (failN >= 5) {
      lockUntil = Date.now() + 30000;
      failN = 0;
      er("Too many attempts. Locked for 30 seconds.");
    } else er("Incorrect username or password.");
    selectOne("#lg-pw").value = "";
  };
  const originalAdmRender = window.admRender;
  function anlOut() {
    const a = document.getElementById("ana");
    if (a && a.parentNode !== document.body) {
      document.body.appendChild(a);
      a.classList.remove("emb");
      a.hidden = true;
    }
  }
  function anlIn() {
    const a = document.getElementById("ana"),
      h = document.getElementById("anl-host");
    if (!a || !h) return;
    h.appendChild(a);
    a.classList.add("emb");
    if (window.openAnalytics) window.openAnalytics();
  }
  let lastRenderedTab = "";
  window.admRender = function (keep) {
    const R = currentRole(),
      ok = okTabs();
    document.body.dataset.role = R;
    document.body.dataset.main = mainAcc(AUSER) ? "1" : "0";
    if (!ok.includes(ADM.tab)) ADM.tab = ok[0];
    const e = selectOne("#asu");
    if (e) e.textContent = "Signed in as " + AUSER + " · " + ROLE_LABELS[R];
    anlOut();
    /* A page whose #abody has data-static already holds its screen markup: do not draw over it. */
    const staticBody = selectOne("#abody");
    if (staticBody.hasAttribute("data-static") && !staticBody.__lockedHtml) {
      /* the sidebar and top bar are still built, but the screen markup in the file is kept as it is */
      const getHtml = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML").get;
      Object.defineProperty(staticBody, "innerHTML", {
        configurable: true,
        get() {
          return getHtml.call(this);
        },
        set() {},
      });
      staticBody.__lockedHtml = true;
    }
    /* The Deployment plan page redraws itself when a site is added or a state or county is picked.
       Keep the reader where they were instead of jumping to the top of the page. */
    const keepScrollOnThisPage = !!keep && ADM.tab == "dplan" && ADM.tab == lastRenderedTab;
    const scrollBefore = {
      body: selectOne("#abody").scrollTop,
      page: window.scrollY,
      side: selectOne("#atabs") ? selectOne("#atabs").scrollTop : 0,
    };
    lastRenderedTab = ADM.tab;
    if (mapDataTables.includes(ADM.tab)) originalAdmRender(keep);
    else {
      selectOne("#abody").innerHTML =
        '<div class="fr">' +
        {
          dash: renderDashboardView,
          supr: () => renderTeamView("sup"),
          dcar: () => renderTeamView("dca"),
          rep: renderReportsView,
          ana: renderAnalysisView,
          anl: () => '<div id="anl-host"></div>',
          mda: vMda,
          regt: vRegT,
          new: renderEnterReportView,
          myrep: supervisorReviewBarHtml,
          targets: renderTargetsView,
          mdam: renderMdasView,
          msum: renderMdaDevicesSummaryView,
          inv: renderInventoryView,
          dplan: renderDeploymentPlanView,
          dca: renderDcaView,
          users: renderUsersView,
          bak: renderBackupView,
        }[ADM.tab]() +
        "</div>";
      bind();
      selectOne("#abody").scrollTop = keepScrollOnThisPage ? scrollBefore.body : 0;
      if (keepScrollOnThisPage) window.scrollTo(0, scrollBefore.page);
      if (ADM.tab == "anl") anlIn();
    }
    {
      const IC = {
          dash: "bx-bar-chart-alt-2",
          supr: "bx-user-check",
          dcar: "bx-id-card",
          rep: "bx-calendar-check",
          ana: "bx-line-chart",
          anl: "bx-pie-chart-alt-2",
          mda: "bx-buildings",
          regt: "bx-error-circle",
          new: "bx-edit-alt",
          targets: "bx-target-lock",
          mdam: "bx-buildings",
          msum: "bx-package",
          inv: "bx-laptop",
          dplan: "bx-calculator",
          myrep: "bx-folder-open",
          dca: "bx-id-card",
          counties: "bx-map-alt",
          places: "bx-building-house",
          airports: "bxs-plane-alt",
          sites: "bx-map-pin",
          roads: "bx-trip",
          users: "bx-group",
          bak: "bx-data",
        },
        GR = (k) =>
          k == "users" || k == "bak"
            ? "Administration"
            : ["new", "dca", "targets", "mdam", "inv", "dplan"].includes(k)
              ? "Data entry & setup"
              : mapDataTables.includes(k)
                ? "Map data"
                : "Dashboards";
      let last = "";
      const sc0 = selectOne("#atabs").scrollTop;
      selectOne("#atabs").innerHTML = allTabs
        .filter((t) => ok.includes(t[0]))
        .map((t) => {
          const g = GR(t[0]),
            h =
              g != last ? __tpl("admRender.1", `<span class="ag">{{s1: g}}</span>`, [() => g]) : "";
          last = g;
          return (
            h +
            __tpl(
              "admRender.2",
              `<button data-t="{{s1: t[0]}}" class="{{s2: ADM.tab == t[0] ? 'on' : ''}}" title="{{s3: t[1]}}"><span class="ti bx {{s4: IC[t[0]] || 'bx-circle'}}"></span><span class="tl">{{s5: t[1]}}</span>{{s6: mapDataTables.includes(t[0]) ? '…}}</button>`,
              [
                () => t[0],
                () => (ADM.tab == t[0] ? "on" : ""),
                () => t[1],
                () => IC[t[0]] || "bx-circle",
                () => t[1],
                () => (mapDataTables.includes(t[0]) ? " <i>" + admCount(t[0]) + "</i>" : ""),
              ],
            )
          );
        })
        .join("");
      selectOne("#atabs").scrollTop = sc0;
    }
    {
      const t = allTabs.find((x) => x[0] == ADM.tab),
        h = selectOne("#snT");
      if (h && t) h.textContent = t[1];
    }
  };
  selectOne("#atabs").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b && b.dataset.t && !mapDataTables.includes(b.dataset.t)) {
      ADM.tab = b.dataset.t;
      if (b.dataset.t != "new") editingReportId = null;
      editingDcaId = null;
      editingUserId = null;
      admRender();
    }
  });
  selectOne("#amod").addEventListener("change", (e) => {
    if (e.target.id == "am-ss")
      selectOne("#am-sc").innerHTML = window
        .frCnty(e.target.value)
        .map(([k, t]) =>
          __tpl(
            "global.1",
            `<option value="{{s1: escapeHtml(k)}}">{{s2: escapeHtml(t)}}</option>`,
            [() => escapeHtml(k), () => escapeHtml(t)],
          ),
        )
        .join("");
  });
  selectOne("#nFr").onclick = (e) => {
    e.preventDefault();
    ADM.tab = "dash";
    openAdmin("dash");
  };
  /* ---------- shared data helpers (sites come from the existing registration sites) ---------- */
  const states = () => DATA.map((d) => d.n),
    counties = (s) => {
      const d = DATA.find((x) => x.n == s);
      return d ? d.cty.map((c) => c.n) : [];
    };
  const siteStateAndCounty = (s) => {
    if (s._st && s._cn) return [s._st, s._cn];
    const i = stAt(s.lon, s.lat);
    if (i < 0) return ["", ""];
    const c = cntyNear(s.lon, s.lat, i);
    return [DATA[i].n, c ? c.n : ""];
  };
  const siteTarget = (s) => +s.fte || (s._excelKey ? +s.cap || 0 : 0),
    findSite = (i) => SITES.find((s) => s.id == i),
    formatNumber = (n) => (+n || 0).toLocaleString("en-US");
  const siteMdaName = (s) => (s ? s.mda || s.name : "(deleted site)"),
    totalDcas = (r) => r.dcas.reduce((a, d) => a + (+d.n || 0), 0);
  const optionsHtml = (a, v, all) =>
    (all != null
      ? __tpl("optionsHtml.1", `<option value="">{{s1: all}}</option>`, [() => all])
      : "") +
    a
      .map((x) => {
        const [k, l] = Array.isArray(x) ? x : [x, x];
        return __tpl(
          "optionsHtml.2",
          `<option value="{{s1: escapeHtml(k)}}"{{s2: k == v ? ' selected' : ''}}>{{s3: escapeHtml(l)}}</option>`,
          [() => escapeHtml(k), () => (k == v ? " selected" : ""), () => escapeHtml(l)],
        );
      })
      .join("");
  const sitesInCounty = (st, co) =>
    SITES.filter((s) => {
      const l = siteStateAndCounty(s);
      return l[0] == st && (!co || l[1] == co);
    });
  const reviewStatus = (r) => r.rs || "Accepted",
    isReviewLocked = (r) => !isSubadminOrAdmin() && reviewStatus(r) == "Accepted",
    rows = (all) =>
      REPORTS.filter(
        (r) =>
          (reviewStatus(r) != "Rejected" || ADM.tab == "rep") &&
          (all || (r.date >= pageFilters.from && r.date <= pageFilters.to)) &&
          (!pageFilters.site || r.site == pageFilters.site) &&
          (!pageFilters.state ||
            (findSite(r.site) && siteStateAndCounty(findSite(r.site))[0] == pageFilters.state)) &&
          (!pageFilters.county ||
            (findSite(r.site) && siteStateAndCounty(findSite(r.site))[1] == pageFilters.county)) &&
          (!pageFilters.sup || reportSupervisor(r) == pageFilters.sup),
      );
  const mdaList = () =>
    [...new Set([...SITES.map((s) => s.mda || s.name), ...mdaRecords].filter(Boolean))].sort(
      (a, b) => a.localeCompare(b),
    );
  const mdaOpts = (cur) => {
    const a = mdaList(),
      c = String(cur || "").toLowerCase();
    if (cur && !a.some((x) => x.toLowerCase() == c)) a.push(cur);
    return a
      .map((x) =>
        __tpl(
          "mdaOpts.1",
          `<option{{s1: x.toLowerCase() == c ? ' selected…}}>{{s2: escapeHtml(x)}}</option>`,
          [() => (x.toLowerCase() == c ? " selected" : ""), () => escapeHtml(x)],
        ),
      )
      .join("");
  };
  const mrow = (m) =>
    __tpl(
      "mrow.1",
      `<div class="mr"><select class="mm"><option value="">Select MDA</option>{{s1: mdaOpts(m m.mda)}}</select><input type="number" min="0" class="mo" placeholder="Complete" value="{{s2: m m.ok != null ? m.ok : ''}}"><input type="number" min="0" class="mp" placeholder="Pending" value="{{s3: m m.pend != null ? m.pend : ''}}"><input type="number" min="0" class="mf" placeholder="Failed" value="{{s4: m m.fail != null ? m.fail : ''}}"><span class="mt">0</span><button class="btn dg" data-fa="mrm"><i class="bx bx-x"></i></button></div>`,
      [
        () => mdaOpts(m && m.mda),
        () => (m && m.ok != null ? m.ok : ""),
        () => (m && m.pend != null ? m.pend : ""),
        () => (m && m.fail != null ? m.fail : ""),
      ],
    );
  function mdaAgg(R, by) {
    const G = {};
    R.forEach((r) => {
      const s = findSite(r.site) || {},
        u = USERS.find((x) => x.u == r.by),
        sp = r.sup || s.sup || (u && u.role == "supervisor" ? u.name : ""),
        ms =
          r.mdas && r.mdas.length
            ? r.mdas
            : [
                {
                  mda: "Not specified (older reports)",
                  n: totalDcas(r),
                  ok: 0,
                  pend: 0,
                  fail: 0,
                  legacy: 1,
                },
              ];
      ms.forEach((m) => {
        const k = by == "site" ? r.regMda || s.mda || s.name || "deleted site" : m.mda,
          g = (G[k] = G[k] || {
            n: 0,
            ok: 0,
            pend: 0,
            fail: 0,
            leg: 0,
            sup: new Set(),
            dca: new Set(),
            rep: 0,
            st: new Set(),
            co: new Set(),
          });
        {
          const _s = findSite(r.site),
            _l = _s ? siteStateAndCounty(_s) : ["", ""];
          if (_l[0]) g.st.add(_l[0]);
          if (_l[1]) g.co.add(_l[1]);
        }
        g.n += m.n;
        g.ok += m.ok;
        g.pend += m.pend;
        g.fail += m.fail;
        if (m.legacy) g.leg += m.n;
        if (sp) g.sup.add(sp);
        r.dcas.forEach((d) => g.dca.add(d.name.toLowerCase()));
        g.rep++;
      });
    });
    return G;
  }
  function vMda() {
    const by = pageFilters.grp,
      G = mdaAgg(rows(), by),
      E2 = regRows(by),
      sum = (k) => E2.reduce((a, x) => a + x[1][k], 0),
      N = sum("n"),
      OK = sum("ok"),
      PE = sum("pend"),
      FA = sum("fail"),
      LEG = sum("leg"),
      allD = new Set(),
      allS = new Set();
    E2.forEach(([k, g]) => {
      g.dca.forEach((x) => allD.add(x));
      g.sup.forEach((x) => allS.add(x));
    });
    const cl = OK + PE + FA,
      kp = (l, v) =>
        __tpl("kp.1", `<div><small>{{s1: l}}</small><b>{{s2: v}}</b></div>`, [() => l, () => v]);
    return (
      filt(0, 1) +
      __tpl(
        "vMda.4",
        `<div class="flt"><label>Group by<select id="mg">{{s1: optionsHtml( [ ['mda', 'FTE's MDA…}}</select></label><button class="btn" data-fa="mcsv">Export table CSV</button></div></div>
<div class="kp">{{s2: kp('Registrations', formatNumber(…}}{{s3: kp('Complete', formatNumber(OK))}}{{s4: kp('Pending', formatNumber(PE))}}{{s5: kp('Failed', formatNumber(FA))}}{{s6: kp('Success rate', cl ? Math.roun…}}{{s7: kp('Total DCA', allD.size)}}{{s8: kp('Total team (DCAs + supervisor…}}</div>
<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>Registrations by {{s9: by == 'site' ? 'registration site…}}</span>{{s10: exportButtonsHtml('all', 'mda')}}</h3>{{s11: E2.length ? …}}</div>
{{s12: mdaSumCard(0)}}<div class="card"><h3>Registrations chart</h3>{{s13: horizontalBars( Object.entries(G)…}}</div>`,
        [
          () =>
            optionsHtml(
              [
                ["mda", "FTE's MDA (ministry)"],
                ["site", "Registration site MDA"],
              ],
              pageFilters.grp,
            ),
          () => kp("Registrations", formatNumber(N)),
          () => kp("Complete", formatNumber(OK)),
          () => kp("Pending", formatNumber(PE)),
          () => kp("Failed", formatNumber(FA)),
          () => kp("Success rate", cl ? Math.round((OK / cl) * 100) + "%" : "—"),
          () => kp("Total DCA", allD.size),
          () => kp("Total team (DCAs + supervisors)", allD.size + allS.size),
          () => (by == "site" ? "registration site" : "MDA (ministry of the FTEs)"),
          () => exportButtonsHtml("all", "mda"),
          () =>
            E2.length
              ? __tpl(
                  "vMda.3",
                  `<table><thead><tr><th>Date</th><th>{{s1: by == 'site' ? 'Registration site…}}</th><th>State</th><th>County</th><th class="n">Registrations</th><th class="n">Complete</th><th class="n">Pending</th><th class="n">Failed</th><th class="n">Complete %</th><th></th></tr></thead><tbody>{{s2: E2.map(…)}}<tr style="background:rgba(143,162,255,.18);font-weight:800"><td colspan="4">TOTAL</td><td class="n">{{s3: formatNumber(N)}}</td><td class="n">{{s4: formatNumber(OK)}}</td><td class="n">{{s5: formatNumber(PE)}}</td><td class="n">{{s6: formatNumber(FA)}}</td><td class="n">{{s7: cl ? Math.round((OK / cl) * 100)…}}</td><td></td></tr></tbody></table>{{s8: LEG ? …}}`,
                  [
                    () => (by == "site" ? "Registration site" : "Ministry (MDA)"),
                    () =>
                      E2.map(([k, g, d]) => {
                        const c = g.ok + g.pend + g.fail;
                        return __tpl(
                          "vMda.1",
                          `<tr><td>{{s1: d}}</td><td>{{s2: escapeHtml(k)}}</td><td>{{s3: escapeHtml([...(g.st || [])].join…}}</td><td>{{s4: escapeHtml([...(g.co || [])].join…}}</td><td class="n"><b>{{s5: formatNumber(g.n)}}</b></td><td class="n">{{s6: formatNumber(g.ok)}}</td><td class="n">{{s7: formatNumber(g.pend)}}</td><td class="n">{{s8: formatNumber(g.fail)}}</td><td class="n">{{s9: c ? Math.round((g.ok / c) * 100)…}}</td><td class="ac">{{s10: detailsButtonHtml(k, by, d)}}</td></tr>`,
                          [
                            () => d,
                            () => escapeHtml(k),
                            () => escapeHtml([...(g.st || [])].join(", ") || "—"),
                            () => escapeHtml([...(g.co || [])].join(", ") || "—"),
                            () => formatNumber(g.n),
                            () => formatNumber(g.ok),
                            () => formatNumber(g.pend),
                            () => formatNumber(g.fail),
                            () => (c ? Math.round((g.ok / c) * 100) + "%" : "—"),
                            () => detailsButtonHtml(k, by, d),
                          ],
                        );
                      }).join(""),
                    () => formatNumber(N),
                    () => formatNumber(OK),
                    () => formatNumber(PE),
                    () => formatNumber(FA),
                    () => (cl ? Math.round((OK / cl) * 100) + "%" : "—"),
                    () =>
                      LEG
                        ? __tpl(
                            "vMda.2",
                            `<p class="em" style="text-align:left">{{s1: formatNumber(LEG)}} registration(s) come from older reports that have no MDA / status breakdown, so they are not split into Complete, Pending and Failed.</p>`,
                            [() => formatNumber(LEG)],
                          )
                        : "",
                  ],
                )
              : '<p class="em">No reports for these filters.</p>',
          () => mdaSumCard(0),
          () =>
            horizontalBars(
              Object.entries(G)
                .sort((a, b) => b[1].n - a[1].n)
                .map(([k, g]) => [k, g.n]),
              15,
            ),
        ],
      )
    );
  }
  function regRows(by) {
    by = by || "site";
    const DS = [...new Set(rows().map((r) => r.date))].sort().reverse();
    return [].concat(
      ...DS.map((d) =>
        Object.entries(
          mdaAgg(
            rows().filter((r) => r.date == d),
            by,
          ),
        )
          .sort((a, b) => b[1].n - a[1].n)
          .map(([k, g]) => [k, g, d]),
      ),
    );
  }
  let incidentLogFilter = "y",
    incidentLogSearch = "";
  function ilList() {
    return rows()
      .filter((r) => {
        const ms = supervisorNameFor();
        return (
          !ms || String(reportSupervisor(r)).toLowerCase() == ms.toLowerCase() || r.by == AUSER
        );
      })
      .map((r) => {
        const st = findSite(r.site) || {},
          l = st.id != null ? siteStateAndCounty(st) : ["", ""],
          note = String(r.note || "").trim();
        return {
          r,
          note,
          st: l[0] || "",
          co: l[1] || "",
          site: st.name || "",
          mda: r.regMda || st.mda || st.name || "",
          sup: reportSupervisor(r) || "",
          by: r.by || "",
        };
      })
      .filter(
        (x) =>
          (incidentLogFilter == "all" || (incidentLogFilter == "y" ? x.note : !x.note)) &&
          (!incidentLogSearch.trim() ||
            [x.r.date, x.st, x.co, x.site, x.mda, x.sup, x.by, x.note]
              .join(" ")
              .toLowerCase()
              .includes(incidentLogSearch.trim().toLowerCase())),
      )
      .sort((a, b) => (a.r.date < b.r.date ? 1 : a.r.date > b.r.date ? -1 : 0));
  }
  window.__ilr = (el, k) => {
    if (k == "q") {
      incidentLogSearch = el.value;
      const c = document.getElementById("ilr-t");
      if (c) {
        c.innerHTML = ilBody();
        try {
          UIKIT.kick();
        } catch (x) {}
      }
    } else {
      incidentLogFilter = el.value;
      go();
    }
  };
  function ilBody() {
    const L = ilList(),
      all = rows().length,
      wi = rows().filter((r) => String(r.note || "").trim()).length,
      sites = new Set(L.filter((x) => x.note).map((x) => x.r.site)).size,
      kp = (l, v) =>
        __tpl("kp.2", `<div><small>{{s1: l}}</small><b>{{s2: v}}</b></div>`, [() => l, () => v]);
    return __tpl(
      "ilBody.4",
      `<div class="kp">{{s1: kp('Reports with an incident log'…}}{{s2: kp('All reports', formatNumber(al…}}{{s3: kp('Share with incidents', all ?…}}{{s4: kp('Sites affected', formatNumber…}}</div>
<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>Incident log report · {{s5: L.length}}</span>{{s6: exportButtonsHtml('all', 'regt')}}</h3>{{s7: L.length ? …}}</div>`,
      [
        () => kp("Reports with an incident log", formatNumber(wi)),
        () => kp("All reports", formatNumber(all)),
        () => kp("Share with incidents", all ? Math.round((wi / all) * 100) + "%" : "0%"),
        () => kp("Sites affected", formatNumber(sites)),
        () => L.length,
        () => exportButtonsHtml("all", "regt"),
        () =>
          L.length
            ? __tpl(
                "ilBody.3",
                `<table><thead><tr><th>Date</th><th>State</th><th>County</th><th>Registration site</th><th>MDA</th><th>Supervisor</th><th>Entered by</th><th>Incident log</th><th></th></tr></thead><tbody>{{s1: L.map(…)}}</tbody></table>`,
                [
                  () =>
                    L.map((x) =>
                      __tpl(
                        "ilBody.2",
                        `<tr><td>{{s1: escapeHtml(x.r.date)}}</td><td>{{s2: escapeHtml(x.st || '—')}}</td><td>{{s3: escapeHtml(x.co || '—')}}</td><td>{{s4: escapeHtml(x.site || '—')}}</td><td>{{s5: escapeHtml(x.mda || '—')}}</td><td>{{s6: escapeHtml(x.sup || '—')}}</td><td>{{s7: escapeHtml(x.by)}}</td><td style="min-width:260px;white-space:pre-wrap">{{s8: x.note ? …}}</td><td class="ac"><span class="rp-act" style="margin:0;flex-wrap:nowrap"><button type="button" class="btn" data-fa="rv" data-i="{{s9: escapeHtml(x.r.id)}}"><i class="bx bx-show"></i> View</button><button type="button" class="btn" data-fa="rpr" data-i="{{s10: escapeHtml(x.r.id)}}"><i class="bx bx-printer"></i> Print</button></span></td></tr>`,
                        [
                          () => escapeHtml(x.r.date),
                          () => escapeHtml(x.st || "—"),
                          () => escapeHtml(x.co || "—"),
                          () => escapeHtml(x.site || "—"),
                          () => escapeHtml(x.mda || "—"),
                          () => escapeHtml(x.sup || "—"),
                          () => escapeHtml(x.by),
                          () =>
                            x.note
                              ? __tpl(
                                  "ilBody.1",
                                  `<span class="ilg y">Yes</span> {{s1: escapeHtml(x.note)}}`,
                                  [() => escapeHtml(x.note)],
                                )
                              : '<span class="ilg">No</span>',
                          () => escapeHtml(x.r.id),
                          () => escapeHtml(x.r.id),
                        ],
                      ),
                    ).join(""),
                ],
              )
            : '<p class="em">No reports match these filters or this search.</p>',
      ],
    );
  }
  function vRegT() {
    return (
      filt(0, 1) +
      __tpl(
        "vRegT.1",
        `<div class="flt tfbar"><label>Search incident log<input id="ilr-q" type="search" value="{{s1: escapeHtml(incidentLogSearch)}}" placeholder="Search text, site, MDA, state, county, user or date" oninput="window.__ilr(this,'q')" autocomplete="off"></label><label>Show<select id="ilr-s" onchange="window.__ilr(this)">{{s2: optionsHtml( [ ['y', 'Reports wit…}}</select></label></div></div><div id="ilr-t">{{s3: ilBody()}}</div>`,
        [
          () => escapeHtml(incidentLogSearch),
          () =>
            optionsHtml(
              [
                ["y", "Reports with an incident log"],
                ["n", "Reports without an incident log"],
                ["all", "All reports"],
              ],
              incidentLogFilter,
            ),
          () => ilBody(),
        ],
      )
    );
  }
  function vRegTOld() {
    const E2 = regRows(),
      sum = (k) => E2.reduce((a, x) => a + x[1][k], 0),
      N = sum("n"),
      OK = sum("ok"),
      PE = sum("pend"),
      FA = sum("fail"),
      LEG = sum("leg"),
      allD = new Set(),
      allS = new Set();
    E2.forEach(([k, g]) => {
      g.dca.forEach((x) => allD.add(x));
      g.sup.forEach((x) => allS.add(x));
    });
    return (
      filt(0, 1) +
      __tpl(
        "vRegTOld.4",
        `<div class="flt"><button class="btn" data-fa="rcsv">Export table CSV</button></div></div>
<div class="card tw"><h3>Registrations by registration site (ministry where the FTEs were registered)</h3>{{s1: E2.length ? …}}</div>`,
        [
          () =>
            E2.length
              ? __tpl(
                  "vRegTOld.3",
                  `<table><thead><tr><th>Date</th><th>Ministry (MDAs)</th><th class="n">Registrations</th><th class="n">Complete</th><th class="n">Pending</th><th class="n">Failed</th><th>Supervisor name</th><th></th></tr></thead><tbody>{{s1: E2.map(…)}}<tr style="background:rgba(143,162,255,.18);font-weight:800"><td colspan="2">TOTAL</td><td class="n">{{s2: formatNumber(N)}}</td><td class="n">{{s3: formatNumber(OK)}}</td><td class="n">{{s4: formatNumber(PE)}}</td><td class="n">{{s5: formatNumber(FA)}}</td><td>{{s6: escapeHtml([...allS].join(', ') |…}}</td><td></td></tr></tbody></table>{{s7: LEG ? …}}<p class="em" style="text-align:left">The ministry here is the registration site (where the FTEs were registered). It can differ from the FTE's own MDA, which is shown in the "MDA registrations" tab. One row per date and ministry.</p>`,
                  [
                    () =>
                      E2.map(([k, g, d]) =>
                        __tpl(
                          "vRegTOld.1",
                          `<tr><td>{{s1: d}}</td><td>{{s2: escapeHtml(k)}}</td><td class="n"><b>{{s3: formatNumber(g.n)}}</b></td><td class="n">{{s4: formatNumber(g.ok)}}</td><td class="n">{{s5: formatNumber(g.pend)}}</td><td class="n">{{s6: formatNumber(g.fail)}}</td><td>{{s7: escapeHtml([...g.sup].join(', ')…}}</td><td class="ac">{{s8: detailsButtonHtml(k, 'site', d)}}</td></tr>`,
                          [
                            () => d,
                            () => escapeHtml(k),
                            () => formatNumber(g.n),
                            () => formatNumber(g.ok),
                            () => formatNumber(g.pend),
                            () => formatNumber(g.fail),
                            () => escapeHtml([...g.sup].join(", ") || "—"),
                            () => detailsButtonHtml(k, "site", d),
                          ],
                        ),
                      ).join(""),
                    () => formatNumber(N),
                    () => formatNumber(OK),
                    () => formatNumber(PE),
                    () => formatNumber(FA),
                    () => escapeHtml([...allS].join(", ") || "—"),
                    () =>
                      LEG
                        ? __tpl(
                            "vRegTOld.2",
                            `<p class="em" style="text-align:left">{{s1: formatNumber(LEG)}} registration(s) come from older reports with no Complete / Pending / Failed breakdown.</p>`,
                            [() => formatNumber(LEG)],
                          )
                        : "",
                  ],
                )
              : '<p class="em">No reports for these filters.</p>',
        ],
      )
    );
  }
  function rcsvx() {
    const c = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"',
      L = [
        [
          "Date",
          "Ministry (MDAs)",
          "Registrations",
          "Complete",
          "Pending",
          "Failed",
          "Supervisor name",
        ],
      ];
    regRows().forEach(([k, g, d]) =>
      L.push([d, k, g.n, g.ok, g.pend, g.fail, [...g.sup].join("; ")]),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + L.map((r) => r.map(c).join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
    a.download = `registration-table_${pageFilters.from}_to_${pageFilters.to}.csv`;
    a.click();
  }
  function mcsv() {
    const G = mdaAgg(rows(), pageFilters.grp),
      c = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"',
      L = [
        [
          "Date",
          pageFilters.grp == "site" ? "Registration site" : "Ministry (MDA)",
          "Registrations",
          "Complete",
          "Pending",
          "Failed",
          "Supervisor",
          "Total DCA",
          "Total team",
        ],
      ];
    regRows(pageFilters.grp).forEach(([k, g, d]) =>
      L.push([
        d,
        k,
        g.n,
        g.ok,
        g.pend,
        g.fail,
        [...g.sup].join("; "),
        g.dca.size,
        g.dca.size + g.sup.size,
      ]),
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + L.map((r) => r.map(c).join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
    a.download = `registrations-by-${pageFilters.grp}_${pageFilters.from}_to_${pageFilters.to}.csv`;
    a.click();
  }
  const sumNew = () => {
    const dv = [...document.querySelectorAll("#ndr .dv")].reduce((a, x) => a + (+x.value || 0), 0);
    let mt = 0;
    document.querySelectorAll("#mdr .mr:not(.mh)").forEach((r) => {
      const t =
        (+r.querySelector(".mo").value || 0) +
        (+r.querySelector(".mp").value || 0) +
        (+r.querySelector(".mf").value || 0);
      r.querySelector(".mt").textContent = t;
      mt += t;
    });
    selectOne("#nsum").innerHTML = __tpl(
      "sumNew.1",
      `Registered by DCAs: <b>{{s1: formatNumber(dv)}}</b> ({{s2: document.querySelectorAll('#ndr .…}} DCA) · Registered by MDA: <b>{{s3: formatNumber(mt)}}</b>{{s4: dv == mt ? ' span style='color:va…}}`,
      [
        () => formatNumber(dv),
        () => document.querySelectorAll("#ndr .dr").length,
        () => formatNumber(mt),
        () =>
          dv == mt
            ? ' <span style="color:var(--g)"><i class="bx bx-check"></i> totals match</span>'
            : ' <span style="color:var(--r)">— the two totals must be equal</span>',
      ],
    );
  };
  const supList = (cur) => {
    const a = USERS.filter((u) => u.role == "supervisor" && u.status != "Inactive").map(
      (u) => u.name,
    );
    if (cur && !a.includes(cur)) a.push(cur);
    return a.sort();
  };
  window.frMdaDL = () =>
    '<datalist id="mdal">' +
    mdaList()
      .map((m) =>
        __tpl("frMdaDL.1", `<option value="{{s1: escapeHtml(m)}}">`, [() => escapeHtml(m)]),
      )
      .join("") +
    "</datalist>";
  window.frSupOpts = (cur) => [["", "Select supervisor"]].concat(supList(cur).map((n) => [n, n]));
  window.frLoc = siteStateAndCounty;
  window.frCnty = (st) => [["", "Select county"]].concat(counties(st).map((n) => [n, n]));
  const dcaOpts = (n) => {
    const a = dataCollectors.filter((x) => x.status != "Inactive").map((x) => x.name),
      c = String(n || "").toLowerCase();
    if (n && !a.some((x) => x.toLowerCase() == c)) a.push(n);
    return a
      .sort()
      .map((x) =>
        __tpl(
          "dcaOpts.1",
          `<option{{s1: x.toLowerCase() == c ? ' selected…}}>{{s2: escapeHtml(x)}}</option>`,
          [() => (x.toLowerCase() == c ? " selected" : ""), () => escapeHtml(x)],
        ),
      )
      .join("");
  };
  function filt(pe, open) {
    const dis = pe && pageFilters.per != "range" ? "disabled" : "";
    return __tpl(
      "filt.4",
      `<div class="card fcard"><div class="flt"><label>Date range<span class="drp-box"><i class="bx bx-calendar"></i><input id="fdr" type="text" readonly autocomplete="off" {{s1: dis}}></span></label><button type="button" class="btn" data-fa="frst" title="Reset the dates to the last 30 days" {{s2: dis}}><i class="bx bx-reset"></i> Reset dates</button><button type="button" class="btn" data-fa="fall" title="Clear the dates and every filter"><i class="bx bx-reset"></i> Reset filters</button>{{s3: pe ? …}}<label>State<select id="fs">{{s4: optionsHtml(states(), pageFilters…}}</select></label><label>County<select id="fc">{{s5: optionsHtml(pageFilters.state ? c…}}</select></label><label>Registration site<select id="fi">{{s6: optionsHtml( (pageFilters.state ?…}}</select></label>{{s7: ADM.tab == 'dcar' ? …}}<button class="btn" data-fa="csv">Export CSV</button></div>{{s8: open ? '' : ' /div '}}`,
      [
        () => dis,
        () => dis,
        () =>
          pe
            ? __tpl(
                "filt.1",
                `<label>Analyse<select id="fpd">{{s1: optionsHtml( [ ['all', 'All time…}}</select></label>`,
                [
                  () =>
                    optionsHtml(
                      [
                        ["all", "All time since start"],
                        ["range", "Selected dates only"],
                      ],
                      pageFilters.per,
                    ),
                ],
              )
            : "",
        () => optionsHtml(states(), pageFilters.state, "All states"),
        () =>
          optionsHtml(
            pageFilters.state ? counties(pageFilters.state) : [],
            pageFilters.county,
            pageFilters.state ? "All counties" : "Select a state first",
          ),
        () =>
          optionsHtml(
            (pageFilters.state
              ? sitesInCounty(pageFilters.state, pageFilters.county)
              : SITES.filter((s) => REPORTS.some((r) => r.site == s.id) || siteTarget(s))
            ).map((s) => [s.id, s.name + (s.mda ? " · " + s.mda : "")]),
            pageFilters.site,
            "All sites",
          ),
        () =>
          ADM.tab == "dcar"
            ? __tpl(
                "filt.2",
                `<label>DCA<select id="fdca">{{s1: optionsHtml([['', 'All DCAs']].co…}}</select></label>`,
                [
                  () =>
                    optionsHtml(
                      [["", "All DCAs"]].concat(
                        actData("dca", activityFilters.yr).map((e) => [e.key, e.name]),
                      ),
                      activityFilters.dca,
                    ),
                ],
              )
            : __tpl(
                "filt.3",
                `<label>Supervisor<select id="fp">{{s1: optionsHtml(supList(), pageFilter…}}</select></label>`,
                [() => optionsHtml(supList(), pageFilters.sup, "All supervisors")],
              ),
        () => (open ? "" : "</div>"),
      ],
    );
  }
  /* ---------- daily analysis ---------- */
  function agg(R) {
    const D = {},
      C = {},
      S = {},
      P = {},
      W = [0, 0, 0, 0, 0, 0, 0];
    R.forEach((r) => {
      const s = findSite(r.site) || {},
        t = totalDcas(r),
        d = (D[r.date] = D[r.date] || {
          rep: 0,
          sites: new Set(),
          dcas: new Set(),
          n: 0,
        });
      d.rep++;
      d.sites.add(r.site);
      d.n += t;
      W[(new Date(r.date + "T00:00:00").getDay() + 6) % 7] += t;
      const sp = r.sup || s.sup || "Not assigned",
        p = (P[sp] = P[sp] || {
          rep: 0,
          n: 0,
          sites: new Set(),
          dcas: new Set(),
        });
      p.rep++;
      p.n += t;
      p.sites.add(r.site);
      const q = (S[r.site] = S[r.site] || {
        n: 0,
        rep: 0,
        dcas: new Set(),
      });
      q.n += t;
      q.rep++;
      r.dcas.forEach((x) => {
        const k = x.name.toLowerCase(),
          n = +x.n || 0,
          c = (C[k] = C[k] || {
            name: x.name,
            n: 0,
            days: {},
            sites: new Set(),
            first: r.date,
            last: r.date,
          });
        c.n += n;
        c.days[r.date] = (c.days[r.date] || 0) + n;
        c.sites.add(r.site);
        if (r.date < c.first) c.first = r.date;
        if (r.date > c.last) c.last = r.date;
        d.dcas.add(k);
        p.dcas.add(k);
        q.dcas.add(k);
      });
    });
    return {
      D,
      C,
      S,
      P,
      W,
    };
  }
  function lineChartHtml(a) {
    if (a.length < 2) return '<p class="em">Need at least two reporting days.</p>';
    return apxEl(
      {
        t: "area",
        data: a.map((x) => x[1]),
        cats: a.map((x) => x[0].slice(5)),
        tt: a.map((x) => x[0]),
        col: "var(--v)",
      },
      230,
    );
  }
  function renderAnalysisView() {
    const R = rows(pageFilters.per != "range"),
      G = agg(R),
      dk = Object.keys(G.D).sort(),
      T = R.reduce((a, r) => a + totalDcas(r), 0),
      dl = Object.values(G.C).sort((a, b) => b.n - a.n),
      dp = (n) => dataCollectors.find((x) => x.name.toLowerCase() == n.toLowerCase()) || {};
    const dcaDays = dl.reduce((a, c) => a + Object.keys(c.days).length, 0),
      peak = dk.reduce((a, k) => (G.D[k].n > (a ? G.D[a].n : -1) ? k : a), "");
    const sl = SITES.filter(
        (s) =>
          siteTarget(s) &&
          (!pageFilters.site || s.id == pageFilters.site) &&
          (!pageFilters.state || siteStateAndCounty(s)[0] == pageFilters.state) &&
          (!pageFilters.county || siteStateAndCounty(s)[1] == pageFilters.county) &&
          (!pageFilters.sup || s.sup == pageFilters.sup),
      ),
      tg = sl.reduce((a, s) => a + siteTarget(s), 0),
      ids = new Set(sl.map((s) => s.id)),
      dn = REPORTS.filter((r) => ids.has(r.site)).reduce((a, r) => a + totalDcas(r), 0),
      rem = Math.max(0, tg - dn);
    const pace =
      rows(true)
        .filter((r) => r.date >= daysAgoIso(6))
        .reduce((a, r) => a + totalDcas(r), 0) / 7;
    let fin = "—";
    if (rem && pace > 0) {
      const d = new Date();
      d.setDate(d.getDate() + Math.ceil(rem / pace));
      fin = toIsoDate(d);
    } else if (tg && !rem) fin = "Target reached";
    let cum = 0,
      prev = null;
    const asc = dk.map((k) => {
        const d = G.D[k];
        cum += d.n;
        const o = {
          k,
          d,
          cum,
          dl: prev == null ? null : d.n - prev,
        };
        prev = d.n;
        return o;
      }),
      top = dl.slice(0, 15),
      mdates = dk.slice().reverse().slice(0, 60);
    const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      kp = (l, v, sm) =>
        __tpl(
          "kp.3",
          `<div><small>{{s1: l}}</small><b{{s2: sm ? ' style='font-size:1rem'' :…}}>{{s3: v}}</b></div>`,
          [() => l, () => (sm ? ' style="font-size:1rem"' : ""), () => v],
        );
    return (
      filt(true) +
      __tpl(
        "renderAnalysisView.11",
        `<div class="kp">{{s1: kp('Total registered', formatNumb…}}{{s2: kp('Days with reports', dk.length)}}{{s3: kp('First to last report', (dk[0]…}}{{s4: kp('Average per reporting day', f…}}{{s5: kp('Peak day', peak ? peak + ' ·…}}{{s6: kp('DCAs used', dl.length)}}{{s7: kp('Avg DCAs per day', dk.length…}}{{s8: kp('Avg per DCA per day', dcaDays…}}{{s9: kp('Remaining to target', tg ? fo…}}{{s10: kp('Projected finish (last 7-day…}}</div>
<div class="flt"><button class="btn" data-fa="acsv">Export analysis CSV</button></div>
<div class="g2"><div class="card"><h3>Registrations per day</h3>{{s11: weekdayChart(dk.map(…)}}</div><div class="card"><h3>DCAs used per day</h3>{{s12: weekdayChart(dk.map(…)}}</div><div class="card"><h3>Cumulative registrations</h3>{{s13: lineChartHtml(asc.map(…)}}</div><div class="card"><h3>Registered by each DCA</h3>{{s14: horizontalBars( dl.map(…)}}</div><div class="card"><h3>Registrations by weekday (Monday to Friday)</h3>{{s15: horizontalBars( WD.slice(0, 5).ma…}}</div><div class="card"><h3>By supervisor</h3>{{s16: horizontalBars( Object.entries(G.…}}</div></div>
{{s17: mdaCard('mda', pageFilters.per !=…}}{{s18: mdaSumCard(pageFilters.per != 'ra…}}
<div class="card tw"><h3>Performance of each DCA {{s19: pageFilters.per == 'range' ? '(se…}}</h3>{{s20: dl.length ? …}}</div>
<div class="card tw"><h3>Date × DCA: registrations by each DCA per day <small style="color:var(--mu)">(top {{s21: top.length}} DCAs, latest {{s22: mdates.length}} days)</small></h3>{{s23: top.length ? …}}</div>
<div class="g2"><div class="card tw"><h3>By supervisor</h3>{{s24: Object.keys(G.P).length ? …}}</div>
<div class="card tw"><h3>By registration site</h3>{{s25: Object.keys(G.S).length ? …}}</div></div>`,
        [
          () => kp("Total registered", formatNumber(T)),
          () => kp("Days with reports", dk.length),
          () =>
            kp(
              "First to last report",
              (dk[0] || "—") + " to " + (dk.length ? dk[dk.length - 1] : "—"),
              1,
            ),
          () =>
            kp(
              "Average per reporting day",
              formatNumber(dk.length ? Math.round(T / dk.length) : 0),
            ),
          () => kp("Peak day", peak ? peak + " · " + formatNumber(G.D[peak].n) : "—", 1),
          () => kp("DCAs used", dl.length),
          () => kp("Avg DCAs per day", dk.length ? (dcaDays / dk.length).toFixed(1) : 0),
          () => kp("Avg per DCA per day", dcaDays ? formatNumber(Math.round(T / dcaDays)) : 0),
          () => kp("Remaining to target", tg ? formatNumber(rem) : "—"),
          () => kp("Projected finish (last 7-day pace)", fin, 1),
          () => weekdayChart(dk.map((k) => [k, G.D[k].n])),
          () => weekdayChart(dk.map((k) => [k, G.D[k].dcas.size])),
          () => lineChartHtml(asc.map((x) => [x.k, x.cum])),
          () =>
            horizontalBars(
              dl.map((c) => [c.name, c.n]),
              12,
            ),
          () =>
            horizontalBars(
              WD.slice(0, 5).map((n, i) => [n, G.W[i]]),
              5,
              1,
            ),
          () =>
            horizontalBars(
              Object.entries(G.P).map(([k, v]) => [k, v.n]),
              10,
            ),
          () => mdaCard("mda", pageFilters.per != "range", "mdaa"),
          () => mdaSumCard(pageFilters.per != "range"),
          () => (pageFilters.per == "range" ? "(selected dates)" : "(since start up to now)"),
          () =>
            dl.length
              ? __tpl(
                  "renderAnalysisView.2",
                  `<table><thead><tr><th>#</th><th></th><th>DCA</th><th>Phone</th><th class="n">Days worked</th><th class="n">Sites</th><th class="n">Registered</th><th class="n">Avg / day</th><th>Best day</th><th>First report</th><th>Last report</th><th class="n">Share</th></tr></thead><tbody>{{s1: dl .map(…)}}</tbody></table>`,
                  [
                    () =>
                      dl
                        .map((c, i) => {
                          const ds = Object.keys(c.days),
                            b = ds.reduce((a, k) => (c.days[k] > (a ? c.days[a] : -1) ? k : a), "");
                          return __tpl(
                            "renderAnalysisView.1",
                            `<tr><td>{{s1: i + 1}}</td><td>{{s2: avatarHtml(dp(c.name).photo, c.na…}}</td><td>{{s3: escapeHtml(c.name)}}</td><td>{{s4: escapeHtml(dp(c.name).phone || '—…}}</td><td class="n">{{s5: ds.length}}</td><td class="n">{{s6: c.sites.size}}</td><td class="n"><b>{{s7: formatNumber(c.n)}}</b></td><td class="n">{{s8: formatNumber(Math.round(c.n / ds.…}}</td><td>{{s9: b}} · {{s10: formatNumber(c.days[b])}}</td><td>{{s11: c.first}}</td><td>{{s12: c.last}}</td><td class="n">{{s13: T ? Math.round((c.n / T) * 100) :…}}%</td></tr>`,
                            [
                              () => i + 1,
                              () => avatarHtml(dp(c.name).photo, c.name),
                              () => escapeHtml(c.name),
                              () => escapeHtml(dp(c.name).phone || "—"),
                              () => ds.length,
                              () => c.sites.size,
                              () => formatNumber(c.n),
                              () => formatNumber(Math.round(c.n / ds.length)),
                              () => b,
                              () => formatNumber(c.days[b]),
                              () => c.first,
                              () => c.last,
                              () => (T ? Math.round((c.n / T) * 100) : 0),
                            ],
                          );
                        })
                        .join(""),
                  ],
                )
              : '<p class="em">No DCA data.</p>',
          () => top.length,
          () => mdates.length,
          () =>
            top.length
              ? __tpl(
                  "renderAnalysisView.6",
                  `<table><thead><tr><th>Date</th>{{s1: top.map(…)}}<th class="n">Total</th></tr></thead><tbody>{{s2: mdates.map(…)}}</tbody></table>`,
                  [
                    () =>
                      top
                        .map((c) =>
                          __tpl(
                            "renderAnalysisView.3",
                            `<th class="n">{{s1: escapeHtml(c.name)}}</th>`,
                            [() => escapeHtml(c.name)],
                          ),
                        )
                        .join(""),
                    () =>
                      mdates
                        .map((k) =>
                          __tpl(
                            "renderAnalysisView.5",
                            `<tr><td>{{s1: k}}</td>{{s2: top.map(…)}}<td class="n"><b>{{s3: formatNumber(G.D[k].n)}}</b></td></tr>`,
                            [
                              () => k,
                              () =>
                                top
                                  .map((c) =>
                                    __tpl(
                                      "renderAnalysisView.4",
                                      `<td class="n">{{s1: c.days[k] ? formatNumber(c.days[k…}}</td>`,
                                      [() => (c.days[k] ? formatNumber(c.days[k]) : "·")],
                                    ),
                                  )
                                  .join(""),
                              () => formatNumber(G.D[k].n),
                            ],
                          ),
                        )
                        .join(""),
                  ],
                )
              : '<p class="em">No data.</p>',
          () =>
            Object.keys(G.P).length
              ? __tpl(
                  "renderAnalysisView.8",
                  `<table><thead><tr><th>Supervisor</th><th class="n">Reports</th><th class="n">Sites</th><th class="n">DCAs</th><th class="n">Registered</th></tr></thead><tbody>{{s1: Object.entries( G.P, ) .sort((a,…}}</tbody></table>`,
                  [
                    () =>
                      Object.entries(G.P)
                        .sort((a, b) => b[1].n - a[1].n)
                        .map(([k, v]) =>
                          __tpl(
                            "renderAnalysisView.7",
                            `<tr><td>{{s1: escapeHtml(k)}}</td><td class="n">{{s2: v.rep}}</td><td class="n">{{s3: v.sites.size}}</td><td class="n">{{s4: v.dcas.size}}</td><td class="n"><b>{{s5: formatNumber(v.n)}}</b></td></tr>`,
                            [
                              () => escapeHtml(k),
                              () => v.rep,
                              () => v.sites.size,
                              () => v.dcas.size,
                              () => formatNumber(v.n),
                            ],
                          ),
                        )
                        .join(""),
                  ],
                )
              : '<p class="em">No data.</p>',
          () =>
            Object.keys(G.S).length
              ? __tpl(
                  "renderAnalysisView.10",
                  `<table><thead><tr><th>Site / MDA</th><th>County</th><th class="n">Reports</th><th class="n">DCAs</th><th class="n">Registered</th><th class="n">Target</th><th class="n">%</th></tr></thead><tbody>{{s1: Object.entries( G.S, ) .sort((a,…}}</tbody></table>`,
                  [
                    () =>
                      Object.entries(G.S)
                        .sort((a, b) => b[1].n - a[1].n)
                        .slice(0, 60)
                        .map(([k, v]) => {
                          const s = findSite(k) || {},
                            t = s.id ? siteTarget(s) : 0;
                          return __tpl(
                            "renderAnalysisView.9",
                            `<tr><td>{{s1: escapeHtml(s.mda || s.name || 'de…}}{{s2: s.mda ? ' br small ' + escapeHtml…}}</td><td>{{s3: escapeHtml(s.id ? siteStateAndCou…}}</td><td class="n">{{s4: v.rep}}</td><td class="n">{{s5: v.dcas.size}}</td><td class="n"><b>{{s6: formatNumber(v.n)}}</b></td><td class="n">{{s7: t ? formatNumber(t) : '—'}}</td><td class="n">{{s8: t ? Math.round((v.n / t) * 100) +…}}</td></tr>`,
                            [
                              () => escapeHtml(s.mda || s.name || "deleted"),
                              () => (s.mda ? "<br><small>" + escapeHtml(s.name) + "</small>" : ""),
                              () => escapeHtml(s.id ? siteStateAndCounty(s)[1] : ""),
                              () => v.rep,
                              () => v.dcas.size,
                              () => formatNumber(v.n),
                              () => (t ? formatNumber(t) : "—"),
                              () => (t ? Math.round((v.n / t) * 100) + "%" : "—"),
                            ],
                          );
                        })
                        .join(""),
                  ],
                )
              : '<p class="em">No data.</p>',
        ],
      )
    );
  }
  function acsv() {
    const R = rows(pageFilters.per != "range"),
      G = agg(R),
      c = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"',
      L = [["BY DATE"], ["Date", "Reports", "Sites", "DCAs used", "Registered"]];
    Object.keys(G.D)
      .sort()
      .forEach((k) => {
        const d = G.D[k];
        L.push([k, d.rep, d.sites.size, d.dcas.size, d.n]);
      });
    L.push(
      [],
      ["BY DCA"],
      [
        "DCA",
        "Days worked",
        "Sites",
        "Total registered",
        "Avg per day",
        "First report",
        "Last report",
      ],
    );
    Object.values(G.C)
      .sort((a, b) => b.n - a.n)
      .forEach((x) => {
        const n = Object.keys(x.days).length;
        L.push([x.name, n, x.sites.size, x.n, Math.round(x.n / n), x.first, x.last]);
      });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + L.map((r) => r.map(c).join(",")).join("\n")], {
        type: "text/csv",
      }),
    );
    a.download = "daily-registration-analysis.csv";
    a.click();
  }
  /* ---------- supervisor / DCA activity reports (dashboard) ---------- */
  const activityFilters = {
      yr: String(new Date().getFullYear()),
      sup: "",
      dca: "",
      mda: "",
      met: "n",
    },
    MONTH_NAMES = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
  const supervisorNameFor = () => {
    if (currentRole() != "supervisor") return "";
    const u = USERS.find((x) => x.u.toLowerCase() == AUSER.toLowerCase());
    return u ? u.name : "";
  };
  function actData(kind, yr, rg) {
    const ms = supervisorNameFor(),
      R = rows(true).filter(
        (r) =>
          (rg
            ? r.date >= pageFilters.from && r.date <= pageFilters.to
            : String(r.date).slice(0, 4) == yr) &&
          (!ms || reportSupervisor(r) == ms),
      ),
      M = new Map();
    const add = (key, name, date, n, sid) => {
      let e = M.get(key);
      if (!e) {
        e = {
          key,
          name,
          n: 0,
          rep: 0,
          days: {},
          sites: new Set(),
          first: date,
          last: date,
        };
        M.set(key, e);
      }
      e.n += n;
      e.rep++;
      const d = (e.days[date] = e.days[date] || {
        n: 0,
        rep: 0,
      });
      d.n += n;
      d.rep++;
      e.sites.add(sid);
      if (date < e.first) e.first = date;
      if (date > e.last) e.last = date;
    };
    R.forEach((r) => {
      if (kind == "sup") {
        const s = findSite(r.site) || {},
          k = r.sup || s.sup || "Not assigned";
        add(k, k, r.date, totalDcas(r), r.site);
      } else if (kind == "mda")
        (r.mdas || []).forEach((m) =>
          add(
            String(m.mda).toLowerCase(),
            m.mda,
            r.date,
            +m.n || (+m.ok || 0) + (+m.pend || 0) + (+m.fail || 0),
            r.site,
          ),
        );
      else
        r.dcas.forEach((d) => add(String(d.name).toLowerCase(), d.name, r.date, +d.n || 0, r.site));
    });
    return [...M.values()].sort((a, b) => b.n - a.n);
  }
  const dpp = (n) =>
    dataCollectors.find((x) => x.name.toLowerCase() == String(n).toLowerCase()) || {};
  function actSel(L0, sel) {
    const L = sel ? L0.filter((e) => e.key == sel) : L0,
      days = {};
    L.forEach((e) =>
      Object.entries(e.days).forEach(([d, v]) => {
        const x = (days[d] = days[d] || {
          n: 0,
          rep: 0,
          act: 0,
        });
        x.n += v.n;
        x.rep += v.rep;
        x.act++;
      }),
    );
    return {
      L,
      days,
    };
  }
  function reportingStreak(ds) {
    let b = 0,
      c = 0,
      p = null;
    ds.slice()
      .sort()
      .forEach((k) => {
        const t = new Date(k + "T00:00:00").getTime();
        c = p != null && Math.round((t - p) / 864e5) == 1 ? c + 1 : 1;
        p = t;
        if (c > b) b = c;
      });
    return b;
  }
  function calendarSvg(days, yr, met) {
    const y = +yr,
      start = new Date(y, 0, 1),
      end = new Date(y, 11, 31),
      off = (start.getDay() + 6) % 7,
      cell = 13,
      gap = 3,
      step = cell + gap,
      left = 30,
      top = 20,
      nd = Math.round((end - start) / 864e5) + 1,
      weeks = Math.ceil((off + nd) / 7),
      W = left + weeks * step + 6,
      H = top + 7 * step + 6,
      td = today();
    const mx = Math.max(1, ...Object.values(days).map((v) => (met == "act" ? v.act : v.n))),
      col = (v) => (v ? "var(--cal" + Math.min(4, Math.ceil((v / mx) * 4)) + ")" : "var(--cal0)");
    let o = __tpl(
      "calendarSvg.1",
      `<svg viewBox="0 0 {{s1: W}} {{s2: H}}" class="cal" role="img" aria-label="Activity calendar {{s3: y}}">`,
      [() => W, () => H, () => y],
    );
    for (let m = 0; m < 12; m++) {
      const d = new Date(y, m, 1),
        wk = Math.floor((off + Math.round((d - start) / 864e5)) / 7);
      o += __tpl(
        "calendarSvg.2",
        `<text x="{{s1: left + wk * step}}" y="12" class="cal-t">{{s2: MONTH_NAMES[m]}}</text>`,
        [() => left + wk * step, () => MONTH_NAMES[m]],
      );
    }
    ["Mon", "Wed", "Fri"].forEach(
      (t, i) =>
        (o += __tpl(
          "calendarSvg.3",
          `<text x="0" y="{{s1: top + i * 2 * step + cell - 2}}" class="cal-t">{{s2: t}}</text>`,
          [() => top + i * 2 * step + cell - 2, () => t],
        )),
    );
    for (let i = 0; i < nd; i++) {
      const d = new Date(y, 0, 1 + i),
        k =
          y +
          "-" +
          String(d.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(d.getDate()).padStart(2, "0"),
        pos = off + i,
        wk = Math.floor(pos / 7),
        dow = pos % 7,
        v = days[k],
        val = v ? (met == "act" ? v.act : v.n) : 0,
        fut = k > td;
      o += __tpl(
        "calendarSvg.4",
        `<rect x="{{s1: left + wk * step}}" y="{{s2: top + dow * step}}" width="{{s3: cell}}" height="{{s4: cell}}" rx="3" style="fill:{{s5: fut ? 'var(--cal0)' : col(val)}}"{{s6: fut ? ' opacity='.35'' : ''}}><title>{{s7: k}}{{s8: v ? ': ' + formatNumber(v.n) + '…}}</title></rect>`,
        [
          () => left + wk * step,
          () => top + dow * step,
          () => cell,
          () => cell,
          () => (fut ? "var(--cal0)" : col(val)),
          () => (fut ? ' opacity=".35"' : ""),
          () => k,
          () =>
            v
              ? ": " +
                formatNumber(v.n) +
                " registered · " +
                v.rep +
                " report" +
                (v.rep > 1 ? "s" : "") +
                " · " +
                v.act +
                " active"
              : ": no activity",
        ],
      );
    }
    return o + "</svg>";
  }
  function monthBarsHtml(vals, cls) {
    return apxEl(
      {
        t: "bar",
        data: vals,
        cats: MONTH_NAMES.slice(0, 12),
        tt: MONTH_NAMES.slice(0, 12),
        col: cls == "bar2" ? "#198754" : "var(--v)",
        dl: 1,
      },
      190,
    );
  }
  function actCtl() {
    const ys = [
      ...new Set(
        REPORTS.map((r) => String(r.date).slice(0, 4)).concat([String(new Date().getFullYear())]),
      ),
    ]
      .sort()
      .reverse();
    return __tpl(
      "actCtl.1",
      `<div class="card fcard actc"><div class="flt"><b style="align-self:center">Activity through the year</b><label>Year<select id="ay">{{s1: optionsHtml( ys.map(…)}}</select></label><label>Colour the calendar by<select id="acm">{{s2: optionsHtml( [ ['n', 'Registratio…}}</select></label></div></div>`,
      [
        () =>
          optionsHtml(
            ys.map((y) => [y, y]),
            activityFilters.yr,
          ),
        () =>
          optionsHtml(
            [
              ["n", "Registrations per day"],
              ["act", "People active per day"],
            ],
            activityFilters.met,
          ),
      ],
    );
  }
  function renderActivityView(kind, rg) {
    const sup = kind == "sup",
      NM = {
        sup: "Supervisor",
        dca: "DCA",
        mda: "MDA",
      }[kind],
      PL = {
        sup: "supervisors",
        dca: "DCAs",
        mda: "MDAs",
      }[kind],
      SG = {
        sup: "supervisor",
        dca: "DCA",
        mda: "MDA",
      }[kind],
      IC = {
        sup: "bx-user-check",
        dca: "bx-id-card",
        mda: "bx-buildings",
      }[kind],
      nm = NM,
      LY = actData(kind, activityFilters.yr),
      L0 = rg ? actData(kind, activityFilters.yr, 1) : LY,
      sel = activityFilters[kind],
      { L, days } = actSel(L0, sel),
      cdays = rg ? actSel(LY, sel).days : days,
      dk = Object.keys(days).sort(),
      N = dk.reduce((a, k) => a + days[k].n, 0),
      REP = dk.reduce((a, k) => a + days[k].rep, 0),
      mon = Array(12).fill(0),
      amon = Array(12).fill(0);
    dk.forEach((k) => {
      const m = +k.slice(5, 7) - 1;
      mon[m] += days[k].n;
      amon[m]++;
    });
    const y = +activityFilters.yr,
      now = new Date(),
      yd = rg
        ? Math.max(
            1,
            Math.round(
              (new Date(Math.min(+new Date(pageFilters.to + "T00:00:00"), +now)) -
                new Date(pageFilters.from + "T00:00:00")) /
                864e5,
            ) + 1,
          )
        : y == now.getFullYear()
          ? Math.floor((now - new Date(y, 0, 1)) / 864e5) + 1
          : Math.round((new Date(y, 11, 31) - new Date(y, 0, 1)) / 864e5) + 1,
      kp = (l, v) =>
        __tpl("kp.4", `<div><small>{{s1: l}}</small><b>{{s2: v}}</b></div>`, [() => l, () => v]),
      best = dk.reduce((a, k) => (days[k].n > (a ? days[a].n : -1) ? k : a), "");
    const edC = kind == "dca" ? canEnter() : kind == "sup" ? isAdmin() : false,
      edB = (e) => {
        if (kind == "dca") {
          const d = dataCollectors.find(
            (x) => x.name.toLowerCase() == String(e.name).toLowerCase(),
          );
          return d
            ? __tpl(
                "edB.1",
                `<button type="button" class="btn btn-sm btn-outline-primary" data-fa="eds" data-i="{{s1: escapeHtml(d.id)}}"><i class="bx bx-edit"></i> Edit</button>`,
                [() => escapeHtml(d.id)],
              )
            : "";
        }
        const u = USERS.find((x) => x.name == e.name && x.role == "supervisor");
        return u
          ? __tpl(
              "edB.2",
              `<button type="button" class="btn btn-sm btn-outline-primary" data-fa="eus" data-i="{{s1: escapeHtml(u.id)}}"><i class="bx bx-edit"></i> Edit</button>`,
              [() => escapeHtml(u.id)],
            )
          : "";
      },
      tbl = L0.length
        ? __tpl(
            "renderActivityView.4",
            `<table><thead><tr><th>#</th>{{s1: kind == 'dca' ? ' th /th ' : ''}}<th>{{s2: nm}}</th><th class="n">Active days</th><th class="n">{{s3: rg ? '% of selected days' : '% of…}}</th><th class="n">Longest streak</th><th class="n">Reports</th><th class="n">Sites</th><th class="n">Registered</th><th class="n">Avg / active day</th><th>First</th><th>Last</th>{{s4: edC ? ' th /th ' : ''}}</tr></thead><tbody>{{s5: L0.map(…)}}</tbody></table>`,
            [
              () => (kind == "dca" ? "<th></th>" : ""),
              () => nm,
              () => (rg ? "% of selected days" : "% of year so far"),
              () => (edC ? "<th></th>" : ""),
              () =>
                L0.map((e, i) => {
                  const ds = Object.keys(e.days);
                  return __tpl(
                    "renderActivityView.3",
                    `<tr{{s1: e.key == sel ? ' class='sel'' : ''}}><td>{{s2: i + 1}}</td>{{s3: kind == 'dca' ? …}}<td><button type="button" class="btn btn-sm btn-link p-0" data-fa="asel" data-kd="{{s4: kind}}" data-k="{{s5: escapeHtml(e.key)}}">{{s6: escapeHtml(e.name)}}</button></td><td class="n">{{s7: ds.length}}</td><td class="n">{{s8: Math.round((ds.length / yd) * 100)}}%</td><td class="n">{{s9: reportingStreak(ds)}}</td><td class="n">{{s10: e.rep}}</td><td class="n">{{s11: e.sites.size}}</td><td class="n"><b>{{s12: formatNumber(e.n)}}</b></td><td class="n">{{s13: formatNumber(Math.round(e.n / Mat…}}</td><td>{{s14: e.first}}</td><td>{{s15: e.last}}</td>{{s16: edC ? …}}</tr>`,
                    [
                      () => (e.key == sel ? ' class="sel"' : ""),
                      () => i + 1,
                      () =>
                        kind == "dca"
                          ? __tpl(
                              "renderActivityView.1",
                              `<td>{{s1: avatarHtml(dpp(e.name).photo, e.n…}}</td>`,
                              [() => avatarHtml(dpp(e.name).photo, e.name)],
                            )
                          : "",
                      () => kind,
                      () => escapeHtml(e.key),
                      () => escapeHtml(e.name),
                      () => ds.length,
                      () => Math.round((ds.length / yd) * 100),
                      () => reportingStreak(ds),
                      () => e.rep,
                      () => e.sites.size,
                      () => formatNumber(e.n),
                      () => formatNumber(Math.round(e.n / Math.max(1, ds.length))),
                      () => e.first,
                      () => e.last,
                      () =>
                        edC
                          ? __tpl("renderActivityView.2", `<td>{{s1: edB(e)}}</td>`, [() => edB(e)])
                          : "",
                    ],
                  );
                }).join(""),
            ],
          )
        : '<p class="em">No activity in ' + activityFilters.yr + " for these filters.</p>";
    return __tpl(
      "renderActivityView.6",
      `<div class="card actc"><div class="wz-sh"><i class="bx {{s1: IC}}"></i><div><b>{{s2: nm}} report · {{s3: activityFilters.yr}}</b><small>{{s4: sel ? escapeHtml((L0.find((e) = e…}} — how actively {{s5: PL}} worked through the year</small></div><label class="actsel"><select id="a{{s6: sup: 'sp', dca: 'dc', mda: 'md',…}}">{{s7: optionsHtml([['', 'All ' + PL + '…}}</select></label></div>
<div class="kp">{{s8: kp('Active days', dk.length + ' /…}}{{s9: kp('Longest streak', reportingStr…}}{{s10: kp('Reports', formatNumber(REP))}}{{s11: kp('Registered', formatNumber(N))}}{{s12: kp('Avg per active day', formatNu…}}{{s13: kp(sel ? 'Best day' : 'Active ' +…}}</div>
<h4 class="acth">Activity calendar — whole of {{s14: activityFilters.yr}}{{s15: rg ? ' (the dates you chose apply…}}</h4><div class="calw">{{s16: calendarSvg(cdays, activityFilter…}}<div class="cal-lg">Less {{s17: [0, 1, 2, 3, 4].map(…)}} More <span>· hover a square for the day's numbers</span></div></div>
<div class="g2"><div class="card"><h3>Registrations per month</h3>{{s18: monthBarsHtml(mon, 'bar1')}}</div><div class="card"><h3>Active days per month</h3>{{s19: monthBarsHtml(amon, 'bar2')}}</div>
<div class="card"><h3>{{s20: sup ? 'Registrations by superviso…}}</h3>{{s21: horizontalBars( L0.map(…)}}</div><div class="card"><h3>Days active by {{s22: SG}}</h3>{{s23: horizontalBars( L0.map(…)}}</div></div>
<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>{{s24: nm}} activity table <small style="color:var(--mu)">(click a name to see their calendar)</small></span>{{s25: exportButtonsHtml(kind, 'act')}}</h3>{{s26: tbl}}</div></div>`,
      [
        () => IC,
        () => nm,
        () => activityFilters.yr,
        () =>
          sel
            ? escapeHtml((L0.find((e) => e.key == sel) || {}).name || "")
            : "All " + PL + " together",
        () => PL,
        () =>
          ({
            sup: "sp",
            dca: "dc",
            mda: "md",
          })[kind],
        () =>
          optionsHtml(
            [["", "All " + PL + " (" + LY.length + ")"]].concat(LY.map((e) => [e.key, e.name])),
            sel,
          ),
        () => kp("Active days", dk.length + " / " + yd),
        () => kp("Longest streak", reportingStreak(dk) + " days"),
        () => kp("Reports", formatNumber(REP)),
        () => kp("Registered", formatNumber(N)),
        () => kp("Avg per active day", formatNumber(dk.length ? Math.round(N / dk.length) : 0)),
        () =>
          kp(
            sel ? "Best day" : "Active " + PL,
            sel ? (best ? best.slice(5) + " · " + formatNumber(days[best].n) : "—") : L0.length,
          ),
        () => activityFilters.yr,
        () => (rg ? " (the dates you chose apply to the figures, charts and tables)" : ""),
        () => calendarSvg(cdays, activityFilters.yr, activityFilters.met),
        () =>
          [0, 1, 2, 3, 4]
            .map((i) =>
              __tpl("renderActivityView.5", `<i style="background:var(--cal{{s1: i}})"></i>`, [
                () => i,
              ]),
            )
            .join(""),
        () => monthBarsHtml(mon, "bar1"),
        () => monthBarsHtml(amon, "bar2"),
        () =>
          sup
            ? "Registrations by supervisor"
            : kind == "mda"
              ? "Registrations by MDA"
              : "Top DCAs by registrations",
        () =>
          horizontalBars(
            L0.map((e) => [e.name, e.n]),
            10,
          ),
        () => SG,
        () =>
          horizontalBars(
            L0.map((e) => [e.name, Object.keys(e.days).length]),
            10,
          ),
        () => nm,
        () => exportButtonsHtml(kind, "act"),
        () => tbl,
      ],
    );
  }
  function dailyRep(kind) {
    const ms = supervisorNameFor(),
      sel = activityFilters[kind],
      dca = kind == "dca",
      R = rows()
        .filter(
          (r) =>
            (!ms || reportSupervisor(r) == ms) &&
            (!sel ||
              (kind == "sup"
                ? (reportSupervisor(r) || "Not assigned") == sel
                : kind == "mda"
                  ? (r.mdas || []).some((m) => String(m.mda).toLowerCase() == sel)
                  : r.dcas.some((d) => String(d.name).toLowerCase() == sel))),
        )
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const mine = (r) =>
        dca && sel ? r.dcas.filter((d) => String(d.name).toLowerCase() == sel) : r.dcas,
      tt = (r) => (dca && sel ? mine(r).reduce((a, d) => a + (+d.n || 0), 0) : totalDcas(r));
    return (
      __tpl(
        "dailyRep.1",
        `<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>Daily reports <small style="color:var(--mu)">({{s1: pageFilters.from}} to {{s2: pageFilters.to}}{{s3: sel ? ' · ' + escapeHtml((actData…}})</small></span>{{s4: exportButtonsHtml(kind, 'day')}}</h3>`,
        [
          () => pageFilters.from,
          () => pageFilters.to,
          () =>
            sel
              ? " · " +
                escapeHtml(
                  (actData(kind, activityFilters.yr).find((e) => e.key == sel) || {}).name || "",
                )
              : "",
          () => exportButtonsHtml(kind, "day"),
        ],
      ) +
      (R.length
        ? __tpl(
            "dailyRep.9",
            `<table><thead><tr><th>Date</th><th>Registration site / MDA</th><th>Location</th>{{s1: kind == 'sup' ? ' th Supervisor /…}}<th class="n">DCAs</th><th class="n">Registered</th><th>Registered by each DCA</th><th>Status by MDA</th><th>Incident log</th>{{s2: canEnter() ? ' th /th ' : ''}}</tr></thead><tbody>{{s3: R.map(…)}}</tbody><tfoot><tr class="dg"><td>Total</td><td>{{s4: R.length}} report{{s5: R.length == 1 ? '' : 's'}}</td><td></td>{{s6: kind == 'sup' ? ' td /td ' : ''}}<td class="n">{{s7: formatNumber(R.reduce((a, r) = a…}}</td><td class="n">{{s8: formatNumber(R.reduce((a, r) = a…}}</td><td></td><td></td><td></td>{{s9: canEnter() ? ' td /td ' : ''}}</tr></tfoot></table>`,
            [
              () => (kind == "sup" ? "<th>Supervisor</th>" : ""),
              () => (canEnter() ? "<th></th>" : ""),
              () =>
                R.map((r) => {
                  const s = findSite(r.site),
                    l = s ? siteStateAndCounty(s) : ["", ""];
                  return __tpl(
                    "dailyRep.8",
                    `<tr><td>{{s1: r.date}}<div class="rp-act"><button type="button" class="btn" data-fa="rv" data-i="{{s2: escapeHtml(r.id)}}" title="View the full report"><i class="bx bx-show"></i> View</button><button type="button" class="btn" data-fa="rpr" data-i="{{s3: escapeHtml(r.id)}}" title="Print the report"><i class="bx bx-printer"></i> Print</button></div></td><td>{{s4: escapeHtml(r.regMda || siteMdaNam…}}{{s5: s (r.regMda || s.mda) ? ' br smal…}}</td><td>{{s6: escapeHtml(l[1])}}, {{s7: escapeHtml(l[0])}}</td>{{s8: kind == 'sup' ? …}}<td class="n">{{s9: mine(r).length}}</td><td class="n">{{s10: formatNumber(tt(r))}}</td><td>{{s11: mine( r, ) .map(…)}}</td><td>{{s12: mdaCell(r)}}</td><td>{{s13: String(r.note || '').trim() ? …}}</td>{{s14: canEnter() ? …}}</tr>`,
                    [
                      () => r.date,
                      () => escapeHtml(r.id),
                      () => escapeHtml(r.id),
                      () => escapeHtml(r.regMda || siteMdaName(s)),
                      () =>
                        s && (r.regMda || s.mda)
                          ? "<br><small>" + escapeHtml(s.name) + "</small>"
                          : "",
                      () => escapeHtml(l[1]),
                      () => escapeHtml(l[0]),
                      () =>
                        kind == "sup"
                          ? __tpl(
                              "dailyRep.2",
                              `<td>{{s1: escapeHtml(reportSupervisor(r) ||…}}</td>`,
                              [() => escapeHtml(reportSupervisor(r) || "Not assigned")],
                            )
                          : "",
                      () => mine(r).length,
                      () => formatNumber(tt(r)),
                      () =>
                        mine(r)
                          .map((x) =>
                            __tpl(
                              "dailyRep.3",
                              `{{s1: escapeHtml(x.name)}}: <b>{{s2: formatNumber(x.n)}}</b>`,
                              [() => escapeHtml(x.name), () => formatNumber(x.n)],
                            ),
                          )
                          .join("<br>"),
                      () => mdaCell(r),
                      () =>
                        String(r.note || "").trim()
                          ? __tpl(
                              "dailyRep.4",
                              `<span class="ilg y" title="{{s1: escapeHtml(String(r.note).trim())}}">Yes</span>`,
                              [() => escapeHtml(String(r.note).trim())],
                            )
                          : __tpl("dailyRep.5", `<span class="ilg">No</span>`, []),
                      () =>
                        canEnter()
                          ? __tpl(
                              "dailyRep.7",
                              `<td>{{s1: isSubadminOrAdmin() !isReviewLock…}}</td>`,
                              [
                                () =>
                                  isSubadminOrAdmin() && !isReviewLocked(r)
                                    ? __tpl(
                                        "dailyRep.6",
                                        `<button type="button" class="btn btn-sm btn-outline-primary" data-fa="er" data-i="{{s1: escapeHtml(r.id)}}"><i class="bx bx-edit"></i> Edit</button>`,
                                        [() => escapeHtml(r.id)],
                                      )
                                    : "",
                              ],
                            )
                          : "",
                    ],
                  );
                }).join(""),
              () => R.length,
              () => (R.length == 1 ? "" : "s"),
              () => (kind == "sup" ? "<td></td>" : ""),
              () => formatNumber(R.reduce((a, r) => a + r.dcas.length, 0)),
              () => formatNumber(R.reduce((a, r) => a + tt(r), 0)),
              () => (canEnter() ? "<td></td>" : ""),
            ],
          )
        : '<p class="em">No reports in these dates.</p>') +
      "</div>"
    );
  }
  function exportButtonsHtml(kd, t) {
    return __tpl(
      "exportButtonsHtml.1",
      `<span class="xpb"><button type="button" class="btn btn-sm btn-outline-success" data-fa="xp" data-kd="{{s1: kd}}" data-t="{{s2: t}}" data-f="xls"><i class="bx bxs-file-export"></i> Excel</button><button type="button" class="btn btn-sm btn-outline-secondary" data-fa="xp" data-kd="{{s3: kd}}" data-t="{{s4: t}}" data-f="csv"><i class="bx bx-export"></i> CSV</button><button type="button" class="btn btn-sm btn-outline-secondary" data-fa="xp" data-kd="{{s5: kd}}" data-t="{{s6: t}}" data-f="print"><i class="bx bx-printer"></i> Print</button></span>`,
      [() => kd, () => t, () => kd, () => t, () => kd, () => t],
    );
  }
  function dailyList(kind) {
    const ms = supervisorNameFor(),
      sel = activityFilters[kind],
      dca = kind == "dca";
    return rows()
      .filter(
        (r) =>
          (!ms || reportSupervisor(r) == ms) &&
          (!sel ||
            (kind == "sup"
              ? (reportSupervisor(r) || "Not assigned") == sel
              : kind == "mda"
                ? (r.mdas || []).some((m) => String(m.mda).toLowerCase() == sel)
                : r.dcas.some((d) => String(d.name).toLowerCase() == sel))),
      )
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }
  function exportData(kd, t, rg) {
    const sel = activityFilters[kd];
    if (t == "regt") {
      const L = ilList();
      return {
        name: "incident-log-report",
        head: [
          "Date",
          "State",
          "County",
          "Registration site",
          "MDA",
          "Supervisor",
          "Entered by",
          "Incident log",
        ],
        rows: L.map((x) => [x.r.date, x.st, x.co, x.site, x.mda, x.sup, x.by, x.note]),
      };
    }
    if (t == "msum") {
      const L = ivList();
      return {
        name: "inventory-reports",
        head: [
          "Date",
          "State",
          "County",
          "Registration site",
          "MDA",
          "Entered by",
          "Items",
          "Setups",
          "Devices",
          "Faults",
        ],
        rows: L.map((x) => [
          x.r.date,
          x.st,
          x.co,
          x.site,
          x.mda,
          x.by,
          x.qty,
          x.su,
          x.dv,
          x.bad,
        ]).concat([
          [
            "Total",
            "",
            "",
            "",
            "",
            "",
            L.reduce((a, x) => a + x.qty, 0),
            L.reduce((a, x) => a + x.su, 0),
            L.reduce((a, x) => a + x.dv, 0),
            L.reduce((a, x) => a + x.bad, 0),
          ],
        ]),
      };
    }
    if (t == "inv")
      return {
        name: "inventory",
        head: [
          "Date received",
          "Category",
          "Description",
          "Serial number",
          "Asset tag",
          "Company tag",
          "Status",
          "Assigned to",
          "Note",
        ],
        rows: invRows().map((x) => [
          x.dr,
          x.cat,
          x.desc,
          x.sn || "",
          x.at || "",
          x.ct || "",
          x.st,
          x.as || "",
          x.nt || "",
        ]),
      };
    if (t == "dplan" && deploymentPlanState.res) {
      const R = deploymentPlanState.res,
        L = R.sites.map((x) => [
          x.st,
          x.co,
          x.name,
          x.total,
          x.pct + "%",
          x.tg,
          x.dc + (x.given ? "" : " (calculated)"),
          x.d,
          x.fin,
        ]);
      return {
        name: "deployment-plan",
        head: [
          "State",
          "County",
          "Site",
          "Total",
          "Target %",
          "Target to register",
          "DCAs",
          "Working days",
          "Finish date",
        ],
        rows: L,
      };
    }
    if (t == "dplan")
      return {
        name: "deployment-plan",
        head: ["Site"],
        rows: [],
      };
    if (t == "trk") {
      const L = siteRows()
        .sort((a, b) => ((a.s.deadline || "9999") < (b.s.deadline || "9999") ? -1 : 1))
        .filter(
          (x) =>
            !pageFilters.tst || (pageFilters.tst == "Overdue" ? x.od : x.st == pageFilters.tst),
        );
      return {
        name: "site-progress" + (pageFilters.tst ? "-" + pageFilters.tst.toLowerCase() : ""),
        head: [
          "MDA",
          "Site",
          "State",
          "County",
          "Total",
          "Done",
          "Remaining",
          "Status",
          "Overdue",
          "Progress %",
          "Opening",
          "Closing",
          "Supervisor",
          "DCAs reported",
          "DCAs planned",
          "Comment",
        ],
        rows: L.map((x) => {
          const l = siteStateAndCounty(x.s);
          return [
            x.s.mda || "",
            x.s.name,
            l[0],
            l[1],
            x.t,
            x.d,
            x.rem,
            x.st,
            x.od ? "Yes" : "",
            x.t ? Math.min(100, Math.round((x.d / x.t) * 100)) : 0,
            x.s.open || "",
            x.s.deadline || "",
            x.s.sup || "",
            x.dn,
            x.s.dcaN || "",
            x.s.cmt || "",
          ];
        }),
      };
    }
    if (t == "rep") {
      const R = rows().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
      return {
        name: "daily-reports",
        head: [
          "Date",
          "Registration MDA",
          "Site",
          "State",
          "County",
          "Supervisor",
          "DCAs",
          "Registered",
          "Registered by each DCA",
          "Status by MDA (complete/pending/failed)",
          "Incident log",
          "Entered by",
        ],
        rows: R.map((r) => {
          const s = findSite(r.site),
            l = s ? siteStateAndCounty(s) : ["", ""];
          return [
            r.date,
            r.regMda || siteMdaName(s),
            s ? s.name : "",
            l[0],
            l[1],
            reportSupervisor(r),
            r.dcas.length,
            totalDcas(r),
            r.dcas.map((x) => x.name + ": " + (+x.n || 0)).join("; "),
            (r.mdas || [])
              .map(
                (m) =>
                  m.mda +
                  ": " +
                  (m.n || 0) +
                  " (" +
                  (m.ok || 0) +
                  "/" +
                  (m.pend || 0) +
                  "/" +
                  (m.fail || 0) +
                  ")",
              )
              .join("; "),
            r.note || "",
            r.by || "",
          ];
        }),
      };
    }
    if (t == "mdaa") {
      return {
        name: "registrations-by-mda-analysis",
        head: [
          "Date",
          "Ministry (MDA)",
          "Registrations",
          "Complete",
          "Pending",
          "Failed",
          "Supervisor",
        ],
        rows: regRowsX("mda", pageFilters.per != "range").map(([k, g, d]) => [
          d,
          k,
          g.n,
          g.ok,
          g.pend,
          g.fail,
          [...g.sup].join("; "),
        ]),
      };
    }
    if (t == "mda") {
      const by = pageFilters.grp;
      return {
        name: "registrations-by-" + by,
        head: [
          "Date",
          by == "site" ? "Registration site" : "Ministry (MDA)",
          "Registrations",
          "Complete",
          "Pending",
          "Failed",
          "Supervisor",
        ],
        rows: regRows(by).map(([k, g, d]) => [
          d,
          k,
          g.n,
          g.ok,
          g.pend,
          g.fail,
          [...g.sup].join("; "),
        ]),
      };
    }
    if (t == "act") {
      const L = rg ? actData(kd, activityFilters.yr, 1) : actData(kd, activityFilters.yr),
        y = +activityFilters.yr,
        now = new Date(),
        yd = Math.max(
          1,
          rg
            ? Math.round(
                (new Date(Math.min(+new Date(pageFilters.to + "T00:00:00"), +now)) -
                  new Date(pageFilters.from + "T00:00:00")) /
                  864e5,
              ) + 1
            : y == now.getFullYear()
              ? Math.floor((now - new Date(y, 0, 1)) / 864e5) + 1
              : 365,
        );
      return {
        name: kd + "-activity",
        head: [
          {
            sup: "Supervisor",
            dca: "DCA",
            mda: "MDA",
          }[kd],
          "Active days",
          "% of period",
          "Longest streak",
          "Reports",
          "Sites",
          "Registered",
          "Avg per active day",
          "First report",
          "Last report",
        ],
        rows: L.map((e) => {
          const ds = Object.keys(e.days);
          return [
            e.name,
            ds.length,
            Math.round((ds.length / yd) * 100) + "%",
            reportingStreak(ds),
            e.rep,
            e.sites.size,
            e.n,
            Math.round(e.n / Math.max(1, ds.length)),
            e.first,
            e.last,
          ];
        }),
      };
    }
    const dca = kd == "dca",
      R = dailyList(kd),
      mine = (r) =>
        dca && sel ? r.dcas.filter((d) => String(d.name).toLowerCase() == sel) : r.dcas,
      tt = (r) => (dca && sel ? mine(r).reduce((a, d) => a + (+d.n || 0), 0) : totalDcas(r));
    return {
      name: kd + "-daily-reports",
      head: [
        "Date",
        "Registration MDA",
        "Site",
        "State",
        "County",
        "Supervisor",
        "DCAs",
        "Registered",
        "Registered by each DCA",
        "Status by MDA (complete/pending/failed)",
        "Incident log",
        "Entered by",
      ],
      rows: R.map((r) => {
        const s = findSite(r.site),
          l = s ? siteStateAndCounty(s) : ["", ""];
        return [
          r.date,
          r.regMda || siteMdaName(s),
          s ? s.name : "",
          l[0],
          l[1],
          reportSupervisor(r),
          mine(r).length,
          tt(r),
          mine(r)
            .map((x) => x.name + ": " + (+x.n || 0))
            .join("; "),
          (r.mdas || [])
            .map(
              (m) =>
                m.mda +
                ": " +
                (m.n || 0) +
                " (" +
                (m.ok || 0) +
                "/" +
                (m.pend || 0) +
                "/" +
                (m.fail || 0) +
                ")",
            )
            .join("; "),
          r.note || "",
          r.by || "",
        ];
      }),
    };
  }
  function runExport(kd, t, f, rg) {
    const D = exportData(kd, t, rg);
    if (!D.rows.length) return toast("Nothing to export");
    if (f == "print") {
      const e = (v) =>
          String(v == null ? "" : v).replace(
            /[&<>"]/g,
            (m) =>
              ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
              })[m],
          ),
        ttl = D.name.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()),
        css =
          "body{font:12px Arial,sans-serif;margin:18px;color:#111}h1{font-size:18px;margin:0 0 4px}p{color:#555;margin:2px 0 10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:5px 7px;text-align:left}th{background:#eee;font-size:10px;text-transform:uppercase}@page{size:A4 landscape;margin:12mm}",
        h =
          "<h1>" +
          e(ttl) +
          "</h1><p>" +
          e(new Date().toLocaleString()) +
          " \u00b7 " +
          D.rows.length +
          " row" +
          (D.rows.length == 1 ? "" : "s") +
          "</p><table><thead><tr>" +
          D.head.map((x) => "<th>" + e(x) + "</th>").join("") +
          "</tr></thead><tbody>" +
          D.rows
            .map((r) => "<tr>" + r.map((x) => "<td>" + e(x) + "</td>").join("") + "</tr>")
            .join("") +
          "</tbody></table>",
        fr = document.createElement("iframe");
      fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
      document.body.append(fr);
      const d = fr.contentWindow.document;
      d.open();
      d.write(
        "<!doctype html><html><head><meta charset=utf-8><title>" +
          e(ttl) +
          "</title><style>" +
          css +
          "</style></head><body>" +
          h +
          "</body></html>",
      );
      d.close();
      setTimeout(() => {
        fr.contentWindow.focus();
        fr.contentWindow.print();
        setTimeout(() => fr.remove(), 1500);
      }, 250);
      return;
    }
    const nm =
      D.name + "-" + (t == "act" ? activityFilters.yr : pageFilters.from + "_to_" + pageFilters.to);
    let blob, ext;
    if (f == "csv") {
      const q = (v) => {
        v = String(v == null ? "" : v);
        return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
      };
      blob = new Blob(
        [
          "\ufeff" +
            [D.head]
              .concat(D.rows)
              .map((r) => r.map(q).join(","))
              .join("\r\n"),
        ],
        {
          type: "text/csv;charset=utf-8",
        },
      );
      ext = "csv";
    } else {
      const h = (v) => escapeHtml(v),
        x =
          '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>' +
          h(D.name.slice(0, 30)) +
          '</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1"><tr>' +
          D.head.map((c) => '<th style="background:#eeedf5">' + h(c) + "</th>").join("") +
          "</tr>" +
          D.rows
            .map((r) => "<tr>" + r.map((c) => "<td>" + h(c) + "</td>").join("") + "</tr>")
            .join("") +
          "</table></body></html>";
      blob = new Blob([x], {
        type: "application/vnd.ms-excel",
      });
      ext = "xls";
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = nm + "." + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("Exported " + D.rows.length + " rows");
  }
  function renderTeamView(kd) {
    const ms = supervisorNameFor();
    if (ms) activityFilters.sup = ms;
    return (
      filt() +
      __tpl(
        "renderTeamView.1",
        `<div class="card fcard"><div class="flt"><b style="align-self:center"><i class="bx {{s1: kd == 'sup' ? 'bx-user-check' : '…}}"></i> {{s2: kd == 'sup' ? 'Supervisor' : 'DCA'}} report</b><span style="color:var(--mu);font-size:.8rem;align-self:center">{{s3: ms ? (kd == 'sup' ? 'Showing your…}}</span></div></div>`,
        [
          () => (kd == "sup" ? "bx-user-check" : "bx-id-card"),
          () => (kd == "sup" ? "Supervisor" : "DCA"),
          () =>
            ms
              ? kd == "sup"
                ? "Showing your own activity on the sites assigned to you (" + escapeHtml(ms) + ")."
                : "Showing the DCAs who reported on the sites assigned to you (" +
                  escapeHtml(ms) +
                  ")."
              : "Pick a year and a " +
                (kd == "sup" ? "supervisor" : "DCA") +
                " to see how actively they worked through the year.",
        ],
      ) +
      actCtl() +
      renderActivityView(kd, 1) +
      dailyRep(kd)
    );
  }
  const dashboardPeriod = {
    wk: "w",
    mo: "",
  };
  function weekStartOf(k) {
    const d = new Date(k + "T00:00:00"),
      o = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - o);
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }
  function pagerHtml(items, size) {
    size = size || 5;
    if (!items.length) return '<p class="em">No data for these filters.</p>';
    const n = Math.ceil(items.length / size);
    let o = '<div class="pgc" data-n="' + n + '" data-i="0">';
    for (let i = 0; i < n; i++)
      o +=
        '<div class="pgp"' +
        (i ? " hidden" : "") +
        ">" +
        items.slice(i * size, i * size + size).join("") +
        "</div>";
    return (
      o +
      (n > 1
        ? '<div class="pgn"><button type="button" class="btn btn-sm btn-outline-secondary" data-fa="pg" data-d="-1" disabled><i class="bx bx-chevron-left"></i> Previous</button><span class="pgl">Top 1–' +
          Math.min(size, items.length) +
          " of " +
          items.length +
          '</span><button type="button" class="btn btn-sm btn-outline-secondary" data-fa="pg" data-d="1">Next <i class="bx bx-chevron-right"></i></button></div>'
        : "") +
      "</div>"
    );
  }
  function hbRows(a, n) {
    a = a.sort((x, y) => y[1] - x[1]).slice(0, n || 10);
    const m = (a[0] || [0, 1])[1] || 1;
    return a.map((x) =>
      __tpl(
        "hbRows.1",
        `<div class="hb"><span title="{{s1: escapeHtml(x[0])}}">{{s2: escapeHtml(x[0])}}</span><u><i style="width:{{s3: (x[1] / m) * 100}}%"></i></u><b>{{s4: formatNumber(x[1])}}</b></div>`,
        [
          () => escapeHtml(x[0]),
          () => escapeHtml(x[0]),
          () => (x[1] / m) * 100,
          () => formatNumber(x[1]),
        ],
      ),
    );
  }
  function goToPage(b) {
    const c = b.closest(".pgc"),
      n = +c.dataset.n,
      i = Math.max(0, Math.min(n - 1, +c.dataset.i + +b.dataset.d));
    c.dataset.i = i;
    c.querySelectorAll(".pgp").forEach((p, j) => (p.hidden = j != i));
    const bs = c.querySelectorAll("[data-fa=pg]");
    bs[0].disabled = i == 0;
    bs[1].disabled = i == n - 1;
    const L = c.querySelectorAll(".pgp")[i].children.length,
      t = c.querySelector(".pgl");
    t.textContent =
      "Top " + (i * 5 + 1) + "–" + (i * 5 + L) + " of " + c.querySelectorAll(".hb").length;
  }
  /* ---------- daily dashboard with charts ---------- */
  function todayCardHtml() {
    const T0 = today(),
      M = {},
      S = new Set();
    let tot0 = 0;
    rows(true)
      .filter((r) => r.date == T0)
      .forEach((r) => {
        S.add(r.site);
        const ms =
          r.mdas && r.mdas.length
            ? r.mdas
            : [
                {
                  mda: r.regMda || siteMdaName(findSite(r.site)) || "Not specified",
                  n: totalDcas(r),
                  ok: totalDcas(r),
                  pend: 0,
                  fail: 0,
                },
              ];
        ms.forEach((m) => {
          const k = m.mda || "Not specified",
            e = (M[k] = M[k] || {
              n: 0,
              ok: 0,
              p: 0,
              f: 0,
            });
          const n = +m.n || (+m.ok || 0) + (+m.pend || 0) + (+m.fail || 0);
          e.n += n;
          e.ok += +m.ok || 0;
          e.p += +m.pend || 0;
          e.f += +m.fail || 0;
          tot0 += n;
        });
      });
    const L = Object.entries(M).sort((a, b) => b[1].n - a[1].n),
      mx = L.length ? L[0][1].n || 1 : 1;
    return (
      __tpl(
        "todayCardHtml.1",
        `<div class="card pgcard"><h3>Today's MDA registrations <small style="color:var(--mu)">({{s1: T0}})</small></h3><div class="pfk"><div class="pft" style="border-color:var(--v)"><i class="bx bx-user-check" style="color:var(--v)"></i><div><small>Registered today</small><b>{{s2: formatNumber(tot0)}}</b></div></div><div class="pft" style="border-color:var(--v)"><i class="bx bx-buildings" style="color:var(--v)"></i><div><small>MDAs</small><b>{{s3: L.length}}</b></div></div><div class="pft" style="border-color:var(--v)"><i class="bx bx-map-pin" style="color:var(--v)"></i><div><small>Sites reporting</small><b>{{s4: S.size}}</b></div></div></div>`,
        [() => T0, () => formatNumber(tot0), () => L.length, () => S.size],
      ) +
      (L.length
        ? pagerHtml(
            L.map(([k, v]) =>
              __tpl(
                "todayCardHtml.2",
                `<div class="hb"><span title="{{s1: escapeHtml(k)}}">{{s2: escapeHtml(k)}}</span><u><i style="width:{{s3: (v.n / mx) * 100}}%"></i></u><b title="{{s4: v.ok}} complete · {{s5: v.p}} pending · {{s6: v.f}} failed">{{s7: formatNumber(v.n)}}</b></div>`,
                [
                  () => escapeHtml(k),
                  () => escapeHtml(k),
                  () => (v.n / mx) * 100,
                  () => v.ok,
                  () => v.p,
                  () => v.f,
                  () => formatNumber(v.n),
                ],
              ),
            ),
          )
        : '<p class="em">No registrations reported for today yet.</p>') +
      "</div>"
    );
  }
  function registrationStatusCard(R, nm) {
    let ok = 0,
      pe = 0,
      fa = 0;
    const S = {};
    R.forEach((r) =>
      (r.mdas || []).forEach((m) => {
        const o = +m.ok || 0,
          p = +m.pend || 0,
          f = +m.fail || 0;
        ok += o;
        pe += p;
        fa += f;
        const e = (S[r.site] = S[r.site] || {
          p: 0,
          f: 0,
          o: 0,
        });
        e.p += p;
        e.f += f;
        e.o += o;
      }),
    );
    const L = Object.entries(S)
        .filter(([k, v]) => v.p + v.f > 0)
        .sort((a, b) => b[1].p + b[1].f - (a[1].p + a[1].f))
        .slice(0, 10),
      mx = L.length ? L[0][1].p + L[0][1].f : 1,
      T = ok + pe + fa;
    const t = (l, v, c, ic) =>
      __tpl(
        "t.1",
        `<div class="pft" style="border-color:{{s1: c}}"><i class="bx {{s2: ic}}" style="color:{{s3: c}}"></i><div><small>{{s4: l}}</small><b>{{s5: formatNumber(v)}}</b><em>{{s6: T ? Math.round((v / T) * 100) : 0}}%</em></div></div>`,
        [
          () => c,
          () => ic,
          () => c,
          () => l,
          () => formatNumber(v),
          () => (T ? Math.round((v / T) * 100) : 0),
        ],
      );
    const om = Math.max(ok, pe, fa, 1),
      oc = (l, v, c) =>
        __tpl(
          "oc.1",
          `<div class="pfoc" data-tip="{{s1: l}}: {{s2: formatNumber(v)}} transaction{{s3: v == 1 ? '' : 's'}} ({{s4: T ? Math.round((v / T) * 100) : 0}}% of {{s5: formatNumber(T)}})"><b>{{s6: formatNumber(v)}}</b><i style="height:{{s7: Math.max(3, (v / om) * 100)}}%;background:{{s8: c}}"></i><span>{{s9: l}}</span></div>`,
          [
            () => l,
            () => formatNumber(v),
            () => (v == 1 ? "" : "s"),
            () => (T ? Math.round((v / T) * 100) : 0),
            () => formatNumber(T),
            () => formatNumber(v),
            () => Math.max(3, (v / om) * 100),
            () => c,
            () => l,
          ],
        );
    return (
      __tpl(
        "registrationStatusCard.1",
        `<div class="card pgcard"><h3>Pending &amp; failed transactions <small style="color:var(--mu)">(selected dates)</small></h3><div class="pfk">{{s1: t('Complete', ok, '#198754', 'bx-…}}{{s2: t('Pending', pe, '#e0a100', 'bx-t…}}{{s3: t('Failed', fa, '#dc3545', 'bx-x-…}}</div><div class="pfov">{{s4: oc('Complete', ok, '#198754')}}{{s5: oc('Pending', pe, '#e0a100')}}{{s6: oc('Failed', fa, '#dc3545')}}</div>`,
        [
          () => t("Complete", ok, "#198754", "bx-check-circle"),
          () => t("Pending", pe, "#e0a100", "bx-time-five"),
          () => t("Failed", fa, "#dc3545", "bx-x-circle"),
          () => oc("Complete", ok, "#198754"),
          () => oc("Pending", pe, "#e0a100"),
          () => oc("Failed", fa, "#dc3545"),
        ],
      ) + "</div>"
    );
  }
  function regRowsX(by, all) {
    const R = rows(all),
      DS = [...new Set(R.map((r) => r.date))].sort().reverse();
    return [].concat(
      ...DS.map((d) =>
        Object.entries(
          mdaAgg(
            R.filter((r) => r.date == d),
            by,
          ),
        )
          .sort((a, b) => b[1].n - a[1].n)
          .map(([k, g]) => [k, g, d]),
      ),
    );
  }
  function mdaSumCard(all) {
    const key = (x) =>
        String(x || "")
          .trim()
          .toLowerCase(),
      M = {};
    const sl = SITES.filter(
      (s) =>
        siteTarget(s) &&
        isTargetSite(s) &&
        s.mda &&
        (!pageFilters.site || s.id == pageFilters.site) &&
        (!pageFilters.state || siteStateAndCounty(s)[0] == pageFilters.state) &&
        (!pageFilters.county || siteStateAndCounty(s)[1] == pageFilters.county) &&
        (!pageFilters.sup || s.sup == pageFilters.sup),
    );
    sl.forEach((s) => {
      const e = (M[key(s.mda)] = M[key(s.mda)] || {
        name: s.mda,
        t: 0,
        r: 0,
        sites: 0,
      });
      e.t += siteTarget(s);
      e.sites++;
    });
    const G = mdaAgg(rows(all), "mda");
    Object.entries(G).forEach(([k, g]) => {
      const e = (M[key(k)] = M[key(k)] || {
        name: k,
        t: 0,
        r: 0,
        sites: 0,
      });
      e.r += g.n;
    });
    const L = Object.values(M)
        .filter((x) => x.t > 0)
        .sort((a, b) => b.t - a.t || b.r - a.r),
      T = L.reduce((a, x) => a + x.t, 0),
      R = L.reduce((a, x) => a + x.r, 0),
      pc = (r, t) => (t ? Math.round((r / t) * 100) + "%" : "—");
    return __tpl(
      "mdaSumCard.3",
      `<div class="card tw"><h3>MDA registration summary <small style="color:var(--mu)">{{s1: all ? '(all time since start)' :…}}</small></h3>{{s2: L.length ? …}}</div>`,
      [
        () =>
          all ? "(all time since start)" : "(" + pageFilters.from + " to " + pageFilters.to + ")",
        () =>
          L.length
            ? __tpl(
                "mdaSumCard.2",
                `<table><thead><tr><th>#</th><th>Ministry (MDA)</th><th class="n">Total number to register</th><th class="n">Total registered</th><th class="n">Remaining</th><th class="n">Progress</th></tr></thead><tbody>{{s1: L.map(…)}}<tr style="background:rgba(143,162,255,.18);font-weight:800"><td colspan="2">TOTAL ({{s2: L.length}} MDAs)</td><td class="n">{{s3: formatNumber(T)}}</td><td class="n">{{s4: formatNumber(R)}}</td><td class="n">{{s5: formatNumber(L.reduce((a, x) = a…}}</td><td class="n">{{s6: pc(R, T)}}</td></tr></tbody></table><p class="em" style="text-align:left">Total number to register comes from the site targets of each MDA. Only MDAs with a site target (set under Site targets) are listed. Total registered counts the FTEs of that MDA in the reports, so it can include people registered at another MDA's site.</p>`,
                [
                  () =>
                    L.map((x, i) =>
                      __tpl(
                        "mdaSumCard.1",
                        `<tr><td>{{s1: i + 1}}</td><td>{{s2: escapeHtml(x.name)}}</td><td class="n">{{s3: formatNumber(x.t)}}</td><td class="n"><b>{{s4: formatNumber(x.r)}}</b></td><td class="n">{{s5: x.t ? formatNumber(Math.max(0, x.…}}</td><td class="n">{{s6: pc(x.r, x.t)}}</td></tr>`,
                        [
                          () => i + 1,
                          () => escapeHtml(x.name),
                          () => formatNumber(x.t),
                          () => formatNumber(x.r),
                          () => (x.t ? formatNumber(Math.max(0, x.t - x.r)) : "—"),
                          () => pc(x.r, x.t),
                        ],
                      ),
                    ).join(""),
                  () => L.length,
                  () => formatNumber(T),
                  () => formatNumber(R),
                  () => formatNumber(L.reduce((a, x) => a + (x.t ? Math.max(0, x.t - x.r) : 0), 0)),
                  () => pc(R, T),
                ],
              )
            : '<p class="em">No MDA has a site target for these filters.</p>',
      ],
    );
  }
  function mdaCard(by, all, t) {
    const E2 = regRowsX(by, all),
      sum = (k) => E2.reduce((a, x) => a + x[1][k], 0),
      N = sum("n"),
      OK = sum("ok"),
      PE = sum("pend"),
      FA = sum("fail"),
      LEG = sum("leg"),
      allS = new Set(),
      cl = OK + PE + FA;
    E2.forEach(([k, g]) => g.sup.forEach((x) => allS.add(x)));
    return __tpl(
      "mdaCard.4",
      `<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>Registrations by MDA (ministry of the FTEs) <small style="color:var(--mu)">{{s1: all ? '(all time since start)' :…}}</small></span>{{s2: exportButtonsHtml('all', t)}}</h3>{{s3: E2.length ? …}}</div>`,
      [
        () =>
          all ? "(all time since start)" : "(" + pageFilters.from + " to " + pageFilters.to + ")",
        () => exportButtonsHtml("all", t),
        () =>
          E2.length
            ? __tpl(
                "mdaCard.3",
                `<table><thead><tr><th>Date</th><th>Ministry (MDA)</th><th>State</th><th>County</th><th class="n">Registrations</th><th class="n">Complete</th><th class="n">Pending</th><th class="n">Failed</th><th class="n">Complete %</th><th></th></tr></thead><tbody>{{s1: E2.map(…)}}<tr style="background:rgba(143,162,255,.18);font-weight:800"><td colspan="4">TOTAL</td><td class="n">{{s2: formatNumber(N)}}</td><td class="n">{{s3: formatNumber(OK)}}</td><td class="n">{{s4: formatNumber(PE)}}</td><td class="n">{{s5: formatNumber(FA)}}</td><td class="n">{{s6: cl ? Math.round((OK / cl) * 100)…}}</td><td></td></tr></tbody></table>{{s7: LEG ? …}}`,
                [
                  () =>
                    E2.map(([k, g, d]) => {
                      const c = g.ok + g.pend + g.fail;
                      return __tpl(
                        "mdaCard.1",
                        `<tr><td>{{s1: d}}</td><td>{{s2: escapeHtml(k)}}</td><td>{{s3: escapeHtml([...(g.st || [])].join…}}</td><td>{{s4: escapeHtml([...(g.co || [])].join…}}</td><td class="n"><b>{{s5: formatNumber(g.n)}}</b></td><td class="n">{{s6: formatNumber(g.ok)}}</td><td class="n">{{s7: formatNumber(g.pend)}}</td><td class="n">{{s8: formatNumber(g.fail)}}</td><td class="n">{{s9: c ? Math.round((g.ok / c) * 100)…}}</td><td class="ac">{{s10: detailsButtonHtml(k, by, d)}}</td></tr>`,
                        [
                          () => d,
                          () => escapeHtml(k),
                          () => escapeHtml([...(g.st || [])].join(", ") || "—"),
                          () => escapeHtml([...(g.co || [])].join(", ") || "—"),
                          () => formatNumber(g.n),
                          () => formatNumber(g.ok),
                          () => formatNumber(g.pend),
                          () => formatNumber(g.fail),
                          () => (c ? Math.round((g.ok / c) * 100) + "%" : "—"),
                          () => detailsButtonHtml(k, by, d),
                        ],
                      );
                    }).join(""),
                  () => formatNumber(N),
                  () => formatNumber(OK),
                  () => formatNumber(PE),
                  () => formatNumber(FA),
                  () => (cl ? Math.round((OK / cl) * 100) + "%" : "—"),
                  () =>
                    LEG
                      ? __tpl(
                          "mdaCard.2",
                          `<p class="em" style="text-align:left">{{s1: formatNumber(LEG)}} registration(s) come from older reports that have no MDA / status breakdown.</p>`,
                          [() => formatNumber(LEG)],
                        )
                      : "",
                ],
              )
            : '<p class="em">No reports for these filters.</p>',
      ],
    );
  }
  function renderDashboardView() {
    const R = rows(),
      days = {},
      dc = {},
      sc = {},
      all = {};
    let sum = 0;
    R.forEach((r) => {
      const t = totalDcas(r);
      sum += t;
      days[r.date] = (days[r.date] || 0) + t;
      sc[r.site] = (sc[r.site] || 0) + t;
      r.dcas.forEach((d) => (dc[d.name] = (dc[d.name] || 0) + (+d.n || 0)));
    });
    REPORTS.forEach((r) => (all[r.site] = (all[r.site] || 0) + totalDcas(r)));
    const sl = SITES.filter(
        (s) =>
          siteTarget(s) &&
          (!pageFilters.site || s.id == pageFilters.site) &&
          (!pageFilters.state || siteStateAndCounty(s)[0] == pageFilters.state) &&
          (!pageFilters.county || siteStateAndCounty(s)[1] == pageFilters.county) &&
          (!pageFilters.sup || s.sup == pageFilters.sup),
      ),
      tg = sl.reduce((a, s) => a + siteTarget(s), 0),
      dn = sl.reduce((a, s) => a + (all[s.id] || 0), 0),
      dk = Object.keys(days).sort();
    const nm = (k) => {
      const s = findSite(k);
      return s ? s.name : "deleted";
    };
    return (
      filt() +
      __tpl(
        "renderDashboardView.1",
        `<div class="kp"><div><small>Registered (selected dates)</small><b>{{s1: formatNumber(sum)}}</b></div><div><small>Reports submitted</small><b>{{s2: formatNumber(R.length)}}</b></div><div><small>Sites reporting</small><b>{{s3: Object.keys(sc).length}}</b></div><div><small>DCAs active</small><b>{{s4: Object.keys(dc).length}}</b></div><div><small>Avg per reporting day</small><b>{{s5: formatNumber(dk.length ? Math.rou…}}</b></div><div><small>Target progress (all time)</small><b>{{s6: tg ? Math.round((dn / tg) * 100)…}}%</b></div></div>
<div class="g2"><div class="card"><h3 style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">{{s7: dashboardPeriod.wk == 'w' ? 'Regi…}}<select id="dwk" class="form-select form-select-sm" style="width:auto"><option value="w"{{s8: dashboardPeriod.wk == 'w' ? ' sel…}}>Per week</option><option value="d"{{s9: dashboardPeriod.wk == 'd' ? ' sel…}}>Per day</option></select></h3>{{s10: dashboardPeriod.wk == 'w' ? wkNav…}}</div>{{s11: todayCardHtml()}}
{{s12: registrationStatusCard(R, nm)}}<div class="card pgcard"><h3>Top DCAs (selected dates) <small style="color:var(--mu)">(top 10)</small></h3>{{s13: pagerHtml(hbRows(Object.entries(d…}}</div></div>`,
        [
          () => formatNumber(sum),
          () => formatNumber(R.length),
          () => Object.keys(sc).length,
          () => Object.keys(dc).length,
          () => formatNumber(dk.length ? Math.round(sum / dk.length) : 0),
          () => (tg ? Math.round((dn / tg) * 100) : 0),
          () => (dashboardPeriod.wk == "w" ? "Registrations per week" : "Daily registrations"),
          () => (dashboardPeriod.wk == "w" ? " selected" : ""),
          () => (dashboardPeriod.wk == "d" ? " selected" : ""),
          () =>
            dashboardPeriod.wk == "w"
              ? wkNav() + wkDaysChart()
              : weekdayChart(dk.map((k) => [k, days[k]])),
          () => todayCardHtml(),
          () => registrationStatusCard(R, nm),
          () => pagerHtml(hbRows(Object.entries(dc), 10)),
        ],
      ) +
      actCtl() +
      renderActivityView("sup") +
      renderActivityView("dca") +
      renderActivityView("mda")
    );
  }
  function horizontalBars(a, n, keep) {
    a = (keep ? a : a.sort((x, y) => y[1] - x[1])).slice(0, n || 12);
    if (!a.length) return '<p class="em">No data for these filters.</p>';
    const m = Math.max(1, ...a.map((x) => x[1]));
    return a
      .map((x) =>
        __tpl(
          "horizontalBars.1",
          `<div class="hb" title="{{s1: escapeHtml(x[0])}}: {{s2: formatNumber(x[1])}}"><span>{{s3: escapeHtml(x[0])}}</span><u><i style="width:{{s4: (x[1] / m) * 100}}%"></i></u><b>{{s5: formatNumber(x[1])}}</b></div>`,
          [
            () => escapeHtml(x[0]),
            () => formatNumber(x[1]),
            () => escapeHtml(x[0]),
            () => (x[1] / m) * 100,
            () => formatNumber(x[1]),
          ],
        ),
      )
      .join("");
  }
  const monthLabel = (m) => MONTH_NAMES[+m.slice(5, 7) - 1] + " " + m.slice(0, 4);
  function msc(m) {
    const o = {};
    rows(true)
      .filter((r) => String(r.date).slice(0, 7) == m)
      .forEach((r) => (o[r.site] = (o[r.site] || 0) + totalDcas(r)));
    return o;
  }
  function wkArr(days) {
    const w = {};
    Object.keys(days).forEach((k) => {
      const m = weekStartOf(k);
      w[m] = (w[m] || 0) + days[k];
    });
    return Object.keys(w)
      .sort()
      .map((k) => [k, w[k]]);
  }
  function wkEnd(k) {
    const d = new Date(k + "T00:00:00");
    d.setDate(d.getDate() + 6);
    const e = toIsoDate(d),
      t = today();
    return e > t ? t : e;
  }
  function wkNo(k) {
    const d = new Date(k + "T00:00:00");
    d.setDate(d.getDate() + 3);
    const y = new Date(d.getFullYear(), 0, 4);
    return Math.round(((d - y) / 864e5 - 3 + ((y.getDay() + 6) % 7)) / 7) + 1;
  }
  const wkSelected = () => {
    const d = new Date(pageFilters.from + "T00:00:00");
    return d.getDay() == 1 && pageFilters.to == wkEnd(pageFilters.from);
  };
  document.addEventListener("apx-pick", (e) => {
    const d = e.detail;
    if (!d || d.kind != "week" || typeof pageFilters == "undefined") return;
    const k = d.key;
    if (pageFilters.from == k && pageFilters.to == wkEnd(k)) return resetDateRange();
    pageFilters.from = k;
    pageFilters.to = wkEnd(k);
    pageFilters.q = "";
    go();
  });
  const addD = (k, n) => {
    const d = new Date(k + "T00:00:00");
    d.setDate(d.getDate() + n);
    return toIsoDate(d);
  };
  const wkBase = () => (wkSelected() ? pageFilters.from : weekStartOf(today()));
  function wkNav() {
    const m = wkBase(),
      e = addD(m, 6),
      cur = m >= weekStartOf(today());
    return __tpl(
      "wkNav.2",
      `<div class="wknav" style="display:flex;align-items:center;gap:8px;justify-content:center;flex-wrap:wrap;margin:2px 0 4px"><button type="button" class="btn btn-sm" data-fa="wkp" title="Previous week"><i class="bx bx-chevron-left"></i></button><b>Week {{s1: wkNo(m)}}</b><span>{{s2: wkLb(m, 0)}} to {{s3: wkLb(m, 6)}} {{s4: new Date(e + 'T00:00:00').getFull…}}</span><button type="button" class="btn btn-sm" data-fa="wkn" title="Next week"{{s5: cur ? ' disabled' : ''}}><i class="bx bx-chevron-right"></i></button>{{s6: wkSelected() ? '' : …}}<small style="color:var(--mu)">{{s7: wkSelected() ? 'The page shows th…}}</small></div>`,
      [
        () => wkNo(m),
        () => wkLb(m, 0),
        () => wkLb(m, 6),
        () => new Date(e + "T00:00:00").getFullYear(),
        () => (cur ? " disabled" : ""),
        () =>
          wkSelected()
            ? ""
            : __tpl(
                "wkNav.1",
                `<button type="button" class="btn btn-sm" data-fa="wkf">Show this week on the page</button>`,
                [],
              ),
        () => (wkSelected() ? "The page shows this week's dates" : ""),
      ],
    );
  }
  function wkDaysChart() {
    const m = wkBase(),
      D = {},
      N = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    rows(true).forEach((r) => {
      D[r.date] = (D[r.date] || 0) + totalDcas(r);
    });
    const a = N.map((n, i) => [addD(m, i), D[addD(m, i)] || 0]);
    return apxEl(
      {
        t: "bar",
        data: a.map((x) => x[1]),
        cats: a.map((x, i) => [N[i], wkLb(m, i)]),
        tt: a.map((x, i) => N[i] + " " + wkLb(m, i)),
        col: "var(--v)",
        dl: 1,
      },
      250,
    );
  }
  function wkLb(k, n) {
    const d = new Date(k + "T00:00:00");
    d.setDate(d.getDate() + n);
    return (
      d.getDate() +
      " " +
      ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
        d.getMonth()
      ]
    );
  }
  function weekdayChart(a, pre) {
    pre = pre || "";
    if (!a.length) return '<p class="em">No reports in this date range.</p>';
    const wk = pre == "Week of ",
      sel = wk && wkSelected() ? a.findIndex((x) => x[0] == pageFilters.from) : -1;
    return apxEl(
      {
        t: "bar",
        data: a.map((x) => x[1]),
        cats: a.map((x) =>
          wk
            ? ["Week " + wkNo(x[0]), "Mon " + wkLb(x[0], 0), "Fri " + wkLb(x[0], 4)]
            : x[0].slice(5),
        ),
        tt: a.map((x) =>
          wk
            ? "Week " + wkNo(x[0]) + ": Mon " + wkLb(x[0], 0) + " to Sun " + wkLb(x[0], 6)
            : pre + x[0],
        ),
        col: "var(--v)",
        dl: a.length <= 20,
        click: wk ? "week" : "",
        keys: wk ? a.map((x) => x[0]) : null,
        sel: sel,
        hint: wk ? "Click a week to filter the page to its dates" : "",
      },
      wk ? 250 : 230,
    );
  }
  /* ---------- daily reports table ---------- */
  const stOf = (d, t) => (d >= t ? "Done" : d > 0 ? "Ongoing" : "Pending"),
    statusColors = {
      Done: "var(--g)",
      Ongoing: "var(--v)",
      Pending: "var(--r)",
    };
  function siteRows() {
    const cum = {},
      ds = {};
    REPORTS.forEach((r) => {
      if (r.date <= pageFilters.to) {
        cum[r.site] = (cum[r.site] || 0) + totalDcas(r);
        const q = (ds[r.site] = ds[r.site] || new Set());
        r.dcas.forEach((d) => q.add(d.name.toLowerCase()));
      }
    });
    return SITES.filter(
      (s) =>
        siteTarget(s) &&
        isTargetSite(s) &&
        (!pageFilters.site || s.id == pageFilters.site) &&
        (!pageFilters.state || siteStateAndCounty(s)[0] == pageFilters.state) &&
        (!pageFilters.county || siteStateAndCounty(s)[1] == pageFilters.county) &&
        (!pageFilters.sup || s.sup == pageFilters.sup),
    ).map((s) => {
      const t = siteTarget(s),
        d = cum[s.id] || 0,
        st = stOf(d, t);
      return {
        s,
        t,
        d,
        st,
        dn: (ds[s.id] || new Set()).size,
        rem: Math.max(0, t - d),
        od: !!(s.deadline && s.deadline < today() && st != "Done"),
      };
    });
  }
  const gp = (a, r) => [
    (100 + r * Math.cos(Math.PI * (1 - a))).toFixed(1),
    (100 - r * Math.sin(Math.PI * (1 - a))).toFixed(1),
  ];
  function gauge(pct) {
    const c = pct < 25 ? "var(--r)" : pct < 50 ? "#8a85ad" : pct < 75 ? "var(--v)" : "var(--g)";
    return apxEl(
      {
        t: "gauge",
        v: Math.min(100, pct),
        col: c,
      },
      150,
      210,
    );
  }
  function pie(c) {
    const k = Object.keys(c);
    return apxEl(
      {
        t: "pie",
        vals: k.map((x) => c[x]),
        labels: k,
        cols: k.map((x) => statusColors[x]),
        unit: " site(s)",
      },
      130,
      130,
    );
  }
  function renderKpiView() {
    const L = siteRows(),
      T = L.reduce((a, x) => a + x.t, 0),
      D = L.reduce((a, x) => a + x.d, 0),
      pct = T ? Math.round((D / T) * 100) : 0,
      c = {
        Done: 0,
        Ongoing: 0,
        Pending: 0,
      };
    L.forEach((x) => c[x.st]++);
    const od = L.filter((x) => x.od).length,
      R = rows(),
      days = new Set(R.map((r) => r.date)).size,
      act = days ? Math.round(R.reduce((a, r) => a + totalDcas(r), 0) / days) : 0;
    let plan = 0;
    L.forEach((x) => {
      if (x.st != "Done" && x.s.deadline && x.s.deadline >= today()) {
        const dl = Math.max(1, Math.round((new Date(x.s.deadline) - new Date(today())) / 864e5));
        plan += x.rem / dl;
      }
    });
    plan = Math.round(plan);
    const mx = Math.max(plan, act, 1);
    const bar = (v, col, l) =>
      __tpl(
        "bar.1",
        `<div style="text-align:center" title="{{s1: l}}: {{s2: v || 0}} registrations"><div style="font-weight:700">{{s3: v || '—'}}</div><div style="width:64px;height:{{s4: Math.max(4, (v / mx) * 90)}}px;background:{{s5: col}};margin:2px auto;border-radius:4px 4px 0 0"></div><small>{{s6: l}}</small></div>`,
        [
          () => l,
          () => v || 0,
          () => v || "—",
          () => Math.max(4, (v / mx) * 90),
          () => col,
          () => l,
        ],
      );
    const tr = L.sort((a, b) =>
      (a.s.deadline || "9999") < (b.s.deadline || "9999") ? -1 : 1,
    ).filter(
      (x) => !pageFilters.tst || (pageFilters.tst == "Overdue" ? x.od : x.st == pageFilters.tst),
    );
    return __tpl(
      "renderKpiView.5",
      `<div class="kpi"><div style="text-align:center"><div style="font-weight:800;margin-bottom:4px">Target = {{s1: formatNumber(T)}}<br>Achieved = {{s2: formatNumber(D)}}</div>{{s3: gauge(pct)}}<div style="font-weight:800;font-size:1.3rem;margin-top:-6px">{{s4: pct}}%</div><div style="font-weight:700">Registration progress</div></div>
<div style="text-align:center"><div style="font-weight:700;margin-bottom:6px">Daily registration average</div><div style="display:flex;gap:14px;align-items:flex-end;justify-content:center">{{s5: bar(plan, 'var(--v)', 'Needed / d…}}{{s6: bar(act, 'var(--g)', 'Actual / da…}}</div></div>
<div style="text-align:center"><div class="kh">Achieved<br>Site</div><div class="big">{{s7: c.Done}}</div></div><div style="text-align:center"><div class="kh">Overdue<br>Site</div><div class="big">{{s8: od}}</div></div>
<div style="display:flex;align-items:center;gap:10px">{{s9: pie(c)}}<div style="font-weight:700;font-size:.8rem">{{s10: Object.keys( c, ) .map(…)}}</div></div></div>
<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>Site progress tracker <small style="color:var(--mu)">(cumulative registrations up to {{s11: pageFilters.to}})</small></span><span class="xpb"><select id="fst" class="form-select form-select-sm" style="width:auto" title="Filter by status">{{s12: optionsHtml( [ ['', 'All statuses…}}</select>{{s13: exportButtonsHtml('all', 'trk')}}</span></h3>{{s14: L.length ? …}}</div>`,
      [
        () => formatNumber(T),
        () => formatNumber(D),
        () => gauge(pct),
        () => pct,
        () => bar(plan, "var(--v)", "Needed / day"),
        () => bar(act, "var(--g)", "Actual / day"),
        () => c.Done,
        () => od,
        () => pie(c),
        () =>
          Object.keys(c)
            .map((k) =>
              __tpl(
                "renderKpiView.1",
                `<div><span style="display:inline-block;width:10px;height:10px;background:{{s1: statusColors[k]}};margin-right:5px"></span>{{s2: k}}</div>`,
                [() => statusColors[k], () => k],
              ),
            )
            .join(""),
        () => pageFilters.to,
        () =>
          optionsHtml(
            [
              ["", "All statuses"],
              ["Done", "Done"],
              ["Ongoing", "Ongoing"],
              ["Pending", "Pending"],
              ["Overdue", "Overdue"],
            ],
            pageFilters.tst,
          ),
        () => exportButtonsHtml("all", "trk"),
        () =>
          L.length
            ? __tpl(
                "renderKpiView.4",
                `<table><thead><tr><th>Site / MDA</th><th class="n">Total</th><th class="n">Done</th><th class="n">Remaining</th><th>Status</th><th>Progress</th><th>Opening</th><th>Closing</th><th>Supervisor</th><th>Comment</th>{{s1: isSubadminOrAdmin() ? ' th /th '…}}</tr></thead><tbody>{{s2: tr .slice(0, 150) .map(…)}}<tr style="background:rgba(143,162,255,.18);font-weight:800"><td>TOTAL{{s3: pageFilters.tst ? ' · ' + pageFil…}} ({{s4: tr.length}})</td><td class="n">{{s5: formatNumber(tr.reduce((a, x) = a…}}</td><td class="n">{{s6: formatNumber(tr.reduce((a, x) = a…}}</td><td class="n">{{s7: formatNumber(tr.reduce((a, x) = a…}}</td><td colspan="{{s8: isSubadminOrAdmin() ? 7 : 6}}"></td></tr></tbody></table>{{s9: L.length 150 ? ' p class='em' Sho…}}`,
                [
                  () => (isSubadminOrAdmin() ? "<th></th>" : ""),
                  () =>
                    tr
                      .slice(0, 150)
                      .map((x) => {
                        const p = Math.min(100, Math.round((x.d / x.t) * 100));
                        return __tpl(
                          "renderKpiView.3",
                          `<tr><td>{{s1: escapeHtml(x.s.mda || x.s.name)}}{{s2: x.s.mda ? ' br small ' + escapeHt…}}</td><td class="n">{{s3: formatNumber(x.t)}}</td><td class="n">{{s4: formatNumber(x.d)}}</td><td class="n">{{s5: formatNumber(x.rem)}}</td><td><span class="btn btn-sm btn-{{s6: Done: 'success', Ongoing: 'primar…}} stbtn">{{s7: x.st}}</span>{{s8: x.od ? ' span class='btn btn-sm b…}}</td><td><div class="pb"><i style="width:{{s9: p}}%"></i><span>{{s10: p}}%</span></div></td><td>{{s11: escapeHtml(x.s.open || '—')}}</td><td>{{s12: escapeHtml(x.s.deadline || '—')}}</td><td>{{s13: escapeHtml(x.s.sup || '—')}}</td><td>{{s14: escapeHtml(x.s.cmt || '')}}</td>{{s15: isSubadminOrAdmin() ? …}}</tr>`,
                          [
                            () => escapeHtml(x.s.mda || x.s.name),
                            () =>
                              x.s.mda ? "<br><small>" + escapeHtml(x.s.name) + "</small>" : "",
                            () => formatNumber(x.t),
                            () => formatNumber(x.d),
                            () => formatNumber(x.rem),
                            () =>
                              ({
                                Done: "success",
                                Ongoing: "primary",
                                Pending: "warning",
                              })[x.st],
                            () => x.st,
                            () =>
                              x.od
                                ? ' <span class="btn btn-sm btn-danger stbtn">Overdue</span>'
                                : "",
                            () => p,
                            () => p,
                            () => escapeHtml(x.s.open || "—"),
                            () => escapeHtml(x.s.deadline || "—"),
                            () => escapeHtml(x.s.sup || "—"),
                            () => escapeHtml(x.s.cmt || ""),
                            () =>
                              isSubadminOrAdmin()
                                ? __tpl(
                                    "renderKpiView.2",
                                    `<td><button type="button" class="btn btn-sm btn-outline-primary" data-fa="estr" data-i="{{s1: escapeHtml(x.s.id)}}"><i class="bx bx-edit"></i> Edit</button></td>`,
                                    [() => escapeHtml(x.s.id)],
                                  )
                                : "",
                          ],
                        );
                      })
                      .join(""),
                  () => (pageFilters.tst ? " · " + pageFilters.tst : ""),
                  () => tr.length,
                  () => formatNumber(tr.reduce((a, x) => a + x.t, 0)),
                  () => formatNumber(tr.reduce((a, x) => a + x.d, 0)),
                  () => formatNumber(tr.reduce((a, x) => a + Math.max(0, x.t - x.d), 0)),
                  () => (isSubadminOrAdmin() ? 7 : 6),
                  () => (L.length > 150 ? '<p class="em">Showing the first 150 sites.</p>' : ""),
                ],
              )
            : '<p class="em">No site has an FTE target yet. Set targets in the "Site targets" tab.</p>',
      ],
    );
  }
  let reviewStatusFilter = "";
  window.__rvf = (v) => {
    reviewStatusFilter = v;
    go();
  };
  function reviewBadgeHtml(r) {
    const s = reviewStatus(r);
    return (
      __tpl("reviewBadgeHtml.1", `<span class="rvb {{s1: s[0].toLowerCase()}}">{{s2: s}}</span>`, [
        () => s[0].toLowerCase(),
        () => s,
      ]) +
      __tpl(
        "reviewBadgeHtml.2",
        `<br><button type="button" class="btn rvh" data-fa="rvh" data-i="{{s1: escapeHtml(r.id)}}" style="padding:1px 7px;font-size:.7rem"><i class="bx bx-history"></i> History</button>`,
        [() => escapeHtml(r.id)],
      )
    );
  }
  function rvMineOld() {
    const ms = supervisorNameFor();
    if (!ms) return "";
    const L = REPORTS.filter(
      (r) => r.by == AUSER || String(reportSupervisor(r)).toLowerCase() == ms.toLowerCase(),
    ).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const pend = L.filter((r) => reviewStatus(r) == "Pending").length,
      rej = L.filter((r) => reviewStatus(r) == "Rejected").length;
    return (
      __tpl(
        "rvMineOld.1",
        `<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>My reports · {{s1: escapeHtml(ms)}}</span><small style="color:var(--mu);font-weight:400">{{s2: pend}} pending · {{s3: rej}} rejected</small></h3>`,
        [() => escapeHtml(ms), () => pend, () => rej],
      ) +
      (L.length
        ? __tpl(
            "rvMineOld.4",
            `<table><thead><tr><th>Date</th><th>Registration site</th><th class="n">Registered</th><th>Review</th><th></th></tr></thead><tbody>{{s1: L.map(…)}}</tbody></table>`,
            [
              () =>
                L.map((r) => {
                  const s = findSite(r.site) || {};
                  return __tpl(
                    "rvMineOld.3",
                    `<tr><td>{{s1: escapeHtml(r.date)}}</td><td>{{s2: escapeHtml(s.name || '\\u2014')}}</td><td class="n">{{s3: formatNumber(totalDcas(r))}}</td><td>{{s4: reviewBadgeHtml(r)}}</td><td><button type="button" class="btn" data-fa="rv" data-i="{{s5: escapeHtml(r.id)}}"><i class="bx bx-show"></i> View</button> {{s6: isReviewLocked(r) ? ' span class=…}}</td></tr>`,
                    [
                      () => escapeHtml(r.date),
                      () => escapeHtml(s.name || "\u2014"),
                      () => formatNumber(totalDcas(r)),
                      () => reviewBadgeHtml(r),
                      () => escapeHtml(r.id),
                      () =>
                        isReviewLocked(r)
                          ? '<span class="rvl"><i class="bx bx-lock-alt"></i> Locked</span>'
                          : __tpl(
                              "rvMineOld.2",
                              `<button type="button" class="btn" data-fa="er" data-i="{{s1: escapeHtml(r.id)}}">Edit</button>`,
                              [() => escapeHtml(r.id)],
                            ),
                    ],
                  );
                }).join(""),
            ],
          )
        : '<p class="em">You have not submitted any report yet.</p>') +
      "</div>"
    );
  }
  function rvInc(ids) {
    const L = ids
      ? REPORTS.filter((r) => ids.includes(r.id) && String(r.note || "").trim()).map((r) => {
          const s = findSite(r.site) || {};
          return {
            r,
            site: s.name || "",
            mda: r.regMda || s.mda || s.name || "",
            note: String(r.note).trim(),
          };
        })
      : ilList().filter((x) => x.note);
    return (
      __tpl(
        "rvInc.1",
        `<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>My incident log</span><small style="color:var(--mu);font-weight:400">{{s1: L.length}} report{{s2: L.length == 1 ? '' : 's'}} with an incident</small></h3>`,
        [() => L.length, () => (L.length == 1 ? "" : "s")],
      ) +
      (L.length
        ? __tpl(
            "rvInc.3",
            `<table><thead><tr><th>Date</th><th>Registration site</th><th>MDA</th><th>Incident log</th></tr></thead><tbody>{{s1: L.map(…)}}</tbody></table>`,
            [
              () =>
                L.map((x) =>
                  __tpl(
                    "rvInc.2",
                    `<tr><td>{{s1: escapeHtml(x.r.date)}}</td><td>{{s2: escapeHtml(x.site || '\\u2014')}}</td><td>{{s3: escapeHtml(x.mda || '\\u2014')}}</td><td style="white-space:normal;min-width:220px">{{s4: escapeHtml(x.note)}}</td></tr>`,
                    [
                      () => escapeHtml(x.r.date),
                      () => escapeHtml(x.site || "\u2014"),
                      () => escapeHtml(x.mda || "\u2014"),
                      () => escapeHtml(x.note),
                    ],
                  ),
                ).join(""),
            ],
          )
        : '<p class="em">No incident logged in your reports.</p>') +
      "</div>"
    );
  }
  try {
    SITES.forEach((x) => {
      if (
        x &&
        x.note ===
          "Imported from registration-site workbook; map pin uses county headquarters location."
      )
        x.note = "";
    });
  } catch (e) {}
  let MYF = {
    st: "",
    from: "",
    to: "",
    q: "",
    inv: "",
  };
  window.__myf = (k, v) => {
    MYF[k] = v;
    go();
  };
  function myL() {
    const ms = supervisorNameFor(),
      q = MYF.q.trim().toLowerCase();
    return REPORTS.filter(
      (r) => r.by == AUSER || String(reportSupervisor(r)).toLowerCase() == String(ms).toLowerCase(),
    )
      .filter(
        (r) =>
          (!MYF.st || reviewStatus(r) == MYF.st) &&
          (!MYF.from || r.date >= MYF.from) &&
          (!MYF.to || r.date <= MYF.to),
      )
      .map((r) => {
        const s = findSite(r.site) || {},
          l = s.id != null ? siteStateAndCounty(s) : ["", ""];
        return {
          r,
          s,
          st: l[0] || "",
          co: l[1] || "",
          site: s.name || "\u2014",
        };
      })
      .filter(
        (x) =>
          !q ||
          [x.r.date, x.site, x.st, x.co, reviewStatus(x.r), x.r.regMda || x.s.mda || ""]
            .join(" ")
            .toLowerCase()
            .includes(q),
      )
      .sort((a, b) => (a.r.date < b.r.date ? 1 : a.r.date > b.r.date ? -1 : 0));
  }
  function supervisorReviewBarHtml() {
    const ms = supervisorNameFor();
    if (!ms) return "";
    const L = myL();
    const bar = __tpl(
      "supervisorReviewBarHtml.1",
      `<div class="card fcard"><div class="flt"><label>Review status<select onchange="window.__myf('st',this.value)">{{s1: optionsHtml( [ ['', 'All'], ['Pen…}}</select></label><label>From<input type="date" value="{{s2: escapeHtml(MYF.from)}}" onchange="window.__myf('from',this.value)"></label><label>To<input type="date" value="{{s3: escapeHtml(MYF.to)}}" onchange="window.__myf('to',this.value)"></label><label>Inventory<select onchange="window.__myf('inv',this.value)">{{s4: optionsHtml( [ ['', 'All'], ['bad…}}</select></label><label>Search<input value="{{s5: escapeHtml(MYF.q)}}" placeholder="Site, state, county, MDA or status" onchange="window.__myf('q',this.value)"></label><button type="button" class="btn" onclick="MYF={st:'',from:'',to:'',q:'',inv:''};go()">Reset</button></div></div>`,
      [
        () =>
          optionsHtml(
            [
              ["", "All"],
              ["Pending", "Pending"],
              ["Accepted", "Accepted"],
              ["Rejected", "Rejected"],
            ],
            MYF.st,
          ),
        () => escapeHtml(MYF.from),
        () => escapeHtml(MYF.to),
        () =>
          optionsHtml(
            [
              ["", "All"],
              ["bad", "With faults / damage"],
              ["ok", "No faults"],
            ],
            MYF.inv,
          ),
        () => escapeHtml(MYF.q),
      ],
    );
    const pend = L.filter((x) => reviewStatus(x.r) == "Pending").length,
      rej = L.filter((x) => reviewStatus(x.r) == "Rejected").length;
    const mine =
      __tpl(
        "supervisorReviewBarHtml.2",
        `<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>My reports · {{s1: escapeHtml(ms)}}</span><small style="color:var(--mu);font-weight:400">{{s2: L.length}} report{{s3: L.length == 1 ? '' : 's'}} · {{s4: pend}} pending · {{s5: rej}} rejected</small></h3>`,
        [
          () => escapeHtml(ms),
          () => L.length,
          () => (L.length == 1 ? "" : "s"),
          () => pend,
          () => rej,
        ],
      ) +
      (L.length
        ? __tpl(
            "supervisorReviewBarHtml.5",
            `<table><thead><tr><th>Date</th><th>Registration site</th><th>State</th><th>County</th><th class="n">DCAs</th><th class="n">Registered</th><th>Review</th><th></th></tr></thead><tbody>{{s1: L.map(…)}}</tbody></table>`,
            [
              () =>
                L.map((x) => {
                  const r = x.r;
                  return __tpl(
                    "supervisorReviewBarHtml.4",
                    `<tr><td>{{s1: escapeHtml(r.date)}}</td><td>{{s2: escapeHtml(x.site)}}</td><td>{{s3: escapeHtml(x.st)}}</td><td>{{s4: escapeHtml(x.co)}}</td><td class="n">{{s5: (r.dcas || []).length}}</td><td class="n">{{s6: formatNumber(totalDcas(r))}}</td><td>{{s7: reviewBadgeHtml(r)}}</td><td><button type="button" class="btn" data-fa="rv" data-i="{{s8: escapeHtml(r.id)}}"><i class="bx bx-show"></i> View</button> {{s9: reviewStatus(r) == 'Accepted' ? '…}}</td></tr>`,
                    [
                      () => escapeHtml(r.date),
                      () => escapeHtml(x.site),
                      () => escapeHtml(x.st),
                      () => escapeHtml(x.co),
                      () => (r.dcas || []).length,
                      () => formatNumber(totalDcas(r)),
                      () => reviewBadgeHtml(r),
                      () => escapeHtml(r.id),
                      () =>
                        reviewStatus(r) == "Accepted"
                          ? '<span class="rvl"><i class="bx bx-lock-alt"></i> Locked</span>'
                          : reviewStatus(r) == "Rejected"
                            ? __tpl(
                                "supervisorReviewBarHtml.3",
                                `<button type="button" class="btn" data-fa="er" data-i="{{s1: escapeHtml(r.id)}}"><i class="bx bx-edit"></i> Correct &amp; resubmit</button>`,
                                [() => escapeHtml(r.id)],
                              )
                            : '<span class="rvl">Waiting for review</span>',
                    ],
                  );
                }).join(""),
            ],
          )
        : '<p class="em">No reports for these filters.</p>') +
      "</div>";
    const sum = (r) =>
      (r.mdas || []).reduce(
        (a, m) => ({
          ok: a.ok + (+m.ok || 0),
          pend: a.pend + (+m.pend || 0),
          fail: a.fail + (+m.fail || 0),
        }),
        {
          ok: 0,
          pend: 0,
          fail: 0,
        },
      );
    const T = L.reduce(
        (a, x) => {
          const m = sum(x.r);
          a.ok += m.ok;
          a.pend += m.pend;
          a.fail += m.fail;
          return a;
        },
        {
          ok: 0,
          pend: 0,
          fail: 0,
        },
      ),
      TT = T.ok + T.pend + T.fail;
    const track =
      __tpl(
        "supervisorReviewBarHtml.6",
        `<div class="card tw"><h3>My registration status — completed, pending and failed</h3><div class="kp"><div><small>Completed</small><b style="color:#22a559">{{s1: formatNumber(T.ok)}}</b><small>{{s2: TT ? Math.round((T.ok / TT) * 100…}}%</small></div><div><small>Pending</small><b style="color:#C5A059">{{s3: formatNumber(T.pend)}}</b><small>{{s4: TT ? Math.round((T.pend / TT) * 1…}}%</small></div><div><small>Failed</small><b style="color:#e5484d">{{s5: formatNumber(T.fail)}}</b><small>{{s6: TT ? Math.round((T.fail / TT) * 1…}}%</small></div><div><small>Total</small><b>{{s7: formatNumber(TT)}}</b></div></div>`,
        [
          () => formatNumber(T.ok),
          () => (TT ? Math.round((T.ok / TT) * 100) : 0),
          () => formatNumber(T.pend),
          () => (TT ? Math.round((T.pend / TT) * 100) : 0),
          () => formatNumber(T.fail),
          () => (TT ? Math.round((T.fail / TT) * 100) : 0),
          () => formatNumber(TT),
        ],
      ) +
      (L.length
        ? __tpl(
            "supervisorReviewBarHtml.8",
            `<table><thead><tr><th>Date</th><th>Registration site</th><th>State</th><th>County</th><th class="n">Completed</th><th class="n">Pending</th><th class="n">Failed</th><th style="min-width:200px">Progress</th></tr></thead><tbody>{{s1: L.map(…)}}</tbody></table>`,
            [
              () =>
                L.map((x) => {
                  const m = sum(x.r);
                  return __tpl(
                    "supervisorReviewBarHtml.7",
                    `<tr><td>{{s1: escapeHtml(x.r.date)}}</td><td>{{s2: escapeHtml(x.site)}}</td><td>{{s3: escapeHtml(x.st)}}</td><td>{{s4: escapeHtml(x.co)}}</td><td class="n">{{s5: formatNumber(m.ok)}}</td><td class="n">{{s6: formatNumber(m.pend)}}</td><td class="n">{{s7: formatNumber(m.fail)}}</td><td>{{s8: stBar(m, 1) || '\\u2014'}}</td></tr>`,
                    [
                      () => escapeHtml(x.r.date),
                      () => escapeHtml(x.site),
                      () => escapeHtml(x.st),
                      () => escapeHtml(x.co),
                      () => formatNumber(m.ok),
                      () => formatNumber(m.pend),
                      () => formatNumber(m.fail),
                      () => stBar(m, 1) || "\u2014",
                    ],
                  );
                }).join(""),
            ],
          )
        : '<p class="em">No reports for these filters.</p>') +
      "</div>";
    const IV = L.filter((x) => (x.r.items && x.r.items.length) || (x.r.setups && x.r.setups.length))
      .map((x) => {
        const r = x.r,
          it = r.items || [],
          su = r.setups || [],
          dv = su.reduce((a, z) => a + (z.devices ? z.devices.length : z.dev ? 1 : 0), 0),
          bad =
            it.filter((z) => BAD_DEVICE_STATUSES.includes(z.st)).length +
            su.reduce(
              (a, z) =>
                a +
                (z.devices ? z.devices : z.dev ? [z] : []).filter((d) =>
                  BAD_DEVICE_STATUSES.includes(d.st),
                ).length,
              0,
            );
        return Object.assign({}, x, {
          mda: r.regMda || x.s.mda || x.s.name || "",
          by: r.by || "",
          qty: it.reduce((a, z) => a + (+z.n || 0), 0),
          su: su.length,
          dv,
          bad,
        });
      })
      .filter((x) => !MYF.inv || (MYF.inv == "bad" ? x.bad > 0 : x.bad == 0));
    const IT = (k) => IV.reduce((a, x) => a + x[k], 0);
    const inv =
      __tpl(
        "supervisorReviewBarHtml.9",
        `<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>My inventory reports · {{s1: IV.length}}</span></h3>`,
        [() => IV.length],
      ) +
      (IV.length
        ? __tpl(
            "supervisorReviewBarHtml.11",
            `<table><thead><tr><th>Date</th><th>State</th><th>County</th><th>Registration site</th><th>MDA</th><th>Entered by</th><th class="n">Items</th><th class="n">Setups</th><th class="n">Devices</th><th class="n">Faults</th><th></th></tr></thead><tbody>{{s1: IV.map(…)}}</tbody><tfoot><tr class="dg"><td>TOTAL · {{s2: IV.length}} report{{s3: IV.length == 1 ? '' : 's'}}</td><td></td><td></td><td></td><td></td><td></td><td class="n">{{s4: formatNumber(IT('qty'))}}</td><td class="n">{{s5: formatNumber(IT('su'))}}</td><td class="n">{{s6: formatNumber(IT('dv'))}}</td><td class="n">{{s7: formatNumber(IT('bad'))}}</td><td></td></tr></tfoot></table>`,
            [
              () =>
                IV.map((x) =>
                  __tpl(
                    "supervisorReviewBarHtml.10",
                    `<tr><td>{{s1: escapeHtml(x.r.date)}}</td><td>{{s2: escapeHtml(x.st || '\\u2014')}}</td><td>{{s3: escapeHtml(x.co || '\\u2014')}}</td><td>{{s4: escapeHtml(x.site || '\\u2014')}}</td><td>{{s5: escapeHtml(x.mda || '\\u2014')}}</td><td>{{s6: escapeHtml(x.by)}}</td><td class="n"><b>{{s7: formatNumber(x.qty)}}</b></td><td class="n">{{s8: formatNumber(x.su)}}</td><td class="n">{{s9: formatNumber(x.dv)}}</td><td class="n"{{s10: x.bad ? ' style='color:var(--r);f…}}>{{s11: formatNumber(x.bad)}}</td><td class="ac"><span class="rp-act" style="margin:0;flex-wrap:nowrap"><button type="button" class="btn" data-fa="ivv" data-i="{{s12: escapeHtml(x.r.id)}}"><i class="bx bx-show"></i> View</button><button type="button" class="btn" data-fa="ivp" data-i="{{s13: escapeHtml(x.r.id)}}"><i class="bx bx-printer"></i> Print</button></span></td></tr>`,
                    [
                      () => escapeHtml(x.r.date),
                      () => escapeHtml(x.st || "\u2014"),
                      () => escapeHtml(x.co || "\u2014"),
                      () => escapeHtml(x.site || "\u2014"),
                      () => escapeHtml(x.mda || "\u2014"),
                      () => escapeHtml(x.by),
                      () => formatNumber(x.qty),
                      () => formatNumber(x.su),
                      () => formatNumber(x.dv),
                      () => (x.bad ? ' style="color:var(--r);font-weight:700"' : ""),
                      () => formatNumber(x.bad),
                      () => escapeHtml(x.r.id),
                      () => escapeHtml(x.r.id),
                    ],
                  ),
                ).join(""),
              () => IV.length,
              () => (IV.length == 1 ? "" : "s"),
              () => formatNumber(IT("qty")),
              () => formatNumber(IT("su")),
              () => formatNumber(IT("dv")),
              () => formatNumber(IT("bad")),
            ],
          )
        : '<p class="em">No inventory for these filters.</p>') +
      "</div>";
    return bar + mine + track + inv + rvInc(L.map((x) => x.r.id));
  }
  function reviewCountsBarHtml() {
    const A = rows(),
      c = {
        Pending: 0,
        Accepted: 0,
        Rejected: 0,
      };
    A.forEach((r) => c[reviewStatus(r)]++);
    return (
      __tpl(
        "reviewCountsBarHtml.1",
        `<div class="flt tfbar"><label>Review status<select onchange="window.__rvf(this.value)">{{s1: optionsHtml( [ ['', 'All (' + A.l…}}</select></label>`,
        [
          () =>
            optionsHtml(
              [
                ["", "All (" + A.length + ")"],
                ["Pending", "Pending (" + c.Pending + ")"],
                ["Accepted", "Accepted (" + c.Accepted + ")"],
                ["Rejected", "Rejected (" + c.Rejected + ")"],
              ],
              reviewStatusFilter,
            ),
        ],
      ) +
      (isSubadminOrAdmin() && c.Pending
        ? __tpl(
            "reviewCountsBarHtml.2",
            `<span class="rvn"><i class="bx bx-time-five"></i> {{s1: c.Pending}} report{{s2: c.Pending == 1 ? '' : 's'}} waiting for your review</span>`,
            [() => c.Pending, () => (c.Pending == 1 ? "" : "s")],
          )
        : "") +
      __tpl("reviewCountsBarHtml.3", `</div>`, [])
    );
  }
  function renderReportsView() {
    const R = rows()
        .filter((r) => !reviewStatusFilter || reviewStatus(r) == reviewStatusFilter)
        .sort((a, b) => (a.date < b.date ? 1 : -1)),
      by = {};
    R.forEach((r) => (by[r.date] = by[r.date] || []).push(r));
    const ds = Object.keys(by).sort().reverse();
    return (
      filt() +
      reviewCountsBarHtml() +
      renderKpiView() +
      __tpl(
        "renderReportsView.1",
        `<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>Daily reports by date</span>{{s1: exportButtonsHtml('all', 'rep')}}</h3>`,
        [() => exportButtonsHtml("all", "rep")],
      ) +
      (ds.length
        ? __tpl(
            "renderReportsView.2",
            `<table><thead><tr><th>Date</th><th>Registration site / MDA</th><th>Location</th><th class="n">DCAs</th><th class="n">Registered</th><th>Registered by each DCA</th><th>FTEs by MDA</th><th>Incident log</th><th>Supervisor</th><th>Review</th><th></th></tr></thead><tbody>`,
            [],
          ) +
          ds
            .map((d) => {
              const L = by[d];
              return L.map((r) => {
                const s = findSite(r.site),
                  l = s ? siteStateAndCounty(s) : ["", ""],
                  mine = isSubadminOrAdmin() || r.by == AUSER;
                return __tpl(
                  "renderReportsView.11",
                  `<tr><td>{{s1: r.date}}<div class="rp-act"><button type="button" class="btn" data-fa="rv" data-i="{{s2: escapeHtml(r.id)}}" title="View the full report"><i class="bx bx-show"></i> View</button><button type="button" class="btn" data-fa="rpr" data-i="{{s3: escapeHtml(r.id)}}" title="Print the report"><i class="bx bx-printer"></i> Print</button></div></td><td>{{s4: escapeHtml(r.regMda || siteMdaNam…}}{{s5: s (r.regMda || s.mda) ? ' br smal…}}</td><td>{{s6: escapeHtml(l[1])}}, {{s7: escapeHtml(l[0])}}</td><td class="n">{{s8: r.dcas.length}}</td><td class="n">{{s9: formatNumber(totalDcas(r))}}</td><td>{{s10: r.dcas.map(…)}}</td><td>{{s11: mdaCell(r)}}</td><td>{{s12: String(r.note || '').trim() ? …}}</td><td>{{s13: escapeHtml(reportSupervisor(r) ||…}}</td><td>{{s14: reviewBadgeHtml(r)}}</td><td>{{s15: canEnter() mine !isReviewLocked(r…}}{{s16: isSubadminOrAdmin() reviewStatus(…}}{{s17: isSubadminOrAdmin() reviewStatus(…}}{{s18: isSubadminOrAdmin() ? …}}</td></tr>`,
                  [
                    () => r.date,
                    () => escapeHtml(r.id),
                    () => escapeHtml(r.id),
                    () => escapeHtml(r.regMda || siteMdaName(s)),
                    () =>
                      s && (r.regMda || s.mda)
                        ? "<br><small>" + escapeHtml(s.name) + "</small>"
                        : "",
                    () => escapeHtml(l[1]),
                    () => escapeHtml(l[0]),
                    () => r.dcas.length,
                    () => formatNumber(totalDcas(r)),
                    () =>
                      r.dcas
                        .map((x) =>
                          __tpl(
                            "renderReportsView.3",
                            `{{s1: escapeHtml(x.name)}}: <b>{{s2: formatNumber(x.n)}}</b>`,
                            [() => escapeHtml(x.name), () => formatNumber(x.n)],
                          ),
                        )
                        .join("<br>"),
                    () => mdaCell(r),
                    () =>
                      String(r.note || "").trim()
                        ? __tpl(
                            "renderReportsView.4",
                            `<span class="ilg y" title="{{s1: escapeHtml(String(r.note).trim())}}">Yes</span>`,
                            [() => escapeHtml(String(r.note).trim())],
                          )
                        : __tpl("renderReportsView.5", `<span class="ilg">No</span>`, []),
                    () => escapeHtml(reportSupervisor(r) || "—"),
                    () => reviewBadgeHtml(r),
                    () =>
                      canEnter() && mine && !isReviewLocked(r)
                        ? __tpl(
                            "renderReportsView.6",
                            `<button class="btn" data-fa="er" data-i="{{s1: r.id}}">Edit</button> `,
                            [() => r.id],
                          )
                        : canEnter() && mine
                          ? __tpl(
                              "renderReportsView.7",
                              `<span class="rvl"><i class="bx bx-lock-alt"></i> Locked</span> `,
                              [],
                            )
                          : "",
                    () =>
                      isSubadminOrAdmin() && reviewStatus(r) != "Accepted"
                        ? __tpl(
                            "renderReportsView.8",
                            `<button class="btn rva" data-fa="rva" data-i="{{s1: r.id}}"><i class="bx bx-check"></i> Accept</button> `,
                            [() => r.id],
                          )
                        : "",
                    () =>
                      isSubadminOrAdmin() && reviewStatus(r) != "Rejected"
                        ? __tpl(
                            "renderReportsView.9",
                            `<button class="btn dng" data-fa="rvr" data-i="{{s1: r.id}}"><i class="bx bx-x"></i> Reject</button> `,
                            [() => r.id],
                          )
                        : "",
                    () =>
                      isSubadminOrAdmin()
                        ? __tpl(
                            "renderReportsView.10",
                            `<button class="btn dg" data-fa="dr" data-i="{{s1: r.id}}">Delete</button>`,
                            [() => r.id],
                          )
                        : "",
                  ],
                );
              }).join("");
            })
            .join("") +
          __tpl(
            "renderReportsView.12",
            `</tbody><tfoot><tr class="dg"><td>Total</td><td>{{s1: R.length}} report{{s2: R.length == 1 ? '' : 's'}}</td><td></td><td class="n">{{s3: formatNumber(R.reduce((a, r) = a…}}</td><td class="n">{{s4: formatNumber(R.reduce((a, r) = a…}}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tfoot></table>`,
            [
              () => R.length,
              () => (R.length == 1 ? "" : "s"),
              () => formatNumber(R.reduce((a, r) => a + r.dcas.length, 0)),
              () => formatNumber(R.reduce((a, r) => a + totalDcas(r), 0)),
            ],
          )
        : '<p class="em">No reports for these filters.</p>') +
      "</div>"
    );
  }
  /* ---------- enter daily report ---------- */
  /* ---------- enter daily report: 3-step wizard (type & site -> details -> preview & submit) ---------- */
  (() => {
    const c =
      ".fr .wz-st{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.fr .wz-s{display:flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid var(--line);background:transparent;color:var(--mu);border-radius:999px;font:inherit;font-size:.78rem;cursor:pointer}.fr .wz-s b{width:22px;height:22px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--line);font-size:.72rem}.fr .wz-s.on{color:var(--tx);border-color:var(--v);background:rgba(197, 160, 89,.16)}.fr .wz-s.on b{background:var(--v);color:#000000;border-color:var(--v)}.fr .wz-s.done b{background:var(--g);color:#000000;border-color:var(--g)}.fr .wz-ty{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin-bottom:14px}.fr .wz-c{text-align:left;padding:14px;border:1px solid var(--line);background:rgba(127,127,160,.08);color:var(--tx);border-radius:12px;font:inherit;cursor:pointer;display:flex;flex-direction:column;gap:4px}.fr .wz-c b{font-size:.95rem}.fr .wz-c small{color:var(--mu);font-size:.72rem}.fr .wz-c.on{border-color:var(--v);background:rgba(197, 160, 89,.2);box-shadow:0 0 0 1px var(--v) inset}.fr .wz-n{color:var(--mu);font-size:.78rem;margin:4px 0 8px;min-height:1.1em}.fr .wz-dr{display:grid;grid-template-columns:28px 2fr 1fr;gap:8px;margin-bottom:6px;align-items:center}.fr .wz-ix{color:var(--mu);font-size:.75rem;text-align:center}.fr .wz-mc{border:1px solid var(--line);border-radius:12px;padding:10px;margin-bottom:10px;background:rgba(127,127,160,.06)}.fr .wz-mh{display:grid;grid-template-columns:28px 1fr;gap:8px;margin-bottom:8px;align-items:center}.fr .wz-it{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 44px auto;gap:6px;margin-bottom:6px;align-items:center}.fr .wz-t{text-align:right;font-weight:700;color:var(--g)}.fr .wz-ch{display:flex;flex-wrap:wrap;gap:6px;max-height:170px;overflow:auto;padding:6px;border:1px solid var(--line);border-radius:10px;margin:6px 0 10px}.fr .wz-chip{flex-direction:row;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--line);border-radius:999px;font-size:.74rem;cursor:pointer;color:var(--tx)}.fr .wz-chip[hidden]{display:none}.fr .wz-chip.on{border-color:var(--g);background:rgba(62,240,176,.14)}.fr .wz-chip input{margin:0}.fr .wz-nav{display:flex;gap:8px;align-items:center;margin-top:14px;padding-top:12px;border-top:1px solid var(--line);position:sticky;bottom:0;background:var(--bg)}.fr .wz-sp{flex:1}.fr .btn:disabled{opacity:.4;cursor:not-allowed}.fr .wz-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-bottom:12px}.fr .wz-info div{border:1px solid var(--line);border-radius:10px;padding:8px 10px;font-size:.8rem}.fr .wz-info small{display:block;color:var(--mu);font-size:.68rem}@media(max-width:620px){.fr .wz-it{grid-template-columns:1fr 1fr 1fr}.fr .wz-it .wz-im{grid-column:1/-1}.fr .wz-dr{grid-template-columns:1fr}}";
    document.head.appendChild(
      Object.assign(document.createElement("style"), {
        textContent: c,
      }),
    );
  })();
  let wizardState = null;
  const toWholeNumber = (v) => Math.max(0, Math.floor(+v || 0)),
    newWizardItem = () => ({
      mda: "",
      n: "",
    }),
    newWizardMda = () => ({
      name: "",
      items: [newWizardItem()],
    });
  const blankWizardState = () => ({
    edr: null,
    od: "",
    late: "",
    step: 1,
    setN: "",
    setups: [],
    items: {},
    ist: {},
    inn: {},
    invInit: false,
    type: "",
    date: today(),
    st: "",
    co: "",
    site: "",
    reg: "",
    mda: "",
    n: 1,
    rows: [
      {
        name: "",
        n: "",
      },
    ],
    ok: "",
    pend: "",
    fail: "",
    msel: [],
    mst: {},
    mrows: [newWizardMda()],
    note: "",
    legacy: false,
    err: "",
    q: "",
    sup: "",
    supSite: "",
  });
  function wFrom(r) {
    const w = blankWizardState(),
      s = findSite(r.site),
      l = s ? siteStateAndCounty(s) : ["", ""],
      ms = r.mdas || [];
    w.edr = r.id;
    w.od = r.date;
    w.setups = (r.setups || []).map((x) => ({
      who: x.who,
      devs: (
        x.devices ||
        (x.dev
          ? [
              {
                dev: x.dev,
                st: x.st,
                nt: x.nt,
              },
            ]
          : [])
      ).map((d) => ({
        id: d.dev,
        st: d.st || "Working",
        nt: d.nt || "",
      })),
    }));
    w.setN = String(w.setups.length || "");
    w.items = {};
    w.ist = {};
    w.inn = {};
    (r.items || []).forEach((x) => {
      w.items[x.cat] = x.n;
      w.ist[x.cat] = x.st || "Working";
      w.inn[x.cat] = x.nt || "";
    });
    w.invInit = true;
    w.date = r.date;
    w.st = l[0];
    w.co = l[1];
    w.site = r.site;
    w.reg = r.regMda || (s && s.mda) || "";
    w.note = r.note || "";
    w.sup = r.sup || "";
    w.supSite = r.site;
    w.type = r.type || (ms.length > 1 ? "multi" : "single");
    if (w.type == "single") {
      const m = ms[0] || {};
      w.mda = m.mda || "";
      w.ok = m.ok == null ? "" : m.ok;
      w.pend = m.pend == null ? "" : m.pend;
      w.fail = m.fail == null ? "" : m.fail;
      w.rows = r.dcas.map((d) => ({
        name: d.name,
        n: d.n,
      }));
      if (!w.rows.length)
        w.rows = [
          {
            name: "",
            n: "",
          },
        ];
      w.n = w.rows.length;
    } else {
      w.msel = ms.map((m) => m.mda);
      ms.forEach((m) => {
        w.mst[m.mda] = {
          ok: m.ok == null ? "" : m.ok,
          pend: m.pend == null ? "" : m.pend,
          fail: m.fail == null ? "" : m.fail,
        };
      });
      if (r.alloc && r.alloc.length) {
        const by = {};
        r.alloc.forEach((a) => {
          (by[a.dca] = by[a.dca] || {
            name: a.dca,
            items: [],
          }).items.push({
            mda: a.mda,
            n:
              a.n != null
                ? a.n
                : toWholeNumber(a.ok) + toWholeNumber(a.pend) + toWholeNumber(a.fail),
          });
        });
        w.mrows = r.dcas.map(
          (d) =>
            by[d.name] || {
              name: d.name,
              items: [newWizardItem()],
            },
        );
      } else if (r.dcas.length == 1)
        w.mrows = [
          {
            name: r.dcas[0].name,
            items: ms.map((m) => ({
              mda: m.mda,
              n: m.n,
            })),
          },
        ];
      else {
        w.legacy = true;
        w.mrows = r.dcas.map((d) => ({
          name: d.name,
          items: [newWizardItem()],
        }));
      }
      if (!w.mrows.length) w.mrows = [newWizardMda()];
      w.n = w.mrows.length;
    }
    return w;
  }
  function renderEnterReportView() {
    {
      const r0 = editingReportId ? REPORTS.find((x) => x.id == editingReportId) : null;
      if (r0 && isReviewLocked(r0)) {
        editingReportId = null;
        wizardState = null;
        toast("This report was accepted by the admin and can no longer be edited");
      }
    }
    if (!wizardState || wizardState.edr !== (editingReportId || null)) {
      const r = editingReportId ? REPORTS.find((x) => x.id == editingReportId) : null;
      wizardState = r ? wFrom(r) : blankWizardState();
      wizardState.edr = r ? r.id : null;
      if (!r) {
        const dd = loadWizardDraft();
        if (dd) {
          wizardState = Object.assign(blankWizardState(), dd.w, {
            edr: null,
            err: "",
            _restored: dd.at,
          });
        }
      }
    }
    return __tpl(
      "renderEnterReportView.1",
      `<div class="card"><h3>{{s1: wizardState.edr ? 'Update daily r…}}</h3><div id="wz">{{s2: wBody()}}</div></div>`,
      [() => (wizardState.edr ? "Update daily report" : "Enter daily report"), () => wBody()],
    );
  }
  const wSteps = ["Type & site", "Details", "Inventory", "Preview & submit"];
  function wHead0() {
    return __tpl("wHead0.2", `<div class="wz-st">{{s1: wSteps.map(…)}}</div>`, [
      () =>
        wSteps
          .map((t, i) =>
            __tpl(
              "wHead0.1",
              `<button type="button" class="wz-s{{s1: wizardState.step == i + 1 ? ' on'…}}{{s2: wizardState.step i + 1 ? ' done'…}}" data-w="go" data-i="{{s3: i + 1}}"><b>{{s4: wizardState.step i + 1 ? ' i clas…}}</b>{{s5: t}}</button>`,
              [
                () => (wizardState.step == i + 1 ? " on" : ""),
                () => (wizardState.step > i + 1 ? " done" : ""),
                () => i + 1,
                () => (wizardState.step > i + 1 ? '<i class="bx bx-check"></i>' : i + 1),
                () => t,
              ],
            ),
          )
          .join(""),
    ]);
  }
  function wNav() {
    return __tpl(
      "wNav.2",
      `<div class="wz-nav"><button type="button" class="btn" data-w="prev"{{s1: wizardState.step == 1 ? ' disable…}}><i class="bx bx-left-arrow-alt"></i> Previous</button><button type="button" class="btn" data-w="reset"><i class="bx bx-reset"></i> Reset</button><button type="button" class="btn" data-w="cancel">Cancel</button>{{s2: wizardState.edr ? '' : ' button t…}}<span class="wz-sp"></span>{{s3: wizardState.step 4 ? ' button typ…}}</div>`,
      [
        () => (wizardState.step == 1 ? " disabled" : ""),
        () =>
          wizardState.edr
            ? ""
            : '<button type="button" class="btn" data-w="dsave"><i class="bx bx-save"></i> Save draft</button><small id="wdt" style="color:var(--mu)">' +
              wDraftTxt() +
              "</small>",
        () =>
          wizardState.step < 4
            ? '<button type="button" class="btn pri" data-w="next">Next <i class="bx bx-right-arrow-alt"></i></button>'
            : __tpl(
                "wNav.1",
                `<button type="button" class="btn pri" data-w="submit">{{s1: wizardState.edr ? 'Confirm update…}}</button>`,
                [() => (wizardState.edr ? "Confirm & update report" : "Confirm & submit report")],
              ),
      ],
    );
  }
  function wBody() {
    const st = wizardState.step;
    let h = wHead();
    if (st == 2 && wizardState.legacy)
      h +=
        '<p class="pm" style="color:var(--a)">This older report did not record which DCA registered which MDA. Please enter the DCA numbers again below.</p>';
    h +=
      st == 1
        ? wS1()
        : st == 2
          ? wizardState.type == "single"
            ? wS2s()
            : wS2m()
          : st == 3
            ? wSInv()
            : wS3();
    return (
      h +
      __tpl("wBody.1", `<div class="pm" id="we">{{s1: escapeHtml(wizardState.err)}}</div>`, [
        () => escapeHtml(wizardState.err),
      ]) +
      wNav()
    );
  }
  function wSiteInfo() {
    const s = findSite(wizardState.site);
    if (!s) return "";
    const m = s.mda ? "MDA of this site: " + s.mda + " · " : "";
    let c = 0;
    REPORTS.forEach((r) => {
      if (r.site == s.id && r.id != wizardState.edr) c += totalDcas(r);
    });
    const t = siteTarget(s);
    return (
      m +
      (t
        ? `FTE target ${formatNumber(t)} · registered so far ${formatNumber(c)} · remaining ${formatNumber(Math.max(0, t - c))}`
        : "No FTE target set for this site yet.")
    );
  }
  const mdaNameOf = (x) => x.mda || x.name;
  const wizardMda = () =>
    wizardState.rmd ||
    (findSite(wizardState.site) || {}).mda ||
    (findSite(wizardState.site) || {}).name ||
    "";
  const reportSupervisor = (r) => r.sup || (findSite(r.site) || {}).sup || "";
  const isTargetSite = (x) =>
      x.tg || x.open || x.deadline || x.sup || +x.dcaN || x.status == "Active",
    isTargetOrSelected = (x) => isTargetSite(x) || x.id == wizardState.site;
  const wizardMdaNames = () =>
    [
      ...new Set(
        sitesInCounty(wizardState.st, wizardState.co).filter(isTargetOrSelected).map(mdaNameOf),
      ),
    ].sort((a, b) => a.localeCompare(b));
  const wizardSites = () =>
    sitesInCounty(wizardState.st, wizardState.co)
      .filter(isTargetOrSelected)
      .filter((x) => mdaNameOf(x) == wizardMda())
      .sort((a, b) => a.name.localeCompare(b.name));
  function wS1() {
    return __tpl(
      "wS1.2",
      `<h3 style="margin:2px 0 8px">1 · Is this a single site or a multi site report?</h3><div class="wz-ty"><button type="button" class="wz-c{{s1: wizardState.type == 'single' ? '…}}" data-w="type" data-v="single"><b>Single site</b><small>All FTEs registered today belong to one MDA (ministry)</small></button><button type="button" class="wz-c{{s2: wizardState.type == 'multi' ? ' o…}}" data-w="type" data-v="multi"><b>Multi site</b><small>FTEs from several MDAs were registered today; say which DCA registered which MDA</small></button></div>
<div class="flt"><label>Registration date<input type="date" id="wd" max="{{s3: today()}}"{{s4: bdMin()}} value="{{s5: escapeHtml(wizardState.date)}}">{{s6: bdHint()}}</label>{{s7: bdReason()}}<label>Site location (state)<select id="ws">{{s8: optionsHtml(states(), wizardState…}}</select></label><label>County<select id="wc">{{s9: optionsHtml(counties(wizardState.…}}</select></label><label>Registration site MDA (ministry)<select id="wmd">{{s10: optionsHtml( wizardMdaNames().map…}}</select></label><label>Registration site / office<select id="wi">{{s11: optionsHtml( wizardSites().map(…)}}</select></label>{{s12: (() = if (wizardState.supSite !==…}}</div><p class="wz-n">{{s13: escapeHtml(wSiteInfo())}}</p>{{s14: wizardState.co !wizardMdaNames().…}}`,
      [
        () => (wizardState.type == "single" ? " on" : ""),
        () => (wizardState.type == "multi" ? " on" : ""),
        () => today(),
        () => bdMin(),
        () => escapeHtml(wizardState.date),
        () => bdHint(),
        () => bdReason(),
        () => optionsHtml(states(), wizardState.st, "Select state"),
        () => optionsHtml(counties(wizardState.st), wizardState.co, "Select county"),
        () =>
          optionsHtml(
            wizardMdaNames().map((x) => [x, x]),
            wizardMda(),
            wizardState.co && !wizardMdaNames().length
              ? "No site target in this county"
              : "Select MDA",
          ),
        () =>
          optionsHtml(
            wizardSites().map((x) => [x.id, x.name]),
            wizardState.site,
            "Select site",
          ),
        () =>
          (() => {
            if (wizardState.supSite !== wizardState.site) {
              wizardState.sup = "";
              wizardState.supSite = wizardState.site;
            }
            const dv = wizardState.sup || (findSite(wizardState.site) || {}).sup || "";
            return __tpl(
              "wS1.1",
              `<label>Supervisor<select id="wsp">{{s1: optionsHtml(supList(dv), dv, 'Sel…}}</select></label>`,
              [() => optionsHtml(supList(dv), dv, "Select supervisor")],
            );
          })(),
        () => escapeHtml(wSiteInfo()),
        () =>
          wizardState.co && !wizardMdaNames().length
            ? '<p class="pm">Only sites with a site target can be reported on. Add this site under “Site targets” first.</p>'
            : "",
      ],
    );
  }
  const wNoDca = () =>
    dataCollectors.some((x) => x.status != "Inactive")
      ? ""
      : '<p class="pm">No active data collectors yet. Add them in the Data collectors tab first.</p>';
  const wCount = () =>
    __tpl(
      "wCount.1",
      `<label>Number of DCAs at the site<input type="number" id="wnn" min="1" max="60" value="{{s1: wizardState.n}}"></label>`,
      [() => wizardState.n],
    );
  const wAddMda = "";
  function wS2s() {
    const nD = wizardState.rows.length,
      t = findSite(wizardState.site) || {};
    return __tpl(
      "wS2s.2",
      `<h3 style="margin:2px 0 10px">2 · Single site details</h3>
<div class="wz-sc"><div class="wz-sh"><i class="bx bx-buildings"></i><div><b>{{s1: escapeHtml(t.name || 'Registratio…}}</b><small>{{s2: escapeHtml(wSiteInfo())}}</small></div><span class="badge text-bg-primary">{{s3: escapeHtml(wizardState.date)}}</span></div>
<div class="flt"><label>MDA of the FTEs registered<select id="wm"><option value="">Select MDA</option>{{s4: mdaOpts(wizardState.mda)}}</select></label>{{s5: wAddMda}}{{s6: wCount()}}</div>{{s7: wNoDca()}}</div>
<div class="wz-g2">
<div class="wz-sc"><div class="wz-sh"><i class="bx bx-id-card"></i><div><b>Registrations done by each DCA</b><small>One line per data collector at this site</small></div><span class="badge text-bg-secondary">{{s8: nD}} DCA{{s9: nD == 1 ? '' : 's'}}</span><button type="button" class="btn btn-sm btn-primary" data-w="dadd"><i class="bx bx-plus"></i> Add DCA</button></div>
<div class="row g-2 wz-dh d-none d-sm-flex"><div class="col-auto wz-c0">#</div><div class="col">Data collector (DCA)</div><div class="col-sm-4 col-md-3">Registered</div><div class="col-auto wz-c1"></div></div>
{{s10: wizardState.rows.map(…)}}
<div class="wz-tt"><span>Total registered by DCAs</span><b id="wz-dt">0</b></div></div>
<div class="wz-sc"><div class="wz-sh"><i class="bx bx-task"></i><div><b>Status of the registrations</b><small>Complete + Pending + Failed must equal the DCA total</small></div><span class="badge text-bg-secondary">Total <b id="wz-st">0</b></span></div>
<div class="wz-stt"><label class="wz-sx ok"><i class="bx bx-check-circle"></i><span>Complete</span><input type="number" min="0" id="wo" placeholder="0" value="{{s11: escapeHtml(wizardState.ok)}}"></label><label class="wz-sx pe"><i class="bx bx-time-five"></i><span>Pending</span><input type="number" min="0" id="wp" placeholder="0" value="{{s12: escapeHtml(wizardState.pend)}}"></label><label class="wz-sx fa"><i class="bx bx-x-circle"></i><span>Failed</span><input type="number" min="0" id="wf" placeholder="0" value="{{s13: escapeHtml(wizardState.fail)}}"></label></div></div>
</div><div id="wsum" class="wz-sum alert alert-secondary" role="status"></div>`,
      [
        () => escapeHtml(t.name || "Registration site"),
        () => escapeHtml(wSiteInfo()),
        () => escapeHtml(wizardState.date),
        () => mdaOpts(wizardState.mda),
        () => wAddMda,
        () => wCount(),
        () => wNoDca(),
        () => nD,
        () => (nD == 1 ? "" : "s"),
        () =>
          wizardState.rows
            .map((d, i) =>
              __tpl(
                "wS2s.1",
                `<div class="row g-2 align-items-center wz-dr mb-2"><div class="col-auto wz-ix wz-c0">{{s1: i + 1}}</div><div class="col"><select class="wz-dn"><option value="">Select DCA</option>{{s2: dcaOpts(d.name)}}</select></div><div class="col-4 col-md-3"><input type="number" min="0" class="wz-dv" placeholder="0" value="{{s3: escapeHtml(d.n)}}"></div><div class="col-auto wz-c1"><button type="button" class="btn btn-sm btn-outline-danger wz-rm" data-w="drm" data-i="{{s4: i}}" title="Remove this DCA" aria-label="Remove this DCA"><i class="bx bx-trash"></i></button></div></div>`,
                [() => i + 1, () => dcaOpts(d.name), () => escapeHtml(d.n), () => i],
              ),
            )
            .join(""),
        () => escapeHtml(wizardState.ok),
        () => escapeHtml(wizardState.pend),
        () => escapeHtml(wizardState.fail),
      ],
    );
  }
  function wS2m() {
    const sel = wizardState.msel;
    return __tpl(
      "wS2m.7",
      `<h3 style="margin:2px 0 10px">2 · Multi site details</h3>
<div class="wz-sc"><div class="wz-sh"><i class="bx bx-buildings"></i><div><b>{{s1: escapeHtml((findSite(wizardState.…}}</b><small>{{s2: escapeHtml(wSiteInfo())}}</small></div><span class="badge text-bg-primary">{{s3: escapeHtml(wizardState.date)}}</span></div>
<div class="flt"><label>MDAs registered today<div class="ms"><button type="button" class="ms-btn" data-w="msopen"><span>{{s4: sel.length ? sel.length + ' MDA'…}}</span><i class="bx bx-chevron-down"></i></button></div></label>{{s5: wAddMda}}</div><div class="ms-tags">{{s6: sel.map(…)}}</div>{{s7: wNoDca()}}</div>
<div class="wz-g2">
<div class="wz-sc"><div class="wz-sh"><i class="bx bx-id-card"></i><div><b>Registrations done by each DCA</b><small>Pick the DCA, the MDA and how many were registered. Use “+ MDA” when one DCA registered more than one MDA</small></div><span class="badge text-bg-secondary">{{s8: wizardState.mrows.length}} DCA{{s9: wizardState.mrows.length == 1 ? '…}}</span><button type="button" class="btn btn-sm btn-primary" data-w="dadd"><i class="bx bx-plus"></i> Add DCA</button></div>
<div class="row g-2 wz-dh wz-dh3 d-none d-sm-flex"><div class="col-auto wz-c0">#</div><div class="col">DCA · MDA</div><div class="col-sm-4 col-md-3">Registered</div><div class="col-auto wz-c1"></div></div>
{{s10: wizardState.mrows.map(…)}}
<div class="wz-tt"><span>Total registered by DCAs</span><b id="wz-dt">0</b></div></div>
<div class="wz-sc"><div class="wz-sh"><i class="bx bx-task"></i><div><b>Status of the registrations</b><small>For each MDA: Complete + Pending + Failed must equal what the DCAs registered</small></div></div>
{{s11: sel.length ? sel .map(…)}}</div>
</div><div id="wsum" class="wz-sum alert alert-secondary" role="status"></div>`,
      [
        () => escapeHtml((findSite(wizardState.site) || {}).name || "Registration site"),
        () => escapeHtml(wSiteInfo()),
        () => escapeHtml(wizardState.date),
        () =>
          sel.length
            ? sel.length + " MDA" + (sel.length > 1 ? "s" : "") + " selected"
            : "Select MDAs…",
        () => wAddMda,
        () =>
          sel
            .map((m) =>
              __tpl(
                "wS2m.1",
                `<span class="ms-tag">{{s1: escapeHtml(m)}}<button type="button" data-w="msdel" data-m="{{s2: escapeHtml(m)}}" aria-label="Remove"><i class="bx bx-x"></i></button></span>`,
                [() => escapeHtml(m), () => escapeHtml(m)],
              ),
            )
            .join("") || '<span class="pm">No MDA selected yet.</span>',
        () => wNoDca(),
        () => wizardState.mrows.length,
        () => (wizardState.mrows.length == 1 ? "" : "s"),
        () =>
          wizardState.mrows
            .map((d, i) =>
              __tpl(
                "wS2m.5",
                `<div class="wz-mc"><div class="row g-2 align-items-center wz-mh mb-2"><div class="col-auto wz-ix wz-c0">{{s1: i + 1}}</div><div class="col"><select class="wz-dn"><option value="">Select DCA</option>{{s2: dcaOpts(d.name)}}</select></div><div class="col-auto wz-c1"><button type="button" class="btn btn-sm btn-outline-danger wz-rm" data-w="drm" data-i="{{s3: i}}" title="Remove this DCA" aria-label="Remove this DCA"><i class="bx bx-trash"></i></button></div></div>{{s4: d.items.map(…)}}<button type="button" class="btn btn-sm btn-outline-primary" data-w="iadd" data-i="{{s5: i}}"><i class="bx bx-plus"></i> MDA</button></div>`,
                [
                  () => i + 1,
                  () => dcaOpts(d.name),
                  () => i,
                  () =>
                    d.items
                      .map((m, j) =>
                        __tpl(
                          "wS2m.4",
                          `<div class="row g-2 align-items-center wz-it mb-2"><div class="col-auto wz-c0"></div><div class="col-12 col-sm"><select class="wz-im"><option value="">Select MDA</option>{{s1: sel.map(…)}}</select></div><div class="col-9 col-sm-4 col-md-3"><input type="number" min="0" class="wz-in" placeholder="0" value="{{s2: escapeHtml(m.n)}}"></div><div class="col-auto wz-c1">{{s3: d.items.length 1 ? …}}</div></div>`,
                          [
                            () =>
                              sel
                                .map((x) =>
                                  __tpl(
                                    "wS2m.2",
                                    `<option{{s1: x == m.mda ? ' selected' : ''}}>{{s2: escapeHtml(x)}}</option>`,
                                    [() => (x == m.mda ? " selected" : ""), () => escapeHtml(x)],
                                  ),
                                )
                                .join(""),
                            () => escapeHtml(m.n),
                            () =>
                              d.items.length > 1
                                ? __tpl(
                                    "wS2m.3",
                                    `<button type="button" class="btn btn-sm btn-outline-secondary wz-rm" data-w="irm" data-i="{{s1: i}}" data-j="{{s2: j}}" title="Remove this MDA line"><i class="bx bx-x"></i></button>`,
                                    [() => i, () => j],
                                  )
                                : "",
                          ],
                        ),
                      )
                      .join(""),
                  () => i,
                ],
              ),
            )
            .join(""),
        () =>
          sel.length
            ? sel
                .map((m) => {
                  const t = wizardState.mst[m] || {};
                  return __tpl(
                    "wS2m.6",
                    `<div class="wz-ms" data-m="{{s1: escapeHtml(m)}}"><div class="wz-msh"><b>{{s2: escapeHtml(m)}}</b><span class="badge text-bg-secondary">DCAs <b class="wz-rg">0</b></span><span class="badge wz-ck2">Status <b class="wz-sg">0</b></span></div><div class="wz-stt"><label class="wz-sx ok"><i class="bx bx-check-circle"></i><span>Complete</span><input type="number" min="0" class="wz-so" placeholder="0" value="{{s3: escapeHtml(t.ok == null ? '' : t.…}}"></label><label class="wz-sx pe"><i class="bx bx-time-five"></i><span>Pending</span><input type="number" min="0" class="wz-sp2" placeholder="0" value="{{s4: escapeHtml(t.pend == null ? '' :…}}"></label><label class="wz-sx fa"><i class="bx bx-x-circle"></i><span>Failed</span><input type="number" min="0" class="wz-sf" placeholder="0" value="{{s5: escapeHtml(t.fail == null ? '' :…}}"></label></div></div>`,
                    [
                      () => escapeHtml(m),
                      () => escapeHtml(m),
                      () => escapeHtml(t.ok == null ? "" : t.ok),
                      () => escapeHtml(t.pend == null ? "" : t.pend),
                      () => escapeHtml(t.fail == null ? "" : t.fail),
                    ],
                  );
                })
                .join("")
            : '<p class="pm">Select the MDAs above and a status card appears here for each of them.</p>',
      ],
    );
  }
  function wBuild() {
    if (wizardState.type == "single") {
      if (!wizardState.mda)
        return {
          err: "Select the MDA of the FTEs registered.",
        };
      const d = wizardState.rows.map((r) => ({
        name: String(r.name || "").trim(),
        n: toWholeNumber(r.n),
      }));
      if (d.some((x) => !x.name))
        return {
          err: "Select a DCA in every row and enter how many each registered.",
        };
      if (new Set(d.map((x) => x.name.toLowerCase())).size < d.length)
        return {
          err: "A DCA appears twice — keep each DCA once.",
        };
      const ok = toWholeNumber(wizardState.ok),
        pend = toWholeNumber(wizardState.pend),
        fail = toWholeNumber(wizardState.fail),
        ds = d.reduce((a, x) => a + x.n, 0),
        ms = ok + pend + fail;
      if (ds != ms)
        return {
          err: `The DCAs registered ${ds}, but Complete + Pending + Failed is ${ms}. The two totals must be equal.`,
        };
      return {
        o: {
          type: "single",
          dcas: d,
          mdas: [
            {
              mda: wizardState.mda,
              ok,
              pend,
              fail,
              n: ms,
            },
          ],
          alloc: undefined,
        },
      };
    }
    if (!wizardState.msel.length)
      return {
        err: "Select at least one MDA that was registered today.",
      };
    const d = [],
      lines = [],
      T = {};
    for (const row of wizardState.mrows) {
      const name = String(row.name || "").trim();
      if (!name)
        return {
          err: "Select a DCA in every card.",
        };
      const seen = new Set();
      let n = 0;
      for (const it of row.items) {
        if (!it.mda)
          return {
            err: `Select the MDA for each line of ${name}.`,
          };
        if (seen.has(it.mda))
          return {
            err: `${name} has ${it.mda} twice — combine the numbers.`,
          };
        seen.add(it.mda);
        const c = toWholeNumber(it.n);
        n += c;
        T[it.mda] = (T[it.mda] || 0) + c;
        lines.push({
          dca: name,
          mda: it.mda,
          n: c,
        });
      }
      d.push({
        name,
        n,
      });
    }
    if (new Set(d.map((x) => x.name.toLowerCase())).size < d.length)
      return {
        err: "A DCA appears twice — keep each DCA once.",
      };
    const M = {},
      alloc = [];
    for (const m of wizardState.msel) {
      const t = wizardState.mst[m] || {},
        ok = toWholeNumber(t.ok),
        pend = toWholeNumber(t.pend),
        fail = toWholeNumber(t.fail),
        dv = T[m] || 0;
      if (ok + pend + fail != dv)
        return {
          err: `${m}: the DCAs registered ${dv}, but Complete + Pending + Failed is ${ok + pend + fail}. They must be equal.`,
        };
      if (!dv) continue;
      M[m] = {
        mda: m,
        ok,
        pend,
        fail,
        n: dv,
      };
      let ro = ok,
        rp = pend;
      lines
        .filter((l) => l.mda == m)
        .forEach((l) => {
          let c = l.n;
          const a = Math.min(c, ro);
          ro -= a;
          c -= a;
          const b = Math.min(c, rp);
          rp -= b;
          c -= b;
          alloc.push({
            dca: l.dca,
            mda: m,
            n: l.n,
            ok: a,
            pend: b,
            fail: c,
          });
        });
    }
    if (!Object.keys(M).length)
      return {
        err: "Enter how many each DCA registered.",
      };
    return {
      o: {
        type: "multi",
        dcas: d.filter((x) => x.n > 0 || true),
        mdas: Object.values(M),
        alloc,
      },
    };
  }
  function wV1() {
    if (!wizardState.type) return "Choose Single site or Multi site.";
    if (!wizardState.date || wizardState.date > today())
      return "Choose a valid registration date (not in the future).";
    {
      const l = bdLate();
      if (l) return l;
    }
    if (!wizardState.site) return "Select the state, county and registration site.";
    if (
      REPORTS.some(
        (r) => r.site == wizardState.site && r.date == wizardState.date && r.id != wizardState.edr,
      )
    )
      return "A report for this site and date already exists. Edit that report instead.";
    return "";
  }
  /* ---------- Enter daily report: inventory step (setups at the site) ---------- */
  const DEVICE_STATUSES = ["Working", "Faulty", "Damaged", "Lost / stolen", "Not used"];
  const wDevLbl = (x) => [x.cat, x.desc].filter(Boolean).join(" · ") || "Equipment";
  const wDevs = (who) =>
    inventoryItems.filter(
      (x) =>
        who &&
        String(x.as || "").toLowerCase() == String(who).toLowerCase() &&
        !["Retired", "Lost"].includes(x.st),
    );
  const wBlankSet = (who) => ({
    who: who || "",
    devs: wDevs(who).map((d) => ({
      id: d.id,
      st: "Working",
      nt: "",
    })),
  });
  function wSetResize(n) {
    while (wizardState.setups.length < n) wizardState.setups.push(wBlankSet(""));
    wizardState.setups.length = n;
  }
  function wInvInit() {
    if (wizardState.invInit) return;
    wizardState.invInit = true;
    if (wizardState.edr) return;
    const names = (wizardState.type == "single" ? wizardState.rows : wizardState.mrows)
        .map((r) => String(r.name || "").trim())
        .filter(Boolean),
      n = Math.max(1, names.length);
    wizardState.setN = String(n);
    wizardState.setups = [];
    for (let i = 0; i < n; i++) wizardState.setups.push(wBlankSet(names[i] || ""));
  }
  function wInvCollect() {
    const q = (s) => document.querySelector("#wz " + s),
      all = (s) => [...document.querySelectorAll("#wz " + s)];
    document.querySelectorAll("#wz .wi-q").forEach((e) => {
      const v = e.value.trim();
      if (v === "") delete wizardState.items[e.dataset.c];
      else wizardState.items[e.dataset.c] = v;
    });
    document.querySelectorAll("#wz .wi-is").forEach((e) => {
      wizardState.ist[e.dataset.c] = e.value;
    });
    document.querySelectorAll("#wz .wi-in").forEach((e) => {
      wizardState.inn[e.dataset.c] = e.value.trim();
    });
    const n = q("#wsn");
    if (n) wizardState.setN = n.value.trim();
    all(".wi-r").forEach((r, i) => {
      const x = wizardState.setups[i];
      if (!x) return;
      x.who = r.querySelector(".wi-p").value;
      [...r.querySelectorAll(".wi-dr")].forEach((tr, k) => {
        const d = x.devs[k];
        if (!d) return;
        d.st = tr.querySelector(".wi-s").value;
        d.nt = tr.querySelector(".wi-n").value.trim();
      });
    });
  }
  function wInvErr() {
    const n = wizardState.setN === "" ? wizardState.setups.length : +wizardState.setN;
    if (
      !/^\d+$/.test(
        String(wizardState.setN === "" ? wizardState.setups.length : wizardState.setN),
      ) ||
      n < 1
    )
      return "Enter the number of setups at the site (1 or more).";
    if (n > 200) return "The number of setups cannot be more than 200.";
    if (wizardState.setups.length != n)
      return "Press the number of setups again to generate the list.";
    const i = wizardState.setups.findIndex((x) => !x.who);
    if (i >= 0) return "Setup " + (i + 1) + ": select the DCA / supervisor.";
    return "";
  }
  const wDev = (id) => inventoryItems.find((x) => x.id == id) || {};
  function wSetOut() {
    return wizardState.setups.map((x) => ({
      who: x.who,
      devices: x.devs.map((v) => {
        const d = wDev(v.id);
        return {
          dev: v.id,
          cat: d.cat || "",
          desc: d.desc || "",
          sn: d.sn || "",
          at: d.at || "",
          ct: d.ct || "",
          st: v.st,
          nt: v.nt,
        };
      }),
    }));
  }
  function wItemsOut() {
    return Object.keys(wizardState.items)
      .map((c) => ({
        cat: c,
        n: toWholeNumber(wizardState.items[c]),
        st: wizardState.ist[c] || "Working",
        nt: wizardState.inn[c] || "",
      }))
      .filter((x) => x.n > 0);
  }
  function wSInv() {
    wInvInit();
    const cats = inventoryCategories.filter(wCatOn);
    Object.keys(wizardState.items).forEach((c) => {
      if (!cats.includes(c)) cats.push(c);
    });
    const sets = wizardState.setups
      .map((x, i) => {
        const rows = x.devs
          .map((v) => {
            const d = wDev(v.id);
            return __tpl(
              "wSInv.1",
              `<tr class="wi-dr"><td>{{s1: escapeHtml(d.cat || '—')}}</td><td>{{s2: escapeHtml(d.desc || '—')}}</td><td>{{s3: escapeHtml(d.sn || '—')}}</td><td>{{s4: escapeHtml(d.at || '—')}}</td><td>{{s5: escapeHtml(d.ct || '—')}}</td><td><select class="wi-s" style="margin:0">{{s6: optionsHtml(DEVICE_STATUSES, v.st)}}</select></td><td><input class="wi-n" value="{{s7: escapeHtml(v.nt || '')}}" maxlength="200" placeholder="e.g. screen cracked" style="margin:0"></td></tr>`,
              [
                () => escapeHtml(d.cat || "—"),
                () => escapeHtml(d.desc || "—"),
                () => escapeHtml(d.sn || "—"),
                () => escapeHtml(d.at || "—"),
                () => escapeHtml(d.ct || "—"),
                () => optionsHtml(DEVICE_STATUSES, v.st),
                () => escapeHtml(v.nt || ""),
              ],
            );
          })
          .join("");
        return __tpl(
          "wSInv.5",
          `<div class="card wi-r" style="margin:8px 0"><button type="button" class="btn wsrm" style="float:right;padding:3px 10px" title="Remove this setup">Remove</button><h4 class="wz-tt2" style="margin:0 0 6px">Setup {{s1: i + 1}}{{s2: x.devs.length ? …}}</h4><div class="flt" style="align-items:end"><label>DCA / supervisor<select class="wi-p" data-search>{{s3: optionsHtml(iPeople(x.who), x.who…}}</select></label></div>
{{s4: x.devs.length ? …}}</div>`,
          [
            () => i + 1,
            () =>
              x.devs.length
                ? __tpl(
                    "wSInv.2",
                    ` <small style="color:var(--mu);font-weight:400">· {{s1: x.devs.length}} device{{s2: x.devs.length == 1 ? '' : 's'}}</small>`,
                    [() => x.devs.length, () => (x.devs.length == 1 ? "" : "s")],
                  )
                : "",
            () => optionsHtml(iPeople(x.who), x.who, "Select DCA / supervisor"),
            () =>
              x.devs.length
                ? __tpl(
                    "wSInv.3",
                    `<div class="tw"><table data-nodt style="width:100%"><thead><tr><th>Category</th><th>Description</th><th>Serial number</th><th>Asset tag</th><th>Company tag</th><th>Status today</th><th>Note (optional)</th></tr></thead><tbody>{{s1: rows}}</tbody></table></div>`,
                    [() => rows],
                  )
                : __tpl(
                    "wSInv.4",
                    `<p class="em" style="text-align:left;margin:6px 0">{{s1: x.who ? 'No device is assigned to…}}</p>`,
                    [
                      () =>
                        x.who
                          ? "No device is assigned to this person in the inventory."
                          : "Select a person to load the devices assigned to them.",
                    ],
                  ),
          ],
        );
      })
      .join("");
    return __tpl(
      "wSInv.7",
      `<h3 style="margin:2px 0 8px">3 · Inventory — equipment at the site</h3>
<h4 class="wz-tt2">Inventory report <small style="color:var(--mu);font-weight:400">(optional — type how many you have)</small></h4>
<div class="tw"><table data-nodt style="width:100%"><thead><tr><th style="width:48px">#</th><th>Item</th><th style="width:130px">Quantity</th><th style="width:170px">Status</th><th>Note (optional)</th></tr></thead><tbody>{{s1: cats.map(…)}}</tbody></table></div>
<h4 class="wz-tt2" style="margin-top:14px">Setups at the site <small style="color:var(--r);font-weight:600">(required)</small></h4>
<div class="flt" style="align-items:end"><label>Number of setups at the site<input id="wsn" type="number" min="1" max="200" value="{{s2: escapeHtml(wizardState.setN)}}"></label><button type="button" class="btn" id="wsadd" style="margin-bottom:2px">+ Add setup</button><span class="wz-n" style="flex:2 1 260px">Choose the DCA / supervisor for each setup. Every device assigned to them in the inventory is listed with its serial number, asset tag and company tag.</span></div>{{s3: inventoryItems.length ? '' : ' p…}}
{{s4: sets || ' p class='em' style='tex…}}`,
      [
        () =>
          cats
            .map((c, i) =>
              __tpl(
                "wSInv.6",
                `<tr><td>{{s1: i + 1}}</td><td>{{s2: escapeHtml(c)}}</td><td><input class="wi-q" data-c="{{s3: escapeHtml(c)}}" type="number" min="0" max="10000" value="{{s4: escapeHtml(wizardState.items[c] =…}}" placeholder="0" aria-label="{{s5: escapeHtml(c)}}" style="margin:0;width:100%"></td><td><select class="wi-is" data-c="{{s6: escapeHtml(c)}}" style="margin:0;width:100%">{{s7: optionsHtml(DEVICE_STATUSES, wiza…}}</select></td><td><input class="wi-in" data-c="{{s8: escapeHtml(c)}}" value="{{s9: escapeHtml(wizardState.inn[c] ||…}}" maxlength="200" placeholder="e.g. 1 torn" style="margin:0;width:100%"></td></tr>`,
                [
                  () => i + 1,
                  () => escapeHtml(c),
                  () => escapeHtml(c),
                  () => escapeHtml(wizardState.items[c] == null ? "" : wizardState.items[c]),
                  () => escapeHtml(c),
                  () => escapeHtml(c),
                  () => optionsHtml(DEVICE_STATUSES, wizardState.ist[c] || "Working"),
                  () => escapeHtml(c),
                  () => escapeHtml(wizardState.inn[c] || ""),
                ],
              ),
            )
            .join(""),
        () => escapeHtml(wizardState.setN),
        () =>
          inventoryItems.length
            ? ""
            : '<p class="pm" style="color:var(--a)">There is no equipment in the inventory yet, so the tags stay empty. An administrator can add it under Inventory.</p>',
        () =>
          sets ||
          '<p class="em" style="text-align:left">Enter the number of setups to generate the list.</p>',
      ],
    );
  }
  function wInvPrev() {
    const it = wItemsOut(),
      S = wSetOut();
    let h = "";
    if (it.length)
      h += __tpl(
        "wInvPrev.2",
        `<h4 class="wz-tt2" style="margin-top:16px">Items at the site</h4><div class="tw"><table data-nodt style="width:100%"><thead><tr><th style="width:48px">#</th><th>Item</th><th style="width:120px">Quantity</th><th>Status</th><th>Note</th></tr></thead><tbody>{{s1: it.map(…)}}</tbody></table></div>`,
        [
          () =>
            it
              .map((x, i) =>
                __tpl(
                  "wInvPrev.1",
                  `<tr><td>{{s1: i + 1}}</td><td>{{s2: escapeHtml(x.cat)}}</td><td>{{s3: formatNumber(x.n)}}</td><td{{s4: ['Faulty', 'Damaged', 'Lost / sto…}}>{{s5: escapeHtml(x.st)}}</td><td>{{s6: escapeHtml(x.nt || '')}}</td></tr>`,
                  [
                    () => i + 1,
                    () => escapeHtml(x.cat),
                    () => formatNumber(x.n),
                    () =>
                      ["Faulty", "Damaged", "Lost / stolen"].includes(x.st)
                        ? ' style="color:var(--r);font-weight:600"'
                        : "",
                    () => escapeHtml(x.st),
                    () => escapeHtml(x.nt || ""),
                  ],
                ),
              )
              .join(""),
        ],
      );
    if (S.length)
      h += __tpl(
        "wInvPrev.5",
        `<h4 class="wz-tt2" style="margin-top:16px">Setups at the site · {{s1: S.length}}</h4><div class="tw"><table data-nodt><thead><tr><th>Setup</th><th>DCA / supervisor</th><th>Category</th><th>Description</th><th>Serial number</th><th>Asset tag</th><th>Company tag</th><th>Status</th><th>Note</th></tr></thead><tbody>{{s2: S.map(…)}}</tbody></table></div>`,
        [
          () => S.length,
          () =>
            S.map((x, i) =>
              x.devices.length
                ? x.devices
                    .map((d, k) =>
                      __tpl(
                        "wInvPrev.3",
                        `<tr><td>{{s1: k ? '' : i + 1}}</td><td>{{s2: k ? '' : escapeHtml(x.who)}}</td><td>{{s3: escapeHtml(d.cat || '—')}}</td><td>{{s4: escapeHtml(d.desc || '—')}}</td><td>{{s5: escapeHtml(d.sn || '—')}}</td><td>{{s6: escapeHtml(d.at || '—')}}</td><td>{{s7: escapeHtml(d.ct || '—')}}</td><td{{s8: ['Faulty', 'Damaged', 'Lost / sto…}}>{{s9: escapeHtml(d.st)}}</td><td>{{s10: escapeHtml(d.nt || '')}}</td></tr>`,
                        [
                          () => (k ? "" : i + 1),
                          () => (k ? "" : escapeHtml(x.who)),
                          () => escapeHtml(d.cat || "—"),
                          () => escapeHtml(d.desc || "—"),
                          () => escapeHtml(d.sn || "—"),
                          () => escapeHtml(d.at || "—"),
                          () => escapeHtml(d.ct || "—"),
                          () =>
                            ["Faulty", "Damaged", "Lost / stolen"].includes(d.st)
                              ? ' style="color:var(--r);font-weight:600"'
                              : "",
                          () => escapeHtml(d.st),
                          () => escapeHtml(d.nt || ""),
                        ],
                      ),
                    )
                    .join("")
                : __tpl(
                    "wInvPrev.4",
                    `<tr><td>{{s1: i + 1}}</td><td>{{s2: escapeHtml(x.who)}}</td><td colspan="7" style="color:var(--mu)">No device assigned</td></tr>`,
                    [() => i + 1, () => escapeHtml(x.who)],
                  ),
            ).join(""),
        ],
      );
    return h;
  }
  document.getElementById("abody").addEventListener("change", (e) => {
    const t = e.target,
      z = selectOne("#wz");
    if (!wizardState || !z || !z.contains(t) || wizardState.step != 3) return;
    if (t.id == "wsn") {
      collectWizardInputs();
      let n = Math.floor(+t.value);
      if (!(n >= 1)) n = 1;
      if (n > 200) n = 200;
      wizardState.setN = String(n);
      wSetResize(n);
      renderWizard();
    } else if (t.classList.contains("wi-p")) {
      collectWizardInputs();
      const r = t.closest(".wi-r"),
        i = [...z.querySelectorAll(".wi-r")].indexOf(r),
        x = wizardState.setups[i];
      if (x)
        x.devs = wDevs(x.who).map((d) => ({
          id: d.id,
          st: "Working",
          nt: "",
        }));
      renderWizard();
    }
  });
  document.getElementById("abody").addEventListener("click", (e) => {
    const z = selectOne("#wz");
    const t = e.target.closest && e.target.closest("#wsadd,.wsrm");
    if (!t || !wizardState || !z || !z.contains(t) || wizardState.step != 3) return;
    collectWizardInputs();
    if (t.id == "wsadd") {
      const n = Math.min(200, wizardState.setups.length + 1);
      wizardState.setN = String(n);
      wSetResize(n);
    } else {
      const i = [...z.querySelectorAll(".wi-r")].indexOf(t.closest(".wi-r"));
      if (i >= 0 && wizardState.setups.length > 1) {
        wizardState.setups.splice(i, 1);
        wizardState.setN = String(wizardState.setups.length);
      }
    }
    renderWizard();
  });
  /* ---------- report sections, print, PDF and Excel ---------- */
  function wRepSecs(o, N, sm, X) {
    X = X || {};
    const S = X.S || wSetOut(),
      IT = X.IT || wItemsOut(),
      rows = [];
    o.dcas.length;
    const grp =
      o.type == "single"
        ? o.dcas.map((d) => ({
            name: d.name,
            L: [
              {
                mda: X.mda || wizardState.mda,
                n: d.n,
              },
            ],
          }))
        : o.dcas
            .map((d) => ({
              name: d.name,
              L: o.alloc
                .filter((a) => a.dca == d.name)
                .map((a) => ({
                  mda: a.mda,
                  n: a.n != null ? a.n : a.ok + a.pend + a.fail,
                })),
            }))
            .filter((g) => g.L.length);
    grp.forEach((g) => g.L.forEach((l, k) => rows.push([k ? "" : g.name, l.mda, l.n])));
    rows.push(["TOTAL · " + o.dcas.length + " DCA" + (o.dcas.length == 1 ? "" : "s"), "", N]);
    const dev = [];
    S.forEach((x, i) => {
      if (x.devices.length)
        x.devices.forEach((d, k) =>
          dev.push([k ? "" : i + 1, k ? "" : x.who, d.cat, d.desc, d.sn, d.at, d.ct, d.st, d.nt]),
        );
      else dev.push([i + 1, x.who, "", "No device assigned", "", "", "", "", ""]);
    });
    return [
      {
        t: "Daily Registration Report",
        head: ["MDA", "Registrations", "Complete", "Pending", "Failed"],
        num: [1, 2, 3, 4],
        rows: o.mdas
          .map((m) => [m.mda, m.n, m.ok, m.pend, m.fail])
          .concat([["TOTAL", N, sm("ok"), sm("pend"), sm("fail")]]),
        tot: 1,
      },
      {
        t: "Daily Data Collection Agent (DCA) Supervision Report",
        head: ["DCA", "MDA of the FTEs", "Registered"],
        num: [2],
        rows,
        tot: 1,
      },
      {
        t: "Inventory report",
        head: ["#", "Item", "Quantity", "Status", "Note"],
        num: [2],
        rows: IT.map((x, i) => [i + 1, x.cat, x.n, x.st, x.nt]),
        empty: "No items were entered.",
      },
      {
        t: "Inventory detail — Setups at the site · " + S.length,
        head: [
          "Setup",
          "DCA / supervisor",
          "Category",
          "Description",
          "Serial number",
          "Asset tag",
          "Company tag",
          "Status",
          "Note",
        ],
        num: [],
        rows: dev,
        empty: "No setups.",
      },
    ];
  }
  function wRepTbl(x) {
    const bad = (v) => ["Faulty", "Damaged", "Lost / stolen"].includes(v);
    return x.rows.length
      ? __tpl(
          "wRepTbl.4",
          `<div class="tw"><table data-nodt style="width:100%"><thead><tr>{{s1: x.head.map(…)}}</tr></thead><tbody>{{s2: x.rows.map(…)}}</tbody></table></div>`,
          [
            () =>
              x.head
                .map((h, i) =>
                  __tpl(
                    "wRepTbl.1",
                    `<th{{s1: x.num.includes(i) ? ' class='n''…}}>{{s2: escapeHtml(h)}}</th>`,
                    [() => (x.num.includes(i) ? ' class="n"' : ""), () => escapeHtml(h)],
                  ),
                )
                .join(""),
            () =>
              x.rows
                .map((r, ri) =>
                  __tpl(
                    "wRepTbl.3",
                    `<tr{{s1: x.tot ri == x.rows.length - 1 ? '…}}>{{s2: r.map(…)}}</tr>`,
                    [
                      () => (x.tot && ri == x.rows.length - 1 ? ' class="dg"' : ""),
                      () =>
                        r
                          .map((v, i) =>
                            __tpl(
                              "wRepTbl.2",
                              `<td{{s1: x.num.includes(i) ? ' class='n''…}}{{s2: bad(v) ? ' style='color:var(--r);…}}>{{s3: x.num.includes(i) v !== '' !isNaN…}}</td>`,
                              [
                                () => (x.num.includes(i) ? ' class="n"' : ""),
                                () => (bad(v) ? ' style="color:var(--r);font-weight:600"' : ""),
                                () =>
                                  x.num.includes(i) && v !== "" && !isNaN(v)
                                    ? formatNumber(+v)
                                    : escapeHtml(v == null || v === "" ? "—" : v),
                              ],
                            ),
                          )
                          .join(""),
                    ],
                  ),
                )
                .join(""),
          ],
        )
      : __tpl(
          "wRepTbl.5",
          `<p class="em" style="text-align:left">{{s1: escapeHtml(x.empty || '')}}</p>`,
          [() => escapeHtml(x.empty || "")],
        );
  }
  function wRepHtml(o, N, sm) {
    return wRepSecs(o, N, sm)
      .map((x, i) =>
        __tpl(
          "wRepHtml.1",
          `<section class="rp-sec"><h4 class="wz-tt2" style="margin-top:{{s1: i ? 18 : 10}}px">{{s2: i + 1}} · {{s3: escapeHtml(x.t)}}</h4>{{s4: wRepTbl(x)}}</section>`,
          [() => (i ? 18 : 10), () => i + 1, () => escapeHtml(x.t), () => wRepTbl(x)],
        ),
      )
      .join("");
  }
  function wRepCtx() {
    const b = wBuild();
    if (b.err) {
      toast(b.err);
      return null;
    }
    const o = b.o,
      sm = (k) => o.mdas.reduce((a, m) => a + m[k], 0),
      N = sm("n"),
      st = findSite(wizardState.site) || {};
    return {
      o,
      N,
      sm,
      date: wizardState.date,
      note: wizardState.note,
      secs: wRepSecs(o, N, sm),
      meta: [
        ["Report type", o.type == "single" ? "Single site (one MDA)" : "Multi site (several MDAs)"],
        ["Registration date", wizardState.date],
        ["State · county", wizardState.st + " · " + wizardState.co],
        ["Registration site", st.name || ""],
        ["Registration site MDA", wizardState.reg || st.mda || st.name || ""],
        ["Supervisor", wizardState.sup || st.sup || ""],
      ],
    };
  }
  function wRepPrint(c0) {
    if (!c0) collectWizardInputs();
    const c = c0 || wRepCtx();
    if (!c) return;
    const css =
      "body{font:12px/1.4 Arial,Helvetica,sans-serif;color:#111;margin:18px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px;border-bottom:2px solid #444;padding-bottom:3px}.m{display:flex;flex-wrap:wrap;gap:4px 24px;margin:6px 0 4px}.m div{min-width:180px}.m small{display:block;color:#666;text-transform:uppercase;font-size:9px}table{width:100%;border-collapse:collapse;margin-top:4px}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eee;font-size:10px;text-transform:uppercase}td.n,th.n{text-align:right}tr.tot td{font-weight:700;background:#f3f3f3}section{page-break-inside:avoid}.f{margin-top:14px;color:#666;font-size:10px}@page{size:A4 landscape;margin:12mm}";
    const e = (v) =>
      String(v == null || v === "" ? "—" : v).replace(
        /[&<>"]/g,
        (m) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
          })[m],
      );
    const body =
      __tpl(
        "wRepPrint.2",
        `<h1>{{s1: c.dca ? 'DCA report' : c.inv ? 'I…}} — {{s2: e(c.date)}}</h1><div class="m">{{s3: c.meta.map(…)}}</div>`,
        [
          () => (c.dca ? "DCA report" : c.inv ? "Inventory report" : "Daily report"),
          () => e(c.date),
          () =>
            c.meta
              .map((m) =>
                __tpl("wRepPrint.1", `<div><small>{{s1: e(m[0])}}</small>{{s2: e(m[1])}}</div>`, [
                  () => e(m[0]),
                  () => e(m[1]),
                ]),
              )
              .join(""),
        ],
      ) +
      c.secs
        .map((x, i) =>
          __tpl(
            "wRepPrint.8",
            `<section><h2>{{s1: x.no || i + 1}} · {{s2: e(x.t)}}</h2>{{s3: x.rows.length ? …}}</section>`,
            [
              () => x.no || i + 1,
              () => e(x.t),
              () =>
                x.rows.length
                  ? __tpl(
                      "wRepPrint.6",
                      `<table><thead><tr>{{s1: x.head.map(…)}}</tr></thead><tbody>{{s2: x.rows.map(…)}}</tbody></table>`,
                      [
                        () =>
                          x.head
                            .map((h, k) =>
                              __tpl(
                                "wRepPrint.3",
                                `<th{{s1: x.num.includes(k) ? ' class='n''…}}>{{s2: e(h)}}</th>`,
                                [() => (x.num.includes(k) ? ' class="n"' : ""), () => e(h)],
                              ),
                            )
                            .join(""),
                        () =>
                          x.rows
                            .map((r, ri) =>
                              __tpl(
                                "wRepPrint.5",
                                `<tr{{s1: x.tot ri == x.rows.length - 1 ? '…}}>{{s2: r.map(…)}}</tr>`,
                                [
                                  () => (x.tot && ri == x.rows.length - 1 ? ' class="tot"' : ""),
                                  () =>
                                    r
                                      .map((v, k) =>
                                        __tpl(
                                          "wRepPrint.4",
                                          `<td{{s1: x.num.includes(k) ? ' class='n''…}}>{{s2: e(v)}}</td>`,
                                          [
                                            () => (x.num.includes(k) ? ' class="n"' : ""),
                                            () => e(v),
                                          ],
                                        ),
                                      )
                                      .join(""),
                                ],
                              ),
                            )
                            .join(""),
                      ],
                    )
                  : __tpl("wRepPrint.7", `<p>{{s1: e(x.empty)}}</p>`, [() => e(x.empty)]),
            ],
          ),
        )
        .join("") +
      (c.dca
        ? ""
        : __tpl(
            "wRepPrint.9",
            `<section><h2>Incident log</h2><p>{{s1: e(c.note || 'None recorded')}}</p></section>`,
            [() => e(c.note || "None recorded")],
          )) +
      __tpl("wRepPrint.10", `<div class="f">Printed {{s1: new Date().toLocaleString()}}</div>`, [
        () => new Date().toLocaleString(),
      ]);
    const f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.append(f);
    const d = f.contentWindow.document;
    d.open();
    d.write(
      "<!doctype html><html><head><meta charset=utf-8><title>" +
        (c.inv ? "Inventory report " : "Daily report ") +
        e(c.date) +
        "</title><style>" +
        css +
        "</style></head><body>" +
        body +
        "</body></html>",
    );
    d.close();
    setTimeout(() => {
      try {
        f.contentWindow.focus();
        f.contentWindow.print();
      } catch (x) {
        toast("Could not open the print dialog");
      }
      setTimeout(() => f.remove(), 60000);
    }, 300);
  }
  async function wRepXls(c0) {
    if (!c0) collectWizardInputs();
    const c = c0 || wRepCtx();
    if (!c) return;
    try {
      const used = new Set(),
        nm = c.names || ["Registration", "DCA supervision", "Inventory report", "Inventory detail"];
      const sheets = c.secs.map((x, i) => ({
        name: nm[i],
        head: x.head,
        cols: x.head.map((h, k) =>
          Math.max(
            12,
            Math.min(
              40,
              h.length + 6,
              ...x.rows.map((r) => String(r[k] == null ? "" : r[k]).length + 2),
            ),
          ),
        ),
        fmt: x.head.map((h, k) => (x.num.includes(k) ? 2 : 0)),
        rows: (x.rows.length ? x.rows : [[x.empty]]).map((r) =>
          r.map((v, k) => (x.num.includes(k) && v !== "" && !isNaN(v) ? +v : v == null ? "" : v)),
        ),
      }));
      const bytes = xlsxBytes(sheets),
        bl = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
        a = document.createElement("a");
      a.href = URL.createObjectURL(bl);
      a.download = "Daily-report-" + c.date + ".xlsx";
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      toast("Excel report downloaded");
    } catch (x) {
      console.error(x);
      toast("Could not create the Excel file");
    }
  }
  function wRepCtxR(r, inv) {
    const st = findSite(r.site) || {},
      ms = r.mdas || [],
      sm = (k) => ms.reduce((a, m) => a + (+m[k] || 0), 0),
      N = sm("n"),
      l = siteStateAndCounty(st) || ["", ""];
    const secs = wRepSecs(r, N, sm, {
      S: (r.setups || []).map((x) => ({
        who: x.who,
        devices: x.devices || (x.dev ? [x] : []),
      })),
      IT: r.items || [],
      mda: (ms[0] || {}).mda,
    });
    return {
      o: r,
      N,
      sm,
      date: r.date,
      note: r.note,
      secs:
        inv === "dca"
          ? [
              Object.assign({}, secs[1], {
                no: 2,
              }),
            ]
          : inv
            ? secs.slice(2)
            : secs,
      names:
        inv === "dca" ? ["DCA supervision"] : inv ? ["Inventory report", "Inventory detail"] : null,
      inv: !!inv && inv !== "dca",
      dca: inv === "dca",
      meta: [
        ["Report type", r.type == "multi" ? "Multi site (several MDAs)" : "Single site (one MDA)"],
        ["Registration date", r.date],
        ["State · county", (l[0] || "") + " · " + (l[1] || "")],
        ["Registration site", st.name || ""],
        ["Registration site MDA", r.regMda || st.mda || st.name || ""],
        ["Supervisor", r.sup || st.sup || ""],
        ["Entered by", r.by || ""],
      ],
    };
  }
  function showBootstrapModal(title, body, foot, size, onClick) {
    const el = document.createElement("div");
    el.className = "modal";
    el.tabIndex = -1;
    el.innerHTML = __tpl(
      "showBootstrapModal.1",
      `<div class="modal-dialog modal-dialog-centered modal-dialog-scrollable {{s1: size || ''}}"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">{{s2: title}}</h5><button type="button" class="btn-close" aria-label="Close" data-mc="x"></button></div><div class="modal-body"></div><div class="modal-footer">{{s3: foot}}</div></div></div>`,
      [() => size || "", () => title, () => foot],
    );
    el.querySelector(".modal-body").innerHTML = '<div class="fr">' + body + "</div>";
    document.body.append(el);
    const inst = bootstrap.Modal.getOrCreateInstance(el, {
      backdrop: "static",
      keyboard: true,
    });
    el.addEventListener("show.bs.modal", () => {
      const n = document.querySelectorAll(".modal.show").length;
      el.style.zIndex = 1055 + n * 20;
      requestAnimationFrame(() => {
        const b = [...document.querySelectorAll(".modal-backdrop")].pop();
        if (b) b.style.zIndex = 1050 + n * 20;
      });
    });
    el.addEventListener("hidden.bs.modal", () => {
      inst.dispose();
      el.remove();
    });
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mc]");
      if (!b) return;
      if (b.dataset.mc == "x") return inst.hide();
      onClick && onClick(b.dataset.mc, el, inst);
    });
    inst.show();
    return {
      el,
      inst,
      body: el.querySelector(".modal-body"),
    };
  }
  function mstOpen(k, g, d) {
    const L = wRepFind(k, g, d);
    if (!L.length) return toast("No report found for this row");
    const R = [];
    L.forEach((r) =>
      (r.mdas || []).forEach((x, ix) => {
        if (g == "site" || x.mda == k)
          R.push({
            r,
            x,
            ix,
            n: (+x.ok || 0) + (+x.pend || 0) + (+x.fail || 0),
            can: (isSubadminOrAdmin() || r.by == AUSER) && !isReviewLocked(r),
          });
      }),
    );
    if (!R.length) {
      toast("These reports have no MDA status to edit");
      return;
    }
    const inp = (c, v, dis) =>
      __tpl(
        "inp.1",
        `<input type="number" min="0" step="1" class="mst-i" style="margin:0;width:100%;text-align:right" data-c="{{s1: c}}" value="{{s2: v}}"{{s3: dis ? ' disabled' : ''}}>`,
        [() => c, () => v, () => (dis ? " disabled" : "")],
      );
    const body = __tpl(
      "mstOpen.3",
      `<p style="color:var(--mu);font-size:.85rem;margin:0 0 12px">Move registrations between <b style="color:#22a559">Completed</b>, <b style="color:#C5A059">Pending</b> and <b style="color:#e5484d">Failed</b>. The three numbers must add up to the number registered, which does not change here.</p>
<div class="tw"><table data-nodt><thead><tr><th>Registration site</th>{{s1: g == 'site' ? ' th FTE MDA /th '…}}<th class="n">Registered</th><th style="width:120px">Completed</th><th style="width:120px">Pending</th><th style="width:120px">Failed</th><th>Check</th></tr></thead><tbody>{{s2: R.map(…)}}</tbody></table></div><div class="pm" id="mst-e"></div>`,
      [
        () => (g == "site" ? "<th>FTE MDA</th>" : ""),
        () =>
          R.map((q, i) =>
            __tpl(
              "mstOpen.2",
              `<tr data-i="{{s1: i}}"><td>{{s2: escapeHtml((findSite(q.r.site) ||…}}<br><small style="color:var(--mu)">{{s3: escapeHtml(q.r.by || '')}}</small></td>{{s4: g == 'site' ? …}}<td class="n"><b>{{s5: formatNumber(q.n)}}</b></td><td>{{s6: inp('ok', +q.x.ok || 0, !q.can)}}</td><td>{{s7: inp('pend', +q.x.pend || 0, !q.ca…}}</td><td>{{s8: inp('fail', +q.x.fail || 0, !q.ca…}}</td><td class="mst-c small">{{s9: q.can ? '' : 'Not yours'}}</td></tr>`,
              [
                () => i,
                () => escapeHtml((findSite(q.r.site) || {}).name || "—"),
                () => escapeHtml(q.r.by || ""),
                () =>
                  g == "site"
                    ? __tpl("mstOpen.1", `<td>{{s1: escapeHtml(q.x.mda)}}</td>`, [
                        () => escapeHtml(q.x.mda),
                      ])
                    : "",
                () => formatNumber(q.n),
                () => inp("ok", +q.x.ok || 0, !q.can),
                () => inp("pend", +q.x.pend || 0, !q.can),
                () => inp("fail", +q.x.fail || 0, !q.can),
                () => (q.can ? "" : "Not yours"),
              ],
            ),
          ).join(""),
      ],
    );
    const M = showBootstrapModal(
      "Edit status · " + escapeHtml(k) + " · " + escapeHtml(d),
      body,
      '<button type="button" class="btn" data-mc="x">Cancel</button><button type="button" class="btn btn-sm btn-primary" data-mc="save"><i class="bx bx-save"></i> Save status</button>',
      "modal-xl",
      (a, el, inst) => {
        if (a != "save") return;
        if (!chk()) {
          el.querySelector("#mst-e").textContent =
            "Fix the rows marked in red: each row must add up to the number registered.";
          return;
        }
        el.querySelectorAll("tbody tr").forEach((tr) => {
          const q = R[+tr.dataset.i];
          if (!q.can) return;
          const v = (c) =>
            Math.max(0, Math.floor(+tr.querySelector('[data-c="' + c + '"]').value || 0));
          q.x.ok = v("ok");
          q.x.pend = v("pend");
          q.x.fail = v("fail");
          q.r.upd = new Date().toISOString();
        });
        saveToStorage(REPORTS_KEY, REPORTS);
        inst.hide();
        toast("Status updated");
        go();
      },
    );
    const chk = () => {
      let ok = true;
      M.el.querySelectorAll("tbody tr").forEach((tr) => {
        const q = R[+tr.dataset.i];
        if (!q.can) return;
        const v = (c) =>
            Math.max(0, Math.floor(+tr.querySelector('[data-c="' + c + '"]').value || 0)),
          t = v("ok") + v("pend") + v("fail"),
          cell = tr.querySelector(".mst-c");
        if (t == q.n)
          cell.innerHTML =
            '<span style="color:var(--g)"><i class="bx bx-check"></i> matches</span>';
        else {
          ok = false;
          cell.innerHTML =
            '<span style="color:var(--r)">' +
            (t > q.n ? "over by " : "short by ") +
            Math.abs(t - q.n) +
            "</span>";
        }
      });
      return ok;
    };
    M.el.addEventListener("input", (e) => {
      if (e.target.classList.contains("mst-i")) chk();
    });
    chk();
  }
  const wRepFind = (k, g, d) =>
    REPORTS.filter(
      (r) =>
        r.date == d &&
        (g == "site"
          ? (r.regMda ||
              (findSite(r.site) || {}).mda ||
              (findSite(r.site) || {}).name ||
              "deleted site") == k
          : r.mdas && r.mdas.length
            ? r.mdas.some((m) => m.mda == k)
            : k == "Not specified (older reports)"),
    );
  function wRepView(ids, pr, inv) {
    ids = [].concat(ids).filter((x) => REPORTS.some((r) => r.id == x));
    if (!ids.length) return toast("No report found for this row");
    let ix = 0;
    const one = () => REPORTS.find((x) => x.id == ids[ix]);
    if (pr && ids.length == 1) return wRepPrint(wRepCtxR(one(), inv));
    const inner = () => {
      const r = one(),
        c = wRepCtxR(r, inv);
      return (
        (ids.length > 1
          ? __tpl(
              "inner.2",
              `<label style="margin-bottom:12px">Report<select id="rpv-s">{{s1: ids .map(…)}}</select></label>`,
              [
                () =>
                  ids
                    .map((x, i) => {
                      const q = REPORTS.find((y) => y.id == x),
                        st = findSite(q.site) || {};
                      return __tpl(
                        "inner.1",
                        `<option value="{{s1: i}}"{{s2: i == ix ? ' selected' : ''}}>{{s3: i + 1}}. {{s4: escapeHtml(st.name || 'Site')}} · {{s5: escapeHtml(q.by || '')}}</option>`,
                        [
                          () => i,
                          () => (i == ix ? " selected" : ""),
                          () => i + 1,
                          () => escapeHtml(st.name || "Site"),
                          () => escapeHtml(q.by || ""),
                        ],
                      );
                    })
                    .join(""),
              ],
            )
          : "") +
        __tpl(
          "inner.6",
          `<div class="wz-info">{{s1: c.meta.map(…)}}</div>{{s2: c.secs.map(…)}}{{s3: inv === 'dca' ? '' : …}}`,
          [
            () =>
              c.meta
                .map((x) =>
                  __tpl(
                    "inner.3",
                    `<div><small>{{s1: escapeHtml(x[0])}}</small>{{s2: escapeHtml(x[1] || '—')}}</div>`,
                    [() => escapeHtml(x[0]), () => escapeHtml(x[1] || "—")],
                  ),
                )
                .join(""),
            () =>
              c.secs
                .map((x, i) =>
                  __tpl(
                    "inner.4",
                    `<section class="rp-sec"><h4 class="wz-tt2" style="margin-top:{{s1: i ? 18 : 10}}px">{{s2: x.no || i + 1}} · {{s3: escapeHtml(x.t)}}</h4>{{s4: wRepTbl(x)}}</section>`,
                    [
                      () => (i ? 18 : 10),
                      () => x.no || i + 1,
                      () => escapeHtml(x.t),
                      () => wRepTbl(x),
                    ],
                  ),
                )
                .join(""),
            () =>
              inv === "dca"
                ? ""
                : __tpl(
                    "inner.5",
                    `<section class="rp-sec"><h4 class="wz-tt2">Incident log</h4><p style="white-space:pre-wrap;margin:6px 0">{{s1: escapeHtml(r.note || 'None record…}}</p></section>`,
                    [() => escapeHtml(r.note || "None recorded")],
                  ),
          ],
        )
      );
    };
    const M = showBootstrapModal(
      (inv === "dca" ? "DCA report" : inv ? "Inventory report" : "Daily report") +
        " · " +
        escapeHtml(one().date),
      inner(),
      '<button type="button" class="btn btn-sm btn-outline-secondary" data-mc="print"><i class="bx bx-printer"></i> Print report</button><button type="button" class="btn btn-sm btn-outline-secondary" data-mc="pdf"><i class="bx bxs-file-pdf"></i> Export PDF</button><button type="button" class="btn btn-sm btn-outline-success" data-mc="xls"><i class="bx bx-spreadsheet"></i> Export Excel</button><button type="button" class="btn" data-mc="x">Close</button>',
      "modal-xl",
      (a) => {
        const c = wRepCtxR(one(), inv);
        if (a == "xls") wRepXls(c);
        else {
          if (a == "pdf") toast("In the print window choose “Save as PDF” as the destination");
          wRepPrint(c);
        }
      },
    );
    M.el.addEventListener("change", (e) => {
      if (e.target.id == "rpv-s") {
        ix = +e.target.value;
        M.body.innerHTML = '<div class="fr">' + inner() + "</div>";
        M.el.querySelector(".modal-title").textContent =
          (inv === "dca" ? "DCA report" : inv ? "Inventory report" : "Daily report") +
          " · " +
          one().date;
      }
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key == "Escape") {
      const m = document.getElementById("rpv");
      if (m) m.remove();
    }
  });
  window.__rp = {
    print: wRepPrint,
    xls: wRepXls,
    view: wRepView,
    ctxR: wRepCtxR,
  };
  function wS3() {
    const b = wBuild();
    if (b.err)
      return __tpl("wS3.1", `<p class="pm">{{s1: escapeHtml(b.err)}}</p>`, [
        () => escapeHtml(b.err),
      ]);
    const o = b.o,
      s = findSite(wizardState.site) || {},
      sm = (k) => o.mdas.reduce((a, m) => a + m[k], 0),
      N = sm("n"),
      kp = (l, v) =>
        __tpl("kp.5", `<div><small>{{s1: l}}</small><b>{{s2: v}}</b></div>`, [() => l, () => v]),
      iv = (l, v) =>
        __tpl("iv.1", `<div><small>{{s1: l}}</small>{{s2: escapeHtml(v || '—')}}</div>`, [
          () => l,
          () => escapeHtml(v || "—"),
        ]);
    const grp =
        o.type == "single"
          ? o.dcas.map((d) => ({
              name: d.name,
              L: [
                {
                  mda: wizardState.mda,
                  n: d.n,
                },
              ],
            }))
          : o.dcas
              .map((d) => ({
                name: d.name,
                L: o.alloc
                  .filter((a) => a.dca == d.name)
                  .map((a) => ({
                    mda: a.mda,
                    n: a.n != null ? a.n : a.ok + a.pend + a.fail,
                  })),
              }))
              .filter((g) => g.L.length),
      dr = grp
        .map((g) =>
          g.L.map((l, k) =>
            __tpl(
              "wS3.3",
              `<tr>{{s1: k == 0 ? …}}<td>{{s2: escapeHtml(l.mda)}}</td><td class="n"><b>{{s3: formatNumber(l.n)}}</b></td></tr>`,
              [
                () =>
                  k == 0
                    ? __tpl(
                        "wS3.2",
                        `<td rowspan="{{s1: g.L.length}}" style="vertical-align:top"><b>{{s2: escapeHtml(g.name)}}</b></td>`,
                        [() => g.L.length, () => escapeHtml(g.name)],
                      )
                    : "",
                () => escapeHtml(l.mda),
                () => formatNumber(l.n),
              ],
            ),
          ).join(""),
        )
        .join("");
    return __tpl(
      "wS3.4",
      `<div class="rp-bar"><h3 style="margin:2px 0 8px;flex:1">4 · Preview — check everything, then submit</h3><button type="button" class="btn" data-w="rprint"><span class="bx bx-printer"></span> Print report</button><button type="button" class="btn" data-w="rpdf"><span class="bx bxs-file-pdf"></span> Export PDF</button><button type="button" class="btn" data-w="rxls"><span class="bx bx-spreadsheet"></span> Export Excel</button></div><div class="wz-info">{{s1: iv('Report type', o.type == 'sing…}}{{s2: iv('Registration date', wizardSta…}}{{s3: iv('State · county', wizardState.…}}{{s4: iv('Registration site', s.name)}}{{s5: iv('Registration site MDA', wizar…}}</div>
<div class="kp">{{s6: kp('Registrations', formatNumber(…}}{{s7: kp('Complete', formatNumber(sm('o…}}{{s8: kp('Pending', formatNumber(sm('pe…}}{{s9: kp('Failed', formatNumber(sm('fai…}}{{s10: kp('DCAs', o.dcas.length)}}</div>
{{s11: wRepHtml(o, N, sm)}}
<label class="rp-note">Incident log (optional)<textarea id="wn" rows="3" placeholder="Describe any incident at the site today (e.g. power cut, equipment fault, security, delays)">{{s12: escapeHtml(wizardState.note)}}</textarea></label>`,
      [
        () =>
          iv(
            "Report type",
            o.type == "single" ? "Single site (one MDA)" : "Multi site (several MDAs)",
          ),
        () => iv("Registration date", wizardState.date),
        () => iv("State · county", wizardState.st + " · " + wizardState.co),
        () => iv("Registration site", s.name),
        () => iv("Registration site MDA", wizardState.reg || s.mda || s.name),
        () => kp("Registrations", formatNumber(N)),
        () => kp("Complete", formatNumber(sm("ok"))),
        () => kp("Pending", formatNumber(sm("pend"))),
        () => kp("Failed", formatNumber(sm("fail"))),
        () => kp("DCAs", o.dcas.length),
        () => wRepHtml(o, N, sm),
        () => escapeHtml(wizardState.note),
      ],
    );
  }
  function collectWizardInputs() {
    if (!wizardState) return;
    const v = (s) => {
        const e = selectOne(s);
        return e ? e.value : null;
      },
      all = (s) => [...document.querySelectorAll("#wz " + s)];
    if (wizardState.step == 1) {
      const sp = v("#wsp");
      if (sp != null) wizardState.sup = sp;
      const d = v("#wd");
      if (d != null) wizardState.date = d;
      const lt = v("#wl");
      if (lt != null) wizardState.late = lt;
      const r = v("#wr");
      if (r != null) wizardState.reg = r;
    } else if (wizardState.step == 2) {
      if (wizardState.type == "single") {
        const m = v("#wm");
        if (m != null) wizardState.mda = m;
        wizardState.ok = v("#wo");
        wizardState.pend = v("#wp");
        wizardState.fail = v("#wf");
        wizardState.rows = all(".wz-dr").map((r) => ({
          name: r.querySelector(".wz-dn").value,
          n: r.querySelector(".wz-dv").value,
        }));
      } else {
        wizardState.mrows = all(".wz-mc").map((c) => ({
          name: c.querySelector(".wz-dn").value,
          items: [...c.querySelectorAll(".wz-it")].map((i) => ({
            mda: i.querySelector(".wz-im").value,
            n: i.querySelector(".wz-in").value,
          })),
        }));
        all(".wz-ms").forEach((c) => {
          wizardState.mst[c.dataset.m] = {
            ok: c.querySelector(".wz-so").value,
            pend: c.querySelector(".wz-sp2").value,
            fail: c.querySelector(".wz-sf").value,
          };
        });
      }
    } else if (wizardState.step == 3) {
      wInvCollect();
    } else if (wizardState.step == 4) {
      const n = v("#wn");
      if (n != null) wizardState.note = n;
    }
  }
  function wLive() {
    const e = selectOne("#wsum");
    if (!e || !wizardState || wizardState.step != 2) return;
    if (wizardState.type == "single") {
      const dv = wizardState.rows.reduce((a, x) => a + toWholeNumber(x.n), 0),
        ms =
          toWholeNumber(wizardState.ok) +
          toWholeNumber(wizardState.pend) +
          toWholeNumber(wizardState.fail);
      e.className =
        "wz-sum alert " + (dv == ms ? (dv ? "alert-success" : "alert-secondary") : "alert-danger");
      const q1 = document.getElementById("wz-dt"),
        q2 = document.getElementById("wz-st");
      if (q1) q1.textContent = formatNumber(dv);
      if (q2) q2.textContent = formatNumber(ms);
      e.innerHTML = __tpl(
        "wLive.1",
        `Registered by DCAs: <b>{{s1: formatNumber(dv)}}</b> · Complete + Pending + Failed: <b>{{s2: formatNumber(ms)}}</b>{{s3: dv == ms ? ' span style='color:va…}}`,
        [
          () => formatNumber(dv),
          () => formatNumber(ms),
          () =>
            dv == ms
              ? ' <span style="color:var(--g)"><i class="bx bx-check"></i> totals match</span>'
              : ' <span style="color:var(--r)">— the two totals must be equal</span>',
        ],
      );
    } else {
      const T = {};
      let t = 0;
      wizardState.mrows.forEach((d) =>
        d.items.forEach((i) => {
          const c = toWholeNumber(i.n);
          t += c;
          if (i.mda) T[i.mda] = (T[i.mda] || 0) + c;
        }),
      );
      const bad = [];
      document.querySelectorAll("#wz .wz-ms").forEach((c) => {
        const m = c.dataset.m,
          dv = T[m] || 0,
          sg =
            toWholeNumber(c.querySelector(".wz-so").value) +
            toWholeNumber(c.querySelector(".wz-sp2").value) +
            toWholeNumber(c.querySelector(".wz-sf").value);
        c.querySelector(".wz-rg").textContent = formatNumber(dv);
        c.querySelector(".wz-sg").textContent = formatNumber(sg);
        const okk = dv == sg;
        c.classList.toggle("okk", okk && dv > 0);
        c.classList.toggle("bad", !okk);
        if (!okk) bad.push(m);
      });
      const q = document.getElementById("wz-dt");
      if (q) q.textContent = formatNumber(t);
      e.className =
        "wz-sum alert " + (bad.length ? "alert-danger" : t ? "alert-success" : "alert-secondary");
      e.innerHTML =
        __tpl("wLive.2", `Total registered by DCAs: <b>{{s1: formatNumber(t)}}</b>`, [
          () => formatNumber(t),
        ]) +
        (bad.length
          ? __tpl(
              "wLive.3",
              ` — status does not match the DCA total for: <b>{{s1: bad.map(…)}}</b>`,
              [() => bad.map(escapeHtml).join(", ")],
            )
          : t
            ? ' <span style="color:var(--g)"><i class="bx bx-check"></i> all MDA totals match</span>'
            : "");
    }
  }
  function renderWizard() {
    const el = selectOne("#wz");
    if (!el) return go();
    const sc = selectOne("#abody").scrollTop;
    el.innerHTML = wBody();
    wLive();
    selectOne("#abody").scrollTop = sc;
  }
  function wizardGoToStep(n) {
    collectWizardInputs();
    wizardState.err = "";
    n = Math.max(1, Math.min(4, n));
    if (n > wizardState.step) {
      for (let k = wizardState.step; k < n; k++) {
        const e = k == 1 ? wV1() : k == 2 ? wBuild().err || "" : wInvErr();
        if (e) {
          wizardState.step = k;
          wizardState.err = e;
          renderWizard();
          return;
        }
      }
    }
    wizardState.step = n;
    renderWizard();
    selectOne("#abody").scrollTop = 0;
  }
  function submitWizardReport() {
    if (!canEnter() || !canDoAction("new", "e")) {
      toast("You do not have permission to submit reports");
      return;
    }
    collectWizardInputs();
    const e1 = wV1();
    if (e1) {
      wizardState.step = 1;
      wizardState.err = e1;
      return renderWizard();
    }
    const b = wBuild();
    if (b.err) {
      wizardState.step = 2;
      wizardState.err = b.err;
      return renderWizard();
    }
    const ei = wInvErr();
    if (ei) {
      wizardState.step = 3;
      wizardState.err = ei;
      return renderWizard();
    }
    const s = findSite(wizardState.site) || {},
      o = Object.assign(
        {
          site: wizardState.site,
          date: wizardState.date,
          regMda: wizardState.reg || s.mda || s.name || "",
          note: String(wizardState.note || "").trim(),
          setups: wSetOut(),
          items: wItemsOut(),
          sup:
            supervisorNameFor() ||
            (wizardState.sup && wizardState.sup !== (s.sup || "") ? wizardState.sup : ""),
          late: bdLateText(),
        },
        b.o,
      ),
      r = wizardState.edr ? REPORTS.find((x) => x.id == wizardState.edr) : null;
    if (r) {
      if (!isSubadminOrAdmin() && r.by != AUSER) {
        wizardState.err = "You can only update your own reports.";
        return renderWizard();
      }
      if (isReviewLocked(r)) {
        wizardState.err = "This report was accepted by the admin and can no longer be edited.";
        return renderWizard();
      }
      const was = reviewStatus(r);
      Object.assign(r, o, {
        upd: new Date().toISOString(),
      });
      reviewLog(
        r,
        was == "Rejected"
          ? "Resubmitted after rejection"
          : was == "Accepted"
            ? "Edited after acceptance, back to Pending"
            : "Edited",
        o.late && wizardState.date !== wizardState.od ? "Late entry: " + o.late : "",
      );
      if (!isSubadminOrAdmin() || was == "Rejected" || was == "Accepted") {
        r.rs = "Pending";
        r.rvBy = "";
        r.rvAt = "";
        r.rvWhy = "";
      }
    } else {
      const nr = Object.assign(
        {
          id: newId(),
          by: AUSER,
          at: new Date().toISOString(),
          rs: "Pending",
        },
        o,
      );
      reviewLog(nr, "Submitted", o.late ? "Late entry: " + o.late : "");
      REPORTS.push(nr);
    }
    let ch = 0;
    o.dcas.forEach((x) => {
      if (!dataCollectors.some((y) => y.name.toLowerCase() == x.name.toLowerCase())) {
        dataCollectors.push({
          id: newId(),
          name: x.name,
          phone: "",
          photo: "",
          status: "Active",
        });
        ch = 1;
      }
    });
    if (ch) saveToStorage(DCA_LIST_KEY, dataCollectors);
    saveToStorage(REPORTS_KEY, REPORTS);
    if (!wizardState.edr) clearWizardDraft();
    try {
      notifyReportSubmitted(r || REPORTS[REPORTS.length - 1], !!r);
    } catch (x) {}
    const d = o.date;
    wizardState = null;
    editingReportId = null;
    if (pageFilters.from > d) pageFilters.from = d;
    ADM.tab = "rep";
    toast(
      reviewStatus(r || REPORTS[REPORTS.length - 1]) == "Pending"
        ? "Daily report saved. It is waiting for the admin to accept it"
        : "Daily report saved",
    );
    go();
  }
  /* ---------- Enter daily report: date rule (how far back) and drafts ---------- */
  const BACKDATE_RULE_KEY = "bioreg.bdrule",
    draftStorageKey = () => "bioreg.draft|" + String(AUSER).toLowerCase();
  const backdateRule = () =>
    Object.assign(
      {
        days: 3,
        mode: "reason",
      },
      loadFromStorage(BACKDATE_RULE_KEY, {}),
    );
  const bdExempt = () => currentRole() == "admin";
  const bdOwn = () => !!(wizardState && wizardState.edr && wizardState.date === wizardState.od);
  function bdOld(d) {
    const r = backdateRule();
    if (r.mode == "off" || bdExempt() || !d || bdOwn()) return 0;
    const n = Math.round((new Date(today()) - new Date(d)) / 864e5);
    return n > r.days ? n : 0;
  }
  function bdLate() {
    const n = bdOld(wizardState.date),
      r = backdateRule();
    if (!n) return "";
    if (r.mode == "block")
      return `Reports can only be entered for the last ${r.days} day${r.days == 1 ? "" : "s"}. This date is ${n} days ago, ask an administrator to enter it.`;
    if (String(wizardState.late || "").trim().length < 5)
      return `This date is ${n} days ago (more than ${r.days}). Write the reason for the late entry.`;
    return "";
  }
  function bdLateText() {
    if (bdOwn()) {
      const r = REPORTS.find((x) => x.id == wizardState.edr);
      return (r && r.late) || "";
    }
    return bdOld(wizardState.date) && backdateRule().mode == "reason"
      ? String(wizardState.late || "").trim()
      : "";
  }
  function bdMin() {
    const r = backdateRule();
    if (r.mode != "block" || bdExempt() || wizardState.edr) return "";
    const d = new Date(today());
    d.setDate(d.getDate() - r.days);
    return ` min="${toIsoDate(d)}"`;
  }
  function bdHint() {
    const r = backdateRule();
    if (r.mode == "off" || bdExempt() || wizardState.edr) return "";
    return __tpl(
      "bdHint.1",
      `<small style="color:var(--mu);font-weight:400">{{s1: r.mode == 'block' ? 'Only the las…}}</small>`,
      [
        () =>
          r.mode == "block"
            ? "Only the last " + r.days + " day" + (r.days == 1 ? "" : "s") + " can be entered."
            : "Dates older than " + r.days + " day" + (r.days == 1 ? "" : "s") + " need a reason.",
      ],
    );
  }
  function bdReason() {
    const n = bdOld(wizardState.date);
    if (!n || backdateRule().mode != "reason") return "";
    return __tpl(
      "bdReason.1",
      `<label style="grid-column:1/-1">Reason for late entry (this date is {{s1: n}} days ago)<textarea id="wl" rows="2" maxlength="300" placeholder="Why is this report being entered late?">{{s2: escapeHtml(wizardState.late || '')}}</textarea></label>`,
      [() => n, () => escapeHtml(wizardState.late || "")],
    );
  }
  document.addEventListener("change", (e) => {
    if (
      e.target.id == "wd" &&
      wizardState &&
      wizardState.step == 1 &&
      document.getElementById("wz")
    ) {
      collectWizardInputs();
      renderWizard();
    }
  });
  const wTouched = () =>
    !!(
      wizardState &&
      !wizardState.edr &&
      (wizardState.type ||
        wizardState.site ||
        wizardState.rows.some((r) => r.name || r.n) ||
        wizardState.ok !== "" ||
        wizardState.pend !== "" ||
        wizardState.fail !== "" ||
        wizardState.msel.length ||
        wizardState.mrows.some((m) => m.name || m.items.some((i) => i.mda || i.n)) ||
        wizardState.note ||
        wizardState.setups.length ||
        Object.keys(wizardState.items).length)
    );
  function loadWizardDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(draftStorageKey()) || "null");
      if (d && d.w) return d;
    } catch (e) {}
    return null;
  }
  function clearWizardDraft() {
    try {
      localStorage.removeItem(draftStorageKey());
    } catch (e) {}
  }
  function wDraftTxt() {
    const d = loadWizardDraft();
    return d
      ? "Draft saved " +
          new Date(d.at).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          })
      : "";
  }
  function saveWizardDraft(manual) {
    if (!wizardState || wizardState.edr || !document.getElementById("wz")) return;
    collectWizardInputs();
    if (!wTouched()) {
      if (manual) toast("Nothing to save yet");
      return;
    }
    try {
      localStorage.setItem(
        draftStorageKey(),
        JSON.stringify({
          at: new Date().toISOString(),
          w: Object.assign({}, wizardState, {
            err: "",
            _restored: undefined,
          }),
        }),
      );
      const t = document.getElementById("wdt");
      if (t) t.textContent = wDraftTxt();
      if (manual) toast("Draft saved on this computer. You can close the page and continue later");
    } catch (e) {
      if (manual) toast("Could not save the draft in this browser");
    }
  }
  function wHead() {
    const b =
      wizardState._restored && !wizardState.edr
        ? __tpl(
            "wHead.1",
            `<div class="alert alert-info" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 10px"><span><i class="bx bx-save"></i> Draft restored (saved {{s1: escapeHtml( new Date(wizardState.…}}). Continue where you stopped.</span><button type="button" class="btn btn-sm" data-w="ddisc">Discard draft</button></div>`,
            [
              () =>
                escapeHtml(
                  new Date(wizardState._restored).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                ),
            ],
          )
        : "";
    return wHead0() + b;
  }
  let draftSaveTimer = 0;
  ["input", "change", "click"].forEach((t) =>
    document.addEventListener(t, (e) => {
      if (!wizardState || wizardState.edr || !e.target.closest || !e.target.closest("#wz")) return;
      clearTimeout(draftSaveTimer);
      draftSaveTimer = setTimeout(() => saveWizardDraft(false), 700);
    }),
  );
  window.addEventListener("pagehide", () => saveWizardDraft(false));
  selectOne("#abody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-w=dsave],[data-w=ddisc]");
    if (!b || !wizardState) return;
    if (b.dataset.w == "dsave") return saveWizardDraft(true);
    askConfirm("Discard the saved draft and start a new, empty report?", "Discard").then((ok) => {
      if (!ok) return;
      clearTimeout(draftSaveTimer);
      clearWizardDraft();
      wizardState = blankWizardState();
      renderWizard();
    });
  });
  selectOne("#abody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-w]"),
      z = selectOne("#wz");
    if (!b || !wizardState || !z || !z.contains(b) || b.disabled) return;
    const a = b.dataset.w;
    if (a == "rprint") return wRepPrint();
    if (a == "rpdf") {
      toast("In the print window choose “Save as PDF” as the destination");
      return wRepPrint();
    }
    if (a == "rxls") return wRepXls();
    if (a != "go" && a != "next" && a != "prev" && a != "submit") wizardState.err = "";
    if (a == "go") wizardGoToStep(+b.dataset.i);
    else if (a == "next") wizardGoToStep(wizardState.step + 1);
    else if (a == "prev") wizardGoToStep(wizardState.step - 1);
    else if (a == "dadd") {
      collectWizardInputs();
      const A = wizardState.type == "single" ? wizardState.rows : wizardState.mrows;
      if (A.length >= 60) return toast("Maximum 60 DCAs");
      A.push(
        wizardState.type == "single"
          ? {
              name: "",
              n: "",
            }
          : newWizardMda(),
      );
      wizardState.n = A.length;
      renderWizard();
    } else if (a == "drm") {
      collectWizardInputs();
      const A = wizardState.type == "single" ? wizardState.rows : wizardState.mrows;
      if (A.length <= 1) return toast("At least one DCA is required");
      A.splice(+b.dataset.i, 1);
      wizardState.n = A.length;
      renderWizard();
    } else if (a == "msopen") openMdaPickerPanel(b);
    else if (a == "msdel") {
      collectWizardInputs();
      const m = b.dataset.m;
      wizardState.msel = wizardState.msel.filter((x) => x != m);
      wizardState.mrows.forEach((d) =>
        d.items.forEach((x) => {
          if (x.mda == m) x.mda = "";
        }),
      );
      renderWizard();
    } else if (a == "type") {
      collectWizardInputs();
      wizardState.type = b.dataset.v;
      wizardState.err = "";
      renderWizard();
    } else if (a == "madd") {
      const v = selectOne("#wmn").value.trim();
      if (!v) return toast("Type the MDA name");
      collectWizardInputs();
      if (!mdaList().some((x) => x.toLowerCase() == v.toLowerCase())) {
        mdaRecords.push(v);
        saveToStorage(MDAS_KEY, mdaRecords);
      }
      const c = mdaList().find((x) => x.toLowerCase() == v.toLowerCase()) || v;
      if (wizardState.type == "single") wizardState.mda = c;
      else if (!wizardState.msel.includes(c)) wizardState.msel.push(c);
      toast("MDA added to the list");
      renderWizard();
    } else if (a == "dnew") {
      const nm = selectOne("#wdn").value.trim(),
        ph = selectOne("#wdp").value.trim();
      if (!nm) return toast("Type the data collector's name");
      if (ph && !isValidPhone(ph)) return toast("Enter a valid phone number or leave it empty");
      if (dataCollectors.some((x) => x.name.toLowerCase() == nm.toLowerCase()))
        return toast("This DCA already exists");
      collectWizardInputs();
      dataCollectors.push({
        id: newId(),
        name: nm,
        phone: ph,
        photo: "",
        status: "Active",
      });
      saveToStorage(DCA_LIST_KEY, dataCollectors);
      const e = (wizardState.type == "single" ? wizardState.rows : wizardState.mrows).find(
        (x) => !x.name,
      );
      if (e) e.name = nm;
      toast("DCA added");
      renderWizard();
    } else if (a == "iadd") {
      collectWizardInputs();
      wizardState.mrows[+b.dataset.i].items.push(newWizardItem());
      renderWizard();
    } else if (a == "irm") {
      collectWizardInputs();
      wizardState.mrows[+b.dataset.i].items.splice(+b.dataset.j, 1);
      renderWizard();
    } else if (a == "submit") submitWizardReport();
    else if (a == "reset") {
      const ed = wizardState.edr;
      askConfirm(
        ed
          ? "Undo all changes and restore this report as it was saved?"
          : "Clear everything you entered and start this report again?",
        "Reset",
      ).then((ok) => {
        if (!ok) return;
        clearTimeout(draftSaveTimer);
        if (ed) {
          const r = REPORTS.find((x) => x.id == ed);
          wizardState = r ? wFrom(r) : blankWizardState();
          wizardState.edr = r ? r.id : null;
        } else {
          clearWizardDraft();
          wizardState = blankWizardState();
        }
        renderWizard();
        toast("Form reset");
      });
    } else if (a == "cancel") {
      const leave = () => {
        clearTimeout(draftSaveTimer);
        wizardState = null;
        editingReportId = null;
        ADM.tab = "rep";
        go();
      };
      if (!wizardState.edr && wTouched()) {
        collectWizardInputs();
        askConfirm(
          "Leave without submitting? What you entered stays saved as a draft on this computer.",
          "Leave",
        ).then((ok) => {
          if (ok) {
            saveWizardDraft(false);
            leave();
          }
        });
      } else leave();
    }
  });
  selectOne("#abody").addEventListener("change", (e) => {
    const t = e.target,
      z = selectOne("#wz");
    if (!wizardState || !z || !z.contains(t)) return;
    const i = t.id;
    wizardState.err = "";
    if (i == "ws") {
      collectWizardInputs();
      wizardState.st = t.value;
      wizardState.co = "";
      wizardState.site = "";
      wizardState.reg = "";
      wizardState.rmd = "";
      renderWizard();
    } else if (i == "wmd") {
      collectWizardInputs();
      wizardState.rmd = t.value;
      wizardState.site = "";
      wizardState.reg = "";
      const L = wizardSites();
      if (L.length == 1) {
        wizardState.site = L[0].id;
        wizardState.reg = L[0].mda || "";
      }
      renderWizard();
    } else if (i == "wc") {
      collectWizardInputs();
      wizardState.co = t.value;
      wizardState.site = "";
      wizardState.reg = "";
      wizardState.rmd = "";
      renderWizard();
    } else if (i == "wi") {
      collectWizardInputs();
      wizardState.site = t.value;
      const s = findSite(t.value);
      wizardState.reg = (s && s.mda) || "";
      if (s) wizardState.rmd = mdaNameOf(s);
      renderWizard();
    } else if (i == "wnn") {
      collectWizardInputs();
      const n = Math.max(1, Math.min(60, Math.floor(+t.value || 1)));
      wizardState.n = n;
      if (wizardState.type == "single") {
        while (wizardState.rows.length < n)
          wizardState.rows.push({
            name: "",
            n: "",
          });
        wizardState.rows.length = n;
      } else {
        while (wizardState.mrows.length < n) wizardState.mrows.push(newWizardMda());
        wizardState.mrows.length = n;
      }
      renderWizard();
    } else if (t.classList.contains("wz-ck")) {
      collectWizardInputs();
      const m = t.dataset.m;
      if (t.checked) {
        if (!wizardState.msel.includes(m)) wizardState.msel.push(m);
      } else {
        wizardState.msel = wizardState.msel.filter((x) => x != m);
        wizardState.mrows.forEach((d) =>
          d.items.forEach((x) => {
            if (x.mda == m) x.mda = "";
          }),
        );
      }
      renderWizard();
    }
  });
  selectOne("#abody").addEventListener("input", (e) => {
    const t = e.target,
      z = selectOne("#wz");
    if (!wizardState || !z || !z.contains(t)) return;
    if (t.id == "wq") {
      wizardState.q = t.value;
      const q = t.value.toLowerCase();
      document.querySelectorAll("#wz .wz-chip").forEach((c) => {
        c.hidden = !!q && !c.classList.contains("on") && !c.textContent.toLowerCase().includes(q);
      });
      return;
    }
    if (wizardState.err) {
      wizardState.err = "";
      const x = selectOne("#we");
      if (x) x.textContent = "";
    }
    collectWizardInputs();
    wLive();
  });
  /* ---------- site targets & DCAs (extends the existing registration sites) ---------- */
  function renderTargetsView() {
    const s = editingSiteTargetId ? findSite(editingSiteTargetId) : null,
      l = s ? siteStateAndCounty(s) : ["", ""],
      qq = siteTargetSearch.toLowerCase(),
      all = {};
    REPORTS.forEach((r) => (all[r.site] = (all[r.site] || 0) + totalDcas(r)));
    const L = SITES.filter((x) => {
      const lc = siteStateAndCounty(x);
      return (
        (x.tg || x.open || x.deadline || x.sup || +x.dcaN || x.status == "Active") &&
        (!siteTargetState || lc[0] == siteTargetState) &&
        (!siteTargetCounty || lc[1] == siteTargetCounty) &&
        (!targetMdaFilter || (x.mda || "") == targetMdaFilter) &&
        (!targetStatusFilter || (x.status || "Planned") == targetStatusFilter) &&
        (!targetSupervisorFilter ||
          (targetSupervisorFilter == "__none"
            ? !x.sup
            : (x.sup || "") == targetSupervisorFilter)) &&
        (!targetProgressFilter ||
          ((r) =>
            targetProgressFilter == "none"
              ? r == 0
              : targetProgressFilter == "prog"
                ? r > 0 && (!siteTarget(x) || r < siteTarget(x))
                : siteTarget(x) > 0 && r >= siteTarget(x))(all[x.id] || 0)) &&
        (!qq || (x.name + " " + (x.mda || "") + " " + lc[1]).toLowerCase().includes(qq))
      );
    });
    const stN = s ? s.status || "Planned" : "Active",
      sOpts = (st, co) =>
        [["", "Select site"]].concat(
          SITES.filter((x) => {
            const lc = siteStateAndCounty(x);
            return st && co && lc[0] == st && lc[1] == co;
          })
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((x) => [x.id, x.name + (x.mda ? " · " + x.mda : "")]),
        );
    return __tpl(
      "renderTargetsView.5",
      `<div class="card"><h3>{{s1: s ? 'Edit site target: ' + escape…}}</h3><div class="flt">{{s2: s ? …}}<label>Total number to register<input id="tf" type="number" min="0" value="{{s3: s ? siteTarget(s) || '' : ''}}"></label><label>Opening date<input id="tod" type="date" value="{{s4: escapeHtml((s s.open) || '')}}"></label><label>Closing date<input id="tdl" type="date" value="{{s5: escapeHtml((s s.deadline) || '')}}"></label><label>Supervisor<select id="tsp">{{s6: optionsHtml(supList(s s.sup), (s…}}</select></label><label>DCAs to deploy<input id="tdn" type="number" min="0" value="{{s7: (s s.dcaN) || ''}}"></label><label>Status<select id="tsx">{{s8: optionsHtml(['Planned', 'Active',…}}</select></label><label>Comment<input id="tcm" value="{{s9: escapeHtml((s s.cmt) || '')}}"></label></div><p style="margin:6px 0;color:var(--mu);font-size:.85rem">Registered is counted automatically from the daily registration reports.</p><div class="pm" id="te"></div><button class="btn pri" data-fa="st">{{s10: s ? 'Save changes' : 'Add target'}}</button> {{s11: s ? ' button class='btn' data-fa=…}}</div>
 <div class="flt tfbar"><label>Search<input id="tq" value="{{s12: escapeHtml(siteTargetSearch)}}" placeholder="Site, MDA or county"></label><label>State<select id="tz">{{s13: optionsHtml(states(), siteTargetS…}}</select></label><label>County<select id="tzc">{{s14: optionsHtml(siteTargetState ? cou…}}</select></label><label>MDA<select id="tzm">{{s15: optionsHtml([...new Set(SITES.map…}}</select></label><label>Status<select id="tzs">{{s16: optionsHtml(['Planned', 'Active',…}}</select></label><label>Supervisor<select id="tzu">{{s17: optionsHtml([['__none', '(No supe…}}</select></label><label>Progress<select id="tzp">{{s18: optionsHtml( [ ['none', 'Not star…}}</select></label><label>&nbsp;<button class="btn" id="tzx" type="button">Clear filters</button></label></div>
<div class="card tw"><h3>Site targets · {{s19: L.length}} <small style="font-weight:400;color:var(--mu)">of {{s20: SITES.length}} registration sites</small></h3>{{s21: L.length ? …}}</div>`,
      [
        () => (s ? "Edit site target: " + escapeHtml(s.name) : "Add site target"),
        () =>
          s
            ? __tpl(
                "renderTargetsView.1",
                `<label>State<input value="{{s1: escapeHtml(l[0])}}" readonly></label><label>County<input value="{{s2: escapeHtml(l[1])}}" readonly></label><label>MDA<select id="tm">{{s3: optionsHtml(allMdaNames(), s.mda…}}</select></label><label>Site name<input value="{{s4: escapeHtml(s.name)}}" readonly></label>`,
                [
                  () => escapeHtml(l[0]),
                  () => escapeHtml(l[1]),
                  () => optionsHtml(allMdaNames(), s.mda || "", "Select MDA"),
                  () => escapeHtml(s.name),
                ],
              )
            : __tpl(
                "renderTargetsView.2",
                `<label>State<select id="ts">{{s1: optionsHtml(states(), '', 'Select…}}</select></label><label>County<select id="tc">{{s2: optionsHtml([], '', 'Select state…}}</select></label><label>MDA<select id="tm">{{s3: optionsHtml([], '', 'Select count…}}</select></label><label>Site name<select id="tn">{{s4: optionsHtml([], '', 'Select MDA f…}}</select></label>`,
                [
                  () => optionsHtml(states(), "", "Select state"),
                  () => optionsHtml([], "", "Select state first"),
                  () => optionsHtml([], "", "Select county first"),
                  () => optionsHtml([], "", "Select MDA first"),
                ],
              ),
        () => (s ? siteTarget(s) || "" : ""),
        () => escapeHtml((s && s.open) || ""),
        () => escapeHtml((s && s.deadline) || ""),
        () => optionsHtml(supList(s && s.sup), (s && s.sup) || "", "Select supervisor"),
        () => (s && s.dcaN) || "",
        () => optionsHtml(["Planned", "Active", "Closed"], stN),
        () => escapeHtml((s && s.cmt) || ""),
        () => (s ? "Save changes" : "Add target"),
        () =>
          s
            ? '<button class="btn" data-fa="sx">Cancel</button>'
            : '<small style="color:var(--mu)"> Sites come from the Registration sites tab; adding a target makes the site Active.</small>',
        () => escapeHtml(siteTargetSearch),
        () => optionsHtml(states(), siteTargetState, "All states"),
        () =>
          optionsHtml(
            siteTargetState ? counties(siteTargetState) : [],
            siteTargetCounty,
            siteTargetState ? "All counties" : "Select a state first",
          ),
        () =>
          optionsHtml(
            [...new Set(SITES.map((x) => x.mda).filter(Boolean))].sort(),
            targetMdaFilter,
            "All MDAs",
          ),
        () => optionsHtml(["Planned", "Active", "Closed"], targetStatusFilter, "All statuses"),
        () =>
          optionsHtml(
            [["__none", "(No supervisor)"]].concat(
              [...new Set(SITES.map((x) => x.sup).filter(Boolean))].sort(),
            ),
            targetSupervisorFilter,
            "All supervisors",
          ),
        () =>
          optionsHtml(
            [
              ["none", "Not started"],
              ["prog", "In progress"],
              ["done", "Target reached"],
            ],
            targetProgressFilter,
            "Any progress",
          ),
        () => L.length,
        () => SITES.length,
        () =>
          L.length
            ? __tpl(
                "renderTargetsView.4",
                `<table><thead><tr><th>Site</th><th>MDA</th><th>State</th><th>County</th><th class="n">Total to register</th><th>Opening</th><th>Closing</th><th>Supervisor</th><th class="n">DCAs to deploy</th><th class="n">Registered</th><th>Status</th><th></th></tr></thead><tbody>{{s1: L.map(…)}}</tbody><tfoot><tr class="dg"><td>Total</td><td colspan="3">{{s2: L.length}} site{{s3: L.length == 1 ? '' : 's'}}</td><td class="n">{{s4: formatNumber(L.reduce((a, x) = a…}}</td><td colspan="3"></td><td class="n">{{s5: formatNumber(L.reduce((a, x) = a…}}</td><td class="n">{{s6: formatNumber(L.reduce((a, x) = a…}}</td><td></td><td></td></tr></tfoot></table>`,
                [
                  () =>
                    L.map((x) => {
                      const lc = siteStateAndCounty(x);
                      return __tpl(
                        "renderTargetsView.3",
                        `<tr><td>{{s1: escapeHtml(x.name)}}</td><td>{{s2: escapeHtml(x.mda || '—')}}</td><td>{{s3: escapeHtml(lc[0])}}</td><td>{{s4: escapeHtml(lc[1])}}</td><td class="n">{{s5: siteTarget(x) ? formatNumber(site…}}</td><td>{{s6: escapeHtml(x.open || '—')}}</td><td>{{s7: escapeHtml(x.deadline || '—')}}</td><td>{{s8: escapeHtml(x.sup || '—')}}</td><td class="n">{{s9: x.dcaN || '—'}}</td><td class="n">{{s10: formatNumber(all[x.id] || 0)}}</td><td>{{s11: escapeHtml(x.status || 'Planned')}}</td><td><button class="btn" data-fa="es" data-i="{{s12: x.id}}">Edit</button></td></tr>`,
                        [
                          () => escapeHtml(x.name),
                          () => escapeHtml(x.mda || "—"),
                          () => escapeHtml(lc[0]),
                          () => escapeHtml(lc[1]),
                          () => (siteTarget(x) ? formatNumber(siteTarget(x)) : "—"),
                          () => escapeHtml(x.open || "—"),
                          () => escapeHtml(x.deadline || "—"),
                          () => escapeHtml(x.sup || "—"),
                          () => x.dcaN || "—",
                          () => formatNumber(all[x.id] || 0),
                          () => escapeHtml(x.status || "Planned"),
                          () => x.id,
                        ],
                      );
                    }).join(""),
                  () => L.length,
                  () => (L.length == 1 ? "" : "s"),
                  () => formatNumber(L.reduce((a, x) => a + siteTarget(x), 0)),
                  () => formatNumber(L.reduce((a, x) => a + (+x.dcaN || 0), 0)),
                  () => formatNumber(L.reduce((a, x) => a + (all[x.id] || 0), 0)),
                ],
              )
            : '<p class="em">No site targets yet. Use “Add site target” above to pick a registration site and set its target.</p>',
      ],
    );
  }
  /* ---------- users ---------- */
  let permissionForm = null;
  function pmMatrix(u) {
    const base =
        permissionForm || (u && u.perms) || permissionDefaults((u && u.role) || "supervisor"),
      g = (k, a) => (base[k] && base[k][a] ? " checked" : "");
    return __tpl(
      "pmMatrix.3",
      `<div class="pmx" id="pmx"><div class="pmh"><b>Page permissions</b><span>Choose which pages this user sees and what they can do on each page. View = see and export · Edit = add, change, submit, accept · Delete = remove.</span><button type="button" class="btn" data-fa="pmr">Reset to role default</button></div><div class="tw"><table data-nodt><thead><tr><th>Page</th><th class="c">View<br><input type="checkbox" class="pmall" data-a="v"></th><th class="c">Edit<br><input type="checkbox" class="pmall" data-a="e"></th><th class="c">Delete<br><input type="checkbox" class="pmall" data-a="d"></th></tr></thead><tbody>{{s1: allTabs.map(…)}}</tbody></table></div>{{s2: cdBlock(u)}}</div>`,
      [
        () =>
          allTabs
            .map((t) =>
              __tpl(
                "pmMatrix.2",
                `<tr><td>{{s1: escapeHtml(t[1])}}</td>{{s2: ['v', 'e', 'd'].map(…)}}</tr>`,
                [
                  () => escapeHtml(t[1]),
                  () =>
                    ["v", "e", "d"]
                      .map((a) =>
                        __tpl(
                          "pmMatrix.1",
                          `<td class="c"><input type="checkbox" class="pmc" data-t="{{s1: t[0]}}" data-a="{{s2: a}}"{{s3: g(t[0], a)}}></td>`,
                          [() => t[0], () => a, () => g(t[0], a)],
                        ),
                      )
                      .join(""),
                ],
              ),
            )
            .join(""),
        () => cdBlock(u),
      ],
    );
  }
  let collectorForm = null;
  function cdBlock(u) {
    const b = collectorForm || (u && u.cards) || collectorDefaults((u && u.role) || "supervisor"),
      N = {
        adm: ["Administrator", "Registration control and admin pages"],
        nat: ["Map Overview", "National overview, map and Analytics"],
        sup: ["Supervisor", "Supervisor workspace"],
      };
    return __tpl(
      "cdBlock.2",
      `<div class="pmcards" id="pmcd"><b>Switch view cards</b><span>Choose which cards this user can view on the Switch view screen.</span><div class="pmcl">{{s1: collectorTypes.map(…)}}</div></div>`,
      [
        () =>
          collectorTypes
            .map((k) =>
              __tpl(
                "cdBlock.1",
                `<label class="pmcc"><input type="checkbox" class="pmcd" data-c="{{s1: k}}"{{s2: b[k] ? ' checked' : ''}}><span><b>{{s3: N[k][0]}}</b><small>{{s4: N[k][1]}}</small></span></label>`,
                [() => k, () => (b[k] ? " checked" : ""), () => N[k][0], () => N[k][1]],
              ),
            )
            .join(""),
      ],
    );
  }
  function cdRead() {
    const o = {};
    collectorTypes.forEach((k) => {
      const c = document.querySelector('#pmcd .pmcd[data-c="' + k + '"]');
      o[k] = c && c.checked ? 1 : 0;
    });
    return o;
  }
  function cdSet(p) {
    document.querySelectorAll("#pmcd .pmcd").forEach((c) => {
      c.checked = !!p[c.dataset.c];
    });
  }
  function pmRead() {
    const o = {};
    allTabs.forEach(
      (t) =>
        (o[t[0]] = {
          v: 0,
          e: 0,
          d: 0,
        }),
    );
    document.querySelectorAll("#pmx .pmc").forEach((c) => {
      if (c.checked) o[c.dataset.t][c.dataset.a] = 1;
    });
    return o;
  }
  function pmSet(p) {
    document.querySelectorAll("#pmx .pmc").forEach((c) => {
      c.checked = !!(p[c.dataset.t] && p[c.dataset.t][c.dataset.a]);
    });
  }
  function renderUsersView() {
    const a = getAcc(),
      ed =
        editingUserId == "main"
          ? mainAdminProfile
          : USERS.find((x) => x.id == editingUserId) || null,
      isM = editingUserId == "main";
    if (editingUserId && !ed && !isM) editingUserId = null;
    pendingPhoto = ed ? ed.photo || "" : "";
    const e = ed || {};
    return __tpl(
      "renderUsersView.4",
      `<div class="card"><h3>{{s1: editingUserId ? 'Edit profile: '…}}</h3><div class="flt"><label>Full name<input id="un" value="{{s2: escapeHtml(isM ? mainAdminProfile…}}"></label><label>Phone number<input id="uph" type="tel" value="{{s3: escapeHtml(e.phone || '')}}" placeholder="+211…"></label>{{s4: photoBox(isM ? mainAdminProfile.n…}}<label>Status<select id="uss">{{s5: optionsHtml(['Active', 'Inactive'…}}</select></label></div><div class="flt"><label>{{s6: editingUserId ? 'Username (cannot…}}<input id="uu" autocomplete="off" value="{{s7: escapeHtml(isM ? a.u : e.u || '')}}" {{s8: editingUserId ? 'disabled' : ''}}></label>{{s9: isM ? '' : …}}</div>{{s10: isM ? '' : pmMatrix(e)}}<div class="pm" id="ue"></div><button class="btn pri" data-fa="au">{{s11: editingUserId ? 'Save changes' :…}}</button> {{s12: editingUserId ? ' button class='b…}}</div>
<div class="card tw"><h3>Users and roles</h3><table><thead><tr><th></th><th>Name</th><th>Username</th><th>Role</th><th>Phone</th><th>Status</th><th>Reset password</th><th></th></tr></thead><tbody>{{s13: a ? …}}{{s14: USERS.map(…)}}</tbody></table><p class="em" style="text-align:left">Inactive users cannot sign in. Admin: everything incl. users · Sub admin: map data, sites, targets, DCAs, reports, export · Supervisor: add and update daily reports and DCAs · Reader: view only.</p></div>`,
      [
        () =>
          editingUserId
            ? "Edit profile: " + escapeHtml(isM ? mainAdminProfile.name || a.u : ed.name)
            : "Add user",
        () => escapeHtml(isM ? mainAdminProfile.name || "" : e.name || ""),
        () => escapeHtml(e.phone || ""),
        () => photoBox(isM ? mainAdminProfile.name || a.u : e.name || ""),
        () => optionsHtml(["Active", "Inactive"], e.status || "Active"),
        () => (editingUserId ? "Username (cannot be changed)" : "Username"),
        () => escapeHtml(isM ? a.u : e.u || ""),
        () => (editingUserId ? "disabled" : ""),
        () =>
          isM
            ? ""
            : __tpl(
                "renderUsersView.1",
                `<label>{{s1: editingUserId ? 'New password (op…}}<input id="up" type="password" autocomplete="new-password"></label><label>Role<select id="ur">{{s2: optionsHtml(Object.entries(ROLE_L…}}</select></label>`,
                [
                  () =>
                    editingUserId
                      ? "New password (optional · leave blank to keep the current one)"
                      : "Password (8+)",
                  () => optionsHtml(Object.entries(ROLE_LABELS), e.role || "supervisor"),
                ],
              ),
        () => (isM ? "" : pmMatrix(e)),
        () => (editingUserId ? "Save changes" : "Add user"),
        () => (editingUserId ? '<button class="btn" data-fa="ux">Cancel</button>' : ""),
        () =>
          a
            ? __tpl(
                "renderUsersView.2",
                `<tr><td>{{s1: avatarHtml(mainAdminProfile.photo…}}</td><td>{{s2: escapeHtml(mainAdminProfile.name…}}</td><td>{{s3: escapeHtml(a.u)}}</td><td>Admin <span class="tag">main</span></td><td>{{s4: escapeHtml(mainAdminProfile.phone…}}</td><td>{{s5: statusTagHtml(mainAdminProfile.st…}}</td><td>Account button</td><td><button class="btn" data-fa="ue" data-i="main">Edit</button></td></tr>`,
                [
                  () => avatarHtml(mainAdminProfile.photo, mainAdminProfile.name || a.u),
                  () => escapeHtml(mainAdminProfile.name || "Main administrator"),
                  () => escapeHtml(a.u),
                  () => escapeHtml(mainAdminProfile.phone || "—"),
                  () => statusTagHtml(mainAdminProfile.status),
                ],
              )
            : "",
        () =>
          USERS.map((u) =>
            __tpl(
              "renderUsersView.3",
              `<tr><td>{{s1: avatarHtml(u.photo, u.name)}}</td><td>{{s2: escapeHtml(u.name)}}</td><td>{{s3: escapeHtml(u.u)}}</td><td><select data-fa="rl" data-i="{{s4: u.id}}">{{s5: optionsHtml(Object.entries(ROLE_L…}}</select></td><td>{{s6: escapeHtml(u.phone || '—')}}</td><td>{{s7: statusTagHtml(u.status)}}</td><td><input type="password" placeholder="new password" data-pw="{{s8: u.id}}" style="width:110px"> <button class="btn" data-fa="pw" data-i="{{s9: u.id}}">Set</button></td><td><button class="btn" data-fa="ue" data-i="{{s10: u.id}}">Edit</button> <button class="btn dg" data-fa="du" data-i="{{s11: u.id}}">Delete</button></td></tr>`,
              [
                () => avatarHtml(u.photo, u.name),
                () => escapeHtml(u.name),
                () => escapeHtml(u.u),
                () => u.id,
                () => optionsHtml(Object.entries(ROLE_LABELS), u.role),
                () => escapeHtml(u.phone || "—"),
                () => statusTagHtml(u.status),
                () => u.id,
                () => u.id,
                () => u.id,
                () => u.id,
              ],
            ),
          ).join(""),
      ],
    );
  }
  async function saveUser() {
    if (!isAdmin()) return;
    const er = (m) => (selectOne("#ue").textContent = m),
      nm = selectOne("#un").value.trim(),
      ph = selectOne("#uph").value.trim();
    if (!nm) return er("Enter the full name.");
    if (!isValidPhone(ph)) return er("Enter a valid phone number (digits, +, spaces, dashes).");
    const pr = {
      phone: ph,
      photo: pendingPhoto,
      status: selectOne("#uss").value,
    };
    if (!editingUserId || editingUserId != "main") {
      const pp = pmRead();
      if (!Object.values(pp).some((x) => x.v)) return er("Allow at least one page for this user.");
      if (!Object.values(cdRead()).some((x) => x))
        return er("Allow at least one Switch view card for this user.");
    }
    if (editingUserId == "main") {
      mainAdminProfile = Object.assign(
        {
          name: nm,
        },
        pr,
        {
          status: "Active",
        },
      );
      saveToStorage(MAIN_PROFILE_KEY, mainAdminProfile);
      editingUserId = null;
      toast("Profile saved");
      return go();
    }
    const pw = selectOne("#up").value;
    if (editingUserId) {
      const u = USERS.find((x) => x.id == editingUserId);
      if (pw && pw.length < 8) return er("Password must be at least 8 characters.");
      if (pw) {
        const m = await mkAcc("x", pw);
        Object.assign(u, {
          salt: m.salt,
          alg: m.alg,
          it: m.it,
          h: m.h,
        });
      }
      if (u.id && u.u.toLowerCase() == AUSER.toLowerCase() && pr.status == "Inactive")
        return er("You cannot deactivate the account you are signed in with.");
      Object.assign(
        u,
        {
          name: nm,
          role: selectOne("#ur").value,
        },
        pr,
        {
          perms: pmRead(),
          cards: cdRead(),
        },
      );
      saveToStorage(USERS_KEY, USERS);
      editingUserId = null;
      toast("User updated");
      return go();
    }
    const un = selectOne("#uu").value.trim();
    if (!/^[A-Za-z0-9._-]{3,32}$/.test(un))
      return er("Username: 3–32 letters, digits, dot, dash or underscore.");
    if (pw.length < 8) return er("Password must be at least 8 characters.");
    if (mainAcc(un) || USERS.some((x) => x.u.toLowerCase() == un.toLowerCase()))
      return er("Username already taken.");
    const m = await mkAcc(un, pw);
    USERS.push(
      Object.assign(
        {
          id: newId(),
          u: un,
          name: nm,
          role: selectOne("#ur").value,
          salt: m.salt,
          alg: m.alg,
          it: m.it,
          h: m.h,
        },
        pr,
        {
          perms: pmRead(),
          cards: cdRead(),
        },
      ),
    );
    saveToStorage(USERS_KEY, USERS);
    toast("User added");
    go();
  }
  /* ---------- events ---------- */
  document.addEventListener("change", (e) => {
    const c = e.target;
    if (!c.closest || (!c.closest("#pmx") && c.id != "ur")) return;
    if (c.id == "ur") {
      permissionForm = null;
      collectorForm = null;
      if (document.getElementById("pmx")) {
        pmSet(permissionDefaults(c.value));
        cdSet(collectorDefaults(c.value));
      }
      return;
    }
    if (c.classList.contains("pmall")) {
      document
        .querySelectorAll('#pmx .pmc[data-a="' + c.dataset.a + '"]')
        .forEach((x) => (x.checked = c.checked));
      if (c.checked && c.dataset.a != "v")
        document.querySelectorAll('#pmx .pmc[data-a="v"]').forEach((x) => (x.checked = true));
      if (!c.checked && c.dataset.a == "v")
        document.querySelectorAll("#pmx .pmc").forEach((x) => (x.checked = false));
      return;
    }
    if (c.classList.contains("pmc")) {
      const row = c.closest("tr");
      if (c.checked && c.dataset.a != "v") row.querySelector('[data-a="v"]').checked = true;
      if (!c.checked && c.dataset.a == "v")
        row.querySelectorAll(".pmc").forEach((x) => (x.checked = false));
    }
  });
  const permissionActionMap = {
    er: ["new", "e"],
    mer: ["new", "e"],
    mst: ["mda", "e"],
    eds: ["dca", "e"],
    rva: ["rep", "e"],
    rvr: ["rep", "e"],
    dr: ["rep", "d"],
    mdr: ["mda", "d"],
    st: ["targets", "e"],
    es: ["targets", "e"],
    estr: ["targets", "e"],
    mas: ["mdam", "e"],
    mae: ["mdam", "e"],
    mad: ["mdam", "d"],
    ivs: ["inv", "e"],
    ive: ["inv", "e"],
    ivca: ["inv", "e"],
    ivce: ["inv", "e"],
    ivcs: ["inv", "e"],
    ivd: ["inv", "d"],
    ivcd: ["inv", "d"],
    de: ["dca", "e"],
    dsv: ["dca", "e"],
    dd: ["dca", "d"],
    au: ["users", "e"],
    ue: ["users", "e"],
    eus: ["users", "e"],
    rl: ["users", "e"],
    pw: ["users", "e"],
    du: ["users", "d"],
    bki: ["bak", "e"],
    rbi: ["bak", "e"],
    bkr: ["bak", "d"],
  };
  const mapTabAccess = {
    counties: 1,
    places: 1,
    airports: 1,
    sites: 1,
    roads: 1,
  };
  function pmKindTab(k) {
    return k == "cty"
      ? "counties"
      : k == "site"
        ? "sites"
        : k == "road"
          ? "roads"
          : ADM.tab == "airports"
            ? "airports"
            : "places";
  }
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest && e.target.closest("[data-fa]");
      let deny = false;
      if (b && permissionActionMap[b.dataset.fa]) {
        const p = permissionActionMap[b.dataset.fa];
        if (b.dataset.fa == "pmr") {
        } else if (!canDoAction(p[0], p[1])) deny = true;
      }
      const d = e.target.closest && e.target.closest('[data-a="del"],[data-m="del"]');
      if (d && !deny) {
        const t = d.dataset.m ? pmKindTab(window.AM && AM.kind) : ADM.tab;
        if (mapTabAccess[t] && !canDoAction(t, "d")) deny = true;
      }
      if (deny) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toast("You do not have permission for this action");
      }
    },
    true,
  );
  document.addEventListener(
    "click",
    (e) => {
      const b = e.target.closest && e.target.closest('[data-fa="pmr"]');
      if (!b) return;
      e.stopPropagation();
      permissionForm = null;
      collectorForm = null;
      const r = document.getElementById("ur");
      pmSet(permissionDefaults(r ? r.value : "supervisor"));
      cdSet(collectorDefaults(r ? r.value : "supervisor"));
    },
    true,
  );
  {
    const _am = window.amodal;
    if (_am)
      window.amodal = function (kind, ref, preset) {
        if (!canDoAction(pmKindTab(kind), "e")) {
          toast("You do not have permission to edit here");
          return;
        }
        return _am.apply(this, arguments);
      };
  }
  function pmApply() {
    const z = document.getElementById("abody");
    if (!z) return;
    z.querySelectorAll("[data-fa]").forEach((b) => {
      const p = permissionActionMap[b.dataset.fa];
      if (p && !canDoAction(p[0], p[1]) && b.dataset.fa != "rl") {
        b.style.display = "none";
        const pw = b.dataset.fa == "pw" ? z.querySelector('[data-pw="' + b.dataset.i + '"]') : null;
        if (pw) pw.style.display = "none";
      } else if (p && b.dataset.fa == "rl" && !canDoAction(p[0], p[1])) b.disabled = true;
    });
    if (mapTabAccess[ADM.tab]) {
      const e = canDoAction(ADM.tab, "e"),
        d = canDoAction(ADM.tab, "d");
      z.querySelectorAll('[data-a="del"]').forEach((x) => {
        if (!d) x.style.display = "none";
      });
      z.querySelectorAll('[data-a="edit"]').forEach((x) => {
        if (!e) x.style.display = "none";
      });
      z.querySelectorAll("button,a").forEach((x) => {
        if (!e && /^\s*(\+|Add )/.test(x.textContent) && !x.closest("#atabs"))
          x.style.display = "none";
      });
    }
  }
  {
    const _ar = window.admRender;
    if (_ar)
      window.admRender = function () {
        const r = _ar.apply(this, arguments);
        try {
          pmApply();
        } catch (x) {}
        return r;
      };
  }
  window.FVD = {
    step: () => wizardState && wizardState.step,
    type: () => wizardState && wizardState.type,
    userTaken: (u) => !!(mainAcc(u) || USERS.some((x) => x.u.toLowerCase() == u.toLowerCase())),
    dcaTaken: (n) => {
      const o = editingDcaId ? dataCollectors.find((x) => x.id == editingDcaId) : null;
      return dataCollectors.some((x) => x.name.toLowerCase() == n.toLowerCase() && x !== o);
    },
    mdaTaken: (n) => mdaList().some((m) => m.toLowerCase() == n.toLowerCase()),
  };
  const go = () => admRender(true);
  const EARLIEST_DATE = "2000-01-01";
  function dateRangeLabel() {
    return pageFilters.from == EARLIEST_DATE
      ? "All time"
      : pageFilters.from == pageFilters.to
        ? pageFilters.from
        : pageFilters.from + " to " + pageFilters.to;
  }
  function resetDateRange() {
    pageFilters.from = daysAgoIso(29);
    pageFilters.to = today();
    pageFilters.q = "29";
    go();
  }
  function initDateRangePicker() {
    const el = selectOne("#fdr");
    if (!el) return;
    el.value = dateRangeLabel();
    const $j = window.jQuery;
    if (!$j || !$j.fn.daterangepicker || !window.moment) return;
    const m = moment,
      ranges = {
        Today: [m(), m()],
        Yesterday: [m().subtract(1, "days"), m().subtract(1, "days")],
        "Last 7 days": [m().subtract(6, "days"), m()],
        "Last 30 days": [m().subtract(29, "days"), m()],
        "This month": [m().startOf("month"), m()],
        "Last month": [
          m().subtract(1, "month").startOf("month"),
          m().subtract(1, "month").endOf("month"),
        ],
        "This year": [m().startOf("year"), m()],
        "All time": [m(EARLIEST_DATE), m()],
      };
    $j(el)
      .daterangepicker({
        startDate: m(pageFilters.from),
        endDate: m(pageFilters.to),
        minDate: m(EARLIEST_DATE),
        maxDate: m(),
        ranges,
        alwaysShowCalendars: true,
        showDropdowns: true,
        autoUpdateInput: false,
        opens: "right",
        locale: {
          format: "YYYY-MM-DD",
          applyLabel: "Apply",
          cancelLabel: "Reset",
          customRangeLabel: "Custom range",
          firstDay: 1,
        },
        applyButtonClasses: "btn-primary",
        cancelButtonClasses: "btn-outline-secondary",
      })
      .on("apply.daterangepicker", (e, p) => {
        pageFilters.from = p.startDate.format("YYYY-MM-DD");
        pageFilters.to = p.endDate.format("YYYY-MM-DD");
        go();
      })
      .on("cancel.daterangepicker", resetDateRange);
    if (window.UIKIT) UIKIT.reg(el);
  }
  function bind() {
    const B = selectOne("#abody"),
      g = (s) => selectOne(s);
    if (g("#fdr")) {
      initDateRangePicker();
      if (g("#fp"))
        g("#fp").onchange = (e) => {
          pageFilters.sup = e.target.value;
          go();
        };
      if (g("#fdca"))
        g("#fdca").onchange = (e) => {
          activityFilters.dca = e.target.value;
          go();
        };
      if (g("#fpd"))
        g("#fpd").onchange = (e) => {
          pageFilters.per = e.target.value;
          go();
        };
      if (g("#fst"))
        g("#fst").onchange = (e) => {
          pageFilters.tst = e.target.value;
          go();
        };
      if (g("#mg"))
        g("#mg").onchange = (e) => {
          pageFilters.grp = e.target.value;
          go();
        };
      [
        ["#dwk", "wk"],
        ["#dmo", "mo"],
      ].forEach(([i, k]) => {
        if (g(i))
          g(i).onchange = (e) => {
            dashboardPeriod[k] = e.target.value;
            go();
          };
      });
      [
        ["#ay", "yr"],
        ["#acm", "met"],
        ["#asp", "sup"],
        ["#adc", "dca"],
        ["#amd", "mda"],
      ].forEach(([i, k]) => {
        if (g(i))
          g(i).onchange = (e) => {
            activityFilters[k] = e.target.value;
            go();
          };
      });
      g("#fs").onchange = (e) => {
        pageFilters.state = e.target.value;
        pageFilters.county = "";
        pageFilters.site = "";
        go();
      };
      if (g("#fc"))
        g("#fc").onchange = (e) => {
          pageFilters.county = e.target.value;
          pageFilters.site = "";
          go();
        };
      g("#fi").onchange = (e) => {
        pageFilters.site = e.target.value;
        go();
      };
    }
    if (g("#wz")) wLive();
    if (g("#ts"))
      g("#ts").onchange = () => {
        g("#tc").innerHTML = optionsHtml(counties(g("#ts").value), "", "Select county");
        if (g("#tn")) {
          g("#tm").innerHTML = optionsHtml([], "", "Select county first");
          g("#tn").innerHTML = optionsHtml([], "", "Select MDA first");
        }
      };
    const tAt = () => {
      const st = g("#ts").value,
        co = g("#tc").value;
      return SITES.filter((x) => {
        const lc = siteStateAndCounty(x);
        return st && co && lc[0] == st && lc[1] == co;
      });
    };
    if (g("#tc") && g("#tn"))
      g("#tc").onchange = () => {
        g("#tm").innerHTML = optionsHtml(
          [...new Set(tAt().map((x) => x.mda || "__none"))]
            .sort()
            .map((m) => [m, m == "__none" ? "(No MDA)" : m]),
          "",
          "Select MDA",
        );
        g("#tn").innerHTML = optionsHtml([], "", "Select MDA first");
      };
    if (g("#tm") && g("#tn"))
      g("#tm").onchange = () => {
        const m = g("#tm").value;
        g("#tn").innerHTML = optionsHtml(
          tAt()
            .filter((x) => m && (x.mda || "__none") == m)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((x) => [x.id, x.name]),
          "",
          "Select site",
        );
      };
    if (g("#tn") && g("#tn").tagName == "SELECT")
      g("#tn").onchange = () => {
        const x = findSite(g("#tn").value);
        if (x) {
          [
            ["#tf", siteTarget(x) || ""],
            ["#tod", x.open || ""],
            ["#tdl", x.deadline || ""],
            ["#tdn", x.dcaN || ""],
            ["#tcm", x.cmt || ""],
          ].forEach(([i, v]) => {
            if (g(i)) g(i).value = v;
          });
        }
      };
    if (g("#dq")) {
      g("#dq").oninput = (e) => {
        dcaSearch = e.target.value;
        g("#dtab").innerHTML = dcaTable();
      };
      g("#dt").onchange = (e) => {
        dcaStatusFilter = e.target.value;
        g("#dtab").innerHTML = dcaTable();
      };
    }
    if (g("#tq")) {
      g("#tq").oninput = (e) => {
        siteTargetSearch = e.target.value;
        clearTimeout(bind.t);
        bind.t = setTimeout(() => {
          go();
          const t = g("#tq");
          t.focus();
          t.setSelectionRange(siteTargetSearch.length, siteTargetSearch.length);
        }, 250);
      };
      g("#tz").onchange = (e) => {
        siteTargetState = e.target.value;
        siteTargetCounty = "";
        go();
      };
      g("#tzc").onchange = (e) => {
        siteTargetCounty = e.target.value;
        go();
      };
      g("#tzm").onchange = (e) => {
        targetMdaFilter = e.target.value;
        go();
      };
      g("#tzs").onchange = (e) => {
        targetStatusFilter = e.target.value;
        go();
      };
      g("#tzu").onchange = (e) => {
        targetSupervisorFilter = e.target.value;
        go();
      };
      g("#tzp").onchange = (e) => {
        targetProgressFilter = e.target.value;
        go();
      };
      g("#tzx").onclick = () => {
        siteTargetSearch =
          siteTargetState =
          siteTargetCounty =
          targetMdaFilter =
          targetStatusFilter =
          targetSupervisorFilter =
          targetProgressFilter =
            "";
        go();
      };
    }
  }
  selectOne("#abody").addEventListener("input", (e) => {
    if (e.target.classList && ["dv", "mo", "mp", "mf"].some((c) => e.target.classList.contains(c)))
      sumNew();
  });
  selectOne("#abody").addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset && t.dataset.ph) {
      const f = t.files[0];
      if (!f) return;
      if (!/^image\//.test(f.type) || f.size > 10e6) return toast("Choose an image under 10 MB");
      shrinkImage(f)
        .then((d) => {
          pendingPhoto = d;
          selectOne("#phv").innerHTML = avatarHtml(d, "");
        })
        .catch(() => toast("Could not read that image"));
      return;
    }
    if (t.dataset && t.dataset.fa == "rl" && isAdmin()) {
      const u = USERS.find((x) => x.id == t.dataset.i);
      u.role = t.value;
      saveToStorage(USERS_KEY, USERS);
      toast("Role updated");
    }
  });
  selectOne("#abody").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-fa]");
    if (!b || b.tagName == "SELECT") return;
    const a = b.dataset.fa,
      i = b.dataset.i;
    if (a == "rvh") return reviewHistoryHtml(i);
    if (a == "rva") return acceptReport(i);
    if (a == "rvr") return rejectReport(i);
    if (a == "mst") return mstOpen(b.dataset.k, b.dataset.g, b.dataset.d);
    if (a == "ivcx") return ivMatOut(b.dataset.f);
    if (a == "ivv") return wRepView(i, 0, 1);
    if (a == "ivp") return wRepView(i, 1, 1);
    if (a == "rv") return wRepView(i, 0, ADM.tab == "dcar" ? "dca" : 0);
    if (a == "rpr") return wRepView(i, 1, ADM.tab == "dcar" ? "dca" : 0);
    if (a == "mrv" || a == "mrp") {
      const L = wRepFind(b.dataset.k, b.dataset.g, b.dataset.d).map((x) => x.id);
      return wRepView(L, a == "mrp");
    }
    if (a == "cx") {
      editingReportId = null;
      ADM.tab = "rep";
      go();
    }
    if (a == "er") {
      editingReportId = i;
      ADM.tab = "new";
      go();
    }
    if (a == "dr" && isSubadminOrAdmin() && (await askConfirm("Delete this daily report?"))) {
      REPORTS = REPORTS.filter((r) => r.id != i);
      saveToStorage(REPORTS_KEY, REPORTS);
      go();
    }
    if (a == "st") saveSite();
    if (a == "sx") {
      editingSiteTargetId = null;
      go();
    }
    if (a == "es") {
      editingSiteTargetId = i;
      go();
    }
    if (a == "estr") {
      editingSiteTargetId = i;
      ADM.tab = "targets";
      go();
    }
    if (a == "au") saveUser();
    if (a == "ue") {
      permissionForm = null;
      collectorForm = null;
      editingUserId = i;
      go();
    }
    if (a == "ux") {
      editingUserId = null;
      go();
    }
    if (a == "phx") {
      pendingPhoto = "";
      selectOne("#phv").innerHTML = avatarHtml(
        "",
        selectOne("#dcn") ? selectOne("#dcn").value : selectOne("#un").value,
      );
    }
    if (a == "pw") setPw(i);
    if (a == "du" && isAdmin() && (await askConfirm("Delete this user?"))) {
      USERS = USERS.filter((u) => u.id != i);
      saveToStorage(USERS_KEY, USERS);
      go();
    }
    if (a == "mas") saveMda();
    if (a == "max") {
      editingMdaName = null;
      go();
    }
    if (a == "mae") {
      editingMdaName = i;
      go();
    }
    if (a == "mad" && isSubadminOrAdmin()) {
      const n = SITES.filter(
        (s) =>
          String(s.mda || "")
            .trim()
            .toLowerCase() == String(i).toLowerCase(),
      );
      if (
        await askConfirm(
          n.length
            ? "Delete this MDA? " +
                n.length +
                " registration site(s) will be left without an MDA. Past daily reports keep their records."
            : "Delete this MDA?",
        )
      ) {
        n.forEach((s) => (s.mda = ""));
        mdaRecords = mdaRecords.filter((x) => String(x).toLowerCase() != String(i).toLowerCase());
        saveToStorage(MDAS_KEY, mdaRecords);
        scheduleSave();
        refresh();
        toast("MDA deleted");
        go();
      }
    }
    if (a == "ivs") saveInv();
    if (a == "ivx") {
      editingInventoryId = null;
      go();
    }
    if (a == "ive") {
      editingInventoryId = i;
      go();
    }
    if (a == "ivd" && isSubadminOrAdmin() && (await askConfirm("Delete this inventory item?"))) {
      inventoryItems = inventoryItems.filter((x) => x.id != i);
      saveToStorage(INVENTORY_KEY, inventoryItems);
      toast("Item deleted");
      go();
    }
    if (a == "ivcs" && isSubadminOrAdmin()) {
      hiddenInventoryCategories = wCatOn(i)
        ? hiddenInventoryCategories.concat([i])
        : hiddenInventoryCategories.filter((c) => c !== i);
      saveToStorage("bioreg.invcathide", hiddenInventoryCategories);
      toast(
        wCatOn(i)
          ? "“" + i + "” will show on the Enter daily report"
          : "“" + i + "” hidden from the Enter daily report",
      );
      go();
    }
    if (a == "ivca") saveCat();
    if (a == "ivcx") {
      editingCategory = null;
      go();
    }
    if (a == "ivce") {
      editingCategory = i;
      go();
    }
    if (a == "ivcd" && isSubadminOrAdmin()) {
      if (inventoryItems.some((x) => x.cat == i))
        toast(
          "This category is in use by " +
            inventoryItems.filter((x) => x.cat == i).length +
            " item(s). Move or delete them first.",
        );
      else if (await askConfirm("Delete the category “" + i + "”?")) {
        inventoryCategories = inventoryCategories.filter((c) => c !== i);
        hiddenInventoryCategories = hiddenInventoryCategories.filter((c) => c !== i);
        saveToStorage("bioreg.invcathide", hiddenInventoryCategories);
        saveToStorage(INVENTORY_CATEGORIES_KEY, inventoryCategories);
        go();
      }
    }
    if (a == "dpt") {
      collectDeploymentInputs();
      deploymentPlanState.type = i;
      deploymentPlanState.res = null;
      if (i == "multi" && deploymentPlanState.sites.length < 2)
        deploymentPlanState.sites.push(newDeploymentSite(deploymentPlanState.sites[0]));
      if (i == "single") deploymentPlanState.sites = deploymentPlanState.sites.slice(0, 1);
      go();
    }
    if (a == "dga") {
      collectDeploymentInputs();
      deploymentPlanState.nn = deploymentPlanState.groups.length + 1;
      deploymentPlanState.res = null;
      go();
    }
    if (a == "dgr") {
      collectDeploymentInputs();
      deploymentPlanState.groups.splice(+i, 1);
      deploymentPlanState.nn = deploymentPlanState.groups.length;
      deploymentPlanState.res = null;
      go();
    }
    if (a == "dpa") {
      collectDeploymentInputs();
      deploymentPlanState.sites.push(
        newDeploymentSite(deploymentPlanState.sites[deploymentPlanState.sites.length - 1]),
      );
      go();
    }
    if (a == "dpr") {
      collectDeploymentInputs();
      deploymentPlanState.sites.splice(+i, 1);
      deploymentPlanState.res = null;
      go();
    }
    if (a == "dpc") calculateDeploymentPlan();
    if (a == "dpz") {
      deploymentPlanState = {
        type: "single",
        sites: [newDeploymentSite()],
        avg: "",
        max: "",
        start: "",
        res: null,
        err: "",
      };
      go();
    }
    if (a == "dsv") saveDca();
    if (a == "dx") {
      editingDcaId = null;
      go();
    }
    if (a == "de") {
      editingDcaId = i;
      go();
    }
    if (
      a == "dd" &&
      isSubadminOrAdmin() &&
      (await askConfirm("Delete this data collector? Past daily reports keep their records."))
    ) {
      dataCollectors = dataCollectors.filter((x) => x.id != i);
      saveToStorage(DCA_LIST_KEY, dataCollectors);
      toast("DCA deleted");
      go();
    }
    if (a == "pg") {
      goToPage(b);
      return;
    }
    if (a == "asel") {
      activityFilters[b.dataset.kd] = b.dataset.k;
      go();
      return;
    }
    if (a == "eds") {
      editingDcaId = i;
      ADM.tab = "dca";
      go();
      return;
    }
    if (a == "eus") {
      editingUserId = i;
      ADM.tab = "users";
      go();
      return;
    }
    if (a == "xp") {
      runExport(b.dataset.kd, b.dataset.t, b.dataset.f, ADM.tab == "supr" || ADM.tab == "dcar");
      return;
    }
    if (a == "mre") openDetailsModal(b.dataset.k, b.dataset.g, b.dataset.d);
    if (a == "frst") resetDateRange();
    if (a == "wkp" || a == "wkn" || a == "wkf") {
      const m = a == "wkp" ? addD(wkBase(), -7) : a == "wkn" ? addD(wkBase(), 7) : wkBase();
      pageFilters.from = m;
      pageFilters.to = wkEnd(m);
      pageFilters.q = "";
      go();
    }
    if (a == "fall") {
      pageFilters.from = daysAgoIso(29);
      pageFilters.to = today();
      pageFilters.q = "29";
      pageFilters.state = "";
      pageFilters.county = "";
      pageFilters.site = "";
      pageFilters.sup = "";
      pageFilters.tst = "";
      pageFilters.per = "all";
      try {
        activityFilters.dca = "";
      } catch (x) {}
      go();
    }
    if (a == "csv") csv();
    if (a == "acsv") acsv();
    if (a == "mcsv") mcsv();
    if (a == "rcsv") rcsvx();
  });
  function detailsButtonHtml(k, g, d) {
    const at = `data-k="${escapeHtml(k)}" data-g="${g}" data-d="${d || ""}"`;
    return __tpl(
      "detailsButtonHtml.2",
      `<span class="rp-act" style="margin:0;flex-wrap:nowrap"><button type="button" class="btn" data-fa="mrv" {{s1: at}}><i class="bx bx-show"></i> View</button><button type="button" class="btn" data-fa="mrp" {{s2: at}}><i class="bx bx-printer"></i> Print</button>{{s3: canEnter() ? …}}</span>`,
      [
        () => at,
        () => at,
        () =>
          canEnter()
            ? __tpl(
                "detailsButtonHtml.1",
                `<button type="button" class="btn btn-sm btn-outline-primary" data-fa="mst" {{s1: at}}><i class="bx bx-edit-alt"></i> Edit status</button>`,
                [() => at],
              )
            : "",
      ],
    );
  }
  function detailsRows(k, g, dt) {
    return rows()
      .filter((r) => {
        if (dt && r.date != dt) return false;
        const s = findSite(r.site) || {};
        if (g == "site") return (r.regMda || s.mda || s.name || "deleted site") == k;
        return r.mdas && r.mdas.length
          ? r.mdas.some((m) => m.mda == k)
          : k.indexOf("Not specified") == 0;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  function openDetailsModal(k, g, dt) {
    const m = document.getElementById("mre");
    if (!m) return;
    m.dataset.k = k;
    m.dataset.g = g;
    m.dataset.d = dt || "";
    fillDetailsModal();
    m.hidden = false;
  }
  function fillDetailsModal() {
    const m = document.getElementById("mre"),
      k = m.dataset.k,
      g = m.dataset.g,
      L = detailsRows(k, g, m.dataset.d);
    m.querySelector(".modal-title").textContent =
      "Edit reports · " + k + (m.dataset.d ? " · " + m.dataset.d : "");
    m.querySelector("#mre-b").innerHTML = L.length
      ? __tpl(
          "fillDetailsModal.4",
          `<p class="text-body-secondary small">{{s1: L.length}} daily report{{s2: L.length 1 ? 's' : ''}} in the current filters contribute to this row. Use <b>Edit report</b> to correct the counts, DCAs, date or site, then save; the MDA tables update automatically.</p><div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Date</th><th>Registration site</th><th>FTE MDA(s)</th><th class="text-end">Complete</th><th class="text-end">Pending</th><th class="text-end">Failed</th><th>DCAs</th><th>Entered by</th><th></th></tr></thead><tbody>{{s3: L.map(…)}}</tbody></table></div>`,
          [
            () => L.length,
            () => (L.length > 1 ? "s" : ""),
            () =>
              L.map((r) => {
                const ms = (r.mdas && r.mdas.length ? r.mdas : []).filter(
                    (x) => g == "site" || x.mda == k,
                  ),
                  o = ms.reduce((a, x) => a + x.ok, 0),
                  p = ms.reduce((a, x) => a + x.pend, 0),
                  f = ms.reduce((a, x) => a + x.fail, 0),
                  can = (isSubadminOrAdmin() || r.by == AUSER) && !isReviewLocked(r);
                return __tpl(
                  "fillDetailsModal.3",
                  `<tr><td>{{s1: r.date}}</td><td>{{s2: escapeHtml(r.regMda || (findSite(…}}</td><td>{{s3: escapeHtml(ms.map(…)}}</td><td class="text-end">{{s4: o}}</td><td class="text-end">{{s5: p}}</td><td class="text-end">{{s6: f}}</td><td>{{s7: r.dcas.length}}</td><td>{{s8: escapeHtml(r.by)}}</td><td class="text-nowrap">{{s9: can ? …}}</td></tr>`,
                  [
                    () => r.date,
                    () => escapeHtml(r.regMda || (findSite(r.site) || {}).mda || r.site),
                    () => escapeHtml(ms.map((x) => x.mda).join(", ") || "—"),
                    () => o,
                    () => p,
                    () => f,
                    () => r.dcas.length,
                    () => escapeHtml(r.by),
                    () =>
                      can
                        ? __tpl(
                            "fillDetailsModal.2",
                            `<button type="button" class="btn btn-sm btn-primary" data-fa="mer" data-i="{{s1: r.id}}"><i class="bx bx-edit-alt"></i> Edit report</button> {{s2: isSubadminOrAdmin() ? …}}`,
                            [
                              () => r.id,
                              () =>
                                isSubadminOrAdmin()
                                  ? __tpl(
                                      "fillDetailsModal.1",
                                      `<button type="button" class="btn btn-sm btn-outline-danger" data-fa="mdr" data-i="{{s1: r.id}}"><i class="bx bx-trash"></i></button>`,
                                      [() => r.id],
                                    )
                                  : "",
                            ],
                          )
                        : '<span class="text-body-secondary small">Not yours</span>',
                  ],
                );
              }).join(""),
          ],
        )
      : '<p class="em">No reports for this row in the current filters.</p>';
  }
  (function () {
    const m = document.getElementById("mre");
    if (!m) return;
    m.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-fa]");
      if (!b) return;
      const a = b.dataset.fa,
        i = b.dataset.i;
      if (a == "mer") {
        editingReportId = i;
        ADM.tab = "new";
        m.hidden = true;
        go();
      }
      if (a == "mdr" && isSubadminOrAdmin() && (await askConfirm("Delete this daily report?"))) {
        REPORTS = REPORTS.filter((r) => r.id != i);
        saveToStorage(REPORTS_KEY, REPORTS);
        toast("Report deleted");
        if (detailsRows(m.dataset.k, m.dataset.g, m.dataset.d).length) fillDetailsModal();
        else m.hidden = true;
        go();
      }
    });
    m.querySelector("#mre-x").onclick = () => {
      m.hidden = true;
    };
  })();
  const mdaPickerPanel = document.createElement("div");
  mdaPickerPanel.className = "ss-panel";
  mdaPickerPanel.id = "msp";
  mdaPickerPanel.hidden = true;
  mdaPickerPanel.innerHTML =
    '<input type="search" class="ss-q" placeholder="Search MDAs…" autocomplete="off"><div class="ss-l"></div>';
  document.body.appendChild(mdaPickerPanel);
  function mdaPickerList() {
    if (!wizardState) return;
    const q = mdaPickerPanel.querySelector(".ss-q").value.toLowerCase(),
      sel = wizardState.msel,
      all = [...new Set([...mdaList(), ...sel])]
        .sort((a, b) => a.localeCompare(b))
        .filter((m) => !q || m.toLowerCase().includes(q));
    mdaPickerPanel.querySelector(".ss-l").innerHTML =
      all
        .map((m) =>
          __tpl(
            "mdaPickerList.1",
            `<label class="ss-o ms-o"><input type="checkbox" data-m="{{s1: escapeHtml(m)}}"{{s2: sel.includes(m) ? ' checked' : ''}}><span>{{s3: escapeHtml(m)}}</span></label>`,
            [() => escapeHtml(m), () => (sel.includes(m) ? " checked" : ""), () => escapeHtml(m)],
          ),
        )
        .join("") || '<div class="ss-none">No match</div>';
  }
  function openMdaPickerPanel(btn) {
    const r = btn.getBoundingClientRect(),
      w = Math.max(r.width, 360),
      up = innerHeight - r.bottom < 320 && r.top > innerHeight - r.bottom;
    mdaPickerPanel.style.width = w + "px";
    mdaPickerPanel.style.left = Math.min(r.left, innerWidth - w - 8) + "px";
    if (up) {
      mdaPickerPanel.style.top = "auto";
      mdaPickerPanel.style.bottom = innerHeight - r.top + 4 + "px";
    } else {
      mdaPickerPanel.style.bottom = "auto";
      mdaPickerPanel.style.top = r.bottom + 4 + "px";
    }
    mdaPickerPanel.querySelector(".ss-q").value = "";
    mdaPickerList();
    mdaPickerPanel.hidden = false;
    mdaPickerPanel.querySelector(".ss-q").focus();
  }
  mdaPickerPanel.querySelector(".ss-q").addEventListener("input", mdaPickerList);
  mdaPickerPanel.addEventListener("change", (e) => {
    const t = e.target;
    if (!wizardState || !t.dataset.m) return;
    collectWizardInputs();
    const m = t.dataset.m;
    if (t.checked) {
      if (!wizardState.msel.includes(m)) wizardState.msel.push(m);
    } else {
      wizardState.msel = wizardState.msel.filter((x) => x != m);
      wizardState.mrows.forEach((d) =>
        d.items.forEach((x) => {
          if (x.mda == m) x.mda = "";
        }),
      );
    }
    renderWizard();
  });
  document.addEventListener(
    "mousedown",
    (e) => {
      if (!mdaPickerPanel.hidden && !e.target.closest("#msp,.ms-btn")) mdaPickerPanel.hidden = true;
    },
    true,
  );
  mdaPickerPanel.addEventListener("keydown", (e) => {
    if (e.key == "Escape") mdaPickerPanel.hidden = true;
  });
  const avatarHtml = (p, n) =>
    /^data:image\//.test(p || "")
      ? __tpl("avatarHtml.1", `<img class="av" src="{{s1: escapeHtml(p)}}" alt="">`, [
          () => escapeHtml(p),
        ])
      : __tpl(
          "avatarHtml.2",
          `<span class="av">{{s1: escapeHtml( (n || '?') .trim() .s…}}</span>`,
          [
            () =>
              escapeHtml(
                (n || "?")
                  .trim()
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase(),
              ),
          ],
        );
  const shrinkImage = (f) =>
    new Promise((ok, no) => {
      const r = new FileReader();
      r.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, 160 / Math.max(im.width, im.height)),
            c = document.createElement("canvas");
          c.width = Math.round(im.width * k);
          c.height = Math.round(im.height * k);
          c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
          ok(c.toDataURL("image/jpeg", 0.8));
        };
        im.onerror = no;
        im.src = r.result;
      };
      r.onerror = no;
      r.readAsDataURL(f);
    });
  const siteKey = (sid, n) => sid + "|" + String(n).toLowerCase(),
    isValidPhone = (p) => /^[+0-9 ()-]{6,20}$/.test(p),
    statusTagHtml = (s) =>
      __tpl(
        "statusTagHtml.1",
        `<span class="tag">{{s1: s == 'Inactive' ? 'Inactive' : 'A…}}</span>`,
        [() => (s == "Inactive" ? "Inactive" : "Active")],
      );
  const photoBox = (n) =>
    __tpl(
      "photoBox.1",
      `<label>Picture<div style="display:flex;gap:8px;align-items:center"><span id="phv">{{s1: avatarHtml(pendingPhoto, n)}}</span><input type="file" accept="image/*" data-ph="1" style="max-width:190px"><button class="btn" data-fa="phx" type="button">Remove</button></div></label>`,
      [() => avatarHtml(pendingPhoto, n)],
    );
  function dcaTable() {
    const qq = dcaSearch.toLowerCase(),
      reg = {},
      last = {};
    REPORTS.forEach((r) =>
      r.dcas.forEach((d) => {
        const k = d.name.toLowerCase();
        reg[k] = (reg[k] || 0) + (+d.n || 0);
        if (!last[k] || r.date > last[k]) last[k] = r.date;
      }),
    );
    const L = dataCollectors
      .filter(
        (x) =>
          (!dcaStatusFilter || (x.status || "Active") == dcaStatusFilter) &&
          (!qq || (x.name + " " + (x.phone || "")).toLowerCase().includes(qq)),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
    return __tpl(
      "dcaTable.5",
      `<div class="card tw"><h3>Data collectors · {{s1: L.length}}</h3>{{s2: L.length ? …}}</div>`,
      [
        () => L.length,
        () =>
          L.length
            ? __tpl(
                "dcaTable.4",
                `<table><thead><tr><th></th><th>Name</th><th>Phone</th><th>Status</th><th class="n">Total registered</th><th>Last report</th><th></th></tr></thead><tbody>{{s1: L.slice( 0, 300, ) .map(…)}}</tbody></table>{{s2: L.length 300 ? ' p class='em' Sho…}}`,
                [
                  () =>
                    L.slice(0, 300)
                      .map((x) => {
                        const k = x.name.toLowerCase();
                        return __tpl(
                          "dcaTable.3",
                          `<tr><td>{{s1: avatarHtml(x.photo, x.name)}}</td><td>{{s2: escapeHtml(x.name)}}</td><td>{{s3: escapeHtml(x.phone || '—')}}</td><td>{{s4: statusTagHtml(x.status)}}</td><td class="n">{{s5: formatNumber(reg[k] || 0)}}</td><td>{{s6: last[k] || '—'}}</td><td>{{s7: canEnter() ? …}}{{s8: isSubadminOrAdmin() ? …}}</td></tr>`,
                          [
                            () => avatarHtml(x.photo, x.name),
                            () => escapeHtml(x.name),
                            () => escapeHtml(x.phone || "—"),
                            () => statusTagHtml(x.status),
                            () => formatNumber(reg[k] || 0),
                            () => last[k] || "—",
                            () =>
                              canEnter()
                                ? __tpl(
                                    "dcaTable.1",
                                    `<button class="btn" data-fa="de" data-i="{{s1: escapeHtml(x.id)}}">Edit</button> `,
                                    [() => escapeHtml(x.id)],
                                  )
                                : "",
                            () =>
                              isSubadminOrAdmin()
                                ? __tpl(
                                    "dcaTable.2",
                                    `<button class="btn dg" data-fa="dd" data-i="{{s1: escapeHtml(x.id)}}">Delete</button>`,
                                    [() => escapeHtml(x.id)],
                                  )
                                : "",
                          ],
                        );
                      })
                      .join(""),
                  () =>
                    L.length > 300
                      ? '<p class="em">Showing the first 300 — narrow the search.</p>'
                      : "",
                ],
              )
            : '<p class="em">No data collectors match.</p>',
      ],
    );
  }
  let editingMdaName = null,
    mdaSearch = "";
  const allMdaNames = () => {
    const m = new Map();
    SITES.forEach((s) => {
      const n = String(s.mda || "").trim();
      if (n && !m.has(n.toLowerCase())) m.set(n.toLowerCase(), n);
    });
    mdaRecords.forEach((n) => {
      n = String(n || "").trim();
      if (n && !m.has(n.toLowerCase())) m.set(n.toLowerCase(), n);
    });
    return [...m.values()].sort((a, b) => a.localeCompare(b));
  };
  function mdaTable() {
    const q = mdaSearch.trim().toLowerCase(),
      reg = {};
    REPORTS.forEach((r) =>
      (r.mdas || []).forEach((m) => {
        const k = String(m.mda).toLowerCase();
        reg[k] = (reg[k] || 0) + (+m.n || 0);
      }),
    );
    const all = allMdaNames(),
      L = all.filter((n) => !q || n.toLowerCase().includes(q));
    return __tpl(
      "mdaTable.4",
      `<div class="card tw"><h3>MDAs · {{s1: L.length}}{{s2: L.length !== all.length ? …}}</h3>{{s3: L.length ? …}}</div>`,
      [
        () => L.length,
        () =>
          L.length !== all.length
            ? __tpl(
                "mdaTable.1",
                ` <small style="font-weight:400;color:var(--mu)">of {{s1: all.length}}</small>`,
                [() => all.length],
              )
            : "",
        () =>
          L.length
            ? __tpl(
                "mdaTable.3",
                `<table><thead><tr><th>MDA (ministry)</th><th class="n">Registration sites</th><th class="n">With site target</th><th class="n">Registered</th><th></th></tr></thead><tbody>{{s1: L.map(…)}}</tbody></table>`,
                [
                  () =>
                    L.map((n) => {
                      const ss = SITES.filter(
                        (s) =>
                          String(s.mda || "")
                            .trim()
                            .toLowerCase() == n.toLowerCase(),
                      );
                      return __tpl(
                        "mdaTable.2",
                        `<tr><td>{{s1: escapeHtml(n)}}</td><td class="n">{{s2: ss.length}}</td><td class="n">{{s3: ss.filter(isTargetSite).length}}</td><td class="n">{{s4: formatNumber(reg[n.toLowerCase()]…}}</td><td><button class="btn" data-fa="mae" data-i="{{s5: escapeHtml(n)}}">Edit</button> <button class="btn dng" data-fa="mad" data-i="{{s6: escapeHtml(n)}}">Delete</button></td></tr>`,
                        [
                          () => escapeHtml(n),
                          () => ss.length,
                          () => ss.filter(isTargetSite).length,
                          () => formatNumber(reg[n.toLowerCase()] || 0),
                          () => escapeHtml(n),
                          () => escapeHtml(n),
                        ],
                      );
                    }).join(""),
                ],
              )
            : '<p class="em">No MDA matches.</p>',
      ],
    );
  }
  function renderMdasView() {
    const o = editingMdaName;
    return __tpl(
      "renderMdasView.1",
      `<div class="card"><h3>{{s1: o ? 'Edit MDA: ' + escapeHtml(o)…}}</h3><div class="flt"><label>MDA name<input id="mdn" value="{{s2: escapeHtml(o || '')}}" maxlength="150" placeholder="e.g. Ministry of Health"></label></div><div class="pm" id="mde"></div><button class="btn pri" data-fa="mas">{{s3: o ? 'Save changes' : 'Add MDA'}}</button> {{s4: o ? ' button class='btn' data-fa=…}}</div>
<div class="flt"><label>Search<input id="mdq" value="{{s5: escapeHtml(mdaSearch)}}" placeholder="MDA name" oninput="window.__mq(this)"></label></div><div id="mdtab">{{s6: mdaTable()}}</div>`,
      [
        () => (o ? "Edit MDA: " + escapeHtml(o) : "Add MDA (ministry)"),
        () => escapeHtml(o || ""),
        () => (o ? "Save changes" : "Add MDA"),
        () =>
          o
            ? '<button class="btn" data-fa="max">Cancel</button>'
            : '<small style="color:var(--mu)"> Renaming an MDA updates its sites and past reports.</small>',
        () => escapeHtml(mdaSearch),
        () => mdaTable(),
      ],
    );
  }
  window.__mq = (el) => {
    mdaSearch = el.value;
    selectOne("#mdtab").innerHTML = mdaTable();
  };
  function saveMda() {
    if (!isSubadminOrAdmin()) return;
    const er = (m) => (selectOne("#mde").textContent = m),
      nm = selectOne("#mdn").value.trim().replace(/\s+/g, " ");
    if (!nm) return er("Enter the MDA name.");
    if (nm.length < 2 || nm.length > 150) return er("The MDA name must be 2 to 150 characters.");
    const low = nm.toLowerCase();
    if (
      allMdaNames().some(
        (x) =>
          x.toLowerCase() == low &&
          (!editingMdaName || x.toLowerCase() != editingMdaName.toLowerCase()),
      )
    )
      return er("This MDA already exists.");
    if (editingMdaName) {
      const old = editingMdaName.toLowerCase();
      SITES.forEach((s) => {
        if (
          String(s.mda || "")
            .trim()
            .toLowerCase() == old
        )
          s.mda = nm;
      });
      mdaRecords = mdaRecords.filter((x) => String(x).toLowerCase() != old);
      if (!mdaRecords.some((x) => String(x).toLowerCase() == low)) mdaRecords.push(nm);
      REPORTS.forEach((r) =>
        (r.mdas || []).forEach((m) => {
          if (String(m.mda).toLowerCase() == old) m.mda = nm;
        }),
      );
      saveToStorage(REPORTS_KEY, REPORTS);
      scheduleSave();
      toast("MDA updated");
    } else {
      mdaRecords.push(nm);
      toast("MDA added");
    }
    saveToStorage(MDAS_KEY, mdaRecords);
    editingMdaName = null;
    go();
  }

  /* ---------- Summary registration (MDA totals) ---------- */
  function msumRows() {
    const m = {};
    rows().forEach((r) => {
      if (r.mdas && r.mdas.length)
        r.mdas.forEach((x) => {
          const k = String(x.mda || "Not specified");
          m[k] = (m[k] || 0) + (+x.n || 0);
        });
      else {
        const k = "Not specified (older reports)";
        m[k] = (m[k] || 0) + totalDcas(r);
      }
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }
  function stBar(m, slim) {
    const p = +m.pend || 0,
      o = +m.ok || 0,
      f = +m.fail || 0,
      T = p + o + f;
    if (!T) return "";
    const w = (x) => ((x / T) * 100).toFixed(2) + "%";
    return __tpl(
      "stBar.5",
      `<span class="stb" title="Pending {{s1: p}} · Completed {{s2: o}} · Failed {{s3: f}}"><span class="stb-bar">{{s4: p ? …}}{{s5: o ? …}}{{s6: f ? …}}</span>{{s7: slim ? '' : …}}</span>`,
      [
        () => p,
        () => o,
        () => f,
        () =>
          p
            ? __tpl("stBar.1", `<i style="width:{{s1: w(p)}};background:#C5A059"></i>`, [
                () => w(p),
              ])
            : "",
        () =>
          o
            ? __tpl("stBar.2", `<i style="width:{{s1: w(o)}};background:#22a559"></i>`, [
                () => w(o),
              ])
            : "",
        () =>
          f
            ? __tpl("stBar.3", `<i style="width:{{s1: w(f)}};background:#e5484d"></i>`, [
                () => w(f),
              ])
            : "",
        () =>
          slim
            ? ""
            : __tpl(
                "stBar.4",
                `<small><b style="color:#C5A059">{{s1: p}}</b> pending · <b style="color:#22a559">{{s2: o}}</b> completed · <b style="color:#e5484d">{{s3: f}}</b> failed</small>`,
                [() => p, () => o, () => f],
              ),
      ],
    );
  }
  function mdaCell(r) {
    const ms = (r.mdas || []).slice().sort((a, b) => (+b.n || 0) - (+a.n || 0));
    if (!ms.length) return "—";
    const S = (k) => ms.reduce((a, m) => a + (+m[k] || 0), 0),
      N = S("n");
    const one =
      ms.length == 1
        ? __tpl(
            "mdaCell.1",
            `<div class="mc-1">{{s1: escapeHtml(ms[0].mda)}}: <b>{{s2: formatNumber(ms[0].n)}}</b></div>`,
            [() => escapeHtml(ms[0].mda), () => formatNumber(ms[0].n)],
          )
        : __tpl(
            "mdaCell.2",
            `<div class="mc-1"><b>{{s1: formatNumber(N)}}</b> registered · <b>{{s2: ms.length}}</b> MDAs</div>`,
            [() => formatNumber(N), () => ms.length],
          );
    const list =
      ms.length > 1
        ? __tpl(
            "mdaCell.4",
            `<details class="mc-d"><summary>Show all {{s1: ms.length}} MDAs</summary><div class="mc-l">{{s2: ms.map(…)}}</div></details>`,
            [
              () => ms.length,
              () =>
                ms
                  .map((m) =>
                    __tpl(
                      "mdaCell.3",
                      `<div class="mc-r"><span title="{{s1: escapeHtml(m.mda)}}">{{s2: escapeHtml(m.mda)}}</span><b>{{s3: formatNumber(m.n)}}</b>{{s4: stBar(m, 1)}}</div>`,
                      [
                        () => escapeHtml(m.mda),
                        () => escapeHtml(m.mda),
                        () => formatNumber(m.n),
                        () => stBar(m, 1),
                      ],
                    ),
                  )
                  .join(""),
            ],
          )
        : "";
    return __tpl(
      "mdaCell.5",
      `<div class="mc">{{s1: one}}{{s2: stBar( pend: S('pend'), ok: S('ok…}}{{s3: list}}</div>`,
      [
        () => one,
        () =>
          stBar({
            pend: S("pend"),
            ok: S("ok"),
            fail: S("fail"),
          }),
        () => list,
      ],
    );
  }
  const BAD_DEVICE_STATUSES = ["Faulty", "Damaged", "Lost / stolen"];
  let inventoryViewFilters = {
    st: "",
    q: "",
    mda: "",
  };
  function ivList() {
    const L = rows()
      .filter((r) => (r.items && r.items.length) || (r.setups && r.setups.length))
      .map((r) => {
        const s = findSite(r.site) || {},
          l = s.id != null ? siteStateAndCounty(s) : ["", ""],
          it = r.items || [],
          su = r.setups || [],
          dv = su.reduce((a, x) => a + (x.devices ? x.devices.length : x.dev ? 1 : 0), 0),
          bad =
            it.filter((x) => BAD_DEVICE_STATUSES.includes(x.st)).length +
            su.reduce(
              (a, x) =>
                a +
                (x.devices ? x.devices : x.dev ? [x] : []).filter((d) =>
                  BAD_DEVICE_STATUSES.includes(d.st),
                ).length,
              0,
            );
        return {
          r,
          st: l[0] || "",
          co: l[1] || "",
          site: s.name || "",
          mda: r.regMda || s.mda || s.name || "",
          by: r.by || "",
          qty: it.reduce((a, x) => a + (+x.n || 0), 0),
          su: su.length,
          dv,
          bad,
        };
      });
    const q = inventoryViewFilters.q.trim().toLowerCase();
    return L.filter(
      (x) =>
        (!inventoryViewFilters.mda || x.mda == inventoryViewFilters.mda) &&
        (!inventoryViewFilters.st || (inventoryViewFilters.st == "bad" ? x.bad > 0 : x.bad == 0)) &&
        (!q || [x.r.date, x.st, x.co, x.site, x.mda, x.by].join(" ").toLowerCase().includes(q)),
    ).sort((a, b) => (a.r.date < b.r.date ? 1 : a.r.date > b.r.date ? -1 : 0));
  }
  function ivTables() {
    const L = ivList(),
      T = (k) => L.reduce((a, x) => a + x[k], 0),
      C = {};
    L.forEach((x) =>
      (x.r.items || []).forEach((i) => {
        const c = (C[i.cat] = C[i.cat] || {
          n: 0,
          r: 0,
          bad: 0,
        });
        c.n += +i.n || 0;
        c.r++;
        if (BAD_DEVICE_STATUSES.includes(i.st)) c.bad += +i.n || 0;
      }),
    );
    const CC = Object.entries(C).sort((a, b) => b[1].n - a[1].n),
      G = {};
    L.forEach((x) => {
      const k = [x.mda || "—", x.site || "—"].join(" · "),
        g = (G[k] = G[k] || {});
      (x.r.items || []).forEach((i) => {
        const c = (g[i.cat] = g[i.cat] || {
          n: 0,
          bad: 0,
        });
        c.n += +i.n || 0;
        if (BAD_DEVICE_STATUSES.includes(i.st)) c.bad += +i.n || 0;
      });
    });
    const GK = Object.entries(G).sort((a, b) => a[0].localeCompare(b[0])),
      CK = Object.keys(C).sort((a, b) => {
        const ia = inventoryCategories.indexOf(a),
          ib = inventoryCategories.indexOf(b);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
      }),
      HMX = Math.max(1, ...GK.flatMap(([k, g]) => Object.values(g).map((v) => v.n))),
      kp = (l, v) =>
        __tpl("kp.6", `<div><small>{{s1: l}}</small><b>{{s2: v}}</b></div>`, [() => l, () => v]);
    return __tpl(
      "ivTables.9",
      `<div class="kp">{{s1: kp('Inventory reports', formatNum…}}{{s2: kp('Items counted', formatNumber(…}}{{s3: kp('Setups', formatNumber(T('su')…}}{{s4: kp('Devices checked', formatNumbe…}}{{s5: kp('Faults / damage', formatNumbe…}}</div>
<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span>Submitted inventory reports · {{s6: L.length}}</span>{{s7: exportButtonsHtml('all', 'msum')}}</h3>{{s8: L.length ? …}}</div>
{{s9: CC.length ? …}}`,
      [
        () => kp("Inventory reports", formatNumber(L.length)),
        () => kp("Items counted", formatNumber(T("qty"))),
        () => kp("Setups", formatNumber(T("su"))),
        () => kp("Devices checked", formatNumber(T("dv"))),
        () => kp("Faults / damage", formatNumber(T("bad"))),
        () => L.length,
        () => exportButtonsHtml("all", "msum"),
        () =>
          L.length
            ? __tpl(
                "ivTables.2",
                `<table><thead><tr><th>Date</th><th>State</th><th>County</th><th>Registration site</th><th>MDA</th><th>Entered by</th><th class="n">Items</th><th class="n">Setups</th><th class="n">Devices</th><th class="n">Faults</th><th></th></tr></thead><tbody>{{s1: L.map(…)}}</tbody><tfoot><tr class="dg"><td>TOTAL · {{s2: L.length}} report{{s3: L.length == 1 ? '' : 's'}}</td><td></td><td></td><td></td><td></td><td></td><td class="n">{{s4: formatNumber(T('qty'))}}</td><td class="n">{{s5: formatNumber(T('su'))}}</td><td class="n">{{s6: formatNumber(T('dv'))}}</td><td class="n">{{s7: formatNumber(T('bad'))}}</td><td></td></tr></tfoot></table>`,
                [
                  () =>
                    L.map((x) =>
                      __tpl(
                        "ivTables.1",
                        `<tr><td>{{s1: escapeHtml(x.r.date)}}</td><td>{{s2: escapeHtml(x.st || '—')}}</td><td>{{s3: escapeHtml(x.co || '—')}}</td><td>{{s4: escapeHtml(x.site || '—')}}</td><td>{{s5: escapeHtml(x.mda || '—')}}</td><td>{{s6: escapeHtml(x.by)}}</td><td class="n"><b>{{s7: formatNumber(x.qty)}}</b></td><td class="n">{{s8: formatNumber(x.su)}}</td><td class="n">{{s9: formatNumber(x.dv)}}</td><td class="n"{{s10: x.bad ? ' style='color:var(--r);f…}}>{{s11: formatNumber(x.bad)}}</td><td class="ac"><span class="rp-act" style="margin:0;flex-wrap:nowrap"><button type="button" class="btn" data-fa="ivv" data-i="{{s12: escapeHtml(x.r.id)}}"><i class="bx bx-show"></i> View</button><button type="button" class="btn" data-fa="ivp" data-i="{{s13: escapeHtml(x.r.id)}}"><i class="bx bx-printer"></i> Print</button></span></td></tr>`,
                        [
                          () => escapeHtml(x.r.date),
                          () => escapeHtml(x.st || "—"),
                          () => escapeHtml(x.co || "—"),
                          () => escapeHtml(x.site || "—"),
                          () => escapeHtml(x.mda || "—"),
                          () => escapeHtml(x.by),
                          () => formatNumber(x.qty),
                          () => formatNumber(x.su),
                          () => formatNumber(x.dv),
                          () => (x.bad ? ' style="color:var(--r);font-weight:700"' : ""),
                          () => formatNumber(x.bad),
                          () => escapeHtml(x.r.id),
                          () => escapeHtml(x.r.id),
                        ],
                      ),
                    ).join(""),
                  () => L.length,
                  () => (L.length == 1 ? "" : "s"),
                  () => formatNumber(T("qty")),
                  () => formatNumber(T("su")),
                  () => formatNumber(T("dv")),
                  () => formatNumber(T("bad")),
                ],
              )
            : '<p class="em">No inventory reports for these filters. Inventory is entered in step 3 of Enter daily report.</p>',
        () =>
          CC.length
            ? __tpl(
                "ivTables.8",
                `<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><span style="letter-spacing:.04em;text-transform:uppercase;font-size:.8rem;color:var(--mu)">Items by category — MDA · Site × category</span><span class="xpb"><button type="button" class="btn btn-sm btn-outline-success" data-fa="ivcx" data-f="xls"><i class="bx bxs-file-export"></i> Excel</button><button type="button" class="btn btn-sm btn-outline-secondary" data-fa="ivcx" data-f="csv"><i class="bx bx-export"></i> CSV</button><button type="button" class="btn btn-sm btn-outline-primary" data-fa="ivcx" data-f="print"><i class="bx bx-printer"></i> Print</button></span></h3><table class="ihm"><thead><tr><th>MDA · Site</th>{{s1: CK.map(…)}}<th>Total</th></tr></thead><tbody>{{s2: GK.map(…)}}</tbody><tfoot><tr class="dg"><td>TOTAL</td>{{s3: CK.map(…)}}<td><span class="hc hT">{{s4: formatNumber(CC.reduce((a, x) = a…}}</span></td></tr></tfoot></table><p class="em" style="text-align:left">Darker cells = more items. A red dot marks items that are faulty, damaged or lost.</p></div>`,
                [
                  () =>
                    CK.map((c) =>
                      __tpl(
                        "ivTables.3",
                        `<th title="{{s1: escapeHtml(c)}}">{{s2: escapeHtml(c)}}</th>`,
                        [() => escapeHtml(c), () => escapeHtml(c)],
                      ),
                    ).join(""),
                  () =>
                    GK.map(([k, g]) =>
                      __tpl(
                        "ivTables.6",
                        `<tr><td>{{s1: escapeHtml(k)}}</td>{{s2: CK.map(…)}}<td><span class="hc hT">{{s3: formatNumber(CK.reduce((a, c) = a…}}</span></td></tr>`,
                        [
                          () => escapeHtml(k),
                          () =>
                            CK.map((c) => {
                              const v = g[c];
                              return __tpl("ivTables.5", `<td>{{s1: v ? …}}</td>`, [
                                () =>
                                  v
                                    ? __tpl(
                                        "ivTables.4",
                                        `<span class="hc" style="background:color-mix(in srgb,var(--v) {{s1: Math.round(14 + Math.min(1, v.n /…}}%,transparent)"{{s2: v.bad ? …}}>{{s3: formatNumber(v.n)}}{{s4: v.bad ? ' i class='hdot' /i ' : ''}}</span>`,
                                        [
                                          () => Math.round(14 + Math.min(1, v.n / HMX) * 46),
                                          () =>
                                            v.bad
                                              ? ` title="${v.bad} faulty / damaged / lost"`
                                              : "",
                                          () => formatNumber(v.n),
                                          () => (v.bad ? '<i class="hdot"></i>' : ""),
                                        ],
                                      )
                                    : '<span class="hz">–</span>',
                              ]);
                            }).join(""),
                          () => formatNumber(CK.reduce((a, c) => a + (g[c] ? g[c].n : 0), 0)),
                        ],
                      ),
                    ).join(""),
                  () =>
                    CK.map((c) =>
                      __tpl(
                        "ivTables.7",
                        `<td><span class="hc hT">{{s1: formatNumber(C[c].n)}}{{s2: C[c].bad ? ' i class='hdot' /i '…}}</span></td>`,
                        [
                          () => formatNumber(C[c].n),
                          () => (C[c].bad ? '<i class="hdot"></i>' : ""),
                        ],
                      ),
                    ).join(""),
                  () => formatNumber(CC.reduce((a, x) => a + x[1].n, 0)),
                ],
              )
            : "",
      ],
    );
  }
  function ivMat() {
    const L = ivList(),
      C = {},
      G = {};
    L.forEach((x) => {
      const k = [x.mda || "—", x.site || "—"].join(" · "),
        g = (G[k] = G[k] || {});
      (x.r.items || []).forEach((i) => {
        C[i.cat] = 1;
        const c = (g[i.cat] = g[i.cat] || {
          n: 0,
          bad: 0,
        });
        c.n += +i.n || 0;
        if (BAD_DEVICE_STATUSES.includes(i.st)) c.bad += +i.n || 0;
      });
    });
    const CK = Object.keys(C).sort((a, b) => {
        const ia = inventoryCategories.indexOf(a),
          ib = inventoryCategories.indexOf(b);
        return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib) || a.localeCompare(b);
      }),
      GK = Object.entries(G).sort((a, b) => a[0].localeCompare(b[0]));
    const rows = GK.map(([k, g]) =>
      [k].concat(
        CK.map((c) => (g[c] ? g[c].n : 0)),
        [CK.reduce((a, c) => a + (g[c] ? g[c].n : 0), 0)],
      ),
    );
    rows.push(
      ["TOTAL"].concat(
        CK.map((c, i) => rows.reduce((a, r) => a + r[i + 1], 0)),
        [rows.reduce((a, r) => a + r[CK.length + 1], 0)],
      ),
    );
    const bad = GK.reduce((a, [k, g]) => a + CK.reduce((b, c) => b + (g[c] ? g[c].bad : 0), 0), 0);
    return {
      head: ["MDA · Site"].concat(CK, ["Total"]),
      rows,
      bad,
    };
  }
  async function ivMatOut(f) {
    const M = ivMat();
    if (M.rows.length < 2) return toast("Nothing to export");
    const day = new Date().toISOString().slice(0, 10);
    if (f == "csv") {
      const q = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"',
        txt =
          "\ufeff" +
          [M.head]
            .concat(M.rows)
            .map((r) => r.map(q).join(","))
            .join("\n"),
        a = document.createElement("a");
      a.href = URL.createObjectURL(
        new Blob([txt], {
          type: "text/csv",
        }),
      );
      a.download = "inventory-by-category-" + day + ".csv";
      a.click();
      return;
    }
    if (f == "xls") {
      try {
        const b = xlsxBytes([
            {
              name: "Items by category",
              head: M.head,
              cols: M.head.map((h, i) => (i ? Math.max(12, h.length + 4) : 44)),
              fmt: M.head.map((h, i) => (i ? 2 : 0)),
              rows: M.rows,
            },
          ]),
          a = document.createElement("a");
        a.href = URL.createObjectURL(
          new Blob([b], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
        );
        a.download = "inventory-by-category-" + day + ".xlsx";
        document.body.append(a);
        a.click();
        a.remove();
        toast("Excel report downloaded");
      } catch (x) {
        console.error(x);
        toast("Could not create the Excel file");
      }
      return;
    }
    const e = (v) =>
        String(v == null ? "" : v).replace(
          /[&<>"]/g,
          (m) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
            })[m],
        ),
      css =
        "body{font:12px Arial,sans-serif;margin:18px;color:#111}h1{font-size:18px;margin:0 0 4px}p{color:#555;margin:2px 0 10px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:5px 7px;text-align:center}th{background:#eee;font-size:10px;text-transform:uppercase}td:first-child,th:first-child{text-align:left}tr.t td{font-weight:700;background:#f3f3f3}@page{size:A4 landscape;margin:12mm}";
    const fl = [pageFilters.from + " to " + pageFilters.to, pageFilters.state, pageFilters.county]
        .filter(Boolean)
        .join(" · "),
      h = __tpl(
        "ivMatOut.4",
        `<h1>Inventory report — items by category</h1><p>{{s1: e(fl)}}{{s2: inventoryViewFilters.mda ? ' · '…}}{{s3: inventoryViewFilters.st ? ' · ' +…}}</p><table><thead><tr>{{s4: M.head.map(…)}}</tr></thead><tbody>{{s5: M.rows.map(…)}}</tbody></table><p style="margin-top:10px">Items marked faulty, damaged or lost: {{s6: M.bad}}. Printed {{s7: e(new Date().toLocaleString())}}</p>`,
        [
          () => e(fl),
          () => (inventoryViewFilters.mda ? " · " + e(inventoryViewFilters.mda) : ""),
          () =>
            inventoryViewFilters.st
              ? " · " + (inventoryViewFilters.st == "bad" ? "with faults / damage" : "no faults")
              : "",
          () =>
            M.head.map((x) => __tpl("ivMatOut.1", `<th>{{s1: e(x)}}</th>`, [() => e(x)])).join(""),
          () =>
            M.rows
              .map((r, i) =>
                __tpl(
                  "ivMatOut.3",
                  `<tr{{s1: i == M.rows.length - 1 ? ' class=…}}>{{s2: r.map(…)}}</tr>`,
                  [
                    () => (i == M.rows.length - 1 ? ' class="t"' : ""),
                    () =>
                      r
                        .map((v) => __tpl("ivMatOut.2", `<td>{{s1: e(v)}}</td>`, [() => e(v)]))
                        .join(""),
                  ],
                ),
              )
              .join(""),
          () => M.bad,
          () => e(new Date().toLocaleString()),
        ],
      );
    const fr = document.createElement("iframe");
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.append(fr);
    const d = fr.contentWindow.document;
    d.open();
    d.write(
      "<!doctype html><html><head><meta charset=utf-8><title>Inventory by category</title><style>" +
        css +
        "</style></head><body>" +
        h +
        "</body></html>",
    );
    d.close();
    setTimeout(() => {
      try {
        fr.contentWindow.focus();
        fr.contentWindow.print();
      } catch (x) {
        toast("Could not open the print dialog");
      }
      setTimeout(() => fr.remove(), 60000);
    }, 300);
  }
  function renderMdaDevicesSummaryView() {
    const ms = [
      ...new Set(
        rows()
          .filter((r) => (r.items && r.items.length) || (r.setups && r.setups.length))
          .map((r) => {
            const s = findSite(r.site) || {};
            return r.regMda || s.mda || s.name || "";
          })
          .filter(Boolean),
      ),
    ].sort();
    return (
      filt(0, 1) +
      __tpl(
        "renderMdaDevicesSummaryView.1",
        `<div class="flt tfbar"><label>Search<input id="ivr-q" value="{{s1: escapeHtml(inventoryViewFilters.q)}}" placeholder="Site, MDA, state, county, user or date" oninput="window.__ivr('q',this)"></label><label>MDA<select id="ivr-m" onchange="window.__ivr('m',this)">{{s2: optionsHtml(ms, inventoryViewFilt…}}</select></label><label>Condition<select id="ivr-s" onchange="window.__ivr('s',this)">{{s3: optionsHtml( [ ['bad', 'With faul…}}</select></label></div></div><div id="ivr-t">{{s4: ivTables()}}</div>`,
        [
          () => escapeHtml(inventoryViewFilters.q),
          () => optionsHtml(ms, inventoryViewFilters.mda, "All MDAs"),
          () =>
            optionsHtml(
              [
                ["bad", "With faults / damage"],
                ["ok", "No faults"],
              ],
              inventoryViewFilters.st,
              "All reports",
            ),
          () => ivTables(),
        ],
      )
    );
  }
  (() => {
    let tp = null;
    const get = () =>
      tp ||
      ((tp = Object.assign(document.createElement("div"), {
        id: "tipx",
      })),
      document.body.append(tp),
      tp);
    document.addEventListener("mouseover", (e) => {
      const t = e.target.closest && e.target.closest("[data-tip]");
      if (!t) return;
      const x = get();
      x.textContent = t.dataset.tip;
      x.classList.add("on");
    });
    document.addEventListener("mousemove", (e) => {
      if (!tp || !tp.classList.contains("on")) return;
      const w = tp.offsetWidth,
        h = tp.offsetHeight;
      tp.style.left = Math.min(innerWidth - w - 8, e.clientX + 14) + "px";
      tp.style.top = (e.clientY - h - 12 < 4 ? e.clientY + 18 : e.clientY - h - 12) + "px";
    });
    document.addEventListener("mouseout", (e) => {
      if (tp && e.target.closest && e.target.closest("[data-tip]")) tp.classList.remove("on");
    });
  })();
  window.__ivr = (k, el) => {
    if (k == "q") inventoryViewFilters.q = el.value;
    else if (k == "m") inventoryViewFilters.mda = el.value;
    else inventoryViewFilters.st = el.value;
    const t = document.getElementById("ivr-t");
    if (t) {
      t.innerHTML = ivTables();
      try {
        UIKIT.kick();
      } catch (x) {}
    }
  };
  function vMsumOld() {
    const R = msumRows(),
      T = R.reduce((a, x) => a + x[1], 0);
    return (
      filt() +
      __tpl(
        "vMsumOld.3",
        `<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap">Summary registration · {{s1: R.length}} MDA{{s2: R.length == 1 ? '' : 's'}}{{s3: exportButtonsHtml('all', 'msum')}}</h3>{{s4: R.length ? …}}</div>`,
        [
          () => R.length,
          () => (R.length == 1 ? "" : "s"),
          () => exportButtonsHtml("all", "msum"),
          () =>
            R.length
              ? __tpl(
                  "vMsumOld.2",
                  `<table><thead><tr><th>#</th><th>MDA (ministry)</th><th class="n">Total registration</th></tr></thead><tbody>{{s1: R.map(…)}}</tbody><tfoot><tr class="dg"><td></td><td>Total</td><td class="n">{{s2: formatNumber(T)}}</td></tr></tfoot></table>`,
                  [
                    () =>
                      R.map(([k, n], i) =>
                        __tpl(
                          "vMsumOld.1",
                          `<tr><td>{{s1: i + 1}}</td><td>{{s2: escapeHtml(k)}}</td><td class="n"><b>{{s3: formatNumber(n)}}</b></td></tr>`,
                          [() => i + 1, () => escapeHtml(k), () => formatNumber(n)],
                        ),
                      ).join(""),
                    () => formatNumber(T),
                  ],
                )
              : '<p class="em">No registrations for these filters.</p>',
        ],
      )
    );
  }

  /* ---------- Inventory ---------- */
  const INVENTORY_KEY = "bioreg.inv",
    INVENTORY_CATEGORIES_KEY = "bioreg.invcat",
    INVST = ["In stock", "Assigned", "Under repair", "Damaged", "Lost", "Retired"];
  let inventoryItems = loadFromStorage(INVENTORY_KEY, []),
    inventoryCategories = loadFromStorage(INVENTORY_CATEGORIES_KEY, null);
  if (!Array.isArray(inventoryItems)) inventoryItems = [];
  if (!Array.isArray(inventoryCategories) || !inventoryCategories.length) {
    inventoryCategories = [
      "Laptops",
      "Cameras",
      "Tripods",
      "Fingerprint Scanners",
      "Document Scanners",
      "Modems",
      "Backdrops",
      "Curtains",
      "Extension Cords",
      "Clips",
      "Stamps",
      "External Hard Drives",
      "USB Hubs",
    ];
    saveToStorage(INVENTORY_CATEGORIES_KEY, inventoryCategories);
  }
  try {
    if (!localStorage.getItem("bioreg.invcat3")) {
      const REN = {
          Laptop: "Laptops",
          Camera: "Cameras",
          "Fingerprint scanner": "Fingerprint Scanners",
          Modem: "Modems",
          Backdrop: "Backdrops",
          "White curtain": "Curtains",
          "Extension cable": "Extension Cords",
        },
        DROP = ["Tablet", "Printer", "Mobile phone", "Router", "Power bank"],
        NEW = [
          "Laptops",
          "Cameras",
          "Tripods",
          "Fingerprint Scanners",
          "Document Scanners",
          "Modems",
          "Backdrops",
          "Curtains",
          "Extension Cords",
          "Clips",
          "Stamps",
          "External Hard Drives",
          "USB Hubs",
        ];
      inventoryItems.forEach((x) => {
        if (REN[x.cat]) x.cat = REN[x.cat];
      });
      let c = inventoryCategories
        .map((x) => REN[x] || x)
        .filter((x) => !DROP.includes(x) || inventoryItems.some((y) => y.cat == x));
      NEW.forEach((n) => {
        if (!c.some((x) => String(x).toLowerCase() == n.toLowerCase())) c.push(n);
      });
      const rest = c.filter((x) => !NEW.includes(x));
      inventoryCategories = NEW.concat(rest.filter((x, i) => rest.indexOf(x) == i));
      saveToStorage(INVENTORY_CATEGORIES_KEY, inventoryCategories);
      saveToStorage(INVENTORY_KEY, inventoryItems);
      localStorage.setItem("bioreg.invcat3", "1");
    }
  } catch (e) {}
  let editingInventoryId = null,
    editingCategory = null,
    inventorySearch = "",
    inventoryFilterCategory = "",
    inventoryFilterStatus = "",
    inventoryFilterAssignee = "";
  let hiddenInventoryCategories = loadFromStorage("bioreg.invcathide", []);
  if (!Array.isArray(hiddenInventoryCategories)) hiddenInventoryCategories = [];
  const wCatOn = (c) => !hiddenInventoryCategories.includes(c);
  const icats = () => inventoryCategories.slice().sort((a, b) => a.localeCompare(b));
  const iPeople = (cur) => {
    const m = new Map();
    USERS.filter((u) => u.role == "supervisor" && u.status != "Inactive" && u.name).forEach((u) =>
      m.set(u.name, u.name + " (Supervisor)"),
    );
    dataCollectors
      .filter((d) => d.status != "Inactive" && d.name)
      .forEach((d) => {
        if (!m.has(d.name)) m.set(d.name, d.name + " (DCA)");
      });
    if (cur && !m.has(cur)) m.set(cur, cur);
    return [...m.entries()].sort((x, y) => x[0].localeCompare(y[0]));
  };
  function invRows() {
    const q = inventorySearch.trim().toLowerCase();
    return inventoryItems
      .filter(
        (x) =>
          (!inventoryFilterCategory || x.cat == inventoryFilterCategory) &&
          (!inventoryFilterStatus || x.st == inventoryFilterStatus) &&
          (!inventoryFilterAssignee ||
            (inventoryFilterAssignee == "__none" ? !x.as : x.as == inventoryFilterAssignee)) &&
          (!q ||
            (
              x.desc +
              " " +
              (x.at || "") +
              " " +
              (x.sn || "") +
              " " +
              (x.ct || "") +
              " " +
              (x.as || "") +
              " " +
              x.cat
            )
              .toLowerCase()
              .includes(q)),
      )
      .sort((a, b) => (a.dr < b.dr ? 1 : a.dr > b.dr ? -1 : 0));
  }
  function invTable() {
    const L = invRows(),
      st = {};
    inventoryItems.forEach((x) => (st[x.st] = (st[x.st] || 0) + 1));
    return __tpl(
      "invTable.5",
      `<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>Inventory · {{s1: L.length}}{{s2: L.length !== inventoryItems.lengt…}}</span>{{s3: exportButtonsHtml('all', 'inv')}}</h3>{{s4: L.length ? …}}</div>`,
      [
        () => L.length,
        () =>
          L.length !== inventoryItems.length
            ? __tpl(
                "invTable.1",
                ` <small style="font-weight:400;color:var(--mu)">of {{s1: inventoryItems.length}}</small>`,
                [() => inventoryItems.length],
              )
            : "",
        () => exportButtonsHtml("all", "inv"),
        () =>
          L.length
            ? __tpl(
                "invTable.4",
                `<table><thead><tr><th>Date received</th><th>Category</th><th>Description</th><th>Serial number</th><th>Asset tag</th><th>Company tag</th><th>Status</th><th>Assigned to</th><th></th></tr></thead><tbody>{{s1: L.map(…)}}</tbody></table>`,
                [
                  () =>
                    L.map((x) =>
                      __tpl(
                        "invTable.3",
                        `<tr><td>{{s1: escapeHtml(x.dr)}}</td><td>{{s2: escapeHtml(x.cat)}}</td><td>{{s3: escapeHtml(x.desc)}}{{s4: x.nt ? …}}</td><td>{{s5: escapeHtml(x.sn || '—')}}</td><td><b>{{s6: escapeHtml(x.at || '—')}}</b></td><td>{{s7: escapeHtml(x.ct || '—')}}</td><td>{{s8: escapeHtml(x.st)}}</td><td>{{s9: escapeHtml(x.as || '—')}}</td><td><button class="btn" data-fa="ive" data-i="{{s10: escapeHtml(x.id)}}">Edit</button> <button class="btn dng" data-fa="ivd" data-i="{{s11: escapeHtml(x.id)}}">Delete</button></td></tr>`,
                        [
                          () => escapeHtml(x.dr),
                          () => escapeHtml(x.cat),
                          () => escapeHtml(x.desc),
                          () =>
                            x.nt
                              ? __tpl(
                                  "invTable.2",
                                  `<br><small style="color:var(--mu)">{{s1: escapeHtml(x.nt)}}</small>`,
                                  [() => escapeHtml(x.nt)],
                                )
                              : "",
                          () => escapeHtml(x.sn || "—"),
                          () => escapeHtml(x.at || "—"),
                          () => escapeHtml(x.ct || "—"),
                          () => escapeHtml(x.st),
                          () => escapeHtml(x.as || "—"),
                          () => escapeHtml(x.id),
                          () => escapeHtml(x.id),
                        ],
                      ),
                    ).join(""),
                ],
              )
            : '<p class="em">No inventory items match. Add the first item above.</p>',
      ],
    );
  }
  function renderInventoryView() {
    const o = editingInventoryId ? inventoryItems.find((x) => x.id == editingInventoryId) : null;
    if (editingInventoryId && !o) editingInventoryId = null;
    const p = o || {},
      cs = icats(),
      used = (c) => inventoryItems.filter((x) => x.cat == c).length;
    return __tpl(
      "renderInventoryView.2",
      `<div class="card"><h3>{{s1: o ? 'Edit inventory item' : 'Add…}}</h3><div class="flt"><label>Category<select id="iv-cat">{{s2: optionsHtml(cs, p.cat || '', 'Sel…}}</select></label><label>Description<input id="iv-desc" value="{{s3: escapeHtml(p.desc || '')}}" maxlength="200" placeholder="e.g. Dell Latitude 5420 laptop"></label><label>Serial number<input id="iv-sn" value="{{s4: escapeHtml(p.sn || '')}}" maxlength="60"></label><label>Asset tag<input id="iv-at" value="{{s5: escapeHtml(p.at || '')}}" maxlength="40"></label><label>Company tag<input id="iv-ct" value="{{s6: escapeHtml(p.ct || '')}}" maxlength="40"></label><label>Status<select id="iv-st">{{s7: optionsHtml(INVST, p.st || 'In st…}}</select></label><label>Assigned to<select id="iv-as" data-search>{{s8: optionsHtml(iPeople(p.as), p.as |…}}</select></label><label>Date received<input id="iv-dr" type="date" value="{{s9: escapeHtml(p.dr || today())}}"></label><label>Note (optional)<input id="iv-nt" value="{{s10: escapeHtml(p.nt || '')}}" maxlength="200"></label></div><div class="pm" id="ive"></div><button class="btn pri" data-fa="ivs">{{s11: o ? 'Save changes' : 'Add item'}}</button> {{s12: o ? ' button class='btn' data-fa=…}}</div>
<div class="card"><h3>Equipment categories · {{s13: cs.length}}</h3><div class="flt"><label>{{s14: editingCategory ? 'Rename categor…}}<input id="ivc-n" value="{{s15: escapeHtml(editingCategory || '')}}" maxlength="60" placeholder="e.g. Tablet"></label><button class="btn pri" data-fa="ivca">{{s16: editingCategory ? 'Save category'…}}</button>{{s17: editingCategory ? ' button class=…}}</div><div class="pm" id="ivce"></div><table><thead><tr><th>Category</th><th class="n">Items</th><th class="n">In stock</th><th class="n">Assigned</th><th class="n">Other</th><th>Show on daily report</th><th></th></tr></thead><tbody>{{s18: cs .map(…)}}</tbody><tfoot><tr class="dg"><td>Total</td><td class="n">{{s19: inventoryItems.length}}</td><td class="n">{{s20: inventoryItems.filter((x) = x.st…}}</td><td class="n">{{s21: inventoryItems.filter((x) = x.st…}}</td><td class="n">{{s22: inventoryItems.filter((x) = x.st…}}</td><td></td><td></td></tr></tfoot></table></div>
<div class="flt tfbar"><label>Search<input id="ivq" value="{{s23: escapeHtml(inventorySearch)}}" placeholder="Description, serial, tag or user" oninput="window.__iq(this)"></label><label>Category<select id="ivfc" onchange="window.__if('c',this)">{{s24: optionsHtml(cs, inventoryFilterCa…}}</select></label><label>Status<select id="ivfs" onchange="window.__if('s',this)">{{s25: optionsHtml(INVST, inventoryFilte…}}</select></label><label>Assigned to<select id="ivfa" onchange="window.__if('a',this)">{{s26: optionsHtml([['__none', '(Not ass…}}</select></label></div><div id="ivtab">{{s27: invTable()}}</div>`,
      [
        () => (o ? "Edit inventory item" : "Add inventory item"),
        () => optionsHtml(cs, p.cat || "", "Select category"),
        () => escapeHtml(p.desc || ""),
        () => escapeHtml(p.sn || ""),
        () => escapeHtml(p.at || ""),
        () => escapeHtml(p.ct || ""),
        () => optionsHtml(INVST, p.st || "In stock"),
        () => optionsHtml(iPeople(p.as), p.as || "", "Not assigned"),
        () => escapeHtml(p.dr || today()),
        () => escapeHtml(p.nt || ""),
        () => (o ? "Save changes" : "Add item"),
        () => (o ? '<button class="btn" data-fa="ivx">Cancel</button>' : ""),
        () => cs.length,
        () => (editingCategory ? "Rename category" : "New category"),
        () => escapeHtml(editingCategory || ""),
        () => (editingCategory ? "Save category" : "Add category"),
        () => (editingCategory ? '<button class="btn" data-fa="ivcx">Cancel</button>' : ""),
        () =>
          cs
            .map((c) => {
              const L = inventoryItems.filter((x) => x.cat == c),
                a = L.filter((x) => x.st == "In stock").length,
                b = L.filter((x) => x.st == "Assigned").length;
              return __tpl(
                "renderInventoryView.1",
                `<tr><td><b>{{s1: escapeHtml(c)}}</b></td><td class="n">{{s2: L.length}}</td><td class="n">{{s3: a}}</td><td class="n">{{s4: b}}</td><td class="n">{{s5: L.length - a - b}}</td><td><label class="tgl"><input type="checkbox" role="switch" data-fa="ivcs" data-i="{{s6: escapeHtml(c)}}" {{s7: wCatOn(c) ? 'checked' : ''}} aria-label="Show {{s8: escapeHtml(c)}} on the daily report"><i></i><span>{{s9: wCatOn(c) ? 'On' : 'Off'}}</span></label></td><td><button class="btn" data-fa="ivce" data-i="{{s10: escapeHtml(c)}}">Edit</button> <button class="btn dng" data-fa="ivcd" data-i="{{s11: escapeHtml(c)}}">Delete</button></td></tr>`,
                [
                  () => escapeHtml(c),
                  () => L.length,
                  () => a,
                  () => b,
                  () => L.length - a - b,
                  () => escapeHtml(c),
                  () => (wCatOn(c) ? "checked" : ""),
                  () => escapeHtml(c),
                  () => (wCatOn(c) ? "On" : "Off"),
                  () => escapeHtml(c),
                  () => escapeHtml(c),
                ],
              );
            })
            .join(""),
        () => inventoryItems.length,
        () => inventoryItems.filter((x) => x.st == "In stock").length,
        () => inventoryItems.filter((x) => x.st == "Assigned").length,
        () => inventoryItems.filter((x) => x.st != "In stock" && x.st != "Assigned").length,
        () => escapeHtml(inventorySearch),
        () => optionsHtml(cs, inventoryFilterCategory, "All categories"),
        () => optionsHtml(INVST, inventoryFilterStatus, "All statuses"),
        () =>
          optionsHtml(
            [["__none", "(Not assigned)"]].concat(
              [...new Set(inventoryItems.map((x) => x.as).filter(Boolean))].sort(),
            ),
            inventoryFilterAssignee,
            "Everyone",
          ),
        () => invTable(),
      ],
    );
  }
  window.__iq = (el) => {
    inventorySearch = el.value;
    selectOne("#ivtab").innerHTML = invTable();
  };
  window.__if = (k, el) => {
    if (k == "c") inventoryFilterCategory = el.value;
    if (k == "s") inventoryFilterStatus = el.value;
    if (k == "a") inventoryFilterAssignee = el.value;
    selectOne("#ivtab").innerHTML = invTable();
  };
  function saveInv() {
    if (!isSubadminOrAdmin()) return;
    const er = (m) => (selectOne("#ive").textContent = m),
      v = (i) => selectOne(i).value.trim(),
      o = editingInventoryId ? inventoryItems.find((x) => x.id == editingInventoryId) : null;
    const cat = v("#iv-cat"),
      desc = v("#iv-desc").replace(/\s+/g, " "),
      at = v("#iv-at"),
      sn = v("#iv-sn"),
      ct = v("#iv-ct"),
      as = v("#iv-as"),
      dr = v("#iv-dr"),
      nt = v("#iv-nt");
    let st = v("#iv-st");
    if (!cat) return er("Select the equipment category.");
    if (desc.length < 2) return er("Enter the description (at least 2 characters).");
    if (at && inventoryItems.some((x) => x !== o && (x.at || "").toLowerCase() == at.toLowerCase()))
      return er("This asset tag is already used by another item.");
    if (sn && inventoryItems.some((x) => x !== o && (x.sn || "").toLowerCase() == sn.toLowerCase()))
      return er("This serial number is already used by another item.");
    if (ct && inventoryItems.some((x) => x !== o && (x.ct || "").toLowerCase() == ct.toLowerCase()))
      return er("This company tag is already used by another item.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dr) || isNaN(new Date(dr + "T00:00:00")))
      return er("Enter the date received (YYYY-MM-DD).");
    if (dr > today()) return er("The date received cannot be in the future.");
    if (st == "Assigned" && !as)
      return er("Select who this item is assigned to, or change the status.");
    if (as && st == "In stock") st = "Assigned";
    const it = {
      cat,
      desc,
      sn,
      at,
      ct,
      st,
      as,
      dr,
      nt,
    };
    if (o) {
      Object.assign(o, it);
      toast("Item updated");
    } else {
      inventoryItems.push(
        Object.assign(
          {
            id: newId(),
          },
          it,
        ),
      );
      toast("Item added");
    }
    saveToStorage(INVENTORY_KEY, inventoryItems);
    editingInventoryId = null;
    go();
  }
  function saveCat() {
    if (!isSubadminOrAdmin()) return;
    const er = (m) => (selectOne("#ivce").textContent = m),
      n = selectOne("#ivc-n").value.trim().replace(/\s+/g, " ");
    if (n.length < 2) return er("Enter the category name (at least 2 characters).");
    if (
      inventoryCategories.some((c) => c.toLowerCase() == n.toLowerCase() && c !== editingCategory)
    )
      return er("This category already exists.");
    if (editingCategory) {
      hiddenInventoryCategories = hiddenInventoryCategories.map((c) =>
        c === editingCategory ? n : c,
      );
      saveToStorage("bioreg.invcathide", hiddenInventoryCategories);
      inventoryCategories = inventoryCategories.map((c) => (c === editingCategory ? n : c));
      inventoryItems.forEach((x) => {
        if (x.cat === editingCategory) x.cat = n;
      });
      saveToStorage(INVENTORY_KEY, inventoryItems);
      toast("Category renamed");
    } else {
      inventoryCategories.push(n);
      toast("Category added");
    }
    saveToStorage(INVENTORY_CATEGORIES_KEY, inventoryCategories);
    editingCategory = null;
    go();
  }

  /* ---------- Deployment plan ---------- */
  const newDeploymentSite = (b) => ({
    name: "",
    total: "",
    pct: b ? b.pct : "100",
    dcas: "",
  });
  let deploymentPlanState = {
    type: "single",
    sites: [newDeploymentSite()],
    avg: "",
    max: "",
    start: "",
    res: null,
    err: "",
  };
  const DPP = [50, 60, 70, 80, 90, 100],
    dpIso = (d) =>
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0");
  const deploymentFormatDate = (d) =>
    d.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  function dpFirst(st) {
    const d = new Date(st + "T00:00:00");
    while (d.getDay() == 0 || d.getDay() == 6) d.setDate(d.getDate() + 1);
    return d;
  }
  function deploymentEndDate(st, n) {
    const d = dpFirst(st);
    let k = 1;
    while (k < n) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() != 0 && d.getDay() != 6) k++;
    }
    return d;
  }
  function collectDeploymentInputs() {
    if (!selectOne("#dp-avg")) return;
    dpCollectAdv();
    deploymentPlanState.avg = selectOne("#dp-avg").value.trim();
    deploymentPlanState.max = selectOne("#dp-max").value.trim();
    deploymentPlanState.start = selectOne("#dp-st").value.trim();
    deploymentPlanState.sites =
      deploymentPlanState.type == "adv"
        ? deploymentPlanState.sites
        : [...document.querySelectorAll("#abody .dp-r")].map((r) => ({
            name: r.querySelector(".dp-n").value.trim(),
            total: r.querySelector(".dp-t").value.trim(),
            pct: r.querySelector(".dp-p").value,
            dcas: r.querySelector(".dp-d").value.trim(),
          }));
  }
  function calculateDeploymentPlan() {
    collectDeploymentInputs();
    const bad = (m) => {
        deploymentPlanState.err = m;
        deploymentPlanState.res = null;
        go();
      },
      adv = deploymentPlanState.type == "adv";
    if (adv) {
      const bs = deploymentPlanState.groups.findIndex((g) => !g.st || !g.co);
      if (bs >= 0)
        return bad(
          "Site " +
            (bs + 1) +
            (deploymentPlanState.groups[bs].name
              ? " (" + deploymentPlanState.groups[bs].name + ")"
              : "") +
            ": select the state and the county.",
        );
      const bg = deploymentPlanState.groups.findIndex((g) => !g.ids.length);
      if (bg >= 0)
        return bad(
          "Site " +
            (bg + 1) +
            (deploymentPlanState.groups[bg].name
              ? " (" + deploymentPlanState.groups[bg].name + ")"
              : "") +
            ": select at least one MDA.",
        );
    }
    const A = adv
        ? deploymentPlanState.groups.map((g) => ({
            name: g.name,
            st: g.st,
            co: g.co,
            total: String(dpGTot(g)),
            pct: g.pct,
            dcas: g.dcas,
          }))
        : deploymentPlanState.sites,
      multi = deploymentPlanState.type != "single";
    if (deploymentPlanState.type == "multi" && A.length < 2)
      return bad("A multi-site plan needs at least two sites.");
    for (let i = 0; i < A.length; i++) {
      const s = A[i],
        l = multi ? "Site " + (i + 1) + (s.name ? " (" + s.name + ")" : "") : "The site";
      if (!/^\d+$/.test(s.total) || +s.total < 1 || +s.total > 1e7)
        return bad(l + ": enter the total number to register (1 to 10,000,000).");
      if (s.dcas && (!/^\d+$/.test(s.dcas) || +s.dcas < 1 || +s.dcas > 5000))
        return bad(l + ": the number of DCAs is optional, but if entered it must be 1 to 5,000.");
    }
    if (!/^\d+$/.test(deploymentPlanState.avg) || +deploymentPlanState.avg < 1)
      return bad("Enter the average registrations per DCA per day (a whole number, 1 or more).");
    if (
      !/^\d+$/.test(deploymentPlanState.max) ||
      +deploymentPlanState.max < +deploymentPlanState.avg
    )
      return bad(
        "Enter the maximum registrations per DCA per day (a whole number, not less than the average).",
      );
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(deploymentPlanState.start) ||
      isNaN(new Date(deploymentPlanState.start + "T00:00:00"))
    )
      return bad("Enter the start date (YYYY-MM-DD).");
    const av = +deploymentPlanState.avg,
      mx = +deploymentPlanState.max,
      start = deploymentPlanState.start,
      fd = dpFirst(start);
    const sites = A.map((s, i) => {
      const total = +s.total,
        pct = +s.pct,
        tg = Math.ceil((total * pct) / 100),
        given = !!s.dcas;
      return {
        name: s.name || (multi ? "Site " + (i + 1) : "Single site"),
        st: s.st || "",
        co: s.co || "",
        total,
        pct,
        tg,
        given,
        dcas: +s.dcas || 0,
      };
    });
    const tg = sites.reduce((a, x) => a + x.tg, 0),
      tot = sites.reduce((a, x) => a + x.total, 0);
    const scen = [
      [5, "1 week (5 working days)"],
      [10, "2 weeks (10 working days)"],
      [15, "3 weeks (15 working days)"],
      [20, "4 weeks (20 working days)"],
      [40, "8 weeks (40 working days)"],
    ].map(([D, label]) => {
      const per = sites.map((x) => Math.max(1, Math.ceil(x.tg / (D * av)))),
        perM = sites.map((x) => Math.max(1, Math.ceil(x.tg / (D * mx)))),
        days = Math.max(...sites.map((x, i) => Math.ceil(x.tg / (per[i] * av)))),
        daysM = Math.max(...sites.map((x, i) => Math.ceil(x.tg / (perM[i] * mx))));
      return {
        label,
        D,
        per,
        dcas: per.reduce((a, b) => a + b, 0),
        perM,
        dcasM: perM.reduce((a, b) => a + b, 0),
        days,
        daysM,
        fin: deploymentFormatDate(deploymentEndDate(start, days)),
        finM: deploymentFormatDate(deploymentEndDate(start, daysM)),
      };
    });
    const rec = scen[0];
    sites.forEach((x, i) => {
      x.dc = x.given ? x.dcas : rec.per[i];
      x.d = Math.ceil(x.tg / (x.dc * av));
      x.dm = Math.ceil(x.tg / (x.dc * mx));
      x.fin = deploymentFormatDate(deploymentEndDate(start, x.d));
      x.finM = deploymentFormatDate(deploymentEndDate(start, x.dm));
      x.need5 = rec.per[i];
    });
    const days = Math.max(...sites.map((x) => x.d)),
      daysM = Math.max(...sites.map((x) => x.dm)),
      dcas = sites.reduce((a, x) => a + x.dc, 0),
      allGiven = sites.every((x) => x.given),
      anyGiven = sites.some((x) => x.given);
    const one = Math.max(...sites.map((x) => Math.ceil(x.tg / av)));
    deploymentPlanState.err = "";
    deploymentPlanState.res = {
      sites,
      tg,
      tot,
      av,
      mx,
      start,
      first: deploymentFormatDate(fd),
      days,
      daysM,
      dcas,
      fin: deploymentFormatDate(deploymentEndDate(start, days)),
      finM: deploymentFormatDate(deploymentEndDate(start, daysM)),
      allGiven,
      anyGiven,
      scen,
      rec,
      one,
      oneFin: deploymentFormatDate(deploymentEndDate(start, one)),
      multi,
      adv,
    };
    go();
  }
  function dpResults() {
    const R = deploymentPlanState.res;
    if (!R) return "";
    const f = formatNumber,
      pc = R.tot ? Math.round((R.tg / R.tot) * 100) : 0;
    const kp = (l, v, s) =>
      __tpl("kp.8", `<div><small>{{s1: l}}</small><b>{{s2: v}}</b>{{s3: s ? …}}</div>`, [
        () => l,
        () => v,
        () => (s ? __tpl("kp.7", `<small>{{s1: s}}</small>`, [() => s]) : ""),
      ]);
    const basis = R.allGiven
      ? "your DCAs"
      : R.anyGiven
        ? "your DCAs where entered, otherwise the DCAs needed to finish in 1 week"
        : "the DCAs needed to finish in 1 week";
    return __tpl(
      "dpResults.3",
      `<div class="card"><h3>Recommendation</h3><div class="alert" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:10px"><b>Fastest way:</b> deploy <b>{{s1: f(R.rec.dcas)}} DCA{{s2: R.rec.dcas == 1 ? '' : 's'}}</b>{{s3: R.multi ? ' in total (' + R.sites…}} and finish in <b>{{s4: R.rec.days}} working day{{s5: R.rec.days == 1 ? '' : 's'}}</b>, from <b>{{s6: R.first}}</b> to <b>{{s7: R.rec.fin}}</b> (Monday to Friday only). If every DCA reaches the maximum of {{s8: f(R.mx)}} a day, {{s9: f(R.rec.dcasM)}} DCA{{s10: R.rec.dcasM == 1 ? '' : 's'}} would be enough.</div>
<div class="kp">{{s11: kp('Total to register', f(R.tot))}}{{s12: kp('Target to achieve', f(R.tg),…}}{{s13: kp('Working days (this plan)', R.…}}{{s14: kp('DCAs (this plan)', f(R.dcas),…}}{{s15: kp('Finish date', R.fin, 'best ca…}}</div></div>
<div class="card tw"><h3 style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><span>Plan by site</span>{{s16: exportButtonsHtml('all', 'dplan')}}</h3><table><thead><tr>{{s17: R.adv ? ' th State /th th County…}}<th>Site</th><th class="n">Total</th><th class="n">Target %</th><th class="n">To register</th><th class="n">DCAs</th><th class="n">Working days</th><th>Finish date</th></tr></thead><tbody>{{s18: R.sites.map(…)}}</tbody><tfoot><tr class="dg">{{s19: R.adv ? ' td /td td /td ' : ''}}<td>Total</td><td class="n">{{s20: f(R.tot)}}</td><td class="n">{{s21: pc}}%</td><td class="n">{{s22: f(R.tg)}}</td><td class="n">{{s23: f(R.dcas)}}</td><td class="n">{{s24: R.days}}</td><td>{{s25: R.fin}}</td></tr></tfoot></table><p class="em" style="text-align:left">Sites run side by side, so the plan finishes when the slowest site finishes. Days count Monday to Friday only; public holidays are not removed. With just one DCA per site the plan would take {{s26: R.one}} working days (until {{s27: R.oneFin}}).</p></div>`,
      [
        () => f(R.rec.dcas),
        () => (R.rec.dcas == 1 ? "" : "s"),
        () =>
          R.multi
            ? " in total (" +
              R.sites.map((x, i) => R.rec.per[i] + " at " + escapeHtml(x.name)).join(", ") +
              ")"
            : "",
        () => R.rec.days,
        () => (R.rec.days == 1 ? "" : "s"),
        () => R.first,
        () => R.rec.fin,
        () => f(R.mx),
        () => f(R.rec.dcasM),
        () => (R.rec.dcasM == 1 ? "" : "s"),
        () => kp("Total to register", f(R.tot)),
        () => kp("Target to achieve", f(R.tg), pc + "% overall"),
        () => kp("Working days (this plan)", R.days, "at " + f(R.av) + " per DCA a day"),
        () => kp("DCAs (this plan)", f(R.dcas), "basis: " + basis),
        () => kp("Finish date", R.fin, "best case " + R.finM),
        () => exportButtonsHtml("all", "dplan"),
        () => (R.adv ? "<th>State</th><th>County</th>" : ""),
        () =>
          R.sites
            .map((x) =>
              __tpl(
                "dpResults.2",
                `<tr>{{s1: R.adv ? …}}<td>{{s2: escapeHtml(x.name)}}</td><td class="n">{{s3: f(x.total)}}</td><td class="n">{{s4: x.pct}}%</td><td class="n">{{s5: f(x.tg)}}</td><td class="n">{{s6: f(x.dc)}}{{s7: x.given ? '' : ' small style='col…}}</td><td class="n">{{s8: x.d}}</td><td>{{s9: x.fin}}</td></tr>`,
                [
                  () =>
                    R.adv
                      ? __tpl(
                          "dpResults.1",
                          `<td>{{s1: escapeHtml(x.st)}}</td><td>{{s2: escapeHtml(x.co)}}</td>`,
                          [() => escapeHtml(x.st), () => escapeHtml(x.co)],
                        )
                      : "",
                  () => escapeHtml(x.name),
                  () => f(x.total),
                  () => x.pct,
                  () => f(x.tg),
                  () => f(x.dc),
                  () => (x.given ? "" : ' <small style="color:var(--mu)">calculated</small>'),
                  () => x.d,
                  () => x.fin,
                ],
              ),
            )
            .join(""),
        () => (R.adv ? "<td></td><td></td>" : ""),
        () => f(R.tot),
        () => pc,
        () => f(R.tg),
        () => f(R.dcas),
        () => R.days,
        () => R.fin,
        () => R.one,
        () => R.oneFin,
      ],
    );
  }
  function renderDeploymentPlanView() {
    if (deploymentPlanState.type == "adv") return renderDeploymentPlanAdvancedView();
    const D = deploymentPlanState;
    if (!D.start) D.start = today();
    const multi = D.type == "multi";
    const row = (s, i) =>
      __tpl(
        "row.3",
        `<div class="dp-r flt" style="align-items:end"><label>{{s1: multi ? 'Site name (optional)' :…}}<input class="dp-n" list="dpsl" value="{{s2: escapeHtml(s.name)}}" maxlength="120" onchange="window.__dpn(this)"></label><label>Total to register<input class="dp-t" type="number" min="1" value="{{s3: escapeHtml(s.total)}}"></label><label>Target to achieve<select class="dp-p">{{s4: DPP.map(…)}}</select></label><label>Number of DCAs (optional)<input class="dp-d" type="number" min="1" value="{{s5: escapeHtml(s.dcas)}}" placeholder="Calculated for you"></label>{{s6: multi D.sites.length 1 ? …}}</div>`,
        [
          () => (multi ? "Site name (optional)" : "Site name (optional)"),
          () => escapeHtml(s.name),
          () => escapeHtml(s.total),
          () =>
            DPP.map((p) =>
              __tpl(
                "row.1",
                `<option value="{{s1: p}}"{{s2: p == s.pct ? ' selected' : ''}}>{{s3: p}}%</option>`,
                [() => p, () => (p == s.pct ? " selected" : ""), () => p],
              ),
            ).join(""),
          () => escapeHtml(s.dcas),
          () =>
            multi && D.sites.length > 1
              ? __tpl(
                  "row.2",
                  `<button type="button" class="btn dng" data-fa="dpr" data-i="{{s1: i}}">Remove</button>`,
                  [() => i],
                )
              : "",
        ],
      );
    return __tpl(
      "renderDeploymentPlanView.2",
      `<div class="card"><h3>Deployment plan: how many days and DCAs?</h3>
<p style="margin:4px 0"><b>1. Single site or multiple sites?</b></p><div class="flt"><button type="button" class="btn{{s1: !multi ? ' pri' : ''}}" data-fa="dpt" data-i="single">Single site</button><button type="button" class="btn{{s2: multi ? ' pri' : ''}}" data-fa="dpt" data-i="multi">Multiple sites</button><button type="button" class="btn" data-fa="dpt" data-i="adv">Advanced states sites</button></div>
<p style="margin:10px 0 4px"><b>2. Total to register, target % and DCAs {{s3: multi ? 'for each site' : 'for th…}}</b> <small style="color:var(--mu)">(leave DCAs empty and the system works out how many are needed)</small></p><datalist id="dpsl">{{s4: SITES.filter( isTargetSite, ) .ma…}}</datalist>{{s5: D.sites.map(…)}}{{s6: multi ? ' div class='flt' button…}}
<p style="margin:10px 0 4px"><b>3. How fast does a DCA register?</b></p><div class="flt"><label>Average registrations per DCA per day<input id="dp-avg" type="number" min="1" value="{{s7: escapeHtml(D.avg)}}"></label><label>Maximum registrations per DCA per day<input id="dp-max" type="number" min="1" value="{{s8: escapeHtml(D.max)}}"></label><label>Start date<input id="dp-st" type="date" value="{{s9: escapeHtml(D.start)}}"></label></div>
<div class="pm" id="dpe">{{s10: escapeHtml(D.err)}}</div><button class="btn pri" data-fa="dpc">Calculate plan</button> <button class="btn" data-fa="dpz">Reset</button> <small style="color:var(--mu)"> Working days are Monday to Friday.</small></div>{{s11: dpResults()}}`,
      [
        () => (!multi ? " pri" : ""),
        () => (multi ? " pri" : ""),
        () => (multi ? "for each site" : "for the site"),
        () =>
          SITES.filter(isTargetSite)
            .map((s) =>
              __tpl("renderDeploymentPlanView.1", `<option value="{{s1: escapeHtml(s.name)}}">`, [
                () => escapeHtml(s.name),
              ]),
            )
            .join(""),
        () => D.sites.map(row).join(""),
        () =>
          multi
            ? '<div class="flt"><button type="button" class="btn" data-fa="dpa">+ Add another site</button></div>'
            : "",
        () => escapeHtml(D.avg),
        () => escapeHtml(D.max),
        () => escapeHtml(D.start),
        () => escapeHtml(D.err),
        () => dpResults(),
      ],
    );
  }
  window.__dpn = (el) => {
    const s = SITES.find((x) => x.name == el.value && isTargetSite(x));
    const t = el.closest(".dp-r").querySelector(".dp-t");
    if (s && t && !t.value && siteTarget(s)) t.value = siteTarget(s);
  };
  /* ---------- Deployment plan: advanced state / county sites ---------- */
  const dpMdaTot = (g, m) =>
    dpCand(g)
      .filter((s) => mdaNameOf(s) == m)
      .reduce((a, s) => a + siteTarget(s), 0);
  const dpGTot = (g) => (g.ids || []).reduce((a, m) => a + dpMdaTot(g, m), 0);
  const dpCand = (g) =>
    g.st && g.co
      ? sitesInCounty(g.st, g.co)
          .filter((x) => siteTarget(x) > 0)
          .sort((a, b) => mdaNameOf(a).localeCompare(mdaNameOf(b)) || a.name.localeCompare(b.name))
      : [];
  function dpAdvInit() {
    if (!deploymentPlanState.groups) deploymentPlanState.groups = [];
    if (!(deploymentPlanState.nn >= 1)) deploymentPlanState.nn = 2;
    while (deploymentPlanState.groups.length < deploymentPlanState.nn)
      deploymentPlanState.groups.push({
        name: "",
        st: "",
        co: "",
        ids: [],
        pct: "100",
        dcas: "",
      });
    deploymentPlanState.groups.length = deploymentPlanState.nn;
  }
  function dpCollectAdv() {
    if (deploymentPlanState.type != "adv") return;
    const g = (id) => document.getElementById(id);
    (deploymentPlanState.groups || []).forEach((x, j) => {
      const b = g("dg" + j);
      if (!b) return;
      x.name = b.querySelector(".dg-n").value.trim();
      x.st = b.querySelector(".dg-st").value;
      x.co = b.querySelector(".dg-co").value;
      x.pct = b.querySelector(".dg-p").value;
      x.dcas = b.querySelector(".dg-d").value.trim();
      x.ids = [...b.querySelectorAll(".dg-c:checked")].map((c) => c.value);
    });
  }
  function dpAdvLive() {
    dpCollectAdv();
    let all = 0;
    deploymentPlanState.groups.forEach((x, j) => {
      const b = document.getElementById("dg" + j);
      if (!b) return;
      const t = dpGTot(x);
      all += t;
      b.querySelector(".dg-tot").value = formatNumber(t);
      b.querySelector(".dg-sum").textContent =
        x.ids.length +
        " MDA" +
        (x.ids.length == 1 ? "" : "s") +
        " selected · total " +
        formatNumber(t);
    });
    deploymentPlanState.groups.forEach((x, j) => {
      const b = document.getElementById("dg" + j);
      if (!b) return;
      b.querySelectorAll(".dg-c").forEach((c) => {
        c.disabled =
          !c.checked &&
          deploymentPlanState.groups.some(
            (h, k) => k != j && h.st == x.st && h.co == x.co && h.ids.map(String).includes(c.value),
          );
      });
    });
    const a = document.getElementById("dg-all");
    if (a) a.textContent = formatNumber(all);
  }
  function renderDeploymentPlanAdvancedView() {
    const D = deploymentPlanState;
    if (!D.start) D.start = today();
    dpAdvInit();
    const block = (g, j) => {
      const cand = dpCand(g),
        mdas = [...new Set(cand.map(mdaNameOf))];
      const rows = mdas
        .map((m) => {
          const on = g.ids.map(String).includes(m),
            oth = D.groups.some(
              (h, k) => k != j && h.st == g.st && h.co == g.co && h.ids.map(String).includes(m),
            );
          return __tpl(
            "block.1",
            `<tr><td><input type="checkbox" class="dg-c" value="{{s1: escapeHtml(m)}}"{{s2: on ? ' checked' : ''}}{{s3: oth !on ? ' disabled' : ''}}></td><td>{{s4: escapeHtml(m)}}</td><td class="n">{{s5: formatNumber(dpMdaTot(g, m))}}</td></tr>`,
            [
              () => escapeHtml(m),
              () => (on ? " checked" : ""),
              () => (oth && !on ? " disabled" : ""),
              () => escapeHtml(m),
              () => formatNumber(dpMdaTot(g, m)),
            ],
          );
        })
        .join("");
      const tt = dpGTot(g);
      return __tpl(
        "block.5",
        `<div class="dg card" id="dg{{s1: j}}" style="margin:0;min-width:0"><div class="flt" style="align-items:end"><label>Site {{s2: j + 1}} name<input class="dg-n" value="{{s3: escapeHtml(g.name)}}" maxlength="120" placeholder="Name of site {{s4: j + 1}}"></label>{{s5: D.groups.length 1 ? …}}</div><div class="flt"><label>State<select class="dg-st" data-search>{{s6: optionsHtml(states(), g.st, 'Sele…}}</select></label><label>County<select class="dg-co" data-search>{{s7: optionsHtml(counties(g.st), g.co,…}}</select></label><label>Search the list<input class="dg-q" placeholder="MDA name"></label></div>
<div class="tw" style="max-height:230px;overflow:auto;margin-bottom:12px"><table data-nodt><thead><tr><th style="width:36px"></th><th>MDA</th><th class="n">Total</th></tr></thead><tbody>{{s8: cand.length ? rows : …}}</tbody></table></div>
<div class="flt" style="align-items:end"><label>Total to register (automatic)<input class="dg-tot" readonly value="{{s9: formatNumber(tt)}}"></label><label>Target to achieve<select class="dg-p">{{s10: DPP.map(…)}}</select></label><label>Number of DCAs (optional)<input class="dg-d" type="number" min="1" value="{{s11: escapeHtml(g.dcas)}}" placeholder="Auto"></label></div>
<small class="dg-sum" style="color:var(--mu)">{{s12: g.ids.length}} MDA{{s13: g.ids.length == 1 ? '' : 's'}} selected · total {{s14: formatNumber(tt)}}</small></div>`,
        [
          () => j,
          () => j + 1,
          () => escapeHtml(g.name),
          () => j + 1,
          () =>
            D.groups.length > 1
              ? __tpl(
                  "block.2",
                  `<button type="button" class="btn dng" data-fa="dgr" data-i="{{s1: j}}">Remove</button>`,
                  [() => j],
                )
              : "",
          () => optionsHtml(states(), g.st, "Select state"),
          () => optionsHtml(counties(g.st), g.co, "Select county"),
          () =>
            cand.length
              ? rows
              : __tpl(
                  "block.3",
                  `<tr><td colspan="3" class="em">{{s1: g.co ? 'No MDA with a total to re…}}</td></tr>`,
                  [
                    () =>
                      g.co
                        ? "No MDA with a total to register in this county."
                        : "Select a state and a county to list their MDAs.",
                  ],
                ),
          () => formatNumber(tt),
          () =>
            DPP.map((p) =>
              __tpl(
                "block.4",
                `<option value="{{s1: p}}"{{s2: p == g.pct ? ' selected' : ''}}>{{s3: p}}%</option>`,
                [() => p, () => (p == g.pct ? " selected" : ""), () => p],
              ),
            ).join(""),
          () => escapeHtml(g.dcas),
          () => g.ids.length,
          () => (g.ids.length == 1 ? "" : "s"),
          () => formatNumber(tt),
        ],
      );
    };
    const all = D.groups.reduce((a, g) => a + dpGTot(g), 0);
    return __tpl(
      "renderDeploymentPlanAdvancedView.1",
      `<div class="card"><h3>Deployment plan: how many days and DCAs?</h3>
<p style="margin:4px 0"><b>1. Single site or multiple sites?</b></p><div class="flt"><button type="button" class="btn" data-fa="dpt" data-i="single">Single site</button><button type="button" class="btn" data-fa="dpt" data-i="multi">Multiple sites</button><button type="button" class="btn pri" data-fa="dpt" data-i="adv">Advanced states sites</button></div>
<p style="margin:10px 0 4px"><b>2. Number of sites</b></p><div class="flt"><label>Number of sites<input id="da-n" type="number" min="1" value="{{s1: D.nn}}"></label></div>
<p style="margin:10px 0 4px"><b>3. Choose the state, county and MDAs for each site</b> <small style="color:var(--mu)">(each MDA can be used once per county; the total is added up for you · all sites: <span id="dg-all">{{s2: formatNumber(all)}}</span>)</small></p><div class="dg-grid">{{s3: D.groups.map(…)}}</div><div class="flt"><button type="button" class="btn" data-fa="dga">+ Add site</button></div>
<p style="margin:10px 0 4px"><b>4. How fast does a DCA register?</b></p><div class="flt"><label>Average registrations per DCA per day<input id="dp-avg" type="number" min="1" value="{{s4: escapeHtml(D.avg)}}"></label><label>Maximum registrations per DCA per day<input id="dp-max" type="number" min="1" value="{{s5: escapeHtml(D.max)}}"></label><label>Start date<input id="dp-st" type="date" value="{{s6: escapeHtml(D.start)}}"></label></div>
<div class="pm" id="dpe">{{s7: escapeHtml(D.err)}}</div><button class="btn pri" data-fa="dpc">Calculate plan</button> <button class="btn" data-fa="dpz">Reset</button> <small style="color:var(--mu)"> Working days are Monday to Friday.</small></div>{{s8: dpResults()}}`,
      [
        () => D.nn,
        () => formatNumber(all),
        () => D.groups.map(block).join(""),
        () => escapeHtml(D.avg),
        () => escapeHtml(D.max),
        () => escapeHtml(D.start),
        () => escapeHtml(D.err),
        () => dpResults(),
      ],
    );
  }
  document.getElementById("abody").addEventListener("change", (e) => {
    const t = e.target;
    if (deploymentPlanState.type != "adv" || ADM.tab != "dplan") return;
    const gi = t.closest && t.closest(".dg") ? +t.closest(".dg").id.slice(2) : -1;
    if (t.classList.contains("dg-st")) {
      collectDeploymentInputs();
      const g = deploymentPlanState.groups[gi];
      g.co = "";
      g.ids = [];
      deploymentPlanState.res = null;
      setTimeout(go, 60);
    } else if (t.classList.contains("dg-co")) {
      collectDeploymentInputs();
      deploymentPlanState.groups[gi].ids = [];
      deploymentPlanState.res = null;
      setTimeout(go, 60);
    } else if (t.id == "da-n") {
      collectDeploymentInputs();
      let n = Math.floor(+t.value);
      if (!(n >= 1)) n = 1;
      if (n > 500) n = 500;
      deploymentPlanState.nn = n;
      deploymentPlanState.res = null;
      setTimeout(go, 60);
    } else if (t.classList.contains("dg-c")) dpAdvLive();
  });
  document.getElementById("abody").addEventListener("input", (e) => {
    const t = e.target;
    if (!t.classList || !t.classList.contains("dg-q")) return;
    const q = t.value.trim().toLowerCase();
    t.closest(".dg")
      .querySelectorAll("tbody tr")
      .forEach((r) => {
        r.hidden = !!q && !r.textContent.toLowerCase().includes(q);
      });
  });
  /* ---------- Notifications: report submitted, daily reminder, deadlines ---------- */
  const NOTIFICATIONS_KEY = "bioreg.notif",
    NOTIFICATIONS_READ_KEY = "bioreg.notifread";
  let notifications = loadFromStorage(NOTIFICATIONS_KEY, []),
    notificationsRead = loadFromStorage(NOTIFICATIONS_READ_KEY, {}),
    ntfTop = "";
  const currentUserName = () => {
    const u = USERS.find((x) => String(x.u).toLowerCase() == String(AUSER).toLowerCase());
    return (u && u.name) || (mainAcc(AUSER) && mainAdminProfile && mainAdminProfile.name) || AUSER;
  };
  function notifyReviewed(r, ok, why) {
    if (!r.by || r.by == AUSER) return;
    const s = findSite(r.site) || {};
    notifications = loadFromStorage(NOTIFICATIONS_KEY, []);
    notifications.unshift({
      id: newId(),
      type: ok ? "rvok" : "rvno",
      at: new Date().toISOString(),
      by: AUSER,
      to: r.by,
      title: ok ? "Report accepted" : "Report rejected",
      text:
        "Your daily report for " +
        (s.name || "a site") +
        " (" +
        r.date +
        ") was " +
        (ok
          ? "accepted by " + currentUserName() + ". It is now locked."
          : "rejected by " +
            currentUserName() +
            (why ? ": " + why.replace(/[.!?]+$/, "") + "." : ".") +
            " Edit it and submit again."),
    });
    notifications = notifications.slice(0, 200);
    saveToStorage(NOTIFICATIONS_KEY, notifications);
    refreshNotifications();
  }
  function reviewLog(r, a, why) {
    (r.log = r.log || []).push({
      t: new Date().toISOString(),
      by: currentUserName(),
      a: a,
      why: why || "",
    });
  }
  function reviewHistoryHtml(i) {
    const r = REPORTS.find((x) => x.id == i);
    if (!r) return;
    const s = findSite(r.site) || {};
    let L = (r.log || []).slice();
    if (!L.length)
      L = [
        {
          t: r.at || "",
          by: r.by || "",
          a: "Submitted",
          why: "",
          old: 1,
        },
      ].concat(
        r.rvAt
          ? [
              {
                t: r.rvAt,
                by: r.rvBy || "",
                a: reviewStatus(r) == "Rejected" ? "Rejected" : "Accepted",
                why: r.rvWhy || "",
                old: 1,
              },
            ]
          : [],
      );
    showBootstrapModal(
      "Review history \u00b7 " + escapeHtml(s.name || "") + " \u00b7 " + escapeHtml(r.date),
      '<table style="width:100%"><thead><tr><th>When</th><th>Action</th><th>By</th><th>Note</th></tr></thead><tbody>' +
        L.map(
          (x) =>
            "<tr><td>" +
            escapeHtml(
              String(x.t || "")
                .replace("T", " ")
                .slice(0, 16),
            ) +
            "</td><td><b>" +
            escapeHtml(x.a) +
            "</b></td><td>" +
            escapeHtml(x.by || "") +
            "</td><td>" +
            escapeHtml(x.why || "") +
            "</td></tr>",
        ).join("") +
        "</tbody></table>" +
        (r.log
          ? ""
          : '<p style="color:var(--mu);font-size:.8rem">Reports saved before the history log was added show only their latest review.</p>'),
      '<button type="button" class="btn" data-mc="x">Close</button>',
      "modal-lg",
      (a, el, inst) => {
        if (a == "x") inst.hide();
      },
    );
  }
  function acceptReport(i) {
    if (!isSubadminOrAdmin()) return;
    const r = REPORTS.find((x) => x.id == i);
    if (!r) return;
    r.rs = "Accepted";
    r.rvBy = currentUserName();
    r.rvAt = new Date().toISOString();
    r.rvWhy = "";
    reviewLog(r, "Accepted");
    saveToStorage(REPORTS_KEY, REPORTS);
    try {
      notifyReviewed(r, true);
    } catch (x) {}
    toast("Report accepted");
    go();
  }
  function rejectReport(i) {
    if (!isSubadminOrAdmin()) return;
    const r = REPORTS.find((x) => x.id == i);
    if (!r) return;
    const s = findSite(r.site) || {};
    showBootstrapModal(
      "Reject report · " + escapeHtml(s.name || "") + " · " + escapeHtml(r.date),
      '<p style="color:var(--mu);font-size:.85rem;margin:0 0 10px">The person who submitted it (' +
        escapeHtml(r.by || "") +
        ') gets a notification with your reason and can edit and submit the report again.</p><label>Reason<textarea id="rvw" rows="3" maxlength="300" placeholder="e.g. Registration numbers do not match the DCA list" style="width:100%"></textarea></label><div class="pm" id="rve"></div>',
      '<button type="button" class="btn" data-mc="x">Cancel</button><button type="button" class="btn btn-sm btn-danger" data-mc="ok"><i class="bx bx-x"></i> Reject report</button>',
      "",
      (a, el, inst) => {
        if (a != "ok") return;
        const w = el.querySelector("#rvw").value.trim();
        if (!w) {
          el.querySelector("#rve").textContent =
            "Write a short reason so the user knows what to fix.";
          return;
        }
        r.rs = "Rejected";
        r.rvBy = currentUserName();
        r.rvAt = new Date().toISOString();
        r.rvWhy = w;
        reviewLog(r, "Rejected", w);
        saveToStorage(REPORTS_KEY, REPORTS);
        try {
          notifyReviewed(r, false, w);
        } catch (x) {}
        inst.hide();
        toast("Report rejected");
        go();
      },
    );
  }
  function notifyReportSubmitted(r, upd) {
    const s = findSite(r.site) || {},
      t = totalDcas(r),
      n = (r.dcas || []).length;
    notifications = loadFromStorage(NOTIFICATIONS_KEY, []);
    notifications.unshift({
      id: newId(),
      type: "submit",
      at: new Date().toISOString(),
      by: AUSER,
      sup: reportSupervisor(r) || "",
      title: upd ? "Daily report updated" : "Daily report submitted",
      text:
        currentUserName() +
        (upd ? " updated" : " submitted") +
        " the report for " +
        (s.name || "a site") +
        " (" +
        r.date +
        "): " +
        formatNumber(t) +
        " registered by " +
        n +
        " DCA" +
        (n == 1 ? "" : "s") +
        ".",
    });
    notifications = notifications.slice(0, 200);
    saveToStorage(NOTIFICATIONS_KEY, notifications);
    refreshNotifications();
  }
  const ntfDays = (a, b) =>
    Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 864e5);
  function notificationListHtml() {
    notifications = loadFromStorage(NOTIFICATIONS_KEY, []);
    notificationsRead = loadFromStorage(NOTIFICATIONS_READ_KEY, {});
    const R = currentRole();
    if (!R) return [];
    const me = currentUserName().toLowerCase(),
      td = today(),
      out = [];
    const mine = (s) => R != "supervisor" || String(s.sup || "").toLowerCase() == me;
    const T = SITES.filter((s) => isTargetSite(s) && mine(s)),
      reg = {};
    REPORTS.forEach((r) => {
      reg[r.site] = (reg[r.site] || 0) + totalDcas(r);
    });
    const act = T.filter(
      (s) => s.status == "Active" && (!s.open || s.open <= td) && (!s.deadline || s.deadline >= td),
    );
    if (act.length) {
      const done = new Set(REPORTS.filter((r) => r.date == td).map((r) => r.site)),
        miss = act.filter((s) => !done.has(s.id));
      out.push(
        miss.length
          ? {
              id: "rem|" + td,
              type: "rem",
              title: "Daily report due today",
              text:
                miss.length +
                " of " +
                act.length +
                " active site" +
                (act.length == 1 ? "" : "s") +
                " have not submitted today's report yet: " +
                miss
                  .slice(0, 4)
                  .map((s) => s.name)
                  .join(", ") +
                (miss.length > 4 ? " and " + (miss.length - 4) + " more" : "") +
                ".",
              go: canEnter() ? "new" : "rep",
            }
          : {
              id: "rem|" + td + "|ok",
              type: "ok",
              info: 1,
              title: "Today's reports are in",
              text:
                "All " +
                act.length +
                " active site" +
                (act.length == 1 ? "" : "s") +
                " have submitted a daily report for today.",
              go: "rep",
            },
      );
    }
    const dl = [];
    T.forEach((s) => {
      if (!s.deadline || s.status == "Closed") return;
      const d = ntfDays(td, s.deadline);
      if (d > 3) return;
      const t = tgt0(s),
        p = t ? Math.round(((reg[s.id] || 0) / t) * 100) : 0;
      const st = d < 0 ? "over" : d == 0 ? "today" : "soon";
      dl.push({
        o: d,
        n: {
          id: "dl|" + s.id + "|" + s.deadline + "|" + st,
          type: "dl" + st,
          title:
            d < 0
              ? "Deadline passed: " + s.name
              : d == 0
                ? "Deadline today: " + s.name
                : "Deadline in " + d + " day" + (d == 1 ? "" : "s") + ": " + s.name,
          text:
            (s.mda || s.name) +
            " · closing date " +
            s.deadline +
            " · registered " +
            formatNumber(reg[s.id] || 0) +
            " of " +
            formatNumber(t) +
            " (" +
            p +
            "%).",
          go: isSubadminOrAdmin() ? "targets" : "rep",
        },
      });
    });
    dl.sort((a, b) => a.o - b.o)
      .slice(0, 30)
      .forEach((x) => out.push(x.n));
    if ((R == "admin" || R == "subadmin") && window.__bkStatus) {
      const bs = window.__bkStatus();
      out.push({
        id: "bk|" + bs.key,
        type: bs.warn ? "dltoday" : "ok",
        info: bs.warn ? 0 : 1,
        title: bs.warn ? "Download a backup file" : "Backups",
        text: bs.text,
        go: "bak",
      });
    }
    notifications.forEach((n) => {
      if ((n.type == "rvok" || n.type == "rvno" || n.type == "arem") && n.to == AUSER)
        out.push({
          id: n.id,
          type: n.type == "arem" ? "rem" : n.type,
          at: n.at,
          title: n.title,
          text: n.text,
          go: n.type == "arem" ? "new" : "rep",
        });
    });
    if (R == "admin" || R == "subadmin" || R == "supervisor")
      notifications.forEach((n) => {
        if (n.by == AUSER || n.type == "rvok" || n.type == "rvno") return;
        if (R == "supervisor" && n.sup && String(n.sup).toLowerCase() != me) return;
        out.push({
          id: n.id,
          type: "submit",
          at: n.at,
          title: n.title,
          text: n.text,
          go: "rep",
        });
      });
    out.forEach((n) => {
      if (n.go && !okTabs().includes(n.go))
        n.go = okTabs().includes("myrep") ? "myrep" : okTabs()[0];
    });
    const rd = notificationsRead[AUSER] || {};
    out.forEach((n) => {
      n.un = !n.info && !rd[n.id];
    });
    return out;
  }
  const tgt0 = (s) => siteTarget(s);
  function ntfAgo(at) {
    if (!at) return "";
    const m = Math.round((Date.now() - new Date(at)) / 6e4);
    return m < 1
      ? "just now"
      : m < 60
        ? m + " min ago"
        : m < 1440
          ? Math.round(m / 60) + " h ago"
          : new Date(at).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
            });
  }
  function refreshNotifications(quiet) {
    let L = [];
    try {
      L = notificationListHtml();
    } catch (x) {}
    const c = L.filter((n) => n.un).length;
    document.querySelectorAll(".nbadge").forEach((b) => {
      b.textContent = c > 99 ? "99+" : c;
      b.hidden = !c;
    });
    const top =
      (L.find((n) => (n.type == "submit" || n.type == "rvok" || n.type == "rvno") && n.un) || {})
        .id || "";
    if (!quiet && top && top !== ntfTop && ntfTop !== null) {
      const n = L.find((x) => x.id == top);
      if (n) toast(n.title + " — " + n.text);
    }
    ntfTop = top || ntfTop || "";
    if (!document.getElementById("ntf").hidden) drawNotifications(L);
  }
  function drawNotifications(L) {
    L = L || notificationListHtml();
    const ic = {
      submit: ["bx-file", "a"],
      rvok: ["bx-check-circle", "g"],
      rvno: ["bx-x-circle", "r"],
      rem: ["bx-calendar-exclamation", "a"],
      ok: ["bx-check-circle", "g"],
      dlover: ["bx-error-circle", "r"],
      dltoday: ["bx-alarm", "r"],
      dlsoon: ["bx-time-five", "a"],
    };
    document.getElementById("ntf-l").innerHTML = L.length
      ? L.map((n, i) => {
          const c = ic[n.type] || ["bx-bell", ""];
          return __tpl(
            "drawNotifications.2",
            `<div class="ni{{s1: n.un ? ' un' : ''}}" data-i="{{s2: i}}"><span class="nc {{s3: c[1]}}"><span class="bx {{s4: c[0]}}"></span></span><div class="nb"><b>{{s5: escapeHtml(n.title)}}</b><span>{{s6: escapeHtml(n.text)}}</span>{{s7: n.at ? …}}</div></div>`,
            [
              () => (n.un ? " un" : ""),
              () => i,
              () => c[1],
              () => c[0],
              () => escapeHtml(n.title),
              () => escapeHtml(n.text),
              () =>
                n.at
                  ? __tpl("drawNotifications.1", `<small>{{s1: ntfAgo(n.at)}}</small>`, [
                      () => ntfAgo(n.at),
                    ])
                  : "",
            ],
          );
        }).join("")
      : '<div class="ne">You\'re all caught up. No notifications.</div>';
    ntfCur = L;
  }
  let ntfCur = [];
  function ntfMark(ids) {
    const rd = notificationsRead[AUSER] || {};
    ids.forEach((i) => (rd[i] = 1));
    notificationsRead[AUSER] = rd;
    saveToStorage(NOTIFICATIONS_READ_KEY, notificationsRead);
  }
  (function () {
    const p = document.createElement("div");
    p.id = "ntf";
    p.hidden = true;
    p.innerHTML =
      '<div class="nh"><b>Notifications</b><button type="button" id="ntf-all">Mark all read</button><button type="button" id="ntf-x" aria-label="Close">✕</button></div><div class="nl" id="ntf-l"></div>';
    document.body.appendChild(p);
    const open = (a) => {
      if (!AUTHED) return;
      refreshNotifications(1);
      drawNotifications();
      const r = a.getBoundingClientRect();
      p.hidden = false;
      if (innerWidth > 560) {
        const w = Math.min(400, innerWidth - 16),
          h = p.offsetHeight;
        if (r.left < innerWidth / 2) {
          p.style.left = Math.min(r.right + 10, innerWidth - w - 8) + "px";
          p.style.right = "auto";
          p.style.top = Math.max(8, Math.min(r.top, innerHeight - h - 8)) + "px";
        } else {
          p.style.right = Math.max(8, innerWidth - r.right) + "px";
          p.style.left = "auto";
          p.style.top = r.bottom + 8 + "px";
        }
      }
    };
    document.addEventListener(
      "click",
      (e) => {
        const b = e.target.closest("#nbell,#snbell");
        if (b) {
          e.preventDefault();
          e.stopPropagation();
          if (!p.hidden) {
            p.hidden = true;
            return;
          }
          open(b);
          return;
        }
        if (e.target.closest("#ntf-x")) {
          p.hidden = true;
          return;
        }
        if (e.target.closest("#ntf-all")) {
          ntfMark(ntfCur.filter((n) => !n.info).map((n) => n.id));
          refreshNotifications(1);
          return;
        }
        const it = e.target.closest("#ntf .ni");
        if (it) {
          const n = ntfCur[+it.dataset.i];
          if (n) {
            ntfMark([n.id]);
            p.hidden = true;
            refreshNotifications(1);
            openAdmin(n.go);
          }
          return;
        }
        if (!p.hidden && !p.contains(e.target)) p.hidden = true;
      },
      true,
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !p.hidden) p.hidden = true;
    });
    window.addEventListener("storage", (e) => {
      if (e.key == NOTIFICATIONS_KEY || e.key == NOTIFICATIONS_READ_KEY || e.key === null)
        refreshNotifications();
    });
    {
      const _ar = window.admRender;
      if (_ar)
        window.admRender = function () {
          const r = _ar.apply(this, arguments);
          try {
            refreshNotifications(1);
          } catch (e) {}
          return r;
        };
    }
    refreshNotifications(1);
    setTimeout(() => {
      ntfTop = null;
      refreshNotifications(1);
      ntfTop =
        (
          notificationListHtml().find(
            (n) => (n.type == "submit" || n.type == "rvok" || n.type == "rvno") && n.un,
          ) || {}
        ).id || "";
    }, 1500);
    setInterval(() => refreshNotifications(), 20000);
  })();
  function renderDcaView() {
    const o = editingDcaId ? dataCollectors.find((x) => x.id == editingDcaId) : null;
    if (editingDcaId && !o) editingDcaId = null;
    const p = o || {};
    pendingPhoto = p.photo || "";
    return __tpl(
      "renderDcaView.1",
      `<div class="card"><h3>{{s1: o ? 'Edit data collector' : 'Add…}}</h3><div class="flt"><label>Name<input id="dcn" value="{{s2: escapeHtml(p.name || '')}}"></label><label>Phone number (optional)<input id="cph" type="tel" value="{{s3: escapeHtml(p.phone || '')}}" placeholder="+211…"></label>{{s4: photoBox(p.name || '')}}<label>Status<select id="cst">{{s5: optionsHtml(['Active', 'Inactive'…}}</select></label></div><div class="pm" id="ce"></div><button class="btn pri" data-fa="dsv">{{s6: o ? 'Save changes' : 'Add DCA'}}</button> {{s7: o ? ' button class='btn' data-fa=…}}</div>
<div class="flt"><label>Search<input id="dq" value="{{s8: escapeHtml(dcaSearch)}}" placeholder="Name or phone"></label><label>Status<select id="dt">{{s9: optionsHtml(['Active', 'Inactive'…}}</select></label></div><div id="dtab">{{s10: dcaTable()}}</div>`,
      [
        () => (o ? "Edit data collector" : "Add data collector (DCA)"),
        () => escapeHtml(p.name || ""),
        () => escapeHtml(p.phone || ""),
        () => photoBox(p.name || ""),
        () => optionsHtml(["Active", "Inactive"], p.status || "Active"),
        () => (o ? "Save changes" : "Add DCA"),
        () => (o ? '<button class="btn" data-fa="dx">Cancel</button>' : ""),
        () => escapeHtml(dcaSearch),
        () => optionsHtml(["Active", "Inactive"], dcaStatusFilter, "All"),
        () => dcaTable(),
      ],
    );
  }
  function saveDca() {
    if (!canEnter()) return;
    const er = (m) => (selectOne("#ce").textContent = m),
      nm = selectOne("#dcn").value.trim(),
      ph = selectOne("#cph").value.trim(),
      o = editingDcaId ? dataCollectors.find((x) => x.id == editingDcaId) : null;
    if (!nm) return er("Enter the DCA name.");
    if (ph && !isValidPhone(ph))
      return er("Enter a valid phone number (digits, +, spaces, dashes) or leave it empty.");
    if (dataCollectors.some((x) => x.name.toLowerCase() == nm.toLowerCase() && x !== o))
      return er("This DCA already exists.");
    const pr = {
      name: nm,
      phone: ph,
      photo: pendingPhoto,
      status: selectOne("#cst").value,
    };
    if (o) {
      if (o.name != nm) {
        REPORTS.forEach((r) =>
          r.dcas.forEach((d) => {
            if (d.name.toLowerCase() == o.name.toLowerCase()) d.name = nm;
          }),
        );
        saveToStorage(REPORTS_KEY, REPORTS);
      }
      Object.assign(o, pr);
      toast("DCA updated");
    } else {
      dataCollectors.push(
        Object.assign(
          {
            id: newId(),
          },
          pr,
        ),
      );
      toast("DCA added");
    }
    saveToStorage(DCA_LIST_KEY, dataCollectors);
    editingDcaId = null;
    go();
  }
  function saveSite() {
    if (!isSubadminOrAdmin()) return;
    const er = (m) => (selectOne("#te").textContent = m),
      qv = (i) => {
        const e = selectOne(i);
        return e ? e.value : "";
      },
      f = Math.max(0, Math.floor(+qv("#tf") || 0)),
      dl = qv("#tdl"),
      od = qv("#tod"),
      dn = Math.max(0, Math.floor(+qv("#tdn") || 0)),
      sp = qv("#tsp").trim(),
      cm = qv("#tcm").trim(),
      stt = qv("#tsx") || "Active";
    const sid = editingSiteTargetId || qv("#tn"),
      s = sid ? findSite(sid) : null;
    if (!s) return er("Select the registration site: state, then county, then site name.");
    if (!f) return er("Enter the total number to be registered at this site.");
    if (od && dl && dl < od) return er("Closing date must be on or after the opening date.");
    Object.assign(
      s,
      {
        fte: f,
        deadline: dl,
        open: od,
        dcaN: dn,
        sup: sp,
        cmt: cm,
        status: stt,
        tg: 1,
      },
      selectOne("#tm") && qv("#tm") && qv("#tm") != "__none"
        ? {
            mda: qv("#tm"),
          }
        : {},
    );
    const was = !!editingSiteTargetId;
    editingSiteTargetId = null;
    scheduleSave();
    refresh();
    toast(was ? "Site target updated" : "Target added — " + s.name + " is " + stt);
    go();
  }
  async function setPw(i) {
    const v = document.querySelector(`[data-pw="${i}"]`).value;
    if (v.length < 8) return toast("Password must be at least 8 characters");
    const m = await mkAcc("x", v);
    Object.assign(
      USERS.find((x) => x.id == i),
      {
        salt: m.salt,
        alg: m.alg,
        it: m.it,
        h: m.h,
      },
    );
    saveToStorage(USERS_KEY, USERS);
    toast("Password updated");
  }
  function csv() {
    const c = (v) => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"',
      L = [
        [
          "Date",
          "State",
          "County",
          "Site",
          "MDA",
          "DCA",
          "Registered by DCA",
          "Site total that day",
          "Note",
          "Reported by",
        ]
          .map(c)
          .join(","),
      ];
    rows()
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .forEach((r) => {
        const s = findSite(r.site),
          l = s ? siteStateAndCounty(s) : ["", ""];
        r.dcas.forEach((d) =>
          L.push(
            [
              r.date,
              l[0],
              l[1],
              s ? s.name : "",
              s ? s.mda : "",
              d.name,
              d.n,
              totalDcas(r),
              r.note,
              r.by,
            ]
              .map(c)
              .join(","),
          ),
        );
      });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + L.join("\n")], {
        type: "text/csv",
      }),
    );
    a.download = `daily-registrations_${pageFilters.from}_to_${pageFilters.to}.csv`;
    a.click();
  }
  /* ---------- Sneat-style shell: profile menu, sidebar toggles, backup tab ---------- */
  const currentUserProfile = () => {
    if (!AUTHED) return null;
    if (mainAcc(AUSER))
      return {
        name: mainAdminProfile.name || getAcc().u,
        photo: mainAdminProfile.photo,
        role: "admin",
        u: AUSER,
        main: 1,
      };
    const u = USERS.find((x) => x.u.toLowerCase() == AUSER.toLowerCase());
    return {
      name: u ? u.name : AUSER,
      photo: u ? u.photo : "",
      role: currentRole(),
      u: AUSER,
      id: u && u.id,
    };
  };
  function pfHtml() {
    const m = currentUserProfile();
    if (!m)
      return __tpl(
        "pfHtml.1",
        `<button class="btn pri sn-in" data-pfa="in"><span class="bx bx-log-in"></span> Sign in</button>`,
        [],
      );
    return __tpl(
      "pfHtml.2",
      `<div class="pf-wrap"><button class="pf-btn" data-pfa="tg" title="Account menu">{{s1: avatarHtml(m.photo, m.name)}}<span class="pf-n"><b>{{s2: escapeHtml(m.name)}}</b><small>{{s3: ROLE_LABELS[m.role]}}</small></span><span class="bx bx-chevron-down"></span></button><div class="pf-menu"><div class="pf-h">{{s4: avatarHtml(m.photo, m.name)}}<div><b>{{s5: escapeHtml(m.name)}}</b><small>{{s6: ROLE_LABELS[m.role]}} · @{{s7: escapeHtml(m.u)}}</small></div></div><div class="pf-sep"></div><button class="pf-i" data-pfa="me"><span class="bx bx-user"></span>My profile</button><button class="pf-i" data-pfa="rep"><span class="bx bx-calendar-check"></span>Daily reports</button>{{s8: isSubadminOrAdmin() ? ' button cl…}}{{s9: m.main ? ' button class='pf-i' da…}}<div class="pf-sep"></div><button class="pf-i dg" data-pfa="out"><span class="bx bx-log-out"></span>Log out</button></div></div>`,
      [
        () => avatarHtml(m.photo, m.name),
        () => escapeHtml(m.name),
        () => ROLE_LABELS[m.role],
        () => avatarHtml(m.photo, m.name),
        () => escapeHtml(m.name),
        () => ROLE_LABELS[m.role],
        () => escapeHtml(m.u),
        () =>
          isSubadminOrAdmin()
            ? '<button class="pf-i" data-pfa="adm"><span class="bx bx-cog"></span>Admin panel</button><button class="pf-i" data-pfa="bak"><span class="bx bx-data"></span>Backup &amp; logo</button>'
            : "",
        () =>
          m.main
            ? '<button class="pf-i" data-pfa="acc"><span class="bx bx-lock-alt"></span>Account settings</button>'
            : "",
      ],
    );
  }
  function renderUser() {
    document.querySelectorAll(".pf-slot").forEach((e) => (e.innerHTML = pfHtml()));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pfa]");
    if (!b) {
      if (!e.target.closest(".pf-wrap"))
        document.querySelectorAll(".pf-menu.show").forEach((m) => m.classList.remove("show"));
      return;
    }
    const a = b.dataset.pfa;
    if (a == "tg") {
      const m = b.closest(".pf-wrap").querySelector(".pf-menu"),
        on = m.classList.contains("show");
      document.querySelectorAll(".pf-menu.show").forEach((x) => x.classList.remove("show"));
      if (!on) m.classList.add("show");
      return;
    }
    document.querySelectorAll(".pf-menu.show").forEach((x) => x.classList.remove("show"));
    if (a == "in") openLogin(() => {});
    if (a == "me") openProfile();
    if (a == "adm") openAdmin("dash");
    if (a == "rep") openAdmin("rep");
    if (a == "bak") openAdmin("bak");
    if (a == "acc") selectOne("#aac").click();
    if (a == "out") selectOne("#alo").click();
  });
  const originalSignedIn = window.signedIn;
  window.signedIn = function () {
    const r = originalSignedIn.apply(this, arguments);
    renderUser();
    return r;
  };
  const originalLogout = window.logout;
  window.logout = function () {
    const r = originalLogout.apply(this, arguments);
    renderUser();
    return r;
  };
  selectOne("#alo").addEventListener("click", () => setTimeout(renderUser, 0));
  const documentBody = document.body;
  try {
    if (localStorage.getItem("bioreg.sb") == "off") documentBody.classList.add("sb-off");
  } catch (x) {}
  selectOne("#sbt").onclick = () => {
    documentBody.classList.toggle("sb-off");
    try {
      localStorage.setItem("bioreg.sb", documentBody.classList.contains("sb-off") ? "off" : "on");
    } catch (x) {}
    setTimeout(() => window.dispatchEvent(new Event("resize")), 260);
  };
  selectOne("#snt").onclick = () => {
    const a = selectOne("#adm");
    if (innerWidth < 992) a.classList.toggle("menu-open");
    else a.classList.toggle("menu-off");
  };
  selectOne("#snbd").onclick = () => selectOne("#adm").classList.remove("menu-open");
  selectOne("#snth").onclick = () => selectOne("#thm").click();
  selectOne("#atabs").addEventListener("click", (e) => {
    if (e.target.closest("button")) selectOne("#adm").classList.remove("menu-open");
  });
  try {
    if (window.bootstrap)
      document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(
        (x) =>
          new bootstrap.Tooltip(x, {
            trigger: "hover",
          }),
      );
  } catch (x) {}
  /* profile modal */
  const profileDialog = document.createElement("div");
  profileDialog.id = "prof";
  profileDialog.className = "rdlg";
  profileDialog.hidden = true;
  document.body.appendChild(profileDialog);
  function openProfile() {
    const m = currentUserProfile();
    if (!m) return;
    pendingPhoto = m.photo || "";
    const u = m.main ? null : USERS.find((x) => x.id == m.id),
      p = m.main ? mainAdminProfile : u || {};
    profileDialog.innerHTML = __tpl(
      "openProfile.1",
      `<div class="pf-bx"><h3>My profile</h3>{{s1: photoBox(m.name)}}<label>Full name<input id="ppn" value="{{s2: escapeHtml(m.name)}}"></label><label>Phone number<input id="ppp" type="tel" value="{{s3: escapeHtml(p.phone || '')}}" placeholder="+211…"></label><label>Username<input value="{{s4: escapeHtml(m.u)}}" disabled></label><label>Role<input value="{{s5: ROLE_LABELS[m.role]}}" disabled></label>{{s6: m.main ? ' p style='font-size:.76…}}<div class="pm" id="ppe"></div><div class="pf-ft"><button class="btn" data-pp="x">Cancel</button><button class="btn pri" data-pp="s">Save profile</button></div></div>`,
      [
        () => photoBox(m.name),
        () => escapeHtml(m.name),
        () => escapeHtml(p.phone || ""),
        () => escapeHtml(m.u),
        () => ROLE_LABELS[m.role],
        () =>
          m.main
            ? '<p style="font-size:.76rem;color:var(--mu)">To change the administrator username or password use <b>Account settings</b> in the profile menu.</p>'
            : '<label>New password (leave blank to keep)<input id="ppw" type="password" autocomplete="new-password"></label>',
      ],
    );
    profileDialog.hidden = false;
  }
  profileDialog.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-pp],[data-fa]");
    if (e.target === profileDialog || (b && b.dataset.pp == "x")) {
      profileDialog.hidden = true;
      return;
    }
    if (!b) return;
    if (b.dataset.fa == "phx") {
      pendingPhoto = "";
      selectOne("#phv").innerHTML = avatarHtml("", selectOne("#ppn").value);
      return;
    }
    if (b.dataset.pp != "s") return;
    const m = currentUserProfile(),
      er = (t) => (selectOne("#ppe").textContent = t),
      nm = selectOne("#ppn").value.trim(),
      ph = selectOne("#ppp").value.trim();
    if (!nm) return er("Enter your name.");
    if (ph && !isValidPhone(ph)) return er("Enter a valid phone number.");
    if (m.main) {
      mainAdminProfile = Object.assign({}, mainAdminProfile, {
        name: nm,
        phone: ph,
        photo: pendingPhoto,
        status: "Active",
      });
      saveToStorage(MAIN_PROFILE_KEY, mainAdminProfile);
    } else {
      const u = USERS.find((x) => x.id == m.id);
      if (!u) return er("Your account was not found.");
      const pw = selectOne("#ppw").value;
      if (pw && pw.length < 8) return er("Password must be at least 8 characters.");
      if (pw) {
        const k = await mkAcc("x", pw);
        Object.assign(u, {
          salt: k.salt,
          alg: k.alg,
          it: k.it,
          h: k.h,
        });
      }
      Object.assign(u, {
        name: nm,
        phone: ph,
        photo: pendingPhoto,
      });
      saveToStorage(USERS_KEY, USERS);
    }
    profileDialog.hidden = true;
    renderUser();
    toast("Profile saved");
    if (selectOne("#adm") && !selectOne("#adm").hidden) admRender(true);
  });
  profileDialog.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t.dataset && t.dataset.ph)) return;
    const f = t.files[0];
    if (!f) return;
    if (!/^image\//.test(f.type) || f.size > 10e6) return toast("Choose an image under 10 MB");
    shrinkImage(f)
      .then((d) => {
        pendingPhoto = d;
        selectOne("#phv").innerHTML = avatarHtml(d, "");
      })
      .catch(() => toast("Could not read that image"));
  });
  /* backup data tab */
  function renderBackupView() {
    return __tpl(
      "renderBackupView.2",
      `<div class="g2"><div class="card"><h3><span class="bx bx-cloud-download"></span> Map &amp; registration-site backup</h3><p class="em" style="text-align:left">Counties, cities, towns, airports, roads and registration sites, including targets, dates and supervisors.</p><div class="flt"><button class="btn pri" data-fa="bkx"><span class="bx bx-download"></span> Export backup</button><button class="btn" data-fa="bki"><span class="bx bx-upload"></span> Import backup</button>{{s1: isAdmin() ? ' button class='btn d…}}</div></div>
<div class="card"><h3><span class="bx bx-data"></span> Daily reports, DCAs &amp; MDA list</h3><p class="em" style="text-align:left">Saved separately from the map backup: every daily report, the data collectors and the custom MDA list. User accounts and passwords are not included.</p><div class="flt"><button class="btn pri" data-fa="rbx"><span class="bx bx-download"></span> Export reports</button><button class="btn" data-fa="rbi"><span class="bx bx-upload"></span> Import reports</button><input type="file" id="rbf" accept=".json" hidden></div></div>{{s2: isAdmin() ? …}}</div>`,
      [
        () =>
          isAdmin()
            ? '<button class="btn dg" data-fa="bkr"><span class="bx bx-reset"></span> Reset to original</button>'
            : "",
        () =>
          isAdmin()
            ? __tpl(
                "renderBackupView.1",
                `<div class="card"><h3><span class="bx bx-image"></span> Logo &amp; company name</h3><p class="em" style="text-align:left">Choose a logo (PNG, JPG, SVG or WebP) and type your company name. They replace the logo and the name "BM Monitor" on the sign-in page, Switch view screen, top menu, admin sidebar and report covers (the logo also replaces the browser tab icon).</p><div class="flt" style="align-items:end"><label style="flex:1 1 100%;min-width:260px">Company name<input style="width:100%!important;min-width:260px!important;max-width:none!important" id="co-name" maxlength="60" placeholder="BM Monitor" value="{{s1: escapeHtml((localStorage.getItem(…}}"></label><button class="btn pri" data-fa="conm" type="button"><span class="bx bx-save"></span> Save name</button><button class="btn" data-fa="conr" type="button"><span class="bx bx-reset"></span> Use default name</button></div><div class="flt" style="align-items:center"><span class="logo" id="logo-prev" style="width:56px;height:56px;flex:none"></span><button class="btn pri" data-fa="logop" type="button"><span class="bx bx-upload"></span> Choose logo file</button><button class="btn" data-fa="logor" type="button"><span class="bx bx-reset"></span> Use default logo</button><input type="file" id="logof" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden></div></div>`,
                [() => escapeHtml((localStorage.getItem("bioreg.company") || "").trim())],
              )
            : "",
      ],
    );
  }
  function expRep() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify({
            app: "bioreg-daily",
            v: 1,
            at: new Date().toISOString(),
            reports: REPORTS,
            dcas: dataCollectors,
            mdas: mdaRecords,
          }),
        ],
        {
          type: "application/json",
        },
      ),
    );
    a.download = "bioreg-daily-reports-" + today() + ".json";
    a.click();
  }
  async function impRep(f) {
    if (!f || !isSubadminOrAdmin()) return;
    try {
      const j = JSON.parse(await f.text());
      if (
        j.app != "bioreg-daily" ||
        !Array.isArray(j.reports) ||
        !j.reports.every((r) => r && r.date && r.site && Array.isArray(r.dcas))
      )
        throw 0;
      if (
        !(await askConfirm(
          "Replace the " +
            REPORTS.length +
            " current daily reports with the " +
            j.reports.length +
            " in this file?",
          "Import",
        ))
      )
        return;
      REPORTS = j.reports;
      saveToStorage(REPORTS_KEY, REPORTS);
      if (Array.isArray(j.dcas)) {
        dataCollectors = j.dcas;
        saveToStorage(DCA_LIST_KEY, dataCollectors);
      }
      if (Array.isArray(j.mdas)) {
        mdaRecords = j.mdas;
        saveToStorage(MDAS_KEY, mdaRecords);
      }
      toast("Reports imported");
      go();
    } catch (x) {
      toast("That file is not a daily-reports backup");
    }
  }
  selectOne("#abody").addEventListener("click", (e) => {
    const b = e.target.closest("[data-fa]");
    if (!b) return;
    const a = b.dataset.fa;
    if (a == "bkx") selectOne("#aex").click();
    if (a == "bki") selectOne("#aim").click();
    if (a == "bkr" && isAdmin()) selectOne("#ars").click();
    if (a == "rbx") expRep();
    if (a == "rbi") selectOne("#rbf").click();
  });
  selectOne("#abody").addEventListener("change", (e) => {
    if (e.target.id == "rbf") {
      impRep(e.target.files[0]);
      e.target.value = "";
    }
  });
  renderUser();
})();
