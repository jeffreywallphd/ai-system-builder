import { z } from "zod";
import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  UnifiedIngestionConfigModes,
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionSourceKinds,
  UnifiedIngestionStrategyKinds,
  type UnifiedIngestionAdvancedConfiguration,
  type UnifiedIngestionConfiguration,
  type UnifiedIngestionConfigMode,
  type UnifiedIngestionOutputTargetKind,
  type UnifiedIngestionSourceKind,
  type UnifiedIngestionStrategyKind,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";

const DefaultPreviewSampleLimit = 25;

const OutputTargetSchema = z.enum([
  UnifiedIngestionOutputTargetKinds.records,
  UnifiedIngestionOutputTargetKinds.textItems,
  UnifiedIngestionOutputTargetKinds.imageMetadataRecords,
]);

const ExplicitSourceKindSchema = z.enum([
  UnifiedIngestionSourceKinds.csv,
  UnifiedIngestionSourceKinds.json,
  UnifiedIngestionSourceKinds.document,
  UnifiedIngestionSourceKinds.image,
]);

const StrategySchema = z.enum([
  UnifiedIngestionStrategyKinds.auto,
  UnifiedIngestionStrategyKinds.csv,
  UnifiedIngestionStrategyKinds.json,
  UnifiedIngestionStrategyKinds.document,
  UnifiedIngestionStrategyKinds.image,
]);

const SimpleConfigurationSchema = z.object({
  mode: z.literal(UnifiedIngestionConfigModes.simple),
  outputTarget: OutputTargetSchema.default(UnifiedIngestionOutputTargetKinds.records),
  previewSampleLimit: z.number().int().min(1).max(100).default(DefaultPreviewSampleLimit),
});

const AdvancedConfigurationSchema = z.object({
  mode: z.literal(UnifiedIngestionConfigModes.advanced),
  outputTarget: OutputTargetSchema.default(UnifiedIngestionOutputTargetKinds.records),
  previewSampleLimit: z.number().int().min(1).max(100).default(DefaultPreviewSampleLimit),
  explicitSourceKind: ExplicitSourceKindSchema.optional(),
  strategy: StrategySchema.default(UnifiedIngestionStrategyKinds.auto),
  delimiterHint: z.string().trim().min(1).max(4).optional(),
  textEncoding: z.string().trim().min(1).max(64).optional(),
  normalizeHeadersToLowercase: z.boolean().optional(),
  flattenJson: z.boolean().optional(),
  flattenJsonDepth: z.number().int().min(1).max(16).optional(),
  documentMaxPages: z.number().int().min(1).max(500).optional(),
  imageExtractExif: z.boolean().optional(),
  imageNormalizeOrientation: z.boolean().optional(),
  enableContentSniffing: z.boolean().default(true),
});

function expectedOutputTargetForKind(kind: UnifiedIngestionSourceKind): UnifiedIngestionOutputTargetKind {
  if (kind === UnifiedIngestionSourceKinds.document) {
    return UnifiedIngestionOutputTargetKinds.textItems;
  }
  if (kind === UnifiedIngestionSourceKinds.image) {
    return UnifiedIngestionOutputTargetKinds.imageMetadataRecords;
  }
  return UnifiedIngestionOutputTargetKinds.records;
}

function strategyToSourceKind(strategy: UnifiedIngestionStrategyKind): Exclude<UnifiedIngestionSourceKind, "unknown"> | undefined {
  if (strategy === UnifiedIngestionStrategyKinds.auto) {
    return undefined;
  }
  return strategy;
}

export interface UnifiedIngestionConfigurationValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
  readonly severity: "warning" | "error";
}

export interface UnifiedIngestionConfigurationResolution {
  readonly configuration: UnifiedIngestionConfiguration;
  readonly issues: ReadonlyArray<UnifiedIngestionConfigurationValidationIssue>;
}

export type UnifiedIngestionConfigurationValues = Readonly<Record<string, CanonicalRecordValue>>;

function toOptionalString(value: CanonicalRecordValue | undefined): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function toOptionalBoolean(value: CanonicalRecordValue | undefined): boolean | undefined {
  if (typeof value !== "boolean") {
    return undefined;
  }
  return value;
}

