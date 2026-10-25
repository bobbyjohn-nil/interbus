import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { focusLost } from "../focusLost";
import { giveFocus } from "../giveFocus";
import { SHOWN } from "../showWhole";

/** A panel on the layer: its id, and what it draws (a `.panel` element). */
export interface PanelItem {
  readonly id: string;
  readonly node: ReactNode;
  /**
   * Never covered by a panel: one opened after it, with no free place left, falls back clear of it, and it is drawn above them
   * all, so a window that narrows and keeps the panels whole cannot move one over it either. The lender's card, whose Restart
   * this quarter is the run's one way on.
   */
  readonly clear?: boolean;
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
 * MIN_ROOM above the dock, and below any of `clear` it would cover there (the review of the ninth audit
 * round: at 1152×720 Finance, opened third after the run ended, fell back over the lender's card and hid
 * Restart this quarter).
 */
export function freePlace(w: number, h: number, taken: readonly Rect[], width: number, height: number, clear: readonly Rect[] = []): { x: number; y: number } {
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
  const x = Math.max(GAP, width - GAP - w);
  let y = Math.max(TOP, Math.min(TOP + taken.length * ROW_STEP, height - BOTTOM - MIN_ROOM));
  for (const c of [...clear].sort((a, b) => a.y - b.y))
    if (overlaps({ x, y, w, h: Math.min(h, roomBelow(y, height)) }, c)) y = Math.max(y, Math.min(c.y + c.h + GAP, height - BOTTOM - MIN_ROOM));
  return { x, y };
}

/** Puts a panel's box at `at`, no taller than roomBelow allows there (app.css reads --room). */
function put(box: HTMLElement, at: { x: number; y: number }): void {
  Object.assign(box.style, { left: `${at.x}px`, top: `${at.y}px` });
  box.style.setProperty("--room", `${roomBelow(at.y, window.innerHeight)}px`);
}

/**
 * What a panel took the keyboard's focus from as it opened (`at`), and the panel that held it (`in`). One that took it from a
 * panel going as it opened, as the route editor takes Lines' place and Lines the editor's, has no control (`at` null), only
 * that panel.
 */
export interface Opener {
  readonly at: Element | null;
  readonly in: string | null;
}

/**
 * Where the keyboard's focus goes back to as panel `id` closes with the player in it, for a panel the keyboard opened: what
 * opened it, while it can take the focus (`usable`); or, gone, what opened the panel it was in, and so on, never round a panel
 * twice; or, with none of those left, what opens one of those panels now (`opens`), the first first; or, with none, where the
 * screen keeps the keyboard (`rest`: the founding card's name). A panel stood in for another kept that one's opener: Escape
 * from the route editor, or from Lines after its Cancel, gave the page the focus. And the checklist's last step opens
 * Contracts until Take it completes it, when the Contracts chip takes its place (round 10). Saves left open over the founding
 * card had nothing to hand back to (round 11). A control that opened it, gone from a panel still open (`boxOf` gives its box), gives
 * that panel: Ctrl+Z in a stop's card opened from Lines' stops took the stop and its button, and the walk went on to what
 * opened Lines, the dock's Lines, so the next Space closed Lines (the systems audit's eighteenth round), where Continue's
 * hand-back already gave Lines (DayCard).
 */
export function handBackTo(
  id: string,
  openers: ReadonlyMap<string, Opener>,
  opens: (panel: string) => Element | null,
  usable: (el: Element) => boolean,
  rest: () => Element | null = () => null,
  boxOf: (panel: string) => Element | null = () => null,
): Element | null {
  if (!openers.has(id)) return null;
  const chain: string[] = [];
  for (let panel: string | null = id; panel !== null && !chain.includes(panel); ) {
    chain.push(panel);
    const opener = openers.get(panel);
    if (!opener) break;
    if (opener.at && usable(opener.at)) return opener.at;
    const box = opener.at && opener.in !== null ? boxOf(opener.in) : null;
    if (box && usable(box)) return box;
    panel = opener.in;
  }
  for (const panel of chain) {
    const at = opens(panel);
    if (at && usable(at)) return at;
  }
  const at = rest();
  return at && usable(at) ? at : null;
}

/** Where the keyboard's focus rests on a screen when a panel it was in closes with nothing else to hand it back to (handBackTo's `rest`). */
export const FOCUS_REST = "[data-focus-rest]";

/** A control that can take the focus back: on the page, and not turned off. */
const usable = (el: Element) => el.isConnected && !el.matches(":disabled");

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
 * free place whole, placed afresh where the change would leave it over another, and a dragged one's
 * heading in reach.
 * A tool's card is a panel like the others.
 * One the keyboard opened takes the focus (`focus`), as a dialog does, so Tab goes on inside it.
 * Places live on the elements, not in React state, so a drag re-renders nothing. The panels are raised
 * among themselves on a layer of their own, under the menus and the cards beside the pointer however
 * many are raised (app.css's --layer-panels).
 */
export function Panels({
  items,
  front = null,
  focus = null,
  takesFocus = () => false,
  backToRef,
}: {
  items: readonly PanelItem[];
  front?: PanelFront | null;
  /** The panel the player opened or showed last. */
  focus?: PanelFront | null;
  /** Whether that panel takes the focus: when the keyboard opened it (App's focusSource). */
  takesFocus?: () => boolean;
  /**
   * Set to where the focus goes back to as a panel closed with the player in it (handBackTo on the openers kept), for what
   * hands the focus back later, the day card's Continue, so the two agree.
   */
  backToRef?: { current: (panel: string) => Element | null };
}) {
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
      // Items placed already that no panel may cover (PanelItem.clear).
      const clear = items.filter((i) => i.clear && placed.current.has(i.id)).flatMap(({ id: other }) => {
        const r = boxes.current.get(other)?.getBoundingClientRect();
        return r ? [{ x: r.left, y: r.top, w: r.width, h: r.height }] : [];
      });
      // Where it was dragged to, kept in reach of a window narrower since.
      const was = dragged.current.get(id);
      put(box, was ? inReach(was, box.offsetWidth, window.innerWidth, window.innerHeight) : freePlace(box.offsetWidth, box.offsetHeight, taken, window.innerWidth, window.innerHeight, clear));
      placed.current.add(id);
    }
  });

  // The panel the keyboard opened or showed (`focus`, App) takes the focus once placed, so the next Tab is its first control.
  // Asked as the effect runs, after the press that opened it, never during a render. The box can hold the focus only until it
  // leaves: always focusable, it took the focus from a press on a panel's text, so the keys no longer scrolled the panel and
  // the run's end found the focus held, not lost, and gave Continue none (the review of the ninth audit round).
  const takes = useRef(takesFocus);
  const itemIds = useRef<readonly string[]>([]);
  /** The items no panel may cover (PanelItem.clear), for a resize to place panels clear of. */
  const clears = useRef<ReadonlySet<string>>(new Set());
  useLayoutEffect(() => {
    takes.current = takesFocus;
    itemIds.current = items.map((i) => i.id);
    clears.current = new Set(items.filter((i) => i.clear).map((i) => i.id));
  });
  // What each panel the keyboard opened took the focus from, and the panel the player was last in, by the focus or a press.
  // One that closes while the player was in it, by its Close, Escape or the game, hands the focus back to what opened it, as
  // a dialog does; it fell to the page (the reviews of the hand-back and the stop card's keys). An opener inside a panel that
  // went with it hands on to that panel's own: a stop's card opened from Lines' stops, both closed by one Escape, gives the
  // dock's Lines the focus (the review of #156). Checked after the layout effects, so a card's own hand-off (useFocusBack,
  // App) goes first.
  // Each kept past its panel's close, for a panel that stood in for it to hand back through (handBackTo), and let go when the
  // panel opens again without the keyboard. A panel shown again from the keyboard while open takes what showed it as its
  // opener: the stop card shown for Stop 3 goes back to Stop 3's row. A stop card's line button so becomes Lines' opener, and
  // Escape closing both went round from Lines to the card and back to a gone button, until the walk went round no panel twice
  // (round 10; keeping the first opener instead sent the card's Close to Stop 2: its review).
  const openers = useRef(new Map<string, Opener>());
  const backFor = (panel: string) =>
    handBackTo(
      panel,
      openers.current,
      (p) => document.querySelector(`[data-opens="${p}"]`),
      usable,
      () => document.querySelector(FOCUS_REST),
      (p) => boxes.current.get(p) ?? null,
    );
  useLayoutEffect(() => {
    if (backToRef) backToRef.current = backFor;
  });
  // The panel the keyboard opened in this render, whose opener the layout effect has just set.
  const opened = useRef<string | null>(null);
  const lastIn = useRef<string | null>(null);
  useEffect(() => {
    const at = (event: Event) => {
      lastIn.current = (event.target instanceof Element ? event.target.closest("[data-movable]")?.getAttribute("data-movable") : null) ?? null;
    };
    document.addEventListener("focusin", at, true);
    document.addEventListener("pointerdown", at, true);
    return () => {
      document.removeEventListener("focusin", at, true);
      document.removeEventListener("pointerdown", at, true);
    };
  }, []);
  const wereOpen = useRef<readonly string[]>([]);
  useEffect(() => {
    const now = items.map((i) => i.id);
    const went = wereOpen.current.filter((id) => !now.includes(id));
    for (const id of now) if (!wereOpen.current.includes(id) && id !== opened.current) openers.current.delete(id);
    opened.current = null;
    wereOpen.current = now;
    if (!went.length) return;
    const left = lastIn.current;
    if (!left || !went.includes(left)) return;
    lastIn.current = null;
    const to = backFor(left);
    if (to instanceof HTMLElement && focusLost()) giveFocus(to);
  });
  useLayoutEffect(() => {
    const box = focus && takes.current() ? boxes.current.get(focus.id) : undefined;
    if (!box) return;
    const id = focus!.id;
    const from = document.activeElement;
    const left = lastIn.current;
    if (from instanceof HTMLElement && from !== document.body && !box.contains(from)) {
      openers.current.set(id, { at: from, in: from.closest("[data-movable]")?.getAttribute("data-movable") ?? null });
    } else if (left && left !== id && !itemIds.current.includes(left)) {
      // From a panel that went as this one opened, the focus with it.
      openers.current.set(id, { at: null, in: left });
    } else if (!openers.current.has(id) || !wereOpen.current.includes(id)) {
      // From nothing left to hand back to, the control gone with the screen it was on: what opens the panel takes it back. Saves
      // left open from Home took the focus as Continue went, and the line's card as Draw a line went with the Build menu, and
      // with no opener each handed back nothing (round 11). A panel opened afresh so never keeps an earlier opening's: Help
      // opened from the page handed the focus back to the dock's Finance, which had opened it before (the review of round 11).
      openers.current.set(id, { at: null, in: null });
    }
    opened.current = id;
    giveFocus(box);
  }, [focus]);

  // A window that changes size keeps a dragged panel in reach, as a drag does, and one in a free place whole; and one in a free
  // place that the change left over another it lay clear of, a dragged one or one it opened after, is placed afresh beside them,
  // as on opening. Kept whole one by one, Lines, Finance and Contracts piled up as Chrome's zoom went to 110%, Finance 119×302 px
  // over Lines, and stayed piled once it was back at 100% (the systems audit's seventeenth round). One a drag left lying over
  // another stays where it was: placed afresh at any change of size, Saves, with Finance dragged onto it, jumped across the
  // window as it grew (the review of the round's fixes).
  useEffect(() => {
    const rectOf = (box: HTMLElement): Rect => {
      const r = box.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    const across = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    const resize = () => {
      const [width, height] = [window.innerWidth, window.innerHeight];
      // Where each panel lay before this change of size, its place set in pixels and so left where it was by the window.
      const was = new Map([...boxes.current].map(([id, box]) => [id, rectOf(box)]));
      const settled: { readonly id: string; readonly at: Rect }[] = [];
      for (const [id, box] of boxes.current) {
        if (!dragged.current.has(id)) continue;
        const r = box.getBoundingClientRect();
        put(box, inReach({ x: r.left, y: r.top }, r.width, width, height));
        settled.push({ id, at: rectOf(box) });
      }
      const clear = [...clears.current].flatMap((id) => {
        const box = boxes.current.get(id);
        return box ? [rectOf(box)] : [];
      });
      for (const id of placed.current) {
        const box = boxes.current.get(id);
        if (!box || dragged.current.has(id)) continue;
        const r = box.getBoundingClientRect();
        put(box, keptWhole({ x: r.left, y: r.top }, r.width, width, height));
        const before = was.get(id);
        const piled = settled.some((other) => {
          const then = was.get(other.id);
          return across(rectOf(box), other.at) && !(before && then && across(before, then));
        });
        if (piled) put(box, freePlace(box.offsetWidth, box.offsetHeight, settled.map((s) => s.at), width, height, clear));
        settled.push({ id, at: rectOf(box) });
      }
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  const raise = (id: string) => setRaised((r) => (r.at(-1) === id ? r : [...r.filter((x) => x !== id), id]));
  // A control the keyboard focuses past the window's edge brings its panel in as far as shows it (showing), and the panel
  // stays there, as if dragged there; so does a key that works the control the keyboard is on there, as a drag keeps the focus
  // where it was: one that presses a button (a click no pointer made: Enter, or Space where App leaves Space to the button) or
  // one a control takes for itself (its handler stops the key's own default, as a list's button does ArrowDown and ArrowUp to
  // open its list). A list then opens beside a button in view: from Finance dragged past the window's right edge, ArrowDown on
  // a fare kept by the keyboard through the drag opened its list wholly off the window, holding the keys, and Enter set a fare
  // unseen (the systems audit's seventeenth round). A key that works nothing there moves nothing: Space, which plays and pauses
  // once a press has dragged the panel, brought it back as it did, and so did an arrow on a plain button (the round's review).
  // A control in a change card or an ask, such as Close line's, shows its card whole, so its words are read: 70% of Close
  // line's ask lay past the edge as Close it was pressed.
  // Only the keyboard's focus moves it (:focus-visible): a press focuses what is under the pointer, on screen already, though
  // a Saves row it focuses may run on past the edge. A dropdown's open list is portaled to the page, placed beside its button
  // (React's focus and keys still bubble here), so it moves no panel.
  // `whole`, what the panel's own code asks to show (showInBody's SHOWN), as Close line's ask as it opens with the keyboard on
  // Close line.
  const reveal = (box: HTMLDivElement, target: EventTarget | null, id: string, whole?: Element) => {
    if (!(target instanceof Element) || !box.contains(target) || !target.matches(":focus-visible")) return false;
    const b = box.getBoundingClientRect();
    const at = showing({ x: b.left, y: b.top }, (whole ?? target.closest(".change") ?? target).getBoundingClientRect(), window.innerWidth);
    if (!at) return false;
    put(box, at);
    if (dragged.current.has(id)) dragged.current.set(id, at);
    return true;
  };
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const at = layer.current;
    const shown = (event: Event) => {
      const box = event.target instanceof Element ? event.target.closest<HTMLDivElement>("[data-movable]") : null;
      const id = box?.getAttribute("data-movable");
      if (box && id && event.target instanceof Element) reveal(box, document.activeElement, id, event.target);
    };
    at?.addEventListener(SHOWN, shown);
    return () => at?.removeEventListener(SHOWN, shown);
  }, []);
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
    <div className="panel-layer" ref={layer}>
      {items.map(({ id, node, clear }, k) => {
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
            style={{ zIndex: 1 + (clear ? 2 * items.length : lift >= 0 ? items.length + lift : k) }}
            onPointerDownCapture={() => raise(id)}
            onPointerDown={(e) => drag(e, id)}
            onFocus={(e) => reveal(e.currentTarget, e.target, id)}
            onClickCapture={(e) => {
              if (e.detail !== 0) return;
              const box = e.currentTarget;
              const was = dragged.current.get(id);
              if (!reveal(box, e.target, id) || !was) return;
              // A press that closes the panel, as its × does, leaves where it was dragged to: brought in as the press went,
              // unseen, the panel opened there next, 398 px from where it was left (the systems audit's eighteenth round).
              setTimeout(() => {
                if (!box.isConnected) dragged.current.set(id, was);
              });
            }}
            onKeyDown={(e) => {
              // But for a tab's keys, which move the focus to the tab they reach, and the focus brings it in: one that reaches no
              // other tab, as Home on the first, moved the panel and worked nothing (the eighteenth round).
              if (e.isDefaultPrevented() && !(e.target instanceof Element && e.target.getAttribute("role") === "tab")) reveal(e.currentTarget, e.target, id);
            }}
          >
            {node}
          </div>
        );
      })}
    </div>
  );
}
