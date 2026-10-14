// The speed ladder (D25, the owner's initial playtest: "the second equals second 1x speed, and
// building speed from there"). 1x is real time, a game second a real second; each step up is a plain
// pace: a minute, ten minutes, 45 minutes, an hour and a half a second. The pacing run plays day 1
// at 600x and later days at 2,700x (DECISIONS, Measured, 2026-10-14: the tuning freeze's starting
// cash and speed, which moved 1,800x to 2,700x); 5,400x, the old 3, is still the top (a day in 16 s).
// The worker runs time at these rates; the UI names them.
import type { Speed } from '../types';

/** Game seconds per real second at each speed; speed 0 is paused. */
export const SPEED_RATES: Readonly<Record<Speed, number>> = { 0: 0, 1: 1, 2: 60, 3: 600, 4: 2_700, 5: 5_400 };

/** The running speeds, slowest first. */
export const RUNNING_SPEEDS: readonly Exclude<Speed, 0>[] = [1, 2, 3, 4, 5];

/** Play starts here the first time: 600x, the service day in about two minutes (PLAN §3). */
export const PLAY_SPEED: Exclude<Speed, 0> = 3;
