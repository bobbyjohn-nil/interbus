// Random play with Sell spare buses and Close line among the other commands (the systems audit's tenth round; I1, I6, I8, I9):
// a rich company on the fixture, three depots, and 120 random steps a seed of new lines, headway changes, sales, closes,
// undos and fares, with time run between them. It checks:
// - every day card adds up to the change in cash (I1);
// - an undo right after a command puts back the exact game (I9);
// - a whole day from its midnight with no command banks the costs Finance forecast at that midnight, to the cent (I6);
// - a save reloaded mid-game hashes the same, and plays on six hours to the same game (I8);
// - the exported session replays to the same game.
// The round's first finder lane ran it on 12 seeds and kept it (TS-08); the PR checks run 6, about 4 s a seed.
// FUZZ_SEEDS=12 runs the finder's twelve, and FUZZ_REPORT=1 prints each seed's commands and checks.
import { describe, expect, it } from 'vitest';
import { bakeSim } from '../../tools/bake/sim.mjs';
import { createRng } from '../sim/core/rng';
import { foundLedger } from '../sim/economy/ledger';
import { encode } from '../sim/save/save';
import { newGame } from '../sim/state';
import type { FromWorker, ToWorker } from '../sim/types';
import { createHost } from './host';
import { replaySession } from './replay';

const baked = bakeSim('boston', 'mini-boston');
const CITY = { id: 'boston', revision: 'mini-boston', hash: baked.sha256 };
const BUILD = { sha: 'c0ffee0'.padEnd(40, '0'), version: '0.0.0' };
/** Places on the fixture's streets a line may run between. */
const STOPS: [number, number][] = [[-71.077, 42.3499], [-71.0857, 42.3424], [-71.095, 42.3375], [-71.1035, 42.336], [-71.09721, 42.34883], [-71.0866, 42.3427], [-71.0985, 42.3452]];
const HEADWAYS = [600, 900, 1_200, 1_800, 2_400, 3_600];
const SEEDS = Number(process.env.FUZZ_SEEDS ?? 6);

function started(save: string | null = null) {
  const out: FromWorker[] = [];
  const host = createHost((m) => out.push(m));
  host.handle({ type: 'init', simText: baked.text, city: CITY, seed: 1, build: BUILD });
  host.handle({ type: 'save-text', text: save });
  const last = <T extends FromWorker['type']>(type: T) => out.filter((m) => m.type === type).at(-1) as Extract<FromWorker, { type: T }> | undefined;
  return { host, out, last };
}

/** A spot inside the `parcel`-th largest parcel of depot land. */
function depotSpot(land: readonly (readonly [number, number])[][], parcel = 0): [number, number] {
  const ring = [...land].sort((a, b) => b.length - a.length)[parcel]!;
  const mid = ring.reduce(([x, y], p) => [x + p[0] / ring.length, y + p[1] / ring.length], [0, 0]);
  return [(ring[0]![0] + mid[0]!) / 2, (ring[0]![1] + mid[1]!) / 2];
}

