import { useState } from "react";
import { BUS_MODELS } from "../../sim/rules/line";
import { isExpress } from "../../sim/rules/express";
import type { LineView, LngLatPair } from "../../sim/types";
import { refusalText } from "../copy";
import { about, km, moreBuses, usdK } from "../format";
import type { Sim } from "./useSim";

/** A stop on the route being edited: a stop standing (its id), or a click for a new one. */
export interface RoutePoint {
  readonly at: LngLatPair;
  readonly stopId: number | null;
}

/** The line's own stops, in running order, as the editor starts from them. */
export function routeOf(line: LineView): RoutePoint[] {
  return line.stopIds.map((stopId, k) => ({ at: line.stops[k]!, stopId }));
}

/** The route editor as App keeps it: its line, the stops as edited, and a Save route on its way. */
export interface Routing {
  readonly lineId: number;
  readonly points: RoutePoint[];
  /** The line's stops as the list last followed them: as the editor opened, then as the game changed them. */
  readonly base: readonly number[];
  /** While a Save route is on its way: the line's stops as it was pressed, and how many Save routes the sim had refused by then. */
  readonly saved: { readonly stops: string; readonly refusals: number } | null;
}

/** Save route pressed: the editor with its save on its way, or null while one already is (a double-click's second press sends nothing). */
export function pressSave(routing: Routing, line: LineView, refusals: number): Routing | null {
  return routing.saved === null ? { ...routing, saved: { stops: line.stopIds.join(","), refusals } } : null;
}

/**
 * The editor as the game changes under it, so its card stays the route rule's verdict on the line as it
 * stands (GD-05). A save on its way waits until the line's stops change (it landed, and App closes the
 * editor) or the sim refuses it (`refusals` passes the count at the press): a refresh of the lines that
 * is not its answer, such as the day's close retiming them, leaves it waiting.
 * Otherwise the list follows the line: as opened, it is the line again; as edited, it keeps the
 * player's changes less a stop taken off the line or taken down, and a stop put back on the line goes
 * back in after the stop it follows there. `routing` itself while nothing changed.
 */
export function followed(routing: Routing, line: LineView, game: { readonly stops: readonly { readonly id: number }[] }, refusals: number): Routing {
  const { points, base, saved } = routing;
  if (saved !== null) return refusals > saved.refusals ? { ...routing, saved: null } : routing;
  const ids = line.stopIds;
  const changed = base.length !== ids.length || base.some((id, k) => id !== ids[k]);
  if (changed && points.length === base.length && points.every((p, k) => p.stopId === base[k])) return { ...routing, points: routeOf(line), base: ids };
  // A click for a new stop stays, as does a stop on the line, or one of another line the player added while it stands.
  const keeps = (id: number | null) => id === null || ids.includes(id) || (!base.includes(id) && game.stops.some((s) => s.id === id));
  const next = points.filter((p) => keeps(p.stopId));
  ids.forEach((id, k) => {
    if (base.includes(id) || next.some((p) => p.stopId === id)) return;
    let at = 0;
    for (let j = k - 1; j >= 0 && at === 0; j--) at = next.findIndex((p) => p.stopId === ids[j]) + 1;
    next.splice(at, 0, { at: line.stops[k]!, stopId: id });
  });
  if (!changed && next.length === points.length) return routing;
  return { ...routing, points: next, base: ids };
}

/** `points` with the stop at `from` moved to `to`. */
export function moved<T>(points: readonly T[], from: number, to: number): T[] {
  const next = [...points];
  const [p] = next.splice(from, 1);
  next.splice(to, 0, p!);
  return next;
}

/**
 * Edit route (D25: "route editing should be a button you press where it then brings you to an
 * expanded menu there you can reorder, add, and remove stops something akin to google maps trip
 * planner"): the line's stops as a list, each dragged or moved up and down to reorder it and taken off
 * with ×; a click on the map adds a stop at the end, joining a stop standing there. The card under the
 * list is the route rule's verdict on the whole line (sim/rules/route.ts checkRoute, GD-05): its
 * length and how much that changes, the new stops and any bus its longer round trip needs, and the stops it leaves alone, which
 * come down for half their cost; then Save route, one command and one undo.
 */
