import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { BUS_MODELS } from "../../sim/rules/line";
import { closingOf } from "../../sim/rules/route";
import type { StopTier } from "../../sim/rules/stopTier";
import { busCount, usdK } from "../format";
import { runOver } from "../game/runOver";
import { showInBody } from "../showWhole";
import { useFocusBack, type HandBack } from "../focusBack";
import { focusLost } from "../focusLost";
import { useHeldFocus } from "../heldFocus";
import { LineCard, LineHeading } from "../game/LineCard";
import type { Sim } from "../game/useSim";
import { tabTo } from "../tablist";

/** Where the focus goes as the line shown changes under it: the line's tab, or its Buses list when it is the only line. */
const SHOWN = '[role="tab"][aria-selected="true"], [data-testid="line-model"]';

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
  // refusal said the line was gone). A refusal lets it go, so Close it can be pressed again, and so does an undo the sim did
  // after the press: taken back by Ctrl+Z before its answer, the two landing together, the close left the line and its ask,
  // and Close it sent nothing (the systems audit's twentieth round).
  const [sent, setSent] = useState<{ readonly id: number; readonly undos: number } | null>(null);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const lines = sim.snapshot?.lines ?? [];
  const line = lines.find((l) => l.id === lineId) ?? lines[0];
  if (closingId !== null && closingId !== line?.id) setClosingId(null);
  if (sent && (sent.id !== closingId || sim.refusal?.command === "close-line" || sim.undos.done > sent.undos)) setSent(null);
  // The control the keyboard has in this panel (:focus-visible, as the day card's cameFrom), until the focus goes elsewhere or
  // the player presses elsewhere. An undo that brings back the line App still names (Close it, then Ctrl+Z) shows its card in
  // place of the one the focus was in, and the focus fell to the page; among three lines or more it stayed on a tab no longer
  // chosen (the reviews of the hand-back and of #156). It goes to the shown line's tab instead. A control the mouse focused is
  // not held, so after the mouse's Close it the undo leaves the page focused, where Space plays: held, the undo's key handed
  // the tab Space (the review of #156). Only as the line shown changes, so the run's end, which turns controls off, still
  // gives the day card's Continue the focus (DayCard).
  const heldRef = useHeldFocus(panel);
  const shownId = line?.id;
  useEffect(() => {
    const was = heldRef.current;
    if (!was) return;
    const gone = !was.isConnected && focusLost();
    const unchosen = document.activeElement === was && was.getAttribute("role") === "tab" && was.getAttribute("aria-selected") !== "true";
    if (!gone && !unchosen) return;
    heldRef.current = null;
    panel.current?.querySelector<HTMLElement>(SHOWN)?.focus();
  }, [shownId, heldRef]);
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
              {/* What the stops give back is said as every refund is ("$2k back"): "come down for $8k" read as a price (the systems
                  audit's fifteenth round). */}
              {down ? `, and ${down} ${down === 1 ? "stop" : "stops"} no other line uses ${down === 1 ? "comes" : "come"} down for ${usdK(closing.refundCents)} back` : ""}.
            </p>
            <div className="controls">
              <button
                type="button"
                disabled={runOver(sim)}
                onClick={(e) => {
                  if (sent?.id === line.id) return;
                  setSent({ id: line.id, undos: sim.undos.sent });
                  closeHandBack(
                    e.currentTarget,
                    () => panel.current?.querySelector<HTMLElement>(SHOWN) ?? document.querySelector<HTMLElement>('[data-testid="build"]'),
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
