import { diffJson } from "diff";

export interface StructuredDiffPatch {
  readonly kind: "json";
  readonly changes: ReadonlyArray<string>;
  readonly truncated: boolean;
}

function normalizeDiffValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.join("");
  }
  return String(value);
}

export function createStructuredJsonDiffPatch(
  beforeValue: unknown,
  afterValue: unknown,
  options?: Readonly<{ maxChanges?: number; maxChangeLength?: number }>,
): StructuredDiffPatch | undefined {
  const maxChanges = Math.max(1, options?.maxChanges ?? 10);
  const maxChangeLength = Math.max(16, options?.maxChangeLength ?? 240);
  const relevantChanges = diffJson(beforeValue, afterValue)
    .filter((entry) => entry.added || entry.removed)
    .map((entry) => {
      const prefix = entry.added ? "+ " : "- ";
      const value = normalizeDiffValue(entry.value).trim();
      const normalized = value.length > maxChangeLength ? `${value.slice(0, maxChangeLength)}...` : value;
      return `${prefix}${normalized}`;
    })
    .filter((entry) => entry.length > 2);

  if (relevantChanges.length === 0) {
    return undefined;
  }

  return Object.freeze({
    kind: "json",
    changes: Object.freeze(relevantChanges.slice(0, maxChanges)),
    truncated: relevantChanges.length > maxChanges,
  });
}
