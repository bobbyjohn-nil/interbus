import type { Speed } from '../../sim/types';
import { CREDIT_LIMIT_CENTS } from '../../sim/rules/credit';
import { MEDAL_IDS } from '../../sim/rules/medal';
import { calendarOfDay } from '../../sim/rules/calendar';
import { RUNNING_SPEEDS } from '../../sim/rules/speed';
import { undoText } from '../copy';
import { Dropdown } from '../Dropdown';
import { about, clockText, dateText, MEDAL_NAMES, quarterText, SPEED_HINTS, speedText, usd, usdK } from '../format';
import { CHECKLIST, checklistStep, checklistText } from '../game/checklist';
import type { Sim } from '../game/useSim';

const SPEED_OPTIONS = RUNNING_SPEEDS.map((speed) => ({ value: speed, label: speedText(speed), hint: SPEED_HINTS[speed] }));

/**
 * The calm shell's chip row (PLAN §8, the M2 spec item 7): labelled chips for the date and clock,
 * the speed, Cash, Riders/day and the day's costs, and the checklist's next step (K20). The speed
 * waits until the company is founded. While paused, Undo names the command it would take back (I9);
 * below the credit line's floor, a countdown names the day closes left (D10). The checklist's last
 * step opens Contracts, and once the checklist is done its place is the Contracts chip (the M3 spec,
 * items 11 and 12), so contracts add nothing to the shell at rest (I13). The medals held show there
 * too, a dot of each one's metal; the Contracts panel names the ladder and the trips left to silver
 * (the M4 spec, item 3), since a chip of its own broke I13 (DECISIONS, Measured). The undo takes the
 * room the row has left: whole where there is room, cut short with an ellipsis only when the row is full,
 * and named in full in its title and to a screen reader, so the countdown, the undo and the Contracts chip
 * keep to one row at 1152×720 (the systems audit's third round; app.css). Once the undo is down to its
 * least, the checklist's step or the Contracts chip is cut the same way, its medals kept whole, so a late
 * game's chips keep to one row too (the fourth round).
 */
export function TopBar({ sim, playSpeed, onContracts }: { sim: Sim; playSpeed: Exclude<Speed, 0>; onContracts: () => void }) {
  const s = sim.snapshot;
  if (sim.status !== 'ready' || !s) return null;
  const founded = s.company.name !== '';
  const progress = { depots: s.depots.length, lines: s.lines.length, elapsed: s.elapsed, profitableDays: s.profitableDays, contractTaken: s.contractTaken };
  const checklist = checklistText(progress);
  const toContracts = checklistStep(progress) === CHECKLIST.indexOf('Take a contract');
  const held = s.contracts.filter((c) => c.held).length;
  const offers = held > 0 ? `${held} held` : `${s.contracts.length} on offer`;
  const medals = MEDAL_IDS.filter((m) => s.medals[m] !== null);
  const undo = s.undo ? undoText(s.undo) : null;
  return (
    <header className="top-bar" aria-label="Company" data-testid="sim-panel" data-chrome="rest" data-cash={s.cashCents} data-elapsed={s.elapsed} data-speed={s.speed} data-costs={s.costsPerDayCents}>
      <span className="chip date" title={dateText(s.day)} data-testid="date">
        <span className="chip-label">{quarterText(s.day)}</span> Day {calendarOfDay(s.day).dayOfQuarter}, {clockText(s.hour, s.minute, s.rate)}
      </span>
      {founded ? (
        <span className="chip speed" role="group" aria-label="Speed">
          <button
            type="button"
            className="play"
            aria-label={s.speed === 0 ? 'Play' : 'Pause'}
            title={s.speed === 0 ? 'Play (Space)' : 'Pause (Space)'}
            data-testid="play"
            onClick={() => sim.send({ type: 'speed', speed: s.speed === 0 ? playSpeed : 0 })}
          >
            <span className={s.speed === 0 ? 'icon-play' : 'icon-pause'} aria-hidden="true" />
          </button>
          <Dropdown label="Speed" value={s.speed === 0 ? playSpeed : s.speed} options={SPEED_OPTIONS} repick testId="speed-menu" onChange={(speed) => sim.send({ type: 'speed', speed })} />
        </span>
      ) : null}
      <span className="chip">
        <span className="chip-label">Cash</span> {usd(s.cashCents)}
      </span>
      <span className="chip">
        <span className="chip-label">Riders/day</span> {about(s.ridersPerDay)}
      </span>
      {s.costsPerDayCents > 0 ? (
        <span className="chip">
          <span className="chip-label">Costs/day</span> {usd(s.costsPerDayCents)}
        </span>
      ) : null}
      {s.floor && !s.floor.ended ? (
        <span className="chip countdown" data-testid="countdown" data-left={s.floor.closesLeft}>
          {s.floor.closesLeft} {s.floor.closesLeft === 1 ? 'day' : 'days'} to get above {usdK(-CREDIT_LIMIT_CENTS)}
        </span>
      ) : null}
      {undo ? (
        <button type="button" className="chip undo" data-testid="undo" title={undo} onClick={() => sim.send({ type: 'undo' })}>
          <span className="chip-text">{undo}</span>
        </button>
      ) : null}
      {founded && checklist && !toContracts ? (
        <span className="chip checklist" data-testid="checklist" title={checklist}>
          <span className="chip-text">{checklist}</span>
        </span>
      ) : null}
      {founded && checklist && toContracts ? (
        <button type="button" className="chip checklist" data-testid="checklist" title={checklist} onClick={onContracts}>
          <span className="chip-text">{checklist}</span>
        </button>
      ) : null}
      {founded && !checklist ? (
        <button type="button" className="chip contracts" data-testid="contracts-chip" title={`Contracts ${offers}`} onClick={onContracts}>
          <span className="chip-text">
            <span className="chip-label">Contracts</span> {offers}
          </span>
          {medals.length > 0 ? (
            <span className="medals" data-testid="medals" data-held={medals.join(' ')}>
              {medals.map((m) => (
                <span key={m} className="medal" data-medal={m} title={`${MEDAL_NAMES[m]} medal`} />
              ))}
            </span>
          ) : null}
        </button>
      ) : null}
    </header>
  );
}
