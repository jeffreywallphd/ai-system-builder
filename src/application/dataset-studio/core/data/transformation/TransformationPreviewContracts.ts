import { z } from "zod";
import { TransformationInputDataSchema } from "./TransformationContracts";

const PipelineFailureModeValues = Object.freeze(["stop-on-error"] as const);

export const TransformationPreviewRowSampleSchema = z.object({
  rowId: z.string().min(1),
  fields: z.record(z.unknown()),
});

export const TransformationPreviewIssueSchema = z.object({
  severity: z.enum(["info", "warning", "error"]),
  code: z.string().min(1),
  message: z.string().min(1),
  path: z.string().min(1).optional(),
});

export const TransformationPreviewChangeSummarySchema = z.object({
  inputRowCount: z.number().int().nonnegative(),
  outputRowCount: z.number().int().nonnegative(),
  sampledInputRowCount: z.number().int().nonnegative(),
  sampledOutputRowCount: z.number().int().nonnegative(),
  changedRowCount: z.number().int().nonnegative(),
  addedRowCount: z.number().int().nonnegative(),
  removedRowCount: z.number().int().nonnegative(),
  changedFieldCount: z.number().int().nonnegative(),
  changedFields: z.array(z.string().min(1)),
});

export const TransformationPreviewDiffPatchSchema = z.object({
  kind: z.literal("json"),
  changes: z.array(z.string()),
  truncated: z.boolean(),
});

export const TransformationAssetPreviewContractSchema = z.object({
  contractVersion: z.literal("1.0.0"),
  generatedAt: z.string().min(1),
  asset: z.object({
    assetId: z.string().min(1),
    assetVersion: z.string().min(1),
  }),
  summary: TransformationPreviewChangeSummarySchema,
  samples: z.object({
    inputRows: z.array(TransformationPreviewRowSampleSchema),
    outputRows: z.array(TransformationPreviewRowSampleSchema),
  }),
  diffs: z.object({
    structuredPatch: TransformationPreviewDiffPatchSchema.optional(),
  }).optional(),
  diagnostics: z.array(z.record(z.unknown())),
  warnings: z.array(TransformationPreviewIssueSchema),
  errors: z.array(TransformationPreviewIssueSchema),
  extensions: z.record(z.unknown()).optional(),
});

export const TransformationPipelinePreviewStepContractSchema = z.object({
  stepId: z.string().min(1),
  assetId: z.string().min(1),
  assetVersion: z.string().min(1),
  status: z.enum(["succeeded", "failed"]),
  summary: TransformationPreviewChangeSummarySchema.optional(),
  warnings: z.array(TransformationPreviewIssueSchema),
  errors: z.array(TransformationPreviewIssueSchema),
  preview: TransformationAssetPreviewContractSchema.optional(),
});

export const TransformationPipelinePreviewContractSchema = z.object({
  contractVersion: z.literal("1.0.0"),
  generatedAt: z.string().min(1),
  pipelineId: z.string().min(1).optional(),
  status: z.enum(["succeeded", "failed"]),
  failureMode: z.enum(PipelineFailureModeValues),
  inputSummary: z.object({
    kind: z.enum(["records", "table"]),
    rowCount: z.number().int().nonnegative(),
  }),
  outputSummary: z.object({
    kind: z.enum(["records", "table"]),
    rowCount: z.number().int().nonnegative(),
  }).optional(),
  finalPreviewData: TransformationInputDataSchema.optional(),
  steps: z.array(TransformationPipelinePreviewStepContractSchema),
  summary: z.object({
    stepCount: z.number().int().nonnegative(),
    succeededStepCount: z.number().int().nonnegative(),
    failedStepCount: z.number().int().nonnegative(),
    warningCount: z.number().int().nonnegative(),
    errorCount: z.number().int().nonnegative(),
    totalChangedRows: z.number().int().nonnegative(),
    totalAddedRows: z.number().int().nonnegative(),
    totalRemovedRows: z.number().int().nonnegative(),
    changedFields: z.array(z.string().min(1)),
  }),
  warnings: z.array(TransformationPreviewIssueSchema),
  errors: z.array(TransformationPreviewIssueSchema),
});