describe('random play with sales and closes', () => {
  for (let seed = 1; seed <= SEEDS; seed++) {
    it(`seed ${seed}: day cards add up, undos put back the game, days bank their forecast, reloads and the session replay`, () => {
      const rng = createRng(seed * 7919);
      const rich = { ...newGame(CITY, { name: 'Back Bay Transit', colour: '#2471a3' }, 1), ledger: foundLedger(3_000_000_000) };
      const { host, out, last } = started(encode(rich, BUILD));
      const land = last('ready')!.depotLand as [number, number][][];
      for (const parcel of [0, 1, 2]) host.handle({ type: 'place-depot', at: depotSpot(land, parcel) });
      let speed = 0;
      const exportText = () => {
        host.handle({ type: 'export' });
        return last('export')!.text;
      };
      const game = () => JSON.stringify((JSON.parse(exportText()) as { data: unknown }).data);
      const problems: string[] = [];
      const log: string[] = [];
      let days = 0;
      for (let step = 0; step < 120; step++) {
        const snap = last('snapshot')!.snapshot;
        if (snap.floor?.ended) break;
        const ids = snap.lines.map((l) => l.id);
        const pickLine = () => ids[rng.int(0, ids.length - 1)]!;
        const r = rng.next();
        let msg: ToWorker | null = null;
        if (r < 0.18 || ids.length === 0) {
          const a = rng.int(0, STOPS.length - 1);
          let b = rng.int(0, STOPS.length - 1);
          if (b === a) b = (a + 1) % STOPS.length;
          const clicks = rng.next() < 0.5 ? [STOPS[a]!, STOPS[b]!] : [STOPS[a]!, STOPS[b]!, STOPS[(b + 2) % STOPS.length]!].filter((p, k, all) => all.indexOf(p) === k);
          const peak = HEADWAYS[rng.int(0, 2)]!;
          msg = { type: 'create-line', clicks, headways: { peak, offpeak: Math.max(peak, HEADWAYS[rng.int(0, 3)]!), overnight: rng.next() < 0.3 ? 3_600 : null } };
        } else if (r < 0.36) {
          const peak = HEADWAYS[rng.int(0, 5)]!;
          msg = { type: 'set-headways', lineId: pickLine(), headways: { peak, offpeak: Math.max(peak, HEADWAYS[rng.int(0, 5)]!), overnight: rng.next() < 0.3 ? 3_600 : null } };
        } else if (r < 0.5) msg = { type: 'sell-spares', lineId: pickLine() };
        else if (r < 0.6) msg = { type: 'close-line', lineId: pickLine() };
        else if (r < 0.66) msg = { type: 'undo' };
        else if (r < 0.7) msg = { type: 'set-fare', lineId: pickLine(), fareCents: 100 + 25 * rng.int(0, 16) };
        if (msg) {
          const before = speed === 0 ? game() : null;
          host.handle(msg);
          const refused = out.at(-2)?.type === 'refused';
          log.push(`${snap.elapsed} ${JSON.stringify(msg)} -> ${refused ? (out.at(-2) as { reason: string }).reason : 'ok'}`);
          // An undo right after puts back the exact game (I9).
          if (before !== null && msg.type !== 'undo' && last('snapshot')!.snapshot.undo && !refused && rng.next() < 0.3) {
            host.handle({ type: 'undo' });
            log.push('  undo');
            if (game() !== before) problems.push(`step ${step}: an undo of ${msg.type} did not put back the game`);
          }
        }
        // Time: run a while, or pause.
        if (rng.next() < 0.6) {
          if (speed === 0) {
            speed = 5;
            host.handle({ type: 'speed', speed: 5 });
          }
          host.advanceTo(last('snapshot')!.snapshot.elapsed + rng.int(1, 30) * 1_200);
          if (rng.next() < 0.7) {
            speed = 0;
            host.handle({ type: 'speed', speed: 0 });
          }
        }
        // A whole day from its midnight with no command banks the costs Finance forecast at the midnight (I6).
        if (rng.next() < 0.2) {
          const now = last('snapshot')!.snapshot.elapsed;
          const midnight = Math.ceil((now + 5 * 3_600) / 86_400) * 86_400 - 5 * 3_600;
          if (speed === 0) host.handle({ type: 'speed', speed: 5 });
          host.advanceTo(midnight);
          host.handle({ type: 'speed', speed: 0 });
          const atMidnight = last('snapshot')!.snapshot;
          if (atMidnight.floor?.ended) break;
          const day = atMidnight.day;
          const forecast = Object.fromEntries(atMidnight.finance.rows.map((row) => [row.kind, row.forecastCents]));
          host.handle({ type: 'speed', speed: 5 });
          host.advanceTo(midnight + 86_400);
          host.handle({ type: 'speed', speed: 0 });
          speed = 0;
          const card = out.flatMap((m) => (m.type === 'day-card' && m.card.day === day ? [m.card] : [])).at(-1);
          if (card) {
            days++;
            for (const kind of ['running', 'wages', 'deadhead', 'upkeep', 'stopUpkeep'] as const) {
              const banked = card.rows.filter((row) => row.kind === kind).reduce((sum, row) => sum + row.amountCents, 0);
              if (banked !== (forecast[kind] ?? 0)) problems.push(`step ${step}: day ${day}'s ${kind} banked ${banked} against a forecast of ${forecast[kind]}`);
            }
          }
        }
        // Now and then a reload: the save hashes the same, and played on six hours reaches the same game (I8).
        if (speed === 0 && rng.next() < 0.15) {
          const twin = started(exportText());
          if (twin.host.stateHash() !== host.stateHash()) problems.push(`step ${step}: the reloaded save hashes apart at once`);
          for (const h of [host, twin.host]) h.handle({ type: 'speed', speed: 5 });
          const to = last('snapshot')!.snapshot.elapsed + 6 * 3_600;
          host.advanceTo(to);
          twin.host.advanceTo(to);
          if (twin.host.stateHash() !== host.stateHash()) problems.push(`step ${step}: the reloaded save plays on apart`);
          host.handle({ type: 'speed', speed: 0 });
          speed = 0;
        }
      }
      // I1: every day card adds up to the change in cash.
      for (const m of out) {
        if (m.type !== 'day-card') continue;
        const sum = m.card.rows.reduce((s, row) => s + row.amountCents, 0);
        if (sum !== m.card.cashAfterCents - m.card.cashBeforeCents) problems.push(`day ${m.card.day}: rows ${sum} against a change of ${m.card.cashAfterCents - m.card.cashBeforeCents}`);
      }
      host.handle({ type: 'export-session' });
      const replay = replaySession(baked.text, last('export')!.text);
      if (!(replay.ok && replay.matches)) problems.push(`the session replays apart: ${JSON.stringify(replay)}`);
      if (process.env.FUZZ_REPORT) {
        const done: Record<string, number> = {};
        for (const line of log) {
          const m = /"type":"([a-z-]+)".*-> (\w+)/.exec(line);
          if (m) done[`${m[1]} ${m[2]}`] = (done[`${m[1]} ${m[2]}`] ?? 0) + 1;
        }
        console.log(`seed ${seed}: to day ${last('snapshot')!.snapshot.day}, ${days} whole days checked, ${JSON.stringify(done)}`);
      }
      expect(problems, log.slice(-40).join('\n')).toEqual([]);
    }, 300_000);
  }
});
