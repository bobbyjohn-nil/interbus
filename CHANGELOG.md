# Changelog

All notable changes to the game are recorded here, newest first, in words a player would use.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Versions happen only when the owner says so.** Every change a player would notice adds its entry under [Unreleased] as it lands. A numbered version is created only when the owner types `/ship <version>`, which moves everything under [Unreleased] into a dated version, commits `Release v<version>`, merges it through a pull request and tags `v<version>`. Nothing else adds a version, bumps a version number or creates a `v*` tag: not the end of a session, not a milestone, not a plan. `node scripts/changelog.mjs check` runs in CI and fails any version not added by its own `Release v<version>` commit, and any later edit to released notes. It cannot tell who made that commit; the owner's yes inside `/ship` is the guard.

## [Unreleased]

<!-- Entries go here as "- " bullets under ### Added, ### Changed, ### Fixed or ### Removed (### Deprecated and ### Security also exist), written for players. Tests, CI, refactors and docs get no entry. Delete the "Nothing yet" line with the first entry. -->

### Added

- The preview opens on real Boston: streets, buildings, the Charles, parks and neighbourhood names from Back Bay to Cambridge, drawn flat in the light theme and set in Afacad Flux. Zoom in to see individual buildings.
- The build number of the version you are looking at sits in the bottom-right corner, beside the map credits.
- Press T to tilt the map into 3D, with Boston's buildings standing up from its streets; press T again to lay it flat. Buildings whose height isn't on record stand about three storeys for now.
- Everything beyond the play area is greyed out behind a dashed edge, so you can see where the board ends.
- Dots show where people live (purple) and where they work (blue) from Back Bay to Longwood, sized by how many.
- Point anywhere on the map to see how many people live within a walk of that spot.
- A test bus line from Copley to Longwood: press Run the debug line, then play. Riders pay their fares, the city adds its subsidy, and at midnight a card lists the day's money, adding up to the change in cash.
