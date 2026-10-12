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
