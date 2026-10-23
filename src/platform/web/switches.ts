// The page's query switches, read once (the M5 spec, item 5): `?gpu=full|low|none` picks a rung of the
// GPU ladder (the e2e tests force each one, and a player on a slow machine can ask for Low graphics),
// and `?fps` shows the frame-rate readout for the slow-laptop run and P2's notes. Until the owner's
// Nov 8 token pick (PLAN §8, D13), `?light=paper` draws the map in V1's paper instead of the
// warm-neutral set, so the two can be set side by side on Boston. `?counts` has the map count what it
// draws for the e2e tests.
export type GpuSwitch = 'full' | 'low' | 'none';

const params = () => new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export function gpuSwitch(): GpuSwitch | null {
  const v = params().get('gpu');
  return v === 'full' || v === 'low' || v === 'none' ? v : null;
}

export function fpsSwitch(): boolean {
  return params().has('fps');
}

/**
 * Whether the map counts what it draws, for the e2e tests (TS-07: drawn, not merely sent): the demand dots at each settle, and
 * the buildings once a tilt settles. A player's page counts nothing: on Inner Boston the dots' count took 15–17 ms after every
 * frame while time ran, and the buildings' 130–217 ms after each tilt (the systems audit's twelfth round).
 */
export function countsSwitch(): boolean {
  return params().has('counts');
}

export type LightSwitch = 'paper';

export function lightSwitch(): LightSwitch | null {
  return params().get('light') === 'paper' ? 'paper' : null;
}
