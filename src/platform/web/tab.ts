// What happens once a tab, kept in the tab's session storage, which only the platform touches (CLAUDE.md), so a reload in the
// same tab knows it happened. With no storage every time is the first: what it guards is only an animation. A browser that
// blocks the site's data throws from the storage itself as it is read, so it is read inside the try, as prefs.ts reads
// localStorage: read outside it, the throw unmounted the game, which never started (the review of #161).

type TabStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function firstInTab(what: string, storage?: TabStorage | null): boolean {
  const key = `interbus.tab.${what}`;
  try {
    const tab = storage === undefined ? globalThis.sessionStorage : storage;
    if (!tab) return true;
    if (tab.getItem(key) === '1') return false;
    tab.setItem(key, '1');
  } catch {
    // Storage blocked or refused (a private window, or site data blocked): the first time again.
  }
  return true;
}
