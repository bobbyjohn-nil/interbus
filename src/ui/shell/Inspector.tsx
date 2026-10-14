import { LineCard } from "../game/LineCard";
import type { Sim } from "../game/useSim";

/**
 * The line inspector (the M2 spec, item 7): one line's card and its headways. Its money and its fare
 * are in Finance's Lines, and its stops are changed in its route editor (D25: "the menu where you see
 * lines should only have information about the line, no finances or route editing there"), each a
 * button away.
 */
export function Inspector({
  sim,
  lineId,
  onLine,
  onEditRoute,
  onFinance,
  onClose,
}: {
  sim: Sim;
  lineId: number | null;
  onLine: (id: number) => void;
  /** Opens the line's route editor (D25). */
  onEditRoute: (lineId: number) => void;
  /** Opens Finance's Lines on this line. */
  onFinance: (lineId: number) => void;
  onClose: () => void;
}) {
  const lines = sim.snapshot?.lines ?? [];
  const line = lines.find((l) => l.id === lineId) ?? lines[0];
  if (!line) return null;
  return (
    <aside
      className="panel inspector"
      aria-label="Lines"
      data-testid="inspector"
      data-chrome="panel"
    >
      <button
        type="button"
        className="close"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      {lines.length > 1 ? (
        <div className="tabs" role="tablist">
          {lines.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === line.id}
              onClick={() => onLine(l.id)}
            >
              <span className="swatch" style={{ background: l.colour }} />{" "}
              {l.name}
            </button>
          ))}
        </div>
      ) : null}
      <LineCard key={line.id} sim={sim} line={line} onFinance={() => onFinance(line.id)} />
      <div className="controls">
        <button type="button" onClick={() => onEditRoute(line.id)}>
          Edit route
        </button>
      </div>
    </aside>
  );
}
