# Playtest protocol

How every interbus playtest runs, from the 10-minute milestone checks to P0–P3 (PLAN §9). The point
is a record of what was actually fun, stuck or ugly, because no earlier version kept one
([GD-07](../history/lessons-ledger.md), [TS-10](../history/lessons-ledger.md)).

## Before

- **Freeze.** No merge to `main` from 18:00 the day before a playtest until its notes are committed;
  sessions keep working on branches ([PR-13](../history/lessons-ledger.md)).
- Open the preview and write down the **build chip's SHA** (bottom-right corner).
- Fresh-save sessions (P2, P3) start from Home with no save.

## During

- **No help for 10 minutes.** Nobody explains anything. Think out loud; the other person only writes.
- Note the clock time of each moment below as it happens.
- Play as you would at home; there is no right way.

## Measures

| Measure | Target |
|---|---|
| Time to the first line | ≤ 3 minutes |
| Time to the first profitable day | ≤ 8 minutes |
| Times stuck (no idea what to do next) | as few as possible; note each one |
| "What does this number mean?" moments | none; note each one |
| Keep playing? (1 = no, 5 = I'd keep going) | ≥ 3 |
| The best moment | one sentence |

## Frame rates (M5: exit check 4 and the slow-laptop run)

Open the preview with `?fps` after its address (`https://bobbyjohn-nil.github.io/interbus/?fps`) in current stable Chrome. A line in the map’s bottom-left corner reads, for example, "57 fps · p95 21 ms · zoom 14.0 · 0° · Full graphics": frames a second and the slowest 5% of frame times over the last 2 seconds, then the camera's zoom and tilt. "Low graphics" means Chrome is drawing the map without the GPU: note it, and check that hardware acceleration is on in Chrome's settings.

- **Your Mac (exit check 4):** play your own game at 2,700× (the old 2×, 1,800× until the tuning freeze). Note the readout flat after a minute, then tilted with `T`, then at zoom 17 and 60°: zoom in with the scroll wheel, and right-drag upward to tilt. PLAN §6 asks for at least 55 fps flat on your Mac, and 30 at zoom 17 and 60°.
- **The slow-laptop run (week 10):** on the slowest laptop either of you has, export your own game first with Saves → Export this game, since the busy scene replaces the game in play; then import the busy scene with Saves → Import a save file (then Replace this game, if a company is in play). It holds 209 buses at 08:00 on day 1. A session sends you the file, or `npm run bench scene` writes it. Pick 2,700× in the speed menu (the old 2×), then note the readout flat and at zoom 17 and 60°. PLAN §6 asks for at least 30 fps in both.
- **In the notes:** each reading as it appears, with the laptop's model and Chrome's version (`chrome://version`).

## After

- Record the **build chip's SHA again**. If it changed mid-session, the session is void: the build
  moved under you.
- Write notes **before talking** about them, so one person's opinion does not become both.
- Commit them as `docs/playtests/YYYY-MM-DD-<name>.md` with the template below.

## What happens with the results

- If P2 shows the step after the first line is unclear, week 10 goes to onboarding (PLAN §9).
- If either tester scores keep-playing below 3, January's look time goes to contracts and pacing.

## Template

```markdown
# <P0 | P1 | P2 | P3 | milestone check>: <date>

- Tester: <the owner | the artist | a named outside player>
- Build: <SHA at start> / <SHA at end>
- Theme and mode: <light/dark, flat/tilted>
- Length: <minutes>

## Times
- First line: <mm:ss>
- First profitable day: <mm:ss>

## What I tried

## Where I got stuck

## Dull, confusing or ugly

## Is it Boston?

## Keep playing (1–5) and why

## Best moment
```
