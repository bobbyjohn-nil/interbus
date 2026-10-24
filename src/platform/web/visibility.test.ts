import { describe, expect, it } from 'vitest';
import { watchHidden } from './visibility';

/** A document whose visibility a test sets, with its listeners. */
function page(state: DocumentVisibilityState) {
  const heard = new Set<() => void>();
  const doc = {
    visibilityState: state,
    addEventListener: (type: string, fn: () => void) => void (type === 'visibilitychange' && heard.add(fn)),
    removeEventListener: (type: string, fn: () => void) => void (type === 'visibilitychange' && heard.delete(fn)),
  };
  const set = (next: DocumentVisibilityState) => {
    doc.visibilityState = next;
    for (const fn of heard) fn();
  };
  return { doc: doc as unknown as Document, set, heard };
}

describe('whether the page is out of sight', () => {
  it('says so at once and at each change, until stopped', () => {
    const { doc, set, heard } = page('visible');
    const told: boolean[] = [];
    const stop = watchHidden((hidden) => told.push(hidden), doc);
    set('hidden');
    set('visible');
    stop();
    set('hidden');
    expect(told).toEqual([false, true, false]);
    expect(heard.size).toBe(0);
  });

  it('starts hidden in a tab opened in the background', () => {
    const told: boolean[] = [];
    watchHidden((hidden) => told.push(hidden), page('hidden').doc);
    expect(told).toEqual([true]);
  });
});
