/*
 * js/preload-guard.js
 * Starts the page hidden until the stylesheets are ready.
 */

document.documentElement.classList.add("gp");
setTimeout(function () {
  document.documentElement.classList.remove("gp");
}, 12000);
