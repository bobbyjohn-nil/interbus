# Changelog

All notable changes to the game are recorded here, newest first, in words a player would use.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Versions happen only when the owner says so.** Every change a player would notice adds its entry under [Unreleased] as it lands. A numbered version is created only when the owner types `/ship <version>`, which moves everything under [Unreleased] into a dated version, commits `Release v<version>`, merges it through a pull request and tags `v<version>`. Nothing else adds a version, bumps a version number or creates a `v*` tag: not the end of a session, not a milestone, not a plan. `node scripts/changelog.mjs check` runs in CI and fails any version not added by its own `Release v<version>` commit, and any later edit to released notes. It cannot tell who made that commit; the owner's yes inside `/ship` is the guard.

## [Unreleased]

<!-- Entries go here as "- " bullets under ### Added, ### Changed, ### Fixed or ### Removed (### Deprecated and ### Security also exist), written for players. Tests, CI, refactors and docs get no entry. Delete the "Nothing yet" line with the first entry. -->

Nothing yet. There is no game code; the first entry arrives with the first change a player can see.
