# Changelog

All notable changes to the game are recorded here, newest first, in words a player would use.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/2.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Versions happen only when the owner says so.** Every change a player would notice adds its entry under [Unreleased] as it lands. A numbered version is created only when the owner types `/ship <version>`, which moves everything under [Unreleased] into a dated version, commits `Release v<version>`, merges it through a pull request and tags `v<version>`. Nothing else adds a version, bumps a version number or creates a `v*` tag: not the end of a session, not a milestone, not a plan. `node scripts/changelog.mjs check` runs in CI and fails any version not added by its own `Release v<version>` commit, and any later edit to released notes. It cannot tell who made that commit; the owner's yes inside `/ship` is the guard.

## [Unreleased]

<!-- Entries go here as "- " bullets under ### Added, ### Changed, ### Fixed or ### Removed (### Deprecated and ### Security also exist), written for players. Tests, CI, refactors and docs get no entry. Delete the "Nothing yet" line with the first entry. -->

### Added

- Medals: bronze for a quarter's report card of 55 or better, silver for 25,000 trips carried, and gold for a quarter of 75 or better with no grade under 60 on a day of 5,000 trips. The midnight card says when you win one, the medals you hold show as dots on the Contracts chip, and the Contracts panel lists all three with the trips left to silver.
- Silver unlocks the Goliath: from the midnight that brings silver, the 115-seat bus is for sale on the line and draft cards.
- Insert a stop into a running line: in Lines, press Insert a stop and click the line where it should go. The card prices the stop and any bus its longer round trip needs, and warns of a long detour (more than 15% longer on that stretch); Insert adds it, buses already on their way finish their trip as they set out, and Undo takes it back while paused.
- Roadworks: now and then the city digs up as much as 400 m of a street one of your lines drives, for 3 to 6 days. You hear the evening before, on the day card ("Roadworks on Huntington Avenue tomorrow, for 4 days"), and the street shows hatched on the map. While the works are on it shows solid, and every line through it drives that stretch at about two-thirds speed, so its round trip is longer; a line without the buses for the longer trip runs a little less often until they end.
- The line card shows the line's round trip at peak and off-peak, and how much roadworks on its streets add to it.
- RIDERSHIP contracts: beside the ones asking for a bus every so often, the city now offers contracts for 150, 400 or 800 paying riders a day boarding near a landmark, at $60,000, $150,000 or $240,000. Every stop within a walk of the landmark counts, all your lines together, but a rider changing onto your line there boards free and is not counted. The card shows today's boardings against the ask, and the ring on the map shows the ask. Every six offers hold each of the six asks once.
- Rush hour slows your buses: on main streets a bus drives about 11% slower than the day's average at the peaks and 11% quicker off-peak, on motorways a little more and on side streets hardly at all. Each line's round trips, the buses it needs and the bus count on its cards follow, so a busy line on main streets may need one more bus at peak. Riders feel it too: across Inner Boston about 7% fewer ride at the peaks and 7% more off-peak, and the day's riders hardly change.
- Extend a line from either end: in Lines, press Extend from its first or last stop and click the map beyond it. The card shows the whole line as it would run, the new stops and any bus its longer round trip needs; Extend buys them.
- Take a stop off a line from the stop's card: the line runs on without it, and a stop no other line calls at comes down, giving back half of what it and its fittings cost ($2,000 for a Sign). A line keeps at least two stops.
- Riders change buses: a trip can ride two of your lines, changing at a stop both call at or walking to the other line's stop up to 250 m away. A change costs riders that walk, a wait for the second bus and a few minutes' bother that a better stop eases (6 minutes at a Sign or Shelter, down to 2 at a Transfer Hub). Nobody changes onto a line they could have walked to from home, or off one that already takes them to work.
- A trip pays one fare, to the line it boards first, and the city's subsidy comes once a trip too, so the second bus is free. Splitting a line in two never earns more than running it whole.
- A stop's card says how many of the riders boarding there change from another line.
- Export session, in Saves: a file of this session from the quarter's start (or the last reload), with every command you gave, that replays to exactly the same game. Attach it to a bug report.
- Contracts: the city offers three at a time, each near a landmark such as Longwood or Copley Square, asking for a bus every 10, 15 or 20 minutes and paying $240,000, $150,000 or $60,000. Take one with a click; meet it at a stop within a walk, at peak and off-peak alike, for 10 days in a row within 20, and it pays as a Contracts row on the midnight card. Its card shows how often a bus comes there today against the ask, and its ring on the map shows how far riders will walk to that stop.
- The checklist's last step, Take a contract, opens the contracts; once you take one the checklist is done and a Contracts chip takes its place.
- The preview opens on real Boston: streets, buildings, the Charles, parks and neighbourhood names from Back Bay to Cambridge, drawn flat in the light theme and set in Afacad Flux. Zoom in to see individual buildings.
- The build number of the version you are looking at sits in the bottom-right corner, beside the map credits.
- Press T to tilt the map into 3D, with Boston's buildings standing up from its streets; press T again to lay it flat. Four buildings in five stand at their measured height, from OpenStreetMap or, where it has none, Overture Maps (credited in the corner); the rest stand about three storeys.
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
- Riders weigh the wait: up to a bus every 12 minutes most of them time their trip to the timetable, but a bus every hour carries few, so a line pays best every 10 to 15 minutes.
- Money can run out: a lender lets cash go down to -$150,000, charging 0.06% a day on what you owe as an Interest row, and turns away a purchase that would go further. A day that ends below the limit starts a red countdown chip ("5 days to get above -$150k"); five in a row and the lender calls in the loan, but Restart this quarter takes you back to the start of the quarter, or to the save you loaded during it.
- Every ten days the quarter closes with a report card on the midnight card: Coverage, Reliability, Comfort and Money, each out of 100. A good card earns a grant from the city and a poor one a fine, as one of the day's rows.
- Saves, in the dock: three slots to keep a game in beside the one that saves itself as you play, and Export and Import to keep a game as a file. A file the game cannot read is turned away with a note, and the game you are playing stays as it was.
- A save made on an earlier map of Boston carries on when the map is updated, its stops moved onto the new map's streets. If a stop has no street near it any more, the save is kept aside and a note says so.
- Undo while paused: the Undo chip (or Ctrl+Z, ⌘Z on a Mac) takes back the last thing you did since you paused, a depot, a line, a headway, a bus model, a fare or a stop, cash and all. Once the clock has run, it says so instead.
- Finance, in the dock: every kind of money in and out for today, yesterday and this quarter, beside what a whole day is forecast to bring, adding up to the change in cash.
- Make a stop nicer from its card: a Shelter ($12,000), a Station ($35,000), an Interchange ($90,000, with 3 lines calling) or a Transfer Hub ($200,000, with 5). A nicer stop feels closer on foot, so more people walk to it; stepping it back down returns half of what the step cost.
- Click a stop to see its day: how many board and get off there, and what it earns. A stop with fewer than 5 boardings a day reads QUIET, and one losing more than $20 a day reads LOSS, with a ring around it on the map.
- Set each line's fare, from $1.00 to $5.00, on its card. Riders on short hops mind a dear fare more than riders going far, the city's subsidy shrinks as the fare climbs past $2.25 and is gone at $5.00, and the card names the fares that make the line the most money.
- Buses fill up: when more riders want a line than its seats carry, the extra riders are turned away in that half-hour, and the line's card says when it is full ("Full at 17:00") and how many riders a day it turns away. Running more often or with bigger buses carries them.
- Two more buses: the Metro 40 (70 seats, $260,000) and the Goliath (115 seats, locked until a silver medal). Each line runs one model: pick it on the new-line card, or swap a line's buses on its card, where the old ones sell for half their price. Bigger buses are drawn longer on the map.
- The game saves itself in this browser as you play, so a reload carries on where you left off. A save from an older build is kept aside, a new game starts, and a note says so.
- Boston starts with no buses, trains or ferries of its own: the map carries none of today's stops, stations, rail lines or ferry routes, and the bus-only streets show as ordinary streets your buses can use.
- Running a line costs money: $0.90 for each kilometre a bus drives, $26 an hour for each driver on the road, the drive from the depot and back, and $300 a day for each depot. The midnight card lists each, and a Costs/day chip shows what a whole day will cost.

### Changed

- Changing a line while its buses run no longer throws them across the map: a bus already on its way finishes its trip on the route and the times it set out with, and the next departures follow the change as buses come free. That holds for taking a stop off, extending a line, a new headway or bus model, a new depot, and roadworks starting or ending.
- A contract nobody takes is withdrawn after 10 days, and a new offer takes its place.
- Riders a day, in the chips along the top, counts each trip once, even when it rides two lines.
- Where several of your lines serve the same trip, riders take whichever comes first: lines sharing a stretch split its riders by how often each runs, and together, coming more often, they carry more than any one would.
- The preview now plays all of Inner Boston, not just Back Bay to Longwood: Boston, Cambridge, Somerville and Brookline, with homes and jobs across all four and contracts offered at Kendall Square, Harvard Square and Downtown Crossing too. Demand is scaled so a first line from Copley to Longwood carries about what it did.
- How far people commute now follows Boston's own census records rather than a generic guess, so trips are a little shorter on average and a line from Copley to Longwood carries about 3% fewer riders.
