import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { closeOnPressAway } from './pressAway';

export interface DropdownOption<T> {
  readonly value: T;
  readonly label: string;
  /** A second, quieter line in the list: what the option means. */
  readonly hint?: string;
  readonly disabled?: boolean;
}

/** The room the list leaves at the window's edge, in pixels. */
const EDGE = 8;
/** The list as first drawn, unseen, so its height can be read before it is placed. */
const UNPLACED: CSSProperties = { position: 'fixed', left: 0, top: 0, bottom: 'auto', visibility: 'hidden' };

/** Scrolls `list` as little as shows its option `i` whole. */
function reveal(list: HTMLUListElement | null, i: number): void {
  const option = list?.children[i] as HTMLElement | undefined;
  if (!list || !option) return;
  if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
  else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
}

/**
 * The game's own dropdown, in place of the browser's (D25: "I don't like the default dropdown menus,
 * there should be custom ones"). A button names the choice; it opens a list the keyboard can work:
 * the arrows move, Home and End jump, Enter or Space picks, Escape and a click elsewhere close it
 * without picking; the option it is on stays in view. Escape stops there, so it never also closes the
 * panel the dropdown sits in, and the click elsewhere does nothing more, so it never also uses the
 * tool on the map (pressAway.ts). The list is drawn over the page beside its button, so a panel that
 * scrolls never clips it, and above or below its button within the window's top and bottom.
 */
export function Dropdown<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placement = 'below',
  repick = false,
  testId,
  className,
  children,
}: {
  /** The accessible name of the button and its list. */
  readonly label: string;
  readonly value: T;
  readonly options: readonly DropdownOption<T>[];
  readonly onChange: (value: T) => void;
  readonly placement?: 'below' | 'above';
  /** Picking the option already chosen still calls onChange (the speed menu: it plays at that speed). */
  readonly repick?: boolean;
  readonly testId?: string;
  readonly className?: string;
  /** What the button shows; the chosen option's label by default. */
  readonly children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [at, setAt] = useState<{ readonly side: 'below' | 'above'; readonly style: CSSProperties } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const chosen = options.findIndex((o) => o.value === value);

  // Placed beside the button, below or above it, in the viewport's own pixels, once the list is drawn
  // (unseen) and its height known. Where that side has no room for it and the other has more (a panel
  // low in the window), it opens on the other; it is never taller than the room on its side.
  useLayoutEffect(() => {
    if (!open || !button.current || !list.current) return;
    const r = button.current.getBoundingClientRect();
    // Measured as wide as it will be placed, so its options wrap as they will.
    Object.assign(list.current.style, { left: `${r.left}px`, minWidth: `${r.width}px` });
    const h = list.current.offsetHeight;
    // Its padding, which max-height leaves out.
    const pad = h - parseFloat(getComputedStyle(list.current).height);
    const room = { below: window.innerHeight - r.bottom - 4 - EDGE, above: r.top - 4 - EDGE };
    const other = placement === 'below' ? 'above' : 'below';
    const side = h > room[placement] && room[other] > room[placement] ? other : placement;
    setAt({
      side,
      style: {
        position: 'fixed',
        left: r.left,
        minWidth: r.width,
        ...(side === 'below' ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }),
        ...(h > room[side] ? { maxHeight: room[side] - pad } : {}),
      },
    });
  }, [open, placement]);

  // Opened, the list shows the option chosen.
  useLayoutEffect(() => {
    if (at) reveal(list.current, chosen);
  }, [at, chosen]);

  useEffect(() => {
    if (!open) return;
    const away = closeOnPressAway((target) => Boolean(root.current?.contains(target) || list.current?.contains(target)), () => setOpen(false));
    window.addEventListener('pointerdown', away);
    list.current?.focus();
    return () => window.removeEventListener('pointerdown', away);
  }, [open, at]);

  const enabled = (i: number) => options[i] !== undefined && !options[i]!.disabled;
  const step = (from: number, by: 1 | -1) => {
    for (let i = from + by; i >= 0 && i < options.length; i += by) if (enabled(i)) return i;
    return from;
  };
  const show = () => {
    if (open) return;
    setActive(chosen >= 0 ? chosen : step(-1, 1));
    setAt(null);
    setOpen(true);
  };
  // The keyboard's moves keep the option they reach in view (a press scrolls nothing for a listbox's active option).
  const move = (i: number) => {
    setActive(i);
    reveal(list.current, i);
  };
  const pick = (i: number) => {
    if (!enabled(i)) return;
    setOpen(false);
    button.current?.focus();
    if (repick || options[i]!.value !== value) onChange(options[i]!.value);
  };
  const onButtonKey = (event: KeyboardEvent) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      show();
    }
  };
  const onListKey = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(step(active, 1)),
      ArrowUp: () => move(step(active, -1)),
      Home: () => move(step(-1, 1)),
      End: () => move(step(options.length, -1)),
      Enter: () => pick(active),
      ' ': () => pick(active),
      Escape: () => {
        setOpen(false);
        button.current?.focus();
      },
      Tab: () => setOpen(false),
    };
    const act = keys[event.key];
    if (!act) return;
    if (event.key !== 'Tab') event.preventDefault();
    event.stopPropagation();
    act();
  };

  return (
    <div className={`dropdown${className ? ` ${className}` : ''}`} ref={root}>
      <button
        ref={button}
        type="button"
        className="dropdown-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={label}
        data-testid={testId}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onButtonKey}
      >
        <span className="dropdown-value">{children ?? options[chosen]?.label ?? ''}</span>
        <span className="dropdown-caret" aria-hidden="true" />
      </button>
      {open
        ? createPortal(
            <ul
              ref={list}
              id={listId}
              className={`dropdown-list ${at?.side ?? placement}`}
              style={at?.style ?? UNPLACED}
              role="listbox"
              aria-label={label}
              aria-activedescendant={`${listId}-${active}`}
              tabIndex={-1}
              onKeyDown={onListKey}
            >
              {options.map((o, i) => (
                <li
                  key={String(o.value)}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  aria-disabled={o.disabled || undefined}
                  className={`dropdown-option${i === active ? ' active' : ''}`}
                  onPointerEnter={() => enabled(i) && setActive(i)}
                  onClick={() => pick(i)}
                >
                  <span className="dropdown-label">{o.label}</span>
                  {o.hint ? <span className="dropdown-hint">{o.hint}</span> : null}
                </li>
              ))}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
