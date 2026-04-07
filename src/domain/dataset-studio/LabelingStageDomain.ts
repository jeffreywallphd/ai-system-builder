import { z } from "zod";
import type { CanonicalDataShapeKind, CanonicalRecordValue } from "./CanonicalDataShapes";
import { CanonicalDataShapeKinds } from "./CanonicalDataShapes";

export const AnnotationModeKinds = Object.freeze({
  manual: "manual",
  assisted: "assisted",
  automaticPlaceholder: "automatic-placeholder",
} as const);

export type AnnotationMode =
  typeof AnnotationModeKinds[keyof typeof AnnotationModeKinds];

export const AnnotationTargetKinds = Object.freeze({
  record: "record",
  textItem: "text-item",
  imageRecord: "image-record",
  chunk: "chunk",
} as const);

export type AnnotationTarget =
  typeof AnnotationTargetKinds[keyof typeof AnnotationTargetKinds];

export const AnnotationStatusKinds = Object.freeze({
  resolved: "resolved",
  unresolved: "unresolved",
  manualNeeded: "manual-needed",
} as const);

export type AnnotationStatus =
  typeof AnnotationStatusKinds[keyof typeof AnnotationStatusKinds];

export const AnnotationAttachmentModeKinds = Object.freeze({
  embedded: "embedded",
  associated: "associated",
} as const);

export type AnnotationAttachmentMode =
  typeof AnnotationAttachmentModeKinds[keyof typeof AnnotationAttachmentModeKinds];

export interface AnnotationRecord {
  readonly annotationId: string;
  readonly target: AnnotationTarget;
  readonly targetRef: string;
  readonly label?: string;
  readonly labels?: ReadonlyArray<string>;
  readonly freeText?: string;
  readonly confidence?: number;
  readonly source: string;
  readonly provenance?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly status: AnnotationStatus;
}

export interface LabelingStageConfig {
  readonly mode: AnnotationMode;
  readonly target: AnnotationTarget;
  readonly attachmentMode: AnnotationAttachmentMode;
  readonly allowMultiLabel: boolean;
  readonly allowFreeText: boolean;
  readonly confidenceEnabled: boolean;
  readonly allowedLabels?: ReadonlyArray<string>;
  readonly sourceLabel: string;
  readonly emitManualNeeded: boolean;
  readonly emitStatusField: boolean;
  readonly records: ReadonlyArray<AnnotationRecord>;
  readonly assistedSeedFromClassification: boolean;
  readonly assistanceProvider: "internal-placeholder" | "data-classification";
}

const NonEmptyStringSchema = z.string().trim().min(1);

const AnnotationRecordSchema = z.object({
  annotationId: NonEmptyStringSchema,
  target: z.nativeEnum(AnnotationTargetKinds),
  targetRef: NonEmptyStringSchema,
  label: NonEmptyStringSchema.optional(),
  labels: z.array(NonEmptyStringSchema).optional(),
  freeText: NonEmptyStringSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: NonEmptyStringSchema.default("manual"),
  provenance: z.record(z.any()).optional(),
  status: z.nativeEnum(AnnotationStatusKinds).default(AnnotationStatusKinds.unresolved),
}).superRefine((value, ctx) => {
  const labelCount = (value.label ? 1 : 0) + (value.labels?.length ?? 0);
  if (labelCount === 0 && !value.freeText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["label"],
      message: "Annotation record must include label, labels, or free-text content.",
    });
  }
});

export const LabelingStageConfigSchema = z.object({
  mode: z.nativeEnum(AnnotationModeKinds).default(AnnotationModeKinds.manual),
  target: z.nativeEnum(AnnotationTargetKinds).default(AnnotationTargetKinds.record),
  attachmentMode: z.nativeEnum(AnnotationAttachmentModeKinds).default(AnnotationAttachmentModeKinds.embedded),
  allowMultiLabel: z.boolean().default(false),
  allowFreeText: z.boolean().default(false),
  confidenceEnabled: z.boolean().default(true),
  allowedLabels: z.array(NonEmptyStringSchema).optional(),
  sourceLabel: NonEmptyStringSchema.default("manual"),
  emitManualNeeded: z.boolean().default(true),
  emitStatusField: z.boolean().default(true),
  records: z.array(AnnotationRecordSchema).default([]),
  assistedSeedFromClassification: z.boolean().default(false),
  assistanceProvider: z.enum(["internal-placeholder", "data-classification"]).default("internal-placeholder"),
}).superRefine((value, ctx) => {
  if (!value.allowMultiLabel && value.records.some((record) => (record.labels?.length ?? 0) > 1)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["records"],
      message: "Multi-label annotations require allowMultiLabel=true.",
    });
  }
  if (!value.allowFreeText && value.records.some((record) => Boolean(record.freeText))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["records"],
      message: "Free-text annotations require allowFreeText=true.",
    });
  }
  if (!value.confidenceEnabled && value.records.some((record) => record.confidence !== undefined)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["records"],
      message: "Confidence values are not allowed when confidenceEnabled=false.",
    });
  }
  if (value.mode === AnnotationModeKinds.assisted && value.assistanceProvider === "internal-placeholder" && !value.emitManualNeeded) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["emitManualNeeded"],
      message: "Assisted placeholder mode must emit manual-needed states.",
    });
  }
});

