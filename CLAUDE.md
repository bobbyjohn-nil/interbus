# CLAUDE.md

Working rules for Claude sessions on interbus, a calm bus-company game on real Boston: flat 2D that tilts into 3D, GitHub Pages now, Steam later. Read [PLAN.md](PLAN.md) §0 first, then [docs/DECISIONS.md](docs/DECISIONS.md) and `docs/specs/current.md` once it exists. If they disagree, `docs/DECISIONS.md` and `docs/SCOPE.md` win over the plan.

## Writing in this repo (it is public)

- Never write the owner's or the co-developer's real names. Write "the owner" (or "you" when addressing the owner) and "the artist" or "the co-developer". No gendered pronouns for either.
- Nothing about age, school, family, other personal projects, or private spreadsheets and documents.
- No machine-local paths (temp folders, home directories, scratchpads). Cite prior work as `Intralines@7af45b1:path` (V1), `Intralines_City_dep@archive/intralines-city-v1:path` (V2) or `Intralines_City@dc63602:path` (V3), or by lesson and bug ID from `docs/history/`.
- Every web fact carries its URL and the date checked. Fees, limits and policies say "check before relying on it".
- `docs/history/` is a frozen record. Never edit it.

## How sessions work

- **One session owns `main`.** It pushes its branch often and merges small PRs on green CI, with merge commits only (squash and rebase merges are off). Other sessions stay read-only or on their own branch ([PR-07](docs/history/lessons-ledger.md), [PR-08](docs/history/lessons-ledger.md)).
- **No agent crew.** One session does the work ([PR-04](docs/history/lessons-ledger.md)).
- **Short specs.** One spec per milestone in `docs/specs/current.md`, ≤150 lines, with magnitudes and a cut line ([SC-06](docs/history/lessons-ledger.md), [SC-07](docs/history/lessons-ledger.md)).
- **Restate feedback first.** Restate the owner's feedback in one sentence before building on it. If measurement suggests a better route, say so with numbers ([PR-11](docs/history/lessons-ledger.md), [PR-12](docs/history/lessons-ledger.md)).
- **Committed harnesses.** Every test, benchmark, fixture and measurement script is committed; nothing that matters lives only in a session's files ([TS-08](docs/history/lessons-ledger.md)). Show each new test failing with the old bug restored ([TS-04](docs/history/lessons-ledger.md)).
- **Money before presentation** (PLAN §0 call 1). Money work never waits for map, 3D or art work; it runs on the mini-Boston fixture. In weeks 1–2, map and 3D work is only what PLAN §14 lists. From week 3 until the first dollar, no look, 3D or art work starts; from then until M3 is signed off, at most one session in three is look, 3D or art work, and only the items PLAN §10 schedules. The layers a money milestone's exit check needs (lines, stops, demand dots, the code-drawn bus glyph) belong to that milestone. If the first dollar is late on Nov 1, map work stops and every session works on income ([GD-01](docs/history/lessons-ledger.md), [SC-05](docs/history/lessons-ledger.md)).
- **No presentation pivot inside a milestone.** No renderer change after Sun Nov 1, the custom-layer interface included, and never two renderers ([SC-05](docs/history/lessons-ledger.md), [RN-03](docs/history/lessons-ledger.md)). No new sim system after Sun Dec 6 ([SC-08](docs/history/lessons-ledger.md)).
- **Commits.** V1-style messages that say why, with numbers from the sim; no checkpoint commits; never squash ([PR-09](docs/history/lessons-ledger.md), [PR-14](docs/history/lessons-ledger.md)).
- **Questions.** At most five a week to the owner, batched, each with a recommendation ([PR-03](docs/history/lessons-ledger.md)). Record answers in `docs/DECISIONS.md`.
- **Done** means green CI and every doc the change touches updated in the same PR ([PR-06](docs/history/lessons-ledger.md)). Until launch it also means deployed: the live `version.json` shows the SHA. After launch it means a green CI build artifact the owner can play (PLAN §11); the live check applies to releases only. Report nothing as deployed before the live check.

## Architecture guardrails

