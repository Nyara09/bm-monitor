/*
 * js/particles-background.js
 * Animated particles.js background for the sign-in page and the view chooser ("gate").
 * Colours follow the colour theme; it is skipped for reduced-motion users and
 * destroyed whenever its screen is hidden so it costs nothing while you work.
 */
(function () {
  if (typeof particlesJS === "undefined") return;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  function themeColour() {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--v").trim();
    return /^#[0-9a-f]{3,8}$/i.test(v) ? v : "#A0522D";
  }
  function isLight() {
    return document.documentElement.getAttribute("data-theme") === "light";
  }
  function config(host) {
    var c = themeColour();
    var dot = host.classList.contains("lgpage") ? "#ffffff" : isLight() ? "#555555" : "#ffffff";
    var small = window.innerWidth < 700;
    return {
      particles: {
        number: { value: small ? 32 : 60, density: { enable: true, value_area: 900 } },
        color: { value: [c, dot] },
        shape: { type: "circle" },
        opacity: { value: 0.55, random: true },
        size: { value: 3, random: true },
        line_linked: { enable: true, distance: 140, color: c, opacity: 0.35, width: 1 },
        move: { enable: true, speed: 1.2, direction: "none", out_mode: "out" },
      },
      interactivity: {
        detect_on: "window",
        events: {
          onhover: { enable: !small, mode: "grab" },
          onclick: { enable: false },
          resize: true,
        },
        modes: { grab: { distance: 160, line_linked: { opacity: 0.6 } } },
      },
      retina_detect: false,
    };
  }

  var live = [];
  function start(host) {
    if (!host || host.querySelector(".pj-bg")) return;
    var box = document.createElement("div");
    var id = "pj-" + Math.random().toString(36).slice(2, 8);
    box.className = "pj-bg";
    // inline, so a stale cached stylesheet can never push it into the page grid
    box.style.cssText = "position:fixed;inset:0;z-index:0;pointer-events:none";
    box.id = id;
    host.insertBefore(box, host.firstChild);
    host.classList.add("has-pj");
    particlesJS(id, config(host));
    live.push({ host: host, box: box });
  }
  function stop(host) {
    live = live.filter(function (l) {
      if (l.host !== host) return true;
      var all = window.pJSDom || [];
      var p = all.filter(function (d) {
        return d.pJS.canvas.el.parentNode === l.box;
      })[0];
      try {
        if (p) p.pJS.fn.vendors.destroypJS(); // this sets pJSDom to null
      } catch (e) {}
      window.pJSDom = all.filter(function (d) {
        return d !== p;
      });
      if (l.box.parentNode) l.box.parentNode.removeChild(l.box);
      host.classList.remove("has-pj");
      return false;
    });
  }
  function restart(host) {
    stop(host);
    start(host);
  }

  // Sign-in page, and the view chooser: both are shown/hidden by their own scripts
  function watch(el) {
    function sync() {
      if (el.hidden) stop(el);
      else if (!el.querySelector(".pj-bg")) start(el);
    }
    new MutationObserver(sync).observe(el, { attributes: true, attributeFilter: ["hidden"] });
    sync();
  }
  var lg = document.querySelector(".lgpage");
  if (lg) watch(lg);
  var gate = document.getElementById("gate");
  if (gate) watch(gate);

  // Re-colour when the theme changes
  var t;
  new MutationObserver(function () {
    clearTimeout(t);
    t = setTimeout(function () {
      live.slice().forEach(function (l) {
        restart(l.host);
      });
    }, 150);
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme", "style", "data-palette"],
  });
})();
