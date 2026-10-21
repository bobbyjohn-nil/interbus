import type { Sim } from './useSim';

/**
 * Whether the lender has ended the run (D10): the host's own verdict (sim/rules/credit runEnded), as the snapshot carries it.
 * While it holds, the host refuses every command that would change the game, and the page offers none of them: only Restart
 * this quarter, Saves, Home and looking. Before, the page went on offering them, each press answered by a notice alone (the
 * review of the systems audit's eighth round).
 */
export function runOver(sim: Pick<Sim, 'snapshot'>): boolean {
  return sim.snapshot?.floor?.ended === true;
}
