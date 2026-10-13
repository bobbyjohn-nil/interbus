// Tests for depot land, water and gateways (PLAN §5, the M2 spec item 8). Run: npm run test:scripts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaRings, inRing, isDepotLand, isWater } from './areas.mjs';
import { assignInbound, roadGateways } from './gateways.mjs';
import { parseOpl } from './streets.mjs';
import { cityFrame } from './sim.mjs';

test('areaRings: closed ways, and a multipolygon joined from outer ways in any direction; open rings skipped', () => {
  const osm = parseOpl(
    [
      'n1 T x0 y0', 'n2 T x0.001 y0', 'n3 T x0.001 y0.001', 'n4 T x0 y0.001',
      'n5 T x0.01 y0', 'n6 T x0.011 y0', 'n7 T x0.011 y0.001', 'n8 T x0.01 y0.001',
      'n9 T x0.02 y0', 'n10 T x0.021 y0',
      'w1 Tlanduse=industrial Nn1,n2,n3,n4,n1',
      'w2 T Nn5,n6,n7', 'w3 T Nn5,n8,n7',
      'w4 Tlanduse=industrial Nn9,n10',
      'r1 Ttype=multipolygon,landuse=industrial Mw2@outer,w3@outer',
    ].join('\n') + '\n',
  );
  const rings = areaRings(osm, isDepotLand);
  assert.deepEqual(rings.map((r) => [r.id, r.ring.length]), [['w1', 4], ['r1', 4]]);
  assert.ok(inRing(rings[1].ring, 0.0105, 0.0005));
  assert.ok(!inRing(rings[1].ring, 0.0095, 0.0005));
});

test('depot land is industrial land, but never a rail yard tagged industrial (D17, G10)', () => {
  assert.ok(isDepotLand({ landuse: 'industrial' }));
  assert.ok(!isDepotLand({ landuse: 'industrial', railway: 'yard' }));
  assert.ok(!isDepotLand({ landuse: 'industrial', public_transport: 'station' }));
  assert.ok(!isDepotLand({ landuse: 'railway' }));
});

test('road gateways: one per major road reaching the edge, merged when close, none from minor streets', () => {
  const box = [-71.16, 42.315, -70.98, 42.405];
  const frame = cityFrame(box);
  // Nodes in decimetres: a primary road meeting the west edge, a trunk 300 m along it (merged), a
  // residential street at the edge (ignored), and a primary 2 km in (too far from any edge).
  const streets = {
    nodes: [[1000, 20000], [3000, 23000], [1000, 50000], [5000, 50000], [20000, 30000], [40000, 30000]],
    edges: [
      { a: 0, b: 4, cls: 'primary', name: 'Commonwealth Avenue' },
      { a: 1, b: 4, cls: 'trunk', name: 'Soldiers Field Road' },
      { a: 2, b: 3, cls: 'residential', name: 'Side Street' },
      { a: 4, b: 5, cls: 'primary', name: 'Inner Road' },
    ],
  };
  const gateways = roadGateways(streets, frame, box);
  assert.deepEqual(gateways.map((g) => [g.name, g.node]), [['Commonwealth Avenue', 0]]);
  const { inbound, unplaced } = assignInbound(
    [...gateways, { name: 'Logan', kind: 'airport', node: 5, x: 4000, y: 3000 }],
    [{ tract: 't1', w: 'b1', jobs: 7 }, { tract: 't2', w: 'b1', jobs: 2 }, { tract: 't3', w: 'b9', jobs: 4 }],
    new Map([['t1', [-71.3, 42.33]], ['t2', [-70.9, 42.36]], ['t3', [-71.3, 42.33]]]),
    (w) => (w === 'b1' ? 3 : undefined),
    frame,
  );
  // Every commuter comes in by road, even from the east, while Logan carries none until visitors.
  assert.deepEqual(inbound, [[[3, 9]], []]);
  assert.equal(unplaced, 4);
});

test('water is natural=water or a riverbank, not a park over a covered reservoir (G5)', () => {
  assert.ok(isWater({ natural: 'water', water: 'river', name: 'Charles River' }));
  assert.ok(isWater({ waterway: 'riverbank' }));
  // Brookline's Single Tree Hill Reservoir: 181 people live in a block inside it.
  assert.ok(!isWater({ leisure: 'park', water: 'reservoir', name: 'Single Tree Hill Reservoir' }));
});
