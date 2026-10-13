// Tests for the street graph, the cells and sim.json (PLAN §5, §14 item 11). Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCells, cluster, MAX_POINTS } from './cells.mjs';
import { ROOT } from './lib.mjs';
import { bakeSim, cityFrame, simLockPath } from './sim.mjs';
import { buildStreets, busAccess, decodeOpl, onewayOf, parseKmh, parseMetres, parseOpl } from './streets.mjs';

const FRAME = cityFrame([-71.16, 42.315, -70.98, 42.405]);

test('OPL escapes are decoded before any tag is read', () => {
  // V1's maxspeed regex on the raw text read "25%20%mph" as 25 km/h; it is 25 mph, 40 km/h.
  assert.equal(decodeOpl('25%20%mph'), '25 mph');
  assert.equal(decodeOpl('Storrow%20%Drive'), 'Storrow Drive');
  const osm = parseOpl('n1 Tmaxheight=11\'6" x-71.1 y42.35\nw7 Thighway=primary,maxspeed=25%20%mph,name=Beacon%20%Street Nn1,n2\n');
  assert.equal(osm.ways[0].tags.maxspeed, '25 mph');
  assert.equal(osm.ways[0].tags.name, 'Beacon Street');
  assert.ok(Math.abs(parseKmh(osm.ways[0].tags.maxspeed) - 40.23) < 0.01);
});

test('lengths read in metres or feet and inches; "default" and "none" are no limit', () => {
  assert.ok(Math.abs(parseMetres('11\'6"') - 3.5052) < 1e-9); // Storrow's 11'6": just over 3.5 m
  assert.ok(Math.abs(parseMetres('10\'') - 3.048) < 1e-9);
  assert.equal(parseMetres('3.2'), 3.2);
  assert.equal(parseMetres('3.2 m'), 3.2);
  assert.equal(parseMetres('default'), null);
  assert.equal(parseMetres('none'), null);
});

test('bus access follows bus, psv, motor_vehicle, access, then hgv; low clearance always closes', () => {
  assert.equal(busAccess({ highway: 'motorway', hgv: 'no', name: 'Storrow Drive' }), 'hgv=no');
  assert.equal(busAccess({ highway: 'primary', bus: 'no', psv: 'no', hgv: 'no', name: 'Commonwealth Avenue' }), 'bus=no');
  assert.equal(busAccess({ highway: 'primary', hgv: 'no', bus: 'yes' }), null);
  assert.equal(busAccess({ highway: 'residential', access: 'private', psv: 'yes' }), null);
  assert.equal(busAccess({ highway: 'residential', motor_vehicle: 'private' }), 'motor_vehicle=private');
  assert.equal(busAccess({ highway: 'primary', bus: 'yes', maxheight: '11\'0"' }), 'maxheight 11\'0"');
  assert.equal(busAccess({ highway: 'primary', maxheight: 'default' }), null);
});

test('one-way streets keep their direction, and oneway:bus=no frees buses', () => {
  assert.equal(onewayOf({ oneway: 'yes' }), 1);
  assert.equal(onewayOf({ oneway: '-1' }), -1);
  assert.equal(onewayOf({ oneway: 'yes', 'oneway:bus': 'no' }), 0);
  assert.equal(onewayOf({ highway: 'motorway' }), 1);
  assert.equal(onewayOf({ junction: 'roundabout' }), 1);
  assert.equal(onewayOf({}), 0);
});

/** A tiny city: nodes on a line 100 m apart (x = i × 100 m east of the origin). */
function line(ways, extraNodes = '') {
  const lonPerM = 1 / FRAME.metresPerDegLon;
  const nodes = Array.from({ length: 10 }, (_, i) => `n${i + 1} T x${FRAME.origin[0] + i * 100 * lonPerM} y${FRAME.origin[1]}`);
  return parseOpl(`${nodes.join('\n')}\n${extraNodes}${ways.join('\n')}\n`);
}

test('chains of degree-2 nodes collapse into one edge, lengths and times summed', () => {
  // Three ways end to end, 1-2-3-4-5, meet only each other: one edge 400 m long.
  const osm = line(['w10 Thighway=residential Nn1,n2,n3', 'w11 Thighway=residential Nn3,n4', 'w12 Thighway=residential Nn4,n5']);
  const { nodes, edges } = buildStreets(osm, FRAME);
  assert.equal(nodes.length, 2);
  assert.equal(edges.length, 1);
  assert.equal(edges[0].dm, 4000);
  assert.equal(edges[0].cs, Math.round((400 / (30 / 3.6)) * 100));
  assert.equal(edges[0].points.length, 5);
});

