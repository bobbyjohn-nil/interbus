// Replays an exported session (the M3 spec, item 12; AR-06): the same host the game runs, given the
// session's save as the page would give it, its speed, then each command at the game second it ran,
// stepping between them as ticks would. The game it reaches should have the session's fingerprint;
// a mismatch is a bug in determinism (or a build other than the session's).
import type { FromWorker } from '../sim/types';
import { createHost, type SessionFile } from './host';

export type Replay = { readonly ok: true; readonly hash: string; readonly matches: boolean } | { readonly ok: false; readonly problem: string };

export function replaySession(simText: string, sessionText: string): Replay {
  let file: SessionFile;
  try {
    file = JSON.parse(sessionText) as SessionFile;
  } catch {
    return { ok: false, problem: 'not JSON' };
  }
  if (file?.kind !== 'interbus-session' || file.format !== 1) return { ok: false, problem: 'not a session file' };
  const failed: string[] = [];
  const host = createHost((m: FromWorker) => {
    if (m.type === 'failed') failed.push(m.problem);
  });
  host.handle({ type: 'init', simText, city: file.city, seed: 0, build: file.build });
  host.handle({ type: 'save-text', text: file.start });
  if (failed.length) return { ok: false, problem: failed[0]! };
  if (file.speed !== 0) host.handle({ type: 'speed', speed: file.speed });
  for (const { at, message } of file.commands) {
    host.advanceTo(at);
    host.handle(message);
  }
  host.advanceTo(file.end.elapsed);
  const hash = host.stateHash();
  return hash === null ? { ok: false, problem: 'no game' } : { ok: true, hash, matches: hash === file.end.hash };
}
