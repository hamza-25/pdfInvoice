import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'public/css/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Browser scripts served from /public run outside the TS build.
    files: ['public/js/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: {
      // Empty catch blocks are deliberate resilience guards (storage/quota/
      // matchMedia may throw); the binding is unused on purpose.
      '@typescript-eslint/no-unused-vars': ['error', { caughtErrors: 'none' }],
    },
  },
  prettier,
);
