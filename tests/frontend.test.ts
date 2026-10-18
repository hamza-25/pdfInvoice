// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync(path.resolve(process.cwd(), 'views/index.ejs'), 'utf8');

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
}

/**
 * Boot the form in jsdom with a mocked fetch (and mocked download), and resolve
 * once the inline script's DOMContentLoaded handler has run.
 */
function boot(fetchImpl?: MockHandler, options: BootOptions = {}): Promise<Harness> {
  const calls: FetchCall[] = [];
  const openCalls: string[] = [];
  const stats = { anchorClicks: 0 };
  return new Promise((resolve) => {
    const dom = new JSDOM(html, {
      runScripts: 'dangerously',
      url: 'http://localhost/',
      beforeParse(window) {
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

describe('currency switcher (chunk 0.6)', () => {
  it('re-renders the symbol on change without mangling values', async () => {
    const { window, document } = await boot();
    setItem(window, document, '2', '10', '0');
    const currency = document.getElementById('currency') as HTMLSelectElement;

    currency.value = 'dh';
    currency.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(document.getElementById('subtotal')!.textContent).toBe('dh20.00');
    expect(document.getElementById('total-amount')!.textContent).toBe('dh20.00');

    currency.value = '€';
    currency.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(document.getElementById('subtotal')!.textContent).toBe('€20.00');

    currency.value = '$';
    currency.dispatchEvent(new window.Event('change', { bubbles: true }));
    expect(document.getElementById('subtotal')!.textContent).toBe('$20.00');
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
    expect(btn.textContent).toBe('Submit for Processing');
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
