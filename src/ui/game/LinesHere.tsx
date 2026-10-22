import type { Sim } from './useSim';

/**
 * The lines a click on the map found on the same streets (DECISIONS, Open: many lines on the map, its recommended (b)). A late
 * game's lines share corridors and draw over one another, and a click there opened only the line drawn on top: the others
 * were reached only from Lines' tabs. Each line here opens its own card, the topmost first, as the map draws them; a line
 * gone since the click is left out.
 */
export function LinesHere({ sim, lineIds, onLine, onClose }: { sim: Sim; lineIds: readonly number[]; onLine: (id: number) => void; onClose: () => void }) {
  const byId = new Map((sim.snapshot?.lines ?? []).map((l) => [l.id, l]));
  const lines = lineIds.flatMap((id) => {
    const line = byId.get(id);
    return line ? [line] : [];
  });
  if (!lines.length) return null;
  return (
    <aside className="panel lines-here" aria-label="Lines here" data-testid="lines-here" data-chrome="panel">
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Lines here</h2>
      <p className="hint">They run on the same streets here, so the map draws them over one another.</p>
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
