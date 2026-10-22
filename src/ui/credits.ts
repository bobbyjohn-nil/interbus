// What Help's Credits lists (src/ui/shell/Help.tsx): everything LICENSE-DATA.md credits, shown in the game itself (PLAN §11,
// "Licences and credits"; LICENSE-DATA.md, "Before a Steam build"). `src/ui/shell/Help.test.ts` holds it to LICENSE-DATA.md:
// every credit its city files' table quotes, and the font's, so a source added there and left out here fails it.

export interface CreditRow {
  /** Who or what is credited, as the credit reads. */
  readonly name: string;
  /** The page the name links to, on the platform's allowlist (externalLink); the rows without one are credits in words. */
  readonly url?: string;
  /** What the game takes from it, in the copy convention (copyRules.ts). */
  readonly what: string;
  /** A licence's text this build ships beside itself (the platform's ownFile), linked after what it takes. */
  readonly file?: { readonly text: string; readonly path: string };
}

export interface CreditGroup {
  readonly heading: string;
  readonly rows: readonly CreditRow[];
}

/** Who made the game: the studio, which holds its copyright (D14, D20). */
export const CREDITS_GAME = 'Interbus is made by Miticept Studios.';

export const CREDITS: readonly CreditGroup[] = [
  {
    heading: 'The city',
    rows: [
      {
        name: '© OpenStreetMap contributors',
        url: 'https://www.openstreetmap.org/copyright',
        what: 'Streets, buildings, water, parks, land use and place names, under the Open Database License (ODbL)',
      },
      { name: 'Protomaps', url: 'https://protomaps.com/', what: 'The map, cut from its basemap' },
      {
        name: 'Overture Maps',
        url: 'https://overturemaps.org/',
        what: 'Building heights: © OpenStreetMap contributors, Microsoft, Esri Community Maps contributors, Google Open Buildings; some from USGS 3DEP lidar',
      },
      { name: 'U.S. Census Bureau, 2020 TIGER/Line Shapefiles', what: 'Where each block lies, and how many people live there' },
      {
        name: 'U.S. Census Bureau, LEHD Origin-Destination Employment Statistics (LODES 8.4, 2023)',
        what: 'Homes and jobs in each block, and the commutes between them',
      },
    ],
  },
  {
    heading: 'The type',
    rows: [
      {
        name: 'Afacad Flux',
        what: '© 2023 The Afacad Project Authors, designed by Kristian Möller (Dicotype), under the SIL Open Font License 1.1',
        file: { text: 'The license', path: 'fonts/OFL.txt' },
      },
    ],
  },
  {
    heading: 'The software',
    rows: [
      {
        name: 'Open-source packages',
        what: 'The game is built with them, each under its own license',
        file: { text: 'Their licenses', path: 'THIRD_PARTY_NOTICES.txt' },
      },
    ],
  },
];
