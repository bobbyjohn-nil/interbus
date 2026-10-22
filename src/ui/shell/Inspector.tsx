import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { BUS_MODELS } from "../../sim/rules/line";
import { closingOf } from "../../sim/rules/route";
import type { StopTier } from "../../sim/rules/stopTier";
import { busCount, usdK } from "../format";
import { runOver } from "../game/runOver";
import { showInBody } from "../showWhole";
import { useFocusBack, type HandBack } from "../focusBack";
import { LineCard, LineHeading } from "../game/LineCard";
import type { Sim } from "../game/useSim";
import { tabTo } from "../tablist";

/**
 * The line inspector (the M2 spec, item 7): one line's card and its headways. Its money and its fare
 * are in Finance's Lines, and its stops are changed in its route editor (D25: "the menu where you see
 * lines should only have information about the line, no finances or route editing there"), each a
 * button away. The line's heading comes first and its tabs under it, so the heading the panel is dragged by
 * stays at its top however many lines there are (the systems audit's third round: ten lines' tabs put it 138 px down).
 */
export function Inspector({
  sim,
  lineId,
  onLine,
  onEditRoute,
  onFinance,
  onClose,
  closeHandBack,
  onStop,
}: {
  sim: Sim;
  lineId: number | null;
  onLine: (id: number) => void;
  /** Opens the line's route editor (D25). */
  onEditRoute: (lineId: number) => void;
  /** Opens Finance's Lines on this line. */
  onFinance: (lineId: number) => void;
  onClose: () => void;
  /** Hands Close it's focus on as its line goes: held by App, as Lines closes with the last line (useFocusBack). */
  closeHandBack: HandBack;
  /** Opens a stop's card, from the line card's stops: `from` is the stop's button. */
  onStop: (stopId: number, from: HTMLElement) => void;
}) {
  // The line whose Close line was pressed, asking to confirm. Another line shown lets the ask go, so it never comes back by
  // itself: not on a tab chosen again, nor on a line created later under the id an undo freed (the review of the change).
  const [closingId, setClosingId] = useState<number | null>(null);
  // The ask opens under the controls, below the panel's foot when the panel is low or the line's card long, so it is scrolled
  // into view, as the line card's change cards are (#140).
  const closeCard = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => showInBody(closeCard.current), [closingId]);
  // The ask's buttons go with it, so the focus goes on: Keep it's to Close line, and Close it's, once its line has gone, to the
  // line shown in its place, or to Build once none is left (useFocusBack; App holds that one). Close it keeps the ask until
  // then, or the focus would go to a line about to go.
  const handBack = useFocusBack();
  // The line Close it was pressed for, while its ask stays: one press, one command (D26), so a second press before the line
  // goes sends nothing, as a Create on its way waits (the review of the hand-back: two Enters sent two, and the second's
  // refusal said the line was gone). A refusal lets it go, so Close it can be pressed again.
  const [sentId, setSentId] = useState<number | null>(null);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const lines = sim.snapshot?.lines ?? [];
  const line = lines.find((l) => l.id === lineId) ?? lines[0];
  if (closingId !== null && closingId !== line?.id) setClosingId(null);
  if (sentId !== null && (sentId !== closingId || sim.refusal?.command === "close-line")) setSentId(null);
  if (!line) return null;
  const model = BUS_MODELS[line.model];
  // What closing it sells and takes down, on the rule the command checks (sim/rules/route.ts closingOf; GD-05).
  const closing =
    closingId === line.id
      ? closingOf(
          { buses: line.buses, model, stopIds: line.stopIds },
          (sim.snapshot?.stops ?? []).map((s) => ({ id: s.id, tier: s.tier as StopTier, linesHere: s.lineIds.length })),
        )
      : null;
  const down = closing?.removed.length ?? 0;
  // WAI-ARIA's tabs: the arrow keys move along the tabs, wrapping, and Home and End go to the first and last, each tab chosen as
  // the focus reaches it; only the chosen tab is in the Tab order, so one Tab goes on to the card. Before, the arrows did
  // nothing, and 30 lines took 30 presses of Tab to reach the card (the systems audit's seventh round).
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = tabTo(event.key, lines.map((l) => l.id), line.id);
    if (next === undefined) return;
    event.preventDefault();
    onLine(next);
    event.currentTarget.querySelector<HTMLElement>(`[data-line="${next}"]`)?.focus();
  };
  return (
    <aside
      ref={panel}
      className="panel inspector"
      aria-label="Lines"
      data-testid="inspector"
      data-chrome="panel"
    >
      <button
        type="button"
        className="close"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      <LineHeading line={line} />
      {/* The body scrolls under the heading and Close, so they stay in reach however far it goes. */}
      <div className="panel-body" data-testid="inspector-body">
        {lines.length > 1 ? (
          <div
            className="tabs"
            role="tablist"
            aria-label="Lines"
            onKeyDown={onTabKey}
          >
            {lines.map((l) => (
              <button
                key={l.id}
                type="button"
                role="tab"
                aria-selected={l.id === line.id}
                tabIndex={l.id === line.id ? 0 : -1}
                data-line={l.id}
                onClick={() => onLine(l.id)}
              >
                <span className="swatch" style={{ background: l.colour }} />{" "}
                {l.name}
              </button>
            ))}
          </div>
        ) : null}
        <LineCard
          key={line.id}
          sim={sim}
          line={line}
          onFinance={() => onFinance(line.id)}
          onStop={onStop}
        />
        <div className="controls">
          <button type="button" disabled={runOver(sim)} onClick={() => onEditRoute(line.id)}>
            Edit route
          </button>
          <button ref={closeButton} type="button" disabled={runOver(sim)} aria-expanded={closing !== null} onClick={() => setClosingId(closing ? null : line.id)}>
            Close line
          </button>
        </div>
        {closing ? (
          <div className="change" ref={closeCard} data-testid="close-line">
            <p>
              Close {line.name}? {line.buses === 1 ? `Its ${model.name} sells` : `Its ${busCount(line.buses, model.name)} sell`} for {usdK(closing.saleCents)}
              {down ? `, and ${down} ${down === 1 ? "stop" : "stops"} no other line uses ${down === 1 ? "comes" : "come"} down for ${usdK(closing.refundCents)}` : ""}.
            </p>
            <div className="controls">
              <button
                type="button"
                disabled={runOver(sim)}
                onClick={(e) => {
                  if (sentId === line.id) return;
                  setSentId(line.id);
                  closeHandBack(
                    e.currentTarget,
                    () =>
                      panel.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"], [data-testid="line-model"]') ??
                      document.querySelector<HTMLElement>('[data-testid="build"]'),
                  );
                  sim.send({ type: "close-line", lineId: line.id });
                }}
              >
                Close it
              </button>
              <button
                type="button"
                onClick={(e) => {
                  handBack(e.currentTarget, () => closeButton.current);
                  setClosingId(null);
                }}
              >
                Keep it
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
