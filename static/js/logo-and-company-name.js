/*
 * js/logo-and-company-name.js
 * Adds the logo and company name.
 */

/* LOGO: one uploaded image replaces every logo in the system. Stored in this browser (localStorage "bioreg.logo"). */
(function () {
  "use strict";
  var KEY = "bioreg.logo";
  function get() {
    try {
      return localStorage.getItem(KEY) || "";
    } catch (e) {
      return "";
    }
  }
  function apply() {
    var d = get(),
      st = document.getElementById("logo-css");
    if (!st) {
      st = document.createElement("style");
      st.id = "logo-css";
      document.head.appendChild(st);
    }
    var base = d
      ? 'body .logo,body .r-logo{background:url("' +
        d +
        '") center/contain no-repeat!important;box-shadow:none!important;border-radius:6px!important}body .logo::after,body .r-logo::after{display:none!important}'
      : "";
    st.textContent = base;
    if (d) {
      /* keep the real shape: a wide logo gets a wider box (height stays the same) */
      var im = new Image();
      im.onload = function () {
        var k = Math.min(4, Math.max(1, im.width / im.height));
        st.textContent =
          base +
          "body .logo{width:" +
          (34 * k).toFixed(0) +
          "px!important}body .lg-side .logo{width:" +
          (46 * k).toFixed(0) +
          "px!important}body .r-logo{width:" +
          (38 * k).toFixed(0) +
          "px!important}body #logo-prev{width:" +
          (56 * k).toFixed(0) +
          "px!important}";
      };
      im.src = d;
    }
    var ic = document.getElementById("logo-icon");
    if (d) {
      if (!ic) {
        ic = document.createElement("link");
        ic.id = "logo-icon";
        ic.rel = "icon";
        document.head.appendChild(ic);
      }
      ic.href = d;
    } else if (ic) ic.remove();
  }
  function toast(m) {
    try {
      window.toast(m);
    } catch (e) {
      alert(m);
    }
  }
  function save(d) {
    try {
      d ? localStorage.setItem(KEY, d) : localStorage.removeItem(KEY);
    } catch (e) {
      return toast("Could not save the logo in this browser");
    }
    apply();
    if (window.admRender) window.admRender(true);
    toast(d ? "Logo updated everywhere" : "Default logo restored");
  }
  function load(f) {
    if (!f) return;
    if (!/^image\/(png|jpeg|svg\+xml|webp)$/.test(f.type))
      return toast("Choose a PNG, JPG, SVG or WebP image");
    if (f.size > 3 * 1024 * 1024) return toast("The image is larger than 3 MB");
    var r = new FileReader();
    r.onerror = function () {
      toast("Could not read that file");
    };
    r.onload = function () {
      if (f.type === "image/svg+xml")
        return r.result.length < 400000 ? save(r.result) : toast("That SVG is too large");
      var im = new Image();
      im.onerror = function () {
        toast("That image could not be opened");
      };
      im.onload = function () {
        /* shrink to at most 256 px so it stays light, keep transparency */
        var k = Math.min(1, 256 / Math.max(im.width, im.height)),
          c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.width * k));
        c.height = Math.max(1, Math.round(im.height * k));
        c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        save(c.toDataURL("image/png"));
      };
      im.src = r.result;
    };
    r.readAsDataURL(f);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-fa=logop],[data-fa=logor]");
    if (!b) return;
    if (b.dataset.fa === "logop") document.getElementById("logof").click();
    else save("");
  });
  document.addEventListener("change", function (e) {
    if (e.target.id === "logof") {
      load(e.target.files[0]);
      e.target.value = "";
    }
  });
  /* COMPANY NAME: replaces "BM Monitor" / "BM Monitor" in the page text (original text is remembered so it can be restored) */
  var NK = "bioreg.company",
    D1 = "BM Monitor",
    D2 = "BM Monitor",
    orig = new WeakMap(),
    touched = [],
    timer = 0,
    mo;
  function cname() {
    try {
      return (localStorage.getItem(NK) || "").trim();
    } catch (e) {
      return "";
    }
  }
  function applyName() {
    var n = cname(),
      list = [];
    if (mo) mo.disconnect();
    if (!n) {
      touched.forEach(function (t) {
        if (orig.has(t)) t.nodeValue = orig.get(t);
      });
      touched = [];
    } else {
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (t) {
          var p = t.parentNode && t.parentNode.nodeName;
          return p === "SCRIPT" || p === "STYLE" || p === "TEXTAREA"
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        },
      });
      while (w.nextNode()) list.push(w.currentNode);
      list.forEach(function (t) {
        var o = orig.has(t) ? orig.get(t) : t.nodeValue;
        if (o.indexOf(D1) < 0 && o.indexOf(D2) < 0) return;
        var v = o
          .split(D1)
          .join(n)
          .split(D2)
          .join(n + " Admin");
        if (v !== t.nodeValue) {
          if (!orig.has(t)) {
            orig.set(t, o);
            touched.push(t);
          }
          t.nodeValue = v;
        }
      });
    }
    if (mo) mo.observe(document.body, { childList: true, subtree: true });
  }
  function later() {
    clearTimeout(timer);
    timer = setTimeout(applyName, 150);
  }
  function saveName(v) {
    try {
      v ? localStorage.setItem(NK, v) : localStorage.removeItem(NK);
    } catch (e) {
      return toast("Could not save the name in this browser");
    }
    applyName();
    toast(v ? "Company name updated everywhere" : "Default name restored");
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-fa=conm],[data-fa=conr]");
    if (!b) return;
    if (b.dataset.fa === "conr") {
      var i = document.getElementById("co-name");
      if (i) i.value = "";
      return saveName("");
    }
    saveName((document.getElementById("co-name").value || "").trim().slice(0, 60));
  });
  document.addEventListener("keydown", function (e) {
    if (e.target.id === "co-name" && e.key === "Enter") {
      e.preventDefault();
      saveName(e.target.value.trim().slice(0, 60));
    }
  });
  window.__applyLogo = apply;
  apply();
  function startName() {
    mo = new MutationObserver(later);
    applyName();
  }
  if (document.body) startName();
  else document.addEventListener("DOMContentLoaded", startName);
})();
