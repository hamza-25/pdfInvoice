// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { JSDOM } from 'jsdom';
import { en } from '../src/locales/en';
import { fr } from '../src/locales/fr';

/**
 * The page is assembled from EJS partials (chunk R2), so render it the way the
 * server does — with `filename` set so includes resolve — and test the HTML
 * that actually ships. jsdom does not fetch `<script src>`, so the two page
 * scripts are inlined into the rendered HTML instead (theme boot in <head>,
 * behaviour bundle deferred after the DOM).
 */
const renderPage = () => {
  const view = path.resolve(process.cwd(), 'views/index.ejs');
  let html = ejs.render(fs.readFileSync(view, 'utf8'), {}, { filename: view });

  // Stand in for the browser's fetch of the external scripts. Keep the original
  // tags so tests can still assert the real markup references /js/*.
  html = html.replace(
    /<script src="\/js\/theme-boot\.js"><\/script>/,
    `<script src="/js/theme-boot.js"></script><script>${themeBootJs}</script>`,
  );
  html = html.replace(
    /<script src="\/js\/app\.js" defer><\/script>/,
    `<script src="/js/app.js" defer></script><script>window.addEventListener('DOMContentLoaded',()=>{${appJs}});</script>`,
  );
  return html;
};

const appJs = fs.readFileSync(path.resolve(process.cwd(), 'public/js/app.js'), 'utf8');
const themeBootJs = fs.readFileSync(path.resolve(process.cwd(), 'public/js/theme-boot.js'), 'utf8');

type FetchCall = { url: string; options: { method?: string; body?: string } };
type MockHandler = (url: string, options: FetchCall['options']) => Promise<unknown>;

interface Harness {
  dom: JSDOM;
  window: JSDOM['window'];
  document: Document;
  calls: FetchCall[];
  /** URLs passed to window.open (the preview tab). */
  openCalls: string[];
  /** How often a download anchor was clicked (popup-blocked fallback). */
  anchorClicks: () => number;
}

interface BootOptions {
  /** Make window.open return null, as browsers do for blocked popups. */
  popupBlocked?: boolean;
  /** Seed the persisted language before the page script runs. */
  lang?: 'en' | 'fr';
  /** Seed the persisted theme before the page script runs. */
  theme?: 'light' | 'dark';
  /** Simulate /i18n.js failing to load — the page must fall back to English. */
  withoutI18N?: boolean;
}

/**
 * Boot the form in jsdom with a mocked fetch (and mocked download), and resolve
 * once the page scripts have run. Mirrors the real load order: theme-boot.js
 * evaluates before the DOM (pre-paint), app.js after DOMContentLoaded.
 */
function boot(fetchImpl?: MockHandler, options: BootOptions = {}): Promise<Harness> {
  const calls: FetchCall[] = [];
  const openCalls: string[] = [];
  const stats = { anchorClicks: 0 };
  return new Promise((resolve) => {
    const dom = new JSDOM(renderPage(), {
      runScripts: 'dangerously',
      url: 'http://localhost/',
      beforeParse(window) {
        // The real dictionaries, as served by GET /i18n.js in production.
        if (!options.withoutI18N) {
          (window as unknown as { I18N: unknown }).I18N = { en, fr };
        }
        if (options.lang) {
          window.localStorage.setItem('pdfinvoice-lang', options.lang);
        }
        if (options.theme) {
          window.localStorage.setItem('pdfinvoice-theme', options.theme);
        }

        // theme-boot.js is inlined in <head> by renderPage() and evaluates
        // during parsing, exactly like a real <script src>.

        // Don't actually try to navigate on download; count the clicks instead.
        window.HTMLAnchorElement.prototype.click = function () {
          stats.anchorClicks += 1;
        };
        (window.URL as unknown as { createObjectURL: () => string }).createObjectURL = () =>
          'blob:mock';
        (window.URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};

        (window as unknown as { open: (url: string) => unknown }).open = (url: string) => {
          openCalls.push(url);
          return options.popupBlocked ? null : {};
        };

        window.fetch = ((url: string, options: FetchCall['options']) => {
          calls.push({ url, options });
          if (fetchImpl) return fetchImpl(url, options);
          const blob = new window.Blob(['%PDF-1.3'], { type: 'application/pdf' });
          return Promise.resolve({
            ok: true,
            status: 200,
            blob: () => Promise.resolve(blob),
            json: () => Promise.resolve({}),
          });
        }) as unknown as typeof window.fetch;

        window.addEventListener('DOMContentLoaded', () => {
          resolve({
            dom,
            window,
            document: window.document,
            calls,
            openCalls,
            anchorClicks: () => stats.anchorClicks,
          });
        });
      },
    });
  });
}

/** Let the promise chain inside the submit handler settle. */
const flush = () => new Promise((r) => setTimeout(r, 20));

const submit = (window: JSDOM['window'], document: Document) => {
  const form = document.getElementById('invoice-form') as HTMLFormElement;
  const event = new window.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(event);
  return event;
};

const setItem = (
  window: JSDOM['window'],
  document: Document,
  quantity: string,
  price: string,
  taxRate = '0',
) => {
  const row = document.querySelector('.item-row') as HTMLElement;
  const qty = row.querySelector('.quantity') as HTMLInputElement;
  const p = row.querySelector('.price') as HTMLInputElement;
  qty.value = quantity;
  p.value = price;
  qty.dispatchEvent(new window.Event('input', { bubbles: true }));

  const tax = document.getElementById('tax-rate') as HTMLInputElement;
  tax.value = taxRate;
  tax.dispatchEvent(new window.Event('input', { bubbles: true }));
};

describe('form initialization', () => {
  it('starts with one item row and zeroed totals', async () => {
    const { document } = await boot();
    expect(document.querySelectorAll('.item-row').length).toBe(1);
    expect(document.getElementById('subtotal')!.textContent).toBe('0,00 MAD');
    expect(document.getElementById('total-amount')!.textContent).toBe('0,00 MAD');
  });
});

