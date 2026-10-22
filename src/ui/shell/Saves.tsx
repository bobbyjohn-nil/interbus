import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { BACK_HOME_ASK_COPY, NEWER_LINE_COPY, SLOT_REFUSED_COPY, STORE_LINE_COPY, UNBACKED_ROW_TITLE, unbackedRowText } from '../copy';
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
 * cash, lines and buses) and when it was saved. Loading a slot or a file replaces this game once a
 * company is founded, and saving over a slot or deleting one loses what it held, so each asks first,
 * one question at a time, as Back to Home does where Home would drop this game's play since another tab
 * changed the autosave; the sim reads the save before anything changes and refuses one it cannot
 * play, keeping this game and its autosave. A slot this game cannot load says why and can be
 * exported, and a save set aside by a new build is listed until the player exports or deletes it, so
 * none is lost unseen (D12); so is one the game could not set aside, which it saves nothing over
 * meanwhile. A Save here the browser refused says so on its slot's row, with the way out, until the
 * slot is saved or a delete makes room. Export session hands over this session for a bug report (the M3 spec, item 12).
 */
export function Saves({ sim, onClose, onHome, onHelp }: { sim: Sim; onClose: () => void; onHome?: () => void; onHelp?: () => void }) {
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
  const [deleting, setDeleting] = useState<number | SetAsideWhy | 'unbacked' | null>(null);
  const [replacing, setReplacing] = useState<number | null>(null);
  // Import a save file asks as Load does, before the file is picked.
  const [importing, setImporting] = useState(false);
  // Back to Home asks too, while another tab's change to the autosave lasts and this game has moved on since (`movedOn`): Home
  // takes up the autosave, and the play since is kept nowhere (the systems audit's sixth round).
  const [leaving, setLeaving] = useState(false);
  // One question at a time: opening one closes any other.
  const closeQuestions = () => {
    setConfirm(null);
    setDeleting(null);
    setReplacing(null);
    setImporting(false);
    setLeaving(false);
  };
  // The keyboard keeps its place (the systems audit's fourth round): a question takes the place of the button pressed for
  // it, and an answer the question's, so the focus fell to the page, where the next Space ran time behind Saves. Pressed
  // from the keyboard (a key's click has detail 0), a question takes the focus to its keeping answer, never to the one that
  // deletes or replaces, so a second Space keeps the save; an answer gives it back to the button the question stood in for,
  // or to the question's row where that button goes with the save, or to Saves where the row goes too (a save set aside).
  const panel = useRef<HTMLElement>(null);
  const keyTo = useRef<{ readonly row: Element | null; readonly name: string | null } | null>(null);
  useEffect(() => {
    const to = keyTo.current;
    keyTo.current = null;
    if (!to) return;
    const named = [...(to.row?.querySelectorAll('button') ?? [])].find((b) => b.textContent === to.name);
    ((named ?? (to.row?.isConnected ? to.row : panel.current)) as HTMLElement | null)?.focus();
  });
  // Back to Home's question is the panel's last row: with every slot full at 1152×720 Saves reaches its height and scrolls, and
  // the answers sat half below its fold after a press of the mouse, which moves no focus (the review of the sixth round).
  useEffect(() => {
    if (leaving) panel.current?.querySelector('[data-testid="saves-home-ask"]')?.parentElement?.scrollIntoView({ block: 'nearest' });
  }, [leaving]);
  /** After a press from the keyboard, the focus goes to the button named `name` in the pressed one's row, or to that row (null), or to Saves (`row` false). */
  const keep = (event: MouseEvent<HTMLElement>, name: string | null, row = true) => {
    if (event.detail === 0) keyTo.current = { row: row ? event.currentTarget.closest('li, div.controls') : null, name };
  };
  if (!sim.snapshot) return null;
  const autosave = sim.autosave;
  /** Export and Delete, which asks first, for a save set aside or the one the start could not set aside. */
  const keepOrDelete = (id: SetAsideWhy | 'unbacked', why: SetAsideWhy) => (
    <span className="controls">
      <button type="button" onClick={() => send(id === 'unbacked' ? { type: 'export-unbacked' } : { type: 'export-set-aside', why })}>
        Export
      </button>
      {deleting === id ? (
        <>
          <button
            type="button"
            onClick={(e) => {
              keep(e, null, id === 'unbacked');
              setDeleting(null);
              send(id === 'unbacked' ? { type: 'delete-unbacked' } : { type: 'delete-set-aside', why });
            }}
          >
            Delete it
          </button>
          <button
            type="button"
            onClick={(e) => {
              keep(e, 'Delete');
              setDeleting(null);
            }}
          >
            Keep it
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            closeQuestions();
            keep(e, 'Keep it');
            setDeleting(id);
          }}
        >
          Delete
        </button>
      )}
    </span>
  );
  // A game to lose: before a company is founded, Load and Import ask nothing.
  const founded = sim.snapshot.company.name !== '';
  return (
    <aside className="panel saves" aria-label="Saves" data-testid="saves" data-chrome="panel" ref={panel} tabIndex={-1}>
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Saves</h2>
      {/* Another tab's change to the autosave first: while it lasts this game saves nothing of its own, room or none. */}
      {sim.newer || sim.storeRefused ? (
        <p className="hint" data-testid="saves-refused">
          {sim.newer ? NEWER_LINE_COPY : STORE_LINE_COPY[sim.storeRefused!]}
        </p>
      ) : null}
      <ul className="slots">
        {/* A save the start could not set aside holds the autosave's place, the live key, so its row says so: the panel grows by its buttons only (I13). */}
        {sim.slots || sim.unbacked ? (
          <li data-testid="autosave" title={sim.unbacked ? UNBACKED_ROW_TITLE : sim.storeRefused || sim.newer ? undefined : 'This game saves itself as it plays'} tabIndex={-1}>
            <span>
              Autosave · {sim.unbacked ? unbackedRowText(setAsideName(sim.unbacked)) : autosave ? aboutText(autosave) : 'Empty'}
              <When about={sim.unbacked ? null : autosave} testId="autosave-when" />
            </span>
            {sim.unbacked ? keepOrDelete('unbacked', sim.unbacked) : null}
          </li>
        ) : null}
        {(sim.slots ?? []).map(({ slot, about, readable, why }) => (
          <li key={slot} data-testid={`slot-${slot}`} data-empty={about ? 'no' : 'yes'} tabIndex={-1}>
            <span>
              Slot {slot} · {about ? aboutText(about) : readable ? 'Empty' : setAsideName(why ?? 'unreadable')}
              <When about={about} testId={`slot-${slot}-when`} />
            </span>
            {sim.slotsRefused.has(slot) ? (
              <p className="refusal" role="status" data-testid={`slot-${slot}-refused`}>
                {SLOT_REFUSED_COPY[sim.slotsRefused.get(slot)!]}
              </p>
            ) : null}
            {/* One rule for a row's question, as for Import's: while it is open the row's other buttons hide, so the row never wraps (I13); only Export stays beside Replace. */}
            <span className="controls">
              {replacing === slot ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      keep(e, 'Save here');
                      setReplacing(null);
                      send({ type: 'save-slot', slot });
                    }}
                  >
                    Replace Slot {slot}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      keep(e, 'Save here');
                      setReplacing(null);
                    }}
                  >
                    Keep it
                  </button>
                </>
              ) : (confirm === slot && about) || deleting === slot ? null : (
                <button
                  type="button"
                  onClick={(e) => {
                    // A slot that holds a save, even one this game cannot load, is replaced only after a question.
                    if (!about && readable) return send({ type: 'save-slot', slot });
                    closeQuestions();
                    keep(e, 'Keep it');
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
                <button
                  type="button"
                  onClick={(e) => {
                    closeQuestions();
                    keep(e, 'Keep it');
                    setDeleting(slot);
                  }}
                >
                  Delete
                </button>
              ) : null}
              {deleting === slot ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      keep(e, null);
                      setDeleting(null);
                      send({ type: 'delete-slot', slot });
                    }}
                  >
                    Delete Slot {slot}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      keep(e, 'Delete');
                      setDeleting(null);
                    }}
                  >
                    Keep it
                  </button>
                </>
              ) : null}
              {about && confirm !== slot && deleting !== slot && replacing !== slot ? (
                <button
                  type="button"
                  onClick={(e) => {
                    closeQuestions();
                    if (!founded) return send({ type: 'load-slot', slot });
                    keep(e, 'Keep playing');
                    setConfirm(slot);
                  }}
                >
                  Load
                </button>
              ) : null}
              {about && confirm === slot ? (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      keep(e, 'Load');
                      setConfirm(null);
                      send({ type: 'load-slot', slot });
                    }}
                  >
                    Replace this game
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      keep(e, 'Load');
                      setConfirm(null);
                    }}
                  >
                    Keep playing
                  </button>
                </>
              ) : null}
            </span>
          </li>
        ))}
        {(sim.setAside ?? []).map((why) => (
          <li key={why} data-testid={`set-aside-${why}`} className="set-aside" tabIndex={-1}>
            <span>{setAsideName(why)}, set aside</span>
            {keepOrDelete(why, why)}
          </li>
        ))}
      </ul>
      <div className="controls">
        {/* Import's question stands alone in its row, as Load's does in a slot's, so the row never wraps and Saves stays within I13's 26%. */}
        {importing ? null : (
          <button type="button" onClick={() => send({ type: 'export' })}>
            Export this game
          </button>
        )}
        {importing ? (
          <>
            <button
              type="button"
              onClick={(e) => {
                keep(e, 'Import a save file');
                setImporting(false);
                sim.importSave();
              }}
            >
              Replace this game
            </button>
            <button
              type="button"
              onClick={(e) => {
                keep(e, 'Import a save file');
                setImporting(false);
              }}
            >
              Keep playing
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              closeQuestions();
              if (!founded) return sim.importSave();
              keep(e, 'Keep playing');
              setImporting(true);
            }}
          >
            Import a save file
          </button>
        )}
      </div>
      {/* Back to Home's question stands alone in its row, its words above its answers, as Import's does. */}
      <div className="controls">
        {leaving && onHome ? (
          <>
            <p className="ask" id="saves-home-ask" data-testid="saves-home-ask">
              {BACK_HOME_ASK_COPY}
            </p>
            <button
              type="button"
              aria-describedby="saves-home-ask"
              onClick={() => {
                setLeaving(false);
                onHome();
              }}
            >
              Replace this game
            </button>
            <button
              type="button"
              aria-describedby="saves-home-ask"
              onClick={(e) => {
                keep(e, 'Back to Home');
                setLeaving(false);
              }}
            >
              Keep playing
            </button>
          </>
        ) : (
          <>
            <button type="button" title="For bug reports: everything since this quarter began, with every command, so it can be replayed" onClick={() => send({ type: 'export-session' })}>
              Export session
            </button>
            {onHome ? (
              <button
                type="button"
                onClick={(e) => {
                  // Nothing to lose: no company yet, nothing played since the change, or an autosave this build can't play, which
                  // Home leaves where it is, going on with this game (the review of the sixth round).
                  if (!(founded && sim.newer && sim.movedOn && sim.autosave)) return onHome();
                  closeQuestions();
                  keep(e, 'Keep playing');
                  setLeaving(true);
                }}
              >
                Back to Home
              </button>
            ) : null}
            {/* Help, in the game, where Saves is the one panel the chip row opens: it fits this row's 88 px to spare, so Saves
                grows no taller, and it takes Saves' place (I13). Home has its own. */}
            {onHelp ? (
              <button type="button" onClick={onHelp} title="Help (?)">
                Help
              </button>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}
