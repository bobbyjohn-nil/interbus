import { useEffect, useState } from 'react';
import { cyclesOf } from '../../sim/rules/cycle';
import { FARES_CENTS } from '../../sim/rules/fare';
import { HEADWAY_MINUTES } from '../../sim/rules/periods';
import { BUS_MODELS, MODEL_IDS, checkHeadwayChange, checkModelChange } from '../../sim/rules/line';
import { modelLocked } from '../../sim/rules/medal';
import type { BusModelId, FareBandView, HeadwaysData, LineView } from '../../sim/types';
import { refusalText } from '../copy';
import { about, busCount, clock, duration, usd, usdK } from '../format';
import type { Sim } from './useSim';

/** Headways a player picks from, in minutes; overnight adds "off". */
const PERIODS = [
  ['peak', 'Peak'],
  ['offpeak', 'Off-peak'],
  ['overnight', 'Overnight'],
] as const;

/**
 * A line's card: its riders, its round trip at peak and off-peak and what roadworks add to it (the M4
 * spec, item 2), when its buses fill (K27), its buses and their model, its fare and the
 * band of fares that net the most (the M3 spec, item 4), and three headways (D7). A headway that needs
 * more buses reads "needs 3 buses, you have 2 · $95k" and confirming buys them (GD-09); another model
 * reads "2 Metro 40s · $520k, $95k back for the Sparrows". Each is the rule its command checks
 * (sim/rules/line.ts, GD-05).
 */
export function LineCard({ sim, line }: { sim: Sim; line: LineView }) {
  const [wanted, setWanted] = useState<HeadwaysData | null>(null);
  const [wantedModel, setWantedModel] = useState<BusModelId | null>(null);
  const s = sim.snapshot;
  // The band is worked out for the open card, again whenever the network changes.
  const { fareBandFor } = sim;
  const version = s?.linesVersion;
  useEffect(() => {
    fareBandFor(line.id);
    return () => fareBandFor(null);
  }, [fareBandFor, line.id, version]);
  if (!s) return null;
  const band = sim.fareBand?.lineId === line.id ? sim.fareBand.band : null;
  const fleet = { depots: s.depots.length, busesOwned: s.lines.reduce((n, l) => n + l.buses, 0), cashCents: s.cashCents, medals: s.medals };
  const next = wanted ?? line.headways;
  const model = BUS_MODELS[line.model];
  const change = wanted ? checkHeadwayChange(fleet, { cycle: line.cycle, cycles: line.cycles, buses: line.buses, model }, wanted) : null;
  const swap = wantedModel
    ? checkModelChange(fleet, { routeM: line.stopDistM[line.stopDistM.length - 1] ?? 0, stops: line.stops.length, rush: line.rush, worksM: line.worksM, buses: line.buses, model, headways: line.headways }, BUS_MODELS[wantedModel])
    : null;
  // The same round trip on clear streets: what today's roadworks add is the difference (sim/rules/cycle.ts).
  const clear = cyclesOf(line.stopDistM[line.stopDistM.length - 1] ?? 0, line.stops.length, model.kmh, line.rush);
  const works = line.worksM > 0 && s.event ? { street: s.event.street, addS: line.cycles.peak - clear.peak } : null;
  const pick = (period: (typeof PERIODS)[number][0], value: string) => setWanted({ ...next, [period]: value === 'off' ? null : Number(value) * 60 });
  return (
    <section className="line-card" aria-label={line.name} data-testid="line-card" data-line={line.id} data-model={line.model} data-running={line.forecastCents.running}>
      <h2>
        <span className="swatch" style={{ background: line.colour }} /> {line.name}
      </h2>
      <p>
        {about(line.ridersPerDay)} riders a day · {busCount(line.buses, model.name)}
      </p>
      {line.cycles.peak > 0 ? (
        <p className="round-trip" data-testid="round-trip" data-peak={line.cycles.peak} data-works-s={works?.addS ?? 0}>
          Round trip {duration(line.cycles.peak)} at peak, {duration(line.cycles.offpeak)} off-peak
          {works ? ` · roadworks on ${works.street} add ${duration(works.addS, true)}` : null}
        </p>
      ) : null}
      {line.fullAtMinute !== null ? (
        <p className="full" data-testid="line-full">
          Full at {clock(Math.floor(line.fullAtMinute / 60), line.fullAtMinute % 60)} · {about(line.turnedAwayPerDay)} riders a day turned away
        </p>
      ) : null}
      <label className="model">
        Buses
        <select value={wantedModel ?? line.model} onChange={(e) => setWantedModel(e.target.value === line.model ? null : (e.target.value as BusModelId))}>
          {MODEL_IDS.map((id) => {
            const locked = modelLocked(BUS_MODELS[id], s.medals);
            return (
              <option key={id} value={id} disabled={locked}>
                {BUS_MODELS[id].name} · {BUS_MODELS[id].seats} seats{locked ? ' · locked' : ''}
              </option>
            );
          })}
        </select>
      </label>
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
      <label className="fare">
        Fare
        <select value={String(line.fareCents)} onChange={(e) => sim.send({ type: 'set-fare', lineId: line.id, fareCents: Number(e.target.value) })}>
          {FARES_CENTS.map((f) => (
            <option key={f} value={String(f)}>
              {usd(f, { cents: true })}
            </option>
          ))}
        </select>
      </label>
      {band ? (
        <p className="hint" data-testid="fare-band" data-from={band.fromCents} data-to={band.toCents}>
          {bandText(band)}
        </p>
      ) : null}
      <div className="headways">
        {PERIODS.map(([period, label]) => (
          <label key={period}>
            {label}
            <select value={next[period] === null ? 'off' : String((next[period] ?? 0) / 60)} onChange={(e) => pick(period, e.target.value)}>
              {period === 'overnight' ? <option value="off">off</option> : null}
              {HEADWAY_MINUTES.map((m) => (
                <option key={m} value={String(m)}>
                  every {m} min
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {change ? (
        <div className="change" data-testid="headway-change" data-ok={change.ok ? 'yes' : 'no'}>
          {change.ok ? (
            <p>{change.extra > 0 ? `needs ${change.needed} buses, you have ${line.buses} · ${usdK(change.priceCents)}` : `runs with the ${line.buses} ${line.buses === 1 ? 'bus' : 'buses'} it has`}</p>
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

/** "Best net at $1.75–$2.00": the fares whose day nets within 5% of the best. */
export function bandText(band: FareBandView): string {
  const from = usd(band.fromCents, { cents: true });
  return band.fromCents === band.toCents ? `Best net at ${from}` : `Best net at ${from}–${usd(band.toCents, { cents: true })}`;
}
