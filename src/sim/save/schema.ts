// The save's one schema, as data: the TypeScript type, the reader's checks and the schema hash all
// come from this descriptor, so they cannot drift apart. V3 had types only, which erase at runtime,
// so it could neither check a file field by field nor notice an unversioned change (K11, SC-10).
import { ROW_KINDS } from '../economy/ledger';
import { hashString } from '../core/rng';

export type Field =
  | 'int'
  | 'uint32'
  | 'number'
  | 'string'
  | { readonly nullable: Field }
  | { readonly array: Field }
  | { readonly object: { readonly [key: string]: Field } }
  | { readonly oneOf: readonly string[] };

/** The type a descriptor describes. */
export type Infer<F> = F extends 'int' | 'uint32' | 'number'
  ? number
  : F extends 'string'
    ? string
    : F extends { readonly nullable: infer X }
      ? Infer<X> | null
      : F extends { readonly array: infer X }
        ? readonly Infer<X>[]
        : F extends { readonly object: infer O }
          ? { readonly [K in keyof O]: Infer<O[K]> }
          : F extends { readonly oneOf: readonly (infer S)[] }
            ? S
            : never;

/**
 * Intent only (PLAN §6, K12): no demand, geometry, camera or theme. Stops are anchored by place.
 * Contracts, medals and buses join as their systems land, each with a format bump; depots joined in format 3.
 */
export const SAVE_SCHEMA = {
  object: {
    city: { object: { id: 'string', revision: 'string', hash: 'string' } },
    clock: { object: { elapsed: 'int' } },
    rng: { object: { state: 'uint32' } },
    company: { object: { name: 'string', colour: 'string' } },
    nextIds: { object: { stop: 'int', line: 'int', bus: 'int', depot: 'int', contract: 'int' } },
    depots: { array: { object: { id: 'int', lon: 'number', lat: 'number' } } },
    stops: { array: { object: { id: 'int', lon: 'number', lat: 'number' } } },
    lines: {
      array: {
        object: {
          id: 'int',
          name: 'string',
          colour: 'string',
          stopIds: { array: 'int' },
          fareCents: 'int',
          headways: { object: { peak: 'int', offpeak: 'int', overnight: { nullable: 'int' } } },
          boardedMilli: 'int',
        },
      },
    },
    ledger: {
      array: { object: { day: 'int', kind: { oneOf: ROW_KINDS }, amountCents: 'int', lineId: { nullable: 'int' } } },
    },
  },
} as const satisfies Field;

export type SaveData = Infer<typeof SAVE_SCHEMA>;

/** The first problem with `value` against `field`, or null. Missing, null and mistyped all refuse. */
export function check(field: Field, value: unknown, path = 'data'): string | null {
  if (field === 'int') return Number.isSafeInteger(value) ? null : `${path}: not a whole number`;
  if (field === 'uint32') {
    return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 0xffffffff ? null : `${path}: not a uint32`;
  }
  if (field === 'number') return typeof value === 'number' && Number.isFinite(value) ? null : `${path}: not a finite number`;
  if (field === 'string') return typeof value === 'string' ? null : `${path}: not a string`;
  if ('nullable' in field) return value === null ? null : check(field.nullable, value, path);
  if ('oneOf' in field) return field.oneOf.includes(value as string) ? null : `${path}: not one of ${field.oneOf.join(', ')}`;
  if ('array' in field) {
    if (!Array.isArray(value)) return `${path}: not a list`;
    for (let i = 0; i < value.length; i++) {
      const problem = check(field.array, value[i], `${path}[${i}]`);
      if (problem) return problem;
    }
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${path}: not an object`;
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(field.object)) {
    if (!(key in record)) return `${path}.${key}: missing`;
    const problem = check(child, record[key], `${path}.${key}`);
    if (problem) return problem;
  }
  for (const key of Object.keys(record)) if (!(key in field.object)) return `${path}.${key}: not in the schema`;
  return null;
}

/** A stable text form of a descriptor: keys in a fixed order. */
function canonical(field: Field): string {
  if (typeof field === 'string') return field;
  if ('nullable' in field) return `?${canonical(field.nullable)}`;
  if ('oneOf' in field) return `(${[...field.oneOf].sort().join('|')})`;
  if ('array' in field) return `[${canonical(field.array)}]`;
  const keys = Object.keys(field.object).sort();
  return `{${keys.map((k) => `${k}:${canonical(field.object[k] as Field)}`).join(',')}}`;
}

/** 64 bits of FNV-1a over the canonical schema: enough to notice any change. */
export function schemaHash(field: Field = SAVE_SCHEMA): string {
  const text = canonical(field);
  const hex = (n: number) => n.toString(16).padStart(8, '0');
  return hex(hashString(`a${text}`)) + hex(hashString(`b${text}`));
}
