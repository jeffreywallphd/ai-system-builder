import type { CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";

export const TypeNormalizationTargetTypes = Object.freeze({
  string: "string",
  number: "number",
  boolean: "boolean",
  date: "date",
} as const);

export type TypeNormalizationTargetType =
  typeof TypeNormalizationTargetTypes[keyof typeof TypeNormalizationTargetTypes];

export const TypeNormalizationFailureStrategies = Object.freeze({
  preserve: "preserve",
  setNull: "set-null",
} as const);

export type TypeNormalizationFailureStrategy =
  typeof TypeNormalizationFailureStrategies[keyof typeof TypeNormalizationFailureStrategies];

const TrueBooleanTokens = new Set(["true", "1", "yes", "y"]);
const FalseBooleanTokens = new Set(["false", "0", "no", "n"]);

const IsoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const IsoDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
const NumericStringPattern = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/i;

export interface CoerceValueInput {
  readonly value: CanonicalRecordValue | undefined;
  readonly targetType: TypeNormalizationTargetType;
  readonly trimStrings: boolean;
  readonly emptyStringAsNull: boolean;
  readonly onFailure: TypeNormalizationFailureStrategy;
}

export interface CoerceValueResult {
  readonly value: CanonicalRecordValue | undefined;
  readonly status: "skipped" | "unchanged" | "converted" | "failed";
  readonly reason?: string;
}

function normalizeString(
  value: string,
  trimStrings: boolean,
  emptyStringAsNull: boolean,
): string | null {
  const normalized = trimStrings ? value.trim() : value;
  if (emptyStringAsNull && normalized.length === 0) {
    return null;
  }
  return normalized;
}

function parseNumber(value: CanonicalRecordValue): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const candidate = value.trim();
  if (!candidate || !NumericStringPattern.test(candidate)) {
    return undefined;
  }

  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: CanonicalRecordValue): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const candidate = value.trim().toLowerCase();
  if (TrueBooleanTokens.has(candidate)) {
    return true;
  }
  if (FalseBooleanTokens.has(candidate)) {
    return false;
  }
  return undefined;
}

function parseDate(value: CanonicalRecordValue): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const candidate = value.trim();
  if (!candidate) {
    return undefined;
  }

  if (IsoDatePattern.test(candidate)) {
    const parsed = new Date(`${candidate}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }

  if (!IsoDateTimePattern.test(candidate)) {
    return undefined;
  }

  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function coerceToString(value: CanonicalRecordValue): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function handleFailure(
  onFailure: TypeNormalizationFailureStrategy,
  original: CanonicalRecordValue | undefined,
  reason: string,
): CoerceValueResult {
  if (onFailure === TypeNormalizationFailureStrategies.setNull) {
    return Object.freeze({
      value: original === undefined ? undefined : null,
      status: "failed",
      reason,
    });
  }

  return Object.freeze({
    value: original,
    status: "failed",
    reason,
  });
}

export function coerceValueToType(input: CoerceValueInput): CoerceValueResult {
  const originalValue = input.value;
  if (originalValue === undefined || originalValue === null) {
    return Object.freeze({ value: originalValue, status: "skipped" });
  }

  if (typeof originalValue === "string") {
    const normalizedString = normalizeString(originalValue, input.trimStrings, input.emptyStringAsNull);
    if (normalizedString === null) {
      return Object.freeze({
        value: null,
        status: "converted",
      });
    }

    if (normalizedString !== originalValue && input.targetType === TypeNormalizationTargetTypes.string) {
      return Object.freeze({
        value: normalizedString,
        status: "converted",
      });
    }

    if (normalizedString !== originalValue) {
      return coerceValueToType({
        ...input,
        value: normalizedString,
        trimStrings: false,
      });
    }
  }

  if (input.targetType === TypeNormalizationTargetTypes.number) {
    const parsed = parseNumber(originalValue);
    if (parsed === undefined) {
      return handleFailure(input.onFailure, originalValue, "value is not a supported numeric representation");
    }
    return Object.freeze({
      value: parsed,
      status: parsed === originalValue ? "unchanged" : "converted",
    });
  }

  if (input.targetType === TypeNormalizationTargetTypes.boolean) {
    const parsed = parseBoolean(originalValue);
    if (parsed === undefined) {
      return handleFailure(input.onFailure, originalValue, "value is not a supported boolean token");
    }
    return Object.freeze({
      value: parsed,
      status: parsed === originalValue ? "unchanged" : "converted",
    });
  }

  if (input.targetType === TypeNormalizationTargetTypes.date) {
    const parsed = parseDate(originalValue);
    if (!parsed) {
      return handleFailure(input.onFailure, originalValue, "value is not a supported ISO date/date-time format");
    }
    return Object.freeze({
      value: parsed,
      status: parsed === originalValue ? "unchanged" : "converted",
    });
  }

  const parsed = coerceToString(originalValue);
  if (parsed === undefined) {
    return handleFailure(input.onFailure, originalValue, "value is not supported for string coercion");
  }

  const normalized = input.trimStrings && typeof parsed === "string" ? parsed.trim() : parsed;
  if (input.emptyStringAsNull && normalized.length === 0) {
    return Object.freeze({
      value: null,
      status: "converted",
    });
  }

  return Object.freeze({
    value: normalized,
    status: normalized === originalValue ? "unchanged" : "converted",
  });
}

