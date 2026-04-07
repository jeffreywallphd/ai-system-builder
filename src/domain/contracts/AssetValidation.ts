import { z } from "zod";

export const AssetValidationStatuses = Object.freeze({
  valid: "valid",
  invalid: "invalid",
} as const);

export const AssetValidationSeverities = Object.freeze({
  error: "error",
  warning: "warning",
} as const);

export const AssetValidationLayers = Object.freeze({
  structural: "structural",
  referential: "referential",
  compatibility: "compatibility",
} as const);

export const AssetValidationIssueSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  severity: z.nativeEnum(AssetValidationSeverities),
  layer: z.nativeEnum(AssetValidationLayers),
  assetId: z.string().trim().min(1),
  assetType: z.string().trim().min(1),
  path: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const AssetValidationResultSchema = z.object({
  status: z.nativeEnum(AssetValidationStatuses),
  errors: z.array(AssetValidationIssueSchema),
  warnings: z.array(AssetValidationIssueSchema),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AssetValidationStatus = typeof AssetValidationStatuses[keyof typeof AssetValidationStatuses];
export type AssetValidationIssue = z.infer<typeof AssetValidationIssueSchema>;
export type AssetValidationResult = z.infer<typeof AssetValidationResultSchema>;

export function createAssetValidationResult(input: {
  readonly errors?: ReadonlyArray<AssetValidationIssue>;
  readonly warnings?: ReadonlyArray<AssetValidationIssue>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}): AssetValidationResult {
  const errors = Object.freeze([...(input.errors ?? [])]);
  const warnings = Object.freeze([...(input.warnings ?? [])]);
  return Object.freeze(AssetValidationResultSchema.parse({
    status: errors.length > 0 ? AssetValidationStatuses.invalid : AssetValidationStatuses.valid,
    errors,
    warnings,
    metadata: input.metadata ? { ...input.metadata } : undefined,
  }));
}
