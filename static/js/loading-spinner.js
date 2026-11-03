/*
 * js/loading-spinner.js
 * Shows a spinner when a page takes time to open. Used by every page.
 *   - a link or a form leaves the page: the spinner appears if the next page has not
 *     opened after SHOW_AFTER_MS (so fast pages never flash it)
 *   - a script moves to another page (location.href, used by the Administration, Map overview and
 *     Supervisor screens): the page is about to unload, so the same delayed spinner is used
 *   - a page that is still starting up (heavy scripts) shows it only if it is still not ready
 *     after SHOW_AFTER_MS
 *   - code can call BioregSpinner.show() and BioregSpinner.hide() (for example during a sign in)
 */

(function () {
  var SHOW_AFTER_MS = 250;
  var FAILSAFE_MS = 20000;
  var timer = 0;
  var failsafe = 0;
  var overlay = null;

  function build() {
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = "page-spinner";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-live", "polite");
    overlay.innerHTML = '<div class="ring"></div><span class="label">Loading</span>';
    (document.body || document.documentElement).appendChild(overlay);
    return overlay;
  }

  function show() {
    build().classList.add("show");
  }

  function hide() {
    clearTimeout(timer);
    clearTimeout(failsafe);
    if (overlay) overlay.classList.remove("show");
  }

  function showSoon() {
    clearTimeout(timer);
    clearTimeout(failsafe);
    timer = setTimeout(show, SHOW_AFTER_MS);
    // If the browser stays on this page (for example a file download), do not spin forever
    failsafe = setTimeout(hide, FAILSAFE_MS);
  }

  window.BioregSpinner = { show: show, hide: hide };

  /* A page that is still starting up */
  document.addEventListener("DOMContentLoaded", function () {
    if (document.readyState !== "complete") showSoon();
  });
  window.addEventListener("load", function () {
    setTimeout(hide, 150);
  });
  /* Back and forward buttons can bring a page back from the cache with the spinner still on */
  window.addEventListener("pageshow", hide);

  /* Any other way of leaving the page, such as a script setting location.href */
  window.addEventListener("beforeunload", showSoon);

  /* A link to another page */
  document.addEventListener("click", function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest && event.target.closest("a[href]");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
    if (link.hasAttribute("data-no-spinner")) return;
    var url = new URL(link.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    showSoon();
  });

  /* A form that is sent to the server */
  document.addEventListener("submit", function (event) {
    // Listeners that cancel the send (a delete confirmation, a failed check) have run by now
    setTimeout(function () {
      if (event.defaultPrevented) return;
      var form = event.target;
      if (form.hasAttribute("data-no-spinner") || form.target === "_blank") return;
      var button = form.querySelector("button[type=submit], button:not([type])");
      if (button) button.classList.add("is-loading");
      showSoon();
    }, 0);
  });
})();
