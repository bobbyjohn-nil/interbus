import { describe, expect, it } from 'vitest';
import type { DepotView, EventView } from '../../sim/types';
import { depotsKey, eventLayerKey } from './MapView';

// The systems audit (D26): the depots' layer was keyed by id alone, and ids restart in every game, so
// loading a save whose depot 1 stands elsewhere left it drawn at the old place until a reload. Shown
// failing (TS-04) on the old MapView, which had no key of its own to export; e2e/gpu.spec.ts checks the
// place drawn (data-depots) after an import.
describe('the depots layer key', () => {
  const a: DepotView = { id: 1, at: [-71.09047, 42.33799] };
  const b: DepotView = { id: 1, at: [-71.10852, 42.33681] };

  it('changes when a loaded game has its depot 1 somewhere else', () => {
    expect(depotsKey([b])).not.toBe(depotsKey([a]));
    expect(depotsKey([b])).toBe('1@-71.108520,42.336810');
  });

  it('stays while the depots stay, so their layer is not set again with every snapshot (RN-04)', () => {
    expect(depotsKey([{ ...a }])).toBe(depotsKey([a]));
    expect(depotsKey([a, { id: 2, at: b.at }])).not.toBe(depotsKey([a]));
  });
});

// The review of the audit's fixes: the event's layer was keyed by its street, start day, phase and days
// left, so a loaded game's event of another kind, or elsewhere on the same street or by the same
// landmark, on the same days kept the old one's words or place. Shown failing (TS-04) with the key put
// back without the kind ("changes with the kind") and without the place ("changes with the place").
describe('the event layer key', () => {
  const works: EventView = { kind: 'roadworks', phase: 'pending', street: 'Boylston Street', startDay: 5, endDay: 7, daysLeft: 3, path: [], at: [-71.08, 42.35] };

  it('changes with the kind, whose name the label carries', () => {
    expect(eventLayerKey({ ...works, kind: 'festival' })).not.toBe(eventLayerKey(works));
  });

  it('changes with the place, where every game’s first events share a seed', () => {
    expect(eventLayerKey({ ...works, at: [-71.07, 42.35] })).not.toBe(eventLayerKey(works));
    const stretch: EventView = { ...works, path: [[[-71.08, 42.35], [-71.075, 42.351]]] };
    expect(eventLayerKey({ ...stretch, path: [[[-71.09, 42.349], [-71.085, 42.35]]] })).not.toBe(eventLayerKey(stretch));
  });

  it('stays while the event stays, and is empty with none', () => {
    expect(eventLayerKey({ ...works })).toBe(eventLayerKey(works));
    expect(eventLayerKey({ ...works, phase: 'on' })).not.toBe(eventLayerKey(works));
    expect(eventLayerKey(null)).toBe('');
  });
});
