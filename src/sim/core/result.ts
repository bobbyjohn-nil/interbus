// One result shape for every command and rule (V3 had a union per module and free-text reasons,
// `Intralines_City@dc63602:src/game/lines/draft.ts:67-69`): a verdict is `ok`, or a refusal with a
// reason code and the numbers behind it. src/ui turns codes into copy (≤8 words, I13); money in a
// refusal is in cents.

export type Ok<T extends object = object> = { readonly ok: true } & T;
export type Refused<R extends string, D extends object = object> = { readonly ok: false; readonly reason: R } & D;
export type Result<T extends object, R extends string, D extends object = object> = Ok<T> | Refused<R, D>;

export function ok(): Ok;
export function ok<T extends object>(value: T): Ok<T>;
export function ok<T extends object>(value?: T): Ok<T> {
  return { ok: true, ...(value as T) };
}

export function refuse<R extends string>(reason: R): Refused<R>;
export function refuse<R extends string, D extends object>(reason: R, detail: D): Refused<R, D>;
export function refuse<R extends string, D extends object>(reason: R, detail?: D): Refused<R, D> {
  return { ok: false, reason, ...(detail as D) };
}
