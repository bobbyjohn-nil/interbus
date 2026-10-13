import type { Tool } from '../game/Tools';

export type Panel = 'none' | 'lines' | 'stop' | 'finance';

/** The calm shell's dock (PLAN §8: 8 slots or fewer): the tools, the lines' inspector and Finance. */
export function Dock({ tool, panel, hasLines, onTool, onPanel }: { tool: Tool; panel: Panel; hasLines: boolean; onTool: (t: Tool) => void; onPanel: (p: Panel) => void }) {
  return (
    <nav className="dock" aria-label="Tools" data-testid="dock" data-chrome="rest">
      <button type="button" aria-pressed={tool === 'depot'} onClick={() => onTool('depot')}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 17V8l7-4 7 4v9M7 17v-6h6v6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        Place a depot
      </button>
      <button type="button" aria-pressed={tool === 'line'} onClick={() => onTool('line')}>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="M3 15 8 7l5 6 4-8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="3" cy="15" r="1.8" fill="currentColor" />
          <circle cx="17" cy="5" r="1.8" fill="currentColor" />
        </svg>
        Draw a line
      </button>
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
    </nav>
  );
}
