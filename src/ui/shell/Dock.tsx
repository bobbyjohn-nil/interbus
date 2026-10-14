import { useEffect, useRef, useState } from 'react';
import type { Tool } from '../game/Tools';

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
 * above it (D25), the lines' inspector, Finance and Saves. Picking a tool closes the menu; picking
 * the tool already out puts it down.
 */
export function Dock({ tool, panel, hasLines, onTool, onPanel }: { tool: Tool; panel: Panel; hasLines: boolean; onTool: (t: Tool) => void; onPanel: (p: Panel) => void }) {
  const [open, setOpen] = useState(false);
  const build = useRef<HTMLDivElement>(null);
  // Escape or a press anywhere else closes the menu, as the game's dropdowns do.
  useEffect(() => {
    if (!open) return;
    const key = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    const away = (event: PointerEvent) => !build.current?.contains(event.target as Node) && setOpen(false);
    window.addEventListener('keydown', key);
    window.addEventListener('pointerdown', away);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('pointerdown', away);
    };
  }, [open]);
  const building = tool !== 'none' && tool !== 'route';
  return (
    <nav className="dock" aria-label="Tools" data-testid="dock" data-chrome="rest">
      <div className="build" ref={build}>
        {open ? (
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
        <button type="button" aria-pressed={open || building} aria-expanded={open} data-testid="build" onClick={() => setOpen((o) => !o)}>
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Build
        </button>
      </div>
      <button type="button" aria-pressed={panel === 'lines'} disabled={!hasLines} onClick={() => onPanel(panel === 'lines' ? 'none' : 'lines')}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 6h12M4 10h12M4 14h8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Lines
      </button>
      <button type="button" aria-pressed={panel === 'finance'} onClick={() => onPanel(panel === 'finance' ? 'none' : 'finance')}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 16V9M8 16V5M12 16v-5M16 16V7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Finance
      </button>
      <button type="button" aria-pressed={panel === 'saves'} onClick={() => onPanel(panel === 'saves' ? 'none' : 'saves')}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M4 4h10l2 2v10H4zM7 4v4h6V4M7 16v-5h6v5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        Saves
      </button>
    </nav>
  );
}
