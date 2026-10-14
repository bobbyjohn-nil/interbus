import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

/** A panel on the layer: its id, and what it draws (a `.panel` element). */
export interface PanelItem {
  readonly id: string;
  readonly node: ReactNode;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** The gap between panels, and between a panel and the window's edge, in pixels. */
const GAP = 12;
/** The top of the first row of panels: under the chips. */
const TOP = 56;
/** How far each panel steps down when no row has room. */
const ROW_STEP = 28;
/** How much of a dragged panel stays on screen, so it can always be dragged back. */
const KEEP = 48;

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

/**
 * The free place for a panel `w` by `h` beside those already on screen (`taken`), in a window
 * `width` by `height`: the rightmost spot of the highest row with room, scanning right to left past
 * each panel in the way. Rows start under the chips and just below each panel; with no room in any,
 * it opens at the top right, a step down for each panel open.
 */
export function freePlace(w: number, h: number, taken: readonly Rect[], width: number, height: number): { x: number; y: number } {
  const rows = [...new Set([TOP, ...taken.map((t) => t.y + t.h + GAP)])].filter((y) => y + Math.min(h, 160) <= height - GAP).sort((a, b) => a - b);
  for (const y of rows) {
    let x = width - GAP - w;
    for (let tries = 0; x >= GAP && tries <= taken.length; tries++) {
      const here: Rect = { x, y, w, h };
      const inTheWay = taken.filter((t) => overlaps(here, t));
      if (!inTheWay.length) return { x, y };
      x = Math.min(...inTheWay.map((t) => t.x)) - GAP - w;
    }
  }
  return { x: Math.max(GAP, width - GAP - w), y: TOP + taken.length * ROW_STEP };
}

/**
 * Panels that move and stay open together (D25: "when you open 2 tabs, they conflict and you can't
 * use it, either make it so that the tabs are moveable or make it so that one closes when you open
 * another, preferably the former"). A panel opens in a free place, beside those already open (the
 * first at the top right), and stays there; it is dragged by its heading anywhere on the screen, and
 * opens where it was dragged to for the rest of the session. A press brings it to the front. A
 * tool's card is a panel like the others. Places live on the elements, not in React state, so a drag
 * re-renders nothing.
 */
export function Panels({ items }: { items: readonly PanelItem[] }) {
  const [raised, setRaised] = useState<readonly string[]>([]);
  const boxes = useRef(new Map<string, HTMLDivElement>());
  /** Where each panel was dragged to, kept for the session. */
  const dragged = useRef(new Map<string, { x: number; y: number }>());
  /** The panels placed since they opened; one that closes is placed afresh when it opens again. */
  const placed = useRef(new Set<string>());

  useLayoutEffect(() => {
    const open = new Set(items.map((i) => i.id));
    for (const id of placed.current) if (!open.has(id)) placed.current.delete(id);
    for (const { id } of items) {
      const box = boxes.current.get(id);
      if (!box || placed.current.has(id)) continue;
      const taken = [...placed.current].flatMap((other) => {
        const r = boxes.current.get(other)?.getBoundingClientRect();
        return r ? [{ x: r.left, y: r.top, w: r.width, h: r.height }] : [];
      });
      const at = dragged.current.get(id) ?? freePlace(box.offsetWidth, box.offsetHeight, taken, window.innerWidth, window.innerHeight);
      Object.assign(box.style, { left: `${at.x}px`, top: `${at.y}px` });
      placed.current.add(id);
    }
  });

  const raise = (id: string) => setRaised((r) => (r.at(-1) === id ? r : [...r.filter((x) => x !== id), id]));
  const drag = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    const target = event.target as Element;
    if (event.button !== 0 || !target.closest("h2") || target.closest("button, a, input")) return;
    const box = event.currentTarget;
    const start = box.getBoundingClientRect();
    const [x0, y0] = [event.clientX, event.clientY];
    const place = (cx: number, cy: number) => ({
      x: Math.round(Math.min(window.innerWidth - KEEP, Math.max(KEEP - start.width, start.left + cx - x0))),
      y: Math.round(Math.min(window.innerHeight - KEEP, Math.max(0, start.top + cy - y0))),
    });
    event.preventDefault();
    box.setPointerCapture(event.pointerId);
    box.classList.add("dragging");
    const move = (e: PointerEvent) => {
      const at = place(e.clientX, e.clientY);
      Object.assign(box.style, { left: `${at.x}px`, top: `${at.y}px` });
    };
    const end = (e: PointerEvent) => {
      box.removeEventListener("pointermove", move);
      box.removeEventListener("pointerup", end);
      box.removeEventListener("pointercancel", end);
      box.classList.remove("dragging");
      // A press that did not move is a press, not a drag: the panel keeps a free place next time.
      if (e.clientX !== x0 || e.clientY !== y0) dragged.current.set(id, place(e.clientX, e.clientY));
    };
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerup", end);
    box.addEventListener("pointercancel", end);
  };

  return (
    <>
      {items.map(({ id, node }, k) => {
        const lift = raised.indexOf(id);
        return (
          <div
            key={id}
            className="movable"
            data-movable={id}
            ref={(el) => {
              if (el) boxes.current.set(id, el);
              else boxes.current.delete(id);
            }}
            style={{ zIndex: 10 + (lift >= 0 ? items.length + lift : k) }}
            onPointerDownCapture={() => raise(id)}
            onPointerDown={(e) => drag(e, id)}
          >
            {node}
          </div>
        );
      })}
    </>
  );
}
