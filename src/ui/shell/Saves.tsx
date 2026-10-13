import { useEffect, useState } from 'react';
import { clock, usd } from '../format';
import type { Sim } from '../game/useSim';

/**
 * Saves (the M3 spec, item 8): the autosave, which is this game as it plays, three slots, and a save
 * file out and in. Loading a slot or a file replaces this game, so it asks first; the sim reads the
 * save before anything changes and refuses one it cannot play, keeping this game and its autosave.
 */
export function Saves({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const { send } = sim;
  useEffect(() => send({ type: 'slots' }), [send]);
  const [confirm, setConfirm] = useState<number | null>(null);
  const s = sim.snapshot;
  if (!s) return null;
  return (
    <aside className="panel saves" aria-label="Saves" data-testid="saves" data-chrome="panel">
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Saves</h2>
      <p className="hint">
        This game saves itself as it plays: day {s.day}, {clock(s.hour, s.minute)}.
      </p>
      <ul className="slots">
        {(sim.slots ?? []).map(({ slot, about, readable }) => (
          <li key={slot} data-testid={`slot-${slot}`} data-empty={about ? 'no' : 'yes'}>
            <span>
              Slot {slot} ·{' '}
              {about
                ? `Day ${about.day}, ${clock(about.hour, about.minute)} · ${about.company || 'unnamed'} · ${usd(about.cashCents)} · ${about.lines} ${about.lines === 1 ? 'line' : 'lines'}`
                : readable
                  ? 'Empty'
                  : 'A save this game cannot read'}
            </span>
            <span className="controls">
              <button type="button" onClick={() => send({ type: 'save-slot', slot })}>
                Save here
              </button>
              {about && confirm !== slot ? (
                <button type="button" onClick={() => setConfirm(slot)}>
                  Load
                </button>
              ) : null}
              {about && confirm === slot ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirm(null);
                      send({ type: 'load-slot', slot });
                    }}
                  >
                    Replace this game
                  </button>
                  <button type="button" onClick={() => setConfirm(null)}>
                    Keep playing
                  </button>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="controls">
        <button type="button" onClick={() => send({ type: 'export' })}>
          Export this game
        </button>
        <button type="button" onClick={sim.importSave}>
          Import a save file
        </button>
      </div>
    </aside>
  );
}
