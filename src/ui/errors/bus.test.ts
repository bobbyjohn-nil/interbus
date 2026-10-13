// V3's bus cases (`Intralines_City@dc63602:src/game/errors/bus.test.ts`), on an injected clock.
import { describe, expect, it } from 'vitest';
import { createErrorBus, ERROR_NOTIFY_EVERY_MS, installGlobalErrorHandlers, type ErrorLogEntry } from './bus';

function setup() {
  let t = 1_000_000;
  const lines: string[] = [];
  const quiet = { info: (l: string) => lines.push(`info ${l}`), warn: (l: string) => lines.push(`warn ${l}`), error: (l: string) => lines.push(`error ${l}`) };
  const bus = createErrorBus({ now: () => t, console: quiet });
  return { bus, lines, advance: (ms: number) => (t += ms) };
}

const quota = { severity: 'problem', source: 'save', code: 'quota' } as const;

describe('error bus', () => {
  it('folds 214 repeats into one row reading ×214, every one still reaching the sink', () => {
    const { bus, advance } = setup();
    const seen: ErrorLogEntry[] = [];
    bus.registerSink((entry) => seen.push(entry));
    for (let i = 0; i < 214; i++) {
      bus.report(quota);
      advance(10_000);
    }
    expect(seen).toHaveLength(214);
    expect(new Set(seen).size).toBe(1);
    expect(bus.entries()).toHaveLength(1);
    expect(bus.entries()[0]?.count).toBe(214);
  });

  it('notifies a key at most every 2 minutes and three times a session', () => {
    const { bus, advance } = setup();
    const notes: boolean[] = [];
    bus.registerSink((_, notify) => notes.push(notify));
    bus.report(quota);
    advance(ERROR_NOTIFY_EVERY_MS - 1);
    bus.report(quota);
    advance(1);
    bus.report(quota);
    for (let i = 0; i < 3; i++) {
      advance(ERROR_NOTIFY_EVERY_MS);
      bus.report(quota);
    }
    expect(notes).toEqual([true, false, true, true, false, false]);
  });

  it('never notifies a note, and keeps distinct keys apart', () => {
    const { bus } = setup();
    const notes: boolean[] = [];
    bus.registerSink((_, notify) => notes.push(notify));
    for (let i = 0; i < 5; i++) bus.report({ severity: 'note', source: 'map', code: 'slow-tile' });
    bus.report(quota);
    expect(notes).toEqual([false, false, false, false, false, true]);
    expect(bus.entries().map((e) => `${e.source}/${e.code}`)).toEqual(['map/slow-tile', 'save/quota']);
  });

  it('holds reports made before any sink and hands them, in order, to the first one', () => {
    const { bus } = setup();
    bus.report({ severity: 'problem', source: 'boot', code: 'a' });
    bus.report({ severity: 'problem', source: 'boot', code: 'b' });
    const got: string[] = [];
    bus.registerSink((e) => got.push(e.code));
    bus.report({ severity: 'problem', source: 'boot', code: 'c' });
    expect(got).toEqual(['a', 'b', 'c']);
  });

  it('drops a sink that throws, and the others still hear everything', () => {
    const { bus, lines } = setup();
    let good = 0;
    bus.registerSink(() => {
      throw new Error('broken renderer');
    });
    bus.registerSink(() => void good++);
    bus.report(quota);
    bus.report(quota);
    expect(good).toBe(2);
    expect(lines.filter((l) => l.startsWith('error [errors] a sink threw'))).toHaveLength(1);
  });

  it('logs to the console by severity', () => {
    const { bus, lines } = setup();
    bus.report({ severity: 'fatal', source: 'worker', code: 'dead' });
    bus.report({ severity: 'note', source: 'map', code: 'slow' });
    expect(lines).toEqual(['error [worker/dead]', 'info [map/slow]']);
  });
});

describe('global handlers (V3 never installed a sink, so reports went only to the console, S07)', () => {
  it("routes the page's uncaught errors and rejections to the bus, skipping known noise", () => {
    const { bus } = setup();
    const page = new EventTarget();
    installGlobalErrorHandlers(page, bus);
    const fire = (type: string, props: object) => page.dispatchEvent(Object.assign(new Event(type), props));
    fire('error', { error: new TypeError('x is undefined'), message: 'x is undefined' });
    fire('unhandledrejection', { reason: new Error('lost') });
    fire('error', { message: 'ResizeObserver loop completed with undelivered notifications.' });
    fire('error', {}); // a failed <script>: the replaced-build card's job
    expect(bus.entries().map((e) => [e.code, e.count])).toEqual([
      ['uncaught', 1],
      ['unhandled-rejection', 1],
    ]);
    expect(bus.entries()[0]?.detail).toMatch(/^TypeError: x is undefined/);
  });
});