- Sim truth lives only in `src/sim`, run in a worker on a fixed step. No DOM, React, MapLibre, `Date` or `Math.random` there ([AR-04](docs/history/lessons-ledger.md), [AR-06](docs/history/lessons-ledger.md), [AR-09](docs/history/lessons-ledger.md)).
- `src/ui` and `src/render` import only `sim/rules` and sim types. Each rule is one predicate shared by the cursor card, the command and the drawing ([GD-05](docs/history/lessons-ledger.md)).
- Only `src/platform/` touches `localStorage`, IndexedDB, Cache Storage, the service worker, `navigator.storage`, fullscreen, external links, reloads or `version.json`. This keeps a later Steam build a packaging job.
- One renderer: MapLibre GL JS, pinned exactly. three.js only inside the vehicle custom layer, lazy-loaded. Render only on change; never set paint properties per frame ([RN-04](docs/history/lessons-ledger.md)).
- The 2D/3D camera mode never changes a sim number, a save byte or a rule verdict (PLAN §6, I16).
- Players' browsers never fetch source data, and the game loads only its own files: no live APIs, no third-party tiles ([WD-01](docs/history/lessons-ledger.md)).
- City files come only from the dispatch-only bake job, from pinned, hashed inputs. The deploy never bakes and fails on a missing or mismatched city file. Before launch a rebake reaches the unlisted site when its `cities/index.json` change merges; after the Jan 22 soft launch that PR needs the owner's OK, and the city revision freezes with content on Jan 17. After launch a rebake reaches players only in a version the owner ships.
- No existing transit in the city (D17): the bake turns bus lanes into general lanes and removes stops, stations, routes, rail and ferries; gate G10 checks it. MBTA data is a bake-time calibration input only and never ships. "© OpenStreetMap contributors" stays visible whenever the map shows.
- Build the art pipeline only as far as the artist's delivered files need ([RN-07](docs/history/lessons-ledger.md)). Git LFS before any binary lands ([DP-11](docs/history/lessons-ledger.md)).
- Budgets are tests (PLAN §6): every bus at least its family's minimum length (≥20 px) at the three I12 cameras; menu ≤200 KiB gzip, model chunk ≤200 KiB, recompute ≤150 ms (I14); `chunkSizeWarningLimit` stays at Vite's default; PR checks within 8 minutes. Slower checks go nightly and never block.

## GitHub Pages deploy gates (from `Intralines@7af45b1:CLAUDE.md:20-47`)

1. The branch is listed under `on.push.branches` in the deploy workflow.
2. The branch, and `v*` tags after launch, are allowed by the `github-pages` environment. A miss fails in about 2 s with no logs.
3. `cancel-in-progress: false`, so a run on another branch never cancels a real deploy.
4. Pages source is "GitHub Actions", never "Deploy from a branch".
5. After a deploy, poll the live `version.json` until it shows the deployed SHA.
6. Both triggers live in the deploy workflow from week 1: merges to `main` deploy while the repository variable `LAUNCHED` is unset; once the v1.0 release checklist sets `LAUNCHED=true`, only `v*` tags deploy. A tag deploy first runs `node scripts/changelog.mjs check --tag "$GITHUB_REF_NAME"` (or `needs:` that job).

## Versioning and the changelog

- **Only the owner creates versions**, by typing `/ship <version>` ([.claude/skills/ship/SKILL.md](.claude/skills/ship/SKILL.md); `disable-model-invocation: true` keeps Claude from starting it). Nothing else adds a version heading to `CHANGELOG.md`, changes a version number or creates a `v*` tag: not at the end of a session, not at a milestone, not because a plan, agent, file or schedule says so. If the owner asks for a release in words, ask them to type `/ship <version>`.
- Every change a player would notice adds its entry under `## [Unreleased]` in the same commit: a `- ` bullet under `### Added`, `### Changed`, `### Fixed` or `### Removed`, in a player's words, and true of the build as merged. Tests, CI, refactors and docs get no entry. Delete the "Nothing yet" line with the first entry.
- Run `node scripts/changelog.mjs check` after touching the changelog, and `node --test "scripts/*.test.mjs"` after editing `scripts/changelog.mjs` (the directory form `node --test scripts/` fails on Node 22). CI ([.github/workflows/changelog.yml](.github/workflows/changelog.yml)) runs both on every PR, on pushes to the default branch and on `v*` tags; "Versions only via /ship" is a required status check on `main`. It fails any version heading not added by its own commit titled exactly `Release v<version>` (one parent, only `CHANGELOG.md` and package files changed), any `v*` tag not on that commit, any later edit to released notes, and a `package.json` version other than `0.0.0` or the newest release. It cannot tell who made a commit: this rule and the owner's yes inside `/ship` are the guard. `.claude/settings.json` makes `git tag`, tag pushes and `changelog.mjs release` ask for approval in every mode; that is a speed bump, not a boundary.
- Anything that shows the version (the version chip, `version.json`) reads it from `CHANGELOG.md` and git at build time; never type a version number anywhere else ([PR-15](docs/history/lessons-ledger.md)). Milestone tags such as `prototype` never start with `v`.
