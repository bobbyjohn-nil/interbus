// The checklist chip (the M2 spec, item 7; PLAN §3's first ten minutes): the next thing to do, of
// five. The fifth, taking a HEADWAY contract, ends it (the M3 spec, item 12).
export const CHECKLIST = ['Place a depot', 'Draw a line', 'Press play', 'Close a day in profit', 'Take a contract'] as const;

export interface ChecklistState {
  readonly depots: number;
  readonly lines: number;
  /** Game seconds since founding: time has run once it is above 0. */
  readonly elapsed: number;
  readonly profitableDays: number;
  /** A contract has been taken, held now or paid. */
  readonly contractTaken: boolean;
}

/** The first step not yet done (0-based), or CHECKLIST.length when every step is. */
export function checklistStep(s: ChecklistState): number {
  const done = [s.depots > 0, s.lines > 0, s.elapsed > 0, s.profitableDays > 0, s.contractTaken];
  const next = done.indexOf(false);
  return next < 0 ? CHECKLIST.length : next;
}

/** "1/5 Place a depot", or null once every step is done. */
export function checklistText(s: ChecklistState): string | null {
  const step = checklistStep(s);
  return step < CHECKLIST.length ? `${step + 1}/${CHECKLIST.length} ${CHECKLIST[step]}` : null;
}
