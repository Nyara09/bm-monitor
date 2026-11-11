/* Shared behaviour for every page. */
(function () {
  'use strict';

  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  // Submit a POST to `url` (used by delete / reverse / void links).
  function postTo(url, extra) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = url;
    const fields = Object.assign({ csrfmiddlewaretoken: csrfToken() }, extra || {});
    Object.keys(fields).forEach(function (name) {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = fields[name];
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }
  window.appPostTo = postTo;

  document.addEventListener('DOMContentLoaded', function () {
    // Bootstrap client-side validation.
    document.querySelectorAll('.needs-validation').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();
        }
        form.classList.add('was-validated');
      }, false);
    });

    // Any link with data-confirm asks first, then POSTs to its href.
    // Legacy class names from the original templates are supported too.
    const selector = '[data-confirm], .delete-btn, .delete-txn-type, .delete-rate, .delete-account';
    document.querySelectorAll(selector).forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        const url = link.getAttribute('href') || link.dataset.url;
        const text = link.dataset.confirm || 'This cannot be undone.';
        const title = link.dataset.confirmTitle || 'Are you sure?';
        const button = link.dataset.confirmButton || 'Yes, delete it!';
        const extra = link.dataset.next ? { next: link.dataset.next } : {};
        if (window.Swal) {
          Swal.fire({
            title: title, text: text, icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#d33', confirmButtonText: button, cancelButtonText: 'Cancel'
          }).then(function (result) { if (result.isConfirmed) postTo(url, extra); });
        } else if (window.confirm(title + '\n' + text)) {
          postTo(url, extra);
        }
      });
    });

    // Prevent double submission of money forms.
    document.querySelectorAll('form[data-once]').forEach(function (form) {
      form.addEventListener('submit', function (e) {
        if (form.dataset.submitted) { e.preventDefault(); return; }
        // Wait until every other submit handler has run; only lock if the form really submits.
        setTimeout(function () {
          if (e.defaultPrevented) return;
          form.dataset.submitted = '1';
          form.querySelectorAll('button[type="submit"]').forEach(function (b) {
            b.disabled = true;
            b.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Saving…';
          });
        }, 0);
      });
    });

    if (window.jQuery && jQuery.fn.selectpicker) {
      jQuery('.selectpicker').selectpicker();
    }
  });

  window.appFormat = function (value, decimals) {
    const num = Number(value);
    if (!isFinite(num)) return '';
    const d = decimals === undefined ? 2 : decimals;
    return num.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  };

  /* Mirrors backend/services.py quote(): rates are customer-side quotes per 1 unit
     of the rate's from-currency. The server recalculates on submit. */
  window.appQuote = function (rates, from, to, amount) {
    if (!from || !to || !(amount > 0)) return null;
    if (from === to) {
      return { applied: 1, buying: 1, selling: 1, received: amount, mode: 'same', direction: 'same' };
    }
    let rate = rates.find(function (r) { return r.from === from && r.to === to; });
    if (rate) {
      return { applied: rate.selling, buying: rate.buying, selling: rate.selling,
               received: amount * rate.selling, mode: 'selling', direction: 'direct' };
    }
    rate = rates.find(function (r) { return r.from === to && r.to === from; });
    if (rate && rate.buying > 0) {
      return { applied: rate.buying, buying: rate.buying, selling: rate.selling,
               received: amount / rate.buying, mode: 'buying', direction: 'reverse' };
    }
    return { error: 'No rate set for ' + from + ' → ' + to + '.' };
  };
})();

/* Customer lookup: typing in the name or phone box suggests saved customers.
   opts: {name, phone, id (hidden), idType, idNumber, status, url} – elements + api url */
window.appCustomerLookup = function (opts) {
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu shadow';
  menu.style.maxHeight = '260px';
  menu.style.overflowY = 'auto';
  let timer = null, anchor = null;

  function setStatus(c) {
    if (!opts.status) return;
    if (!c) { opts.status.innerHTML = '<span class="badge bg-label-secondary">New customer</span>'; return; }
    opts.status.innerHTML = '<span class="badge bg-label-info">Returning customer</span> ' +
      (c.id_number ? '<span class="badge bg-label-success">ID on file: ' + c.id_type_label + ' ' + c.id_number + '</span>'
                   : '<span class="badge bg-label-warning">No ID on file</span>');
  }

  function close() { menu.classList.remove('show'); }

  function pick(c) {
    opts.id.value = c.id;
    opts.name.value = c.name;
    if (opts.phone) opts.phone.value = c.phone || '';
    if (opts.idType && c.id_type) opts.idType.value = c.id_type;
    if (opts.idNumber && c.id_number) opts.idNumber.value = c.id_number;
    setStatus(c);
    close();
    if (opts.onPick) opts.onPick(c);
  }

  function search(input) {
    const q = input.value.trim();
    opts.id.value = '';
    setStatus(null);
    if (q.length < 2) { close(); return; }
    clearTimeout(timer);
    timer = setTimeout(function () {
      fetch(opts.url + '?q=' + encodeURIComponent(q), { headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          menu.innerHTML = '';
          if (!data.results.length) { close(); return; }
          data.results.forEach(function (c) {
            const a = document.createElement('a');
            a.href = 'javascript:void(0)';
            a.className = 'dropdown-item';
            a.innerHTML = '<div class="fw-medium"></div><small class="text-body-secondary"></small>';
            a.firstChild.textContent = c.name;
            a.lastChild.textContent = [c.phone, c.id_number ? c.id_type_label + ' ' + c.id_number : 'No ID'].filter(Boolean).join(' · ');
            a.addEventListener('mousedown', function (e) { e.preventDefault(); pick(c); });
            menu.appendChild(a);
          });
          anchor = input;
          input.parentElement.style.position = 'relative';
          input.parentElement.appendChild(menu);
          menu.style.top = '100%';
          menu.style.left = '0';
          menu.style.minWidth = '100%';
          menu.classList.add('show');
        }).catch(close);
    }, 250);
  }

  [opts.name, opts.phone].forEach(function (input) {
    if (!input) return;
    input.setAttribute('autocomplete', 'off');
    input.addEventListener('input', function () { search(input); });
    input.addEventListener('blur', function () { setTimeout(close, 150); });
  });
  setStatus(null);
};

/* Show/require the ID fields when a transaction is worth `threshold` or more in base currency. */
window.appKyc = function (box, valueBase, threshold) {
  if (!box) return false;
  const need = threshold > 0 && valueBase >= threshold;
  box.querySelectorAll('[data-kyc-required]').forEach(function (el) { el.required = need; });
  const note = box.querySelector('[data-kyc-note]');
  if (note) note.classList.toggle('d-none', !need);
  if (need) box.classList.add('show');
  return need;
};
