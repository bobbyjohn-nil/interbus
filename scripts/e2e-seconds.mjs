// A Playwright reporter for CI's e2e parts (playwright.config.ts): as a run ends, one line of each spec file's seconds,
// its tests' times summed as one worker ran them, the numbers e2e/seconds.json holds to share the files out among the
// parts (scripts/e2e-parts.mjs). Each part's log ends with its files' line, so the table is measured again from one run's
// eight logs. Run: npm run test:scripts
import { relative, sep } from 'node:path';

export default class E2eSeconds {
  constructor({ out = (line) => console.log(line), now = () => Date.now() } = {}) {
    this.out = out;
    this.now = now;
    this.testDir = null;
    this.seconds = new Map();
  }

  onBegin(config) {
    this.testDir = config.projects[0]?.testDir ?? null;
  }

  // A test's time on its worker: from its start, which comes before its file's beforeAll hooks, to its end. Its own
  // `duration` leaves those hooks out, Playwright timing them apart: swap.spec.ts's builds of three deploys, about 15 s.
  onTestEnd(test, result) {
    const file = this.testDir ? relative(this.testDir, test.location.file).split(sep).join('/') : test.location.file;
    this.seconds.set(file, (this.seconds.get(file) ?? 0) + Math.max(0, this.now() - result.startTime.getTime()) / 1000);
  }

  onEnd() {
    const files = [...this.seconds.keys()].sort((a, b) => a.localeCompare(b));
    this.out(`e2e seconds ${JSON.stringify(Object.fromEntries(files.map((f) => [f, Math.round(this.seconds.get(f) * 10) / 10])))}`);
  }
}
