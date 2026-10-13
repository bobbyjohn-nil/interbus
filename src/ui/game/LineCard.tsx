import { useState } from 'react';
import { BUS_MODELS, MODEL_IDS, checkHeadwayChange, checkModelChange } from '../../sim/rules/line';
import type { BusModelId, HeadwaysData, LineView } from '../../sim/types';
import { refusalText } from '../copy';
import { about, busCount, usdK } from '../format';
import type { Sim } from './useSim';

/** Headways a player picks from, in minutes; overnight adds "off". */
const MINUTES = [5, 6, 8, 10, 12, 15, 20, 30, 45, 60];
const PERIODS = [
  ['peak', 'Peak'],
  ['offpeak', 'Off-peak'],
  ['overnight', 'Overnight'],
] as const;

/**
 * A line's card: its riders, its buses and their model, and three headways (D7). A headway that needs
 * more buses reads "needs 3 buses, you have 2 · $95k" and confirming buys them (GD-09); another model
 * reads "2 Metro 40s · $520k, $95k back for the Sparrows". Each is the rule its command checks
 * (sim/rules/line.ts, GD-05).
 */
export function LineCard({ sim, line }: { sim: Sim; line: LineView }) {
  const [wanted, setWanted] = useState<HeadwaysData | null>(null);
  const [wantedModel, setWantedModel] = useState<BusModelId | null>(null);
  const s = sim.snapshot;
  if (!s) return null;
  const fleet = { depots: s.depots.length, busesOwned: s.lines.reduce((n, l) => n + l.buses, 0), cashCents: s.cashCents };
  const next = wanted ?? line.headways;
  const model = BUS_MODELS[line.model];
  const change = wanted ? checkHeadwayChange(fleet, { cycle: line.cycle, buses: line.buses, model }, wanted) : null;
  const swap = wantedModel
    ? checkModelChange(fleet, { routeM: line.stopDistM[line.stopDistM.length - 1] ?? 0, stops: line.stops.length, buses: line.buses, model, headways: line.headways }, BUS_MODELS[wantedModel])
    : null;
  const pick = (period: (typeof PERIODS)[number][0], value: string) => setWanted({ ...next, [period]: value === 'off' ? null : Number(value) * 60 });
  return (
    <section className="line-card" aria-label={line.name} data-testid="line-card" data-line={line.id} data-model={line.model} data-running={line.forecastCents.running}>
      <h2>
        <span className="swatch" style={{ background: line.colour }} /> {line.name}
      </h2>
      <p>
        {about(line.ridersPerDay)} riders a day · {busCount(line.buses, model.name)}
      </p>
      <label className="model">
        Buses
        <select value={wantedModel ?? line.model} onChange={(e) => setWantedModel(e.target.value === line.model ? null : (e.target.value as BusModelId))}>
          {MODEL_IDS.map((id) => (
            <option key={id} value={id} disabled={BUS_MODELS[id].locked}>
              {BUS_MODELS[id].name} · {BUS_MODELS[id].seats} seats{BUS_MODELS[id].locked ? ' · locked' : ''}
            </option>
          ))}
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
      <div className="headways">
        {PERIODS.map(([period, label]) => (
          <label key={period}>
            {label}
            <select value={next[period] === null ? 'off' : String((next[period] ?? 0) / 60)} onChange={(e) => pick(period, e.target.value)}>
              {period === 'overnight' ? <option value="off">off</option> : null}
              {MINUTES.map((m) => (
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
