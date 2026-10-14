// The route editor (D25: "an expanded menu there you can reorder, add, and remove stops something akin
// to google maps trip planner"): the line's stops as a list, each named for the stop it is or "New
// stop", moved up and down, and a card that prices what the route adds and what comes down. Shown
// failing (TS-04) on a list that named every click by its index and a total that left out the refund.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { LineDraftView, LineView } from '../../sim/types';
import { followed, moved, pressSave, RouteEditor, routeOf, type RoutePoint, type Routing } from './RouteEditor';
import type { Sim } from './useSim';

const line = { id: 1, name: 'Line 1', colour: '#c0392b', model: 'sparrow', stopIds: [1, 2, 3], stops: [[-71.077, 42.35], [-71.086, 42.342], [-71.095, 42.338]], stopDistM: [0, 1_100, 2_000] } as unknown as LineView;

function render(points: RoutePoint[], draft: Partial<LineDraftView> | null, saving = false): string {
  const full = draft && ({ stops: [], route: [], routeM: 3_900, people: 46_000, walkM: 400, buses: 0, newStops: 0, stopsCents: 0, busesCents: 0, priceCents: 0, refusal: null, edit: null, detour: null, ...draft } as LineDraftView);
  const sim = { draft: full } as unknown as Sim;
  return renderToStaticMarkup(createElement(RouteEditor, { sim, line, points, saving, onPoints: () => undefined, onSave: () => undefined, onCancel: () => undefined }));
}