export function RouteEditor({
  sim,
  line,
  points,
  saving = false,
  onPoints,
  onSave,
  onCancel,
}: {
  sim: Sim;
  line: LineView;
  points: readonly RoutePoint[];
  /** True while a Save route is on its way: a press then does nothing, so the button is disabled. */
  saving?: boolean;
  onPoints: (points: RoutePoint[]) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [dragging, setDragging] = useState<number | null>(null);
  const draft = sim.draft;
  const refused = draft?.refusal ?? null;
  const unchanged = refused?.reason === "no_change";
  const name = (p: RoutePoint, k: number) => {
    const id = p.stopId ?? draft?.stops[k]?.joins ?? null;
    return id === null ? "New stop" : `Stop ${id}`;
  };
  const removed = draft?.edit?.removed ?? [];
  // How much longer or shorter the route drives than it does now, in place of Insert's detour warning.
  const longer = draft ? draft.routeM - (line.stopDistM.at(-1) ?? 0) : 0;
  const net = draft ? draft.priceCents - (draft.edit?.refundCents ?? 0) : 0;
  return (
    <section
      className="panel tool-card route-editor"
      aria-label={`Edit ${line.name}’s route`}
      data-testid="route-editor"
      data-chrome="panel"
      data-price={draft?.priceCents ?? ""}
      data-refund={draft?.edit?.refundCents ?? ""}
      data-refusal={refused?.reason ?? ""}
    >
      <h2>
        <span className="swatch" style={{ background: line.colour }} /> {line.name}’s route
      </h2>
      <p className="hint">Drag stops to reorder them. Click the map to add a stop at the end.</p>
      <ol className="route-stops">
        {points.map((p, k) => {
          const label = name(p, k);
          return (
            <li
              key={`${k}:${p.at.join(",")}`}
              draggable
              className={dragging === k ? "dragging" : undefined}
              data-testid={`route-stop-${k}`}
              data-stop={p.stopId ?? draft?.stops[k]?.joins ?? ""}
              onDragStart={(e) => {
                setDragging(k);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (dragging !== null && dragging !== k) onPoints(moved(points, dragging, k));
                setDragging(null);
              }}
              onDragEnd={() => setDragging(null)}
            >
              <span className="grip" aria-hidden="true" />
              <span className="name">{label}</span>
              <button type="button" aria-label={`Move ${label} up`} disabled={k === 0} onClick={() => onPoints(moved(points, k, k - 1))}>
                ↑
              </button>
              <button type="button" aria-label={`Move ${label} down`} disabled={k === points.length - 1} onClick={() => onPoints(moved(points, k, k + 1))}>
                ↓
              </button>
              <button type="button" aria-label={`Remove ${label}`} onClick={() => onPoints(points.filter((_, j) => j !== k))}>
                ×
              </button>
            </li>
          );
        })}
      </ol>
      {draft ? (
        <>
          <p>
            {draft.stops.length} {draft.stops.length === 1 ? "stop" : "stops"} · {km(draft.routeM)}
            {Math.abs(longer) >= 50 ? ` (${longer > 0 ? "+" : "−"}${km(Math.abs(longer))})` : ""}
            {isExpress(draft.routeM, draft.stops.length) ? " · Express" : ""} · {about(draft.people)} people within a walk
          </p>
          {draft.newStops > 0 ? (
            <p>
              {draft.newStops} new {draft.newStops === 1 ? "stop" : "stops"} · {usdK(draft.stopsCents)}
            </p>
          ) : null}
          {draft.buses > 0 ? (
            <p>
              {moreBuses(draft.buses, BUS_MODELS[line.model].name)} for its longer round trip · {usdK(draft.busesCents)}
            </p>
          ) : null}
          {removed.length ? (
            <p data-testid="route-removed">
              {removed.map((id) => `Stop ${id}`).join(", ")} {removed.length === 1 ? "comes" : "come"} down · {usdK(draft.edit?.refundCents ?? 0)} back
            </p>
          ) : null}
          {!unchanged ? <p className="total">{net < 0 ? `Total ${usdK(-net)} back` : `Total ${usdK(net)}`}</p> : null}
          {refused && !unchanged ? (
            <p className="refusal" role="status">
              {refusalText(refused)}
            </p>
          ) : null}
        </>
      ) : null}
      <div className="controls">
        <button type="button" onClick={onSave} disabled={!draft || refused !== null || saving}>
          Save route
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