describe('totals calculation', () => {
  it('computes subtotal and total including tax', async () => {
    const { window, document } = await boot();
    setItem(window, document, '2', '10', '10');
    expect(document.getElementById('subtotal')!.textContent).toBe('20,00 MAD');
    expect(document.getElementById('total-amount')!.textContent).toBe('22,00 MAD');
  });
});

describe('currency switcher (chunks 0.6 / 4.6)', () => {
  it('re-renders amounts per currency locale on change without mangling values', async () => {
    const { window, document } = await boot();
    setItem(window, document, '2', '10', '0');
    const currency = document.getElementById('currency') as HTMLSelectElement;

    const expected = (code: string, locale: string) =>
      new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(20);

    currency.value = 'MAD';
    currency.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(document.getElementById('subtotal')!.textContent).toBe(expected('MAD', 'fr-MA'));
    expect(document.getElementById('total-amount')!.textContent).toBe(expected('MAD', 'fr-MA'));

    currency.value = 'EUR';
    currency.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(document.getElementById('subtotal')!.textContent).toBe(expected('EUR', 'de-DE'));

    currency.value = 'USD';
    currency.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(document.getElementById('subtotal')!.textContent).toBe(expected('USD', 'en-US'));

    // JPY has no fractional digits in Intl
    currency.value = 'JPY';
    currency.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(document.getElementById('subtotal')!.textContent).toBe(expected('JPY', 'ja-JP'));
    expect(document.getElementById('subtotal')!.textContent).not.toContain('.00');
  });
});

