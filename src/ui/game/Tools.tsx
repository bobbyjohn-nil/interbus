import { BUS_MODELS, MODEL_IDS } from "../../sim/rules/line";
import { isExpress } from "../../sim/rules/express";
import { modelLocked, NO_MEDALS } from "../../sim/rules/medal";
import type { BusModelId } from "../../sim/types";
import { refusalText } from "../copy";
import { about, busCount, every, km, usdK } from "../format";
import type { Sim } from "./useSim";

/** The Build menu's tools (D25): a stop on its own, a line, a depot; and the route editor, opened from a line. */
export type Tool = "none" | "stop" | "line" | "depot" | "route";

/** Founding headways (sim/config/lines.ts): the draft is priced at these until the headway card changes them. */
const DRAFT_HEADWAY_SECONDS = 1_200;

/** The depot rule's verdict beside the pointer: "Industrial land ✓ · street 120 m away ✓ · $150k", or why not (GD-05). */
export function DepotCard({
  sim,
  screen,
}: {
  sim: Sim;
  screen: [number, number] | null;
}) {
  const verdict = sim.depotSite;
  if (!verdict || !screen) return null;
  const { site } = verdict;
  return (
    <div
      className="probe-card"
      style={{ left: screen[0] + 14, top: screen[1] + 14 }}
      data-testid="depot-card"
      data-ok={site.ok ? "yes" : "no"}
      data-at={verdict.at.join(",")}
    >
      {site.ok
        ? `Industrial land ✓ · street ${site.streetM} m away ✓ · ${usdK(site.priceCents)}`
        : refusalText(site)}
    </div>
  );
}

/** Place stop's verdict beside the pointer (D25): "A Sign here · street 20 m away · $4k", or why not, as the command checks it (GD-05). */
export function StopSiteCard({ sim, screen }: { sim: Sim; screen: [number, number] | null }) {
  const verdict = sim.stopSite;
  if (!verdict || !screen) return null;
  const { site } = verdict;
  return (
    <div
      className="probe-card"
      style={{ left: screen[0] + 14, top: screen[1] + 14 }}
      data-testid="stop-site-card"
      data-ok={site.ok ? "yes" : "no"}
      data-at={site.ok ? site.at.join(",") : ""}
    >
      {site.ok
        ? `A Sign here · street ${site.streetM} m away · ${usdK(site.priceCents)}`
        : site.reason === "stop_near" && site.stopId !== undefined
          ? `Stop ${site.stopId} stands within ${site.limitM ?? 250} m: a line can use it`
          : refusalText(site)}
    </div>
  );
}

/**
 * The line tool's card (the M2 spec, item 3): the stops so far, km, people within a walk, the model,
 * the buses it needs and the price, then Create. A line's stops are changed in its route editor
 * (D25; RouteEditor.tsx), which took over Extend and Insert.
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
  const title = "New line";
  return (
    <section
      className="panel tool-card"
      aria-label={title}
      data-testid="draft-card"
      data-chrome="panel"
      data-price={draft?.priceCents ?? ""}
      data-refusal={refused?.reason ?? ""}
    >
      <h2>{title}</h2>
      <label className="model">
          Buses
          <select
            value={model}
            onChange={(e) => onModel(e.target.value as BusModelId)}
          >
            {MODEL_IDS.map((id) => {
              const locked = modelLocked(
                BUS_MODELS[id],
                sim.snapshot?.medals ?? NO_MEDALS,
              );
              return (
                <option key={id} value={id} disabled={locked}>
                  {BUS_MODELS[id].name} · {BUS_MODELS[id].seats} seats ·{" "}
                  {usdK(BUS_MODELS[id].priceCents)}
                  {locked ? " · locked" : ""}
                </option>
              );
            })}
          </select>
      </label>
      {!draft ? (
        <p className="hint">Click the map to place stops, or click a stop to use it.</p>
      ) : (
        <>
          <p>
            {draft.stops.length} {draft.stops.length === 1 ? "stop" : "stops"} ·{" "}
            {km(draft.routeM)}
            {isExpress(draft.routeM, draft.stops.length) ? (
              <span className="express" data-testid="express">
                {" "}
                · Express
              </span>
            ) : null}
          </p>
          <p>{about(draft.people)} people within a walk</p>
          {draft.buses > 0 ? (
            <p>
              Running {every(DRAFT_HEADWAY_SECONDS)} needs{" "}
              {busCount(draft.buses, BUS_MODELS[model].name)} ·{" "}
              {usdK(draft.busesCents)}
            </p>
          ) : null}
          {draft.newStops > 0 ? (
            <p>
              {draft.newStops} new {draft.newStops === 1 ? "stop" : "stops"} ·{" "}
              {usdK(draft.stopsCents)}
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
        <button
          type="button"
          onClick={onCreate}
          disabled={!draft || refused !== null}
        >
          Create
        </button>
        <button type="button" onClick={onUndo} disabled={!clicks}>
          Remove last stop
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
