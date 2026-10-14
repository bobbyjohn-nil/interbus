// Export session (the M3 spec, item 12; AR-06): a session played through the host, exported, and
// replayed into a fresh host reaches the same game, fingerprint for fingerprint. Shown failing
// (TS-04): with speed changes left out of the session, the replay, never told that time ran, lets an
// undo take back a fare set while it ran; with a session begun mid-run (at a quarter's close)
// recorded as paused, the same.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../tools/bake/sim.mjs';
import type { FromWorker, ToWorker } from '../sim/types';
import { createHost, type SessionFile } from './host';
import { replaySession } from './replay';

const baked = bakeSim('boston', 'mini-boston');
const CITY = { id: 'boston', revision: 'mini-boston', hash: baked.sha256 };
const BUILD = { sha: 'c0ffee0'.padEnd(40, '0'), version: '0.0.0' };
const CLICKS: [number, number][] = [[-71.077, 42.3499], [-71.0857, 42.3424], [-71.095, 42.3375], [-71.1035, 42.336]];

function game() {
  const out: FromWorker[] = [];
  const store = new Map<string, string>();
  const host = createHost((m) => out.push(m));
  let seen = 0;
  let clock = 0;
  const send = (m: ToWorker) => {
    host.handle(m);
    while (seen < out.length) {
      const n = out[seen++]!;
      if (n.type === 'store') for (const e of n.effects) void (e.op === 'write' ? store.set(e.key, e.value) : store.delete(e.key));
      else if (n.type === 'read-keys') host.handle({ type: 'key-texts', id: n.id, texts: n.keys.map((k) => store.get(k) ?? null) });
    }
  };
  const last = <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }> | undefined;
  /** Real time passing until the game reaches `elapsed`, in the page's ticks. */
  const runTo = (elapsed: number) => {
    while ((last('snapshot')?.snapshot.elapsed ?? 0) < elapsed) host.tick((clock += 100));
    host.tick((clock += 100));
  };
  send({ type: 'init', simText: baked.text, city: CITY, seed: 1, build: BUILD });
  send({ type: 'save-text', text: null });
  return { host, out, send, last, runTo, store };
}

const exported = (g: ReturnType<typeof game>) => {
  g.send({ type: 'export-session' });
  return g.last('export')!;
};

describe('Export session', () => {
  it('replays a session from founding to the same game: time running, a fare set while it ran, undo refused and taken, a contract', () => {
    const g = game();
    g.send({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    const land = g.last('ready')!.depotLand as [number, number][][];
    const ring = [...land].sort((a, b) => b.length - a.length)[0]!;
    g.send({ type: 'place-depot', at: [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length] });
    g.send({ type: 'create-line', clicks: CLICKS });
    expect(g.last('snapshot')!.snapshot.lines).toHaveLength(1);
    const line = g.last('snapshot')!.snapshot.lines[0]!;
    g.send({ type: 'speed', speed: 5 });
    g.runTo(30 * 3_600); // 11:00 on day 2
    g.send({ type: 'set-fare', lineId: line.id, fareCents: 175 }); // while time runs: not undoable
    g.send({ type: 'speed', speed: 0 });
    g.send({ type: 'undo' });
    expect(g.last('refused')).toMatchObject({ command: 'undo', reason: 'time_has_run' });
    g.send({ type: 'set-headways', lineId: line.id, headways: { peak: 900, offpeak: 1_200, overnight: null } });
    g.send({ type: 'undo' });
    const longwood = g.last('snapshot')!.snapshot.contracts.find((c) => c.landmark === 'Longwood')!;
    g.send({ type: 'accept-contract', contractId: longwood.id });
    g.send({ type: 'speed', speed: 3 });
    g.runTo(40 * 3_600);
    const live = g.host.stateHash()!;
    const file = exported(g);
    expect(file.name).toBe('interbus-boston-session-day-2.json');
    const session = JSON.parse(file.text) as SessionFile;
    expect(session.end.hash).toBe(live);
    expect(replaySession(baked.text, file.text)).toEqual({ ok: true, hash: live, matches: true });
    expect(session.build).toEqual(BUILD);
    expect(session.commands.map((c) => c.message.type)).toEqual(['place-depot', 'create-line', 'speed', 'set-fare', 'speed', 'undo', 'set-headways', 'undo', 'accept-contract', 'speed']);
    // 2,118 bytes, 968 of them the founding save: the spec expected the save (about 10 KB) plus a few KB of commands.
    expect(file.text.length).toBeLessThan(10_000);
  });

  it('keeps the speed a session began at: one begun at a quarter’s close, mid-run, replays too', () => {
    const g = game();
    g.send({ type: 'found', name: 'Back Bay Transit', colour: '#2471a3' });
    g.send({ type: 'create-line', clicks: CLICKS }); // refused: no depot, which the session records like any command
    const land = g.last('ready')!.depotLand as [number, number][][];
    const ring = [...land].sort((a, b) => b.length - a.length)[0]!;
    g.send({ type: 'place-depot', at: [ring.reduce((s, p) => s + p[0], 0) / ring.length, ring.reduce((s, p) => s + p[1], 0) / ring.length] });
    g.send({ type: 'create-line', clicks: CLICKS });
    const line = g.last('snapshot')!.snapshot.lines[0]!;
    g.send({ type: 'speed', speed: 5 });
    g.runTo(7 * 86_400 + 19 * 3_600); // past day 8's close, where quarter 2 and a new session begin
    g.send({ type: 'set-fare', lineId: line.id, fareCents: 175 });
    g.send({ type: 'speed', speed: 0 });
    g.send({ type: 'undo' });
    expect(g.last('refused')).toMatchObject({ command: 'undo', reason: 'time_has_run' });
    const file = exported(g);
    const session = JSON.parse(file.text) as SessionFile;
    expect(replaySession(baked.text, file.text)).toMatchObject({ ok: true, matches: true });
    expect(session.speed).toBe(5);
    expect(session.commands.map((c) => c.message.type)).toEqual(['set-fare', 'speed', 'undo']);
  });

  it('refuses a file that is not a session', () => {
    expect(replaySession(baked.text, '{')).toEqual({ ok: false, problem: 'not JSON' });
    expect(replaySession(baked.text, '{"kind":"interbus-save"}')).toEqual({ ok: false, problem: 'not a session file' });
  });
});
