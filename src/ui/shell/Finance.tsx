import { Fragment, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { runOver } from '../game/runOver';
import { FARES_CENTS } from '../../sim/rules/fare';
import { isOperating, ROW_GROUP, type RowGroup, type RowKind } from '../../sim/rules/money';
import type { FinanceView } from '../../sim/types';
import { Dropdown } from '../Dropdown';
import { focusLost } from '../focusLost';
import { about, GROUP_NAMES, quarterText, ROW_HINTS, rowName, usd } from '../format';
import { giveFocus } from '../giveFocus';
import { useHeldFocus } from '../heldFocus';
import { bandText } from '../game/LineCard';
import type { Sim } from '../game/useSim';
import { showWhole } from '../showWhole';
import { tabTo } from '../tablist';
import { FinanceChart } from './FinanceChart';

/** Kinds the forecast models from riders rather than knows from the day plan. */
const MODELLED = new Set(['fares', 'subsidy']);
/** The groups the table lists, in order: what comes in, then what running and building cost (sim/rules/money.ts). */
const GROUPS = ['income', 'reward', 'running', 'capital'] as const;
const groupOf = (kind: string): RowGroup | undefined => (ROW_GROUP as Readonly<Record<string, RowGroup | undefined>>)[kind];
const operating = (kind: string) => groupOf(kind) !== undefined && isOperating(kind as RowKind);

export type FinanceViewName = 'overview' | 'breakdown' | 'lines';
const VIEWS: readonly (readonly [FinanceViewName, string])[] = [
  ['overview', 'Overview'],
  ['breakdown', 'Breakdown'],
  ['lines', 'Lines'],
];

/**
 * Finance (the M3 spec, item 6; D25: "it would be better with some visuals and better labeling with
 * more information about where the money is going"), in three views:
 * - **Overview:** cash, yesterday's and the quarter's running net, and a chart of the last 16 days (from Day 0 early in a game);
 * - **Breakdown:** every ledger row by kind under where the money comes from or goes, for today,
 *   yesterday and the quarter, beside a day's forecast, a line drawn today counted from the hour it was
 *   drawn; capital is in, so each column adds up to the change in cash over it. Each group's heading
 *   gives its subtotals and folds it; buying and building starts folded, so a late game's table stays
 *   inside I13's panel budget;
 * - **Lines:** each line's own money and its fare, the fare picked here (D25: "finances should be in
 *   the finances tab"), with the fares that make it the most.
 */
export function Finance({ sim, onClose, view: asked = 'overview', lineId = null }: { sim: Sim; onClose: () => void; view?: FinanceViewName; lineId?: number | null }) {
  const [view, setView] = useState<FinanceViewName>(asked);
  // A control the keyboard has in the body (useHeldFocus), gone from under it, gives the focus to the control now in its place
  // among the body's (`focusedAt`, where the focus last came), or the chosen view's tab: Ctrl+Z, taking back the day's only
  // purchase, took Breakdown's Buying and building, and taking back a line took its row in Lines and its fare list; a
  // quarter's close took the group as it emptied the quarter's column; and the focus fell to the page, where Space played or
  // paused the game under the quarter's report (the systems audit's twentieth round).
  const root = useRef<HTMLElement>(null);
  const focusedAt = useRef(0);
  const heldRef = useHeldFocus(root);
  useLayoutEffect(() => {
    const was = heldRef.current;
    if (!was || was.isConnected || !focusLost()) return;
    heldRef.current = null;
    const there = [...(root.current?.querySelectorAll<HTMLElement>('.panel-body button:not(:disabled)') ?? [])];
    const to = there[Math.min(focusedAt.current, there.length - 1)] ?? root.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (to) giveFocus(to);
  });
  const f = sim.snapshot?.finance;
  if (!f) return null;
  const sum = (pick: (r: FinanceView['rows'][number]) => number) => f.rows.reduce((s, r) => s + pick(r), 0);
  const today = sum((r) => r.todayCents);
  const quarter = sum((r) => r.quarterCents);
  // The views are tabs as Lines' are (tabTo): the arrows, Home and End move along them, and only the chosen one is in the Tab
  // order. Before, the arrows did nothing and the three views were three Tab stops (the systems audit's ninth round).
  const onViewKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = tabTo(event.key, VIEWS.map(([id]) => id), view);
    if (next === undefined) return;
    event.preventDefault();
    setView(next);
    event.currentTarget.querySelector<HTMLElement>(`[data-testid="finance-${next}"]`)?.focus();
  };
  return (
    <aside ref={root} className="panel finance" aria-label="Finance" data-testid="finance" data-chrome="panel" data-view={view} data-today={today} data-quarter={quarter} data-opening={f.openingCents}>
      <button type="button" className="close" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <h2>Finance</h2>
      <div className="segments" role="tablist" aria-label="Finance views" onKeyDown={onViewKey}>
        {VIEWS.map(([id, name]) => (
          <button key={id} type="button" role="tab" aria-selected={view === id} tabIndex={view === id ? 0 : -1} data-testid={`finance-${id}`} onClick={() => setView(id)}>
            {name}
          </button>
        ))}
      </div>
      {/* The body scrolls under the heading, Close and views, so they stay in reach however far it goes. */}
      <div
        className="panel-body"
        data-testid="finance-body"
        onFocus={(e) => {
          const k = [...e.currentTarget.querySelectorAll('button:not(:disabled)')].indexOf(e.target as Element);
          if (k >= 0) focusedAt.current = k;
        }}
      >
        {view === 'overview' ? <Overview finance={f} /> : view === 'breakdown' ? <Breakdown finance={f} today={today} quarter={quarter} /> : <Lines sim={sim} finance={f} open={lineId} />}
      </div>
    </aside>
  );
}

