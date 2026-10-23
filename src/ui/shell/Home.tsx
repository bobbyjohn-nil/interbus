import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { focusLost } from '../focusLost';
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
export function Home({
  sim,
  byKey = () => false,
  onContinue,
  onNewGame,
  onSaves,
  onHelp,
  onCredits,
}: {
  sim: Sim;
  /** Whether the keyboard, not the pointer, moved the focus where it is (App's focusSource). */
  byKey?: () => boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onSaves: () => void;
  onHelp: () => void;
  onCredits: () => void;
}) {
  // The company New game's question names, until it is answered: a game another tab puts in its place closes the question,
  // as nothing it asked about is left to replace. It stayed, and read "Start over? , on Year 1, Q1, Day 1, will be
  // replaced." over an unnamed game (round 10).
  const [asking, setAsking] = useState<string | null>(null);
  const { followNewest } = sim;
  useEffect(() => {
    followNewest(true);
    return () => followNewest(false);
  }, [followNewest]);
  const s = sim.snapshot;
  const company = s?.company.name ?? '';
  // Let go as the game it named goes, so a later game of the same name never brings it back unasked (the review of round 10),
  // during render, as App's state that follows the game does.
  if (asking !== null && asking !== company) setAsking(null);
  const shown = company !== '' && asking === company;
  // The keyboard keeps its place, as in Saves' questions: the question takes the place of New game, and an answer the
  // question's, so the focus fell to the page (round 10). It goes to Keep it as the question opens, and back to New game as
  // it closes, unless the player has put it somewhere else.
  const newGame = useRef<HTMLButtonElement>(null);
  const keepIt = useRef<HTMLButtonElement>(null);
  const wasShown = useRef(shown);
  useLayoutEffect(() => {
    if (wasShown.current === shown) return;
    wasShown.current = shown;
    if (focusLost()) (shown ? keepIt.current : newGame.current)?.focus();
  });
  // Continue goes with the game it names when another tab starts a new one, and the keyboard on it fell to the page (round 11):
  // New game takes it, when the keyboard put it where it was, as a press of the mouse hands Space no button.
  const hadContinue = useRef(company !== '');
  useLayoutEffect(() => {
    const went = hadContinue.current && company === '';
    hadContinue.current = company !== '';
    if (went && byKey() && focusLost()) newGame.current?.focus();
  });
  if (sim.status !== 'ready' || !s) return null;
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
      {shown ? (
        <div className="ask" role="group" aria-label="Start over">
          <p>
            Start over? {company}, on {dateText(s.day)}, will be replaced. Your slots stay.
          </p>
          <span className="controls">
            {/* The question stays until the new game has come, when Home goes (App's `starting`): closed at once, it left Continue
                naming the old company on Home for a moment. */}
            <button type="button" onClick={onNewGame}>
              Start a new game
            </button>
            <button type="button" ref={keepIt} onClick={() => setAsking(null)}>
              Keep it
            </button>
          </span>
        </div>
      ) : (
        <button type="button" ref={newGame} className={company ? undefined : 'primary'} onClick={() => (company ? setAsking(company) : onNewGame())}>
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
