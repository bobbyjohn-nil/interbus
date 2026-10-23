// What happens once a tab, kept in the tab's session storage, which only the platform touches (CLAUDE.md), so a reload in the
// same tab knows it happened. With no storage every time is the first: what it guards is only an animation.

export function firstInTab(what: string, storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = globalThis.sessionStorage): boolean {
  const key = `interbus.tab.${what}`;
  try {
    if (!storage) return true;
    if (storage.getItem(key) === '1') return false;
    storage.setItem(key, '1');
  } catch {
    // Storage refused (a private window, or none): the first time again.
  }
  return true;
}
