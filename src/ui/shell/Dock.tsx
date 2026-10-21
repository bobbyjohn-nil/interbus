import { useEffect, useRef, useState } from 'react';
import type { Tool } from '../game/Tools';
import { closeOnPressAway } from '../pressAway';

export type Panel = 'none' | 'lines' | 'stop' | 'finance' | 'saves' | 'contracts';

/** The Build menu's tools (D25: "a build tab with options to place individual stops, and an option like the one we have now. place a depot should also be in the build menu"). */
const BUILD: readonly { readonly tool: Exclude<Tool, 'none' | 'route'>; readonly name: string; readonly hint: string; readonly icon: JSX.Element }[] = [
  {
    tool: 'stop',
    name: 'Place a stop',
    hint: 'On its own, for a line later',
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
  },
  {
    tool: 'line',
    name: 'Draw a line',
    hint: 'Click its stops in order',
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 15 8 7l5 6 4-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="3" cy="15" r="1.8" fill="currentColor" />
        <circle cx="17" cy="5" r="1.8" fill="currentColor" />
      </svg>
    ),
  },
  {
    tool: 'depot',
    name: 'Place a depot',
    hint: 'On the industrial land',
    icon: (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 17V8l7-4 7 4v9M7 17v-6h6v6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    ),
  },
];

/**
 * The calm shell's dock (PLAN §8: 8 slots or fewer): Build, which opens a menu of its three tools
 * above it (D25), the lines' inspector and Finance. Saves is at the top (D25: "saves should not be one
 * of the tabs at the bottom, it can be placed at the top"). Picking a tool closes the menu; picking
 * the tool already out puts it down.
 */
export function Dock({ tool, panels, hasLines, locked = false, onTool, onPanel }: { tool: Tool; panels: readonly Panel[]; hasLines: boolean; locked?: boolean; onTool: (t: Tool) => void; onPanel: (p: Exclude<Panel, 'none'>) => void }) {
  const [open, setOpen] = useState(false);
  const build = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  // Escape or a press anywhere else closes the menu, as the game's dropdowns do, and does nothing else:
  // Escape is heard first, on its way down, and stops there, so the tool and the panels stay out, and
  // the focus on a tool goes back to Build. The focus leaving it for another control closes it too (below).
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (build.current?.contains(document.activeElement)) button.current?.focus();
      setOpen(false);
    };
    const away = closeOnPressAway((target) => Boolean(build.current?.contains(target)), () => setOpen(false));
    window.addEventListener('keydown', key, true);
    window.addEventListener('pointerdown', away);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('pointerdown', away);
    };
  }, [open]);
  const building = tool !== 'none' && tool !== 'route';
  return (
    <nav className="dock" aria-label="Tools" data-testid="dock" data-chrome="rest">
      {/* The menu comes after Build in the page, so Tab goes from Build through its tools in order, and
          the focus leaving for another control (Tab past the last, Shift+Tab from Build) closes it, as
          Tab closes a dropdown's list. */}
      <div
        className="build"
        ref={build}
        onBlur={(event) => {
          if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        {/* An ended run builds nothing (locked: runOver). */}
        <button ref={button} type="button" aria-pressed={open || building} aria-expanded={open} data-testid="build" disabled={locked} onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Build
        </button>
        {open && !locked ? (
          <div className="build-menu" role="group" aria-label="Build" data-testid="build-menu" data-chrome="panel">
            {BUILD.map((b) => (
              <button
                key={b.tool}
                type="button"
                aria-pressed={tool === b.tool}
                onClick={() => {
                  setOpen(false);
                  onTool(b.tool);
                }}
              >
                {b.icon}
                <span>
                  {b.name}
                  <small>{b.hint}</small>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button type="button" aria-pressed={panels.includes('lines')} disabled={!hasLines} onClick={() => onPanel('lines')}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 6h12M4 10h12M4 14h8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Lines
      </button>
      <button type="button" aria-pressed={panels.includes('finance')} onClick={() => onPanel('finance')}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 16V9M8 16V5M12 16v-5M16 16V7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Finance
      </button>
    </nav>
  );
}
