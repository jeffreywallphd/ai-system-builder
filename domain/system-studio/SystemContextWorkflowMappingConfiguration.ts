import { z } from "zod";

export const SystemContextWorkflowMappingContractVersion = "1.0.0";

export const SystemContextWorkflowMappingSourceRoots = Object.freeze({
  systemContext: "system-context",
  parameters: "parameters",
  selectedImage: "selected-image",
  selectedImages: "selected-images",
  datasets: "datasets",
  runtime: "runtime",
  datasetResolution: "dataset-resolution",
} as const);

export type SystemContextWorkflowMappingSourceRoot =
  typeof SystemContextWorkflowMappingSourceRoots[keyof typeof SystemContextWorkflowMappingSourceRoots];

export const SystemContextWorkflowMappingTargetKinds = Object.freeze({
  workflowInput: "workflow-input",
  workflowMetadata: "workflow-metadata",
} as const);

export type SystemContextWorkflowMappingTargetKind =
  typeof SystemContextWorkflowMappingTargetKinds[keyof typeof SystemContextWorkflowMappingTargetKinds];

export const SystemContextWorkflowMappingEntrySchema = z.object({
  mappingId: z.string().trim().min(1),
  sourceRoot: z.nativeEnum(SystemContextWorkflowMappingSourceRoots),
  sourcePath: z.string().trim().optional(),
  targetKind: z.nativeEnum(SystemContextWorkflowMappingTargetKinds),
  targetPath: z.string().trim().optional(),
  required: z.boolean().default(false),
  defaultValue: z.unknown().optional(),
  transformId: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type SystemContextWorkflowMappingEntry = z.infer<typeof SystemContextWorkflowMappingEntrySchema>;

export const SystemContextWorkflowMappingConfigurationSchema = z.object({
  contractVersion: z.string().trim().min(1).default(SystemContextWorkflowMappingContractVersion),
  mappings: z.array(SystemContextWorkflowMappingEntrySchema).default([]),
});

export type SystemContextWorkflowMappingConfiguration = z.infer<typeof SystemContextWorkflowMappingConfigurationSchema>;

export function createSystemContextWorkflowMappingConfiguration(input: unknown): SystemContextWorkflowMappingConfiguration {
  const parsed = SystemContextWorkflowMappingConfigurationSchema.parse(input);
  const seenMappingIds = new Set<string>();

  for (const mapping of parsed.mappings) {
    if (seenMappingIds.has(mapping.mappingId)) {
      throw new Error(`System context workflow mapping ids must be unique. Duplicate '${mapping.mappingId}'.`);
    }
    seenMappingIds.add(mapping.mappingId);
  }

  return Object.freeze({
    contractVersion: parsed.contractVersion,
    mappings: Object.freeze(parsed.mappings.map((mapping) => Object.freeze({
      ...mapping,
      sourcePath: mapping.sourcePath?.trim() || undefined,
      targetPath: mapping.targetPath?.trim() || undefined,
      transformId: mapping.transformId?.trim() || undefined,
      description: mapping.description?.trim() || undefined,
      metadata: mapping.metadata ? Object.freeze({ ...mapping.metadata }) : undefined,
    }))),
  });
}

export function serializeSystemContextWorkflowMappingConfiguration(
  input: SystemContextWorkflowMappingConfiguration,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    contractVersion: input.contractVersion,
    mappings: Object.freeze(input.mappings.map((mapping) => SystemContextWorkflowMappingEntrySchema.parse(mapping))),
  });
}

export function duplicateSystemContextWorkflowMappingConfiguration(
  input: SystemContextWorkflowMappingConfiguration,
): SystemContextWorkflowMappingConfiguration {
  return createSystemContextWorkflowMappingConfiguration(serializeSystemContextWorkflowMappingConfiguration(input));
}
