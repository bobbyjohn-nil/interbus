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
- A new company starts with $427,200: enough for a depot, four stops and the two buses a line every 20 minutes needs, with some to spare.
- Found your company first: give it a name and pick its colour on the founding card.
- A checklist chip names the next thing to do: place a depot, draw a line, press play, close a day in profit, take a contract.
- Place a depot: the industrial land where one may stand turns green, and a card beside the pointer says whether this spot works and what it costs ($150,000 for the first).
- Draw a line: click the map to place stops (a click near a stop you already have joins it). A card shows the stops, the distance, how many people live within a walk, the buses running every 20 minutes needs and the price; Create buys it all, once you have a depot.
- Riders pay their fares, the city adds its subsidy, and at midnight a card lists the day's money, adding up to the change in cash.
- Buses run: each line's Sparrows pull out of the depot before the first departure, drive the line at its headways with a short stop at each stop, and go home after the last trip. Pause, and they stop where they are.
- Each line has an inspector: click the line on the map or Lines in the dock to see its riders, its buses, its peak, off-peak and overnight headways and a whole day's forecast of fares, running costs, wages and the drive to and from the depot. A headway that needs more buses says how many and what they cost before you buy them.
- The tools sit in a dock along the bottom of the screen, and the day, the time, the speed, cash and riders a day sit in a row of chips along the top, leaving the city the rest of the screen.
- When something can't be done, a notice in the bottom-left corner says why for a few seconds.
- Boston starts with no buses, trains or ferries of its own: the map carries none of today's stops, stations, rail lines or ferry routes, and the bus-only streets show as ordinary streets your buses can use.
- Running a line costs money: $0.90 for each kilometre a bus drives, $26 an hour for each driver on the road, the drive from the depot and back, and $300 a day for each depot. The midnight card lists each, and a Costs/day chip shows what a whole day will cost.
