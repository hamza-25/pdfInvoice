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
    expect(document.getElementById('subtotal')!.textContent).toBe('$0.00');
    expect(document.getElementById('total-amount')!.textContent).toBe('$0.00');
  });
});

describe('totals calculation', () => {
  it('computes subtotal and total including tax', async () => {
    const { window, document } = await boot();
    setItem(window, document, '2', '10', '10');
    expect(document.getElementById('subtotal')!.textContent).toBe('$20.00');
    expect(document.getElementById('total-amount')!.textContent).toBe('$22.00');
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

  it('shows the success toast only after the response and keeps the select valid', async () => {
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

    // B11 fix: the <select> keeps a valid option (was set to '', breaking the next submit)
    expect(type.value).not.toBe('');
    expect(type.selectedIndex).toBe(0);

    const btn = document.getElementById('submit-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(document.getElementById('submit-btn-label')!.textContent).toBe('Submit for Processing');
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
    expect(document.getElementById('submit-btn-label')!.textContent).toBe('Générer le document');
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

    expect(document.getElementById('submit-btn-label')!.textContent).toBe('Générer le document');
    expect(document.getElementById('submit-btn')!.hasAttribute('aria-busy')).toBe(false);
  });

  it('keeps the hardcoded English when the dictionaries are missing', async () => {
    const { document } = await boot(undefined, { withoutI18N: true });

    expect(document.querySelector('h1')!.textContent).toBe('Professional Document Builder');
    expect(document.getElementById('submit-btn-label')!.textContent).toBe('Submit for Processing');
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