test('a one-way street that leads nowhere it can come back from is dropped', () => {
  // 1-2-3 two-way; 3→4 one-way only, a trap for a bus.
  const osm = line(['w10 Thighway=residential Nn1,n2,n3', 'w11 Thighway=residential,oneway=yes Nn3,n4']);
  const { edges, report } = buildStreets(osm, FRAME);
  assert.deepEqual(edges.map((e) => e.way), [10]);
  assert.ok(report.droppedKm > 0.09 && report.droppedKm < 0.11);
});

test('a barrier node under 3.5 m closes the street it sits on', () => {
  const osm = line(['w10 Thighway=residential Nn1,n2,n3', 'w11 Thighway=residential Nn3,n4,n5'], '');
  osm.nodes.get(4).tags.maxheight = '9\'0"';
  const { edges, report } = buildStreets(osm, FRAME);
  assert.deepEqual(edges.map((e) => e.way), [10]);
  assert.deepEqual(report.closed.map((c) => c.why), ['a low barrier on it']);
});

test('cluster gives at most 8 points, keeps every person, and is the same every time', () => {
  const items = Array.from({ length: 40 }, (_, i) => ({ x: (i * 37) % 350, y: (i * 91) % 350, w: 1 + (i % 7), key: String(i).padStart(3, '0') }));
  const a = cluster(items);
  assert.ok(a.length <= MAX_POINTS);
  assert.equal(a.reduce((s, p) => s + p.w, 0), items.reduce((s, it) => s + it.w, 0));
  assert.deepEqual(cluster([...items].reverse()), a);
});

test('cells sit on the city grid and keep every resident, worker and job', () => {
  const blocks = [
    { geoid: '1', lon: FRAME.origin[0] + 10 / FRAME.metresPerDegLon, lat: FRAME.origin[1] + 10 / FRAME.metresPerDegLat, pop20: 100 },
    { geoid: '2', lon: FRAME.origin[0] + 360 / FRAME.metresPerDegLon, lat: FRAME.origin[1] + 10 / FRAME.metresPerDegLat, pop20: 50 },
  ];
  const cells = buildCells({ blocks, rac: new Map([['1', 40]]), wac: new Map([['2', { jobs: 7, sectors: Array(20).fill(0).map((_, i) => (i === 3 ? 7 : 0)) }]]), frame: FRAME, cellMetres: 350 });
  assert.deepEqual(cells.map((c) => [c.i, c.j, c.residents, c.workers, c.jobs]), [[0, 0, 100, 40, 0], [1, 0, 50, 0, 7]]);
  assert.equal(cells[1].sectors[3], 7);
});

test("mini-Boston's sim.json bakes to its golden hash, twice, with every person kept (I17, G1–G3)", () => {
  const lock = JSON.parse(readFileSync(simLockPath('boston', 'mini-boston'), 'utf8'));
  const a = bakeSim('boston', 'mini-boston');
  const b = bakeSim('boston', 'mini-boston');
  assert.equal(a.text, b.text);
  assert.equal(a.sha256, lock.sha256, 'the bake changed: run `node tools/bake/sim.mjs boston mini-boston --lock` if that was meant, and say why in the commit');
  const manifest = JSON.parse(readFileSync(join(ROOT, 'tools/bake/fixtures/mini-boston/fixture.json'), 'utf8'));
  assert.equal(a.report.residents, manifest.residents);
  assert.ok(a.report.gates.every((g) => g.ok));
});

test('the fixture keeps lines off Storrow and Memorial Drives and opens busways to all (PLAN §5, D17)', () => {
  const sim = JSON.parse(bakeSim('boston', 'mini-boston').text);
  assert.deepEqual(sim.names.filter((n) => /Storrow|Memorial/.test(n)), []);
  assert.ok(sim.edges.some((e) => sim.classes[e[5]] === 'busway'), 'a Back Bay busway is a general street');
  assert.ok(sim.names.includes('Massachusetts Avenue') && sim.names.includes('Huntington Avenue'));
});
