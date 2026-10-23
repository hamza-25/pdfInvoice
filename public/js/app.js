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
    // Stacked mobile item cells label themselves from data-label.
    document.querySelectorAll('[data-i18n-datalabel]').forEach(function (el) {
      var text = tUi(el.getAttribute('data-i18n-datalabel'));
      if (text) el.setAttribute('data-label', text);
    });
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(btn.dataset.lang === lang));
    });
    document.documentElement.lang = lang;
    document.title = tUi('ui.pageTitle') || document.title;
    // Re-render the sheet so its labels follow the language too. `renderSheet`
    // is a hoisted function declaration defined below, so it is always set.
    renderSheet();
  };

  document.querySelectorAll('.lang-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyLang(btn.dataset.lang);
    });
  });

  // --- Document type: segmented radios mirror the real <select> ---------------
  // The <select> stays the submitted source of truth (and the reset target);
  // the radios are the visible control.
  var docTypeSelect = document.getElementById('invoice-type');
  var docTypeRadios = document.querySelectorAll('input[name="doc-type"]');

  var setDocType = function (value) {
    docTypeSelect.value = value;
    docTypeRadios.forEach(function (radio) {
      radio.checked = radio.value === value;
    });
  };

  docTypeRadios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      docTypeSelect.value = radio.value;
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
    var subtotalText = formatCurrency(subtotalNumber, code);
    var totalText = formatCurrency(totalNumber, code);
    document.getElementById('subtotal').textContent = subtotalText;
    document.getElementById('total-amount').textContent = totalText;
    // The sticky mobile action bar mirrors the total.
    var actionTotal = document.getElementById('action-total');
    if (actionTotal) actionTotal.textContent = totalText;
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
    itemRow.classList.add('item-row', 'border-b', 'border-rule');
    itemRow.innerHTML =
      '<td class="py-2 pr-2 align-middle" data-i18n-datalabel="ui.tableDescription" data-label="Description"><input type="text" data-i18n-ph="ui.itemDescriptionPh" placeholder="Item description" maxlength="54" data-i18n-aria="ui.itemDescriptionAria" aria-label="Item description" class="description invoice-input w-full rounded-md p-2"></td>' +
      '<td class="py-2 px-2 align-middle" data-i18n-datalabel="ui.tableQty" data-label="Qty"><input type="number" value="1" min="1" inputmode="decimal" data-i18n-aria="ui.itemQuantityAria" aria-label="Quantity" class="quantity invoice-input money w-full rounded-md p-2 text-center"></td>' +
      '<td class="py-2 px-2 align-middle" data-i18n-datalabel="ui.tablePrice" data-label="Price"><input type="number" value="0.00" min="0" step="0.01" inputmode="decimal" data-i18n-aria="ui.itemPriceAria" aria-label="Price" class="price invoice-input money w-full rounded-md p-2 text-center"></td>' +
      '<td class="py-2 pl-2 align-middle text-center item-actions">' +
      '<button type="button" data-i18n-aria="ui.removeItemAria" aria-label="Remove item" class="remove-item-btn rounded-md p-1.5 text-ink-soft transition-colors hover:text-accent">' +
      '<svg class="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>' +
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

  /** Read the whole form into the API payload shape (single source of truth
   *  for both the POST body and the live sheet preview). */
  var collectData = function () {
    var data = {
      documentType: docTypeSelect.value,
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
      currency: currencySelect.value || 'USD',
      language: currentLang,
    };

    var subtotal = 0;
    document.querySelectorAll('.item-row').forEach(function (row) {
      var quantity = parseFloat(row.querySelector('.quantity').value) || 0;
      var price = parseFloat(row.querySelector('.price').value) || 0;
      data.items.push({
        description: row.querySelector('.description').value,
        quantity: quantity,
        price: price,
      });
      subtotal += quantity * price;
    });

    data.subtotal = subtotal;
    data.total = subtotal * (1 + data.taxRate / 100);
    return data;
  };

  // --- Live sheet preview (chunk R5) -----------------------------------------
  // Renders the same document the PDF will contain, from collectData(), into an
  // A4-shaped element. Scaled to fit its pane (or the dialog on narrow screens).
  var sheet = document.getElementById('sheet');
  var sheetModal = document.getElementById('sheet-modal');
  var sheetPane = document.getElementById('sheet-pane');
  var previewModal = document.getElementById('preview-modal');
  var previewBtn = document.getElementById('preview-btn');
  var previewOpen = document.getElementById('preview-open');
  var previewClose = document.getElementById('preview-close');
  var SHEET_WIDTH = 794; // A4 at 96dpi

  var escapeHtml = function (value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  // ISO date -> locale-aware, human date; follows the selected language.
  var formatDate = function (isoDate) {
    if (!isoDate) return '';
    var parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate;
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(date.getTime())) return isoDate;
    try {
      return new Intl.DateTimeFormat(currentLang === 'fr' ? 'fr-FR' : 'en-US', {
        dateStyle: 'long',
      }).format(date);
    } catch (e) {
      return isoDate;
    }
  };

  var formatAmount = function (value, code) {
    // Plain number for the items table, matching the PDF column (no symbol).
    try {
      return new Intl.NumberFormat(CURRENCY_LOCALES[code] || 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch (e) {
      return value.toFixed(2);
    }
  };

  // Title / id / date labels per document type, mirroring the PDF (chunk 4.1).
  var DOC_TITLES = {
    'SERVICE INVOICE': {
      title: 'pdf.invoice.title',
      id: 'pdf.invoice.idLabel',
      date: 'pdf.date.invoice',
    },
    'PRODUCT INVOICE': {
      title: 'pdf.invoice.title',
      id: 'pdf.invoice.idLabel',
      date: 'pdf.date.invoice',
    },
    QUOTE: { title: 'pdf.quote.title', id: 'pdf.quote.idLabel', date: 'pdf.date.quote' },
    RECEIPT: { title: 'pdf.receipt.title', id: 'pdf.receipt.idLabel', date: 'pdf.date.receipt' },
  };
  var DEFAULT_DOC = DOC_TITLES['SERVICE INVOICE'];

  var addressLines = function (party) {
    return [party.address, party.city, party.phone, party.email]
      .filter(function (line) {
        return line && String(line).trim();
      })
      .map(function (line) {
        return '<span>' + escapeHtml(line) + '</span>';
      })
      .join('');
  };

  var sheetItemRows = function (items, currency) {
    var rows = '';
    items.forEach(function (item, index) {
      var lineTotal = item.quantity * item.price;
      rows +=
        '<tr>' +
        '<td class="sheet-col-num">' +
        escapeHtml(index + 1) +
        '</td>' +
        '<td class="sheet-col-desc">' +
        (escapeHtml(item.description) || '&nbsp;') +
        '</td>' +
        '<td class="sheet-col-qty">' +
        escapeHtml(item.quantity) +
        '</td>' +
        '<td class="sheet-col-price">' +
        formatAmount(item.price, currency) +
        '</td>' +
        '<td class="sheet-col-amount">' +
        formatAmount(lineTotal, currency) +
        '</td>' +
        '</tr>';
    });
    return rows;
  };

  var renderSheetMarkup = function () {
    var data = collectData();
    var meta = DOC_TITLES[data.documentType] || DEFAULT_DOC;
    var taxAmount = data.subtotal * (data.taxRate / 100);

    return (
      '<div class="sheet-doc">' +
      '<header class="sheet-head">' +
      '<div class="sheet-from">' +
      '<div class="sheet-party-name">' +
      escapeHtml(data.company.name) +
      '</div>' +
      '<div class="sheet-party-lines">' +
      addressLines(data.company) +
      '</div>' +
      '</div>' +
      '<div class="sheet-meta">' +
      '<div class="sheet-title">' +
      escapeHtml(tUi(meta.title)) +
      '</div>' +
      '<div class="sheet-meta-line"><span>' +
      escapeHtml(tUi(meta.id)) +
      '</span><span>—</span></div>' +
      '<div class="sheet-meta-line"><span>' +
      escapeHtml(tUi(meta.date)) +
      '</span><span>' +
      escapeHtml(formatDate(data.issueDate)) +
      '</span></div>' +
      (data.dueDate
        ? '<div class="sheet-meta-line"><span>' +
          escapeHtml(tUi('ui.dueDateLabel')) +
          '</span><span>' +
          escapeHtml(formatDate(data.dueDate)) +
          '</span></div>'
        : '') +
      '</div>' +
      '</header>' +
      '<section class="sheet-billto">' +
      '<div class="sheet-label">' +
      escapeHtml(tUi('pdf.billTo')) +
      '</div>' +
      '<div class="sheet-party-name">' +
      escapeHtml(data.client.name) +
      '</div>' +
      '<div class="sheet-party-lines">' +
      addressLines(data.client) +
      '</div>' +
      '</section>' +
      '<table class="sheet-table">' +
      '<thead><tr>' +
      '<th class="sheet-col-num">#</th>' +
      '<th class="sheet-col-desc">' +
      escapeHtml(tUi('pdf.column.description')) +
      '</th>' +
      '<th class="sheet-col-qty">' +
      escapeHtml(tUi('pdf.column.quantity')) +
      '</th>' +
      '<th class="sheet-col-price">' +
      escapeHtml(tUi('pdf.column.amount')) +
      '</th>' +
      '<th class="sheet-col-amount">' +
      escapeHtml(tUi('pdf.total')) +
      '</th>' +
      '</tr></thead>' +
      '<tbody>' +
      sheetItemRows(data.items, data.currency) +
      '</tbody>' +
      '</table>' +
      '<section class="sheet-totals">' +
      '<div class="sheet-total-row"><span>' +
      escapeHtml(tUi('ui.subtotal')) +
      '</span><span>' +
      escapeHtml(formatCurrency(data.subtotal, data.currency)) +
      '</span></div>' +
      '<div class="sheet-total-row"><span>' +
      escapeHtml(tUi('pdf.tax')) +
      ' (' +
      escapeHtml(data.taxRate) +
      '%)</span><span>' +
      escapeHtml(formatCurrency(taxAmount, data.currency)) +
      '</span></div>' +
      '<div class="sheet-total-row sheet-grand"><span>' +
      escapeHtml(tUi('pdf.total')) +
      '</span><span>' +
      escapeHtml(formatCurrency(data.total, data.currency)) +
      '</span></div>' +
      '</section>' +
      (data.paymentType
        ? '<section class="sheet-note"><div class="sheet-label">' +
          escapeHtml(tUi('ui.paymentHeading')) +
          '</div><p>' +
          escapeHtml(data.paymentType) +
          '</p></section>'
        : '') +
      (data.notes
        ? '<section class="sheet-note"><div class="sheet-label">' +
          escapeHtml(tUi('ui.notesHeading')) +
          '</div><p>' +
          escapeHtml(data.notes) +
          '</p></section>'
        : '') +
      '<footer class="sheet-foot">' +
      escapeHtml(tUi('pdf.thanks')) +
      '</footer>' +
      '</div>'
    );
  };

  var renderSheet = function () {
    if (!sheet && !sheetModal) return;
    var markup = renderSheetMarkup();
    if (sheet) sheet.innerHTML = markup;
    if (sheetModal) sheetModal.innerHTML = markup;
    updateSheetScales();
  };

  // Scale a fixed-width A4 down to whatever room its viewport has. Guarded
  // because jsdom (tests) has no layout and no ResizeObserver — there we only
  // check content, never pixels.
  var scaleSheet = function (el, available) {
    if (!el || !available) return;
    var scale = Math.min(1, available / SHEET_WIDTH);
    el.style.transform = 'scale(' + scale + ')';
    // Collapse the box (overflow is visible) so the scaled sheet still
    // influences the stage's scroll height and never clips.
    el.style.height = 'auto';
    el.style.width = available + 'px';
  };

  var scaleInto = function (el, viewport) {
    if (!viewport) return;
    var available = viewport.clientWidth - 32; // minus the viewport's padding
    if (available > 0) scaleSheet(el, available);
  };

  var updateSheetScales = function () {
    if (sheet) scaleInto(sheet, document.querySelector('.sheet-pane .sheet-viewport'));
    if (sheetModal)
      scaleInto(sheetModal, document.querySelector('.preview-dialog .preview-viewport'));
  };

  // Keep the sheet fitting its viewport as the window resizes. Prefer a
  // ResizeObserver on the panes; fall back to window.resize where it is missing
  // (older browsers, and jsdom in tests — where this whole branch is inert).
  if (typeof window.ResizeObserver === 'function') {
    [sheetPane, previewModal].forEach(function (node) {
      if (node) new window.ResizeObserver(updateSheetScales).observe(node);
    });
  } else {
    window.addEventListener('resize', updateSheetScales);
  }

  // Preview dialog: opens from the sticky pane (desktop) or the action bar
  // (phones/tablets); closes on the button, the backdrop, or Esc. Focus moves
  // in on open and returns to the trigger on close.
  var lastPreviewTrigger = null;

  var openPreview = function (trigger) {
    if (!previewModal) return;
    lastPreviewTrigger = trigger || null;
    previewModal.classList.remove('hidden');
    previewModal.classList.add('flex');
    document.body.style.overflow = 'hidden';
    updateSheetScales();
    if (previewClose) previewClose.focus();
  };

  var closePreview = function () {
    if (!previewModal || previewModal.classList.contains('hidden')) return;
    previewModal.classList.add('hidden');
    previewModal.classList.remove('flex');
    document.body.style.overflow = '';
    if (lastPreviewTrigger && typeof lastPreviewTrigger.focus === 'function') {
      lastPreviewTrigger.focus();
    }
    lastPreviewTrigger = null;
  };

  if (previewBtn) {
    previewBtn.addEventListener('click', function () {
      openPreview(previewBtn);
    });
  }
  if (previewOpen) {
    previewOpen.addEventListener('click', function () {
      openPreview(previewOpen);
    });
  }
  if (previewClose) previewClose.addEventListener('click', closePreview);
  if (previewModal) {
    previewModal.addEventListener('click', function (e) {
      // Backdrop click: the dialog itself must not close on inner clicks.
      if (e.target === previewModal) closePreview();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePreview();
  });

  // Re-render the sheet whenever anything it shows changes.
  form.addEventListener('input', renderSheet);
  form.addEventListener('change', renderSheet);

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // stop native form submission (page navigation)
    submitBtnLabel.textContent = tUi('ui.processing');
    submitBtn.disabled = true;
    submitBtn.setAttribute('aria-busy', 'true');

    var invoiceData = collectData();

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
        // Form data is preserved (locked decision #3): the sheet still mirrors
        // it and the success panel arrives in R6.
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
  setDocType(docTypeSelect.value || docTypeSelect.options[0].value);
  document.getElementById('invoice-date').valueAsDate = new Date();
  updateTotals();
  // applyLang() renders the sheet, but the seeded date is set after it — render
  // once more so the sheet starts in sync with the form.
  renderSheet();
})();
