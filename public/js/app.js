/**
 * Form behaviour for the document builder.
 *
 * Loaded with `defer` after /i18n.js, so both the DOM and `window.I18N` are
 * ready when this runs. Kept as a plain script (no bundler) — the CSP allows
 * only same-origin scripts, so nothing here may use inline event attributes.
 */
(function () {
  'use strict';

  var form = document.getElementById('invoice-form');
  var addItemBtn = document.getElementById('add-item-btn');
  var invoiceItemsContainer = document.getElementById('invoice-items');
  var submitBtn = document.getElementById('submit-btn');
  var submitBtnLabel = document.getElementById('submit-btn-label');
  var currencySelect = document.getElementById('currency');

  // --- i18n (chunk 5.3): same dictionaries the server uses for PDFs ---
  var I18N = window.I18N || {};
  var currentLang = 'en';
  try {
    if (localStorage.getItem('pdfinvoice-lang') === 'fr') currentLang = 'fr';
  } catch (e) {
    /* storage unavailable — stay on English */
  }

  var tUi = function (key, params) {
    var text = (I18N[currentLang] && I18N[currentLang][key]) || (I18N.en && I18N.en[key]) || '';
    if (params) {
      for (var name in params) {
        text = text.split('{' + name + '}').join(String(params[name]));
      }
    }
    return text;
  };

  var applyLang = function (lang) {
    currentLang = lang;
    try {
      localStorage.setItem('pdfinvoice-lang', lang);
    } catch (e) {
      /* ignore */
    }
    // Only overwrite when a translation exists — the hardcoded English
    // text in the markup stays as the fallback if /i18n.js is missing.
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var text = tUi(el.getAttribute('data-i18n'));
      if (text) el.textContent = text;
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var text = tUi(el.getAttribute('data-i18n-ph'));
      if (text) el.setAttribute('placeholder', text);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var text = tUi(el.getAttribute('data-i18n-aria'));
      if (text) el.setAttribute('aria-label', text);
    });
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    });
    document.documentElement.lang = lang;
    document.title = tUi('ui.pageTitle') || document.title;
  };

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLang(btn.dataset.lang);
    });
  });

  // --- Theme (dark mode) ---
  // theme-boot.js already applied the class before first paint; here we
  // only wire the toggle, persistence, and follow the OS when the user
  // has made no explicit choice.
  var themeToggle = document.getElementById('theme-toggle');
  var THEME_KEY = 'pdfinvoice-theme';
  var prefersDarkQuery =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  var getStoredTheme = function () {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null;
    }
  };

  var applyTheme = function (theme) {
    var isDark = theme === 'dark';
    document.documentElement.classList.toggle('dark', isDark);
    themeToggle.setAttribute('aria-pressed', String(isDark));
  };

  // Sync the button with the theme theme-boot.js picked.
  applyTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  themeToggle.addEventListener('click', function () {
    var next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      /* ignore */
    }
    applyTheme(next);
  });

  // No explicit choice yet -> mirror OS changes live.
  if (
    prefersDarkQuery &&
    !getStoredTheme() &&
    typeof prefersDarkQuery.addEventListener === 'function'
  ) {
    prefersDarkQuery.addEventListener('change', function (e) {
      applyTheme(e.matches ? 'dark' : 'light');
    });
  }

  // --- Totals state + rendering (single source of truth) ---
  var subtotalNumber = 0;
  var totalNumber = 0;

  // Locale per currency, mirroring the server-side map (chunk 4.6).
  var CURRENCY_LOCALES = { USD: 'en-US', MAD: 'fr-MA', EUR: 'de-DE', JPY: 'ja-JP', GBP: 'en-GB' };

  var formatCurrency = function (value, code) {
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALES[code] || 'en-US', {
        style: 'currency',
        currency: code,
      }).format(value);
    } catch (e) {
      // Unknown code — never let Intl crash the form.
      return value.toFixed(2) + ' ' + code;
    }
  };

  var renderTotals = function () {
    var code = currencySelect.value;
    document.getElementById('subtotal').textContent = formatCurrency(subtotalNumber, code);
    document.getElementById('total-amount').textContent = formatCurrency(totalNumber, code);
  };

  currencySelect.addEventListener('change', renderTotals);

  // --- Core functions ---
  var MAX_ITEMS = 15;

  var updateAddItemState = function () {
    var atLimit = document.querySelectorAll('.item-row').length >= MAX_ITEMS;
    addItemBtn.disabled = atLimit;
    addItemBtn.classList.toggle('opacity-50', atLimit);
    document.getElementById('items-limit-hint').classList.toggle('hidden', !atLimit);
  };

  var addNewItem = function () {
    if (document.querySelectorAll('.item-row').length >= MAX_ITEMS) return;
    var itemRow = document.createElement('tr');
    itemRow.classList.add('item-row');
    itemRow.innerHTML =
      '<td class="p-2"><input type="text" data-i18n-ph="ui.itemDescriptionPh" placeholder="Item description" maxlength="54" data-i18n-aria="ui.itemDescriptionAria" aria-label="Item description" class="description w-full p-2 rounded-md invoice-input"></td>' +
      '<td class="p-2"><input type="number" value="1" min="1" data-i18n-aria="ui.itemQuantityAria" aria-label="Quantity" class="quantity w-full p-2 text-center rounded-md invoice-input"></td>' +
      '<td class="p-2"><input type="number" value="0.00" min="0" step="0.01" data-i18n-aria="ui.itemPriceAria" aria-label="Price" class="price w-full p-2 text-center rounded-md invoice-input"></td>' +
      '<td class="p-2 text-center">' +
      '<button type="button" data-i18n-aria="ui.removeItemAria" aria-label="Remove item" class="remove-item-btn text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-colors">' +
      '<svg class="w-5 h-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>' +
      '</button>' +
      '</td>';
    invoiceItemsContainer.appendChild(itemRow);
    applyLang(currentLang); // translate the freshly added row
    updateTotals();
    updateAddItemState();
  };

  var updateTotals = function () {
    var subtotal = 0;
    document.querySelectorAll('.item-row').forEach(function (row) {
      var qty = parseFloat(row.querySelector('.quantity').value) || 0;
      var price = parseFloat(row.querySelector('.price').value) || 0;
      subtotal += qty * price;
    });

    var taxRate = parseFloat(document.getElementById('tax-rate').value) || 0;
    var taxAmount = subtotal * (taxRate / 100);

    subtotalNumber = subtotal;
    totalNumber = subtotal + taxAmount;

    renderTotals();
  };

  // --- Event listeners ---
  form.addEventListener('input', function (e) {
    // Update totals on any input change within the form
    if (e.target.matches('.quantity, .price, #tax-rate')) {
      updateTotals();
    }
  });

  addItemBtn.addEventListener('click', addNewItem);

  invoiceItemsContainer.addEventListener('click', function (e) {
    if (e.target.closest('.remove-item-btn')) {
      e.target.closest('.item-row').remove();
      updateTotals();
      updateAddItemState();
    }
  });

  var showToast = function (el, message) {
    el.textContent = message;
    el.classList.remove('opacity-0', '-translate-y-2');
    el.classList.add('opacity-100', 'translate-y-0');
    setTimeout(function () {
      el.classList.remove('opacity-100', 'translate-y-0');
      el.classList.add('opacity-0', '-translate-y-2');
    }, 3000);
  };

  var resetForm = function () {
    // keep a valid option selected (setting value='' leaves the <select> invalid)
    document.getElementById('invoice-type').selectedIndex = 0;
    [
      'company-name',
      'company-address',
      'company-city',
      'company-phone',
      'company-email',
      'client-name',
      'client-address',
      'client-city',
      'client-phone',
      'client-email',
      'payment-type',
      'notes',
    ].forEach(function (id) {
      document.getElementById(id).value = '';
    });
  };

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // stop native form submission (page navigation)
    submitBtnLabel.textContent = tUi('ui.processing');
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');

    var invoiceData = {
      documentType: document.getElementById('invoice-type').value,
      company: {
        name: document.getElementById('company-name').value,
        address: document.getElementById('company-address').value,
        phone: document.getElementById('company-phone').value,
        city: document.getElementById('company-city').value,
        email: document.getElementById('company-email').value,
      },
      client: {
        name: document.getElementById('client-name').value,
        address: document.getElementById('client-address').value,
        phone: document.getElementById('client-phone').value,
        city: document.getElementById('client-city').value,
        email: document.getElementById('client-email').value,
      },
      issueDate: document.getElementById('invoice-date').value,
      dueDate: document.getElementById('due-date').value,
      items: [],
      paymentType: document.getElementById('payment-type').value,
      notes: document.getElementById('notes').value,
      taxRate: parseFloat(document.getElementById('tax-rate').value) || 0,
      subtotal: 0,
      total: 0,
      currency: document.getElementById('currency').value || 'USD',
      language: currentLang,
    };

    var subtotal = 0;
    document.querySelectorAll('.item-row').forEach(function (row) {
      var description = row.querySelector('.description').value;
      var quantity = parseFloat(row.querySelector('.quantity').value) || 0;
      var price = parseFloat(row.querySelector('.price').value) || 0;
      invoiceData.items.push({ description: description, quantity: quantity, price: price });
      subtotal += quantity * price;
    });

    invoiceData.subtotal = subtotal;
    invoiceData.total = subtotal * (1 + invoiceData.taxRate / 100);

    fetch('/pdf/invoice-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoiceData),
    })
      .then(function (res) {
        if (!res.ok) {
          return res
            .json()
            .then(function (errData) {
              var message = tUi('ui.errorGeneric');
              if (errData.errors && errData.errors.length) {
                var msgs = errData.errors.map(function (err) {
                  return err.msg;
                });
                var shown = msgs.slice(0, 3);
                if (msgs.length > 3) shown.push(tUi('ui.errorMore', { count: msgs.length - 3 }));
                message = shown.join('\n');
              } else if (errData.error) {
                message = errData.error;
              }
              throw new Error(message);
            })
            .catch(function (err) {
              // Body was not JSON (or rethrow from above): keep a useful message.
              if (err instanceof Error && err.message && err.message !== tUi('ui.errorGeneric')) {
                throw err;
              }
              throw new Error(tUi('ui.errorGeneric'));
            });
        }
        return res.blob();
      })
      .then(function (blob) {
        var url = window.URL.createObjectURL(blob);
        var preview = window.open(url, '_blank');

        if (preview) {
          // Give the new tab time to start loading the blob.
          setTimeout(function () {
            window.URL.revokeObjectURL(url);
          }, 60000);
          showToast(document.getElementById('notification-toast'), tUi('ui.toastPreview'));
        } else {
          // Popup blocked — fall back to a direct download.
          var a = document.createElement('a');
          a.href = url;
          a.download = 'invoice.pdf';
          a.click();
          window.URL.revokeObjectURL(url);
          showToast(document.getElementById('notification-toast'), tUi('ui.toastDownloaded'));
        }
        resetForm();
      })
      .catch(function (err) {
        showToast(
          document.getElementById('notification-toast-error'),
          err && err.message ? err.message : tUi('ui.errorGeneric'),
        );
      })
      .finally(function () {
        applyLang(currentLang); // restore the translated button label
        submitBtn.disabled = false;
        submitBtn.removeAttribute('aria-busy');
      });
  });

  // --- Initial setup ---
  addNewItem();
  applyLang(currentLang);
  document.getElementById('invoice-date').valueAsDate = new Date();
  updateTotals();
})();
