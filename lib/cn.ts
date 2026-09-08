/**
 * Minimal class-name joiner.
 *
 * Deliberately not `clsx` + `tailwind-merge` — this project has no runtime
 * dependencies beyond React, and the primitives below are written so that
 * caller classes always come last in the string (later utilities win in
 * Tailwind v4's generated order for same-property conflicts within a layer).
 */
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
