import { useEffect, useState } from 'react';
import { clock, savedWhen, usd } from '../format';
import type { SetAsideWhy } from '../../sim/types';
import type { Sim } from '../game/useSim';

/** What a set-aside save is, in its row (D12, DP-06). */
const SET_ASIDE_NAMES: Readonly<Record<SetAsideWhy, string>> = {
  older: 'A save from an older build',
  newer: 'A save from a newer build',
  unreadable: 'A save this game could not read',
  'other-city': 'A save from another city',
};

/**
 * Saves (the M3 spec, item 8; the M5 spec, item 4): the autosave, which is this game as it plays,
 * three slots, and a save file out and in. Each slot names its game (day, company, cash, lines and
 * buses) and when it was saved. Loading a slot or a file replaces this game and deleting a slot loses
 * it, so both ask first; the sim reads the save before anything changes and refuses one it cannot
 * play, keeping this game and its autosave. A save set aside by a new build is listed until the
 * player exports or deletes it, so none is lost unseen. Export session hands over this session for a
 * bug report (the M3 spec, item 12).
 */
export function Saves({ sim, onClose }: { sim: Sim; onClose: () => void }) {
  const { send } = sim;
  useEffect(() => send({ type: 'slots' }), [send]);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | SetAsideWhy | null>(null);
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
                ? `Day ${about.day}, ${clock(about.hour, about.minute)} · ${about.company || 'unnamed'} · ${usd(about.cashCents)} · ${about.lines} ${about.lines === 1 ? 'line' : 'lines'} · ${about.buses} ${about.buses === 1 ? 'bus' : 'buses'}`
                : readable
                  ? 'Empty'
                  : 'A save this game cannot read'}
              {about?.savedAt != null ? (
                <span className="when" data-testid={`slot-${slot}-when`}>
                  {' · '}
                  {savedWhen(about.savedAt)}
                </span>
              ) : null}
            </span>
            <span className="controls">
              <button type="button" onClick={() => send({ type: 'save-slot', slot })}>
                Save here
              </button>
              {(about || !readable) && deleting !== slot && confirm !== slot ? (
                <button type="button" onClick={() => setDeleting(slot)}>
                  Delete
                </button>
              ) : null}
              {deleting === slot ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleting(null);
                      send({ type: 'delete-slot', slot });
                    }}
                  >
                    Delete Slot {slot}
                  </button>
                  <button type="button" onClick={() => setDeleting(null)}>
                    Keep it
                  </button>
                </>
              ) : null}
              {about && confirm !== slot && deleting !== slot ? (
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
        {(sim.setAside ?? []).map((why) => (
          <li key={why} data-testid={`set-aside-${why}`} className="set-aside">
            <span>{SET_ASIDE_NAMES[why]}, set aside</span>
            <span className="controls">
              <button type="button" onClick={() => send({ type: 'export-set-aside', why })}>
                Export
              </button>
              {deleting === why ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleting(null);
                      send({ type: 'delete-set-aside', why });
                    }}
                  >
                    Delete it
                  </button>
                  <button type="button" onClick={() => setDeleting(null)}>
                    Keep it
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => setDeleting(why)}>
                  Delete
                </button>
              )}
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
      <div className="controls">
        <button type="button" title="For a bug report: this session from the quarter’s start, every command replayable" onClick={() => send({ type: 'export-session' })}>
          Export session
        </button>
      </div>
    </aside>
  );
}
