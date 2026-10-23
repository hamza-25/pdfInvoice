/**
 * Theme boot — runs blocking in <head> so the correct theme is applied before
 * first paint (no flash of the wrong theme). Keep this file tiny and
 * dependency-free; it must never throw.
 */
(function () {
  try {
    var storedTheme = null;
    try {
      storedTheme = localStorage.getItem('pdfinvoice-theme');
    } catch (e) {
      /* storage unavailable — fall through to the OS preference */
    }

    var prefersDark = false;
    try {
      prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      /* matchMedia unavailable — assume light */
    }

    var useDark = storedTheme ? storedTheme === 'dark' : prefersDark;
    if (useDark) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {
    /* never let theme boot break the page */
  }
})();
