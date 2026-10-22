// What Help lists (src/ui/shell/Help.tsx): every key the game answers, and what the mouse and the fingers do on the map.
// Each row's keys are written as the keyboard names them; `help.test.ts` holds the list to the keys the code reads (the view
// keys of render/map/tilt.ts, the running speeds of sim/rules/speed.ts), so a key added there and left out here fails it.
import { RUNNING_SPEEDS } from '../sim/rules/speed';
import { speedText } from './format';

export interface HelpRow {
  /** The keys, or the gesture, as a player names them: one for each way to do it. */
  readonly keys: readonly string[];
  /** How the keys read together: "Q and E" are two keys for one turn each way, "Ctrl+Z or ⌘Z" one key on two kinds of computer. */
  readonly join: 'and' | 'or';
  /** What they do, in the copy convention (copyRules.ts). */
  readonly what: string;
}

/** The speeds the number keys pick, slowest first, as the speed chip names them: "1×, 60×, 600×, 2,700× or 5,400×". */
const speeds = RUNNING_SPEEDS.map(speedText);
const speedList = `${speeds.slice(0, -1).join(', ')} or ${speeds[speeds.length - 1]}`;

/** The keys, in the order a player meets them: time first, then undo and Escape, the view, and moving about the page. */
export const HELP_KEYS: readonly HelpRow[] = [
  { keys: ['Space'], join: 'or', what: 'Play or pause' },
  { keys: [`${RUNNING_SPEEDS[0]} to ${RUNNING_SPEEDS[RUNNING_SPEEDS.length - 1]}`], join: 'or', what: `Pick a speed: ${speedList}` },
  { keys: ['Ctrl+Z', '⌘Z'], join: 'or', what: 'Undo the last thing you did while paused' },
  { keys: ['Escape'], join: 'or', what: 'Close the panels and put the tool down' },
  { keys: ['Backspace'], join: 'or', what: 'Take the last stop off the line you are drawing' },
  { keys: ['T'], join: 'or', what: 'Tilt to 3D, and back to 2D' },
  { keys: ['Q', 'E'], join: 'and', what: 'Turn the map, in 3D' },
  { keys: ['N'], join: 'or', what: 'Face north, in 3D' },
  { keys: ['?'], join: 'or', what: 'Open or close this help' },
  { keys: ['Tab', 'Shift+Tab'], join: 'and', what: 'Go from control to control; Enter or Space presses one' },
  { keys: ['Arrow keys'], join: 'or', what: 'Move along tabs, lists and menus' },
];

/** What the mouse, the fingers and the keys do on the map (the M5 spec, item 6; D25; MapLibre's own keys, once Tab reaches the map). */
export const HELP_MAP: readonly HelpRow[] = [
  { keys: ['Drag'], join: 'or', what: 'Move the map' },
  { keys: ['Scroll', 'pinch'], join: 'or', what: 'Zoom' },
  { keys: ['Double-click'], join: 'or', what: 'Zoom in' },
  { keys: ['Double-click and hold'], join: 'or', what: 'Switch between 2D and 3D; hold and drag to tilt' },
  { keys: ['Right-drag', 'Ctrl-drag'], join: 'or', what: 'Tilt, and in 3D turn the map' },
  { keys: ['Two fingers up or down'], join: 'or', what: 'Tilt, on a touch screen' },
  { keys: ['Click a line or a stop'], join: 'or', what: 'Open its card; where lines share a street, a list of them' },
  { keys: ['Arrow keys, + and −'], join: 'or', what: 'Move and zoom it, once Tab has reached it' },
];
