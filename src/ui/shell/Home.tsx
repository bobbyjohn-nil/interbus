import { useEffect, useState } from 'react';
import { dateText, usd } from '../format';
import type { Sim } from '../game/useSim';

/**
 * Home (the M5 spec, item 3; UX-07, V1's menu, `Intralines@7af45b1:src/ui/Menu.tsx:104-253`): the
 * first screen, over the paused, flat map. Continue goes on with the game that saves itself as it
 * plays, named by its company, day and cash; New game starts an unnamed company, asking first when it
 * would replace that game (V1 asked too); Saves opens the slots, Help the keys and the map's gestures, and Credits Help on its
 * credits (Help.tsx), each in turn beside Home's card. Settings wait for week 14. The build chip stays in its corner. While it stands, a game another tab saves becomes this
 * one (useSim), so Continue names and plays the game the browser holds now, not the one read when this
 * tab opened (the systems audit's fifth round).
 */
export function Home({ sim, onContinue, onNewGame, onSaves, onHelp, onCredits }: { sim: Sim; onContinue: () => void; onNewGame: () => void; onSaves: () => void; onHelp: () => void; onCredits: () => void }) {
  const [asking, setAsking] = useState(false);
  const { followNewest } = sim;
  useEffect(() => {
    followNewest(true);
    return () => followNewest(false);
  }, [followNewest]);
  const s = sim.snapshot;
  if (sim.status !== 'ready' || !s) return null;
  const company = s.company.name;
  return (
    <section className="home" role="dialog" aria-label="Interbus" data-testid="home" data-chrome="panel">
      <h1>Interbus</h1>
      <p className="hint">A bus company in Boston</p>
      {company ? (
        <button type="button" className="primary" onClick={onContinue} data-testid="home-continue">
          Continue
          <span className="about">
            {company} · {dateText(s.day)} · {usd(s.cashCents)}
          </span>
        </button>
      ) : null}
      {asking ? (
        <div className="ask" role="group" aria-label="Start over">
          <p>
            Start over? {company}, on {dateText(s.day)}, will be replaced. Your slots stay.
          </p>
          <span className="controls">
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                onNewGame();
              }}
            >
              Start a new game
            </button>
            <button type="button" onClick={() => setAsking(false)}>
              Keep it
            </button>
          </span>
        </div>
      ) : (
        <button type="button" className={company ? undefined : 'primary'} onClick={() => (company ? setAsking(true) : onNewGame())}>
          New game
        </button>
      )}
      {/* Side by side, so Help and Credits make Home no taller: Home and Saves take 24.3% of 1152×720 of I13's 26%. */}
      <span className="more">
        <button type="button" onClick={onSaves} data-testid="home-saves">
          Saves
        </button>
        <button type="button" onClick={onHelp} title="Help (?)" data-testid="home-help">
          Help
        </button>
        <button type="button" onClick={onCredits} data-testid="home-credits">
          Credits
        </button>
      </span>
    </section>
  );
}
