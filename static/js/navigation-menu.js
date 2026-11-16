/*
 * js/navigation-menu.js
 * Navigation menu behaviour.
 */

(function () {
  var b = document.body,
    t = document.createElement("button");
  t.id = "nvt";
  t.setAttribute("aria-label", "Show or hide the menu");
  function ic() {
    var open = wide() ? !b.classList.contains("nv-off") : b.classList.contains("nv-open");
    t.innerHTML =
      '<span class="bx ' + (open ? "bx-chevron-left" : "bx-chevron-right") + '"></span>';
    t.title = open ? "Close menu" : "Open menu";
  }
  var o = document.createElement("div");
  o.id = "nvb";
  b.appendChild(o);
  b.appendChild(t);
  /* Keep the toggle hidden while a screen is still loading, so an empty page never shows a lone
     round button. It appears as soon as something is on screen (screen content, the Administrator
     or report panel, or the map once the view chooser is closed), and after 3 seconds at most. */
  t.style.visibility = "hidden";
  (function () {
    var done = false,
      mo = null;
    function shown(sel) {
      var e = document.querySelector(sel);
      return !!e && !e.hidden && getComputedStyle(e).display != "none";
    }
    function ready() {
      var ab = document.getElementById("abody");
      if (ab && ab.children.length) return true;
      if (shown("#adm") || shown("#rep")) return true;
      var g = document.getElementById("gate");
      if (g && !ab) return !shown("#gate") && document.readyState === "complete";
      return !ab && !g && document.readyState === "complete";
    }
    function reveal() {
      if (done) return;
      done = true;
      t.style.visibility = "";
      if (mo) mo.disconnect();
    }
    function check() {
      if (ready()) reveal();
    }
    mo = new MutationObserver(check);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
    addEventListener("load", check);
    setTimeout(reveal, 3000);
    check();
  })();
  try {
    if (localStorage.getItem("bioreg.nv") == "off") b.classList.add("nv-off");
  } catch (e) {}
  function wide() {
    return innerWidth > 1280;
  }
  ic();
  t.onclick = function () {
    if (wide()) {
      b.classList.toggle("nv-off");
      try {
        localStorage.setItem("bioreg.nv", b.classList.contains("nv-off") ? "off" : "on");
      } catch (e) {}
    } else b.classList.toggle("nv-open");
    ic();
    setTimeout(function () {
      dispatchEvent(new Event("resize"));
    }, 280);
  };
  o.onclick = function () {
    b.classList.remove("nv-open");
    ic();
  };
  document.querySelector("nav.top").addEventListener("click", function (e) {
    if (!wide() && e.target.closest("a,#thm,.pf-i")) {
      b.classList.remove("nv-open");
      ic();
    }
  });
  addEventListener("resize", function () {
    if (wide()) b.classList.remove("nv-open");
    ic();
  });
  var ad = document.getElementById("adm");
  function sync() {
    var h = ad && !ad.hidden && getComputedStyle(ad).display != "none";
    t.style.display = h ? "none" : "";
  }
  if (ad) {
    new MutationObserver(sync).observe(ad, { attributes: true });
    sync();
  }
})();
