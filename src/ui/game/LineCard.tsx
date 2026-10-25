import { useId, useLayoutEffect, useRef, useState } from 'react';
import { busesNeeded, cyclesOf } from '../../sim/rules/cycle';
import { HEADWAY_MINUTES, sameHeadways, type Period } from '../../sim/rules/periods';
import { BUS_MODELS, MODEL_IDS, checkHeadwayChange, checkModelChange, checkSellSpares, type FleetContext } from '../../sim/rules/line';
import { planIsExpress } from '../../sim/rules/express';
import { modelLocked } from '../../sim/rules/medal';
import { runningHeadwayIn } from '../../sim/rules/timetable';
import type { BusModelId, FareBandView, HeadwaysData, LineView } from '../../sim/types';
import { refusalText } from '../copy';
import { Dropdown } from '../Dropdown';
import { useFocusBack } from '../focusBack';
import { focusLost } from '../focusLost';
import { giveFocus } from '../giveFocus';
import { useHeldFocus } from '../heldFocus';
import { showInBody } from '../showWhole';
import { runOver } from './runOver';
import { about, busCount, clock, duration, figureText, PERIOD_NAMES, streetName, usd, usdK } from '../format';
import type { Sim } from './useSim';

/** Headways a player picks from, in minutes; overnight adds "off". */
const PERIODS = [
  ['peak', PERIOD_NAMES.peak],
  ['offpeak', PERIOD_NAMES.offpeak],
  ['overnight', PERIOD_NAMES.overnight],
] as const;

/** Each period as a sentence names it: "every 16 min at peak, off-peak and overnight". */
const PERIOD_WORDS: Readonly<Record<Period, string>> = { peak: 'at peak', offpeak: 'off-peak', overnight: 'overnight' };

/**
 * What a line short of buses runs: the headway Contracts and the timetable read (runningHeadwayIn, GD-05), the periods it runs
 * it in, the longest headway set among them, and the buses it is short; null while it runs as set. Snow and roadworks lengthen a
 * round trip and buy no bus, and the card showed only the headways set: "Every 15 min" for a line running every 16.1 (the
 * systems audit's fourteenth round).
 */
export function shortOfBuses(line: LineView): { readonly runs: number; readonly set: number; readonly periods: string; readonly buses: number } | null {
  const timing = { cycle: line.cycle, cycles: line.cycles, headways: line.headways, buses: line.buses };
  const slow = PERIODS.flatMap(([period]) => {
    const set = line.headways[period];
    const runs = runningHeadwayIn(timing, period);
    return set !== null && runs !== null && runs > set ? [{ period, runs, set }] : [];
  });
  if (!slow.length) return null;
  const words = slow.map((p) => PERIOD_WORDS[p.period]);
  const periods = words.length === 1 ? words[0]! : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
  return { runs: Math.max(...slow.map((p) => p.runs)), set: Math.max(...slow.map((p) => p.set)), periods, buses: busesNeeded(line.cycles, line.headways) - line.buses };
}

/**
 * A headway pick on the line card: the three headways as picked, and what they were picked against: the line's headways
 * then, and the game (Sim's `loaded.at`, which a slot or a file loaded and Restart this quarter move).
 */
export interface HeadwayPick {
  readonly headways: HeadwaysData;
  readonly base: HeadwaysData;
  readonly game: number | null;
}

/** `period` set to `seconds` (null: off) on the card as it shows: the pick it still holds, or else the line's own headways. */
export function pickHeadway(held: HeadwayPick | null, line: { readonly headways: HeadwaysData }, game: number | null, period: Period, seconds: number | null): HeadwayPick {
  return { headways: { ...(held?.headways ?? line.headways), [period]: seconds }, base: line.headways, game };
}

/**
 * The pick as the line and the game now stand, so the card never shows or sends a headway the line does not run unless the
 * player picked it since the line last changed: null once the line's headways changed under the card (an undo) or another game
 * took this one's place (a slot or a file loaded, Restart this quarter), and `pick` itself otherwise.
 */
export function heldPick(pick: HeadwayPick | null, line: { readonly headways: HeadwaysData }, game: number | null): HeadwayPick | null {
  return pick && pick.game === game && sameHeadways(pick.base, line.headways) ? pick : null;
}

