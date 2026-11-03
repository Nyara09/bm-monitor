/*
 * js/form-validation.js
 * Form validation rules and error messages for every form.
 */

/* Form validation layer: inline Bootstrap-style errors, checked when a form is saved and live while typing */
(function () {
  "use strict";

  var MIN_YEAR = "2020-01-01",
    FORM_DEFINITIONS = [];
  function padTwoDigits(n) {
    return String(n).padStart(2, "0");
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + padTwoDigits(d.getMonth() + 1) + "-" + padTwoDigits(d.getDate());
  }
  function trimmedValue(e) {
    return e ? String(e.value == null ? "" : e.value).trim() : "";
  }
  function digits(s) {
    return (s.match(/\d/g) || []).length;
  }
  function realDate(v) {
    if (!/^\d{4}-\d\d-\d\d$/.test(v)) return false;
    var d = new Date(v + "T00:00:00");
    return (
      !isNaN(d) &&
      d.getFullYear() + "-" + padTwoDigits(d.getMonth() + 1) + "-" + padTwoDigits(d.getDate()) === v
    );
  }
  var validators = {
    req: function (l) {
      return function (e) {
        return trimmedValue(e) ? "" : l + " is required.";
      };
    },
    len: function (a, b, l) {
      return function (e) {
        var n = trimmedValue(e).length;
        return !n
          ? ""
          : n < a
            ? l + " must be at least " + a + " characters."
            : n > b
              ? l + " must be at most " + b + " characters."
              : "";
      };
    },
    phone: function (opt, l) {
      return function (e) {
        var v = trimmedValue(e);
        if (!v) return opt ? "" : (l || "Phone number") + " is required.";
        return /^\+?[0-9][0-9 ()-]*$/.test(v) && digits(v) >= 7 && digits(v) <= 15
          ? ""
          : "Enter a valid phone number (7–15 digits, for example +211 912 345 678).";
      };
    },
    int: function (min, max, l, opt) {
      return function (e) {
        var v = trimmedValue(e);
        if (v === "") return opt ? "" : l + " is required.";
        if (!/^-?\d+$/.test(v)) return l + " must be a whole number.";
        var n = +v;
        return n < min
          ? l + " cannot be less than " + min + "."
          : n > max
            ? l + " cannot be more than " + max.toLocaleString() + "."
            : "";
      };
    },
    num: function (min, max, l) {
      return function (e) {
        var v = trimmedValue(e);
        if (v === "") return l + " is required.";
        if (isNaN(+v)) return l + " must be a number.";
        return +v < min || +v > max
          ? l + " must be between " + min + " and " + max + " (inside South Sudan)."
          : "";
      };
    },
    date: function (opt, l, noFuture) {
      return function (e) {
        var v = trimmedValue(e);
        if (!v) return opt ? "" : l + " is required.";
        if (!realDate(v)) return l + " is not a valid date (use YYYY-MM-DD).";
        if (v < MIN_YEAR) return l + " is too far in the past.";
        return noFuture && v > today() ? l + " cannot be in the future." : "";
      };
    },
    pw: function (opt) {
      return function (e) {
        var v = e.value || "";
        if (!v) return opt ? "" : "Password is required.";
        if (v.length < 8) return "Password must be at least 8 characters.";
        if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) return "Use at least one letter and one number.";
        return v.length > 128 ? "Password is too long (max 128)." : "";
      };
    },
    user: function (e) {
      var v = trimmedValue(e);
      return /^[A-Za-z0-9._-]{3,32}$/.test(v)
        ? ""
        : "Username must be 3–32 letters, digits, dot, dash or underscore.";
    },
  };
  function visibleControl(e) {
    return e.tagName == "SELECT" &&
      e.nextElementSibling &&
      e.nextElementSibling.classList.contains("ss-btn")
      ? e.nextElementSibling
      : null;
  }
  function clearEl(e) {
    e.classList.remove("is-invalid");
    e.removeAttribute("aria-invalid");
    var b = visibleControl(e);
    if (b) b.classList.remove("is-invalid");
    var n = (b || e).nextElementSibling;
    if (n && n.classList.contains("fv-msg")) n.remove();
  }
  function markEl(e, msg) {
    clearEl(e);
    e.classList.add("is-invalid");
    e.setAttribute("aria-invalid", "true");
    var b = visibleControl(e);
    if (b) b.classList.add("is-invalid");
    var d = document.createElement("div");
    d.className = "invalid-feedback fv-msg";
    d.setAttribute("role", "alert");
    d.textContent = msg;
    (b || e).insertAdjacentElement("afterend", d);
  }
  function clearAll(root) {
    root.querySelectorAll(".is-invalid").forEach(function (x) {
      x.classList.remove("is-invalid");
      x.removeAttribute("aria-invalid");
    });
    root.querySelectorAll(".fv-msg").forEach(function (x) {
      x.remove();
    });
  }
  /* helpers for rule lists */
  function checkField(el, fns, out) {
    if (!el) return;
    for (var i = 0; i < fns.length; i++) {
      var m = fns[i](el);
      if (m) {
        out.push([el, m]);
        return;
      }
    }
  }
  function checkDuplicates(list, label, out, ci) {
    var seen = {};
    list.forEach(function (e) {
      var v = trimmedValue(e);
      if (!v) return;
      var k = ci === false ? v : v.toLowerCase();
      if (seen[k]) {
        if (!e.classList.contains("is-invalid"))
          out.push([e, label + " is already used above — each can appear once."]);
      } else seen[k] = 1;
    });
  }
  function findOne(r, s) {
    return r.querySelector(s);
  }
  function findAll(r, s) {
    return [].slice.call(r.querySelectorAll(s));
  }
  function definitions() {
    return window.FVD || {};
  }
  /* ---------- form definitions ---------- */
  function registerFormDefinition(d) {
    FORM_DEFINITIONS.push(d);
  }
  registerFormDefinition({
    name: "login",
    trig: "#lg-go",
    root: function () {
      return document.getElementById("login");
    },
    check: function (r) {
      var o = [];
      checkField(
        findOne(r, "#lg-u"),
        [validators.req("Username"), validators.len(2, 64, "Username")],
        o,
      );
      checkField(findOne(r, "#lg-pw"), [validators.req("Password")], o);
      var c = findOne(r, "#lg-c");
      if (c && !c.hidden) {
        checkField(findOne(r, "#lg-pw"), [validators.pw()], o);
        var a = findOne(r, "#lg-pw"),
          b = findOne(r, "#lg-pw2");
        if (b && a.value !== b.value) o.push([b, "The two passwords do not match."]);
      }
      return o;
    },
  });
  registerFormDefinition({
    name: "account",
    trig: "#ac-go",
    root: function () {
      return document.getElementById("acct");
    },
    check: function (r) {
      var o = [],
        n = findOne(r, "#ac-new"),
        n2 = findOne(r, "#ac-new2");
      checkField(findOne(r, "#ac-cur"), [validators.req("Current password")], o);
      checkField(findOne(r, "#ac-u"), [validators.req("Username"), validators.user], o);
      if (n && n.value) checkField(n, [validators.pw(true)], o);
      return o;
    },
  });
  registerFormDefinition({
    name: "profile",
    trig: "[data-pp=s]",
    root: function () {
      return document.getElementById("prof");
    },
    check: function (r) {
      var o = [];
      checkField(
        findOne(r, "#ppn"),
        [validators.req("Full name"), validators.len(2, 80, "Full name")],
        o,
      );
      checkField(findOne(r, "#ppp"), [validators.phone(true)], o);
      checkField(findOne(r, "#ppw"), [validators.pw(true)], o);
      return o;
    },
  });
  registerFormDefinition({
    name: "user",
    trig: "[data-fa=au]",
    root: function () {
      return document.querySelector("#abody .card:has(#un)");
    },
    check: function (r) {
      var o = [],
        nw = !!findOne(r, "#uu") && !findOne(r, "#uu").disabled;
      checkField(
        findOne(r, "#un"),
        [validators.req("Full name"), validators.len(2, 80, "Full name")],
        o,
      );
      checkField(findOne(r, "#uph"), [validators.phone(false)], o);
      if (nw) {
        var u = findOne(r, "#uu");
        checkField(
          u,
          [
            validators.req("Username"),
            validators.user,
            function (e) {
              return definitions().userTaken && definitions().userTaken(trimmedValue(e))
                ? "This username is already taken."
                : "";
            },
          ],
          o,
        );
        checkField(findOne(r, "#up"), [validators.pw(false)], o);
      } else if (findOne(r, "#up")) checkField(findOne(r, "#up"), [validators.pw(true)], o);
      return o;
    },
  });
  registerFormDefinition({
    name: "dca",
    trig: "[data-fa=dsv]",
    root: function () {
      return document.querySelector("#abody .card:has(#dcn)");
    },
    check: function (r) {
      var o = [];
      checkField(
        findOne(r, "#dcn"),
        [
          validators.req("DCA name"),
          validators.len(2, 80, "DCA name"),
          function (e) {
            return definitions().dcaTaken && definitions().dcaTaken(trimmedValue(e))
              ? "This DCA already exists."
              : "";
          },
        ],
        o,
      );
      checkField(findOne(r, "#cph"), [validators.phone(true)], o);
      return o;
    },
  });
  registerFormDefinition({
    name: "site",
    trig: "[data-fa=st]",
    root: function () {
      return document.querySelector("#abody .card:has(#tf)");
    },
    check: function (r) {
      var o = [];
      checkField(findOne(r, "#ts"), [validators.req("State")], o);
      checkField(findOne(r, "#tc"), [validators.req("County")], o);
      if (findOne(r, "#tn"))
        checkField(
          findOne(r, "#tn"),
          [validators.req("Site name"), validators.len(2, 120, "Site name")],
          o,
        );
      checkField(findOne(r, "#tm"), [validators.len(0, 150, "MDA")], o);
      checkField(findOne(r, "#tf"), [validators.int(1, 10000000, "Total to register")], o);
      checkField(findOne(r, "#tdn"), [validators.int(0, 500, "Number of DCAs", true)], o);
      checkField(findOne(r, "#tod"), [validators.date(true, "Opening date")], o);
      checkField(findOne(r, "#tdl"), [validators.date(true, "Closing date")], o);
      var a = trimmedValue(findOne(r, "#tod")),
        b = trimmedValue(findOne(r, "#tdl"));
      if (
        a &&
        b &&
        b < a &&
        !o.some(function (x) {
          return x[0] === findOne(r, "#tdl");
        })
      )
        o.push([findOne(r, "#tdl"), "Closing date must be on or after the opening date."]);
      checkField(findOne(r, "#tcm"), [validators.len(0, 300, "Comment")], o);
      return o;
    },
  });
  /* Enter daily report */
  function wizCheck(r) {
    var o = [],
      st = definitions().step ? definitions().step() : 0,
      ty = definitions().type ? definitions().type() : "single";
    if (st == 1) {
      checkField(findOne(r, "#wd"), [validators.date(false, "Registration date", true)], o);
      checkField(findOne(r, "#ws"), [validators.req("State")], o);
      checkField(findOne(r, "#wc"), [validators.req("County")], o);
      checkField(findOne(r, "#wmd"), [validators.req("MDA")], o);
      checkField(findOne(r, "#wi"), [validators.req("Registration site")], o);
      return o;
    }
    if (st == 4) {
      checkField(findOne(r, "#wn"), [validators.len(0, 500, "Note")], o);
      return o;
    }
    if (st == 3) {
      checkField(findOne(r, "#wsn"), [validators.int(1, 200, "Number of setups")], o);
      findAll(r, ".wi-p").forEach(function (e) {
        checkField(e, [validators.req("DCA / supervisor")], o);
      });
      findAll(r, ".wi-q").forEach(function (e) {
        checkField(e, [validators.int(0, 10000, "Quantity", true)], o);
      });
      findAll(r, ".wi-n").forEach(function (e) {
        checkField(e, [validators.len(0, 200, "Note")], o);
      });
      return o;
    }
    if (ty == "single") {
      checkField(findOne(r, "#wm"), [validators.req("MDA of the FTEs registered")], o);
      var rows = findAll(r, ".wz-dr");
      if (!rows.length) o.push([findOne(r, "[data-w=dadd]") || r, "Add at least one DCA."]);
      var sel = rows.map(function (x) {
        return findOne(x, ".wz-dn");
      });
      sel.forEach(function (e) {
        checkField(e, [validators.req("DCA")], o);
      });
      checkDuplicates(sel, "This DCA", o);
      var ds = 0;
      rows.forEach(function (x) {
        var e = findOne(x, ".wz-dv");
        checkField(e, [validators.int(0, 1000000, "Number registered")], o);
        ds += +trimmedValue(e) || 0;
      });
      var ids = ["#wo", "#wp", "#wf"],
        names = ["Complete", "Pending", "Failed"],
        ms = 0,
        bad = false;
      ids.forEach(function (id, i) {
        var e = findOne(r, id);
        var n0 = o.length;
        checkField(e, [validators.int(0, 1000000, names[i], true)], o);
        if (o.length > n0) bad = true;
        ms += +trimmedValue(e) || 0;
      });
      if (!bad && ds !== ms)
        o.push([
          findOne(r, "#wo"),
          "Complete + Pending + Failed is " +
            ms +
            " but the DCAs registered " +
            ds +
            ". The two totals must be equal.",
        ]);
      return o;
    }
    var cards = findAll(r, ".wz-mc");
    if (!cards.length) o.push([findOne(r, "[data-w=dadd]") || r, "Add at least one DCA."]);
    var dn = cards.map(function (c) {
      return findOne(c, ".wz-dn");
    });
    dn.forEach(function (e) {
      checkField(e, [validators.req("DCA")], o);
    });
    checkDuplicates(dn, "This DCA", o);
    var T = {};
    cards.forEach(function (c) {
      var im = findAll(c, ".wz-it").map(function (x) {
        return findOne(x, ".wz-im");
      });
      im.forEach(function (e) {
        checkField(e, [validators.req("MDA")], o);
      });
      checkDuplicates(im, "This MDA", o, false);
      findAll(c, ".wz-it").forEach(function (x) {
        var s = findOne(x, ".wz-im"),
          n = findOne(x, ".wz-in");
        checkField(n, [validators.int(0, 1000000, "Number registered")], o);
        if (s && s.value) T[s.value] = (T[s.value] || 0) + (+trimmedValue(n) || 0);
      });
    });
    findAll(r, ".wz-ms").forEach(function (c) {
      var m = c.dataset.m,
        so = findOne(c, ".wz-so"),
        sp = findOne(c, ".wz-sp2"),
        sf = findOne(c, ".wz-sf"),
        n0 = o.length;
      checkField(so, [validators.int(0, 1000000, "Complete", true)], o);
      checkField(sp, [validators.int(0, 1000000, "Pending", true)], o);
      checkField(sf, [validators.int(0, 1000000, "Failed", true)], o);
      if (o.length == n0) {
        var t = (+trimmedValue(so) || 0) + (+trimmedValue(sp) || 0) + (+trimmedValue(sf) || 0),
          dv = T[m] || 0;
        if (t !== dv)
          o.push([
            so,
            m + ": Complete + Pending + Failed is " + t + " but the DCAs registered " + dv + ".",
          ]);
      }
    });
    return o;
  }
  registerFormDefinition({
    name: "wizard",
    trig: "[data-w=next],[data-w=submit]",
    root: function () {
      return document.getElementById("wz");
    },
    check: function (r, b) {
      if (b && b.dataset && b.dataset.w == "prev") return [];
      return wizCheck(r);
    },
    live: true,
  });
  registerFormDefinition({
    name: "wiz-dca",
    trig: "[data-w=dnew]",
    root: function () {
      return document.getElementById("wz");
    },
    check: function (r) {
      var o = [];
      checkField(
        findOne(r, "#wdn"),
        [
          validators.req("DCA name"),
          validators.len(2, 80, "DCA name"),
          function (e) {
            return definitions().dcaTaken && definitions().dcaTaken(trimmedValue(e))
              ? "This DCA already exists."
              : "";
          },
        ],
        o,
      );
      checkField(findOne(r, "#wdp"), [validators.phone(true)], o);
      return o;
    },
    scoped: "#wdn,#wdp",
  });
  registerFormDefinition({
    name: "wiz-mda",
    trig: "[data-w=madd]",
    root: function () {
      return document.getElementById("wz");
    },
    check: function (r) {
      var o = [];
      checkField(
        findOne(r, "#wmn"),
        [
          validators.req("MDA name"),
          validators.len(2, 120, "MDA name"),
          function (e) {
            return definitions().mdaTaken && definitions().mdaTaken(trimmedValue(e))
              ? "This MDA is already in the list."
              : "";
          },
        ],
        o,
      );
      return o;
    },
    scoped: "#wmn",
  });
  /* map-data pop-ups (admin modal #amb with am-*, map pop-up #pop with pf-*) */
  function mapCheck(pre) {
    return function (r) {
      var o = [],
        g = function (k) {
          return findOne(r, "#" + pre + k);
        };
      checkField(g("n"), [validators.req("Name"), validators.len(2, 120, "Name")], o);
      ["lo", "glo"].forEach(function (k) {
        checkField(
          g(k),
          [
            function (e) {
              return k == "glo" && !trimmedValue(e)
                ? ""
                : validators.num(23.4, 36.0, "Longitude")(e);
            },
          ],
          o,
        );
      });
      ["la", "gla"].forEach(function (k) {
        checkField(
          g(k),
          [
            function (e) {
              return k == "gla" && !trimmedValue(e) ? "" : validators.num(3.4, 12.3, "Latitude")(e);
            },
          ],
          o,
        );
      });
      checkField(g("e"), [validators.int(0, 100000000, "Government employees", true)], o);
      checkField(g("cap"), [validators.int(0, 1000000, "Capacity per day", true)], o);
      checkField(g("fte"), [validators.int(1, 10000000, "Total to register", true)], o);
      checkField(g("dcn"), [validators.int(0, 500, "Number of DCAs", true)], o);
      checkField(g("od"), [validators.date(true, "Opening date")], o);
      checkField(g("cd"), [validators.date(true, "Closing date")], o);
      var a = trimmedValue(g("od")),
        b = trimmedValue(g("cd"));
      if (
        a &&
        b &&
        b < a &&
        g("cd") &&
        !o.some(function (x) {
          return x[0] === g("cd");
        })
      )
        o.push([g("cd"), "Closing date must be on or after the opening date."]);
      checkField(g("mda"), [validators.len(0, 150, "MDA")], o);
      checkField(g("sf"), [validators.len(0, 80, "Safety")], o);
      checkField(g("ac"), [validators.len(0, 80, "Accessibility")], o);
      checkField(g("fr"), [validators.len(0, 120, "From")], o);
      checkField(g("to"), [validators.len(0, 120, "To")], o);
      checkField(g("note"), [validators.len(0, 500, "Note")], o);
      checkField(g("rm"), [validators.len(0, 500, "Remarks")], o);
      checkField(g("rc"), [validators.len(0, 500, "Remarks")], o);
      var ss = g("ss"),
        sc = g("sc");
      if (ss && sc && trimmedValue(ss) && !trimmedValue(sc))
        o.push([sc, "Select the county of this state."]);
      if (
        ss &&
        sc &&
        g("glo") &&
        !trimmedValue(ss) &&
        !o.some(function (x) {
          return x[0] === ss;
        })
      )
        o.push([ss, "Select the state."]);
      return o;
    };
  }
  registerFormDefinition({
    name: "admin-modal",
    trig: "#amb [data-m=save]",
    root: function () {
      return document.getElementById("amb");
    },
    check: mapCheck("am-"),
    live: true,
  });
  registerFormDefinition({
    name: "map-popup",
    trig: "#pop [data-a=save]",
    root: function () {
      return document.getElementById("pop");
    },
    check: mapCheck("pf-"),
    live: true,
  });
  /* ---------- engine ---------- */
  function show(root, errs) {
    clearAll(root);
    errs.forEach(function (x) {
      if (x[0] && x[0].tagName && /INPUT|SELECT|TEXTAREA/.test(x[0].tagName)) markEl(x[0], x[1]);
      else if (x[0]) {
        var d = document.createElement("div");
        d.className = "invalid-feedback fv-msg";
        d.textContent = x[1];
        x[0].insertAdjacentElement("afterend", d);
      }
    });
    var f = errs[0][0],
      t = visibleControl(f) || f;
    try {
      t.focus({
        preventScroll: true,
      });
    } catch (e) {}
    try {
      t.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    } catch (e) {}
    if (typeof window.toast == "function")
      window.toast(
        "Please fix " +
          errs.length +
          " highlighted field" +
          (errs.length == 1 ? "" : "s") +
          " before saving.",
      );
  }
  document.addEventListener(
    "click",
    function (e) {
      if (!e.target.closest) return;
      for (var i = 0; i < FORM_DEFINITIONS.length; i++) {
        var d = FORM_DEFINITIONS[i],
          b = e.target.closest(d.trig);
        if (!b) continue;
        if (b.dataset && b.dataset.w == "prev") return;
        var root = d.root(b);
        if (!root) return;
        var errs = d.check(root, b);
        if (errs.length) {
          e.stopImmediatePropagation();
          e.preventDefault();
          show(root, errs);
        } else clearAll(root);
        return;
      }
    },
    true,
  );
  /* live feedback: validate a field when you leave it, and keep fixing it while typing */
  function live(ev) {
    var t = ev.target;
    if (!t || !t.matches || !t.matches("input,select,textarea")) return;
    if (t.matches(".ss-q,[type=search],[type=file],[type=checkbox],[type=radio]")) return;
    for (var i = 0; i < FORM_DEFINITIONS.length; i++) {
      var d = FORM_DEFINITIONS[i],
        root = d.root(null);
      if (!root || !root.contains(t)) continue;
      if (d.scoped && !t.matches(d.scoped)) continue;
      if (ev.type == "input" && !t.classList.contains("is-invalid")) return;
      if (d.name == "wizard" || d.live) {
      }
      var errs = d.check(root, null),
        m = null;
      for (var k = 0; k < errs.length; k++)
        if (errs[k][0] === t) {
          m = errs[k];
          break;
        }
      if (m) markEl(t, m[1]);
      else clearEl(t);
      return;
    }
  }
  ["focusout", "change", "input"].forEach(function (n) {
    document.addEventListener(n, live, true);
  });
  /* picture uploads: images only, 2 MB max */
  document.addEventListener(
    "change",
    function (e) {
      var t = e.target;
      if (!t || t.type != "file") return;
      var f = t.files && t.files[0];
      if (!f) return;
      var img = /^image\//.test(t.getAttribute("accept") || "");
      var jsn = /json/.test(t.getAttribute("accept") || "");
      var msg = "";
      if (img) {
        if (!/^image\//.test(f.type)) msg = "Choose an image file (JPG, PNG, WebP).";
        else if (f.size > 2 * 1024 * 1024)
          msg = "The picture is larger than 2 MB. Choose a smaller one.";
      } else if (jsn) {
        if (!/\.(geo)?json$/i.test(f.name)) msg = "Choose a .json backup file.";
        else if (f.size > 40 * 1024 * 1024) msg = "The file is larger than 40 MB.";
      }
      if (msg) {
        e.stopImmediatePropagation();
        t.value = "";
        if (img) {
          markEl(t, msg);
        }
        if (typeof window.toast == "function") window.toast(msg);
      } else if (img) clearEl(t);
    },
    true,
  );
  window.FV = {
    V: validators,
    mark: markEl,
    clear: clearEl,
    reg: registerFormDefinition,
    defs: FORM_DEFINITIONS,
  };
})();
