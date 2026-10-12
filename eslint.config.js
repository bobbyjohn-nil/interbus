// Lint rules that fence the architecture (CLAUDE.md "Architecture guardrails").
// scripts/lint-fences.test.mjs proves each fence flags the thing it fences.
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Only src/platform/ may touch browser storage, the network, the service worker, reloads,
// fullscreen, external links or version.json, so the Steam build stays a packaging job (D3, D15).
const PLATFORM = 'Only src/platform/ does this (CLAUDE.md "Architecture guardrails").';
const PLATFORM_GLOBALS = ['localStorage', 'sessionStorage', 'indexedDB', 'caches', 'fetch', 'location'].map((name) => ({
  name,
  message: PLATFORM,
}));
// Destructuring (`const { localStorage } = window`) reaches the same powers without a member access.
const PLATFORM_PROPERTIES = ['window', 'globalThis', 'self'].flatMap((object) =>
  ['localStorage', 'sessionStorage', 'indexedDB', 'caches', 'fetch', 'open', 'location'].map((property) => ({
    object,
    property,
    message: PLATFORM,
  })),
);
const PLATFORM_SYNTAX = [
  // By property name, whatever object it is reached through (window.location.reload, globalThis.localStorage …).
  {
    selector: 'MemberExpression[property.name=/^(localStorage|sessionStorage|indexedDB|caches|serviceWorker|reload|requestFullscreen|exitFullscreen|fetch|location)$/]',
    message: PLATFORM,
  },
  { selector: "MemberExpression[object.name='navigator'][property.name='storage']", message: PLATFORM },
  { selector: "MemberExpression[object.property.name='navigator'][property.name='storage']", message: PLATFORM },
  { selector: "MemberExpression[object.name=/^(window|globalThis|self)$/][property.name='open']", message: PLATFORM },
  { selector: "CallExpression[callee.name='open']", message: PLATFORM },
  { selector: 'Literal[value=/version\\.json/]', message: PLATFORM },
  // Any href but an in-page #link: external links spread platform's externalLink() instead.
  {
    selector: "JSXAttribute[name.name='href']:not([value.type='Literal'][value.value=/^#/])",
    message: 'External links go through src/platform (externalLink).',
  },
];
const SIM_IMPORTS = 'ui/ and render/ import only sim/rules and sim/types.';
// The ui/render → sim fence for import() as well as import (a gitignore-style group cannot re-include
// a child once "**/sim" excludes the directory, hence a regex).
const SIM_PATH = '(^|/)sim(/(?!(rules|types)(/|$)).*)?$';
const SIM_SYNTAX = [
  { selector: "NewExpression[callee.name='Date']", message: 'No Date in src/sim: time comes from the sim clock.' },
  { selector: "CallExpression[callee.name='Date']", message: 'No Date in src/sim: time comes from the sim clock.' },
  { selector: "MemberExpression[object.name='Date']", message: 'No Date in src/sim: time comes from the sim clock.' },
  { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'No Math.random in src/sim: use the seeded RNG.' },
  { selector: "MemberExpression[property.name='crypto']", message: 'No crypto in src/sim: use the seeded RNG.' },
  {
    selector: "ImportExpression[source.value=/^(react|react-dom|maplibre-gl)(\\/|$)|(^|\\/)(ui|render|platform)(\\/|$)/]",
    message: 'src/sim imports no React, MapLibre, ui, render or platform code.',
  },
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
      'no-restricted-properties': ['error', ...PLATFORM_PROPERTIES],
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
          patterns: [{ regex: SIM_PATH, message: SIM_IMPORTS }],
        },
      ],
      // Flat config replaces a rule per file, so the platform fences are repeated with the import() one.
      'no-restricted-syntax': [
        'error',
        ...PLATFORM_SYNTAX,
        { selector: `ImportExpression[source.value=/${SIM_PATH.replaceAll('/', '\\/')}/]`, message: SIM_IMPORTS },
      ],
    },
  },
  {
    // Sim truth is deterministic: no DOM, React, MapLibre, clock or randomness, and none of the
    // platform's powers either (AR-04, AR-06, AR-09). Flat config replaces a rule per file, so the
    // platform lists are repeated here.
    files: ['src/sim/**/*.{ts,tsx}'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['react', 'react-dom', 'maplibre-gl'],
          patterns: ['react/**', 'react-dom/**', 'maplibre-gl/**', '**/ui', '**/ui/**', '**/render', '**/render/**', '**/platform', '**/platform/**'],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...PLATFORM_GLOBALS,
        ...['window', 'document', 'navigator', 'performance'].map((name) => ({ name, message: 'src/sim has no DOM.' })),
        { name: 'crypto', message: 'No crypto in src/sim: use the seeded RNG.' },
      ],
      'no-restricted-syntax': ['error', ...PLATFORM_SYNTAX, ...SIM_SYNTAX],
    },
  },
);
