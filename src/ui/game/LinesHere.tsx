import type { LineView } from '../../sim/types';
import type { Sim } from './useSim';

/**
 * The lines `lineIds` names, in its order, or null once any of them is gone. The card closes then (App), as the stop card
 * closes with its stop: an undo frees a line's id, and a line created later takes it, which the card would list as running
 * here though it runs elsewhere.
 */
export function linesHere(lineIds: readonly number[], lines: readonly LineView[]): LineView[] | null {
  const byId = new Map(lines.map((l) => [l.id, l]));
  const here = lineIds.map((id) => byId.get(id));
  return here.every((l): l is LineView => l !== undefined) ? here : null;
}

/**
 * The lines a click on the map found on the same streets (DECISIONS, Open: many lines on the map, its recommended (b)). A late
 * game's lines share corridors and draw over one another, and a click there opened only the line drawn on top: the others
 * were reached only from Lines' tabs. Each line here opens its own card, the topmost first, as the map draws them.
 */
export function LinesHere({ sim, lineIds, onLine, onClose }: { sim: Sim; lineIds: readonly number[]; onLine: (id: number) => void; onClose: () => void }) {
  const lines = linesHere(lineIds, sim.snapshot?.lines ?? []);
  if (!lines?.length) return null;
  return (
    <aside className="panel lines-here" aria-label="Lines here" data-testid="lines-here" data-chrome="panel">
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Lines here</h2>
      <p className="hint">More than one line runs where you clicked.</p>
      <div className="lines">
        {lines.map((l) => (
          <button key={l.id} type="button" onClick={() => onLine(l.id)}>
            <span className="swatch" style={{ background: l.colour }} /> {l.name}
          </button>
        ))}
      </div>
    </aside>
  );
}
