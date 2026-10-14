import { useState } from 'react';
import { dateText, usd } from '../format';
import type { Sim } from '../game/useSim';

/**
 * Home (the M5 spec, item 3; UX-07, V1's menu, `Intralines@7af45b1:src/ui/Menu.tsx:104-253`): the
 * first screen, over the paused, flat map. Continue goes on with the game that saves itself as it
 * plays, named by its company, day and cash; New game starts an unnamed company, asking first when it
 * would replace that game (V1 asked too); Saves opens the slots. Settings, help and credits wait for
 * week 14. The build chip stays in its corner.
 */
export function Home({ sim, onContinue, onNewGame, onSaves }: { sim: Sim; onContinue: () => void; onNewGame: () => void; onSaves: () => void }) {
  const [asking, setAsking] = useState(false);
  const s = sim.snapshot;
  if (sim.status !== 'ready' || !s) return null;
  const company = s.company.name;
  return (
    <section className="home" role="dialog" aria-label="interbus" data-testid="home" data-chrome="panel">
      <h1>interbus</h1>
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
            Start over? {company}, on {dateText(s.day)}, is replaced. Your slots stay.
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
      <button type="button" onClick={onSaves}>
        Saves
      </button>
    </section>
  );
}
