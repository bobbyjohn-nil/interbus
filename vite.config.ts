/// <reference types="vitest/config" />
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// The changelog tool is the one source for version numbers (PR-15, CLAUDE.md "Versioning").
import { versionsIn } from './scripts/changelog.mjs';

/** What this build is: the commit it came from and the newest version the owner has shipped. */
function buildInfo(): { sha: string; version: string; run: string } {
  let sha = process.env.BUILD_SHA ?? process.env.GITHUB_SHA ?? '';
  if (!sha) {
    try {
      sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    } catch {
      sha = 'dev';
    }
  }
  const versions: string[] = versionsIn(readFileSync('CHANGELOG.md', 'utf8'));
  return { sha, version: versions[0] ?? '0.0.0', run: process.env.GITHUB_RUN_ID ?? 'local' };
}

/** Emits version.json beside index.html; the deploy's live check polls it (CLAUDE.md, deploy gate 5). */
function versionJson(info: ReturnType<typeof buildInfo>): Plugin {
  return {
    name: 'interbus-version-json',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: `${JSON.stringify(info, null, 2)}\n` });
    },
  };
}

const info = buildInfo();

export default defineConfig({
  // Relative, so the same build runs under /interbus/ on Pages and later from app:// in the desktop shell.
  base: './',
  plugins: [react(), versionJson(info)],
  define: {
    __BUILD_SHA__: JSON.stringify(info.sha),
    __BUILD_VERSION__: JSON.stringify(info.version),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.vitest.ts'],
    environment: 'node',
  },
});
