// Theme tokens for the map. One generator builds every theme from a token set (D13); the dark set
// lands in week 13. Values are PLAN §8's starting light tokens until the owner's Nov 8 pick, except
// four that broke §8's own base-chroma limit (≤0.04): park #d5e4c6, wood #cfdfc2, arterial #f9e9c8 and
// arterial casing #e3c48d were scaled to chroma 0.039 at the same lightness and hue (style.test.ts).
// The pick's other candidate, V1's paper, is below (PAPER); `?light=paper` draws it, until the pick.

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

/** A light theme's two token sets: the board's and the game's. */
export interface LightTokens {
  readonly map: MapTokens;
  readonly game: GameTokens;
}

/** PLAN §8's starting light tokens, warm-neutral: the light theme until the owner's Nov 8 pick. */
export const WARM: LightTokens = { map: LIGHT, game: GAME_LIGHT };

/** V1's land, its paper. */
const V1_LAND = '#f3edda';

/**
 * V1's paper (`Intralines@7af45b1:src/map/basemapStyle.ts:9-32`, its mask and edge `src/map/overlays.ts:98, 107`), the Nov 8 pick's
 * other candidate (PLAN §8, D13: "these or pure V1 paper"), as V1 drew it: a fill V1 laid at an opacity is that blend over V1's
 * land (parks 0.7, wood 0.55, buildings 0.86, commercial and industrial land 0.5; the labels' halo 0.85 of #fffcf0). V1's
 * background was its land, so the void is too. Where V1 drew a kind with no token here, its nearest: arterials take V1's primary
 * roads (V1 drew motorways a louder amber, #f7b267 cased #e08e3c, and secondary and tertiary roads paler); paths take its palest
 * road, #fff3d9; hospitals and schools its commercial land; airfields its runways' #e8e4da; building outlines and boundaries, which
 * V1 did not draw, its streets' casing; minor names its district names. It is pure: seven of its colours break PLAN §8 rule 1
 * (water, parks, wood, the arterials and their casing, minor and water names; DECISIONS, Measured, 2026-10-23).
 */
export const V1_PAPER: MapTokens = {
  void: V1_LAND,
  land: V1_LAND,
  water: '#8ec8ee',
  park: '#c9e2ad',
  wood: '#c7deaf',
  buildingFill: '#e8ddc7',
  buildingOutline: '#d8cfba',
  street: '#ffffff',
  streetCasing: '#d8cfba',
  arterial: '#fdd8a2',
  arterialCasing: '#e4b56e',
  path: '#fff3d9',
  hospital: '#f4e8d5',
  school: '#f4e8d5',
  industrial: '#ece7e1',
  aerodrome: '#e8e4da',
  boundary: '#d8cfba',
  mask: '#75746e',
  maskEdge: '#3c3728',
  label: '#4a4636',
  labelMinor: '#8a7f63',
  labelHalo: '#fdfaed',
  waterLabel: '#3d6f9e',
};

/** The game's colours on V1's paper: the same, but the halo behind the game's own words, which is the land's. */
export const PAPER: LightTokens = { map: V1_PAPER, game: { ...GAME_LIGHT, wordHalo: V1_LAND } };

/**
 * D13's placeholder dark land and void, two values the network hues are checked against on Nov 8 so January adds only the dark
 * base tokens: V1's dark land, which V1 named and never drew (`Intralines@7af45b1:src/map/basemapStyle.ts:11`), and a void as far
 * below it as the light void is below its land (OKLCH lightness 0.064 lower).
 */
export const DARK_PLACEHOLDER = { land: '#20242e', void: '#13151b' } as const;

/** The light theme a page asks for (`?light=paper`; src/platform's lightSwitch): V1's paper, or the warm-neutral set. */
export const lightTokens = (asked: 'paper' | null): LightTokens => (asked === 'paper' ? PAPER : WARM);