/** A model pick on the line card, and what it was picked against: the line's model then, and the game, as HeadwayPick. */
export interface ModelPick {
  readonly model: BusModelId;
  readonly base: BusModelId;
  readonly game: number | null;
}

/** The model pick as the line and the game now stand: null once the line's model changed under the card or another game took this one's place. */
export function heldModel(pick: ModelPick | null, line: { readonly model: BusModelId }, game: number | null): ModelPick | null {
  return pick && pick.game === game && pick.base === line.model ? pick : null;
}

/** The change card for the pick held: the headway rule's verdict on it (GD-05), or no card for no pick or the line's own headways picked back, which are no change. */
export function headwayChange(fleet: FleetContext, line: Pick<LineView, 'cycle' | 'cycles' | 'buses' | 'model' | 'headways'>, held: HeadwayPick | null) {
  if (!held) return null;
  const verdict = checkHeadwayChange(fleet, { cycle: line.cycle, cycles: line.cycles, buses: line.buses, model: BUS_MODELS[line.model], headways: line.headways }, held.headways);
  return !verdict.ok && verdict.reason === 'same_headways' ? null : verdict;
}

/**
 * Whether a headway change buys buses, which its button names (Buy and run, not Run it): one refused for the depots' room or for
 * the cash does too, since only a change that buys needs either. Named Run it while refused, a close's Buy and run changed its
 * name under the keyboard (the review of the systems audit's sixteenth round).
 */
export function buysBuses(change: ReturnType<typeof checkHeadwayChange>): boolean {
  return change.ok ? change.extra > 0 : change.reason === 'depot_full' || change.reason === 'insufficient_funds';
}

/**
 * A line's heading: its colour, its name and, for an express, the word. The Lines panel draws it above its line tabs, so
 * the heading it is dragged by (D25) is its first line, as on every panel, however many lines there are (Inspector.tsx).
 */
export function LineHeading({ line }: { line: LineView }) {
  return (
    <h2>
      <span className="swatch" style={{ background: line.colour }} /> {line.name}
      {/* A space before the word, so a screen reader names the line "Line 2 Express", not "Line 2Express" (the systems audit's
          fifteenth round); the badge's margin is the rest of the gap. */}
      {planIsExpress(line) ? (
        <>
          {' '}
          <span className="express" data-testid="express" title="Express: 5 km or longer, with stops at least 1.2 km apart on average. Riders feel the ride is quicker and mind the fare half as much.">
            Express
          </span>
        </>
      ) : null}
    </h2>
  );
}

/**
 * A line's card: its riders, its round trip at peak and off-peak and what roadworks or snow add to it (the M4
 * spec, item 2), the headway it runs while they leave it short of buses (shortOfBuses), when its buses fill (K27),
 * its buses and their model, its fare (set in Finance's
 * Lines with the band of fares that net the most, D25), and three headways (D7). A headway that needs
 * more buses reads "Needs 3 buses (you have 2) · $95k" and confirming buys them (GD-09); another model
 * reads "2 Metro 40s · $520k, $95k back for the Sparrows". Each is the rule its command checks
 * (sim/rules/line.ts, GD-05). Its heading is the Lines panel's (LineHeading).
 */