function Overview({ finance: f }: { finance: FinanceView }) {
  const net = (pick: (r: FinanceView['rows'][number]) => number) => f.rows.filter((r) => operating(r.kind)).reduce((s, r) => s + pick(r), 0);
  const cash = f.days.at(-1)?.cashCents ?? f.openingCents;
  return (
    <>
      <dl className="figures">
        <div>
          <dt>Cash</dt>
          <dd data-testid="finance-cash">{usd(cash)}</dd>
        </div>
        <div title="Fares and subsidy less running costs, yesterday">
          <dt>Yesterday’s running</dt>
          <dd>{f.day > 1 ? usd(net((r) => r.yesterdayCents)) : '—'}</dd>
        </div>
        <div title="Fares and subsidy less running costs, this quarter so far">
          <dt>{quarterText(f.quarterFirstDay)} so far</dt>
          <dd>{usd(net((r) => r.quarterCents))}</dd>
        </div>
      </dl>
      <FinanceChart finance={f} />
      <p className="hint legend">
        <span className="key in" /> Money in <span className="key out" /> Running costs <span className="key capital" /> Bought or sold · Day 0: starting cash {usd(f.openingCents)}
      </p>
    </>
  );
}

/** Groups folded at first: buying and building, the rows a late game has most of (I13). */
const FOLDED: readonly RowGroup[] = ['capital'];

