import type { LineView } from "../../sim/types";
import { LineCard } from "../game/LineCard";
import type { Sim } from "../game/useSim";
import { usd } from "../format";

/**
 * The line inspector (the M2 spec, item 7): one line's card, its headways and the day's forecast.
 * The costs are the plan's own, to the cent, so the day card's rows meet them (I6); fares and
 * subsidy are the modelled riders', so they read as "about".
 */
export function Inspector({
  sim,
  lineId,
  onLine,
  onExtend,
  onClose,
}: {
  sim: Sim;
  lineId: number | null;
  onLine: (id: number) => void;
  /** Starts the line tool beyond one end of a line (the M3 spec, item 14). */
  onExtend: (lineId: number, end: "start" | "end") => void;
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
      <LineCard key={line.id} sim={sim} line={line} />
      <div className="controls">
        <button type="button" onClick={() => onExtend(line.id, "start")}>
          Extend from Stop {line.stopIds[0]}
        </button>
        <button type="button" onClick={() => onExtend(line.id, "end")}>
          Extend from Stop {line.stopIds.at(-1)}
        </button>
      </div>
      <Forecast line={line} />
    </aside>
  );
}

function Forecast({ line }: { line: LineView }) {
  const f = line.forecastCents;
  const rows: [string, number, boolean][] = [
    ["Fares and subsidy", line.incomeCents, true],
    ["Running (per km)", -f.running, false],
    ["Driver wages", -f.wages, false],
    ["Deadhead", -f.deadhead, false],
  ];
  const net = line.incomeCents - f.running - f.wages - f.deadhead;
  return (
    <table
      className="forecast"
      data-testid="forecast"
      data-running={f.running}
      data-wages={f.wages}
      data-deadhead={f.deadhead}
    >
      <caption>A whole day’s forecast</caption>
      <tbody>
        {rows.map(([name, cents, modelled]) => (
          <tr key={name}>
            <th scope="row">{name}</th>
            <td>
              {modelled ? "≈" : ""}
              {usd(cents, { cents: true })}
            </td>
          </tr>
        ))}
        <tr className="total">
          <th scope="row">Line net</th>
          <td>≈{usd(net, { cents: true })}</td>
        </tr>
      </tbody>
    </table>
  );
}
