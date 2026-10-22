import { Fragment, useState, type KeyboardEvent } from 'react';
import { externalLink, ownFile } from '../../platform';
import { CREDITS, CREDITS_GAME } from '../credits';
import { HELP_FLAT, HELP_KEYS, HELP_MAP, type HelpRow } from '../help';
import { useScrollStop } from '../scrollStop';
import { tabTo } from '../tablist';

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

/** The keys and what the map takes (help.ts). */
function Keys() {
  return (
    <>
      <h3>Keys</h3>
      <Rows rows={HELP_KEYS} kind="keys" />
      <h3>On the map</h3>
      <Rows rows={HELP_MAP} kind="gestures" />
      <p className="note">{HELP_FLAT}</p>
    </>
  );
}

/** Everything LICENSE-DATA.md credits (credits.ts), each page through the platform's allowlist and each licence text the build's own. */
function Credits() {
  return (
    <>
      <p>{CREDITS_GAME}</p>
      {CREDITS.map((group) => (
        <Fragment key={group.heading}>
          <h3>{group.heading}</h3>
          <dl className="gestures">
            {group.rows.map((row) => (
              <Fragment key={row.name}>
                <dt>{row.url ? <a {...externalLink(row.url)}>{row.name}</a> : row.name}</dt>
                <dd>
                  {row.what}
                  {row.file ? (
                    <>
                      {'. '}
                      <a {...ownFile(row.file.path)}>{row.file.text}</a>
                    </>
                  ) : null}
                </dd>
              </Fragment>
            ))}
          </dl>
        </Fragment>
      ))}
    </>
  );
}

export type HelpView = 'keys' | 'credits';

/** Help's two views, as its tabs name them. */
const VIEWS: readonly (readonly [HelpView, string])[] = [
  ['keys', 'Keys and the map'],
  ['credits', 'Credits'],
];

/**
 * Help (PLAN §10's week 14, ahead under D25's clearance), in two views. Its keys and the map's gestures are PLAN §8's keyboard
 * shortcuts (UX-08; help.ts), and its credits are the credits screen (PLAN §10; credits.ts). It opens with ?, from Home and from
 * Saves, so it adds nothing to the shell at rest (I13: 5.98% of its 6% late in a game). The views are tabs as Finance's are
 * (tabTo). What a view holds scrolls under the heading, Close and tabs, a Tab stop while it scrolls, as a day card's rows are
 * (useScrollStop), named by its view so a screen reader says "Help" once; keyed by the view, so each is measured afresh.
 */
export function Help({ onClose, view: asked = 'keys' }: { onClose: () => void; view?: HelpView }) {
  const [view, setView] = useState<HelpView>(asked);
  const [body, scrolls] = useScrollStop<HTMLDivElement>();
  const onViewKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = tabTo(event.key, VIEWS.map(([id]) => id), view);
    if (next === undefined) return;
    event.preventDefault();
    setView(next);
    event.currentTarget.querySelector<HTMLElement>(`[data-testid="help-${next}"]`)?.focus();
  };
  const name = VIEWS.find(([id]) => id === view)![1];
  return (
    <aside className="panel help" aria-label="Help" data-testid="help" data-chrome="panel" data-view={view}>
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Help</h2>
      <div className="segments" role="tablist" aria-label="Help views" onKeyDown={onViewKey}>
        {VIEWS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} tabIndex={view === id ? 0 : -1} data-testid={`help-${id}`} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      <div key={view} className="panel-body" ref={body} {...(scrolls ? { tabIndex: 0, role: 'region', 'aria-label': name } : {})}>
        {view === 'keys' ? <Keys /> : <Credits />}
      </div>
    </aside>
  );
}