export function Breakdown({ finance: f, today, quarter, fold = FOLDED }: { finance: FinanceView; today: number; quarter: number; fold?: readonly RowGroup[] }) {
  const [folded, setFolded] = useState<ReadonlySet<RowGroup>>(() => new Set(fold));
  const shown = f.rows.filter((r) => groupOf(r.kind) !== 'opening' && (r.todayCents !== 0 || r.yesterdayCents !== 0 || r.quarterCents !== 0 || (r.forecastCents ?? 0) !== 0));
  const sum = (rows: readonly FinanceView['rows'][number][], pick: (r: FinanceView['rows'][number]) => number) => rows.reduce((s, r) => s + pick(r), 0);
  const money = (cents: number, modelled = false) => `${modelled ? '≈' : ''}${usd(cents)}`;
  const toggle = (group: RowGroup) => setFolded((was) => (was.has(group) ? new Set([...was].filter((g) => g !== group)) : new Set([...was, group])));
  return (
    <table>
      <thead>
        <tr>
          {/* The rows' names have no heading, so their corner is a plain cell, not an empty one (axe-core's empty-table-header). */}
          <td />
          <th scope="col">Today</th>
          <th scope="col">Yesterday</th>
          <th scope="col">{quarterText(f.quarterFirstDay)}</th>
          <th scope="col" title="A day’s forecast, from today’s lines, fares and riders: a line you drew today counts from the hour you drew it">
            Day forecast
          </th>
        </tr>
      </thead>
      <tbody>
        {GROUPS.map((group) => {
          const rows = shown.filter((r) => groupOf(r.kind) === group);
          if (!rows.length) return null;
          const open = !folded.has(group);
          const forecast = rows.some((r) => r.forecastCents !== null) ? money(sum(rows, (r) => r.forecastCents ?? 0), rows.some((r) => MODELLED.has(r.kind))) : '—';
          return (
            <Fragment key={group}>
              <tr className="group" data-group={group} data-open={open ? 'yes' : 'no'}>
                <th scope="rowgroup">
                  <button type="button" aria-expanded={open} onClick={() => toggle(group)}>
                    {GROUP_NAMES[group]}
                  </button>
                </th>
                <td>{money(sum(rows, (r) => r.todayCents))}</td>
                <td>{f.day > 1 ? money(sum(rows, (r) => r.yesterdayCents)) : '—'}</td>
                <td>{money(sum(rows, (r) => r.quarterCents))}</td>
                <td>{forecast}</td>
              </tr>
              {open
                ? rows.map((r) => (
                    <tr key={r.kind} data-kind={r.kind} data-today={r.todayCents} data-yesterday={r.yesterdayCents} data-quarter={r.quarterCents} data-forecast={r.forecastCents ?? ''}>
                      <th scope="row" title={ROW_HINTS[r.kind as keyof typeof ROW_HINTS]}>
                        {rowName(r.kind)}
                      </th>
                      <td>{money(r.todayCents)}</td>
                      <td>{f.day > 1 ? money(r.yesterdayCents) : '—'}</td>
                      <td>{money(r.quarterCents)}</td>
                      <td>{r.forecastCents === null ? '—' : money(r.forecastCents, MODELLED.has(r.kind))}</td>
                    </tr>
                  ))
                : null}
            </Fragment>
          );
        })}
        <tr className="total">
          <th scope="row">Change in cash</th>
          <td>{money(today)}</td>
          <td>{f.day > 1 ? money(sum(f.rows, (r) => r.yesterdayCents)) : '—'}</td>
          <td>{money(quarter)}</td>
          <td>{money(sum(f.rows, (r) => r.forecastCents ?? 0), true)}</td>
        </tr>
      </tbody>
    </table>
  );
}

const FARE_OPTIONS = FARES_CENTS.map((c) => ({ value: c, label: usd(c, { cents: true }) }));

type LineCosts = FinanceView['lines'][number]['forecastCents'];
const NO_COSTS: LineCosts = { running: 0, wages: 0, deadhead: 0 };

/** A line's day as the plan forecasts it, on the day it was drawn from the hour it was drawn: its modelled riders' fares and subsidy, and its costs to the cent, the forecast column's own. */
function dayNet(incomeCents: number, c: LineCosts): number {
  return incomeCents - c.running - c.wages - c.deadhead;
}

