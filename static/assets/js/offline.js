/* Offline outbox. When the network is down, transaction forms marked data-offline
   are saved on this device (IndexedDB) instead of being submitted. When the
   connection returns they are sent one by one to /api/offline-sync/. Each item has
   a unique client_ref, so sending twice never records twice. The server prices each
   transaction at the rates that applied when it was recorded, and checks balances. */
(function () {
  'use strict';
  const URLS = window.APP_URLS || {};
  const DB = 'forex-outbox', STORE = 'items';

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function db() {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'client_ref' });
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function tx(mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const t = d.transaction(STORE, mode), s = t.objectStore(STORE);
      const out = fn(s);
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
    });
  }
  const Outbox = {
    add: (item) => tx('readwrite', (s) => s.put(item)),
    all: () => tx('readonly', (s) => s.getAll()),
    remove: (ref) => tx('readwrite', (s) => s.delete(ref)),
  };
  window.appOutbox = Outbox;

  function csrf() {
    const m = document.querySelector('meta[name="csrf-token"]');
    return m ? m.content : '';
  }

  async function refreshBadge() {
    let items = [];
    try { items = await Outbox.all(); } catch (e) { return; }
    const waiting = items.filter((i) => i.state !== 'done').length;
    const pill = document.getElementById('offline-pill');
    const count = document.getElementById('outbox-count');
    const side = document.getElementById('outbox-count-side');
    if (count) count.textContent = waiting;
    if (pill) pill.classList.toggle('d-none', waiting === 0);
    if (side) { side.textContent = waiting; side.classList.toggle('d-none', waiting === 0); }
    document.dispatchEvent(new CustomEvent('outbox-changed', { detail: items }));
  }
  window.appRefreshOutbox = refreshBadge;

  function netState() {
    const el = document.getElementById('net-offline');
    if (el) el.classList.toggle('d-none', navigator.onLine);
  }

  let syncing = false;
  async function sync() {
    if (syncing || !navigator.onLine || !URLS.sync) return;
    syncing = true;
    try {
      const items = (await Outbox.all()).filter((i) => i.state === 'waiting');
      for (const item of items) {
        let res;
        try {
          res = await fetch(URLS.sync, {
            method: 'POST', credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrf() },
            body: JSON.stringify({ kind: item.kind, client_ref: item.client_ref, created_at: item.created_at, fields: item.fields }),
          });
        } catch (e) { break; } // still offline
        if (res.status === 403 || res.redirected) { item.error = 'Please sign in again, then sync.'; await Outbox.add(item); break; }
        let data = {};
        try { data = await res.json(); } catch (e) { data = { ok: false, error: 'Server error (' + res.status + ')' }; }
        if (data.ok) { item.state = 'done'; item.serial = data.serial; item.url = data.url; item.error = ''; }
        else { item.state = 'failed'; item.error = data.error || 'Could not be recorded'; }
        await Outbox.add(item);
      }
    } finally {
      syncing = false;
      refreshBadge();
    }
  }
  window.appSyncOutbox = sync;

  function formFields(form) {
    const out = {};
    new FormData(form).forEach((v, k) => { if (k !== 'csrfmiddlewaretoken') out[k] = v; });
    return out;
  }

  document.addEventListener('DOMContentLoaded', function () {
    netState();
    refreshBadge();
    window.addEventListener('online', () => { netState(); sync(); });
    window.addEventListener('offline', netState);
    if (navigator.onLine) sync();
    setInterval(sync, 60000);

    if ('serviceWorker' in navigator && URLS.sw) {
      navigator.serviceWorker.register(URLS.sw, { scope: '/' }).catch(() => {});
    }

    // Pages cached for offline use contain balances: clear them when signing out.
    const logout = document.getElementById('logout-form');
    if (logout && window.caches) logout.addEventListener('submit', () => { caches.keys().then(ks => ks.forEach(k => caches.delete(k))); });

    document.querySelectorAll('[data-client-ref]').forEach((el) => { if (!el.value) el.value = uuid(); });

    document.querySelectorAll('form[data-offline]').forEach(function (form) {
      form.addEventListener('submit', async function (e) {
        if (navigator.onLine || e.defaultPrevented) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const ref = (form.querySelector('[data-client-ref]') || {}).value || uuid();
        await Outbox.add({ client_ref: ref, kind: form.dataset.offline, created_at: new Date().toISOString(),
                           fields: formFields(form), state: 'waiting', error: '' });
        await refreshBadge();
        const msg = 'No connection. The transaction was saved on this device and will be recorded automatically when the connection returns. Give the customer the money only if you are sure there is enough in the till.';
        if (window.Swal) await Swal.fire({ icon: 'info', title: 'Saved offline', text: msg });
        else alert(msg);
        window.location.href = URLS.offline || '/offline/';
      }, true);
    });
  });
})();
