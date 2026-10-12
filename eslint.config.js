// Lint rules that fence the architecture (CLAUDE.md "Architecture guardrails").
// scripts/lint-fences.test.mjs proves each fence flags the thing it fences.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Only src/platform/ may touch browser storage, the network, the service worker, reloads,
// fullscreen, external links or version.json, so the Steam build stays a packaging job (D3, D15).
const PLATFORM = 'Only src/platform/ does this (CLAUDE.md "Architecture guardrails").';
const PLATFORM_GLOBALS = ['localStorage', 'sessionStorage', 'indexedDB', 'caches', 'fetch'].map((name) => ({
  name,
  message: PLATFORM,
}));
const PLATFORM_SYNTAX = [
  // By property name, whatever object it is reached through (window.location.reload, globalThis.localStorage …).
  {
    selector: 'MemberExpression[property.name=/^(localStorage|sessionStorage|indexedDB|caches|serviceWorker|reload|requestFullscreen|exitFullscreen|fetch)$/]',
    message: PLATFORM,
  },
  { selector: "MemberExpression[object.name='navigator'][property.name='storage']", message: PLATFORM },
  { selector: "MemberExpression[object.name=/^(window|globalThis|self)$/][property.name='open']", message: PLATFORM },
  { selector: 'Literal[value=/version\\.json/]', message: PLATFORM },
  { selector: "JSXAttribute[name.name='href'] > Literal[value=/^https?:/]", message: 'External links go through src/platform (externalLink).' },
];
const SIM_SYNTAX = [
  { selector: "NewExpression[callee.name='Date']", message: 'No Date in src/sim: time comes from the sim clock.' },
  { selector: "CallExpression[callee.name='Date']", message: 'No Date in src/sim: time comes from the sim clock.' },
  { selector: "MemberExpression[object.name='Date']", message: 'No Date in src/sim: time comes from the sim clock.' },
  { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'No Math.random in src/sim: use the seeded RNG.' },
];

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'public/**', 'test-results/**', 'playwright-report/**', '.cache/**', 'docs/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['**/*.{js,mjs}', 'vite.config.ts', 'playwright.config.ts', 'e2e/**'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Everything in src/ except the platform module.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/platform/**'],
    rules: {
      'no-restricted-globals': ['error', ...PLATFORM_GLOBALS],
      'no-restricted-syntax': ['error', ...PLATFORM_SYNTAX],
    },
  },
  {
    // UI and rendering read the sim only through its rules and types (GD-05).
    files: ['src/ui/**/*.{ts,tsx}', 'src/render/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // sim itself or anything under it, except sim/rules and sim/types (a gitignore-style
              // group cannot re-include a child once "**/sim" excludes the directory).
              regex: '(^|/)sim(/(?!(rules|types)(/|$)).*)?$',
              message: 'ui/ and render/ import only sim/rules and sim/types.',
            },
          ],
        },
      ],
    },
  },
  {
    // Sim truth is deterministic: no DOM, React, MapLibre, clock or randomness, and none of the
    // platform's powers either (AR-04, AR-06, AR-09). Flat config replaces a rule per file, so the
    // platform lists are repeated here.
    files: ['src/sim/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: ['react', 'react-dom', 'maplibre-gl'], patterns: ['**/ui', '**/ui/**', '**/render', '**/render/**', '**/platform', '**/platform/**'] },
      ],
      'no-restricted-globals': [
        'error',
        ...PLATFORM_GLOBALS,
        ...['window', 'document', 'navigator', 'performance', 'location'].map((name) => ({ name, message: 'src/sim has no DOM.' })),
      ],
      'no-restricted-syntax': ['error', ...PLATFORM_SYNTAX, ...SIM_SYNTAX],
    },
  },
);
