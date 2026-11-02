// A Playwright reporter for CI's e2e parts (playwright.config.ts): as a run ends, one line of each spec file's seconds,
// its tests' durations summed as one worker ran them, the numbers e2e/seconds.json holds to share the files out among the
// parts (scripts/e2e-parts.mjs). Each part's log ends with its files' line, so the table is measured again from one run's
// eight logs. Run: npm run test:scripts
import { basename } from 'node:path';

export default class E2eSeconds {
  constructor({ out = (line) => console.log(line) } = {}) {
    this.out = out;
    this.seconds = new Map();
  }

  onTestEnd(test, result) {
    const file = basename(test.location.file);
    this.seconds.set(file, (this.seconds.get(file) ?? 0) + result.duration / 1000);
  }

  onEnd() {
    const files = [...this.seconds.keys()].sort((a, b) => a.localeCompare(b));
    this.out(`e2e seconds ${JSON.stringify(Object.fromEntries(files.map((f) => [f, Math.round(this.seconds.get(f) * 10) / 10])))}`);
  }
}
