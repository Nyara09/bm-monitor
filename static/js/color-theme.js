/*
 * js/color-theme.js
 * Colour theme for everybody. An admin chooses it in Administration > Logo & Backup:
 * "System" (Earth Terracotta with black and white, which the admin can edit) or "Custom". Each
 * has three colours: main, second and third.
 *
 * How it works:
 *  - The colours of every page come from CSS variables (--v main colour, --c second colour, ...).
 *  - "System" uses the variables as the stylesheets define them, so nothing is overridden, until
 *    the admin edits the System colours.
 *  - The third colour (--s) is the dark colour behind panels, bars and borders.
 *  - "Custom" (and an edited "System") write the variables on the <html> element, which wins over the
 *    stylesheets. They are written again whenever the light / dark mode changes.
 *  - The choice is saved on the server (/colour-theme/), so every user sees it. This browser keeps
 *    a copy (localStorage "bioreg.colour-theme") so the page opens in the right colours at once.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "bioreg.colour-theme";
  var URL = "/colour-theme/";
  var root = document.documentElement;

  var DEFAULT_SYSTEM = { main: "#A0522D", second: "#FFFFFF", third: "#000000" };
  var DEFAULT_CUSTOM = { main: "#2E7D57", second: "#A0522D", third: "#2F353B" };
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
    "s",
    "s-rgb",
  ];

  /* ------------------------------------------------------------ colour helpers */

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
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

  function colourSet(source, fallback) {
    source = source || {};
    return {
      main: isHex(source.main) ? source.main : fallback.main,
      second: isHex(source.second) ? source.second : fallback.second,
      third: isHex(source.third) ? source.third : fallback.third,
    };
  }
  function cleanChoice(data) {
    var custom = colourSet(data, DEFAULT_CUSTOM);
    return {
      mode: data && data.mode === "custom" ? data.mode : "system",
      main: custom.main,
      second: custom.second,
      third: custom.third,
      system: colourSet(data && data.system, DEFAULT_SYSTEM),
    };
  }
  function readChoice() {
    try {
      return cleanChoice(
        JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"),
      );
    } catch (error) {
      return cleanChoice(null);
    }
  }
  function keepCopy(choice) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch (error) {}
  }

  /* ------------------------------------------------------------ applying */

  var current = readChoice();
  var saved =
    current; /* the choice kept on the server; `current` may be an unsaved preview */

  function themeName() {
    /* The stylesheets treat a page without data-theme="light" as dark. */
    return root.dataset.theme === "light" ? "light" : "dark";
  }
  function clearOverrides() {
    ALL_VARIABLES.forEach(function (name) {
      root.style.removeProperty("--" + name);
    });
  }
  function sameColours(one, two) {
    return ["main", "second", "third"].every(function (key) {
      return one[key].toLowerCase() === two[key].toLowerCase();
    });
  }
  function colourVariables(colours, theme) {
    var main = hexToRgb(colours.main);
    var second = hexToRgb(colours.second);
    var third = hexToRgb(colours.third);
    var toward = theme === "light" ? [0, 0, 0] : [255, 255, 255];
    var pageBackground = theme === "light" ? [244, 243, 240] : [0, 0, 0];
    var text = readableOn(main, pageBackground, toward);
    var onMain =
      contrast(main, [0, 0, 0]) >= contrast(main, [255, 255, 255])
        ? "#000000"
        : "#ffffff";
    /* The third colour is a dark surface and text colour: keep it dark enough to read white on it. */
    var slate = readableOn(third, [255, 255, 255], [0, 0, 0]);
    var variables = {
      v: colours.main,
      vt: rgbToHex(text),
      "v-rgb": main.join(", "),
      "on-v": onMain,
      c: rgbToHex(readableOn(second, pageBackground, toward)),
      s: rgbToHex(slate),
      "s-rgb": slate.map(Math.round).join(", "),
    };
    if (theme === "dark")
      variables.line = "rgba(" + main.join(", ") + ", 0.22)";
    return variables;
  }
  function apply(choice) {
    current = choice || current;
    var theme = themeName();
    clearOverrides();
    var variables = null;
    if (current.mode === "custom") variables = colourVariables(current, theme);
    if (
      current.mode === "system" &&
      !sameColours(current.system, DEFAULT_SYSTEM)
    )
      variables = colourVariables(current.system, theme);
    if (variables) {
      Object.keys(variables).forEach(function (name) {
        root.style.setProperty("--" + name, variables[name]);
      });
    }
    root.dataset.palette = current.mode;
    showChoice();
  }

  /* Apply the copy kept in this browser at once, then ask the server for the real choice. */
  apply();
  new MutationObserver(function () {
    var theme = themeName();
    if (apply.lastTheme !== theme) {
      apply.lastTheme = theme;
      apply();
    }
  }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  apply.lastTheme = themeName();

  function csrfToken() {
    var match = document.cookie.match(/(?:^|; )csrftoken=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : "";
  }
  function fromServer(response) {
    if (!response.ok) throw new Error("not saved");
    return response.json();
  }
  function accept(data) {
    var choice = cleanChoice(data);
    saved = choice;
    keepCopy(choice);
    apply(choice);
    return choice;
  }
  function load() {
    fetch(URL, {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    })
      .then(fromServer)
      .then(accept)
      .catch(function () {});
  }
  function save(choice) {
    return fetch(URL, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken(),
      },
      body: JSON.stringify(choice),
    })
      .then(fromServer)
      .then(accept);
  }

  /* ------------------------------------------------------------ the card (admins only) */

  /*
   * The Logo & Backup screen writes <div id="pal-card"> for admins only. When it appears, this
   * script fills it. Nobody else gets any colour control.
   */
  var card = null;
  var editing =
    null; /* "system" or "custom" while its colours are being edited */

  function swatches(colors) {
    return colors
      .map(function (c) {
        return '<i style="background:' + c + '"></i>';
      })
      .join("");
  }
  function buildCard(host) {
    card = host;
    card.dataset.ready = "1";
    card.innerHTML =
      '<h3><span class="bx bx-palette"></span> Colour theme</h3>' +
      '<p class="em" style="text-align:left">Choose the colours every user sees. The change is saved for everybody and shows the next time a page opens. Each theme has a main colour, a second colour and a third colour (the dark colour behind panels and bars).</p>' +
      '<div class="pal-list">' +
      '<div class="pal-item"><button type="button" class="pal-opt" data-mode="system"><span class="pal-sw" id="pal-system-sw"></span>' +
      "<span><b>System</b><small>Terracotta, white and black</small></span></button>" +
      '<button type="button" class="pal-edit" data-edit="system"><span class="bx bx-edit"></span> Edit</button></div>' +
      '<div class="pal-item"><button type="button" class="pal-opt" data-mode="custom"><span class="pal-sw" id="pal-custom-sw"></span>' +
      "<span><b>Custom</b><small>Your own colours</small></span></button></div>" +
      "</div>" +
      '<div class="pal-editor" id="pal-editor" hidden>' +
      '<div class="pal-etitle" id="pal-etitle"></div>' +
      '<div class="pal-row">' +
      '<label>Main <input type="color" id="pal-main" /></label>' +
      '<label>Second <input type="color" id="pal-second" /></label>' +
      '<label>Third <input type="color" id="pal-third" /></label>' +
      "</div>" +
      '<div class="pal-actions">' +
      '<button type="button" class="btn pri" id="pal-save"><span class="bx bx-save"></span> Save colours</button>' +
      '<button type="button" class="btn" id="pal-defaults" hidden><span class="bx bx-reset"></span> Back to BM colours</button>' +
      "</div></div>" +
      '<p class="em pal-msg" id="pal-msg" role="status" style="text-align:left"></p>';

    card.addEventListener("click", function (event) {
      var option = event.target.closest(".pal-opt");
      if (option) {
        var mode = option.dataset.mode;
        if (mode === "custom") {
          openEditor("custom");
        } else {
          closeEditor();
          saveAndTell(withMode(mode));
        }
      }
      if (event.target.closest(".pal-edit")) openEditor("system");
      if (event.target.closest("#pal-save")) saveEditor();
      if (event.target.closest("#pal-defaults")) {
        setInputs(DEFAULT_SYSTEM);
        previewEditor();
      }
    });
    ["pal-main", "pal-second", "pal-third"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", previewEditor);
    });
    showChoice();
  }
  function withMode(mode) {
    var choice = cleanChoice(saved);
    choice.mode = mode;
    return choice;
  }
  function inputColours() {
    return {
      main: document.getElementById("pal-main").value,
      second: document.getElementById("pal-second").value,
      third: document.getElementById("pal-third").value,
    };
  }
  function setInputs(colours) {
    document.getElementById("pal-main").value = colours.main;
    document.getElementById("pal-second").value = colours.second;
    document.getElementById("pal-third").value = colours.third;
  }
  function openEditor(which) {
    editing = which;
    var editor = document.getElementById("pal-editor");
    document.getElementById("pal-etitle").textContent =
      which === "system"
        ? "Edit the System colours"
        : "Choose your Custom colours";
    document.getElementById("pal-defaults").hidden = which !== "system";
    setInputs(which === "system" ? saved.system : saved);
    editor.hidden = false;
    previewEditor();
    message("Pick the colours, then press Save colours.");
  }
  function closeEditor() {
    editing = null;
    var editor = document.getElementById("pal-editor");
    if (editor) editor.hidden = true;
  }
  /* Show the colours at once; nothing is kept for other people until Save colours. */
  function previewEditor() {
    var choice = cleanChoice(saved);
    var colours = inputColours();
    if (editing === "system") {
      choice.mode = "system";
      choice.system = colours;
    } else {
      choice.mode = "custom";
      choice.main = colours.main;
      choice.second = colours.second;
      choice.third = colours.third;
    }
    apply(choice);
  }
  function saveEditor() {
    if (!editing) return;
    var choice = cleanChoice(saved);
    var colours = inputColours();
    if (editing === "system") {
      choice.mode = "system";
      choice.system = colours;
    } else {
      choice.mode = "custom";
      choice.main = colours.main;
      choice.second = colours.second;
      choice.third = colours.third;
    }
    saveAndTell(choice);
  }
  function message(text) {
    var line = document.getElementById("pal-msg");
    if (line) line.textContent = text;
  }
  function saveAndTell(choice) {
    message("Saving…");
    save(choice)
      .then(function () {
        message("Saved for all users.");
        if (editing) {
          var choice = cleanChoice(saved);
          setInputs(editing === "system" ? choice.system : choice);
        }
      })
      .catch(function () {
        message(
          "Could not save. Check you are signed in as an admin and try again.",
        );
        load();
      });
  }
  function showChoice() {
    if (!card || !document.body.contains(card)) return;
    card.querySelectorAll(".pal-opt").forEach(function (option) {
      option.classList.toggle("on", option.dataset.mode === current.mode);
      option.setAttribute(
        "aria-pressed",
        option.dataset.mode === current.mode ? "true" : "false",
      );
    });
    document.getElementById("pal-system-sw").innerHTML = swatches([
      current.system.main,
      current.system.second,
      current.system.third,
    ]);
    document.getElementById("pal-custom-sw").innerHTML = swatches([
      current.main,
      current.second,
      current.third,
    ]);
  }
  function lookForCard() {
    var host = document.getElementById("pal-card");
    if (host && !host.dataset.ready) buildCard(host);
  }

  function start() {
    load();
    lookForCard();
    new MutationObserver(lookForCard).observe(document.body, {
      childList: true,
      subtree: true,
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start);
  else start();
})();