function normalizeStringArray(value: CanonicalRecordValue | undefined): ReadonlyArray<string> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function inferTargetFromInputShape(inputShape?: CanonicalDataShapeKind): AnnotationTarget | undefined {
  switch (inputShape) {
    case CanonicalDataShapeKinds.textItems:
      return AnnotationTargetKinds.chunk;
    case CanonicalDataShapeKinds.imageMetadataRecords:
      return AnnotationTargetKinds.imageRecord;
    case CanonicalDataShapeKinds.records:
    case CanonicalDataShapeKinds.table:
      return AnnotationTargetKinds.record;
    default:
      return undefined;
  }
}

function normalizeAttachmentMode(
  value: CanonicalRecordValue | undefined,
  inputShape?: CanonicalDataShapeKind,
): AnnotationAttachmentMode | undefined {
  if (value === AnnotationAttachmentModeKinds.embedded || value === AnnotationAttachmentModeKinds.associated) {
    return value;
  }
  if (inputShape === CanonicalDataShapeKinds.textItems) {
    return AnnotationAttachmentModeKinds.associated;
  }
  return undefined;
}

export function createLabelingStageConfig(input?: Partial<LabelingStageConfig>): LabelingStageConfig {
  const parsed = LabelingStageConfigSchema.parse(input ?? {});
  return Object.freeze(parsed);
}

export function parseLabelingStageConfigFromStageOptions(
  options: Readonly<Record<string, CanonicalRecordValue>>,
  inputShape?: CanonicalDataShapeKind,
): LabelingStageConfig {
  return createLabelingStageConfig({
    mode: typeof options.labelingMode === "string"
      ? options.labelingMode as AnnotationMode
      : undefined,
    target: typeof options.annotationTarget === "string"
      ? options.annotationTarget as AnnotationTarget
      : inferTargetFromInputShape(inputShape),
    attachmentMode: normalizeAttachmentMode(options.annotationAttachmentMode, inputShape),
    allowMultiLabel: typeof options.annotationAllowMultiLabel === "boolean"
      ? options.annotationAllowMultiLabel
      : undefined,
    allowFreeText: typeof options.annotationAllowFreeText === "boolean"
      ? options.annotationAllowFreeText
      : undefined,
    confidenceEnabled: typeof options.annotationConfidenceEnabled === "boolean"
      ? options.annotationConfidenceEnabled
      : undefined,
    allowedLabels: normalizeStringArray(options.annotationAllowedLabels),
    sourceLabel: typeof options.annotationSourceLabel === "string"
      ? options.annotationSourceLabel
      : undefined,
    emitManualNeeded: typeof options.annotationEmitManualNeeded === "boolean"
      ? options.annotationEmitManualNeeded
      : undefined,
    emitStatusField: typeof options.annotationEmitStatusField === "boolean"
      ? options.annotationEmitStatusField
      : undefined,
    records: Array.isArray(options.annotationRecords)
      ? options.annotationRecords as ReadonlyArray<AnnotationRecord>
      : undefined,
    assistedSeedFromClassification: typeof options.annotationAssistedSeedFromClassification === "boolean"
      ? options.annotationAssistedSeedFromClassification
      : undefined,
    assistanceProvider: typeof options.annotationAssistanceProvider === "string"
      ? options.annotationAssistanceProvider as "internal-placeholder" | "data-classification"
      : undefined,
  });
}

export function toLabelingStageOptions(
  config: LabelingStageConfig,
): Readonly<Record<string, CanonicalRecordValue>> {
  const options: Record<string, CanonicalRecordValue | undefined> = {
    labelingMode: config.mode,
    annotationTarget: config.target,
    annotationAttachmentMode: config.attachmentMode,
    annotationAllowMultiLabel: config.allowMultiLabel,
    annotationAllowFreeText: config.allowFreeText,
    annotationConfidenceEnabled: config.confidenceEnabled,
    annotationAllowedLabels: config.allowedLabels as unknown as CanonicalRecordValue,
    annotationSourceLabel: config.sourceLabel,
    annotationEmitManualNeeded: config.emitManualNeeded,
    annotationEmitStatusField: config.emitStatusField,
    annotationRecords: config.records as unknown as CanonicalRecordValue,
    annotationAssistedSeedFromClassification: config.assistedSeedFromClassification,
    annotationAssistanceProvider: config.assistanceProvider,
  };

  return Object.freeze(
    Object.fromEntries(
      Object.entries(options).filter((entry): entry is [string, CanonicalRecordValue] => entry[1] !== undefined),
    ),
  );
}

