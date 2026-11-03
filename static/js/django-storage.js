/*
 * js/django-storage.js
 * Connects the pages to the database through the Django views (monitor/views/data.py).
 *
 * The pages keep their data in localStorage under keys such as "bioreg.reports". This script runs
 * first, before any other script, and does three things:
 *  1. LOAD: asks Django for every data set and puts it in localStorage, so the pages start with
 *     the data that is in the database.
 *  2. SAVE: whenever a page writes one of those keys, sends the new value to Django, which saves
 *     it in the matching models.
 *  3. PASSWORDS: a typed password is swapped for a token, so only Django ever sees (and hashes) it.
 *
 * Keys that stay in the browser only: theme, sidebar state, session, last backup time.
 */

(function () {
  "use strict";

  var URLS = window.URLS || {};
  var DRAFT_PREFIX = "bioreg.draft|";
  var SAVE_DELAY_MS = 50; /* groups several quick writes of the same key into one request */

  var SYNCED_KEYS = [
    "bioreg.v2",
    "bioreg.reports",
    "bioreg.users",
    "bioreg.mdas",
    "bioreg.dcalist",
    "bioreg.dcap",
    "bioreg.inv",
    "bioreg.invcat",
    "bioreg.invcathide",
    "bioreg.invcat3",
    "bioreg.notif",
    "bioreg.notifread",
    "bioreg.audit",
    "bioreg.mainprof",
    "bioreg.company",
    "bioreg.logo",
    "bioreg.bdrule",
  ];

  var storage = window.localStorage;
  var rawSetItem = Storage.prototype.setItem;
  var rawRemoveItem = Storage.prototype.removeItem;

  var signedInUser = null; /* what Django says about the signed-in user, or null */
  var passwordByToken = {}; /* "pwtoken:..." -> the password the person typed */
  var saveTimers = {};
  var waitingKeys = []; /* keys with a newer value to send, oldest first */
  var requestRunning = false; /* only one save is in flight, so the database never gets two at once */
  var lastSentValue = {};

  function isSyncedKey(key) {
    return SYNCED_KEYS.indexOf(key) !== -1 || String(key).indexOf(DRAFT_PREFIX) === 0;
  }

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : "";
  }

  function authAccount(username) {
    return JSON.stringify({ u: username, salt: "", alg: "sha", it: 1, h: "" });
  }

  /* ---------- 1. LOAD ---------- */
  function loadFromDjango() {
    var request = new XMLHttpRequest();
    request.open("GET", URLS.data, false); /* synchronous: the pages read localStorage as soon as they start */
    try {
      request.send();
    } catch (error) {
      return;
    }
    if (request.status !== 200) return;

    var answer = JSON.parse(request.responseText);
    signedInUser = answer.user;

    Object.keys(storage).forEach(function (key) {
      if (key.indexOf(DRAFT_PREFIX) === 0) rawRemoveItem.call(storage, key);
    });
    Object.keys(answer.values).forEach(function (key) {
      var value = answer.values[key];
      if (value === null) rawRemoveItem.call(storage, key);
      else rawSetItem.call(storage, key, value);
      lastSentValue[key] = value;
    });

    /* The pages treat the account saved as bioreg.auth as the main administrator. */
    if (signedInUser.role === "admin") {
      rawSetItem.call(storage, "bioreg.auth", authAccount(signedInUser.username));
      try {
        sessionStorage.setItem("bioreg.sess", signedInUser.username);
      } catch (error) {}
    }
  }

  /* Keep the sign-in screen in "Sign in" mode: it must never offer "Create the administrator account". */
  function keepSignInMode() {
    var current = null;
    try {
      current = JSON.parse(storage.getItem("bioreg.auth"));
    } catch (error) {}
    var isAdminStub = signedInUser && signedInUser.role === "admin";
    var belongsToOtherUser = current && signedInUser && !isAdminStub && current.u === signedInUser.username;
    if (!current || belongsToOtherUser) rawSetItem.call(storage, "bioreg.auth", authAccount("__django__"));
  }

  loadFromDjango();
  keepSignInMode();

  /* ---------- 2. SAVE ---------- */
  function valueToSend(key) {
    var value = storage.getItem(key);
    if (key !== "bioreg.users" || value === null) return { text: value, usedTokens: [] };

    /* Never send password hashes. Send the typed password instead of the token. */
    var usedTokens = [];
    var records;
    try {
      records = JSON.parse(value);
    } catch (error) {
      return { text: value, usedTokens: [] };
    }
    records.forEach(function (record) {
      var token = record.salt;
      if (typeof token === "string" && passwordByToken[token]) {
        record._pw = passwordByToken[token];
        usedTokens.push(token);
      }
      delete record.salt;
      delete record.alg;
      delete record.it;
      delete record.h;
    });
    return { text: JSON.stringify(records), usedTokens: usedTokens };
  }

  function sendNext() {
    if (requestRunning || !waitingKeys.length) return;
    var key = waitingKeys.shift();
    var prepared = valueToSend(key);
    if (!signedInUser || (prepared.text === lastSentValue[key] && !prepared.usedTokens.length)) {
      sendNext();
      return;
    }

    requestRunning = true;
    fetch(URLS.dataSave, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", "X-CSRFToken": readCookie("csrftoken") },
      body: JSON.stringify({ key: key, value: prepared.text }),
    })
      .then(function (response) {
        if (response.ok) {
          lastSentValue[key] = prepared.text;
          prepared.usedTokens.forEach(function (token) {
            delete passwordByToken[token];
          });
        } else if (response.status === 401) {
          signedInUser = null; /* the session ended: stop sending */
        } else {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (answer) {
              console.warn("Not saved (" + key + "): " + (answer.error || response.status));
            });
        }
      })
      .catch(function () {
        console.warn("Could not reach the server to save " + key);
      })
      .then(function () {
        requestRunning = false;
        sendNext();
      });
  }

  function sendKey(key) {
    if (waitingKeys.indexOf(key) === -1) waitingKeys.push(key);
    sendNext();
  }

  function queueSave(key) {
    clearTimeout(saveTimers[key]);
    saveTimers[key] = setTimeout(function () {
      sendKey(key);
    }, SAVE_DELAY_MS);
  }

  Storage.prototype.setItem = function (key) {
    rawSetItem.apply(this, arguments);
    if (this === storage && isSyncedKey(key)) queueSave(key);
  };
  Storage.prototype.removeItem = function (key) {
    rawRemoveItem.apply(this, arguments);
    if (this === storage && isSyncedKey(key)) queueSave(key);
  };

  /* ---------- 3. what the other scripts can use ---------- */
  window.BioregSync = {
    /* the signed-in Django user, or null */
    user: function () {
      return signedInUser;
    },
    /* swap a typed password for a token that is safe to keep in the page's data */
    rememberPassword: function (password) {
      var token = "pwtoken:" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      passwordByToken[token] = password;
      return token;
    },
    /* remove the copy of the database from this browser (used when signing out) */
    clearLocalCopy: function () {
      SYNCED_KEYS.concat(Object.keys(storage)).forEach(function (key) {
        if (isSyncedKey(key)) rawRemoveItem.call(storage, key);
      });
      signedInUser = null;
    },
  };
})();