function toOptionalInt(value: CanonicalRecordValue | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

function mapZodIssue(issue: z.ZodIssue): UnifiedIngestionConfigurationValidationIssue {
  return Object.freeze({
    code: `unified-ingestion-config-${issue.code}`,
    message: issue.message,
    path: issue.path.length > 0 ? issue.path.join(".") : undefined,
    severity: "error",
  });
}

function normalizeAdvancedConfiguration(
  configuration: UnifiedIngestionAdvancedConfiguration,
): UnifiedIngestionConfigurationResolution {
  const issues: UnifiedIngestionConfigurationValidationIssue[] = [];

  if (configuration.flattenJsonDepth !== undefined && configuration.flattenJson !== true) {
    issues.push(Object.freeze({
      code: "unified-ingestion-config-flatten-depth-requires-flatten",
      message: "JSON flatten depth requires 'Flatten nested JSON' to be enabled.",
      path: "flattenJsonDepth",
      severity: "error",
    }));
  }

  const strategyKind = strategyToSourceKind(configuration.strategy ?? UnifiedIngestionStrategyKinds.auto);
  if (strategyKind) {
    const expectedTarget = expectedOutputTargetForKind(strategyKind);
    if (configuration.outputTarget !== expectedTarget) {
      issues.push(Object.freeze({
        code: "unified-ingestion-config-output-target-strategy-mismatch",
        message: `Output target '${configuration.outputTarget}' does not match strategy '${strategyKind}'.`,
        path: "outputTarget",
        severity: "error",
      }));
    }

    if (configuration.explicitSourceKind && configuration.explicitSourceKind !== strategyKind) {
      issues.push(Object.freeze({
        code: "unified-ingestion-config-source-kind-strategy-mismatch",
        message: `Explicit source kind '${configuration.explicitSourceKind}' conflicts with strategy '${strategyKind}'.`,
        path: "explicitSourceKind",
        severity: "error",
      }));
    }
  }

  return Object.freeze({
    configuration,
    issues: Object.freeze(issues),
  });
}

export function resolveUnifiedIngestionConfiguration(input?: {
  readonly mode?: UnifiedIngestionConfigMode;
  readonly values?: UnifiedIngestionConfigurationValues;
  readonly base?: UnifiedIngestionConfiguration;
}): UnifiedIngestionConfigurationResolution {
  const mode = input?.mode ?? input?.base?.mode ?? UnifiedIngestionConfigModes.simple;
  const values = input?.values ?? Object.freeze({});

  if (mode === UnifiedIngestionConfigModes.advanced) {
    const parsed = AdvancedConfigurationSchema.safeParse({
      mode,
      outputTarget: toOptionalString(values.outputTarget) ?? input?.base?.outputTarget,
      previewSampleLimit: toOptionalInt(values.previewSampleLimit) ?? input?.base?.previewSampleLimit,
      explicitSourceKind: toOptionalString(values.explicitSourceKind) ?? (input?.base?.mode === "advanced" ? input.base.explicitSourceKind : undefined),
      strategy: toOptionalString(values.strategy) ?? (input?.base?.mode === "advanced" ? input.base.strategy : undefined),
      delimiterHint: toOptionalString(values.delimiterHint) ?? (input?.base?.mode === "advanced" ? input.base.delimiterHint : undefined),
      textEncoding: toOptionalString(values.textEncoding) ?? (input?.base?.mode === "advanced" ? input.base.textEncoding : undefined),
      normalizeHeadersToLowercase: toOptionalBoolean(values.normalizeHeadersToLowercase)
        ?? (input?.base?.mode === "advanced" ? input.base.normalizeHeadersToLowercase : undefined),
      flattenJson: toOptionalBoolean(values.flattenJson) ?? (input?.base?.mode === "advanced" ? input.base.flattenJson : undefined),
      flattenJsonDepth: toOptionalInt(values.flattenJsonDepth) ?? (input?.base?.mode === "advanced" ? input.base.flattenJsonDepth : undefined),
      documentMaxPages: toOptionalInt(values.documentMaxPages) ?? (input?.base?.mode === "advanced" ? input.base.documentMaxPages : undefined),
      imageExtractExif: toOptionalBoolean(values.imageExtractExif) ?? (input?.base?.mode === "advanced" ? input.base.imageExtractExif : undefined),
      imageNormalizeOrientation: toOptionalBoolean(values.imageNormalizeOrientation)
        ?? (input?.base?.mode === "advanced" ? input.base.imageNormalizeOrientation : undefined),
      enableContentSniffing: toOptionalBoolean(values.enableContentSniffing)
        ?? (input?.base?.mode === "advanced" ? input.base.enableContentSniffing : undefined),
    });
    if (!parsed.success) {
      const fallback = AdvancedConfigurationSchema.parse({ mode });
      return Object.freeze({
        configuration: fallback,
        issues: Object.freeze(parsed.error.issues.map((issue) => mapZodIssue(issue))),
      });
    }
    return normalizeAdvancedConfiguration(parsed.data);
  }

  const parsed = SimpleConfigurationSchema.safeParse({
    mode,
    outputTarget: toOptionalString(values.outputTarget) ?? input?.base?.outputTarget,
    previewSampleLimit: toOptionalInt(values.previewSampleLimit) ?? input?.base?.previewSampleLimit,
  });
  if (!parsed.success) {
    const fallback = SimpleConfigurationSchema.parse({ mode: UnifiedIngestionConfigModes.simple });
    return Object.freeze({
      configuration: fallback,
      issues: Object.freeze(parsed.error.issues.map((issue) => mapZodIssue(issue))),
    });
  }

  return Object.freeze({
    configuration: parsed.data,
    issues: Object.freeze([]),
  });
}
