// How far the game's clock runs while its tab is out of sight, on a real tab switch, which Playwright cannot make: its pages never
// go out of sight (e2e/hidden.spec.ts sends the page's visibilitychange instead). Over Chrome's DevTools protocol it founds a
// company, plays at 2,700x, opens another tab over the game's for `HIDE_S` seconds, and comes back. With the hold (useSim, the
// sim host's `held`), the clock stands still while hidden; before it, it ran 2,700 game seconds a second (the systems audit's
// fourteenth round).
//
//   npm run build:fixture && npx vite preview --port 7746 --strictPort &
//   npm run measure:hidden -- [http://127.0.0.1:7746/] [path to chromium]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://127.0.0.1:7746/';
const chromium = process.argv[3] ?? process.env.PW_CHROMIUM ?? 'chromium';
const HIDE_S = Number(process.env.HIDE_S ?? 10);
const profile = mkdtempSync(join(tmpdir(), 'interbus-hidden-'));
// As root (a container), Chromium starts only without its sandbox, as Playwright starts it there.
const root = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
const browser = spawn(chromium, ['--headless=new', ...root, '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--enable-unsafe-swiftshader', '--use-angle=swiftshader', 'about:blank']);
// The profile comes away once the browser has let go of it: removed at once, it was still being written (ENOTEMPTY).
const exited = new Promise((done) => browser.once('exit', done));
const endpoint = await new Promise((done, fail) => {
  browser.stderr.on('data', (d) => {
    const found = /DevTools listening on (ws:\/\/\S+)/.exec(String(d));
    if (found) done(found[1]);
  });
  browser.on('exit', () => fail(new Error('chromium exited before it listened')));
});

const socket = new WebSocket(endpoint);
await new Promise((done) => socket.addEventListener('open', done, { once: true }));
let next = 0;
const waiting = new Map();
socket.addEventListener('message', (event) => {
  const m = JSON.parse(String(event.data));
  if (m.id === undefined || !waiting.has(m.id)) return;
  const { done, fail } = waiting.get(m.id);
  waiting.delete(m.id);
  if (m.error) fail(new Error(m.error.message));
  else done(m.result);
});
const send = (method, params = {}, sessionId) =>
  new Promise((done, fail) => {
    const id = ++next;
    waiting.set(id, { done, fail });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

const { targetId } = await send('Target.createTarget', { url });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
/** Runs `code` in the game's tab and gives its value. */
const run = async (code) => (await send('Runtime.evaluate', { expression: code, returnByValue: true, awaitPromise: true }, sessionId)).result.value;
const until = async (code, what) => {
  for (let k = 0; k < 600; k++) {
    if (await run(code)) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what}`);
};
const press = async (key) => {
  for (const type of ['keyDown', 'keyUp']) await send('Input.dispatchKeyEvent', { type, key, text: type === 'keyDown' ? key : undefined, code: `Digit${key}`, windowsVirtualKeyCode: key.charCodeAt(0) }, sessionId);
};
const clock = () => run(`({ elapsed: Number(document.querySelector('[data-testid="sim-panel"]').dataset.elapsed), seen: document.visibilityState })`);

try {
  await until(`document.querySelector('[data-testid="map"]')?.dataset.status === 'ready' && !!document.querySelector('[data-testid="home"]')`, 'Home');
  await run(`[...document.querySelectorAll('[data-testid="home"] button')].find((b) => b.textContent === 'New game').click()`);
  await until(`!!document.querySelector('[data-testid="founding-card"] input:not([type])')`, 'the founding card');
  await run(`(() => {
    const name = document.querySelector('[data-testid="founding-card"] input:not([type])');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, 'Back Bay Transit');
    name.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await run(`[...document.querySelectorAll('[data-testid="founding-card"] button')].find((b) => b.textContent === 'Found the company').click()`);
  await until(`!document.querySelector('[data-testid="founding-card"]')`, 'the company founded');
  await until(`!document.getElementById('boot')`, 'the splash to go'); // it holds the keys while it stands (boot.ts)
  await press('4'); // 2,700x
  await until(`document.querySelector('[data-testid="sim-panel"]').dataset.speed === '4'`, '2,700x');
  await sleep(2_000);
  const before = await clock();
  const { targetId: other } = await send('Target.createTarget', { url: 'about:blank' });
  await sleep(500);
  const hidden = await clock();
  await sleep(HIDE_S * 1_000);
  const after = await clock();
  await send('Target.activateTarget', { targetId });
  await send('Target.closeTarget', { targetId: other });
  await sleep(2_000);
  const back = await clock();
  console.log(`before the switch: ${before.elapsed} (${before.seen})`);
  console.log(`out of sight ${HIDE_S} s: ${hidden.elapsed} to ${after.elapsed} (${after.seen}), ${after.elapsed - hidden.elapsed} game seconds`);
  console.log(`back 2 s: ${back.elapsed} (${back.seen}), ${back.elapsed - after.elapsed} game seconds`);
} finally {
  socket.close();
  browser.kill();
  await exited;
  rmSync(profile, { recursive: true, force: true });
}
