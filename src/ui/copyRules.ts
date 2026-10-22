// The copy convention (D25: "Capitalization is important, make sure everything has proper grammar"):
// every heading, button, label, option, column, caption, tooltip and accessible name starts with a
// capital, a digit or a sign ($ ≈ + − © ·); no word shouts in capitals but 2D and 3D; apostrophes are
// curly; and no space sits before a comma or full stop or beside another space. Text that runs on
// after a colon or a middot stays lower case unless it is a name (Day 4, Line 2, a bus, a landmark).

/** Words in capitals that are names, not shouting: the credits' sources (credits.ts) among them. */
const CAPS_ALLOWED = new Set(['2D', '3D', 'OSM', 'ODbL', 'Q1', 'Q2', 'Q3', 'Q4', 'TIGER', 'LEHD', 'LODES', 'USGS', 'SIL']);

/** Why `text` breaks the convention, or null when it keeps it. */
export function copyProblem(text: string): string | null {
  const t = text.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (!/^[A-Z0-9$≈+\-−©·(“‘"…✓×↑↓]/u.test(t)) return 'starts in lower case';
  const shouting = t.match(/\b[A-Z]{2,}\b/g)?.filter((w) => !CAPS_ALLOWED.has(w));
  if (shouting?.length) return `in capitals: ${shouting.join(', ')}`;
  if (/[A-Za-z]'[A-Za-z]/.test(t)) return 'a straight apostrophe';
  if (/ [,.;:]/.test(t)) return 'a space before punctuation';
  return null;
}

/** Every problem in `texts`, as "problem: text", each text once. */
export function copyProblems(texts: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const text of texts) {
    const problem = copyProblem(text);
    if (problem) out.add(`${problem}: ${text.replace(/\s+/g, ' ').trim()}`);
  }
  return [...out];
}