describe('item rows', () => {
  it('adds and removes rows', async () => {
    const { window, document } = await boot();
    (document.getElementById('add-item-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(document.querySelectorAll('.item-row').length).toBe(2);

    (document.querySelector('.remove-item-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(document.querySelectorAll('.item-row').length).toBe(1);
  });
});

describe('submit behaviour (chunks 0.2 / 0.3 / 0.7)', () => {
  it('sends exactly one request and prevents native navigation', async () => {
    const { window, document, calls } = await boot();
    const event = submit(window, document);

    expect(event.defaultPrevented).toBe(true);
    expect(calls.length).toBe(1);
    expect(calls[0].url).toBe('/pdf/invoice-generate');
    expect(calls[0].options.method).toBe('POST');

    const body = JSON.parse(calls[0].options.body as string);
    expect(body.documentType).toBe('SERVICE INVOICE');
    expect(Array.isArray(body.items)).toBe(true);

    await flush();
  });

  it('preserves the form data after a successful generate (chunk R5)', async () => {
    const { window, document } = await boot();
    const type = document.getElementById('invoice-type') as HTMLSelectElement;
    type.value = 'QUOTE';

    submit(window, document);
    const toast = document.getElementById('notification-toast')!;
    // not visible synchronously (good: toast must wait for the blob)
    expect(toast.className).not.toContain('opacity-100');

    await flush();
    expect(toast.className).toContain('opacity-100');
    expect(toast.textContent).toContain('new tab'); // preview path (chunk 4.4)

    // Locked decision #3: nothing is wiped — the user can tweak and regenerate.
    expect(type.value).toBe('QUOTE');

    const btn = document.getElementById('submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(document.getElementById('submit-btn-label')!.textContent).toBe(en['ui.submit']);
  });

  it('opens the PDF blob in a new tab for preview (chunk 4.4)', async () => {
    const { window, document, openCalls } = await boot();

    submit(window, document);
    await flush();

    expect(openCalls).toEqual(['blob:mock']);
    expect(document.getElementById('notification-toast')!.textContent).toContain('new tab');
  });

  it('falls back to a direct download when the popup is blocked (chunk 4.4)', async () => {
    const { window, document, openCalls, anchorClicks } = await boot(undefined, {
      popupBlocked: true,
    });

    submit(window, document);
    await flush();

    expect(openCalls).toEqual(['blob:mock']); // open was still attempted
    expect(anchorClicks()).toBe(1); // ...and the file was downloaded instead
    expect(document.getElementById('notification-toast')!.textContent).toContain('success');
  });

  it('shows field messages from a 400 JSON response', async () => {
    const { window, document } = await boot(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        json: () =>
          Promise.resolve({ errors: [{ path: 'company.name', msg: 'Company name is required' }] }),
      }),
    );

    submit(window, document);
    await flush();

    const err = document.getElementById('notification-toast-error')!;
    expect(err.textContent).toContain('Company name is required');
    expect(err.className).toContain('opacity-100');

    const btn = document.getElementById('submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('shows an error toast when the network request fails', async () => {
    const { window, document } = await boot(() => Promise.reject(new Error('Failed to fetch')));

    submit(window, document);
    await flush();

    expect(document.getElementById('notification-toast-error')!.textContent).toContain(
      'Failed to fetch',
    );
    const btn = document.getElementById('submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });
});

describe('document type segmented control (chunk R3)', () => {
  it('mirrors a radio selection into the real <select> (the submitted value)', async () => {
    const { window, document, calls } = await boot();
    const select = document.getElementById('invoice-type') as HTMLSelectElement;

    const quote = document.querySelector(
      'input[name="doc-type"][value="QUOTE"]',
    ) as HTMLInputElement;
    quote.checked = true;
    quote.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(select.value).toBe('QUOTE');

    submit(window, document);
    await flush();
    const body = JSON.parse(calls[0].options.body as string);
    expect(body.documentType).toBe('QUOTE');
  });

  it('starts on the first document type with that radio checked', async () => {
    const { document } = await boot();
    const select = document.getElementById('invoice-type') as HTMLSelectElement;
    expect(select.value).toBe('SERVICE INVOICE');
    const checked = document.querySelector('input[name="doc-type"]:checked') as HTMLInputElement;
    expect(checked.value).toBe('SERVICE INVOICE');
  });

  it('keeps the radios and select on the chosen type after a successful submit (chunk R5)', async () => {
    const { window, document } = await boot();
    const quote = document.querySelector(
      'input[name="doc-type"][value="QUOTE"]',
    ) as HTMLInputElement;
    quote.checked = true;
    quote.dispatchEvent(new window.Event('change', { bubbles: true }));

    submit(window, document);
    await flush();

    // Data is preserved, so the segmented control still reflects the choice.
    expect((document.getElementById('invoice-type') as HTMLSelectElement).value).toBe('QUOTE');
    const checked = document.querySelector('input[name="doc-type"]:checked') as HTMLInputElement;
    expect(checked.value).toBe('QUOTE');
  });

  it('exposes each segment as a labelled radio', async () => {
    const { document } = await boot();
    const radios = document.querySelectorAll('input[name="doc-type"]');
    expect(radios).toHaveLength(4);
    radios.forEach((radio) => {
      expect(radio.getAttribute('aria-label')).toBeTruthy();
    });
  });
});

describe('mobile-first structure (chunk R4)', () => {
  it('labels each item cell for the stacked mobile layout', async () => {
    const { document } = await boot();
    const row = document.querySelector('.item-row')!;
    const cells = row.querySelectorAll('td');
    expect(cells[0].getAttribute('data-label')).toBe('Description');
    expect(cells[1].getAttribute('data-label')).toBe('Qty');
    expect(cells[2].getAttribute('data-label')).toBe('Price');
  });

  it('translates the stacked cell labels with the rest of the UI', async () => {
    const { window, document } = await boot(undefined, { lang: 'fr' });
    const row = document.querySelector('.item-row')!;
    const cells = row.querySelectorAll('td');
    expect(cells[0].getAttribute('data-label')).toBe('Description');
    expect(cells[1].getAttribute('data-label')).toBe(fr['ui.tableQty']);
    // switching back translates them forward again
    const btn = document.querySelector('.lang-btn[data-lang="en"]') as HTMLElement;
    btn.dispatchEvent(new window.Event('click', { bubbles: true }));
    expect(row.querySelectorAll('td')[1].getAttribute('data-label')).toBe('Qty');
  });

  it('mirrors the running total into the sticky action bar', async () => {
    const { window, document } = await boot();
    expect(document.getElementById('action-total')!.textContent).toBe('0,00 MAD');

    setItem(window, document, '2', '10', '10');
    expect(document.getElementById('action-total')!.textContent).toBe('22,00 MAD');

    const currency = document.getElementById('currency') as HTMLSelectElement;
    currency.value = 'EUR';
    currency.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(document.getElementById('action-total')!.textContent).toBe(
      new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(22),
    );
  });

  it('keeps the single submit button inside the action bar', async () => {
    const { document } = await boot();
    expect(document.getElementById('submit-btn')!.closest('.action-bar')).toBeTruthy();
    expect(document.querySelectorAll('#submit-btn')).toHaveLength(1);
  });

  it('hints the numeric keyboard and autofill on mobile', async () => {
    const { document } = await boot();

    const qty = document.querySelector('.item-row .quantity') as HTMLInputElement;
    const price = document.querySelector('.item-row .price') as HTMLInputElement;
    expect(qty.getAttribute('inputmode')).toBe('decimal');
    expect(price.getAttribute('inputmode')).toBe('decimal');

    const pairs: Record<string, string> = {
      'company-name': 'organization',
      'company-address': 'street-address',
      'company-phone': 'tel',
      'company-email': 'email',
      'client-name': 'organization',
      'client-email': 'email',
    };
    for (const [id, autocomplete] of Object.entries(pairs)) {
      expect(document.getElementById(id)!.getAttribute('autocomplete')).toBe(autocomplete);
    }
    expect((document.getElementById('company-phone') as HTMLInputElement).type).toBe('tel');
  });
});

describe('accessibility (chunk 4.5)', () => {
  it('gives every form control an accessible name (label[for] or aria-label)', async () => {
    const { document } = await boot();

    const controls = document.querySelectorAll('input, select, textarea');
    expect(controls.length).toBeGreaterThan(10);
    const unnamed: string[] = [];
    controls.forEach((control) => {
      const id = control.getAttribute('id');
      const hasLabel = id ? !!document.querySelector(`label[for="${id}"]`) : false;
      const hasAria = !!control.getAttribute('aria-label');
      if (!hasLabel && !hasAria) unnamed.push(control.outerHTML.slice(0, 120));
    });
    expect(unnamed).toEqual([]);
  });

  it('announces toasts through live regions', async () => {
    const { document } = await boot();

    const ok = document.getElementById('notification-toast')!;
    const err = document.getElementById('notification-toast-error')!;
    expect(ok.getAttribute('role')).toBe('status');
    expect(ok.getAttribute('aria-live')).toBe('polite');
    expect(err.getAttribute('role')).toBe('alert');
    expect(err.getAttribute('aria-live')).toBe('assertive');
  });

  it('marks the server-required fields as required', async () => {
    const { document } = await boot();

    for (const id of ['company-name', 'client-name', 'invoice-date', 'currency', 'tax-rate']) {
      expect(document.getElementById(id)!.hasAttribute('required')).toBe(true);
    }
  });

  it('labels the dynamic item-row controls', async () => {
    const { document } = await boot();

    const row = document.querySelector('.item-row')!;
    expect(row.querySelector('.description')!.getAttribute('aria-label')).toBe('Item description');
    expect(row.querySelector('.quantity')!.getAttribute('aria-label')).toBe('Quantity');
    expect(row.querySelector('.price')!.getAttribute('aria-label')).toBe('Price');
    expect(row.querySelector('.remove-item-btn')!.getAttribute('aria-label')).toBe('Remove item');
  });

  it('has a visible keyboard focus style', async () => {
    // Styles now live in the Tailwind source (chunk R2) and are compiled to
    // /css/app.css — assert against the source that generates them.
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/app.css'), 'utf8');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('outline');
  });

  it('loads the display and UI typefaces and uses tabular figures for money (chunk R3)', async () => {
    const head = fs.readFileSync(path.resolve(process.cwd(), 'views/partials/head.ejs'), 'utf8');
    expect(head).toContain('Spectral');
    expect(head).toContain('IBM+Plex+Sans');
    expect(head).not.toContain('Inter');

    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/app.css'), 'utf8');
    expect(css).toMatch(/\.money\s*\{[^}]*tabular-nums/);
  });

  it('sets aria-busy on the submit button while the request is in flight', async () => {
    const { window, document } = await boot(() => new Promise(() => {})); // never settles

    submit(window, document);
    const btn = document.getElementById('submit-btn')!;
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.disabled).toBe(true);
  });
});

describe('language switcher (chunk 5.3)', () => {
  const clickLang = (window: JSDOM['window'], document: Document, lang: string) => {
    const btn = document.querySelector(`.lang-btn[data-lang="${lang}"]`) as HTMLElement;
    btn.dispatchEvent(new window.Event('click', { bubbles: true }));
  };

  it('translates the form UI when toggling to FR and back', async () => {
    const { window, document } = await boot();
    expect(document.querySelector('h1')!.textContent).toBe('Professional Document Builder');

    clickLang(window, document, 'fr');
    expect(document.querySelector('h1')!.textContent).toBe('Créateur de documents professionnels');
    expect(document.getElementById('submit-btn-label')!.textContent).toBe(fr['ui.submit']);
    expect(document.querySelector('label[for="currency"]')!.textContent).toBe('Devise');
    expect(document.documentElement.lang).toBe('fr');
    expect(document.querySelector('.lang-btn[data-lang="fr"]')!.getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(document.querySelector('.lang-btn[data-lang="en"]')!.getAttribute('aria-pressed')).toBe(
      'false',
    );

    clickLang(window, document, 'en');
    expect(document.querySelector('h1')!.textContent).toBe('Professional Document Builder');
    expect(document.documentElement.lang).toBe('en');
  });

  it('styles the pressed language button and leaves the other one neutral', async () => {
    const { document } = await boot();

    // Styles live in the Tailwind source now (chunk R2); assert the states are
    // driven by the accent token and the aria-pressed attribute.
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/app.css'), 'utf8');
    expect(css).toMatch(/\.lang-btn\[aria-pressed='true'\][^{]*\{[^}]*var\(--color-accent\)/);
    expect(css).toMatch(/\.lang-btn\[aria-pressed='true'\][^{]*\{[^}]*color:\s*#fff/);
    expect(css).toMatch(/\.lang-btn\[aria-pressed='false'\][^{]*\{[^}]*var\(--color-field\)/);

    // Both buttons expose the hook the CSS rules and the click handler rely on.
    expect(document.querySelectorAll('.lang-btn[data-lang="en"]')).toHaveLength(1);
    expect(document.querySelectorAll('.lang-btn[data-lang="fr"]')).toHaveLength(1);
  });

  it('translates placeholders and dynamic item rows', async () => {
    const { document } = await boot(undefined, { lang: 'fr' });

    const nameInput = document.getElementById('company-name') as HTMLInputElement;
    expect(nameInput.placeholder).toBe('Nom de votre entreprise');

    const row = document.querySelector('.item-row')!;
    const description = row.querySelector('.description')!;
    expect(description.getAttribute('aria-label')).toBe("Description de l'article");
    expect(description.getAttribute('placeholder')).toBe("Description de l'article");
    expect(row.querySelector('.remove-item-btn')!.getAttribute('aria-label')).toBe(
      "Supprimer l'article",
    );
  });

  it('sends the current language with the payload and remembers the choice', async () => {
    const { window, document, calls } = await boot(undefined, { lang: 'fr' });

    submit(window, document);
    await flush();

    const body = JSON.parse(calls[0].options.body!);
    expect(body.language).toBe('fr');
    expect(window.localStorage.getItem('pdfinvoice-lang')).toBe('fr');
  });

  it('defaults to sending language=en', async () => {
    const { window, document, calls } = await boot();

    submit(window, document);
    await flush();

    const body = JSON.parse(calls[0].options.body!);
    expect(body.language).toBe('en');
  });

  it('restores the translated button label after a completed request', async () => {
    const { window, document } = await boot(undefined, { lang: 'fr' });

    submit(window, document);
    await flush();

    expect(document.getElementById('submit-btn-label')!.textContent).toBe(fr['ui.submit']);
    expect(document.getElementById('submit-btn')!.hasAttribute('aria-busy')).toBe(false);
  });

  it('keeps the hardcoded English when the dictionaries are missing', async () => {
    const { document } = await boot(undefined, { withoutI18N: true });

    expect(document.querySelector('h1')!.textContent).toBe('Professional Document Builder');
    expect(document.getElementById('submit-btn-label')!.textContent).toBe('Generate PDF');
  });
});

describe('i18n & copy (chunk R7)', () => {
  const clickLang = (window: JSDOM['window'], document: Document, lang: string) => {
    const btn = document.querySelector(`.lang-btn[data-lang="${lang}"]`) as HTMLElement;
    btn.dispatchEvent(new window.Event('click', { bubbles: true }));
    return btn;
  };

  /** A successful generate that also reports the server's invoice number. */
  const withInvoiceNumber = () => () =>
    Promise.resolve({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob(['%PDF-1.3'], { type: 'application/pdf' })),
      json: () => Promise.resolve({}),
      headers: {
        get: (name: string) => (name === 'X-Invoice-Number' ? 'INV-2026-0042' : null),
      },
    });

  it('keeps the item counter in sync with the rows and the language', async () => {
    const { window, document } = await boot();
    const counter = document.getElementById('items-count')!;
    const label = (dict: typeof en, count: number) =>
      dict['ui.itemsOf'].replace('{count}', String(count));

    expect(counter.textContent).toBe(label(en, 1));

    (document.getElementById('add-item-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(counter.textContent).toBe(label(en, 2));

    clickLang(window, document, 'fr');
    expect(counter.textContent).toBe(label(fr, 2));

    clickLang(window, document, 'en');
    expect(counter.textContent).toBe(label(en, 2));

    (document.querySelector('.item-row .remove-item-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(counter.textContent).toBe(label(en, 1));
  });

  it('numbers the stacked mobile item blocks and renumbers after removal', async () => {
    const { window, document } = await boot();
    const rowLabel = (n: number) =>
      document.querySelectorAll('.item-row')[n]!.getAttribute('data-item-label');

    expect(rowLabel(0)).toBe(en['ui.itemN'].replace('{n}', '1'));

    (document.getElementById('add-item-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(rowLabel(1)).toBe(en['ui.itemN'].replace('{n}', '2'));

    clickLang(window, document, 'fr');
    expect(rowLabel(1)).toBe(fr['ui.itemN'].replace('{n}', '2'));

    // Removing the first block renumbers the survivor.
    (document.querySelector('.item-row .remove-item-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(document.querySelectorAll('.item-row')).toHaveLength(1);
    expect(rowLabel(0)).toBe(fr['ui.itemN'].replace('{n}', '1'));
  });

  it('re-translates the success panel and the sheet after generating', async () => {
    const { window, document } = await boot(withInvoiceNumber());
    submit(window, document);
    await flush();

    const panel = document.getElementById('success-panel')!;
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(panel.querySelector('.success-title')!.textContent).toBe(en['ui.successTitle']);
    expect(document.getElementById('success-number')!.textContent).toBe(
      `${en['pdf.invoice.idLabel']} INV-2026-0042`,
    );

    clickLang(window, document, 'fr');

    expect(panel.querySelector('.success-title')!.textContent).toBe(fr['ui.successTitle']);
    expect(panel.querySelector('.success-body')!.textContent).toBe(fr['ui.successBody']);
    expect(document.getElementById('open-preview-btn')!.textContent).toBe(fr['ui.openPreview']);
    expect(document.getElementById('new-document-btn')!.textContent).toBe(fr['ui.newDocument']);
    expect(document.getElementById('success-number')!.textContent).toBe(
      `${fr['pdf.invoice.idLabel']} INV-2026-0042`,
    );
    // Dynamic content follows too: the sheet, the counter and the CTA.
    expect(document.getElementById('sheet')!.textContent).toContain(fr['pdf.billTo']);
    expect(document.getElementById('items-count')!.textContent).toBe(
      fr['ui.itemsOf'].replace('{count}', '1'),
    );
    expect(document.getElementById('submit-btn-label')!.textContent).toBe(fr['ui.submit']);
  });

  it('keeps the invoice number pinned to the document type that was generated', async () => {
    const { window, document } = await boot(withInvoiceNumber());
    const type = document.getElementById('invoice-type') as HTMLSelectElement;
    type.value = 'QUOTE';

    submit(window, document);
    await flush();
    expect(document.getElementById('success-number')!.textContent).toBe(
      `${en['pdf.quote.idLabel']} INV-2026-0042`,
    );

    // Change the form to a receipt after generating (the PDF is still a quote).
    const receipt = document.querySelector(
      'input[name="doc-type"][value="RECEIPT"]',
    ) as HTMLInputElement;
    receipt.checked = true;
    receipt.dispatchEvent(new window.Event('change', { bubbles: true }));

    clickLang(window, document, 'fr');
    expect(document.getElementById('success-number')!.textContent).toBe(
      `${fr['pdf.quote.idLabel']} INV-2026-0042`,
    );
  });

  it('leaves focus on the language toggle while the success panel is open', async () => {
    const { window, document } = await boot(withInvoiceNumber());
    submit(window, document);
    await flush();
    expect(document.activeElement).toBe(document.getElementById('success-panel'));

    const frBtn = document.querySelector('.lang-btn[data-lang="fr"]') as HTMLElement;
    frBtn.focus();
    frBtn.dispatchEvent(new window.Event('click', { bubbles: true }));

    expect(document.activeElement).toBe(frBtn);
  });
});

describe('theme toggle (dark mode)', () => {
  const toggle = (window: JSDOM['window'], document: Document) => {
    document
      .getElementById('theme-toggle')!
      .dispatchEvent(new window.Event('click', { bubbles: true }));
  };

  it('boots in light mode when nothing is stored', async () => {
    const { document } = await boot();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.getElementById('theme-toggle')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('applies a stored dark theme before the form script runs', async () => {
    const { document } = await boot(undefined, { theme: 'dark' });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.getElementById('theme-toggle')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('flips the theme, persists it, and flips back', async () => {
    const { window, document } = await boot();

    toggle(window, document);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('pdfinvoice-theme')).toBe('dark');
    expect(document.getElementById('theme-toggle')!.getAttribute('aria-pressed')).toBe('true');

    toggle(window, document);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(window.localStorage.getItem('pdfinvoice-theme')).toBe('light');
    expect(document.getElementById('theme-toggle')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('honours the stored theme across a reload', async () => {
    const { window: first, document: docA } = await boot();
    toggle(first, docA);

    const { document: docB } = await boot(undefined, { theme: 'dark' });
    expect(docB.documentElement.classList.contains('dark')).toBe(true);
  });
});

describe('live A4 sheet (chunk R5)', () => {
  /** Set the first item row's description/qty/price and fire input events. */
  const fillItem = (
    window: JSDOM['window'],
    document: Document,
    { description, quantity, price }: { description?: string; quantity?: string; price?: string },
  ) => {
    const row = document.querySelector('.item-row') as HTMLElement;
    if (description !== undefined) {
      const desc = row.querySelector('.description') as HTMLInputElement;
      desc.value = description;
      desc.dispatchEvent(new window.Event('input', { bubbles: true }));
    }
    if (quantity !== undefined) {
      (row.querySelector('.quantity') as HTMLInputElement).value = quantity;
    }
    if (price !== undefined) {
      (row.querySelector('.price') as HTMLInputElement).value = price;
    }
    if (quantity !== undefined || price !== undefined) {
      (row.querySelector('.price') as HTMLInputElement).dispatchEvent(
        new window.Event('input', { bubbles: true }),
      );
    }
  };

  const sheetText = (document: Document) => document.getElementById('sheet')!.textContent || '';

  it('renders the company, client and document title into the sheet', async () => {
    const { window, document } = await boot();
    const company = document.getElementById('company-name') as HTMLInputElement;
    company.value = 'Acme Corp';
    company.dispatchEvent(new window.Event('input', { bubbles: true }));
    const client = document.getElementById('client-name') as HTMLInputElement;
    client.value = 'Globex';
    client.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(sheetText(document)).toContain('Acme Corp');
    expect(sheetText(document)).toContain('Globex');
    expect(sheetText(document)).toContain(en['pdf.invoice.title']);
  });

  it('tracks item, tax and total changes live', async () => {
    const { window, document } = await boot();
    fillItem(window, document, { description: 'Consulting', quantity: '2', price: '10' });

    const tax = document.getElementById('tax-rate') as HTMLInputElement;
    tax.value = '10';
    tax.dispatchEvent(new window.Event('input', { bubbles: true }));

    // Subtotal 20, tax 2, total 22 — formatted like the form's totals.
    expect(sheetText(document)).toContain('Consulting');
    expect(sheetText(document)).toContain(
      new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(20),
    );
    expect(sheetText(document)).toContain(
      new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(22),
    );
  });

  it('re-formats the sheet when the currency changes (USD -> JPY)', async () => {
    const { window, document } = await boot();
    fillItem(window, document, { quantity: '2', price: '10' });

    const currency = document.getElementById('currency') as HTMLSelectElement;
    currency.value = 'JPY';
    currency.dispatchEvent(new window.Event('change', { bubbles: true }));

    const yen = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(20);
    expect(sheetText(document)).toContain(yen);
    expect(sheetText(document)).not.toContain('$20.00');
  });

  it('follows the document type (title and date label)', async () => {
    const { window, document } = await boot();
    const quote = document.querySelector(
      'input[name="doc-type"][value="QUOTE"]',
    ) as HTMLInputElement;
    quote.checked = true;
    quote.dispatchEvent(new window.Event('change', { bubbles: true }));

    expect(sheetText(document)).toContain(en['pdf.quote.title']);
    expect(sheetText(document)).toContain(en['pdf.quote.idLabel']);
    expect(sheetText(document)).not.toContain(en['pdf.invoice.title']);
  });

  it('shows payment details and notes only when they are filled in', async () => {
    const { window, document } = await boot();
    expect(sheetText(document)).not.toContain(en['ui.notesHeading']);

    const notes = document.getElementById('notes') as HTMLTextAreaElement;
    notes.value = 'Pay within 30 days';
    notes.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(sheetText(document)).toContain(en['ui.notesHeading']);
    expect(sheetText(document)).toContain('Pay within 30 days');
  });

  it('re-translates the sheet when the language changes', async () => {
    const { window, document } = await boot();
    expect(sheetText(document)).toContain(en['pdf.billTo']);

    (document.querySelector('.lang-btn[data-lang="fr"]') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(sheetText(document)).toContain(fr['pdf.billTo']);
    expect(sheetText(document)).toContain(fr['pdf.invoice.title']);
  });

  it('renders the same document into the preview dialog', async () => {
    const { window, document } = await boot();
    fillItem(window, document, { description: 'Design work', quantity: '1', price: '50' });

    const modal = document.getElementById('sheet-modal')!;
    expect(modal.textContent).toContain('Design work');
    expect(modal.textContent).toContain(en['pdf.invoice.title']);
  });

  it('opens and closes the preview dialog with Esc, moving focus', async () => {
    const { window, document } = await boot();
    const modal = document.getElementById('preview-modal')!;
    const previewBtn = document.getElementById('preview-btn')!;

    previewBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    expect(modal.classList.contains('hidden')).toBe(false);
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(document.getElementById('preview-close'));

    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(modal.classList.contains('hidden')).toBe(true);
    // Focus returns to the trigger.
    expect(document.activeElement).toBe(previewBtn);
  });

  it('keeps Tab inside the preview dialog while it is open', async () => {
    const { window, document } = await boot();
    const modal = document.getElementById('preview-modal')!;
    const close = document.getElementById('preview-close')!;

    (document.getElementById('preview-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(document.activeElement).toBe(close);

    const forward = new window.KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(forward);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);

    const backward = new window.KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(backward);
    expect(backward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(close);
    expect(modal.classList.contains('hidden')).toBe(false);
  });

  it('opens the preview from the desktop "Open full preview" control too', async () => {
    const { window, document } = await boot();
    const modal = document.getElementById('preview-modal')!;
    const open = document.getElementById('preview-open')!;

    open.dispatchEvent(new window.Event('click', { bubbles: true }));
    expect(modal.classList.contains('hidden')).toBe(false);

    (document.getElementById('preview-close') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(modal.classList.contains('hidden')).toBe(true);
  });

  it('closes the preview dialog when the backdrop is clicked', async () => {
    const { window, document } = await boot();
    const modal = document.getElementById('preview-modal')!;

    (document.getElementById('preview-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(modal.classList.contains('hidden')).toBe(false);

    modal.dispatchEvent(new window.Event('click', { bubbles: true }));
    expect(modal.classList.contains('hidden')).toBe(true);
  });

  it('keeps the sheet paper-white in both themes (CSS)', async () => {
    const css = fs.readFileSync(path.resolve(process.cwd(), 'src/styles/app.css'), 'utf8');
    // A literal white background for .sheet, regardless of --color-sheet.
    expect(css).toMatch(/\.sheet\s*\{[^}]*background-color:\s*#fff/i);
    // A4 page-break hairlines every 1123px.
    expect(css).toContain('1123px');
    // The pane is sticky on wide screens and the sheet box carries the shadow.
    expect(css).toMatch(/\.sheet-pane\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/\.layout-split\s*\{[^}]*grid-template-columns/);
  });

  it('guards ResizeObserver so jsdom never crashes', async () => {
    // jsdom has no ResizeObserver; booting must still succeed and render.
    expect(typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver).toBe('undefined');
    const { document } = await boot();
    expect(document.getElementById('sheet')!.innerHTML).not.toBe('');
  });
});

describe('validation errors mapped to fields (chunk R6)', () => {
  type ServerError = { path: string; msg: string };
  const errorResponse = (errors: ServerError[]) => () =>
    Promise.resolve({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ errors }),
    });

  it('shows the server message under the field, marks it invalid and focuses it', async () => {
    const { window, document } = await boot(
      errorResponse([{ path: 'company.name', msg: 'Company name is required' }]),
    );

    submit(window, document);
    await flush();

    const field = document.getElementById('company-name') as HTMLInputElement;
    expect(field.getAttribute('aria-invalid')).toBe('true');
    const describedBy = field.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const message = document.getElementById(describedBy!)!;
    expect(message.textContent).toBe('Company name is required');
    expect(message.className).toContain('field-error');
    expect(document.activeElement).toBe(field);

    // The toast remains the summary.
    expect(document.getElementById('notification-toast-error')!.textContent).toContain(
      'Company name is required',
    );
  });

  it('maps item errors to the offending row and index', async () => {
    const { window, document } = await boot(
      errorResponse([{ path: 'items[0].price', msg: 'Price must be a number' }]),
    );
    (document.getElementById('add-item-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );

    submit(window, document);
    await flush();

    const rows = document.querySelectorAll('.item-row');
    expect(rows[0].querySelector('.price')!.getAttribute('aria-invalid')).toBe('true');
    expect(rows[1].querySelector('.price')!.getAttribute('aria-invalid')).toBeNull();
    expect(rows[0].textContent).toContain('Price must be a number');
  });

  it('focuses the first invalid field in DOM order, not server order', async () => {
    const { window, document } = await boot(
      errorResponse([
        { path: 'client.email', msg: 'Client email is invalid' },
        { path: 'company.name', msg: 'Company name is required' },
      ]),
    );

    submit(window, document);
    await flush();

    expect(document.activeElement).toBe(document.getElementById('company-name'));
    expect(document.getElementById('client-email')!.getAttribute('aria-invalid')).toBe('true');
  });

  it('maps taxRate and currency errors to their controls', async () => {
    const { window, document } = await boot(
      errorResponse([
        { path: 'taxRate', msg: 'Tax rate must be a number' },
        { path: 'currency', msg: 'Currency is invalid' },
      ]),
    );

    submit(window, document);
    await flush();

    for (const id of ['tax-rate', 'currency']) {
      const field = document.getElementById(id)!;
      expect(field.getAttribute('aria-invalid')).toBe('true');
      const msg = document.getElementById(field.getAttribute('aria-describedby')!)!;
      expect(msg.className).toContain('field-error');
    }
  });

  it('clears a field error as soon as the user edits the field', async () => {
    const { window, document } = await boot(
      errorResponse([{ path: 'company.name', msg: 'Required' }]),
    );

    submit(window, document);
    await flush();
    const field = document.getElementById('company-name') as HTMLInputElement;
    expect(field.getAttribute('aria-invalid')).toBe('true');

    field.value = 'Acme';
    field.dispatchEvent(new window.Event('input', { bubbles: true }));

    expect(field.getAttribute('aria-invalid')).toBeNull();
    expect(field.getAttribute('aria-describedby')).toBeNull();
    expect(document.querySelector('.field-error')).toBeNull();
  });

  it('replaces previous errors on the next submit and hides the success panel', async () => {
    let shouldFail = true;
    const { window, document } = await boot(() =>
      shouldFail
        ? Promise.resolve({
            ok: false,
            status: 400,
            json: () => Promise.resolve({ errors: [{ path: 'company.name', msg: 'Required' }] }),
          })
        : Promise.resolve({
            ok: true,
            status: 200,
            blob: () => Promise.resolve({}),
            json: () => Promise.resolve({}),
          }),
    );

    submit(window, document);
    await flush();
    expect(document.querySelectorAll('.field-error').length).toBe(1);

    shouldFail = false;
    submit(window, document);
    await flush();

    expect(document.querySelectorAll('.field-error')).toHaveLength(0);
    expect(document.getElementById('company-name')!.getAttribute('aria-invalid')).toBeNull();
    expect(document.getElementById('success-panel')!.classList.contains('hidden')).toBe(false);
  });
});

describe('success panel (chunk R6)', () => {
  it('appears after a generate and keeps the form data', async () => {
    const { window, document } = await boot();
    const name = document.getElementById('company-name') as HTMLInputElement;
    name.value = 'Acme';
    name.dispatchEvent(new window.Event('input', { bubbles: true }));

    submit(window, document);
    await flush();

    const panel = document.getElementById('success-panel')!;
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(document.activeElement).toBe(panel);
    expect(name.value).toBe('Acme'); // locked decision #3
  });

  it('New document resets the form, dismisses the panel and releases the blob', async () => {
    const { window, document, anchorClicks } = await boot();
    const expectedDate = (document.getElementById('invoice-date') as HTMLInputElement).value;

    // The "From" section is a persisted profile: type into each field so the
    // input listener saves it, then make sure New document does not wipe it.
    const company = {
      'company-name': 'Acme',
      'company-address': '1 Main St',
      'company-city': 'NY',
      'company-phone': '123',
      'company-email': 'a@b.com',
    };
    Object.entries(company).forEach(([id, value]) => {
      const field = document.getElementById(id) as HTMLInputElement;
      field.value = value;
      field.dispatchEvent(new window.Event('input', { bubbles: true }));
    });

    submit(window, document);
    await flush();

    expect(anchorClicks()).toBe(0); // opened in a new tab
    const panel = document.getElementById('success-panel')!;
    expect(panel.classList.contains('hidden')).toBe(false);

    (document.getElementById('new-document-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );

    expect(panel.classList.contains('hidden')).toBe(true);
    Object.entries(company).forEach(([id, value]) => {
      expect((document.getElementById(id) as HTMLInputElement).value).toBe(value);
    });
    expect((document.getElementById('client-name') as HTMLInputElement).value).toBe('');
    expect((document.getElementById('invoice-date') as HTMLInputElement).value).toBe(expectedDate);
    expect((document.getElementById('due-date') as HTMLInputElement).value).toBe('');
    expect((document.getElementById('tax-rate') as HTMLInputElement).value).toBe('0');
    expect((document.getElementById('currency') as HTMLSelectElement).value).toBe('MAD');
    expect(document.querySelectorAll('.item-row').length).toBe(1);
    expect((document.querySelector('.item-row .description') as HTMLInputElement).value).toBe('');
    expect((document.querySelector('.item-row .quantity') as HTMLInputElement).value).toBe('1');
    expect((document.querySelector('.item-row .price') as HTMLInputElement).value).toBe('0.00');

    // The blob is gone: Open preview is inert after the reset.
    const before = anchorClicks();
    (document.getElementById('open-preview-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(anchorClicks()).toBe(before);
  });

  it('Open preview re-opens the stored blob without another POST', async () => {
    const { window, document, calls, openCalls } = await boot();
    submit(window, document);
    await flush();
    expect(openCalls.length).toBe(1); // the automatic post-generate open

    (document.getElementById('open-preview-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );

    expect(calls.length).toBe(1);
    expect(openCalls.length).toBe(2);
  });

  it('a second generate with an edit is exactly one more POST', async () => {
    const { window, document, calls } = await boot();
    submit(window, document);
    await flush();
    expect(calls.length).toBe(1);

    const name = document.getElementById('company-name') as HTMLInputElement;
    name.value = 'Edited';
    name.dispatchEvent(new window.Event('input', { bubbles: true }));

    submit(window, document);
    await flush();

    expect(calls.length).toBe(2);
    expect(JSON.parse(calls[1].options.body as string).company.name).toBe('Edited');
  });

  it('shows the X-Invoice-Number header when the server sends one', async () => {
    const { window, document } = await boot(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['%PDF-1.3'], { type: 'application/pdf' })),
        json: () => Promise.resolve({}),
        headers: {
          get: (name: string) => (name === 'X-Invoice-Number' ? 'INV-2026-0007' : null),
        },
      }),
    );

    submit(window, document);
    await flush();

    const number = document.getElementById('success-number')!;
    expect(number.classList.contains('hidden')).toBe(false);
    expect(number.textContent).toContain(en['pdf.invoice.idLabel']);
    expect(number.textContent).toContain('INV-2026-0007');
  });

  it('New document resets the form, dismisses the panel and releases the blob', async () => {
    const { window, document, anchorClicks } = await boot();
    const expectedDate = (document.getElementById('invoice-date') as HTMLInputElement).value;

    const name = document.getElementById('company-name') as HTMLInputElement;
    name.value = 'Acme';
    name.dispatchEvent(new window.Event('input', { bubbles: true }));
    (document.getElementById('add-item-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );

    submit(window, document);
    await flush();
    expect(document.querySelectorAll('.item-row').length).toBe(2);

    (document.getElementById('new-document-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );

    expect(name.value).toBe('Acme'); // saved company profile survives the reset
    expect(JSON.parse(window.localStorage.getItem('pdfinvoice-company')!)['company-name']).toBe(
      'Acme',
    );
    expect(document.querySelectorAll('.item-row').length).toBe(1);
    expect((document.getElementById('invoice-type') as HTMLSelectElement).value).toBe(
      'SERVICE INVOICE',
    );
    expect((document.getElementById('invoice-date') as HTMLInputElement).value).toBe(expectedDate);
    expect((document.getElementById('tax-rate') as HTMLInputElement).value).toBe('0');
    expect(document.getElementById('success-panel')!.classList.contains('hidden')).toBe(true);

    // The blob is gone: Open preview is inert after the reset.
    const before = anchorClicks();
    (document.getElementById('open-preview-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(anchorClicks()).toBe(before);
  });
});

describe('item limit (chunk 1.1)', () => {
  it('adds at most 15 rows, then disables Add Item and shows a hint', async () => {
    const { window, document } = await boot();
    const addBtn = document.getElementById('add-item-btn') as HTMLButtonElement;
    const hint = document.getElementById('items-limit-hint')!;

    for (let i = 0; i < 20; i += 1) {
      addBtn.dispatchEvent(new window.Event('click', { bubbles: true }));
    }

    expect(document.querySelectorAll('.item-row').length).toBe(15);
    expect(addBtn.disabled).toBe(true);
    expect(hint.className).not.toContain('hidden');

    // removing a row re-enables the button and hides the hint
    (document.querySelector('.remove-item-btn') as HTMLElement).dispatchEvent(
      new window.Event('click', { bubbles: true }),
    );
    expect(document.querySelectorAll('.item-row').length).toBe(14);
    expect(addBtn.disabled).toBe(false);
    expect(hint.className).toContain('hidden');
  });

  it('uses type="button" on add/remove controls so they never submit the form', async () => {
    const { document } = await boot();
    expect((document.getElementById('add-item-btn') as HTMLButtonElement).type).toBe('button');
    expect((document.querySelector('.remove-item-btn') as HTMLButtonElement).type).toBe('button');
    expect((document.getElementById('submit-btn') as HTMLButtonElement).type).toBe('submit');
  });
});
