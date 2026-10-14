/**
 * Questions put to the worker in turn, of which only the newest one's answer counts: an older answer
 * arriving late is dropped, and so is any answer once the question is withdrawn. Without the
 * withdrawal, the pointer leaving a dot left its question in flight, and the late answer brought the
 * card back with nothing under the pointer (D25's probe).
 */
export class LatestAsk<T> {
  private next = 1;
  private id = 0;
  private what: T | null = null;

  /** Asks about `what`, under a new id that replaces any question still open. */
  ask(what: T): number {
    this.id = this.next++;
    this.what = what;
    return this.id;
  }

  /** Withdraws the open question: no answer counts until the next. */
  withdraw(): void {
    this.id = 0;
    this.what = null;
  }

  /** What answer `id` answers, if it is the newest question's; else null. */
  answer(id: number): T | null {
    return id !== 0 && id === this.id ? this.what : null;
  }
}
