import { useState } from 'react';
import { checkFounding, COMPANY_COLOURS, COMPANY_NAME_MAX } from '../../sim/rules/company';
import { refusalText } from '../copy';
import { usd } from '../format';
import type { Sim } from './useSim';

/**
 * The founding card (the M2 spec's exit check, step 1): name and colour the company. Its cash is the
 * founding capital already on the ledger. The card reads the same rule the command checks (GD-05).
 */
export function FoundingCard({ sim }: { sim: Sim }) {
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
        <label>
          Name
          <input value={name} maxLength={COMPANY_NAME_MAX + 8} placeholder="Back Bay Transit" onChange={(e) => setName(e.target.value)} autoFocus />
        </label>
        <fieldset>
          <legend>Colour</legend>
          {COMPANY_COLOURS.map((c) => (
            <label key={c} className="swatch-choice" style={{ background: c }} title={c}>
              <input type="radio" name="colour" value={c} checked={c === colour} onChange={() => setColour(c)} aria-label={`Colour ${c}`} />
            </label>
          ))}
        </fieldset>
        <p>Founding capital {usd(s.cashCents)}</p>
        {!verdict.ok && name !== '' ? (
          <p className="refusal" role="status">
            {refusalText(verdict)}
          </p>
        ) : null}
        <button type="submit" disabled={!verdict.ok}>
          Found
        </button>
      </form>
    </section>
  );
}
