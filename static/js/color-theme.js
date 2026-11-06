/*
 * js/color-theme.js
 * Colour theme choice: "BM Brand" (current), "Classic" (the previous violet look) or "Custom"
 * (the person picks a main colour and a second colour).
 *
 * How it works:
 *  - The colours of every page come from CSS variables (--v main colour, --c second colour, ...).
 *  - "BM Brand" uses the variables as the stylesheets define them, so nothing is overridden.
 *  - "Classic" and "Custom" write the variables on the <html> element, which wins over the
 *    stylesheets. They are written again whenever the light / dark mode changes.
 *  - The choice is kept in this browser (localStorage key "bioreg.palette").
 *
 * To add another ready-made theme, add an entry to PRESETS below.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "bioreg.palette";
  var root = document.documentElement;

  /* Ready-made themes. Only the variables listed are replaced; "brand" replaces none. */
  var PRESETS = {
    brand: {
      label: "BM Brand",
      note: "Current: gold, terracotta and slate",
      swatch: ["#C5A059", "#A0522D", "#2F353B"],
    },
    classic: {
      label: "Classic",
      note: "Previous: violet and cyan",
      swatch: ["#7c5cff", "#5ee7ff", "#0b0818"],
      dark: {
        bg: "#0b0818",
        panel: "rgba(22, 19, 42, 0.62)",
        line: "rgba(167, 139, 250, 0.22)",
        tx: "#eeecff",
        mu: "#9b98c0",
        g: "#3ef0b0",
        a: "#ffc861",
        r: "#ff6b8b",
        b: "#8fa2ff",
        c: "#5ee7ff",
        v: "#7c5cff",
        vt: "#a78bfa",
        "v-rgb": "124, 92, 255",
        "on-v": "#ffffff",
      },
      light: {
        bg: "#f2f4fa",
        panel: "rgba(255, 255, 255, 0.85)",
        line: "rgba(70, 60, 150, 0.18)",
        tx: "#14122b",
        mu: "#5b5880",
        g: "#0f9d6b",
        a: "#b97800",
        r: "#d6335c",
        b: "#4b5fd6",
        c: "#0a86a8",
        v: "#6d4cf0",
        vt: "#6d4cf0",
        "v-rgb": "109, 76, 240",
        "on-v": "#ffffff",
      },
    },
  };
  var DEFAULT_CUSTOM = { main: "#2E7D57", second: "#A0522D" };
  var ALL_VARIABLES = [
    "bg",
    "panel",
    "line",
    "tx",
    "mu",
    "g",
    "a",
    "r",
    "b",
    "c",
    "v",
    "vt",
    "v-rgb",
    "on-v",
  ];

  /* ------------------------------------------------------------ colour helpers */

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  function rgbToHex(rgb) {
    return (
      "#" +
      rgb
        .map(function (n) {
          return ("0" + Math.round(n).toString(16)).slice(-2);
        })
        .join("")
    );
  }
  function luminance(rgb) {
    var c = rgb.map(function (n) {
      n /= 255;
      return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) {
    var la = luminance(a),
      lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }
  function mix(rgb, target, amount) {
    return rgb.map(function (n, i) {
      return n + (target[i] - n) * amount;
    });
  }
  /* The main colour as text on the page background: darken (light mode) or lighten (dark mode) until it is readable. */
  function readableOn(rgb, backgroundRgb, towards) {
    var out = rgb;
    for (var step = 0; step < 20 && contrast(out, backgroundRgb) < 4.5; step++)
      out = mix(out, towards, 0.08);
    return out;
  }
  function isHex(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value));
  }

  /* ------------------------------------------------------------ choice storage */

  function readChoice() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (
        saved &&
        (saved.mode === "brand" || saved.mode === "classic" || saved.mode === "custom")
      ) {
        saved.main = isHex(saved.main) ? saved.main : DEFAULT_CUSTOM.main;
        saved.second = isHex(saved.second) ? saved.second : DEFAULT_CUSTOM.second;
        return saved;
      }
    } catch (error) {}
    return { mode: "brand", main: DEFAULT_CUSTOM.main, second: DEFAULT_CUSTOM.second };
  }
  function saveChoice(choice) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch (error) {}
  }

  /* ------------------------------------------------------------ applying */

  function themeName() {
    /* The stylesheets treat a page without data-theme="light" as dark. */
    return root.dataset.theme === "light" ? "light" : "dark";
  }
  function clearOverrides() {
    ALL_VARIABLES.forEach(function (name) {
      root.style.removeProperty("--" + name);
    });
  }
  function customVariables(choice, theme) {
    var main = hexToRgb(choice.main);
    var second = hexToRgb(choice.second);
    var pageBackground = theme === "light" ? [244, 243, 240] : [0, 0, 0];
    var text = readableOn(main, pageBackground, theme === "light" ? [0, 0, 0] : [255, 255, 255]);
    var onMain =
      contrast(main, [0, 0, 0]) >= contrast(main, [255, 255, 255]) ? "#000000" : "#ffffff";
    var variables = {
      v: choice.main,
      vt: rgbToHex(text),
      "v-rgb": main.join(", "),
      "on-v": onMain,
      c: rgbToHex(
        readableOn(second, pageBackground, theme === "light" ? [0, 0, 0] : [255, 255, 255]),
      ),
    };
    if (theme === "dark") variables.line = "rgba(" + main.join(", ") + ", 0.22)";
    return variables;
  }
  function apply() {
    var choice = readChoice();
    var theme = themeName();
    clearOverrides();
    var variables = null;
    if (choice.mode === "classic") variables = PRESETS.classic[theme];
    if (choice.mode === "custom") variables = customVariables(choice, theme);
    if (variables) {
      Object.keys(variables).forEach(function (name) {
        root.style.setProperty("--" + name, variables[name]);
      });
    }
    root.dataset.palette = choice.mode;
    updatePanel(choice);
  }

  /* Apply as early as possible so the page does not flash the wrong colours. */
  apply();
  new MutationObserver(function () {
    var theme = themeName();
    if (apply.lastTheme !== theme) {
      apply.lastTheme = theme;
      apply();
    }
  }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  apply.lastTheme = themeName();
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) apply();
  });

  /* ------------------------------------------------------------ the picker panel */

  var panel = null;
  var button = null;

  function swatches(colors) {
    return colors
      .map(function (c) {
        return '<i style="background:' + c + '"></i>';
      })
      .join("");
  }
  function buildPanel() {
    panel = document.createElement("div");
    panel.id = "pal-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Colour theme");
    panel.hidden = true;
    panel.innerHTML =
      '<div class="pal-title">Colour theme</div>' +
      ["brand", "classic"]
        .map(function (key) {
          return (
            '<button type="button" class="pal-opt" data-mode="' +
            key +
            '"><span class="pal-sw">' +
            swatches(PRESETS[key].swatch) +
            "</span><span><b>" +
            PRESETS[key].label +
            "</b><small>" +
            PRESETS[key].note +
            "</small></span></button>"
          );
        })
        .join("") +
      '<button type="button" class="pal-opt" data-mode="custom"><span class="pal-sw" id="pal-custom-sw"></span>' +
      "<span><b>Custom</b><small>Choose your own colours</small></span></button>" +
      '<div class="pal-custom" id="pal-custom">' +
      '<label>Main colour <input type="color" id="pal-main" /></label>' +
      '<label>Second colour <input type="color" id="pal-second" /></label>' +
      "</div>" +
      '<div class="pal-foot"><button type="button" id="pal-reset">Back to BM Brand</button></div>';
    document.body.appendChild(panel);

    panel.addEventListener("click", function (event) {
      var option = event.target.closest(".pal-opt");
      if (option) choose(option.dataset.mode);
      if (event.target.id === "pal-reset") choose("brand");
    });
    ["pal-main", "pal-second"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function () {
        var choice = readChoice();
        choice.mode = "custom";
        choice.main = document.getElementById("pal-main").value;
        choice.second = document.getElementById("pal-second").value;
        saveChoice(choice);
        apply();
      });
    });
    document.addEventListener("click", function (event) {
      if (!panel.hidden && !panel.contains(event.target) && !button.contains(event.target))
        closePanel();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !panel.hidden) {
        closePanel();
        if (button) button.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (!panel.hidden) placePanel();
    });
  }
  function choose(mode) {
    var choice = readChoice();
    choice.mode = mode;
    saveChoice(choice);
    apply();
  }
  function updatePanel(choice) {
    if (!panel) return;
    panel.querySelectorAll(".pal-opt").forEach(function (option) {
      option.classList.toggle("on", option.dataset.mode === choice.mode);
      option.setAttribute("aria-pressed", option.dataset.mode === choice.mode ? "true" : "false");
    });
    document.getElementById("pal-main").value = choice.main;
    document.getElementById("pal-second").value = choice.second;
    document.getElementById("pal-custom-sw").innerHTML = swatches([choice.main, choice.second]);
    document.getElementById("pal-custom").classList.toggle("on", choice.mode === "custom");
  }
  function placePanel() {
    var rect = button.getBoundingClientRect();
    var width = panel.offsetWidth;
    var left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    panel.style.left = left + "px";
    if (rect.top > window.innerHeight / 2) {
      panel.style.top = "auto";
      panel.style.bottom = window.innerHeight - rect.top + 8 + "px";
    } else {
      panel.style.bottom = "auto";
      panel.style.top = rect.bottom + 8 + "px";
    }
  }
  function openPanel() {
    panel.hidden = false;
    button.setAttribute("aria-expanded", "true");
    placePanel();
  }
  function closePanel() {
    panel.hidden = true;
    if (button) button.setAttribute("aria-expanded", "false");
  }

  /* One palette button next to each light / dark button: the map page has two (map and admin shells). */
  function makeButton(themeButton) {
    var made = document.createElement("button");
    made.type = "button";
    made.className = "pal-btn";
    made.title = "Colour theme";
    made.setAttribute("aria-label", "Colour theme");
    made.setAttribute("aria-haspopup", "dialog");
    made.setAttribute("aria-expanded", "false");
    made.innerHTML = '<i class="bx bx-palette"></i>';
    if (themeButton) {
      made.className = themeButton.className + " pal-btn pal-inline";
      themeButton.insertAdjacentElement("afterend", made);
    } else {
      made.className = "pal-btn pal-floating";
      document.body.appendChild(made);
    }
    made.addEventListener("click", function () {
      var wasOpen = !panel.hidden && button === made;
      if (wasOpen) {
        closePanel();
        return;
      }
      button = made;
      openPanel();
    });
    return made;
  }
  function addButtons() {
    var themeButtons = ["snth", "thm"]
      .map(function (id) {
        return document.getElementById(id);
      })
      .filter(Boolean);
    if (!themeButtons.length) themeButtons = [null];
    themeButtons.forEach(makeButton);
  }

  function start() {
    buildPanel();
    addButtons();
    updatePanel(readChoice());
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
