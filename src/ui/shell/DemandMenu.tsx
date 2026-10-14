import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { GAME_LIGHT } from '../../render/map/tokens';
import type { DotKinds } from '../../render/map/MapView';
import type { Dots } from '../../sim/types';
import { about } from '../format';

const KINDS = [
  { kind: 'home', name: 'Homes', what: 'Where people live', unit: 'people', colour: GAME_LIGHT.homeDot },
  { kind: 'job', name: 'Jobs', what: 'Where people work', unit: 'jobs', colour: GAME_LIGHT.jobDot },
] as const;

/** Everyone a kind of dot stands for: its dots' people or jobs, added up. */
export function dotTotal(dots: Dots | null, kind: 'home' | 'job'): number {
  return (kind === 'home' ? dots?.homes : dots?.jobs)?.reduce((sum, [, , w]) => sum + w, 0) ?? 0;
}

/**
 * The demand menu (D25: "Different kinds of demand should be separated, such as the purple and blue,
 * have a separate dropdown or other type of menu to toggle demand point types"). A small chip in the
 * map's corner, beside the compass, opens a menu with one checkbox per kind, each with its colour and
 * how many it stands for, so it is the map's legend too. Arrow keys move, Space or Enter turns one on or
 * off, and Escape or a click elsewhere closes it; Escape stops there, so an open panel stays open.
 */
export function DemandMenu({ dots, shown, onShown }: { dots: Dots | null; shown: DotKinds; onShown: (next: DotKinds) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const items = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    const away = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);
  useEffect(() => {
    if (open) items.current[active]?.focus();
  }, [open, active]);

  const flip = (kind: 'home' | 'job') => onShown({ ...shown, [kind]: !shown[kind] });
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const onMenuKey = (event: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => setActive((i) => Math.min(KINDS.length - 1, i + 1)),
      ArrowUp: () => setActive((i) => Math.max(0, i - 1)),
      Home: () => setActive(0),
      End: () => setActive(KINDS.length - 1),
      Escape: close,
      Tab: () => setOpen(false),
    };
    const act = keys[event.key];
    if (!act) return;
    if (event.key !== 'Tab') event.preventDefault();
    event.stopPropagation();
    act();
  };

  const label = 'Demand on the map';
  return (
    <div className="demand" ref={root}>
      <button
        ref={button}
        type="button"
        className="demand-chip"
        data-chrome="rest"
        data-testid="demand-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => {
          setActive(0);
          setOpen((o) => !o);
        }}
      >
        <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true">
          <circle cx="7" cy="8" r="4.5" fill={GAME_LIGHT.homeDot} opacity={shown.home ? 0.85 : 0.25} />
          <circle cx="13.5" cy="13" r="3.5" fill={GAME_LIGHT.jobDot} opacity={shown.job ? 0.85 : 0.25} />
        </svg>
      </button>
      {open ? (
        <div className="demand-menu" role="menu" aria-label={label} data-chrome="panel" data-testid="demand-menu" onKeyDown={onMenuKey}>
          {KINDS.map((k, i) => (
            <button
              key={k.kind}
              ref={(el) => void (items.current[i] = el)}
              type="button"
              role="menuitemcheckbox"
              aria-checked={shown[k.kind]}
              tabIndex={i === active ? 0 : -1}
              className="demand-item"
              data-kind={k.kind}
              onClick={() => flip(k.kind)}
              onFocus={() => setActive(i)}
            >
              <span className="demand-check" aria-hidden="true">
                {shown[k.kind] ? '✓' : ''}
              </span>
              <span className="demand-swatch" aria-hidden="true" style={{ background: k.colour }} />
              <span className="demand-name">{k.name}</span>
              <span className="demand-what">
                {k.what} · {about(dotTotal(dots, k.kind))} {k.unit}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
