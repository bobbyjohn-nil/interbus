import { useEffect, useRef, useState } from 'react';
import { STORE_REFUSED_COPY } from '../copy';
import { clock, dateText, savedWhen, usd } from '../format';
import type { SaveAbout, SetAsideWhy } from '../../sim/types';
import type { Sim } from '../game/useSim';

/** What a set-aside save is, in its row (D12, DP-06), and a slot this game cannot load. */
const SET_ASIDE_NAMES: Readonly<Record<'older' | 'newer' | 'unreadable' | 'other-city' | 'off-street', string>> = {
  older: 'A save from an older build',
  newer: 'A save from a newer build',
  unreadable: 'A save this game can’t read',
  'other-city': 'A save from another city',
  // This city's save from another bake, as its notice names it ("Save set aside: stops off the new map").
  'off-street': 'A save with stops off the new map',
};
const setAsideName = (why: SetAsideWhy): string => (why.startsWith('older-') ? `${SET_ASIDE_NAMES.older} (format ${why.slice(6)})` : SET_ASIDE_NAMES[why as keyof typeof SET_ASIDE_NAMES]);

/** The save list is read again at most this often while the store keeps writes (an autosave every 0.67 s at 5,400×). */
const LIST_EVERY_MS = 2_000;

/** A save in a line: when it is, its company, cash, lines and buses. */
const aboutText = (about: SaveAbout): string =>
  `${dateText(about.day)}, ${clock(about.hour, about.minute)} · ${about.company || 'no company yet'} · ${usd(about.cashCents)} · ${about.lines} ${about.lines === 1 ? 'line' : 'lines'} · ${about.buses} ${about.buses === 1 ? 'bus' : 'buses'}`;

/** When a save was saved, at the end of its line; nothing for one saved before the time was kept. */
function When({ about, testId }: { about: SaveAbout | null; testId: string }) {
  return about?.savedAt != null ? (
    <span className="when" data-testid={testId}>
      {' · '}
      {savedWhen(about.savedAt)}
    </span>
  ) : null;
}

/**
 * Saves (the M3 spec, item 8; the M5 spec, item 4): the autosave, which is this game as it plays,
 * three slots, and a save file out and in. The autosave and each slot name their game (day, company,
 * cash, lines and buses) and when it was saved. Loading a slot or a file replaces this game, and
 * saving over a slot or deleting one loses what it held, so each asks first; the sim reads the save
 * before anything changes and refuses one it cannot play, keeping this game and its autosave. A slot
 * this game cannot load says why and can be exported, and a save set aside by a new build is listed
 * until the player exports or deletes it, so none is lost unseen (D12). Export session hands over
 * this session for a bug report (the M3 spec, item 12).
 */
export function Saves({ sim, onClose, onHome }: { sim: Sim; onClose: () => void; onHome?: () => void }) {
  const { send } = sim;
  // Listed when Saves opens, and again as the store keeps writes, so the autosave's row keeps up with the
  // game; at most every LIST_EVERY_MS, since each listing has the worker read every save.
  const listedAt = useRef(-Infinity);
  useEffect(() => {
    const list = () => {
      listedAt.current = performance.now();
      send({ type: 'slots' });
    };
    const wait = LIST_EVERY_MS - (performance.now() - listedAt.current);
    if (wait <= 0) return list();
    const timer = window.setTimeout(list, wait);
    return () => window.clearTimeout(timer);
  }, [send, sim.stored]);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | SetAsideWhy | null>(null);
  const [replacing, setReplacing] = useState<number | null>(null);
  if (!sim.snapshot) return null;
  const autosave = sim.autosave;
  return (
    <aside className="panel saves" aria-label="Saves" data-testid="saves" data-chrome="panel">
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Saves</h2>
      {sim.storeRefused ? (
        <p className="hint" data-testid="saves-refused">
          {STORE_REFUSED_COPY}. Export this game to keep it.
        </p>
      ) : null}
      <ul className="slots">
        {sim.slots ? (
          <li data-testid="autosave" title={sim.storeRefused ? undefined : 'This game saves itself as it plays'}>
            <span>
              Autosave · {autosave ? aboutText(autosave) : 'Empty'}
              <When about={autosave} testId="autosave-when" />
            </span>
          </li>
        ) : null}
        {(sim.slots ?? []).map(({ slot, about, readable, why }) => (
          <li key={slot} data-testid={`slot-${slot}`} data-empty={about ? 'no' : 'yes'}>
            <span>
              Slot {slot} · {about ? aboutText(about) : readable ? 'Empty' : setAsideName(why ?? 'unreadable')}
              <When about={about} testId={`slot-${slot}-when`} />
            </span>
            <span className="controls">
              {replacing === slot ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setReplacing(null);
                      send({ type: 'save-slot', slot });
                    }}
                  >
                    Replace Slot {slot}
                  </button>
                  <button type="button" onClick={() => setReplacing(null)}>
                    Keep it
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    // A slot that holds a save, even one this game cannot load, is replaced only after a question.
                    if (!about && readable) return send({ type: 'save-slot', slot });
                    setConfirm(null);
                    setDeleting(null);
                    setReplacing(slot);
                  }}
                >
                  Save here
                </button>
              )}
              {/* Export stays beside Replace, so a save this game can't load can be kept before it is replaced. */}
              {!readable && deleting !== slot ? (
                <button type="button" onClick={() => send({ type: 'export-slot', slot })}>
                  Export
                </button>
              ) : null}
              {(about || !readable) && deleting !== slot && confirm !== slot && replacing !== slot ? (
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
              {about && confirm !== slot && deleting !== slot && replacing !== slot ? (
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
            <span>{setAsideName(why)}, set aside</span>
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
        <button type="button" title="For bug reports: everything since this quarter began, with every command, so it can be replayed" onClick={() => send({ type: 'export-session' })}>
          Export session
        </button>
        {onHome ? (
          <button type="button" onClick={onHome}>
            Back to Home
          </button>
        ) : null}
      </div>
    </aside>
  );
}
