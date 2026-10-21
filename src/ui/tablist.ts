/**
 * The tab a key moves to along a tablist, WAI-ARIA's tabs: the arrow keys move along the tabs, wrapping, and Home and End go
 * to the first and last; any other key moves nowhere (undefined). The panels' tablists share it (Lines' tabs, Finance's
 * views), each choosing the tab the focus reaches, and keep only the chosen tab in the Tab order, so one Tab goes on past them.
 */
export function tabTo<T>(key: string, tabs: readonly T[], at: T): T | undefined {
  const i = tabs.indexOf(at);
  const to = ({ ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 } as Readonly<Record<string, number>>)[key];
  if (to === undefined || !tabs.length) return undefined;
  return tabs[(to + tabs.length) % tabs.length];
}
