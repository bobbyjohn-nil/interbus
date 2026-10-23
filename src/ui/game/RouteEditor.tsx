import { useLayoutEffect, useRef, useState } from "react";
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
  /** While a Save route is on its way: the line's stops as it was pressed, how many Save routes the sim had refused by then, and how many undos the page had sent (Sim's undos.sent). */
  readonly saved: { readonly stops: string; readonly refusals: number; readonly undos: number } | null;
}

/** Save route pressed: the editor with its save on its way, or null while one already is (a double-click's second press sends nothing). */
export function pressSave(routing: Routing, line: LineView, refusals: number, undos: Sim["undos"]): Routing | null {
  return routing.saved === null ? { ...routing, saved: { stops: line.stopIds.join(","), refusals, undos: undos.sent } } : null;
}

/** Whether the save on its way has landed: the line's stops are no longer those it was pressed on, so App closes the editor and shows the line. */
export function saveLanded(routing: Routing, line: LineView): boolean {
  return routing.saved !== null && line.stopIds.join(",") !== routing.saved.stops;
}

/**
 * The editor as the game changes under it, so its card stays the route rule's verdict on the line as it
 * stands (GD-05). A save on its way waits until it lands (saveLanded, and App closes the editor) or the
 * sim refuses it (`refusals` passes the count at the press): a refresh of the lines that is not its
 * answer, such as the day's close retiming them, leaves it waiting, as does an undo not yet answered.
 * An undo sent after the press that the sim did lets it go (Sim's undos.done, the newest undo done by its
 * place among those sent, passes the count sent at the press), as it lets Create go (createWaits,
 * Tools.tsx): a save and its undo answered in one render leave the line's stops as they were, so the list
 * keeps the player's changes and Save route opens again. An undo refused, as every undo is while time
 * runs, lets nothing go, and the save lands as ever.
 * Otherwise the list follows the line: as opened, it is the line again; as edited, it keeps the
 * player's changes less a stop taken off the line or taken down, and a stop put back on the line goes
 * back in after the stop it follows there. `routing` itself while nothing changed.
 */
export function followed(routing: Routing, line: LineView, game: { readonly stops: readonly { readonly id: number }[] }, refusals: number, undos: Sim["undos"]): Routing {
  const { points, base, saved } = routing;
  if (saved !== null) return refusals > saved.refusals || undos.done > saved.undos ? { ...routing, saved: null } : routing;
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

/**
 * Each row's key, which a move keeps (the systems audit): its stop, or its click for a new one, and how many
 * rows above it are the same, as a loop line lists a stop twice. Keyed by its place, a moved row and the
 * one it passed were drawn afresh, the arrow pressed went with them, and the next Space played the game.
 */
export function rowKeys(points: readonly RoutePoint[]): string[] {
  const seen = new Map<string, number>();
  return points.map((p) => {
    const id = p.stopId === null ? p.at.join(",") : `stop ${p.stopId}`;
    const n = seen.get(id) ?? 0;
    seen.set(id, n + 1);
    return `${id}#${n}`;
  });
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
  // A stop moved with its arrow keeps the focus there, so Space or Enter moves it again: on the same
  // arrow, or on its other one at the top or the bottom of the list, where that arrow shuts. A held key
  // moves it once: the page drops a held Enter's repeats on a control (onePress.ts). A stop taken off with its × hands the focus
  // to the × of the stop that takes its row, or of the row above at the list's end: the focus went with its row, and the next
  // Space ran time behind the editor (round 10; DECISIONS, 2026-10-15, had left it).
  const list = useRef<HTMLOListElement>(null);
  const refocus = useRef<{ readonly at: number; readonly up: boolean } | { readonly at: number; readonly removed: true } | null>(null);
  useLayoutEffect(() => {
    const r = refocus.current;
    refocus.current = null;
    if (!r) return;
    if ("removed" in r) {
      const rows = list.current?.children;
      rows?.[Math.min(r.at, rows.length - 1)]?.querySelector<HTMLButtonElement>('button[aria-label^="Remove"]')?.focus();
      return;
    }
    const arrows = list.current?.children[r.at]?.querySelectorAll("button");
    const [same, other] = r.up ? [arrows?.[0], arrows?.[1]] : [arrows?.[1], arrows?.[0]];
    (same?.disabled ? other : same)?.focus();
  }, [points]);
  const move = (from: number, to: number, arrow: HTMLButtonElement) => {
    if (document.activeElement === arrow) refocus.current = { at: to, up: to < from };
    onPoints(moved(points, from, to));
  };
  const keys = rowKeys(points);
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
      <ol className="route-stops" ref={list}>
        {points.map((p, k) => {
          const label = name(p, k);
          return (
            <li
              key={keys[k]}
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
              <button type="button" aria-label={`Move ${label} up`} disabled={k === 0} onClick={(e) => move(k, k - 1, e.currentTarget)}>
                ↑
              </button>
              <button type="button" aria-label={`Move ${label} down`} disabled={k === points.length - 1} onClick={(e) => move(k, k + 1, e.currentTarget)}>
                ↓
              </button>
              <button
                type="button"
                aria-label={`Remove ${label}`}
                onClick={(e) => {
                  if (document.activeElement === e.currentTarget) refocus.current = { at: k, removed: true };
                  onPoints(points.filter((_, j) => j !== k));
                }}
              >
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
