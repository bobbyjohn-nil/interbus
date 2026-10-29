import { useId, useLayoutEffect, useRef } from "react";
import { BUS_MODELS, MODEL_IDS } from "../../sim/rules/line";
import { isExpress } from "../../sim/rules/express";
import { modelLocked, NO_MEDALS } from "../../sim/rules/medal";
import type { BusModelId, LineDraftView } from "../../sim/types";
import { refusalText } from "../copy";
import { Dropdown } from "../Dropdown";
import { focusLost } from "../focusLost";
import { useHeldFocus } from "../heldFocus";
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
 * A Create on its way, as App keeps it: how many Creates the sim had refused and how many undos the page
 * had sent as it was pressed, and the game it was pressed in (its loaded.at).
 */
export interface CreatePress {
  readonly refusals: number;
  readonly undos: number;
  readonly loadedAt: number | null;
}

/** What createWaits reads of the game now: the tool out, the same counts as CreatePress, and the newest undo the sim did, by its place among those sent (Sim's undos.done). */
export interface CreateNow extends CreatePress {
  readonly tool: Tool;
  readonly undone: number;
}

/**
 * Whether a Create on its way still waits (one press, one command, as Save route's pressSave): until the
 * sim refuses a Create, or its line lands and the card closes with the tool, a second press sends nothing.
 * Its line landing does not let it go by itself: App closes the card a render later, and let go as the line
 * stood, Create was on again under the keyboard for that render, so a second Enter, or Space's keyup, bought
 * a second line, 2 times in 123 on the pacing run's late company (the review of the systems audit's
 * nineteenth round). A refresh of the lines, such as the day's close or roadworks retiming them, leaves it
 * waiting. It never outlasts the tool, the game it was pressed in or an undo sent after it that the sim did:
 * a Create and an Undo answered together leave no line, and Create opens again. An undo not yet answered,
 * or refused, as every undo is while time runs, lets nothing go, so a second press meanwhile still buys no
 * second line.
 */
export function createWaits(press: CreatePress, now: CreateNow): boolean {
  return now.tool === "line" && now.loadedAt === press.loadedAt && now.undone <= press.undos && now.refusals <= press.refusals;
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
  creating = false,
  onModel,
  onCreate,
  onUndo,
  onCancel,
}: {
  sim: Sim;
  clicks: number;
  model: BusModelId;
  /**
   * True while a Create is on its way (createWaits): a press then does nothing, and the button keeps the focus, aria-disabled,
   * as Save route does. Disabled, it gave the page the focus as it went off, and on again, as Ctrl+Z took back what came
   * before it or the sim turned it down, it took none back, so Space played, and Continue gave Build the focus (the systems
   * audit's nineteenth round).
   */
  creating?: boolean;
  onModel: (model: BusModelId) => void;
  onCreate: () => void;
  onUndo: () => void;
  onCancel: () => void;
}) {
  const draft = clicks ? sim.draft : null;
  const refused = draft?.refusal ?? null;
  const title = "New line";
  // Refused, Create keeps the focus, described by the words why, which are a status from the card's first render, and a press
  // does nothing (as a line card's Buy and run): disabled, a close that left the cash short under the keyboard dropped the
  // focus to the page, where Space paused the game with the day's card up (the systems audit's seventeenth round).
  const said = useId();
  // Remove last stop turns itself off as it takes the line's only stop, and Create with it, by a press or by Backspace, Help's
  // key for it: the focus on either fell to the page, where Space played (the systems audit's seventeenth round, and its review
  // for Backspace). The control the keyboard has in the card (useHeldFocus) goes on to Cancel, whatever took the stop.
  const card = useRef<HTMLElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const heldRef = useHeldFocus(card);
  useLayoutEffect(() => {
    if (clicks || !heldRef.current || !focusLost()) return;
    heldRef.current = null;
    cancel.current?.focus();
  });
  return (
    <section
      ref={card}
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
        </>
      )}
      <p id={said} className="refusal" role="status">
        {refused ? refusalText(refused) : null}
      </p>
      <div className="controls">
        <button
          type="button"
          onClick={() => {
            if (!refused && !creating) onCreate();
          }}
          disabled={!draft}
          aria-disabled={refused || creating ? true : undefined}
          aria-describedby={said}
        >
          Create
        </button>
        <button
          type="button"
          onClick={onUndo}
          disabled={!clicks}
        >
          Remove last stop
        </button>
        <button type="button" ref={cancel} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}