function Lines({ sim, finance: f, open: asked }: { sim: Sim; finance: FinanceView; open: number | null }) {
  const lines = sim.snapshot?.lines ?? [];
  const [open, setOpen] = useState<number | null>(asked ?? lines[0]?.id ?? null);
  // The fare band is worked out for the open line only, again whenever the network changes.
  const { fareBandFor } = sim;
  const version = sim.snapshot?.linesVersion;
  useEffect(() => {
    fareBandFor(open);
    return () => fareBandFor(null);
  }, [fareBandFor, open, version]);
  const band = sim.fareBand && sim.fareBand.lineId === open ? sim.fareBand.band : null;
  // Opened on a line (the line card's "Fare and money in Finance"), Finance shows that line's row and its money, and once more
  // when its first fare band comes: a low line's were below the panel's foot, and the link seemed to do nothing (the systems
  // audit's seventh round). Never after that: each change of the network asks for the band again, and the panel jumped back to
  // the line however the player had scrolled it since (the review of the round's fixes). Nor once the player has scrolled it.
  const askedRow = useRef<HTMLTableRowElement>(null);
  const shown = useRef<{ readonly banded: boolean; readonly top: number } | null>(null);
  const banded = band !== null;
  useLayoutEffect(() => {
    const row = askedRow.current;
    const body = row?.closest<HTMLElement>('.panel-body');
    if (!row || !body || open !== asked) return;
    const last = shown.current;
    if (last && (last.banded || !banded || body.scrollTop !== last.top)) return;
    showWhole(body, row, row.nextElementSibling ?? row);
    shown.current = { banded, top: body.scrollTop };
  }, [asked, open, banded]);
  // "Yet" only before the first: a company that closed its lines has had some (the review of Close line).
  if (!lines.length) return <p className="hint">{sim.snapshot?.lineDrawn ? 'No lines' : 'No lines yet'}: draw one to see its money here.</p>;
  return (
    <table className="lines-money">
      <thead>
        <tr>
          <th scope="col">Line</th>
          <th scope="col">Riders a day</th>
          <th scope="col">Fare</th>
          <th scope="col" title="Its fares and subsidy less its running costs, yesterday">
            Yesterday
          </th>
          <th scope="col" title="A day’s forecast for the line: on the day you drew it, from the hour you drew it">
            Day forecast
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const money = f.lines.find((m) => m.id === line.id);
          const yesterday = money ? money.yesterdayInCents + money.yesterdayOutCents : 0;
          const expanded = open === line.id;
          const c = money?.forecastCents ?? NO_COSTS;
          const income = money?.incomeCents ?? 0;
          return (
            <Fragment key={line.id}>
              <tr ref={line.id === asked ? askedRow : undefined} data-testid={`line-money-${line.id}`} data-line={line.id} data-running={c.running} data-net={dayNet(income, c)} className={expanded ? 'open' : undefined}>
                <th scope="row">
                  <button type="button" className="line-name" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : line.id)}>
                    <span className="swatch" style={{ background: line.colour }} /> {line.name}
                  </button>
                </th>
                <td>{about(line.ridersPerDay)}</td>
                <td>
                  <Dropdown label={`Fare for ${line.name}`} value={line.fareCents} options={FARE_OPTIONS} testId={`fare-${line.id}`} disabled={runOver(sim)} onChange={(fareCents) => sim.send({ type: 'set-fare', lineId: line.id, fareCents })} />
                </td>
                <td>{f.day > 1 ? usd(yesterday) : '—'}</td>
                <td>≈{usd(dayNet(income, c))}</td>
              </tr>
              {expanded ? (
                <tr className="detail">
                  <td colSpan={5}>
                    <dl className="split" data-testid="line-forecast" data-running={c.running} data-wages={c.wages} data-deadhead={c.deadhead}>
                      <div>
                        <dt>Fares and subsidy</dt>
                        <dd>≈{usd(income)}</dd>
                      </div>
                      <div title={ROW_HINTS.running}>
                        <dt>{rowName('running')}</dt>
                        <dd>{usd(-c.running)}</dd>
                      </div>
                      <div>
                        <dt>{rowName('wages')}</dt>
                        <dd>{usd(-c.wages)}</dd>
                      </div>
                      <div title={ROW_HINTS.deadhead}>
                        <dt>{rowName('deadhead')}</dt>
                        <dd>{usd(-c.deadhead)}</dd>
                      </div>
                    </dl>
                    {band ? (
                      <p className="hint" data-testid="fare-band" data-from={band.fromCents} data-to={band.toCents}>
                        {bandText(band)}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
