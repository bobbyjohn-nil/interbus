// Theme tokens for the map. One generator builds every theme from a token set (D13); the dark set
// lands in week 13. Values are PLAN §8's starting light tokens until the owner's Nov 8 pick, except
// four that broke §8's own base-chroma limit (≤0.04): park #d5e4c6, wood #cfdfc2, arterial #f9e9c8 and
// arterial casing #e3c48d were scaled to chroma 0.039 at the same lightness and hue (style.test.ts).

export interface MapTokens {
  /** Outside the play area. */
  readonly void: string;
  readonly land: string;
  readonly water: string;
  readonly park: string;
  readonly wood: string;
  readonly buildingFill: string;
  readonly buildingOutline: string;
  readonly street: string;
  readonly streetCasing: string;
  readonly arterial: string;
  readonly arterialCasing: string;
  readonly path: string;
  readonly hospital: string;
  readonly school: string;
  readonly industrial: string;
  readonly aerodrome: string;
  readonly boundary: string;
  /** The grey laid over everything beyond the play area: V1's board mask. */
  readonly mask: string;
  /** The play area's dashed edge. */
  readonly maskEdge: string;
  readonly label: string;
  readonly labelMinor: string;
  readonly labelHalo: string;
  readonly waterLabel: string;
}

/** The loud data on the quiet base (PLAN §8 rule 1: game colours at OKLCH chroma ≥0.12). */
export interface GameTokens {
  /** Where people live: V1's purple (`Intralines@7af45b1:src/map/overlays.ts:45`). */
  readonly homeDot: string;
  /** Where people work: V1's teal (#0e7a92, chroma 0.094) pushed bluer to reach 0.137. */
  readonly jobDot: string;
  /** Stop markers' fill, under the line's own colour. */
  readonly stopFill: string;
  /** Where a depot may stand: the green tint over depot land while placing one. */
  readonly depotLand: string;
  /** A depot on the map. */
  readonly depotMark: string;
  /** A line still being drawn, before Create, and a stop placed on its own, until a line calls there (D25). */
  readonly draft: string;
  /** The warning colour: a QUIET or LOSS stop's ring and word (the M3 spec, item 5), and a city event's street and words (the M4 spec, item 2). */
  readonly stopFlag: string;
  /**
   * The halo behind the game's words in its own inks (the flags' and the events' words, the line being drawn's numbers): a game
   * colour, so it keeps its light at night as they do. In the labels' halo it dimmed with the map while the warning ink did not,
   * from 4.20:1 by day to 2.32:1 at night (the review of the day and night tint).
   */
  readonly wordHalo: string;
}

export const GAME_LIGHT: GameTokens = {
  homeDot: '#7a54e0',
  jobDot: '#0088c8',
  stopFill: '#ffffff',
  depotLand: '#2f9e44',
  depotMark: '#1f8a3a',
  draft: '#2a2723',
  stopFlag: '#c2410c',
  wordHalo: '#ebe7df',
};

export const LIGHT: MapTokens = {
  void: '#d6d2c9',
  land: '#ebe7df',
  water: '#b6d4e8',
  park: '#d6e3c8',
  wood: '#d0dec4',
  buildingFill: '#dcd6ca',
  buildingOutline: '#cfc8ba',
  street: '#ffffff',
  streetCasing: '#cfc8ba',
  arterial: '#f7e9ce',
  arterialCasing: '#d6c7ad',
  path: '#f4f1eb',
  hospital: '#e9e1dc',
  school: '#e7e1d6',
  industrial: '#e2ded5',
  aerodrome: '#e4e0d8',
  boundary: '#b9b2a5',
  // V1's mask and edge (Intralines@7af45b1:src/map/overlays.ts:98, 107).
  mask: '#75746e',
  maskEdge: '#3c3728',
  label: '#5c574d',
  labelMinor: '#7a7468',
  labelHalo: '#ebe7df',
  waterLabel: '#5f7f99',
};
