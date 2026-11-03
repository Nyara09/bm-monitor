/*
 * js/activity-log-backups-alerts.js
 * Activity log, backups and alerts.
 */

/* ============================================================
   OPS ADD-ON: activity log, password reset, automatic backups, site alerts and missing-report list.
   Everything stays in this browser (localStorage / IndexedDB), like the rest of the system.
   ============================================================ */
(function () {
  "use strict";
  var LS = window.localStorage,
    rawSet = Storage.prototype.setItem,
    rawRemove = Storage.prototype.removeItem;
  var AUD = "bioreg.audit",
    UK = "bioreg.users",
    V2 = "bioreg.v2",
    RECK = "bioreg.recovery",
    LASTFILE = "bioreg.lastfile";
  var BACKUP_KEYS = [
    "bioreg.v2",
    "bioreg.reports",
    "bioreg.users",
    "bioreg.mdas",
    "bioreg.dcalist",
    "bioreg.dcap",
    "bioreg.inv",
    "bioreg.invcat",
    "bioreg.invcat3",
    "bioreg.invcathide",
    "bioreg.notif",
    "bioreg.mainprof",
    "bioreg.auth",
    "bioreg.logo",
    "bioreg.company",
    AUD,
  ];
  var E = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  };
  var Q = function (s) {
    return document.querySelector(s);
  };
  function ld(k, d) {
    try {
      return JSON.parse(LS.getItem(k)) || d;
    } catch (e) {
      return d;
    }
  }
  function who() {
    try {
      return sessionStorage.getItem("bioreg.sess") || "system";
    } catch (e) {
      return "system";
    }
  }
  function toast(m) {
    try {
      window.toast(m);
    } catch (e) {
      alert(m);
    }
  }
  function iso(d) {
    return (
      d.getFullYear() +
      "-" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(d.getDate()).padStart(2, "0")
    );
  }
  function today() {
    return iso(new Date());
  }
  function dayNo(s) {
    var p = String(s).slice(0, 10).split("-");
    return Math.round(Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5);
  }
  function role() {
    try {
      return window.__role();
    } catch (e) {
      return "";
    }
  }
  function ago(iso0) {
    var m = Math.round((Date.now() - new Date(iso0)) / 6e4);
    return m < 1
      ? "just now"
      : m < 60
        ? m + " min ago"
        : m < 1440
          ? Math.round(m / 60) + " h ago"
          : Math.round(m / 1440) + " d ago";
  }

  /* ================= 1. ACTIVITY LOG ================= */
  function log(action, kind, detail) {
    var L = ld(AUD, []);
    L.unshift({ t: new Date().toISOString(), by: who(), a: action, k: kind, d: detail || "" });
    rawSet.call(LS, AUD, JSON.stringify(L.slice(0, 2000)));
  }
  function logMany(items) {
    if (!items.length) return;
    var L = ld(AUD, []),
      t = new Date().toISOString(),
      by = who(),
      cut = items.slice(0, 40);
    if (items.length > 40)
      cut.push({
        a: "Updated",
        k: "More",
        d: "and " + (items.length - 40) + " more changes in the same save",
      });
    L = cut
      .map(function (x) {
        return { t: t, by: by, a: x.a, k: x.k, d: x.d || "" };
      })
      .concat(L);
    rawSet.call(LS, AUD, JSON.stringify(L.slice(0, 2000)));
  }
  function same(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  /* compare two lists of objects by a key; fields = names worth reporting */
  function diffList(kind, A, B, keyOf, nameOf, fields) {
    var out = [],
      ma = {},
      mb = {};
    (A || []).forEach(function (x) {
      ma[keyOf(x)] = x;
    });
    (B || []).forEach(function (x) {
      mb[keyOf(x)] = x;
    });
    Object.keys(mb).forEach(function (k) {
      if (!ma[k]) return out.push({ a: "Added", k: kind, d: nameOf(mb[k]) });
      if (same(ma[k], mb[k])) return;
      var ch = [];
      (fields || Object.keys(mb[k])).forEach(function (f) {
        if (!same(ma[k][f], mb[k][f])) {
          var o = ma[k][f],
            n = mb[k][f];
          ch.push(
            typeof o == "object" || typeof n == "object"
              ? f + " changed"
              : f +
                  ": " +
                  (o === "" || o == null ? "empty" : o) +
                  " → " +
                  (n === "" || n == null ? "empty" : n),
          );
        }
      });
      if (ch.length)
        out.push({
          a: "Updated",
          k: kind,
          d: nameOf(mb[k]) + " · " + ch.slice(0, 4).join(", ") + (ch.length > 4 ? " …" : ""),
        });
    });
    Object.keys(ma).forEach(function (k) {
      if (!mb[k]) out.push({ a: "Deleted", k: kind, d: nameOf(ma[k]) });
    });
    return out;
  }
  function diffMap(o, n) {
    var out = [];
    out = out.concat(
      diffList(
        "Registration site",
        o.SITES,
        n.SITES,
        function (s) {
          return s.id || s.name;
        },
        function (s) {
          return s.name;
        },
        [
          "name",
          "status",
          "mda",
          "fte",
          "cap",
          "sup",
          "open",
          "deadline",
          "dcaN",
          "tg",
          "lon",
          "lat",
          "note",
        ],
      ),
    );
    out = out.concat(
      diffList(
        "City / town / airport",
        o.PL,
        n.PL,
        function (p) {
          return p[0];
        },
        function (p) {
          return p[0];
        },
        null,
      ),
    );
    out = out.concat(
      diffList(
        "Road",
        o.ROADS,
        n.ROADS,
        function (r) {
          return r.name + "|" + (r.pts && r.pts[0] ? r.pts[0].join(",") : "");
        },
        function (r) {
          return r.name;
        },
        ["name", "type", "from", "to", "pts"],
      ),
    );
    out = out.concat(
      diffList(
        "County location",
        o.COUNTIES,
        n.COUNTIES,
        function (c) {
          return c.si + "|" + c.n;
        },
        function (c) {
          return c.n;
        },
        ["hq", "geo", "poly"],
      ),
    );
    (n.CTY || []).forEach(function (l, i) {
      out = out.concat(
        diffList(
          "County data",
          (o.CTY || [])[i],
          l,
          function (c) {
            return i + "|" + c.n;
          },
          function (c) {
            return c.n;
          },
          ["n", "e", "ph", "sf", "ac", "md", "rm"],
        ),
      );
    });
    return out;
  }
  function diffUsers(O, N) {
    var out = [],
      ma = {},
      me = who();
    (O || []).forEach(function (u) {
      ma[String(u.u).toLowerCase()] = u;
    });
    (N || []).forEach(function (u) {
      var k = String(u.u).toLowerCase(),
        o = ma[k];
      if (!o) return out.push({ a: "Added", k: "User", d: u.u + " · " + u.role });
      var ch = [];
      if (o.role !== u.role) ch.push("role: " + o.role + " → " + u.role);
      if ((o.status || "Active") !== (u.status || "Active"))
        ch.push("status: " + (o.status || "Active") + " → " + (u.status || "Active"));
      if (o.name !== u.name) ch.push("name changed");
      if (o.phone !== u.phone) ch.push("phone changed");
      if (!same(o.perms, u.perms)) ch.push("page permissions changed");
      if (!same(o.cards, u.cards)) ch.push("Switch view cards changed");
      if (o.h !== u.h)
        ch.push(
          String(u.u).toLowerCase() === String(me).toLowerCase()
            ? "password changed"
            : "password reset by administrator",
        );
      if (ch.length) out.push({ a: "Updated", k: "User", d: u.u + " · " + ch.join(", ") });
      delete ma[k];
    });
    Object.keys(ma).forEach(function (k) {
      out.push({ a: "Deleted", k: "User", d: ma[k].u });
    });
    return out;
  }
  var LABEL = {
    "bioreg.mdas": "MDA list",
    "bioreg.dcalist": "Data collector (DCA)",
    "bioreg.inv": "Inventory",
    "bioreg.invcat": "Inventory categories",
    "bioreg.mainprof": "Main account profile",
  };
  function byId(kind, nameOf, O, N) {
    return diffList(
      kind,
      O,
      N,
      function (x) {
        return x.id || x.name || JSON.stringify(x);
      },
      nameOf,
      null,
    );
  }
  function audit(key, oldRaw, newRaw) {
    try {
      var O = oldRaw ? JSON.parse(oldRaw) : null,
        N = JSON.parse(newRaw);
      if (key === V2)
        return logMany(
          O ? diffMap(O, N) : [{ a: "Updated", k: "Map data", d: "first saved change" }],
        );
      if (key === UK) return logMany(diffUsers(O, N));
      if (key === "bioreg.company")
        return log(N ? "Updated" : "Reset", "Company name", String(N || "default"));
      if (key === "bioreg.logo") return;
      if (LABEL[key] && Array.isArray(N))
        return logMany(
          byId(
            LABEL[key],
            function (x) {
              return x.name || x.title || x.desc || x.id || "item";
            },
            O || [],
            N,
          ),
        );
    } catch (e) {}
  }
  /* before a users list is saved: flag passwords set by someone else as temporary ("must change") */
  function usersGuard(oldRaw, newRaw) {
    try {
      var O = oldRaw ? JSON.parse(oldRaw) : [],
        N = JSON.parse(newRaw),
        me = String(who()).toLowerCase(),
        ma = {},
        live = {},
        ch = false;
      O.forEach(function (u) {
        ma[String(u.u).toLowerCase()] = u;
      });
      try {
        (window.__users() || []).forEach(function (u) {
          live[String(u.u).toLowerCase()] = u;
        });
      } catch (e) {}
      N.forEach(function (u) {
        var k = String(u.u).toLowerCase(),
          o = ma[k];
        if (u.must === undefined && o && o.must && o.h === u.h) {
          u.must = true;
          ch = true;
        }
        if (u.must === undefined && (!o || o.h !== u.h) && k !== me) {
          u.must = true;
          ch = true;
        }
        if (u.must && live[k]) live[k].must = true;
      });
      return ch ? JSON.stringify(N) : newRaw;
    } catch (e) {
      return newRaw;
    }
  }
  Storage.prototype.setItem = function (k, v) {
    if (this === LS) {
      var old = null;
      if (k === UK || k === V2 || k === "bioreg.company" || LABEL[k]) old = LS.getItem(k);
      if (k === UK) v = usersGuard(old, v);
      rawSet.call(this, k, v);
      if (old !== v && (k === UK || k === V2 || k === "bioreg.company" || LABEL[k]))
        audit(k, old, v);
      return;
    }
    rawSet.call(this, k, v);
  };
  Storage.prototype.removeItem = function (k) {
    if (this === LS && k === "bioreg.company") log("Reset", "Company name", "default");
    rawRemove.call(this, k);
  };
  var si = window.signedIn;
  if (typeof si === "function")
    window.signedIn = function (u) {
      var r = si.apply(this, arguments);
      log("Signed in", "Session", u);
      setTimeout(mustCheck, 400);
      return r;
    };
  var lo = window.logout;
  if (typeof lo === "function")
    window.logout = function () {
      var w = who();
      log("Signed out", "Session", w);
      return lo.apply(this, arguments);
    };

  function ruleCard() {
    var r = Object.assign({ days: 3, mode: "reason" }, ld("bioreg.bdrule", {}));
    return (
      '<div class="card" id="bd-card"><h3><span class="bx bx-calendar-x"></span> Daily report date rule</h3>' +
      '<p class="em" style="text-align:left">Controls how far back a supervisor or sub admin can enter a daily report. Administrators are not limited. Late entries are marked in the report\'s review history.</p>' +
      '<div class="flt" style="align-items:end"><label>When the date is older than<input id="bd-d" type="number" min="0" max="365" value="' +
      r.days +
      '" style="width:100px"></label><label>days, then<select id="bd-m">' +
      [
        ["reason", "ask for a reason"],
        ["block", "do not allow it"],
        ["off", "no limit (any past date)"],
      ]
        .map(function (o) {
          return (
            '<option value="' +
            o[0] +
            '"' +
            (o[0] === r.mode ? " selected" : "") +
            ">" +
            o[1] +
            "</option>"
          );
        })
        .join("") +
      '</select></label><button class="btn pri" data-fa="bds" type="button"><span class="bx bx-save"></span> Save rule</button></div></div>'
    );
  }
  function auditCard() {
    var L = ld(AUD, []),
      kinds = {};
    L.forEach(function (x) {
      kinds[x.k] = 1;
    });
    return (
      '<div class="card" id="aud-card"><h3><span class="bx bx-history"></span> Activity log</h3>' +
      '<p class="em" style="text-align:left">Who changed users, permissions, registration sites, site targets and map data, and when. Daily reports keep their own review history. Newest first, last 2,000 changes.</p>' +
      '<div class="flt" style="align-items:end"><label style="min-width:220px">Search<input id="aud-q" placeholder="Person, action or item"></label>' +
      '<label>Type<select id="aud-k"><option value="">All types</option>' +
      Object.keys(kinds)
        .sort()
        .map(function (k) {
          return "<option>" + E(k) + "</option>";
        })
        .join("") +
      "</select></label>" +
      '<button class="btn" data-fa="audx" type="button"><span class="bx bx-download"></span> Export CSV</button>' +
      (role() === "admin"
        ? '<button class="btn dg" data-fa="audc" type="button"><span class="bx bx-trash"></span> Clear log</button>'
        : "") +
      "</div>" +
      '<div style="max-height:360px;overflow:auto"><table class="opt"><thead><tr><th>When</th><th>Who</th><th>Action</th><th>Type</th><th>Details</th></tr></thead><tbody id="aud-b">' +
      (L.length
        ? L.slice(0, 300)
            .map(function (x) {
              return (
                '<tr data-k="' +
                E(x.k) +
                '"><td>' +
                E(
                  new Date(x.t).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                ) +
                "</td><td>" +
                E(x.by) +
                "</td><td>" +
                E(x.a) +
                "</td><td>" +
                E(x.k) +
                "</td><td>" +
                E(x.d) +
                "</td></tr>"
              );
            })
            .join("")
        : '<tr><td colspan="5" class="em">No changes recorded yet.</td></tr>') +
      "</tbody></table></div></div>"
    );
  }
  function auditFilter() {
    var q = ((Q("#aud-q") || {}).value || "").toLowerCase(),
      k = (Q("#aud-k") || {}).value || "";
    document.querySelectorAll("#aud-b tr").forEach(function (r) {
      r.hidden = !!((k && r.dataset.k !== k) || (q && r.textContent.toLowerCase().indexOf(q) < 0));
    });
  }
  function dl(name, text, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type || "application/json" }));
    a.download = name;
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 2000);
  }

  /* ================= 2. PASSWORD RESET ================= */
  function dlg(html) {
    var d = Q("#pwf");
    if (!d) {
      d = document.createElement("div");
      d.id = "pwf";
      d.className = "rdlg";
      d.style.zIndex = 100000;
      document.body.appendChild(d);
    }
    d.innerHTML = '<div class="box" style="max-width:420px">' + html + "</div>";
    d.hidden = false;
    return d;
  }
  function closeDlg() {
    var d = Q("#pwf");
    if (d) d.hidden = true;
  }
  function pwForm(title, intro, extra, btn, cancel) {
    return (
      "<h3>" +
      title +
      '</h3><p class="pm">' +
      intro +
      "</p>" +
      extra +
      '<label>New password<input id="pw-n" type="password" autocomplete="new-password"></label><label>Confirm new password<input id="pw-c" type="password" autocomplete="new-password"></label>' +
      '<p class="pm" id="pw-e" style="color:#B3261E;min-height:1.2em"></p><div class="row2 sp"><span style="flex:1"></span>' +
      (cancel ? '<button class="btn" id="pw-x" type="button">Cancel</button>' : "") +
      '<button class="btn pri" id="pw-go" type="button">' +
      btn +
      "</button></div>"
    );
  }
  function pwCheck() {
    var n = Q("#pw-n").value,
      c = Q("#pw-c").value,
      e = Q("#pw-e");
    if (n.length < 8) {
      e.textContent = "Password must be at least 8 characters.";
      return null;
    }
    if (n !== c) {
      e.textContent = "The two passwords do not match.";
      return null;
    }
    return n;
  }
  function mustCheck() {
    try {
      if (!window.AUTHED && typeof AUTHED === "undefined") return;
      if (!AUTHED) return;
      var u = (window.__users() || []).find(function (x) {
        return String(x.u).toLowerCase() === String(AUSER).toLowerCase();
      });
      if (u && u.must) mustDialog(u);
    } catch (e) {}
  }
  function mustDialog(u) {
    dlg(
      pwForm(
        "Set a new password",
        "Your administrator reset your password. Choose a new password to continue.",
        "",
        "Save and continue",
        false,
      ),
    );
    Q("#pw-go").onclick = async function () {
      var n = pwCheck();
      if (!n) return;
      var m = await mkAcc("x", n);
      Object.assign(u, { salt: m.salt, alg: m.alg, it: m.it, h: m.h, must: false });
      window.__saveUsers();
      closeDlg();
      toast("Password changed");
      log("Updated", "User", u.u + " · changed the temporary password");
    };
  }
  function recoverDialog() {
    var has = !!LS.getItem(RECK);
    dlg(
      pwForm(
        "Forgot your password?",
        "Regular users: ask your administrator to reset your password; you will be asked to choose a new one when you sign in. " +
          "The main administrator can use the recovery code created in Account settings." +
          (has ? "" : " No recovery code has been created on this computer yet."),
        '<label>Administrator username<input id="rc-u" autocomplete="username"></label><label>Recovery code<input id="rc-c" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off"></label>',
        "Reset password",
        true,
      ),
    );
    Q("#pw-x").onclick = closeDlg;
    var fails = 0,
      lock = 0;
    Q("#pw-go").onclick = async function () {
      var e = Q("#pw-e"),
        acc = getAcc(),
        rec = ld(RECK, null),
        u = Q("#rc-u").value.trim();
      if (Date.now() < lock) {
        e.textContent = "Too many attempts. Wait a few seconds.";
        return;
      }
      var n = pwCheck();
      if (!n) return;
      var code = Q("#rc-c")
        .value.toUpperCase()
        .replace(/[^A-Z0-9]/g, "");
      var ok = acc && rec && u.toLowerCase() === acc.u.toLowerCase() && (await checkPw(rec, code));
      if (!ok) {
        if (++fails >= 5) {
          lock = Date.now() + 30000;
          fails = 0;
        }
        e.textContent = "Username or recovery code is not correct.";
        return;
      }
      var a = await mkAcc(acc.u, n);
      LS.setItem("bioreg.auth", JSON.stringify(a));
      rawRemove.call(LS, RECK);
      closeDlg();
      log("Updated", "User", acc.u + " · password reset with the recovery code");
      signedIn(acc.u);
      toast("Password changed. Create a new recovery code in Account settings.");
    };
  }
  function initLogin() {
    var go = Q("#lg-go");
    if (go && !Q("#lg-forgot")) {
      var b = document.createElement("button");
      b.type = "button";
      b.id = "lg-forgot";
      b.className = "lg-back";
      b.textContent = "Forgot password?";
      b.style.marginTop = "6px";
      go.parentNode.insertBefore(b, go.nextSibling);
      b.onclick = recoverDialog;
    }
    var ac = Q("#ac-go");
    if (ac && !Q("#rc-box")) {
      var d = document.createElement("div");
      d.id = "rc-box";
      d.style.cssText = "margin-top:12px;padding-top:10px;border-top:1px solid var(--line)";
      d.innerHTML =
        '<b style="font-size:.85rem">Recovery code</b><p class="pm" style="margin:4px 0 8px">If you forget your password, this code lets you set a new one. Enter your current password above, then create a code and keep it somewhere safe. Creating a new code cancels the old one.</p>' +
        '<button class="btn" id="rc-make" type="button">Create recovery code</button><div id="rc-out" style="margin-top:8px;font:700 1.05rem monospace;letter-spacing:.06em"></div>';
      ac.parentNode.insertBefore(d, ac);
      Q("#rc-make").onclick = async function () {
        var e = Q("#ac-e"),
          out = Q("#rc-out");
        if (!(await checkPw(getAcc(), Q("#ac-cur").value))) {
          e.textContent = "Enter your current password first.";
          return;
        }
        var A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789",
          r = new Uint8Array(16);
        crypto.getRandomValues(r);
        var code = Array.prototype.map
            .call(r, function (x) {
              return A[x % A.length];
            })
            .join(""),
          m = await mkAcc("rc", code);
        rawSet.call(LS, RECK, JSON.stringify({ salt: m.salt, alg: m.alg, it: m.it, h: m.h }));
        out.textContent = code.replace(/(.{4})(?=.)/g, "$1-");
        e.textContent = "";
        log("Created", "Recovery code", "new recovery code created");
        toast("Write this code down. It is shown only once.");
      };
    }
  }

  /* ================= 3. AUTOMATIC BACKUPS ================= */
  function idb() {
    return new Promise(function (res, rej) {
      var r = indexedDB.open("bioreg-backups", 1);
      r.onupgradeneeded = function () {
        r.result.createObjectStore("b", { keyPath: "id" });
      };
      r.onsuccess = function () {
        res(r.result);
      };
      r.onerror = function () {
        rej(r.error);
      };
    });
  }
  function tx(mode, fn) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var t = db.transaction("b", mode),
          s = t.objectStore("b"),
          out = fn(s);
        t.oncomplete = function () {
          res(out && out.result);
        };
        t.onerror = function () {
          rej(t.error);
        };
      });
    });
  }
  function allBackups() {
    return tx("readonly", function (s) {
      return s.getAll();
    }).then(function (r) {
      return (r || []).sort(function (a, b) {
        return a.at < b.at ? 1 : -1;
      });
    });
  }
  function makeBackup(kind) {
    var keys = {};
    BACKUP_KEYS.forEach(function (k) {
      var v = LS.getItem(k);
      if (v != null) keys[k] = v;
    });
    var now = new Date(),
      rec = {
        id: kind === "auto" ? "auto-" + today() : kind + "-" + now.toISOString(),
        kind: kind,
        at: now.toISOString(),
        keys: keys,
        size: JSON.stringify(keys).length,
      };
    return tx("readwrite", function (s) {
      return s.put(rec);
    })
      .then(function () {
        return prune();
      })
      .then(function () {
        return allBackups();
      })
      .then(function (L) {
        stamp(L);
        return rec;
      });
  }
  function prune() {
    return allBackups().then(function (L) {
      var drop = [],
        n = { auto: 0, manual: 0, safety: 0 },
        cap = { auto: 14, manual: 10, safety: 3 };
      L.forEach(function (b) {
        n[b.kind] = (n[b.kind] || 0) + 1;
        if (n[b.kind] > (cap[b.kind] || 10)) drop.push(b.id);
      });
      return tx("readwrite", function (s) {
        drop.forEach(function (i) {
          s.delete(i);
        });
      });
    });
  }
  function autoBackup() {
    if (typeof AUTHED === "undefined" || !AUTHED) return;
    if (LS.getItem("bioreg.autoskip") === today()) return;
    allBackups()
      .then(function (L) {
        if (
          !L.some(function (b) {
            return b.id === "auto-" + today();
          })
        )
          return makeBackup("auto").then(function () {
            fillBackups();
          });
      })
      .catch(function () {});
  }
  function fileAge() {
    var t = LS.getItem(LASTFILE);
    return t ? Math.floor((Date.now() - new Date(t)) / 864e5) : null;
  }
  function lastAuto() {
    return LS.getItem("bioreg.lastauto") || "";
  }
  function stamp(L) {
    var a = (L || []).filter(function (b) {
      return b.kind === "auto";
    })[0];
    if (a) rawSet.call(LS, "bioreg.lastauto", a.at);
    else rawRemove.call(LS, "bioreg.lastauto");
  }
  function ageText() {
    var age = fileAge();
    return age === null
      ? "never"
      : age === 0
        ? "today"
        : age + " day" + (age == 1 ? "" : "s") + " ago";
  }
  function statusText() {
    var a = lastAuto();
    return (
      "Last automatic copy: " +
      (a ? new Date(a).toLocaleString("en-GB") : "none yet") +
      " \u00b7 Last backup file downloaded: " +
      ageText()
    );
  }
  /* used by the notification bell (admins only) */
  window.__bkStatus = function () {
    var age = fileAge(),
      warn = age === null || age > 7;
    return { text: statusText(), warn: warn, key: lastAuto() + "|" + age };
  };
  function markFile() {
    rawSet.call(LS, LASTFILE, new Date().toISOString());
  }
  function backupFileObj() {
    var keys = {};
    BACKUP_KEYS.forEach(function (k) {
      var v = LS.getItem(k);
      if (v != null) keys[k] = v;
    });
    return { app: "bioreg-full-backup", v: 1, at: new Date().toISOString(), keys: keys };
  }
  function backupCard() {
    return (
      '<div class="card" id="abk-card"><h3><span class="bx bx-time-five"></span> Automatic backups</h3>' +
      '<p class="em" style="text-align:left">A copy of all data (map, reports, users, MDAs, DCAs, inventory) is saved in this browser once a day when someone signs in. The last 14 daily copies are kept. Download a backup file regularly and keep it off this computer too.</p>' +
      '<div id="abk-st" class="pm"></div><div class="flt"><button class="btn pri" data-fa="abkd" type="button"><span class="bx bx-download"></span> Download full backup file</button>' +
      '<button class="btn" data-fa="abkn" type="button"><span class="bx bx-save"></span> Back up now</button><button class="btn" data-fa="abki" type="button"><span class="bx bx-upload"></span> Restore from file</button><button class="btn dg" data-fa="abkxa" type="button"><span class="bx bx-trash"></span> Delete all copies</button><input type="file" id="abk-f" accept=".json" hidden></div>' +
      '<div style="max-height:260px;overflow:auto"><table class="opt"><thead><tr><th>Saved</th><th>Type</th><th>Size</th><th></th></tr></thead><tbody id="abk-b"><tr><td colspan="4" class="em">Loading…</td></tr></tbody></table></div></div>'
    );
  }
  function fillBackups() {
    var b = Q("#abk-b");
    if (!b) return;
    allBackups()
      .then(function (L) {
        var age = fileAge(),
          st = Q("#abk-st"),
          au = L.filter(function (b) {
            return b.kind === "auto";
          })[0];
        stamp(L);
        if (st)
          st.innerHTML =
            "Last automatic copy: <b>" +
            (au ? E(new Date(au.at).toLocaleString("en-GB")) : "none yet") +
            '</b> · Last backup file downloaded: <b style="color:' +
            (age === null || age > 7 ? "#B3261E" : "inherit") +
            '">' +
            ageText() +
            "</b>";
        b.innerHTML = L.length
          ? L.map(function (x) {
              return (
                "<tr><td>" +
                E(new Date(x.at).toLocaleString("en-GB")) +
                "</td><td>" +
                ({ auto: "Daily", manual: "Manual", safety: "Before restore" }[x.kind] || x.kind) +
                "</td><td>" +
                Math.max(1, Math.round(x.size / 1024)) +
                ' KB</td><td style="white-space:nowrap">' +
                '<button class="btn" data-fa="abkdl" data-id="' +
                E(x.id) +
                '" type="button">Download</button> <button class="btn" data-fa="abkr" data-id="' +
                E(x.id) +
                '" type="button">Restore</button> <button class="btn dg" data-fa="abkx" data-id="' +
                E(x.id) +
                '" type="button"><span class="bx bx-trash"></span> Delete</button></td></tr>'
              );
            }).join("")
          : '<tr><td colspan="4" class="em">No copies yet.</td></tr>';
      })
      .catch(function () {
        b.innerHTML =
          '<tr><td colspan="4" class="em">This browser does not allow automatic copies (private window?). Use the download button.</td></tr>';
      });
  }
  async function restoreKeys(keys, label) {
    if (
      !(await ask(
        "Replace ALL current data with " +
          label +
          "? A safety copy of the current data is saved first.",
        "Restore",
      ))
    )
      return;
    await makeBackup("safety");
    BACKUP_KEYS.forEach(function (k) {
      rawRemove.call(LS, k);
    });
    Object.keys(keys).forEach(function (k) {
      if (BACKUP_KEYS.indexOf(k) > -1) rawSet.call(LS, k, keys[k]);
    });
    log("Restored", "Backup", label);
    toast("Backup restored. Reloading…");
    setTimeout(function () {
      location.reload();
    }, 900);
  }
  function ask(msg, ok) {
    try {
      return typeof window.askConfirm === "function"
        ? window.askConfirm(msg, ok)
        : Promise.resolve(confirm(msg));
    } catch (e) {
      return Promise.resolve(confirm(msg));
    }
  }

  /* ================= 4. ALERTS: SITES BEHIND + MISSING REPORTS ================= */
  var QUIET_DAYS = 2;
  function tot(r) {
    return (r.dcas || []).reduce(function (t, x) {
      return t + (+x.n || 0);
    }, 0);
  }
  function alerts() {
    var td = today(),
      R = ld("bioreg.reports", []).filter(function (r) {
        return r.rs !== "Rejected";
      }),
      users = ld(UK, []),
      sites = (window.SITES || []).filter(function (s) {
        return (
          s.status === "Active" &&
          (!s.open || s.open <= td) &&
          (!s.deadline || s.deadline >= td) &&
          (s.tg || s.open || s.deadline || s.sup || +s.dcaN)
        );
      });
    var last = {},
      byDay = {},
      reg = {},
      done = {};
    R.forEach(function (r) {
      if (!last[r.site] || r.date > last[r.site]) last[r.site] = r.date;
      byDay[r.site + "|" + r.date] = (byDay[r.site + "|" + r.date] || 0) + tot(r);
      reg[r.site] = (reg[r.site] || 0) + tot(r);
      if (r.date === td) done[r.site] = 1;
    });
    var behind = [],
      missing = {};
    sites.forEach(function (s) {
      var why = [],
        gap = last[s.id]
          ? dayNo(td) - dayNo(last[s.id])
          : s.open
            ? dayNo(td) - dayNo(s.open)
            : null;
      if (last[s.id] ? gap >= QUIET_DAYS : gap !== null && gap >= QUIET_DAYS)
        why.push(
          last[s.id]
            ? "no report for " + gap + " days (last " + last[s.id] + ")"
            : "no report since it opened " + gap + " days ago",
        );
      if (last[s.id] && !s._excelKey && +s.cap > 0) {
        var v = byDay[s.id + "|" + last[s.id]] || 0;
        if (v < s.cap * 0.5)
          why.push("last day " + v + " registered, below half of the " + s.cap + " daily capacity");
      }
      if (+s.fte > 0 && s.open && s.deadline && s.deadline > s.open) {
        var el = dayNo(td) - dayNo(s.open) + 1,
          tt = dayNo(s.deadline) - dayNo(s.open) + 1,
          exp = s.fte * Math.min(1, el / tt);
        if (el >= 3 && (reg[s.id] || 0) < exp * 0.8)
          why.push(
            "behind pace: " +
              (reg[s.id] || 0) +
              " registered, about " +
              Math.round(exp) +
              " expected by now",
          );
      }
      if (why.length) behind.push({ s: s, why: why });
      if (!done[s.id]) {
        var k = s.sup || "";
        (missing[k] = missing[k] || []).push(s);
      }
    });
    return { behind: behind, missing: missing, users: users, active: sites.length, td: td };
  }
  function userFor(users, name) {
    return users.find(function (u) {
      return name && String(u.name || "").toLowerCase() === name.toLowerCase();
    });
  }
  function panel() {
    var r = role();
    if (r !== "admin" && r !== "subadmin") return "";
    var A = alerts(),
      sups = Object.keys(A.missing).sort(),
      age = fileAge(),
      rows = "";
    var warnBk =
      (age === null || age > 7) && (ld("bioreg.reports", []).length || LS.getItem(V2))
        ? '<div class="pm" style="color:#8C6A2B;margin-bottom:8px"><span class="bx bx-error"></span> ' +
          (age === null
            ? "No backup file has been downloaded yet."
            : "The last backup file was downloaded " + age + " days ago.") +
          ' <a href="#" data-fa="abkgo">Go to Backup &amp; logo</a></div>'
        : "";
    if (!A.active && !warnBk) return "";
    rows =
      '<div class="g2" style="margin-bottom:12px"><div class="card"><h3><span class="bx bx-user-x"></span> Not submitted today <span style="font-weight:400;font-size:.8rem">(' +
      E(A.td) +
      ")</span></h3>";
    if (!A.active)
      rows += '<p class="em" style="text-align:left">No active sites with targets.</p>';
    else if (!sups.length)
      rows +=
        '<p class="em" style="text-align:left">All ' +
        A.active +
        " active sites have submitted today.</p>";
    else {
      rows +=
        '<div style="max-height:240px;overflow:auto"><table class="opt"><thead><tr><th>Supervisor</th><th>Sites without a report</th><th></th></tr></thead><tbody>' +
        sups
          .map(function (n) {
            var u = userFor(A.users, n),
              L = A.missing[n];
            return (
              "<tr><td><b>" +
              E(n || "(No supervisor assigned)") +
              "</b>" +
              (u && u.phone ? "<br><small>" + E(u.phone) + "</small>" : "") +
              "</td><td>" +
              L.length +
              ": " +
              E(
                L.slice(0, 3)
                  .map(function (s) {
                    return s.name;
                  })
                  .join(", "),
              ) +
              (L.length > 3 ? " +" + (L.length - 3) : "") +
              "</td><td>" +
              (u
                ? '<button class="btn" data-fa="remind" data-n="' +
                  E(n) +
                  '" type="button"><span class="bx bx-bell"></span> Remind</button>'
                : '<small class="em">no user account</small>') +
              "</td></tr>"
            );
          })
          .join("") +
        '</tbody></table></div><div class="flt"><button class="btn pri" data-fa="remindall" type="button"><span class="bx bx-bell-ring"></span> Remind all supervisors</button></div>';
    }
    rows +=
      '</div><div class="card"><h3><span class="bx bx-trending-down"></span> Sites falling behind</h3>';
    rows += A.behind.length
      ? '<div style="max-height:280px;overflow:auto"><table class="opt"><thead><tr><th>Site</th><th>Supervisor</th><th>Why</th></tr></thead><tbody>' +
        A.behind
          .map(function (b) {
            return (
              "<tr><td><b>" +
              E(b.s.name) +
              "</b><br><small>" +
              E(b.s.mda || "") +
              "</small></td><td>" +
              E(b.s.sup || "—") +
              "</td><td>" +
              b.why.map(E).join("<br>") +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table></div>"
      : '<p class="em" style="text-align:left">' +
        (A.active ? "No active site is falling behind." : "No active sites.") +
        "</p>";
    rows +=
      '<p class="pm" style="margin-top:6px">A site is flagged when it has no report for ' +
      QUIET_DAYS +
      " days, its last day is under half its daily capacity, or it is under 80% of the pace needed to reach its target by the closing date.</p></div></div>";
    return '<div id="ops-panel">' + warnBk + rows + "</div>";
  }
  function remind(names) {
    var A = alerts(),
      NT = ld("bioreg.notif", []),
      n = 0,
      td = today();
    names.forEach(function (name) {
      var u = userFor(A.users, name),
        L = A.missing[name];
      if (!u || !L) return;
      var id = "arem|" + td + "|" + u.u;
      if (
        NT.some(function (x) {
          return x.id === id;
        })
      )
        return;
      NT.unshift({
        id: id,
        type: "arem",
        at: new Date().toISOString(),
        by: who(),
        to: u.u,
        title: "Please submit today's daily report",
        text:
          L.length +
          " site" +
          (L.length == 1 ? "" : "s") +
          " without a report today: " +
          L.slice(0, 4)
            .map(function (s) {
              return s.name;
            })
            .join(", ") +
          (L.length > 4 ? " and " + (L.length - 4) + " more" : "") +
          ". Reminder from " +
          who() +
          ".",
      });
      n++;
    });
    LS.setItem("bioreg.notif", JSON.stringify(NT.slice(0, 200)));
    log(
      "Sent",
      "Reminder",
      n + " supervisor" + (n == 1 ? "" : "s") + " reminded to submit today's report",
    );
    toast(
      n
        ? "Reminder sent to " + n + " supervisor" + (n == 1 ? "" : "s")
        : "They were already reminded today",
    );
  }

  /* ================= wiring ================= */
  var st = document.createElement("style");
  st.textContent =
    ".opt{width:100%;border-collapse:collapse;font-size:.85rem}.opt th{text-align:left;font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;color:var(--mu);padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}" +
    ".opt td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:top;overflow-wrap:anywhere}.opt tr[hidden]{display:none}#ops-panel .opt b{font-size:.9rem}";
  document.head.appendChild(st);

  function tabNow() {
    try {
      return ADM.tab;
    } catch (e) {
      return "";
    }
  }
  function afterRender() {
    var t = tabNow();
    /* dashboard panel removed */
    if (t === "bak") {
      var host = Q("#abody .g2");
      if (host && role() === "admin" && !Q("#abk-card")) {
        host.insertAdjacentHTML(
          "afterend",
          '<div id="ops-cards" style="margin-top:14px;display:grid;gap:14px">' +
            ruleCard() +
            backupCard() +
            auditCard() +
            "</div>",
        );
        fillBackups();
      }
    }
  }
  var ar = window.admRender;
  if (typeof ar === "function")
    window.admRender = function () {
      var r = ar.apply(this, arguments);
      try {
        afterRender();
      } catch (e) {
        console.warn(e);
      }
      return r;
    };

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-fa]"),
      a = b && b.dataset.fa;
    if (e.target.closest && e.target.closest("#aex")) markFile();
    if (!a) return;
    if (a === "rbx") markFile();
    if (a === "abkgo") {
      e.preventDefault();
      if (window.openAdmin) window.openAdmin("bak");
    }
    if (a === "bds") {
      var d = parseInt((Q("#bd-d") || {}).value, 10),
        m = (Q("#bd-m") || {}).value;
      if (!(d >= 0 && d <= 365)) return toast("Enter a number of days between 0 and 365");
      LS.setItem("bioreg.bdrule", JSON.stringify({ days: d, mode: m }));
      log(
        "Updated",
        "Report date rule",
        m === "off"
          ? "no limit"
          : (m === "block" ? "block" : "reason required") + " after " + d + " days",
      );
      toast("Date rule saved");
    }
    if (a === "remind") remind([b.dataset.n]);
    if (a === "remindall") remind(Object.keys(alerts().missing));
    if (a === "audx") {
      var csv =
        "When,Who,Action,Type,Details\n" +
        ld(AUD, [])
          .map(function (x) {
            return [x.t, x.by, x.a, x.k, x.d]
              .map(function (v) {
                return '"' + String(v).replace(/"/g, '""') + '"';
              })
              .join(",");
          })
          .join("\n");
      dl("bioreg-activity-log-" + today() + ".csv", csv, "text/csv");
    }
    if (a === "audc" && role() === "admin")
      ask("Delete the whole activity log?", "Delete").then(function (ok) {
        if (ok) {
          rawRemove.call(LS, AUD);
          log("Cleared", "Activity log", "log cleared");
          window.admRender(true);
        }
      });
    if (a === "abkd") {
      dl("bioreg-full-backup-" + today() + ".json", JSON.stringify(backupFileObj()));
      markFile();
      log("Downloaded", "Backup", "full backup file");
      fillBackups();
    }
    if (a === "abkn")
      makeBackup("manual").then(function () {
        toast("Backup saved");
        fillBackups();
      });
    if (a === "abki") Q("#abk-f").click();
    if (a === "abkdl")
      allBackups().then(function (L) {
        var x = L.find(function (y) {
          return y.id === b.dataset.id;
        });
        if (x) {
          dl(
            "bioreg-backup-" + x.at.slice(0, 10) + ".json",
            JSON.stringify({ app: "bioreg-full-backup", v: 1, at: x.at, keys: x.keys }),
          );
          markFile();
        }
      });
    if (a === "abkx")
      ask("Delete this backup copy? This cannot be undone.", "Delete").then(function (ok) {
        if (!ok) return;
        if (/^auto-/.test(b.dataset.id)) rawSet.call(LS, "bioreg.autoskip", today());
        tx("readwrite", function (s) {
          s.delete(b.dataset.id);
        }).then(function () {
          log("Deleted", "Backup", "backup copy " + b.dataset.id.replace(/^[a-z]+-/, ""));
          toast("Backup copy deleted");
          fillBackups();
        });
      });
    if (a === "abkxa")
      ask(
        "Delete ALL automatic and manual backup copies kept in this browser? Backup files you downloaded are not affected.",
        "Delete all",
      ).then(function (ok) {
        if (!ok) return;
        rawSet.call(LS, "bioreg.autoskip", today());
        allBackups()
          .then(function (L) {
            return tx("readwrite", function (s) {
              L.forEach(function (x) {
                s.delete(x.id);
              });
            });
          })
          .then(function () {
            log("Deleted", "Backup", "all backup copies");
            toast("All backup copies deleted");
            fillBackups();
          });
      });
    if (a === "abkr")
      allBackups().then(function (L) {
        var x = L.find(function (y) {
          return y.id === b.dataset.id;
        });
        if (x) restoreKeys(x.keys, "the copy from " + new Date(x.at).toLocaleString("en-GB"));
      });
  });
  document.addEventListener("input", function (e) {
    if (e.target.id === "aud-q") auditFilter();
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "aud-k") auditFilter();
    if (e.target.id === "abk-f") {
      var f = e.target.files[0];
      e.target.value = "";
      if (!f) return;
      f.text()
        .then(function (t) {
          var j = JSON.parse(t);
          if (j.app !== "bioreg-full-backup" || !j.keys) throw 0;
          restoreKeys(j.keys, "the backup file from " + new Date(j.at).toLocaleString("en-GB"));
        })
        .catch(function () {
          toast("That file is not a BioReg full backup");
        });
    }
  });
  setInterval(initLogin, 1500);
  initLogin();
  setTimeout(function () {
    autoBackup();
    mustCheck();
  }, 3500);
  setInterval(autoBackup, 3600000);
  window.__auditLog = log;
})();
