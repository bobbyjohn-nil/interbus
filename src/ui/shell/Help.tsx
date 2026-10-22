import { Fragment } from 'react';
import { HELP_FLAT, HELP_KEYS, HELP_MAP, type HelpRow } from '../help';
import { useScrollStop } from '../scrollStop';

/** One table of Help's: each row's keys, or gesture, then what it does. */
function Rows({ rows, kind }: { rows: readonly HelpRow[]; kind: 'keys' | 'gestures' }) {
  return (
    <dl className={kind}>
      {rows.map((row) => (
        <Fragment key={row.keys.join()}>
          <dt>
            {row.keys.map((k, i) => (
              <Fragment key={k}>
                {i ? ` ${row.join} ` : null}
                {kind === 'keys' ? <kbd>{k}</kbd> : k}
              </Fragment>
            ))}
          </dt>
          <dd>{row.what}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

/**
 * Help (PLAN §10's week 14, ahead under D25's clearance; PLAN §8's keyboard shortcuts, UX-08): the keys the game answers, and
 * what the mouse, the fingers and the keys do on the map (help.ts). It opens with ?, from Home and from Saves, so it adds nothing
 * to the shell at rest (I13: 5.98% of its 6% late in a game). Its tables scroll under its heading and Close, a Tab stop while
 * they scroll, as a day card's rows are (useScrollStop), named apart from the panel so a screen reader says "Help" once.
 */
export function Help({ onClose }: { onClose: () => void }) {
  const [body, scrolls] = useScrollStop<HTMLDivElement>();
  return (
    <aside className="panel help" aria-label="Help" data-testid="help" data-chrome="panel">
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Help</h2>
      <div className="panel-body" ref={body} {...(scrolls ? { tabIndex: 0, role: 'region', 'aria-label': 'Keys and the map' } : {})}>
        <h3>Keys</h3>
        <Rows rows={HELP_KEYS} kind="keys" />
        <h3>On the map</h3>
        <Rows rows={HELP_MAP} kind="gestures" />
        <p className="note">{HELP_FLAT}</p>
      </div>
    </aside>
  );
}
