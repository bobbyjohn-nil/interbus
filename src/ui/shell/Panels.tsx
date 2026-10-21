import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";

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
/** The room left at the window's bottom for the dock and the map's credit (app.css's 100vh - 128px is TOP and this; the day card's 100% - 156px counts it too). */
const BOTTOM = 72;
/** The least room a panel is given below its top: a row with less room down to the dock is not free. */
const MIN_ROOM = 160;
/** How far each panel steps down when no row has room. */
const ROW_STEP = 28;
/** How much of a dragged panel's width stays on screen, and so of its heading, which spans it: enough to drag it back by. */
const KEEP = 48;

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;

/**
 * How tall a panel with its top at `y` may be, on a window `height` tall: the room down to the dock,
 * or MIN_ROOM where a drag took it lower. Longer content scrolls inside it, so a panel in a free
 * place never runs over the dock or the map's credit, however much it grows after it opens.
 */
export const roomBelow = (y: number, height: number) => Math.max(MIN_ROOM, height - BOTTOM - y);

/**
 * A panel `w` wide at `at`, moved as little as keeps KEEP pixels of its width on a window `width` by `height`, and its top
 * MIN_ROOM or more above the dock, which draws over the panels (app.css's layers): a drag's rule, and a dragged panel's when
 * the window changes size. As short as roomBelow makes it there, the panel ends above the dock and the map's credit, whole,
 * its heading (its first row) in reach (the systems audit's third round: with its top at 600 px of 720 it ran 40 px off the window).
 */
export const inReach = (at: { x: number; y: number }, w: number, width: number, height: number) => ({
  x: Math.round(Math.min(width - KEEP, Math.max(KEEP - w, at.x))),
  y: Math.round(Math.max(0, Math.min(height - BOTTOM - MIN_ROOM, at.y))),
});

/**
 * A panel `w` wide that opened at `at` in a free place, moved as little as keeps it whole on a window `width` by `height` that
 * changed size: inside the window's edges, its top MIN_ROOM or more above the dock however short it is, as a dragged one's
 * (inReach), so it can grow to MIN_ROOM without covering the dock and a drag does not jump it up.
 */
export const keptWhole = (at: { x: number; y: number }, w: number, width: number, height: number) => ({
  x: Math.round(Math.max(GAP, Math.min(width - GAP - w, at.x))),
  y: Math.round(Math.max(TOP, Math.min(height - BOTTOM - MIN_ROOM, at.y))),
});

/**
 * Where a panel at `at` goes so that `control`, the part of it the keyboard's focus reached (its left and right in the
 * window), shows whole: moved across as little as brings it GAP inside the window `width` wide, or null where it shows
 * already. The layer clips what hangs past the window and the page never scrolls to show it (app.css), so a control Tab
 * reaches in a panel dragged past an edge brings the panel in (the systems audit's fourth round: the page scrolled 272 px).
 */
export const showing = (at: { x: number; y: number }, control: { left: number; right: number }, width: number) =>
  control.left >= 0 && control.right <= width ? null : { x: Math.round(at.x + (control.left < 0 ? GAP - control.left : width - GAP - control.right)), y: at.y };

/**
 * The free place for a panel `w` by `h` beside those already on screen (`taken`), in a window
 * `width` by `height`: the rightmost spot of the highest row with room, scanning right to left past
 * each panel in the way. Rows start under the chips and just below each panel, and a row has room
 * for a panel that fits beside the others down to the dock, or at least MIN_ROOM of it (roomBelow:
 * the rest scrolls inside it). No row starts lower than MIN_ROOM above the dock, however short the
 * panel, so it can grow to MIN_ROOM without covering the dock and a drag does not jump it up (inReach).
 * With room in none, it opens at the top right, a step down for each panel open, as far as leaves it
 * MIN_ROOM above the dock.
 */
export function freePlace(w: number, h: number, taken: readonly Rect[], width: number, height: number): { x: number; y: number } {
  const rows = [...new Set([TOP, ...taken.map((t) => t.y + t.h + GAP)])].filter((y) => y + MIN_ROOM <= height - BOTTOM).sort((a, b) => a - b);
  for (const y of rows) {
    let x = width - GAP - w;
    for (let tries = 0; x >= GAP && tries <= taken.length; tries++) {
      const here: Rect = { x, y, w, h: Math.min(h, roomBelow(y, height)) };
      const inTheWay = taken.filter((t) => overlaps(here, t));
      if (!inTheWay.length) return { x, y };
      x = Math.min(...inTheWay.map((t) => t.x)) - GAP - w;
    }
  }
  return { x: Math.max(GAP, width - GAP - w), y: Math.max(TOP, Math.min(TOP + taken.length * ROW_STEP, height - BOTTOM - MIN_ROOM)) };
}

/** Puts a panel's box at `at`, no taller than roomBelow allows there (app.css reads --room). */
function put(box: HTMLElement, at: { x: number; y: number }): void {
  Object.assign(box.style, { left: `${at.x}px`, top: `${at.y}px` });
  box.style.setProperty("--room", `${roomBelow(at.y, window.innerHeight)}px`);
}

