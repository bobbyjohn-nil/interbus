import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface DropdownOption<T> {
  readonly value: T;
  readonly label: string;
  /** A second, quieter line in the list: what the option means. */
  readonly hint?: string;
  readonly disabled?: boolean;
}

/**
 * The game's own dropdown, in place of the browser's (D25: "I don't like the default dropdown menus,
 * there should be custom ones"). A button names the choice; it opens a list the keyboard can work:
 * the arrows move, Home and End jump, Enter or Space picks, Escape and a click elsewhere close it
 * without picking. Escape stops there, so it never also closes the panel the dropdown sits in.
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
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const chosen = options.findIndex((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    list.current?.focus();
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);

  const enabled = (i: number) => options[i] !== undefined && !options[i]!.disabled;
  const step = (from: number, by: 1 | -1) => {
    for (let i = from + by; i >= 0 && i < options.length; i += by) if (enabled(i)) return i;
    return from;
  };
  const show = () => {
    setActive(chosen >= 0 ? chosen : step(-1, 1));
    setOpen(true);
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
      ArrowDown: () => setActive((i) => step(i, 1)),
      ArrowUp: () => setActive((i) => step(i, -1)),
      Home: () => setActive(step(-1, 1)),
      End: () => setActive(step(options.length, -1)),
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
      {open ? (
        <ul
          ref={list}
          id={listId}
          className={`dropdown-list ${placement}`}
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
        </ul>
      ) : null}
    </div>
  );
}
