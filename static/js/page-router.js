/*
 * js/page-router.js
 * Opens the right view from the URL hash and moves between the map page, the admin page and the screen pages.
 * URLs come from window.URLS, which the Django templates fill in (see monitor/context_processors.py).
 */

(function () {
  var PAGE = window.PAGE || "map";
  var SCREEN = window.SCREEN || ""; /* set by the screen template, e.g. "dashboard" */
  var ROUTES = {
    overview: ["nat"],
    admin: ["adm"],
    supervisor: ["sup"],
    dashboard: ["adm", "sup", "dash"],
    "supervisor-report": ["sup", "adm", "supr"],
    "dca-report": ["sup", "adm", "dcar"],
    "daily-reports": ["adm", "sup", "rep"],
    "daily-analysis": ["adm", "sup", "ana"],
    analytics: ["adm", "sup", "anl"],
    "mda-registrations": ["adm", "sup", "mda"],
    "inventory-report": ["adm", "sup", "msum"],
    "incident-log": ["sup", "adm", "regt"],
    "my-report": ["sup", "adm", "myrep"],
    "enter-daily-report": ["sup", "adm", "new"],
    "site-targets": ["adm", "sup", "targets"],
    mdas: ["adm", "sup", "mdam"],
    inventory: ["adm", "sup", "inv"],
    "deployment-plan": ["adm", "sup", "dplan"],
    "data-collectors": ["adm", "sup", "dca"],
    counties: ["adm", "sup", "counties"],
    "cities-towns": ["adm", "sup", "places"],
    airports: ["adm", "sup", "airports"],
    "registration-sites": ["adm", "sup", "sites"],
    roads: ["adm", "sup", "roads"],
    "users-roles": ["adm", "sup", "users"],
    "backup-data": ["adm", "sup", "bak"],
  };
  var hash = SCREEN || (location.hash || "").replace(/^#\/?/, "").toLowerCase();
  var route = ROUTES[hash];
  var ADMIN_CARDS = { adm: 1, sup: 1 };

  function cardsOf(r) {
    return r.length > 2 ? r.slice(0, r.length - 1) : r;
  }
  function tabOf(r) {
    return r.length > 2 ? r[r.length - 1] : null;
  }

  /* ---------- MAP PAGE: administrator / supervisor open admin.html ---------- */
  if (PAGE === "map") {
    var go = function (h) {
      location.href = window.URLS.admin + (h ? "#" + h : "");
    };
    document.addEventListener(
      "click",
      function (e) {
        var b = e.target.closest && e.target.closest("#gate [data-g]");
        if (b && ADMIN_CARDS[b.dataset.g]) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          go(b.dataset.g === "sup" ? "supervisor" : "admin");
          return;
        }
        if (e.target.closest && e.target.closest("#tAm")) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          go("admin");
        }
      },
      true,
    );
    /* map page + admin tab hash (for example #analytics) -> admin page */
    if (route && ADMIN_CARDS[cardsOf(route)[0]]) return go(hash);
    if (hash === "overview") {
      var n = 0,
        t = setInterval(function () {
          var g = document.getElementById("gate"),
            b = g && !g.hidden && g.querySelector('[data-g="nat"]');
          if (b) {
            clearInterval(t);
            b.click();
          } else if (++n > 400) clearInterval(t);
        }, 300);
    }
    return;
  }

  /* ---------- ADMIN PAGE: pick the view from the hash, Close returns to the map page ---------- */
  var leaving = false;
  ["#acl", "#ana-x"].forEach(function (q) {
    document.addEventListener(
      "click",
      function (e) {
        if (e.target.closest && e.target.closest(q)) {
          leaving = true;
          location.href = window.URLS.map;
        }
      },
      true,
    );
  });
  /* buttons that mean "show this on the map": the map is not on this page, so open the map page.
     map-intent.js (map page) does the zoom. Only calls made by these buttons are redirected. */
  var fromMapButton = false,
    zoomStateHere = window.zoomState,
    locateHere = window.locate;
  document.addEventListener(
    "click",
    function (e) {
      var hit =
        e.target.closest &&
        e.target.closest("#drw-map, [data-a='loc'], #amod [data-m='show']");
      if (!hit) return;
      fromMapButton = true;
      setTimeout(function () {
        fromMapButton = false;
      }, 0);
    },
    true,
  );
  window.zoomState = function (si) {
    if (fromMapButton) {
      leaving = true;
      location.href = window.URLS.map + "?map=state&si=" + si;
      return;
    }
    return zoomStateHere.apply(this, arguments);
  };
  window.locate = function (lon, lat) {
    if (fromMapButton) {
      leaving = true;
      location.href = window.URLS.map + "?map=locate&lon=" + lon + "&lat=" + lat;
      return;
    }
    return locateHere.apply(this, arguments);
  };
  /* screen pages: the sidebar tabs open the matching screen URL instead of switching in place */
  if (SCREEN) {
    var PAGE_OF = {};
    Object.keys(ROUTES).forEach(function (k) {
      var t = tabOf(ROUTES[k]);
      if (t) PAGE_OF[t] = k;
    });
    document.addEventListener(
      "click",
      function (e) {
        var b = e.target.closest && e.target.closest("#atabs button[data-t]");
        var file = b && PAGE_OF[b.dataset.t];
        if (!file) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (file !== SCREEN) location.href = window.URLS.screens + file + "/";
      },
      true,
    );
  }
  var r = route || ROUTES["admin"];
  setInterval(function () {
    if (leaving) return;
    var gate = document.getElementById("gate");
    if (!gate || gate.hidden) return; /* still signing in, or already inside a view */
    var cards = cardsOf(r),
      tab = tabOf(r),
      btn = null;
    for (var i = 0; i < cards.length && !btn; i++)
      btn = gate.querySelector('[data-g="' + cards[i] + '"]');
    if (!btn) {
      leaving = true; /* this user may not open admin views: back to the Switch view screen */
      location.href = window.URLS.map;
      return;
    }
    btn.click();
    if (tab)
      setTimeout(function () {
        try {
          window.openAdmin(tab);
        } catch (e) {}
      }, 250);
  }, 300);
})();
