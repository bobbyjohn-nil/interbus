import { useState } from 'react';
import { cyclesOf } from '../../sim/rules/cycle';
import { HEADWAY_MINUTES, sameHeadways, type Period } from '../../sim/rules/periods';
import { BUS_MODELS, MODEL_IDS, checkHeadwayChange, checkModelChange, type FleetContext } from '../../sim/rules/line';
import { planIsExpress } from '../../sim/rules/express';
import { modelLocked } from '../../sim/rules/medal';
import type { BusModelId, FareBandView, HeadwaysData, LineView } from '../../sim/types';
import { refusalText } from '../copy';
import { Dropdown } from '../Dropdown';
import { about, busCount, clock, duration, usd, usdK } from '../format';
import type { Sim } from './useSim';

/** Headways a player picks from, in minutes; overnight adds "off". */
const PERIODS = [
  ['peak', 'Peak'],
  ['offpeak', 'Off-peak'],
  ['overnight', 'Overnight'],
] as const;

/**
 * A headway pick on the line card: the three headways as picked, and what they were picked against: the line's headways
 * then, and the game (Sim's `loaded.at`, which a slot or a file loaded and Restart this quarter move).
 */
export interface HeadwayPick {
  readonly headways: HeadwaysData;
  readonly base: HeadwaysData;
  readonly game: number | null;
}

/** `period` set to `seconds` (null: off) on the card as it shows: the pick it still holds, or else the line's own headways. */
export function pickHeadway(held: HeadwayPick | null, line: { readonly headways: HeadwaysData }, game: number | null, period: Period, seconds: number | null): HeadwayPick {
  return { headways: { ...(held?.headways ?? line.headways), [period]: seconds }, base: line.headways, game };
}

/**
 * The pick as the line and the game now stand, so the card never shows or sends a headway the line does not run unless the
 * player picked it since the line last changed: null once the line's headways changed under the card (an undo) or another game
 * took this one's place (a slot or a file loaded, Restart this quarter), and `pick` itself otherwise.
 */
export function heldPick(pick: HeadwayPick | null, line: { readonly headways: HeadwaysData }, game: number | null): HeadwayPick | null {
  return pick && pick.game === game && sameHeadways(pick.base, line.headways) ? pick : null;
}

/** A model pick on the line card, and what it was picked against: the line's model then, and the game, as HeadwayPick. */
export interface ModelPick {
  readonly model: BusModelId;
  readonly base: BusModelId;
  readonly game: number | null;
}

/** The model pick as the line and the game now stand: null once the line's model changed under the card or another game took this one's place. */
export function heldModel(pick: ModelPick | null, line: { readonly model: BusModelId }, game: number | null): ModelPick | null {
  return pick && pick.game === game && pick.base === line.model ? pick : null;
}

/** The change card for the pick held: the headway rule's verdict on it (GD-05), or no card for no pick or the line's own headways picked back, which are no change. */
export function headwayChange(fleet: FleetContext, line: Pick<LineView, 'cycle' | 'cycles' | 'buses' | 'model' | 'headways'>, held: HeadwayPick | null) {
  if (!held) return null;
  const verdict = checkHeadwayChange(fleet, { cycle: line.cycle, cycles: line.cycles, buses: line.buses, model: BUS_MODELS[line.model], headways: line.headways }, held.headways);
  return !verdict.ok && verdict.reason === 'same_headways' ? null : verdict;
}

/**
 * A line's card: its riders, its round trip at peak and off-peak and what roadworks or snow add to it (the M4
 * spec, item 2), when its buses fill (K27), its buses and their model, its fare (set in Finance's
 * Lines with the band of fares that net the most, D25), and three headways (D7). A headway that needs
 * more buses reads "Needs 3 buses (you have 2) · $95k" and confirming buys them (GD-09); another model
 * reads "2 Metro 40s · $520k, $95k back for the Sparrows". Each is the rule its command checks
 * (sim/rules/line.ts, GD-05).
 */
