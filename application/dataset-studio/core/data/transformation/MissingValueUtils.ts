import type { CanonicalRecordValue } from "../../../../../domain/dataset-studio/CanonicalDataShapes";

export interface MissingValueDetectionOptions {
  readonly treatEmptyStringAsMissing: boolean;
  readonly treatWhitespaceAsMissing: boolean;
}

export function isMissingValue(
  value: CanonicalRecordValue | undefined,
  options: MissingValueDetectionOptions,
): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  if (options.treatWhitespaceAsMissing && value.trim().length === 0) {
    return true;
  }

  if (options.treatEmptyStringAsMissing && value.length === 0) {
    return true;
  }

  return false;
}
