// The pacing player's depots (sim/pacing.ts), on the fixture: when its depots have no room for a
// line's buses it buys another, when the nearest depot land refuses one it tries the next parcel
// along, and when no depot can be had near a line it parks the line at the depots there are, as a
// player would; a network past one depot's six buses, which gold needs (DECISIONS, Open,
// the medal ladder), is built only so. Shown failing (TS-04) with the player before it: only the
// nearest parcel tried, and a line refused for room left undrawn.
import { describe, expect, it } from 'vitest';
import { addDebugLine, DEBUG_STOPS } from './commands/debugLine';
import { placeDepot } from './commands/placeDepot';
import { DEPOT_CAPACITY } from './config/depots';
import { CREDIT_LIMIT_CENTS } from './config/economy';
import { FOUNDING_HEADWAYS } from './config/lines';
import { distM, toXY } from './core/geo';
import { depotPriceCents } from './rules/depot';
import { recompute } from './world';
import { DEPOT_REACH_M, depotNear, drawCandidate, placeDepotNear } from './pacing';
import { COPLEY, fixtureGame, KENMORE } from './testing';

describe('the pacing player’s depots, on the fixture', () => {
  it('places a depot on the next parcel along when the nearest refuses', () => {
    const world = fixtureGame();
    const at = toXY(world.city.frame, COPLEY);
    expect(placeDepot(world, depotNear(world.city, at)).ok).toBe(true);
    expect(placeDepotNear(world, at)).toBe(true); // the nearest parcel refuses: a depot already stands there
    expect(world.state.depots).toHaveLength(2);
  });

  it('buys another depot when its depots have no room for a line’s buses', () => {
    const world = fixtureGame();
    const nearest = depotNear(world.city, toXY(world.city.frame, COPLEY));
    expect(distM(world.city.frame, nearest, COPLEY)).toBeLessThanOrEqual(DEPOT_REACH_M);
    expect(placeDepot(world, nearest).ok).toBe(true);
    expect(addDebugLine(world).ok).toBe(true);
    world.state.lines[0]!.buses = DEPOT_CAPACITY;
    recompute(world);
    expect(drawCandidate(world, { name: 'Copley to Kenmore', stops: [COPLEY, KENMORE], headways: FOUNDING_HEADWAYS })).not.toBeNull();
    expect(world.state.depots).toHaveLength(2);
    expect(world.state.lines).toHaveLength(2);
  });

  // A line whose first stop has no depot in reach was refused when the depot rule refused one there (the review of #144). It
  // parks at the depots there are now, as a player whose cash stops a new depot would. Shown failing (TS-04) with the refusal.
  it('parks a line at the depots there are when the depot near its first stop is refused', () => {
    const world = fixtureGame();
    const longwood = DEBUG_STOPS.at(-1)!.at;
    expect(placeDepot(world, depotNear(world.city, toXY(world.city.frame, longwood))).ok).toBe(true);
    const depot = world.state.depots[0]!;
    expect(distM(world.city.frame, [depot.lon, depot.lat], COPLEY)).toBeGreaterThan(DEPOT_REACH_M);
    // Cash for the line, but not for the next depot, with the credit line spent on either (D10).
    world.state.ledger.cashCents = depotPriceCents(1) - CREDIT_LIMIT_CENTS - 1;
    expect(drawCandidate(world, { name: 'Copley to Kenmore', stops: [COPLEY, KENMORE], headways: FOUNDING_HEADWAYS })).not.toBeNull();
    expect(world.state.depots).toHaveLength(1);
    expect(world.state.lines).toHaveLength(1);
  });
});