export function LineCard({ sim, line, onFinance, onStop }: { sim: Sim; line: LineView; onFinance?: () => void; onStop?: (stopId: number, from: HTMLElement) => void }) {
  const [wanted, setWanted] = useState<HeadwayPick | null>(null);
  const [modelPick, setModelPick] = useState<ModelPick | null>(null);
  // A change picked, of headways or of model, shows its card whole, its Run it or Buy and swap with it: a low line's, under many
  // lines' tabs, or in a panel dragged low, was below the panel's foot, and nothing scrolled to it (the systems audit's seventh
  // and eighth rounds). The panel's body scrolls, never its heading and Close.
  const changeCard = useRef<HTMLDivElement>(null);
  const swapCard = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => showInBody(changeCard.current), [wanted]);
  useLayoutEffect(() => showInBody(swapCard.current), [modelPick]);
  // A change card's buttons and Sell them go with their card, so the focus goes back to the control the card came from: the
  // headway last picked, or the Buses list (useFocusBack).
  const handBack = useFocusBack();
  // The line and its bus count Sell them was pressed at: one press, one sale (D26), so a second press before the sale lands
  // sends nothing (two Enters sent two, and the second's refusal said the line needed every bus). Its buses changing, another
  // line or a refusal lets it go.
  const [soldAt, setSoldAt] = useState<{ lineId: number; buses: number } | null>(null);
  const root = useRef<HTMLElement>(null);
  const lastPeriod = useRef<Period>('peak');
  const toModel = () => root.current?.querySelector<HTMLElement>('[data-testid="line-model"]');
  const toHeadway = () => root.current?.querySelector<HTMLElement>(`[data-testid="headway-${lastPeriod.current}"]`);
  /** The stop's button `k`th in the stops row, or the row's last where the row is shorter now. */
  const toStop = (k: number) => {
    const row = root.current?.querySelectorAll<HTMLElement>('[data-testid="line-stops"] button');
    return row?.length ? (row[Math.min(k, row.length - 1)] ?? null) : null;
  };
  // What a change card says, which describes its button and is its status: refused, the words why are heard as they come and
  // as the button is reached (the review of the systems audit's sixteenth round: refused, nothing said why).
  const changeSaid = useId();
  const swapSaid = useId();
  // A control of the card that goes from under the keyboard by something other than its own press, which hands the focus on
  // (handBack), gives it to the control its card came from: Sell it, gone as a close's snow left the line needing every bus,
  // and a change card's buttons, gone as Ctrl+Z took back the change their pick was made against. The focus fell to the page,
  // where Space ran the game (the systems audit's seventeenth round). A stop's button, gone as Ctrl+Z took back the route edit
  // that added its stop, gives it to the stop now in its place in the row, or to the row's last (the round's review). Only the
  // control the keyboard has is handed on (useHeldFocus): one the mouse focused, or left by a press on the card's text, handed
  // the headway Space, which opened its list in place of playing (the round's review).
  const heldRef = useHeldFocus(root);
  useLayoutEffect(() => {
    const was = heldRef.current;
    if (!was || was.isConnected || !focusLost()) return;
    heldRef.current = null;
    // A change card goes whole, its buttons in it; a stop's button goes alone, out of its row.
    const card = was.closest('[data-testid]')?.getAttribute('data-testid');
    const stopAt = was.getAttribute('data-stop-at');
    const to =
      stopAt !== null
        ? toStop(Number(stopAt))
        : card === 'headway-change'
          ? toHeadway()
          : card === 'model-change' || card === 'line-spares'
            ? toModel()
            : null;
    if (to) giveFocus(to);
  });
  const s = sim.snapshot;
  if (!s) return null;
  const over = runOver(sim);
  if (soldAt && (soldAt.lineId !== line.id || soldAt.buses !== line.buses || sim.refusal?.command === 'sell-spares')) setSoldAt(null);
  const game = sim.loaded?.at ?? null;
  // A pick made before an undo or a load is dropped, not sent with the line as it now stands.
  const held = heldPick(wanted, line, game);
  if (held !== wanted) setWanted(held);
  const keptModel = heldModel(modelPick, line, game);
  if (keptModel !== modelPick) setModelPick(keptModel);
  const wantedModel = keptModel?.model ?? null;
  const setWantedModel = (id: BusModelId | null) => setModelPick(id === null ? null : { model: id, base: line.model, game });
  const snow = s.event?.kind === 'snow' && s.event.phase === 'on';
  const fleet = { depots: s.depots.length, busesOwned: s.lines.reduce((n, l) => n + l.buses, 0), cashCents: s.cashCents, medals: s.medals };
  const next = held?.headways ?? line.headways;
  const model = BUS_MODELS[line.model];
  const change = headwayChange(fleet, line, held);
  const swap = wantedModel
    ? checkModelChange(fleet, { routeM: line.stopDistM[line.stopDistM.length - 1] ?? 0, stops: line.stops.length, rush: line.rush, worksM: line.worksM, snow, buses: line.buses, model, headways: line.headways }, BUS_MODELS[wantedModel])
    : null;
  // The same round trip on clear streets: what today's roadworks or snow add is the difference (sim/rules/cycle.ts).
  const clear = cyclesOf(line.stopDistM[line.stopDistM.length - 1] ?? 0, line.stops.length, model.kmh, line.rush);
  const works = line.worksM > 0 && s.event ? { street: streetName(s.event.street), addS: line.cycles.peak - clear.peak } : null;
  const snowAddS = snow ? line.cycles.peak - clear.peak : 0;
  const short = shortOfBuses(line);
  const pick = (period: Period, value: string) => {
    lastPeriod.current = period;
    setWanted(pickHeadway(held, line, game, period, value === 'off' ? null : Number(value) * 60));
  };
  // Buses its headways no longer need, parked in their depot places: sold, the places are free for another line (the late game
  // at the bus ceiling, DECISIONS, Open, its recommended (a)), on the rule the command checks (GD-05).
  const spares = checkSellSpares({ buses: line.buses, cycle: line.cycle, cycles: line.cycles, model, headways: line.headways });
  return (
    <section ref={root} className="line-card" aria-label={line.name} data-testid="line-card" data-line={line.id} data-model={line.model} data-running={s.finance.lines.find((m) => m.id === line.id)?.forecastCents.running ?? 0}>
      <p>
        {about(line.ridersPerDay)} riders a day · {busCount(line.buses, model.name)}
      </p>
      {line.cycles.peak > 0 ? (
        <p className="round-trip" data-testid="round-trip" data-peak={line.cycles.peak} data-works-s={works?.addS ?? 0} data-snow-s={snowAddS}>
          Round trip {duration(line.cycles.peak)} at peak, {duration(line.cycles.offpeak)} off-peak
          {works ? ` · roadworks on ${works.street} add ${duration(works.addS, true)}` : null}
          {snow ? ` · snow adds ${duration(snowAddS, snowAddS < 120)}` : null}
        </p>
      ) : null}
      {short ? (
        <p className="short-of-buses" data-testid="line-short" data-runs={short.runs} data-short={short.buses}>
          {/* In Contracts' words for the same seconds (figureText): "every 15.0 min" for 901 s, where Contracts said "every 15 min 1 s" (the review of the round's fixes). */}
          {short.buses === 1 ? 'A bus' : `${short.buses} buses`} short{snow ? ' in the snow' : works ? ' for the roadworks' : ''}: runs {figureText('headway', short.runs, short.set)} {short.periods}
        </p>
      ) : null}
      {line.fullAtMinute !== null ? (
        <p className="full" data-testid="line-full">
          Full at {clock(Math.floor(line.fullAtMinute / 60), line.fullAtMinute % 60)} · {about(line.turnedAwayPerDay)} riders a day turned away
        </p>
      ) : null}
      <div className="model">
        <span>Buses</span>
        <Dropdown
          label="Buses"
          testId="line-model"
          disabled={over}
          value={wantedModel ?? line.model}
          options={MODEL_IDS.map((id) => {
            const locked = modelLocked(BUS_MODELS[id], s.medals);
            return { value: id, label: `${BUS_MODELS[id].name} · ${BUS_MODELS[id].seats} seats${locked ? ' · locked' : ''}`, disabled: locked, ...(locked ? { hint: 'A silver medal unlocks it' } : {}) };
          })}
          onChange={(id: BusModelId) => setWantedModel(id === line.model ? null : id)}
        />
      </div>
      {swap && wantedModel ? (
        <div className="change" ref={swapCard} data-testid="model-change" data-ok={swap.ok ? 'yes' : 'no'}>
          <p id={swapSaid} className={swap.ok ? undefined : 'refusal'} role="status">
            {swap.ok
              ? `${busCount(swap.needed, BUS_MODELS[wantedModel].name)} · ${usdK(swap.buyCents)}, ${usdK(swap.saleCents)} back for the ${busCount(line.buses, model.name).replace(/^\d+ /, '')}`
              : refusalText(swap)}
          </p>
          <div className="controls">
            <button
              type="button"
              disabled={over}
              aria-disabled={swap.ok ? undefined : true}
              aria-describedby={swapSaid}
              onClick={(e) => {
                if (!swap.ok) return;
                handBack(e.currentTarget, toModel);
                sim.send({ type: 'set-model', lineId: line.id, model: wantedModel });
                setWantedModel(null);
              }}
            >
              Buy and swap
            </button>
            <button
              type="button"
              onClick={(e) => {
                handBack(e.currentTarget, toModel);
                setWantedModel(null);
              }}
            >
              Keep as is
            </button>
          </div>
        </div>
      ) : null}
      {spares.ok ? (
        <div className="spares" data-testid="line-spares" data-sold={spares.sold}>
          <p>
            {spares.sold} of its {busCount(line.buses, model.name)} {spares.sold === 1 ? 'is' : 'are'} spare: it needs {spares.needed}
          </p>
          <div className="controls">
            <button
              type="button"
              disabled={over}
              onClick={(e) => {
                if (soldAt?.lineId === line.id) return;
                setSoldAt({ lineId: line.id, buses: line.buses });
                handBack(e.currentTarget, toModel);
                sim.send({ type: 'sell-spares', lineId: line.id });
              }}
            >
              Sell {spares.sold === 1 ? 'it' : 'them'} · {usdK(spares.saleCents)} back
            </button>
          </div>
        </div>
      ) : null}
      {/* The fare is a money lever: it is set in Finance's Lines, beside the line's money (D25). */}
      <p className="fare" data-testid="line-fare" data-fare={line.fareCents}>
        Fare {usd(line.fareCents, { cents: true })}
        {onFinance ? (
          <button type="button" className="link" onClick={onFinance}>
            Fare and money in Finance
          </button>
        ) : null}
      </p>
      <div className="headways">
        {PERIODS.map(([period, label]) => (
          <div key={period} className="headway">
            <span>{label}</span>
            <Dropdown
              label={label}
              testId={`headway-${period}`}
              disabled={over}
              value={next[period] === null ? 'off' : String((next[period] ?? 0) / 60)}
              options={[...(period === 'overnight' ? [{ value: 'off', label: 'Off' }] : []), ...HEADWAY_MINUTES.map((m) => ({ value: String(m), label: `Every ${m} min` }))]}
              onChange={(value) => pick(period, value)}
            />
          </div>
        ))}
      </div>
      {change ? (
        <div className="change" ref={changeCard} data-testid="headway-change" data-ok={change.ok ? 'yes' : 'no'}>
          <p id={changeSaid} className={change.ok ? undefined : 'refusal'} role="status">
            {!change.ok
              ? refusalText(change)
              : change.extra > 0
                ? `Needs ${change.needed} buses (you have ${line.buses}) · ${usdK(change.priceCents)}`
                : change.needed < line.buses
                  ? `Needs ${change.needed} of the ${line.buses} buses it has`
                  : `Runs with the ${line.buses} ${line.buses === 1 ? 'bus' : 'buses'} it has`}
          </p>
          <div className="controls">
            <button
              type="button"
              disabled={over}
              aria-disabled={change.ok ? undefined : true}
              aria-describedby={changeSaid}
              onClick={(e) => {
                if (!change.ok) return;
                handBack(e.currentTarget, toHeadway);
                sim.send({ type: 'set-headways', lineId: line.id, headways: next });
                setWanted(null);
              }}
            >
              {/* Refused for the room or the cash, it still buys: its name stays as the close refuses it under the keyboard. */}
              {buysBuses(change) ? 'Buy and run' : 'Run it'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                handBack(e.currentTarget, toHeadway);
                setWanted(null);
              }}
            >
              Keep as is
            </button>
          </div>
        </div>
      ) : null}
      {onStop ? (
        // Its stops in route order, each opening its card: the keyboard's way to a stop, where the map has only a press on it
        // (the accessibility pass). Last, so one Tab still goes from the tabs to Buses (many.spec), not through every stop.
        <p className="stops" data-testid="line-stops">
          Stops
          {line.stopIds.map((id, k) => (
            <button key={id} type="button" aria-label={`Stop ${id}`} data-stop-at={k} onClick={(e) => onStop(id, e.currentTarget)}>
              {id}
            </button>
          ))}
        </p>
      ) : null}
    </section>
  );
}

/** "Most profit at $1.75–$2.00": the fares whose day nets within 5% of the best. */
export function bandText(band: FareBandView): string {
  const from = usd(band.fromCents, { cents: true });
  return band.fromCents === band.toCents ? `Most profit at ${from}` : `Most profit at ${from}–${usd(band.toCents, { cents: true })}`;
}
