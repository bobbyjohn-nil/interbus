// Lint rules that fence the architecture (CLAUDE.md "Architecture guardrails").
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

// Only src/platform/ may touch browser storage, the service worker, reloads, fullscreen or
// version.json, so the Steam build stays a packaging job (D3, D15).
const PLATFORM_ONLY_GLOBALS = [
  { name: 'localStorage', message: 'Only src/platform/ touches browser storage.' },
  { name: 'sessionStorage', message: 'Only src/platform/ touches browser storage.' },
  { name: 'indexedDB', message: 'Only src/platform/ touches browser storage.' },
  { name: 'caches', message: 'The web preview keeps no Cache Storage (D12).' },
];
const PLATFORM_ONLY_PROPERTIES = [
  { object: 'navigator', property: 'serviceWorker', message: 'The web preview registers no service worker (D12).' },
  { object: 'navigator', property: 'storage', message: 'Only src/platform/ touches browser storage.' },
  { object: 'location', property: 'reload', message: 'Only src/platform/ reloads the page.' },
  { object: 'window', property: 'localStorage', message: 'Only src/platform/ touches browser storage.' },
  { object: 'window', property: 'open', message: 'External links go through the src/platform/ allowlist.' },
  { object: 'document', property: 'requestFullscreen', message: 'Only src/platform/ handles fullscreen.' },
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
      'no-restricted-globals': ['error', ...PLATFORM_ONLY_GLOBALS],
      'no-restricted-properties': ['error', ...PLATFORM_ONLY_PROPERTIES],
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
              group: ['**/sim/**', '!**/sim/rules', '!**/sim/rules/**', '!**/sim/types', '!**/sim/types/**'],
              message: 'ui/ and render/ import only sim/rules and sim/types.',
            },
          ],
        },
      ],
    },
  },
  {
    // Sim truth is deterministic: no DOM, React, MapLibre, clock or randomness (AR-04, AR-06, AR-09).
    files: ['src/sim/**/*.ts'],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-imports': [
        'error',
        { paths: ['react', 'react-dom', 'maplibre-gl'], patterns: ['**/ui/**', '**/render/**', '**/platform/**'] },
      ],
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'performance'],
      'no-restricted-syntax': [
        'error',
        { selector: "NewExpression[callee.name='Date']", message: 'No Date in src/sim: time comes from the sim clock.' },
        { selector: "MemberExpression[object.name='Date']", message: 'No Date in src/sim: time comes from the sim clock.' },
        { selector: "MemberExpression[object.name='Math'][property.name='random']", message: 'No Math.random in src/sim: use the seeded RNG.' },
      ],
    },
  },
);
