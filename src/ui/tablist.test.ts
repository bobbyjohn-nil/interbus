// The tablists' keys (tablist.ts), shared by Lines' tabs and Finance's views.
import { describe, expect, it } from 'vitest';
import { tabTo } from './tablist';

describe('a tablist’s keys', () => {
  const views = ['overview', 'breakdown', 'lines'] as const;

  it('move along the tabs with the arrows, wrapping, and to the ends with Home and End', () => {
    expect(tabTo('ArrowRight', views, 'overview')).toBe('breakdown');
    expect(tabTo('ArrowRight', views, 'lines')).toBe('overview');
    expect(tabTo('ArrowLeft', views, 'overview')).toBe('lines');
    expect(tabTo('ArrowLeft', views, 'breakdown')).toBe('overview');
    expect(tabTo('Home', views, 'lines')).toBe('overview');
    expect(tabTo('End', views, 'overview')).toBe('lines');
  });

  it('move nowhere for any other key, or with no tabs', () => {
    for (const key of ['Tab', 'Enter', ' ', 'ArrowDown', 'ArrowUp', 'a']) expect(tabTo(key, views, 'breakdown')).toBeUndefined();
    expect(tabTo('ArrowRight', [], 1)).toBeUndefined();
  });
});