describe('the route editor', () => {
  it('starts from the line’s stops, in order, and moves one at a time', () => {
    const points = routeOf(line);
    expect(points.map((p) => p.stopId)).toEqual([1, 2, 3]);
    expect(moved(points, 2, 0).map((p) => p.stopId)).toEqual([3, 1, 2]);
    expect(moved(points, 0, 1).map((p) => p.stopId)).toEqual([2, 1, 3]);
  });

  it('follows the line as a stop’s card or an undo changes it under the editor, keeping what the player changed', () => {
    // Shown failing (TS-04) with d6e81e6's editor restored here (the list kept as opened): the second
    // expect read [1, 2, 3], Stop 2 still listed after it came off the line.
    const calling = (stopIds: number[]) => ({ ...line, stopIds, stops: stopIds.map((id) => line.stops[id - 1]!) }) as LineView;
    const off = calling([1, 3]);
    const standing = { linesVersion: 2, stops: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 9 }] }; // Stop 2 on another line too
    const opened: Routing = { lineId: 1, points: routeOf(line), base: line.stopIds, saved: null };
    expect(followed(opened, line, standing, 0)).toBe(opened); // nothing changed: the same editor
    // As opened, the list is the line as it now stands: Stop 2 taken off, then put back by an undo.
    const taken = followed(opened, off, standing, 0);
    expect(taken.points.map((p) => p.stopId)).toEqual([1, 3]);
    expect(followed(taken, line, standing, 0).points.map((p) => p.stopId)).toEqual([1, 2, 3]);
    // Undo of a saved reorder, the editor open on it: the line's order again.
    const reordered = calling([1, 3, 2]);
    expect(followed({ ...opened, points: routeOf(reordered), base: reordered.stopIds }, line, standing, 0).points.map((p) => p.stopId)).toEqual([1, 2, 3]);
    // As edited (a new stop at the end, and Stop 9 of another line before it), the player's changes stay:
    // Stop 2 leaves the list as it comes off the line, though it stands for its other line, and comes
    // back after Stop 1 with the undo; Stop 9 goes once it is taken down.
    const edited: Routing = { ...opened, points: [...routeOf(line), { at: [-71.1, 42.337], stopId: 9 }, { at: [-71.1, 42.336], stopId: null }] };
    const editedOff = followed(edited, off, standing, 0);
    expect(editedOff.points.map((p) => p.stopId)).toEqual([1, 3, 9, null]);
    expect(editedOff.base).toEqual([1, 3]);
    expect(followed(editedOff, line, standing, 0).points.map((p) => p.stopId)).toEqual([1, 2, 3, 9, null]);
    expect(followed(edited, line, { stops: [{ id: 1 }, { id: 2 }, { id: 3 }] }, 0).points.map((p) => p.stopId)).toEqual([1, 2, 3, null]);
  });

  it('sends one Save route a press, none while one is on its way, and again once the sim refused it', () => {
    // Shown failing (TS-04) with d6e81e6's press restored here (every press sent): the second expect,
    // the second press, read an editor with a second save on its way, not null.
    const opened: Routing = { lineId: 1, points: [...routeOf(line), { at: [-71.1, 42.336], stopId: null }], base: line.stopIds, saved: null };
    const pressed = pressSave(opened, line, 0)!;
    expect(pressed.saved).toEqual({ stops: '1,2,3', refusals: 0 });
    expect(pressSave(pressed, line, 0)).toBeNull();
    const game = { stops: [{ id: 1 }, { id: 2 }, { id: 3 }] };
    expect(followed(pressed, line, game, 0)).toBe(pressed); // on its way: no answer yet
    // Refused (say, short of cash): Save route can be pressed again, and that press sends a second set-route.
    const refused = followed(pressed, line, game, 1);
    expect(refused.saved).toBeNull();
    expect(refused.points).toBe(opened.points);
    expect(pressSave(refused, line, 1)).not.toBeNull();
    // A refresh of the lines that is not its answer (the day's close retimes them while time runs) leaves
    // it on its way: only its landing or its refusal ends it, so a double-click's guard holds.
    expect(followed(pressed, line, { stops: [...game.stops, { id: 4 }] }, 0)).toBe(pressed);
    // While it is on its way, the button says a press does nothing.
    expect(render(opened.points, { refusal: null }, true)).toMatch(/<button type="button" disabled="">Save route<\/button>/);
    expect(render(opened.points, { refusal: null })).toMatch(/<button type="button">Save route<\/button>/);
  });

  it('names each stop for the stop it is, a click that joins one for that stop, and the rest New stop', () => {
    const points: RoutePoint[] = [...routeOf(line), { at: [-71.1, 42.336], stopId: null }, { at: [-71.105, 42.335], stopId: null }];
    const html = render(points, { stops: [{ at: line.stops[0]!, joins: 1 }, { at: line.stops[1]!, joins: 2 }, { at: line.stops[2]!, joins: 3 }, { at: [-71.1, 42.336], joins: 7 }, { at: [-71.105, 42.335], joins: null }] });
    expect(html.match(/<span class="name">([^<]+)<\/span>/g)!.map((s) => s.replace(/<[^>]+>/g, ''))).toEqual(['Stop 1', 'Stop 2', 'Stop 3', 'Stop 7', 'New stop']);
    // The first can't move up, nor the last down.
    expect(html).toContain('aria-label="Move Stop 1 up" disabled=""');
    expect(html).toContain('aria-label="Move New stop down" disabled=""');
    expect(html).toContain('aria-label="Remove Stop 2"');
  });

  it('prices what the route adds less what comes down, and says nothing changed while nothing has', () => {
    const html = render(routeOf(line).slice(0, 2), { stops: [{ at: line.stops[0]!, joins: 1 }, { at: line.stops[1]!, joins: 2 }], priceCents: 0, edit: { removed: [3], refundCents: 200_000 } });
    expect(html).toContain('Stop 3 comes down · $2k back');
    expect(html).toContain('Total $2k back');
    expect(html).toContain('data-refund="200000"');
    const added = render(routeOf(line), { newStops: 1, stopsCents: 400_000, buses: 1, busesCents: 9_500_000, priceCents: 9_900_000, edit: { removed: [2], refundCents: 200_000 } });
    expect(added).toContain('1 new stop · $4k');
    expect(added).toContain('1 more Sparrow for its longer round trip · $95k');
    expect(added).toContain('Total $97k');
    expect(added).toContain('· 3.9 km (+1.9 km) ·'); // the change in length, where Insert warned of a detour
    const same = render(routeOf(line), { refusal: { reason: 'no_change' } });
    expect(same).not.toContain('Total');
    expect(same).not.toContain('class="refusal"');
    expect(same).toMatch(/<button type="button" disabled="">Save route<\/button>/);
  });
});
