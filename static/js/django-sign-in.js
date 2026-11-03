/*
 * js/django-sign-in.js
 * Sign-in with Django users. Loaded after the other scripts so it can replace the
 * browser-only password check of the sign-in screen.
 *
 * What it does:
 *  1. Sign in: sends the username and password to Django (window.URLS.signIn), then reloads
 *     the page so django-storage.js can load that user's data from the database.
 *  2. Already signed in (page opened or reloaded): signs the person in to the screens again.
 *  3. Passwords typed on the Users screens are swapped for tokens (see django-storage.js).
 *  4. Sign out: ends the Django session and removes the local copy of the data.
 */

(function () {
  "use strict";

  var URLS = window.URLS || {};
  var PLACEHOLDER_ACCOUNT = "__django__"; /* keeps the sign-in screen in "Sign in" mode, never in "Create account" */

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function sendToDjango(url, bodyObject) {
    return fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": readCookie("csrftoken"),
      },
      body: JSON.stringify(bodyObject || {}),
    }).then(function (response) {
      return response.json().then(function (data) {
        return { ok: response.ok, data: data };
      });
    });
  }

  /*
   * The data (users, permissions, reports ...) is loaded from the database by django-storage.js
   * before the pages start. Here we only sign the person in to the screens.
   */

  /* ---------- sign-in screen ---------- */
  var loginButton = document.getElementById("lg-go");
  var errorLine = document.getElementById("lg-e");
  var usernameInput = document.getElementById("lg-u");
  var passwordInput = document.getElementById("lg-pw");

  var previousOpenLogin = window.openLogin;
  window.openLogin = function (callback) {
    previousOpenLogin(callback);
    document.getElementById("lg-t").textContent = "Sign in";
    document.getElementById("lg-p").textContent =
      "Sign in with the username and password of your account.";
    document.getElementById("lg-c").hidden = true;
    document.getElementById("lg-go").textContent = "Sign in";
    if (usernameInput.value === PLACEHOLDER_ACCOUNT) {
      usernameInput.value = "";
      usernameInput.focus();
    }
  };

  /* The recovery code resets a browser-only password: with Django, ask an administrator instead. */
  var hideForgotStyle = document.createElement("style");
  hideForgotStyle.textContent = "#lg-forgot, #lg-c { display: none !important; }";
  document.head.appendChild(hideForgotStyle);

  loginButton.onclick = function () {
    var username = usernameInput.value.trim();
    var password = passwordInput.value;
    var now = Date.now();

    if (now < lockUntil) {
      errorLine.textContent =
        "Too many attempts. Try again in " + Math.ceil((lockUntil - now) / 1000) + " s.";
      return;
    }
    if (!username || !password) {
      errorLine.textContent = "Enter your username and password.";
      return;
    }

    loginButton.disabled = true;
    var reloading = false;
    window.BioregSpinner.show();
    sendToDjango(URLS.signIn, { username: username, password: password })
      .then(function (result) {
        if (result.ok) {
          reloading = true; /* keep the spinner on until the page has started again */
          location.reload(); /* the page starts again and django-storage.js loads this user's data */
          return;
        }
        if (result.data && result.data.error === "Incorrect username or password.") {
          failN++;
          if (failN >= 5) {
            lockUntil = Date.now() + 30000;
            failN = 0;
            errorLine.textContent = "Too many attempts. Locked for 30 seconds.";
          } else {
            errorLine.textContent = result.data.error;
          }
        } else {
          errorLine.textContent = (result.data && result.data.error) || "Could not sign in.";
        }
        passwordInput.value = "";
      })
      .catch(function () {
        errorLine.textContent = "Could not reach the server. Check the connection and try again.";
      })
      .then(function () {
        loginButton.disabled = false;
        if (!reloading) window.BioregSpinner.hide();
      });
  };

  /* ---------- passwords typed on the Users screens go to Django, never into the page's data ---------- */
  var previousMakeAccount = window.mkAcc;
  window.mkAcc = async function (username, password) {
    var account = await previousMakeAccount(username, password);
    account.salt = window.BioregSync.rememberPassword(password);
    return account;
  };

  /* ---------- sign out ---------- */
  var previousLogout = window.logout;
  window.logout = function () {
    var result = previousLogout.apply(this, arguments);
    sendToDjango(URLS.signOut)
      .catch(function () {})
      .then(function () {
        window.BioregSync.clearLocalCopy();
      });
    return result;
  };
  document.getElementById("alo").onclick = window.logout; /* the button was bound to the old function */

  /* ---------- already signed in to Django (page opened or reloaded) ---------- */
  var djangoUser = window.BioregSync.user();
  if (djangoUser && !isAuthed()) signedIn(djangoUser.username);
})();
