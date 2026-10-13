// Every id the sim hands out, one brand per kind (V3 branded StopId and LineId but defined DepotId
// twice, K54), minted from counters that live in sim state and are saved whole, so no id is ever
// reused: not after a delete, a save or a load (K01, I7). Never mint from a length or a count.

declare const brand: unique symbol;

export const ID_KINDS = ['stop', 'line', 'bus', 'depot', 'contract'] as const;
export type IdKind = (typeof ID_KINDS)[number];
export type Id<K extends IdKind> = number & { readonly [brand]: K };

export type StopId = Id<'stop'>;
export type LineId = Id<'line'>;
export type BusId = Id<'bus'>;
export type DepotId = Id<'depot'>;
export type ContractId = Id<'contract'>;

/** The next id of each kind. Ids start at 1, so no id is ever falsy. */
export type NextIds = { readonly [K in IdKind]: number };

export const FIRST_IDS: NextIds = { stop: 1, line: 1, bus: 1, depot: 1, contract: 1 };

/** A fresh id of `kind` and the counters after it. */
export function mint<K extends IdKind>(next: NextIds, kind: K): [Id<K>, NextIds] {
  const id = next[kind];
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError(`bad ${kind} counter ${id}`);
  return [id as Id<K>, { ...next, [kind]: id + 1 }];
}
