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
