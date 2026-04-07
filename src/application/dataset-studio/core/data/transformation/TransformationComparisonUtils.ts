import type { CanonicalRecordValue } from "../../../../../domain/dataset-studio/CanonicalDataShapes";

export interface ValueNormalizationOptions {
  readonly caseSensitive: boolean;
  readonly trimStrings: boolean;
  readonly treatMissingAsNull: boolean;
}

export const DefaultValueNormalizationOptions: ValueNormalizationOptions = Object.freeze({
  caseSensitive: false,
  trimStrings: true,
  treatMissingAsNull: true,
});

function normalizeString(value: string, options: ValueNormalizationOptions): string {
  const trimmed = options.trimStrings ? value.trim() : value;
  return options.caseSensitive ? trimmed : trimmed.toLocaleLowerCase();
}

export function normalizeComparableValue(
  value: CanonicalRecordValue | undefined,
  options: ValueNormalizationOptions = DefaultValueNormalizationOptions,
): CanonicalRecordValue | undefined {
  if (value === undefined) {
    return options.treatMissingAsNull ? null : undefined;
  }
  if (value === null) {
    return null;
  }
  if (typeof value === "string") {
    return normalizeString(value, options);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((entry) => normalizeComparableValue(entry, options) ?? null));
  }

  const normalized: Record<string, CanonicalRecordValue> = {};
  for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
    const normalizedValue = normalizeComparableValue(value[key], options);
    if (normalizedValue !== undefined) {
      normalized[key] = normalizedValue;
    }
  }
  return Object.freeze(normalized);
}

export function toStableComparableKey(value: CanonicalRecordValue | undefined): string {
  return JSON.stringify(value ?? null);
}

export function projectComparableFields(
  record: Readonly<Record<string, CanonicalRecordValue>>,
  fieldNames: ReadonlyArray<string>,
  options: ValueNormalizationOptions = DefaultValueNormalizationOptions,
): Readonly<Record<string, CanonicalRecordValue | undefined>> {
  const projected: Record<string, CanonicalRecordValue | undefined> = {};
  for (const fieldName of fieldNames) {
    projected[fieldName] = normalizeComparableValue(record[fieldName], options);
  }
  return Object.freeze(projected);
}

export function toComparableString(
  value: CanonicalRecordValue | undefined,
  options: ValueNormalizationOptions = DefaultValueNormalizationOptions,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return normalizeString(value, options);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return undefined;
}
