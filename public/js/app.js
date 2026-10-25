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
  var successPanel = document.getElementById('success-panel');
  var successNumber = document.getElementById('success-number');
  var openPreviewBtn = document.getElementById('open-preview-btn');
  var newDocumentBtn = document.getElementById('new-document-btn');
  var itemsCountEl = document.getElementById('items-count');
  var toggleFromBtn = document.getElementById('toggle-from-btn');
  var fromSectionContent = document.getElementById('from-section-content');

  // --- i18n (chunk 5.3): same dictionaries the server uses for PDFs ---
  var I18N = window.I18N || {};
  var currentLang = 'en';
  try {
    if (localStorage.getItem('pdfinvoice-lang') === 'fr') currentLang = 'fr';
  } catch (e) {
    /* storage unavailable — stay on English */
  }

  var COMPANY_STORAGE_KEY = 'pdfinvoice-company';
  var loadCompanyInfo = function () {
    try {
      var data = localStorage.getItem(COMPANY_STORAGE_KEY);
      if (!data) return;
      var parsed = JSON.parse(data);
      var fields = [
        'company-name',
        'company-address',
        'company-city',
        'company-phone',
        'company-email',
      ];
      fields.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && parsed[id] != null) {
          el.value = parsed[id];
        }
      });
    } catch (e) {
      /* ignore */
    }
  };
  var saveCompanyInfo = function () {
    try {
      var data = {};
      var fields = [
        'company-name',
        'company-address',
        'company-city',
        'company-phone',
        'company-email',
      ];
      fields.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) data[id] = el.value;
      });
      localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* ignore */
    }
  };

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
    // Re-label item blocks (mobile) and keep the "X of 15 items" counter current.
    renumberItems();
    updateItemsCounter();
    // If a PDF was just generated, keep the success panel's document number in
    // the active language (without re-capturing the type or stealing focus).
    if (successPanel && !successPanel.classList.contains('hidden')) {
      refreshSuccessNumber();
    }
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
    updateItemsCounter();
  };

  var updateItemsCounter = function () {
    var count = document.querySelectorAll('.item-row').length;
    if (itemsCountEl) itemsCountEl.textContent = tUi('ui.itemsOf', { count: count });
  };

  var renumberItems = function () {
    document.querySelectorAll('.item-row').forEach(function (row, index) {
      row.dataset.itemLabel = tUi('ui.itemN', { n: index + 1 });
    });
  };

  var addNewItem = function () {
    if (document.querySelectorAll('.item-row').length >= MAX_ITEMS) return;
    var itemRow = document.createElement('tr');
    itemRow.classList.add('item-row', 'border-b', 'border-rule');
    // Used by the mobile stacked layout (chunk R7): "Item N" above the block.
    itemRow.dataset.itemLabel = tUi('ui.itemN', {
      n: document.querySelectorAll('.item-row').length + 1,
    });
    itemRow.innerHTML =
      '<td class="py-2 pr-2 align-middle" data-i18n-datalabel="ui.tableDescription" data-label="Description"><input type="text" data-i18n-ph="ui.itemDescriptionPh" placeholder="Item description" maxlength="54" data-i18n-aria="ui.itemDescriptionAria" aria-label="Item description" class="description invoice-input w-full rounded-md p-2"></td>' +
      '<td class="py-2 px-2 align-middle" data-i18n-datalabel="ui.tableQty" data-label="Qty"><input type="number" value="1" min="1" inputmode="decimal" data-i18n-aria="ui.itemQuantityAria" aria-label="Quantity" class="quantity invoice-input money w-full rounded-md p-2 text-center"></td>' +
      '<td class="py-2 px-2 align-middle" data-i18n-datalabel="ui.tablePrice" data-label="Price"><input type="number" value="0.00" min="0" step="0.01" inputmode="decimal" data-i18n-aria="ui.itemPriceAria" aria-label="Price" class="price invoice-input money w-full rounded-md p-2 text-center"></td>' +
      '<td class="py-2 pl-2 align-middle text-center item-actions">' +
      '<button type="button" data-i18n-aria="ui.removeItemAria" aria-label="Remove item" class="remove-item-btn rounded-md p-1.5 text-ink-soft transition-colors hover:text-accent-ink">' +
      '<svg class="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>' +
      '</button>' +
      '</td>';
    invoiceItemsContainer.appendChild(itemRow);
    applyLang(currentLang); // translate the freshly added row
    renumberItems();
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
    if (
      e.target.matches(
        '#company-name, #company-address, #company-city, #company-phone, #company-email',
      )
    ) {
      saveCompanyInfo();
    }
  });

  addItemBtn.addEventListener('click', addNewItem);

  invoiceItemsContainer.addEventListener('click', function (e) {
    if (e.target.closest('.remove-item-btn')) {
      e.target.closest('.item-row').remove();
      renumberItems();
      updateTotals();
      updateAddItemState();
    }
  });

  var showToast = function (el, message) {
    el.textContent = message;
    el.classList.remove('opacity-0', '-translate-y-2', 'translate-y-2', 'pointer-events-none');
    el.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
    setTimeout(function () {
      el.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
      el.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
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
      currency: currencySelect.value || 'MAD',
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
  var SHEET_HEIGHT = 1123;

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

  var scaleSheet = function (el, viewport) {
    if (!el || !viewport) return;
    var style = window.getComputedStyle ? window.getComputedStyle(viewport) : null;
    var padX =
      (parseFloat(style && style.paddingLeft) || 0) +
      (parseFloat(style && style.paddingRight) || 0);
    var padY =
      (parseFloat(style && style.paddingTop) || 0) +
      (parseFloat(style && style.paddingBottom) || 0);
    var availW = viewport.clientWidth - padX;
    var availH = viewport.clientHeight - padY;
    if (availW <= 0 || availH <= 0) return;
    var sheetH = el.offsetHeight || SHEET_HEIGHT;
    if (sheetH <= 0) sheetH = SHEET_HEIGHT;
    var scale = Math.min(1, availW / SHEET_WIDTH, availH / sheetH);
    if (!isFinite(scale) || scale <= 0) return;
    scale = Math.max(scale, 0.01);
    el.style.transformOrigin = 'top left';
    el.style.transform = 'scale(' + scale + ')';
    var stage = el.parentElement;
    if (stage && stage.classList && stage.classList.contains('sheet-stage')) {
      stage.style.width = (SHEET_WIDTH * scale).toFixed(3) + 'px';
      stage.style.height = (sheetH * scale).toFixed(3) + 'px';
    }
  };

  var scaleInto = function (el, viewport) {
    if (!viewport) return;
    var stage = el && el.parentElement;
    if (stage) {
      stage.style.width = SHEET_WIDTH + 'px';
      stage.style.height = SHEET_HEIGHT + 'px';
    }
    scaleSheet(el, viewport);
  };

  var sheetPaneViewport = function () {
    return document.querySelector('.sheet-pane .sheet-viewport');
  };
  var previewViewport = function () {
    return document.querySelector('.preview-dialog .preview-viewport');
  };

  var updateSheetScales = function () {
    if (sheet) scaleInto(sheet, sheetPaneViewport());
    if (sheetModal) scaleInto(sheetModal, previewViewport());
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
  var FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  // Keep Tab inside the dialog while it is open (R9 keyboard pass). The sheet
  // has a single focusable control, so Tab/Shift+Tab stay on the close button.
  var trapPreviewFocus = function (e) {
    if (e.key !== 'Tab' || !previewModal || previewModal.classList.contains('hidden')) return;
    var focusables = previewModal.querySelectorAll(FOCUSABLE_SELECTOR);
    if (!focusables.length) return;
    var first = focusables[0];
    var last = focusables[focusables.length - 1];
    var active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !previewModal.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !previewModal.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePreview();
    trapPreviewFocus(e);
  });

  // Re-render the sheet whenever anything it shows changes.
  form.addEventListener('input', renderSheet);
  form.addEventListener('change', renderSheet);

  // --- Inline validation errors (chunk R6) -----------------------------------
  // The server's message is the source of truth (it is already language-aware);
  // each `errors[].path` is mapped to the control that produced it. The message
  // sits under that control, the control gets aria-invalid/aria-describedby, and
  // the first invalid field in DOM order is focused. The toast stays as summary.
  var FIELD_IDS = {
    'company.name': 'company-name',
    'company.address': 'company-address',
    'company.city': 'company-city',
    'company.phone': 'company-phone',
    'company.email': 'company-email',
    'client.name': 'client-name',
    'client.address': 'client-address',
    'client.city': 'client-city',
    'client.phone': 'client-phone',
    'client.email': 'client-email',
    issueDate: 'invoice-date',
    dueDate: 'due-date',
    paymentType: 'payment-type',
    notes: 'notes',
    taxRate: 'tax-rate',
    currency: 'currency',
  };
  var ITEM_SELECTORS = { description: '.description', quantity: '.quantity', price: '.price' };
  var fieldErrors = [];
  var errorSeq = 0;

  var fieldForPath = function (path) {
    if (path === 'documentType') {
      // The real <select> is visually hidden; mark/focus the checked segment.
      return document.querySelector('input[name="doc-type"]:checked');
    }
    var item = /^items(?:\[(\d+)\]|\.(\d+))\.([a-z]+)$/.exec(path || '');
    if (item) {
      var index = Number(item[1] != null ? item[1] : item[2]);
      var row = document.querySelectorAll('.item-row')[index];
      var selector = ITEM_SELECTORS[item[3]];
      return row && selector ? row.querySelector(selector) : null;
    }
    if (path === 'items') {
      // Array-level error (too many items, wrong shape): anchor on row one.
      return document.querySelector('.item-row .description');
    }
    var id = FIELD_IDS[path];
    return id ? document.getElementById(id) : null;
  };

  var clearFieldErrors = function () {
    fieldErrors.forEach(function (entry) {
      entry.el.remove();
      entry.field.removeAttribute('aria-invalid');
      entry.field.removeAttribute('aria-describedby');
    });
    fieldErrors = [];
  };

  var clearFieldError = function (field) {
    var kept = [];
    fieldErrors.forEach(function (entry) {
      if (entry.field === field) {
        entry.el.remove();
        entry.field.removeAttribute('aria-invalid');
        entry.field.removeAttribute('aria-describedby');
      } else {
        kept.push(entry);
      }
    });
    fieldErrors = kept;
  };

  var insertFieldError = function (field, message) {
    var el = document.createElement('p');
    el.className = 'field-error';
    errorSeq += 1;
    el.id = 'field-error-' + errorSeq;
    el.textContent = message;

    var cell = field.closest && field.closest('td');
    if (cell) {
      cell.appendChild(el);
    } else if (field.name === 'doc-type' && field.closest('.seg')) {
      field.closest('.seg').insertAdjacentElement('afterend', el);
    } else if ((field.id === 'tax-rate' || field.id === 'currency') && field.closest('section')) {
      // These live in flex/grid rows — hang the message off the whole row so
      // the control alignment stays intact.
      field.closest('section').insertAdjacentElement('afterend', el);
    } else if (field.parentElement) {
      field.parentElement.insertAdjacentElement('afterend', el);
    } else {
      field.insertAdjacentElement('afterend', el);
    }

    field.setAttribute('aria-invalid', 'true');
    field.setAttribute('aria-describedby', el.id);
    fieldErrors.push({ field: field, el: el });
  };

  /** Render every server field error and focus the first invalid control. */
  var applyFieldErrors = function (errors) {
    clearFieldErrors();
    var first = null;
    errors.forEach(function (error) {
      if (!error || !error.path || !error.msg) return;
      var field = fieldForPath(error.path);
      if (!field) return;
      insertFieldError(field, error.msg);
      if (
        !first ||
        (first.compareDocumentPosition(field) & window.Node.DOCUMENT_POSITION_PRECEDING) !== 0
      ) {
        first = field;
      }
    });
    if (first && typeof first.focus === 'function') first.focus();
  };

  // Editing a field clears its error immediately (the server will re-check on
  // the next submit).
  var clearErrorOnEdit = function (e) {
    var field = e.target;
    if (field && field.getAttribute && field.getAttribute('aria-invalid') === 'true') {
      clearFieldError(field);
    }
  };
  form.addEventListener('input', clearErrorOnEdit);
  form.addEventListener('change', clearErrorOnEdit);

  // --- Success flow (chunk R6) -----------------------------------------------
  // The generated blob stays in memory, so "Open preview" / "Download again"
  // cost zero extra POSTs. Object URLs are tracked and released deterministically.
  var lastPdfBlob = null;
  var objectUrls = [];
  var lastInvoiceNumber = '';
  var lastInvoiceDocType = 'SERVICE INVOICE';

  var createTrackedUrl = function () {
    var url = window.URL.createObjectURL(lastPdfBlob);
    objectUrls.push(url);
    return url;
  };

  var revokeUrl = function (url) {
    try {
      window.URL.revokeObjectURL(url);
    } catch (e) {
      /* ignore */
    }
    objectUrls = objectUrls.filter(function (u) {
      return u !== url;
    });
  };

  var releaseObjectUrls = function () {
    objectUrls.slice().forEach(revokeUrl);
  };

  var buildPdfFilename = function () {
    var name = document.getElementById('client-name')
      ? document.getElementById('client-name').value
      : '';
    var city = document.getElementById('client-city')
      ? document.getElementById('client-city').value
      : '';
    var parts = [];
    if (name && String(name).trim()) {
      parts.push(
        String(name)
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
      );
    }
    if (city && String(city).trim()) {
      parts.push(
        String(city)
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
      );
    }
    parts.push('invoice');
    return parts.filter(Boolean).join('-') + '.pdf';
  };

  var downloadUrl = function (url) {
    var a = document.createElement('a');
    a.href = url;
    a.download = buildPdfFilename();
    a.click();
    revokeUrl(url);
  };

  /** Open a stored blob in a new tab; fall back to a download if popups block. */
  var openPdf = function (blob) {
    lastPdfBlob = blob;
    var url = createTrackedUrl();
    var tab = window.open(url, '_blank');
    if (tab) {
      // Give the new tab time to start loading the blob, then free it.
      setTimeout(function () {
        revokeUrl(url);
      }, 60000);
      showToast(document.getElementById('notification-toast'), tUi('ui.toastPreview'));
    } else {
      downloadUrl(url);
      showToast(document.getElementById('notification-toast'), tUi('ui.toastDownloaded'));
    }
  };

  /** Re-draw only the invoice-number line in the active language. Used by
   *  applyLang() so a language switch never re-captures the document type or
   *  moves focus out of the language toggle. */
  var refreshSuccessNumber = function () {
    if (!successNumber) return;
    if (lastInvoiceNumber) {
      var meta = DOC_TITLES[lastInvoiceDocType] || DEFAULT_DOC;
      successNumber.textContent = tUi(meta.id) + ' ' + lastInvoiceNumber;
      successNumber.classList.remove('hidden');
    } else {
      successNumber.textContent = '';
      successNumber.classList.add('hidden');
    }
  };

  var showSuccess = function (invoiceNumber) {
    if (!successPanel) return;
    if (invoiceNumber) {
      lastInvoiceNumber = invoiceNumber;
      lastInvoiceDocType = docTypeSelect.value;
    }
    refreshSuccessNumber();
    successPanel.classList.remove('hidden');
    successPanel.focus();
  };

  var hideSuccess = function () {
    if (successPanel) successPanel.classList.add('hidden');
  };

  /** Explicit reset — the only path that wipes the form (chunk R6).
   *  Company fields are the saved "From" profile (localStorage), so they are
   *  deliberately left untouched — exactly like a page reload. */
  var newDocument = function () {
    [
      'client-name',
      'client-address',
      'client-city',
      'client-phone',
      'client-email',
      'payment-type',
      'notes',
    ].forEach(function (id) {
      var field = document.getElementById(id);
      if (field) field.value = '';
    });

    document.getElementById('invoice-date').valueAsDate = new Date();
    document.getElementById('due-date').value = '';
    document.getElementById('tax-rate').value = '0';
    currencySelect.value = 'MAD';
    setDocType(docTypeSelect.options[0].value);

    invoiceItemsContainer.innerHTML = '';
    addNewItem(); // one empty row, correctly labelled for the current language

    clearFieldErrors();
    hideSuccess();
    lastPdfBlob = null;
    lastInvoiceNumber = '';
    lastInvoiceDocType = 'SERVICE INVOICE';
    releaseObjectUrls();

    updateTotals();
    renderSheet();
    document.getElementById('company-name').focus();
  };

  if (openPreviewBtn) {
    openPreviewBtn.addEventListener('click', function () {
      if (lastPdfBlob) openPdf(lastPdfBlob);
    });
  }
  if (newDocumentBtn) newDocumentBtn.addEventListener('click', newDocument);

  form.addEventListener('submit', function (e) {
    e.preventDefault(); // stop native form submission (page navigation)
    clearFieldErrors();
    hideSuccess();
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
                // Field-level messages (already localised by the server) + a
                // compact toast summary (first 3 + count).
                applyFieldErrors(errData.errors);
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
        var invoiceNumber =
          res.headers && typeof res.headers.get === 'function'
            ? res.headers.get('X-Invoice-Number') || ''
            : '';
        return res.blob().then(function (blob) {
          return { blob: blob, number: invoiceNumber };
        });
      })
      .then(function (result) {
        // Auto-open as before, then offer the follow-up actions. The blob is
        // kept, so neither button below re-submits the form.
        openPdf(result.blob);
        showSuccess(result.number);
        // Form data is preserved (locked decision #3): the sheet still mirrors
        // it and the user can tweak + regenerate.
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

  if (toggleFromBtn && fromSectionContent) {
    toggleFromBtn.addEventListener('click', function () {
      var isHidden = fromSectionContent.classList.toggle('hidden');
      toggleFromBtn.textContent = isHidden
        ? tUi('ui.expand') || 'Expand'
        : tUi('ui.collapse') || 'Collapse';
    });
  }

  // --- Initial setup ---
  loadCompanyInfo();
  addNewItem();
  setDocType(docTypeSelect.value || docTypeSelect.options[0].value);
  document.getElementById('invoice-date').valueAsDate = new Date();
  updateTotals();
  // applyLang() renders the sheet, but the seeded date is set after it — render
  // once more so the sheet starts in sync with the form.
  renderSheet();
})();
