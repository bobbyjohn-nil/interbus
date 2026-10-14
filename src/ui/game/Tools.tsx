import { BUS_MODELS, MODEL_IDS } from "../../sim/rules/line";
import { isExpress } from "../../sim/rules/express";
import { modelLocked, NO_MEDALS } from "../../sim/rules/medal";
import type { BusModelId, LineDraftView } from "../../sim/types";
import { refusalText } from "../copy";
import { Dropdown } from "../Dropdown";
import { about, busCount, every, km, usdK } from "../format";
import { useBesidePointer } from "./besidePointer";
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
  const card = useBesidePointer(screen, screen && verdict);
  if (!verdict || !screen) return null;
  const { site } = verdict;
  return (
    <div
      ref={card}
      className="probe-card"
      data-testid="depot-card"
      data-ok={site.ok ? "yes" : "no"}
      data-at={verdict.at.join(",")}
    >
      {site.ok
        ? `Industrial land ✓ · street ${site.streetM} m away ✓ · ${usdK(site.priceCents)}`
        : site.priceCents !== undefined
          ? `${usdK(site.priceCents)} · ${refusalText(site)}` // the price beside the shortfall, as the draft card shows its total
          : refusalText(site)}
    </div>
  );
}

/** Place stop's verdict beside the pointer (D25): "A Sign here · street 20 m away · $4k", or why not, as the command checks it (GD-05). */
export function StopSiteCard({ sim, screen }: { sim: Sim; screen: [number, number] | null }) {
  const verdict = sim.stopSite;
  const card = useBesidePointer(screen, screen && verdict);
  if (!verdict || !screen) return null;
  const { site } = verdict;
  return (
    <div
      ref={card}
      className="probe-card"
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
 * A new line's clicks as its card shows them (the systems audit): the line rule reads no click after one
 * it refuses (sim/rules/line.ts), so `kept` are the clicks that became stops, and `shown` adds the refused
 * click while the card names it. The next click goes after the kept ones, in the refused one's place, and
 * Remove last stop leaves one fewer than shown, so it never takes off a click the card does not show.
 * `draft` is the rule's answer to these very clicks, or null while that is on its way.
 */
export function draftShows(clicks: number, draft: LineDraftView | null): { readonly kept: number; readonly shown: number } {
  const kept = draft ? Math.min(draft.stops.length, clicks) : clicks;
  return { kept, shown: kept < clicks && draft?.refusal?.at === kept ? kept + 1 : kept };
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
      <div className="model">
        <span>Buses</span>
        <Dropdown
          label="Buses"
          testId="draft-model"
          value={model}
          options={MODEL_IDS.map((id) => {
            const locked = modelLocked(BUS_MODELS[id], sim.snapshot?.medals ?? NO_MEDALS);
            return {
              value: id,
              label: `${BUS_MODELS[id].name} · ${BUS_MODELS[id].seats} seats · ${usdK(BUS_MODELS[id].priceCents)}${locked ? " · locked" : ""}`,
              disabled: locked,
              ...(locked ? { hint: "A silver medal unlocks it" } : {}),
            };
          })}
          onChange={(id: BusModelId) => onModel(id)}
        />
      </div>
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
