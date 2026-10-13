# Status

The running handoff between Claude sessions. Every session reads it right after `CLAUDE.md`, and every pull request that merges updates it, so a new session or a fresh context window starts from here and loses nothing ([PR-06](history/lessons-ledger.md)). The plan is [PLAN.md](../PLAN.md); decisions are in [DECISIONS.md](DECISIONS.md).

**Updated:** 2026-10-13, at `main` 24ea515.

## Live now

- **Preview:** https://bobbyjohn-nil.github.io/interbus/ shows `main` 24ea515. Deploy preview run 38340282409's live check found that SHA on the build chip and in `version.json`, with the map ready and filling the window.
- **The first redeploy kept the previous build's files** on the real site ("kept 1 earlier build(s), fetched 2 file(s)").
- **Repo settings:** `main` is the default branch, and Pages builds from GitHub Actions. The `github-pages` environment allows one Branch rule, `main`.
- **How code reaches `main` (D23):** Claude opens a pull request from `claude/kind-ride-1zb3tn` and merges it with a merge commit once its checks are green. After a merge the branch fast-forwards to `main`, and the next change is a new pull request.
- **Data:** release `city-boston-tiles-20261012-57ac68da` holds Boston's map file (15.6 MB). Release `city-boston-sources-20261012` holds the bake's eight pinned inputs. Mini-Boston is committed under `tools/bake/fixtures/mini-boston/`, and G4 is exact (Boston 675,647).

## Waiting on the owner

- [ ] Protect `main` (PLAN §14 item 2):
  - pull requests only;
  - "Versions only via /ship" required;
  - merge commits only;
  - a `v*` tag ruleset blocking update and deletion.
- [ ] Say whether V1's site still loads. If it doesn't, Claude hosts V1 on the preview for P0 (week 1 item 6).
- [ ] **P0, by Fri Oct 17:** the owner and the artist play V1 for 30 minutes each. Notes go in `docs/playtests/2026-10-17-p0-v1-baseline.md`.
- [ ] **The artist, by Sun Oct 18:** read `docs/art/MODELS.md` §3, §3.1, §5, §6 and §10 and answer §12; commit `art/LICENSE.md`.
- [ ] **D20, by Sun Oct 25:** the art's open licence (recommended CC BY 4.0).
- [ ] **Week 2 check:** "Does this look like Boston?" (PLAN §14 item 14).

## In progress: week 2 (Oct 19–25, started Oct 13)

PLAN §14 items 10–13. The exit check: `T` tilts and returns; dots sit where Back Bay to Longwood lives and works; "people within a walk"; does it look like Boston?

- [ ] **Item 10, ports:**
  - V3: ledger, saves (async store, bus counter, schema hash), calendar, errors;
  - V2: RNG, graph, A*;
  - V1: geo.

  Each port's tests pass, I7 and the schema hash pass, and each is shown failing on the old bug.
- [ ] **Item 11, the city on the fixture:**
  - worker host;
  - V1's pipeline and fixtures ported;
  - census to cells, and the street graph with bus access (G2, G3);
  - `sim.json` and its loader;
  - demand dots and the catchment probe;
  - Inner Boston's height-tag count;
  - smoke;
  - the fare-row signal, due **Sun Oct 25**.
- [ ] **Item 12, raw tilt:** `T` sets pitch 50° with extrusions (≤0.5 session), plus the board mask and the style and bundle tests.
- [ ] **Item 13:** `docs/specs/current.md` for M1, ≤150 lines, with "first dollar on the fixture by Nov 1" on top. Due **Sun Oct 25**.

## Next

1. Week 2 as above, in this order: M1 spec (item 13) → ports (10) → the city on the fixture (11) → tilt (12).
2. Week 3, **M1 first dollar by Sun Nov 1**. Money before presentation: from week 3 no look work starts until the first dollar.

## Autonomy protocol (the owner's request, 2026-10-13)

- **Hourly check-in.** A Routine named "interbus hourly check-in" fires every hour into the session that owns `main`. Each firing:
  1. reads this file, fetches, and checks open pull requests and `main`'s CI;
  2. fixes a red or reviewed pull request first;
  3. otherwise continues the first unblocked item under Next or In progress, in small committed and pushed steps;
  4. ends with one line if everything waits on the owner.
- **Usage limits.** If the owner's usage limit runs out, the current turn stops and nothing is lost, because work is pushed in small commits and this file says what is next. The next hourly firing after the limit resets carries on, with no owner action.
- **A new session taking over.** Read `CLAUDE.md`, then this file. List the account's Routines, disable the "interbus hourly check-in" bound to the old session, and create the same Routine bound to the new one. Only one session owns `main`, so never let two check-ins run.
- **Stopping.** The owner says "stop the check-ins", or turns the Routine off under Routines on claude.ai.
- **What a check-in never does:**
  - create a version (only the owner's `/ship`);
  - merge during a playtest freeze;
  - start Steam or desktop work before v1.0 (CLAUDE.md);
  - change repository settings;
  - spend more than one line when nothing changed.
- **Questions** follow CLAUDE.md: at most five a week, batched, each with a recommendation. Until answered, the plan's recommendation stands (PLAN §13), so work does not stop for an open question.

## Session notes (cloud sessions)

- **The session-start hook** (`.claude/hooks/session-start.sh`):
  - installs npm packages, the pinned pyosmium, the fonts and the city files;
  - sets `BAKE_PYTHON`, `PW_CHROMIUM` and `NODE_USE_ENV_PROXY`;
  - prints this file into the session.
- **The proxy** blocks `github.io`, `api.github.com`, Census, Geofabrik and Protomaps. It allows GitHub release downloads, npm and PyPI.
  - Use the GitHub tools for the API.
  - Fetch source data only in the dispatch-only workflows (`tiles.yml`, `bake-sources.yml`). Never route around a block.
- **Long downloads and bakes:** the fixture cut takes about 4 minutes. `Bake fixture check (manual)` re-cuts it on a runner and fails on any byte of difference.
- **Pitfall:** `pkill -f <pattern>` run inside a command line that contains the same pattern kills its own shell. Find the process id first.
