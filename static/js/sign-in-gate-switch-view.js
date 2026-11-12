/*
 * js/sign-in-gate-switch-view.js
 * Sign-in gate and the Switch view screen.
 */

(function () {
  var $ = function (s) {
    return document.querySelector(s);
  };
  var st = document.createElement("style");
  st.textContent =
    "#gate{position:fixed;inset:0;z-index:100;overflow:auto;background:var(--bg);color:var(--tx);display:flex;justify-content:center;align-items:flex-start;padding:28px 16px}#gate[hidden]{display:none}.gt-wrap{width:min(1040px,100%);margin:auto}.gt-h{display:flex;align-items:center;gap:12px;margin-bottom:28px}.gt-h>div{flex:1}.gt-h b{display:block}.gt-h small{color:var(--mu)}#gate h1{font-size:clamp(1.6rem,3.2vw,2.3rem);margin:0 0 6px;letter-spacing:-.02em;text-transform:none}#gate .gt-s{color:var(--mu);margin:0 0 22px}.gt-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}@media(max-width:860px){.gt-grid{grid-template-columns:1fr}}.gt-c{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:22px;display:flex;flex-direction:column;gap:10px;transition:transform .2s,box-shadow .2s}.gt-c:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(var(--v-rgb),.18)}.gt-c>i{font-size:2rem;width:56px;height:56px;border-radius:16px;display:grid;place-items:center;background:rgba(var(--v-rgb),.16);color:var(--vt)}.gt-c h2{margin:4px 0 0;font-size:1.2rem;text-transform:none;letter-spacing:-.01em;color:var(--tx)}.gt-c p{margin:0;color:var(--mu);font-size:.9rem;flex:1}.gt-c select{width:100%}.gt-c .btn{width:100%;margin:0}.gt-e{color:var(--r,#d62f58);font-size:.8rem;min-height:1.1em}";
  document.head.appendChild(st);
  var g = document.createElement("div");
  g.id = "gate";
  g.hidden = true;
  document.body.appendChild(g);
  function who() {
    try {
      var u =
        (typeof USERS !== "undefined" &&
          USERS.find(function (x) {
            return x.u == AUSER;
          })) ||
        null;
      return u && u.name ? u.name : AUSER;
    } catch (e) {
      return AUSER;
    }
  }
  function states() {
    return [].slice
      .call(document.querySelectorAll("#sbar button"))
      .slice(1)
      .map(function (b) {
        return b.textContent;
      });
  }
  function esc(t) {
    return String(t).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function show() {
    g.innerHTML =
      '<div class="gt-wrap"><div class="gt-h"><span class="logo"></span><div><b>BM Monitor</b><small>South Sudan · National registration</small></div><button class="btn" data-g="out" type="button"><i class="bx bx-log-out"></i> Sign out</button></div>' +
      "<h1>Welcome, " +
      esc(who()) +
      '</h1><p class="gt-s">Choose where you want to work.</p><div class="gt-grid">' +
      '<div class="gt-c"><i class="bx bx-cog"></i><h2>Administrator</h2><p>Registration control: daily reports, site targets, MDAs, inventory, deployment plan, map data and users.</p><button class="btn pri" data-g="adm" type="button">Open administrator</button></div>' +
      '<div class="gt-c"><i class="bx bx-globe"></i><h2>Map Overview</h2><p>The national overview: all states and counties, key figures and the national map.</p><button class="btn pri" data-g="nat" type="button">Open map overview</button></div>' +
      '<div class="gt-c"><i class="bx bx-user-check"></i><h2>Supervisor</h2><p>Supervisor workspace: your reports, supervisor report, DCA report, incident log and enter daily report.</p><button class="btn pri" data-g="sup" type="button">Open supervisor</button></div>' +
      "</div></div>";
    var CD = window.__cards && window.__cards();
    if (CD)
      ["adm", "nat", "sup"].forEach(function (k) {
        if (!CD[k]) {
          var bb = g.querySelector('[data-g="' + k + '"]');
          if (bb) bb.closest(".gt-c").remove();
        }
      });
    if (!g.querySelector(".gt-c"))
      g.querySelector(".gt-s").textContent =
        "No views are enabled for your account. Ask an administrator.";
    g.hidden = false;
    document.body.classList.add("noscroll");
    g.scrollTop = 0;
  }
  function hide() {
    g.hidden = true;
    if ($("#adm").hidden && $("#rep").hidden) document.body.classList.remove("noscroll");
  }
  function login() {
    window.__gate = 1;
    g.hidden = true;
    openLogin(show);
    var x = $("#lg-x");
    if (x) x.style.display = "none";
    if (getAcc()) {
      $("#lg-t").textContent = "Sign in";
      $("#lg-p").textContent = "Sign in to continue to BM Monitor.";
    } else {
      $("#lg-t").textContent = "Create the administrator account";
    }
  }
  g.addEventListener("click", function (e) {
    var b = e.target.closest("[data-g]");
    if (!b) return;
    var a = b.dataset.g;
    if (a == "adm") {
      hide();
      window.__supMode = 0;
      try {
        openAdmin();
      } catch (x) {}
    }
    if (a == "sup") {
      hide();
      var isS = false;
      try {
        isS = window.__role() == "supervisor";
      } catch (x) {}
      window.__supMode = isS ? 0 : 1;
      try {
        openAdmin(isS ? "myrep" : "supr");
      } catch (x) {}
    }
    if (a == "st") {
      var v = $("#gt-st").value;
      if (!v) {
        $("#gt-e").textContent = "Select a state first.";
        return;
      }
      hide();
      var t = $('#sbar button[data-i="' + v + '"]');
      if (t) t.click();
      var s = $("#story");
      if (s) s.scrollIntoView({ behavior: "smooth" });
    }
    if (a == "nat") {
      hide();
      window.__supMode = 0;
      var n = $('#sbar button[data-i="0"]');
      if (n) n.click();
      var z = $("#zr");
      if (z) z.click();
      window.scrollTo(0, 0);
    }
    if (a == "out") {
      hide();
      try {
        logout();
      } catch (x) {}
      setTimeout(login, 50);
    }
  });
  var sw = $("#nSw");
  if (sw)
    sw.addEventListener("click", function (e) {
      e.preventDefault();
      show();
    });
  ["#acl", "#ana-x"].forEach(function (q) {
    var c = $(q);
    if (c)
      c.addEventListener("click", function () {
        setTimeout(function () {
          if (AUTHED) show();
        }, 30);
      });
  });
  /* hide the chooser whenever the admin page or report opens, and bring the sign-in back after any sign-out */
  new MutationObserver(function () {
    if (!$("#adm").hidden) g.hidden = true;
  }).observe($("#adm"), { attributes: true, attributeFilter: ["hidden"] });
  var ao = $("#alo");
  if (ao)
    ao.addEventListener("click", function () {
      setTimeout(login, 50);
    });
  setInterval(function () {
    if (!AUTHED && $("#login").hidden) login();
  }, 1200);
  if (AUTHED) {
    window.__gate = 1;
    show();
  } else login();
  document.documentElement.classList.remove("gp");
})();