/** The panel shown last, and how many panels have been shown: a new one each time, even for a panel already open. */
export interface PanelFront {
  readonly id: string;
  readonly n: number;
}

/**
 * Panels that move and stay open together (D25: "when you open 2 tabs, they conflict and you can't
 * use it, either make it so that the tabs are moveable or make it so that one closes when you open
 * another, preferably the former"). A panel opens in a free place, beside those already open (the
 * first at the top right), and stays there; it is dragged by its heading anywhere on the screen, and
 * opens where it was dragged to for the rest of the session. Opening it, showing it again (`front`)
 * or a press on it brings it to the front. A window that changes size keeps a panel that opened in a
 * free place whole, and a dragged one's heading in reach. A tool's card is a panel like the others.
 * Places live on the elements, not in React state, so a drag re-renders nothing. The panels are raised
 * among themselves on a layer of their own, under the menus and the cards beside the pointer however
 * many are raised (app.css's --layer-panels).
 */
export function Panels({ items, front = null }: { items: readonly PanelItem[]; front?: PanelFront | null }) {
  const [raised, setRaised] = useState<readonly string[]>([]);
  // A panel not open at the last render has just opened, and `front` names one shown again: the
  // player's newest act, in front of those pressed before (React's pattern for state that follows a prop).
  const ids = items.map((i) => i.id);
  const [shown, setShown] = useState({ ids: ids.join(" "), front });
  if (ids.join(" ") !== shown.ids || front !== shown.front) {
    const before = new Set(shown.ids.split(" "));
    const again = front && front !== shown.front && ids.includes(front.id) ? front.id : null;
    const ahead = [...ids.filter((id) => !before.has(id) && id !== again), ...(again ? [again] : [])];
    setShown({ ids: ids.join(" "), front });
    setRaised((r) => [...r.filter((id) => ids.includes(id) && !ahead.includes(id)), ...ahead]);
  }
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
      // Where it was dragged to, kept in reach of a window narrower since.
      const was = dragged.current.get(id);
      put(box, was ? inReach(was, box.offsetWidth, window.innerWidth, window.innerHeight) : freePlace(box.offsetWidth, box.offsetHeight, taken, window.innerWidth, window.innerHeight));
      placed.current.add(id);
    }
  });

  // A window that changes size keeps a panel in a free place whole, and a dragged one in reach, as a drag does.
  useEffect(() => {
    const resize = () => {
      for (const [id, box] of boxes.current) {
        const r = box.getBoundingClientRect();
        const [width, height] = [window.innerWidth, window.innerHeight];
        put(box, dragged.current.has(id) ? inReach({ x: r.left, y: r.top }, r.width, width, height) : keptWhole({ x: r.left, y: r.top }, r.width, width, height));
      }
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const raise = (id: string) => setRaised((r) => (r.at(-1) === id ? r : [...r.filter((x) => x !== id), id]));
  // A control the keyboard focuses past the window's edge brings its panel in as far as shows it (showing), and the panel
  // stays there, as if dragged there. Only the keyboard's focus moves it (:focus-visible): a press focuses what is under
  // the pointer, on screen already, though a Saves row it focuses may run on past the edge. A dropdown's open list is
  // portaled to the page, placed beside its button (React's focus still bubbles here), so it moves no panel.
  const reveal = (box: HTMLDivElement, target: EventTarget, id: string) => {
    if (!(target instanceof Element) || !box.contains(target) || !target.matches(":focus-visible")) return;
    const b = box.getBoundingClientRect();
    const at = showing({ x: b.left, y: b.top }, target.getBoundingClientRect(), window.innerWidth);
    if (!at) return;
    put(box, at);
    if (dragged.current.has(id)) dragged.current.set(id, at);
  };
  const drag = (event: ReactPointerEvent<HTMLDivElement>, id: string) => {
    const target = event.target as Element;
    if (event.button !== 0 || !target.closest("h2") || target.closest("button, a, input")) return;
    const box = event.currentTarget;
    const start = box.getBoundingClientRect();
    const [x0, y0] = [event.clientX, event.clientY];
    const place = (cx: number, cy: number) => inReach({ x: start.left + cx - x0, y: start.top + cy - y0 }, start.width, window.innerWidth, window.innerHeight);
    event.preventDefault();
    box.setPointerCapture(event.pointerId);
    box.classList.add("dragging");
    const move = (e: PointerEvent) => put(box, place(e.clientX, e.clientY));
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
    <div className="panel-layer">
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
            style={{ zIndex: 1 + (lift >= 0 ? items.length + lift : k) }}
            onPointerDownCapture={() => raise(id)}
            onPointerDown={(e) => drag(e, id)}
            onFocus={(e) => reveal(e.currentTarget, e.target, id)}
          >
            {node}
          </div>
        );
      })}
    </div>
  );
}
