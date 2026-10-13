// The page's query switches, read once (the M5 spec, item 5): `?gpu=full|low|none` picks a rung of the
// GPU ladder (the e2e tests force each one, and a player on a slow machine can ask for Low graphics),
// and `?fps` shows the frame-rate readout for the slow-laptop run and P2's notes.
export type GpuSwitch = 'full' | 'low' | 'none';

const params = () => new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export function gpuSwitch(): GpuSwitch | null {
  const v = params().get('gpu');
  return v === 'full' || v === 'low' || v === 'none' ? v : null;
}

export function fpsSwitch(): boolean {
  return params().has('fps');
}
