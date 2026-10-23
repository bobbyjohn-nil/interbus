import { useState } from 'react';
import { checkFounding, COMPANY_COLOURS, COMPANY_NAME_MAX } from '../../sim/rules/company';
import { refusalText } from '../copy';
import { usd } from '../format';
import type { Sim } from './useSim';

/** Each colour a company may take, by its name, so a swatch is never read out as a code (D25's copy pass). */
const COLOUR_NAMES: Readonly<Record<string, string>> = {
  '#c0392b': 'Red',
  '#2471a3': 'Blue',
  '#1e8449': 'Green',
  '#b9770e': 'Amber',
  '#7d3c98': 'Purple',
  '#117a65': 'Teal',
};

/**
 * The founding card (the M2 spec's exit check, step 1): name and colour the company. Its cash is the
 * founding capital already on the ledger. The card reads the same rule the command checks (GD-05).
 * Back to Home leaves it for Home, as Saves' does, so a player who pressed New game can import a save
 * or load a slot instead: every screen can be left (the M5 spec, item 3).
 */
export function FoundingCard({ sim, onHome }: { sim: Sim; onHome: () => void }) {
  const [name, setName] = useState('');
  const [colour, setColour] = useState(COMPANY_COLOURS[0]!);
  const s = sim.snapshot;
  if (sim.status !== 'ready' || !s || s.company.name !== '') return null;
  const verdict = checkFounding('', name, colour);
  return (
    <section className="founding-card" role="dialog" aria-label="Found your company" data-testid="founding-card" data-chrome="panel">
      <h2>Found your company</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (verdict.ok) sim.send({ type: 'found', name, colour });
        }}
      >
        {/* The name keeps the keyboard while the card shows: a panel the keyboard opened beside it, closing with nothing else to
            hand the focus back to, gives it the focus (Panels' FOCUS_REST): Saves left open from Home gave the page the focus (round 11). */}
        <label>
          Name
          <input value={name} maxLength={COMPANY_NAME_MAX + 8} placeholder="Back Bay Transit" onChange={(e) => setName(e.target.value)} autoFocus data-focus-rest />
        </label>
        <fieldset>
          <legend>Color</legend>
          {COMPANY_COLOURS.map((c) => (
            <label key={c} className="swatch-choice" style={{ background: c }} title={COLOUR_NAMES[c] ?? 'Color'}>
              <input type="radio" name="colour" value={c} checked={c === colour} onChange={() => setColour(c)} aria-label={COLOUR_NAMES[c] ?? 'Color'} />
            </label>
          ))}
        </fieldset>
        <p>Starting cash: {usd(s.cashCents)}</p>
        {!verdict.ok && name !== '' ? (
          <p className="refusal" role="status">
            {refusalText(verdict)}
          </p>
        ) : null}
        <button type="submit" disabled={!verdict.ok}>
          Found the company
        </button>
        <button type="button" className="back" onClick={onHome}>
          Back to Home
        </button>
      </form>
    </section>
  );
}
