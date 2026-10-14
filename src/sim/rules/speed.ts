// The speed ladder (D25, the owner's initial playtest: "the second equals second 1x speed, and
// building speed from there"). 1x is real time, a game second a real second; each step up is a plain
// pace: a minute, ten minutes, half an hour, an hour and a half a second. 600x and 1,800x were the
// ladder's 1 and 2 until 2026-10-14, where every pacing number was measured; 5,400x, the old 3, is
// still the top (a day in 16 s). The worker runs time at these rates; the UI names them.
import type { Speed } from '../types';

/** Game seconds per real second at each speed; speed 0 is paused. */
export const SPEED_RATES: Readonly<Record<Speed, number>> = { 0: 0, 1: 1, 2: 60, 3: 600, 4: 1_800, 5: 5_400 };

/** The running speeds, slowest first. */
export const RUNNING_SPEEDS: readonly Exclude<Speed, 0>[] = [1, 2, 3, 4, 5];

/** Play starts here the first time: 600x, the service day in about two minutes (PLAN §3). */
export const PLAY_SPEED: Exclude<Speed, 0> = 3;
