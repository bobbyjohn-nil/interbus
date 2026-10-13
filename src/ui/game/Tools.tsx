import { BUS_MODELS, MODEL_IDS } from '../../sim/rules/line';
import type { BusModelId } from '../../sim/types';
import { refusalText } from '../copy';
import { about, busCount, every, km, usdK } from '../format';
import type { Sim } from './useSim';

export type Tool = 'none' | 'depot' | 'line';

/** Founding headways (sim/config/lines.ts): the draft is priced at these until the headway card changes them. */
const DRAFT_HEADWAY_SECONDS = 1_200;

/** The depot rule's verdict beside the pointer: "Industrial ✓ · street 120 m ✓ · $150k", or why not (GD-05). */
export function DepotCard({ sim, screen }: { sim: Sim; screen: [number, number] | null }) {
  const verdict = sim.depotSite;
  if (!verdict || !screen) return null;
  const { site } = verdict;
  return (
    <div className="probe-card" style={{ left: screen[0] + 14, top: screen[1] + 14 }} data-testid="depot-card" data-ok={site.ok ? 'yes' : 'no'} data-at={verdict.at.join(',')}>
      {site.ok ? `Industrial ✓ · street ${site.streetM} m ✓ · ${usdK(site.priceCents)}` : refusalText(site)}
    </div>
  );
}

/**
 * The line tool's card (the M2 spec, item 3): the stops so far, km, people within a walk, the model,
 * the buses it needs and the price, then Create.
 */
export function DraftCard({
  sim,
  clicks,
  model,
  onModel,
  onCreate,
  onUndo,
  onCancel,
}: {
  sim: Sim;
  clicks: number;
  model: BusModelId;
  onModel: (model: BusModelId) => void;
  onCreate: () => void;
  onUndo: () => void;
  onCancel: () => void;
}) {
  const draft = clicks ? sim.draft : null;
  const refused = draft?.refusal ?? null;
  return (
    <section className="panel tool-card" aria-label="New line" data-testid="draft-card" data-chrome="panel" data-price={draft?.priceCents ?? ''} data-refusal={refused?.reason ?? ''}>
      <h2>New line</h2>
      <label className="model">
        Buses
        <select value={model} onChange={(e) => onModel(e.target.value as BusModelId)}>
          {MODEL_IDS.map((id) => (
            <option key={id} value={id} disabled={BUS_MODELS[id].locked}>
              {BUS_MODELS[id].name} · {BUS_MODELS[id].seats} seats · {usdK(BUS_MODELS[id].priceCents)}
              {BUS_MODELS[id].locked ? ' · locked' : ''}
            </option>
          ))}
        </select>
      </label>
      {!draft ? (
        <p className="hint">Click the map to place stops.</p>
      ) : (
        <>
          <p>
            {draft.stops.length} {draft.stops.length === 1 ? 'stop' : 'stops'} · {km(draft.routeM)}
          </p>
          <p>{about(draft.people)} people within a walk</p>
          {draft.buses > 0 ? (
            <p>
              {every(DRAFT_HEADWAY_SECONDS)} needs {busCount(draft.buses, BUS_MODELS[model].name)} · {usdK(draft.busesCents)}
            </p>
          ) : null}
          {draft.newStops > 0 ? (
            <p>
              {draft.newStops} new {draft.newStops === 1 ? 'stop' : 'stops'} · {usdK(draft.stopsCents)}
            </p>
          ) : null}
          <p className="total">Total {usdK(draft.priceCents)}</p>
          {refused ? (
            <p className="refusal" role="status">
              {refusalText(refused)}
            </p>
          ) : null}
        </>
      )}
      <div className="controls">
        <button type="button" onClick={onCreate} disabled={!draft || refused !== null}>
          Create
        </button>
        <button type="button" onClick={onUndo} disabled={!clicks}>
          Undo stop
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