export function LineCard({ sim, line, onFinance }: { sim: Sim; line: LineView; onFinance?: () => void }) {
  const [wanted, setWanted] = useState<HeadwayPick | null>(null);
  const [modelPick, setModelPick] = useState<ModelPick | null>(null);
  const s = sim.snapshot;
  if (!s) return null;
  const game = sim.loaded?.at ?? null;
  // A pick made before an undo or a load is dropped, not sent with the line as it now stands.
  const held = heldPick(wanted, line, game);
  if (held !== wanted) setWanted(held);
  const keptModel = heldModel(modelPick, line, game);
  if (keptModel !== modelPick) setModelPick(keptModel);
  const wantedModel = keptModel?.model ?? null;
  const setWantedModel = (id: BusModelId | null) => setModelPick(id === null ? null : { model: id, base: line.model, game });
  const snow = s.event?.kind === 'snow' && s.event.phase === 'on';
  const fleet = { depots: s.depots.length, busesOwned: s.lines.reduce((n, l) => n + l.buses, 0), cashCents: s.cashCents, medals: s.medals };
  const next = held?.headways ?? line.headways;
  const model = BUS_MODELS[line.model];
  const change = headwayChange(fleet, line, held);
  const swap = wantedModel
    ? checkModelChange(fleet, { routeM: line.stopDistM[line.stopDistM.length - 1] ?? 0, stops: line.stops.length, rush: line.rush, worksM: line.worksM, snow, buses: line.buses, model, headways: line.headways }, BUS_MODELS[wantedModel])
    : null;
  // The same round trip on clear streets: what today's roadworks or snow add is the difference (sim/rules/cycle.ts).
  const clear = cyclesOf(line.stopDistM[line.stopDistM.length - 1] ?? 0, line.stops.length, model.kmh, line.rush);
  const works = line.worksM > 0 && s.event ? { street: s.event.street, addS: line.cycles.peak - clear.peak } : null;
  const snowAddS = snow ? line.cycles.peak - clear.peak : 0;
  const pick = (period: Period, value: string) => setWanted(pickHeadway(held, line, game, period, value === 'off' ? null : Number(value) * 60));
  return (
    <section className="line-card" aria-label={line.name} data-testid="line-card" data-line={line.id} data-model={line.model} data-running={s.finance.lines.find((m) => m.id === line.id)?.forecastCents.running ?? 0}>
      <h2>
        <span className="swatch" style={{ background: line.colour }} /> {line.name}
        {planIsExpress(line) ? (
          <span className="express" data-testid="express" title="Express: 5 km or longer, with stops at least 1.2 km apart on average. Riders feel the ride is quicker and mind the fare half as much.">
            Express
          </span>
        ) : null}
      </h2>
      <p>
        {about(line.ridersPerDay)} riders a day · {busCount(line.buses, model.name)}
      </p>
      {line.cycles.peak > 0 ? (
        <p className="round-trip" data-testid="round-trip" data-peak={line.cycles.peak} data-works-s={works?.addS ?? 0} data-snow-s={snowAddS}>
          Round trip {duration(line.cycles.peak)} at peak, {duration(line.cycles.offpeak)} off-peak
          {works ? ` · roadworks on ${works.street} add ${duration(works.addS, true)}` : null}
          {snow ? ` · snow adds ${duration(snowAddS, snowAddS < 120)}` : null}
        </p>
      ) : null}
      {line.fullAtMinute !== null ? (
        <p className="full" data-testid="line-full">
          Full at {clock(Math.floor(line.fullAtMinute / 60), line.fullAtMinute % 60)} · {about(line.turnedAwayPerDay)} riders a day turned away
        </p>
      ) : null}
      <div className="model">
        <span>Buses</span>
        <Dropdown
          label="Buses"
          testId="line-model"
          value={wantedModel ?? line.model}
          options={MODEL_IDS.map((id) => {
            const locked = modelLocked(BUS_MODELS[id], s.medals);
            return { value: id, label: `${BUS_MODELS[id].name} · ${BUS_MODELS[id].seats} seats${locked ? ' · locked' : ''}`, disabled: locked, ...(locked ? { hint: 'A silver medal unlocks it' } : {}) };
          })}
          onChange={(id: BusModelId) => setWantedModel(id === line.model ? null : id)}
        />
      </div>
      {swap && wantedModel ? (
        <div className="change" data-testid="model-change" data-ok={swap.ok ? 'yes' : 'no'}>
          {swap.ok ? (
            <p>
              {busCount(swap.needed, BUS_MODELS[wantedModel].name)} · {usdK(swap.buyCents)}, {usdK(swap.saleCents)} back for the {busCount(line.buses, model.name).replace(/^\d+ /, '')}
            </p>
          ) : (
            <p className="refusal" role="status">
              {refusalText(swap)}
            </p>
          )}
          <div className="controls">
            <button
              type="button"
              disabled={!swap.ok}
              onClick={() => {
                sim.send({ type: 'set-model', lineId: line.id, model: wantedModel });
                setWantedModel(null);
              }}
            >
              Buy and swap
            </button>
            <button type="button" onClick={() => setWantedModel(null)}>
              Keep as is
            </button>
          </div>
        </div>
      ) : null}
      {/* The fare is a money lever: it is set in Finance's Lines, beside the line's money (D25). */}
      <p className="fare" data-testid="line-fare" data-fare={line.fareCents}>
        Fare {usd(line.fareCents, { cents: true })}
        {onFinance ? (
          <button type="button" className="link" onClick={onFinance}>
            Fare and money in Finance
          </button>
        ) : null}
      </p>
      <div className="headways">
        {PERIODS.map(([period, label]) => (
          <div key={period} className="headway">
            <span>{label}</span>
            <Dropdown
              label={label}
              testId={`headway-${period}`}
              value={next[period] === null ? 'off' : String((next[period] ?? 0) / 60)}
              options={[...(period === 'overnight' ? [{ value: 'off', label: 'Off' }] : []), ...HEADWAY_MINUTES.map((m) => ({ value: String(m), label: `Every ${m} min` }))]}
              onChange={(value) => pick(period, value)}
            />
          </div>
        ))}
      </div>
      {change ? (
        <div className="change" data-testid="headway-change" data-ok={change.ok ? 'yes' : 'no'}>
          {change.ok ? (
            <p>{change.extra > 0 ? `Needs ${change.needed} buses (you have ${line.buses}) · ${usdK(change.priceCents)}` : `Runs with the ${line.buses} ${line.buses === 1 ? 'bus' : 'buses'} it has`}</p>
          ) : (
            <p className="refusal" role="status">
              {refusalText(change)}
            </p>
          )}
          <div className="controls">
            <button
              type="button"
              disabled={!change.ok}
              onClick={() => {
                sim.send({ type: 'set-headways', lineId: line.id, headways: next });
                setWanted(null);
              }}
            >
              {change.ok && change.extra > 0 ? 'Buy and run' : 'Run it'}
            </button>
            <button type="button" onClick={() => setWanted(null)}>
              Keep as is
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/** "Most profit at $1.75–$2.00": the fares whose day nets within 5% of the best. */
export function bandText(band: FareBandView): string {
  const from = usd(band.fromCents, { cents: true });
  return band.fromCents === band.toCents ? `Most profit at ${from}` : `Most profit at ${from}–${usd(band.toCents, { cents: true })}`;
}
