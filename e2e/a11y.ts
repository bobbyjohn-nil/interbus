// Accessibility, proportionate (PLAN §8; UX-08's final form: no bespoke gate, the checks inside the ordinary e2e scenes): every
// control a player presses is at least 24 px each way, the chrome's text draws at 12 px or more, and axe-core finds nothing.
import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * The controls on screen smaller than 24 px either way (WCAG 2.2's target size, 2.5.8), and the text drawn under 12 px, each as
 * "where: what". A radio or checkbox inside its label is pressed through the label, so the label is measured. The corner's
 * credits are left out, as WCAG leaves links inside a line of text: they are a line of 12 px text.
 */
export function smallThings(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const name = (el: Element) => (el.getAttribute('aria-label') ?? el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
    for (const el of document.querySelectorAll('button, [role="tab"], [role="option"], [role="button"], a[href], input, select, summary')) {
      if (!shown(el) || el.closest('.corner')) continue;
      const label = (el as HTMLInputElement).type === 'radio' || (el as HTMLInputElement).type === 'checkbox' ? el.closest('label') : null;
      const r = (label ?? el).getBoundingClientRect();
      if (r.width < 24 - 0.5 || r.height < 24 - 0.5) out.push(`a ${Math.round(r.width)}×${Math.round(r.height)} px control: ${name(el)}`);
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      const text = n.textContent?.trim();
      if (!text || !el || !shown(el)) continue;
      // Text in an SVG draws at its font size times the drawing's scale.
      const svg = el.closest('svg');
      const px = parseFloat(getComputedStyle(el).fontSize) * (svg ? (svg.getScreenCTM()?.a ?? 1) : 1);
      if (px < 12 - 0.05) out.push(`${px.toFixed(1)} px text: ${text.slice(0, 40)}`);
    }
    // Text a style draws before or after an element, a count or a mark, is no text node, so each is read from its style.
    for (const el of document.body.querySelectorAll('*')) {
      if (!shown(el)) continue;
      for (const at of ['::before', '::after'] as const) {
        const style = getComputedStyle(el, at);
        const drawn = style.content.replace(/^none$|^normal$|^""$/, '');
        if (drawn && style.display !== 'none' && parseFloat(style.fontSize) < 12 - 0.05) out.push(`${parseFloat(style.fontSize).toFixed(1)} px text: ${at} ${drawn.slice(0, 30)} of ${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`);
      }
    }
    return [...new Set(out)];
  });
}

/** What axe-core finds on the page as it stands, one line a rule: its id, impact, count and help. */
export async function axeProblems(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page }).analyze();
  return result.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} × ${v.help}`);
}
