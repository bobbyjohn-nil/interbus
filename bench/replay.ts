// Replays an exported session (the M3 spec, item 12) for a bug report: `npm run bench replay <file>`.
// Check out the session's build first (its `build.sha`), so the code is the code it was played on;
// the sim file is found in public/cities by the hash the session names (`npm run cities` fetches it).
// Prints whether the replay reaches the session's fingerprint.
import { existsSync, readFileSync } from 'node:fs';
import { replaySession } from '../src/worker/replay';

const path = process.argv[3];
if (!path) throw new Error('usage: npm run bench replay <session.json>');
const text = readFileSync(path, 'utf8');
const session = JSON.parse(text) as { build: { sha: string }; city: { id: string; revision: string; hash: string }; commands: unknown[]; end: { elapsed: number; hash: string } };
const simPath = `public/cities/sim-${session.city.id}-${session.city.revision}-${session.city.hash.slice(0, 8)}.json`;
if (!existsSync(simPath)) throw new Error(`no ${simPath}: run npm run cities at the session's build`);
const result = replaySession(readFileSync(simPath, 'utf8'), text);
console.log(`session from build ${session.build.sha.slice(0, 7)} on ${session.city.id} ${session.city.revision}: ${session.commands.length} commands to game second ${session.end.elapsed}`);
console.log(result.ok ? `replayed to ${result.hash}: ${result.matches ? 'the same game' : `a different game (the session ended at ${session.end.hash})`}` : `not replayed: ${result.problem}`);
