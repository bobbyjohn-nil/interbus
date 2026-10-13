// The error bus, ported from V3 (`Intralines_City@dc63602:src/game/errors/bus.ts`, S07): one entry
// point, report(); a report repeated 214 times is one row reading ×214; a key notifies at most once
// per 2 minutes and three times a session, and a note never does; reports made before any sink
// exists wait in a queue for the first one. Changed on the way in:
// - it lives on the main thread, outside the sim: the sim returns reason codes, and the clock is
//   injected (V3 called Date.now() inside the bus);
// - a bus is made by createErrorBus(), so tests need no fake timers or reset hook;
// - an action is a code ('reload', 'export'), not a closure, so a report can cross from the worker;
// - V3 never registered a sink, so reports reached only the console (S07). This one is installed at
//   boot (main.tsx), catching the page's uncaught errors.

export type ErrorSeverity = 'note' | 'problem' | 'fatal';
/** A closed list, so `${source}/${code}` keys cannot drift. */
export type ErrorSource = 'save' | 'city' | 'sim' | 'worker' | 'map' | 'render' | 'ui' | 'platform' | 'boot';
export type ErrorAction = 'reload' | 'export';

export interface ErrorReport {
  readonly severity: ErrorSeverity;
  readonly source: ErrorSource;
  /** A stable slug; src/ui turns it into ≤8 words of copy (I13). */
  readonly code: string;
  /** For the console and the session log: an error's name, message and first stack lines. Never a save. */
  readonly detail?: string;
  readonly action?: ErrorAction;
}

export interface ErrorLogEntry {
  readonly source: ErrorSource;
  readonly code: string;
  severity: ErrorSeverity;
  detail: string | undefined;
  action: ErrorAction | undefined;
  /** Every report folded into this row, the first included. */
  count: number;
  readonly firstAtMs: number;
  lastAtMs: number;
}

/** Sees each report after folding; `notify` says whether it has earned a notice. A sink that throws is dropped. */
export type ErrorSink = (entry: Readonly<ErrorLogEntry>, notify: boolean) => void;

export const ERROR_NOTIFY_EVERY_MS = 120_000;
export const ERROR_NOTIFY_MAX_PER_KEY = 3;
export const ERROR_LOG_CAPACITY = 200;
export const ERROR_QUEUE_CAPACITY = 50;

const RANK: Record<ErrorSeverity, number> = { note: 0, problem: 1, fatal: 2 };

export interface ErrorBus {
  report(r: ErrorReport): void;
  registerSink(sink: ErrorSink): () => void;
  /** The session log, newest last: what Export session will attach. */
  entries(): readonly Readonly<ErrorLogEntry>[];
}

interface Row extends ErrorLogEntry {
  notified: number;
  lastNotifiedAtMs: number;
}

export function createErrorBus(options: { now: () => number; console?: Pick<Console, 'info' | 'warn' | 'error'> }): ErrorBus {
  const out = options.console ?? console;
  const log = new Map<string, Row>();
  const sinks: ErrorSink[] = [];
  const queue: { row: Row; notify: boolean }[] = [];

  const toConsole = (row: Row, notify: boolean) => {
    const line = `[${row.source}/${row.code}]` + (row.count > 1 ? ` ×${row.count}` : '');
    const method = row.severity === 'fatal' ? 'error' : row.severity === 'problem' ? 'warn' : 'info';
    out[method](line, { detail: row.detail, notify });
  };

  const evictIfFull = () => {
    if (log.size < ERROR_LOG_CAPACITY) return;
    let victim: [string, Row] | undefined;
    for (const pair of log) {
      const [, row] = pair;
      if (!victim || RANK[row.severity] < RANK[victim[1].severity] || (RANK[row.severity] === RANK[victim[1].severity] && row.lastAtMs < victim[1].lastAtMs)) victim = pair;
    }
    if (victim) log.delete(victim[0]);
  };

  const deliver = (sink: ErrorSink, row: Row, notify: boolean) => {
    try {
      sink(row, notify);
    } catch (error) {
      const i = sinks.indexOf(sink);
      if (i !== -1) sinks.splice(i, 1);
      out.error('[errors] a sink threw and was dropped for the session', error);
    }
  };

  return {
    report(r) {
      const now = options.now();
      const key = `${r.source}/${r.code}`;
      let row = log.get(key);
      if (!row) {
        evictIfFull();
        row = { source: r.source, code: r.code, severity: r.severity, detail: r.detail, action: r.action, count: 1, firstAtMs: now, lastAtMs: now, notified: 0, lastNotifiedAtMs: -Infinity };
        log.set(key, row);
      } else {
        row.count += 1;
        row.lastAtMs = now;
        row.severity = r.severity;
        row.detail = r.detail;
        row.action = r.action;
      }
      const notify = row.severity !== 'note' && row.notified < ERROR_NOTIFY_MAX_PER_KEY && now - row.lastNotifiedAtMs >= ERROR_NOTIFY_EVERY_MS;
      if (notify) {
        row.notified += 1;
        row.lastNotifiedAtMs = now;
      }
      toConsole(row, notify);
      if (sinks.length === 0) {
        queue.push({ row, notify });
        if (queue.length > ERROR_QUEUE_CAPACITY) queue.shift();
        return;
      }
      for (const sink of [...sinks]) deliver(sink, row, notify);
    },
    registerSink(sink) {
      sinks.push(sink);
      for (const { row, notify } of queue.splice(0)) deliver(sink, row, notify);
      return () => {
        const i = sinks.indexOf(sink);
        if (i !== -1) sinks.splice(i, 1);
      };
    },
    entries: () => [...log.values()].sort((a, b) => a.lastAtMs - b.lastAtMs),
  };
}

/** Noise that reaches window.onerror but means nothing is broken (V1 `src/game/errors.ts:25-29`). */
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /AbortError/i];

function describeError(error: unknown): string {
  if (error instanceof Error) return [`${error.name}: ${error.message}`, ...(error.stack ?? '').split('\n').slice(1, 6)].join('\n');
  return String(error);
}

/** Routes the page's uncaught errors and unhandled rejections to the bus (V1's installGlobalErrorHandlers). */
export function installGlobalErrorHandlers(target: Pick<EventTarget, 'addEventListener'>, bus: ErrorBus): void {
  target.addEventListener('error', (event) => {
    const e = event as Event & { error?: unknown; message?: string };
    // A failed <script> or <img> has neither; the replaced-build card handles those (src/platform).
    if (e.error === undefined && !e.message) return;
    const detail = describeError(e.error ?? e.message);
    if (IGNORE.some((re) => re.test(detail))) return;
    bus.report({ severity: 'problem', source: 'ui', code: 'uncaught', detail });
  });
  target.addEventListener('unhandledrejection', (event) => {
    const detail = describeError((event as Event & { reason?: unknown }).reason);
    if (IGNORE.some((re) => re.test(detail))) return;
    bus.report({ severity: 'problem', source: 'ui', code: 'unhandled-rejection', detail });
  });
}
