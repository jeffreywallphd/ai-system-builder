import type { CanonicalDataShape } from "../CanonicalDataShapes";
import type { ImageRecord } from "../contracts/ImageRecord";

export const MediaValidationIssueSeverities = Object.freeze({
  warning: "warning",
  error: "error",
} as const);

export type MediaValidationIssueSeverity =
  typeof MediaValidationIssueSeverities[keyof typeof MediaValidationIssueSeverities];

export interface MediaValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly severity: MediaValidationIssueSeverity;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface MediaValidationDiagnostics {
  readonly errorCount: number;
  readonly warningCount: number;
  readonly issueCodes: ReadonlyArray<string>;
}

export interface MediaValidationResult<TValue> {
  readonly valid: boolean;
  readonly value?: TValue;
  readonly issues: ReadonlyArray<MediaValidationIssue>;
  readonly diagnostics: MediaValidationDiagnostics;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function createMediaValidationIssue(input: {
  readonly code: string;
  readonly message: string;
  readonly severity?: MediaValidationIssueSeverity;
  readonly path?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}): MediaValidationIssue {
  const code = input.code.trim();
  const message = input.message.trim();
  if (!code) {
    throw new Error("MediaValidationIssue.code cannot be empty.");
  }
  if (!message) {
    throw new Error("MediaValidationIssue.message cannot be empty.");
  }

  return Object.freeze({
    code,
    message,
    severity: input.severity ?? MediaValidationIssueSeverities.error,
    path: normalizeOptional(input.path),
    details: input.details ? Object.freeze({ ...input.details }) : undefined,
  });
}

export function createMediaValidationResult<TValue>(
  issues: ReadonlyArray<MediaValidationIssue>,
  value?: TValue,
): MediaValidationResult<TValue> {
  const errorCount = issues.filter((issue) => issue.severity === MediaValidationIssueSeverities.error).length;
  const warningCount = issues.filter((issue) => issue.severity === MediaValidationIssueSeverities.warning).length;
  return Object.freeze({
    valid: errorCount === 0,
    value,
    issues: Object.freeze([...issues]),
    diagnostics: Object.freeze({
      errorCount,
      warningCount,
      issueCodes: Object.freeze(issues.map((issue) => issue.code)),
    }),
  });
}

export interface IMediaRecordValidator {
  validateRecord(input: unknown, path?: string): MediaValidationResult<ImageRecord>;
  validateRecords(input: unknown, path?: string): MediaValidationResult<ReadonlyArray<ImageRecord>>;
}

export interface IMediaDatasetValidator {
  validateShape(shape: CanonicalDataShape): MediaValidationResult<ReadonlyArray<ImageRecord>>;
}
