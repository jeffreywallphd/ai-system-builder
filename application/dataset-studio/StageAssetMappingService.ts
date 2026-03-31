import { z } from "zod";
import type { CanonicalRecordValue } from "../../domain/dataset-studio/CanonicalDataShapes";
import {
  DatasetIngestionStageAssetIds,
  DatasetPipelineStageKinds,
  type DatasetPipelineStageKind,
} from "../../domain/dataset-studio/StagePipelineDomain";
import {
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionRouteFailureCodes,
  UnifiedIngestionRouteHandlerKinds,
  UnifiedIngestionRoutePolicyKinds,
  UnifiedIngestionSourceKinds,
  UnifiedIngestionStrategyKinds,
  type UnifiedIngestionOutputTargetKind,
  type UnifiedIngestionRouteFailureCode,
  type UnifiedIngestionRouteHandlerKind,
  type UnifiedIngestionRoutePolicyKind,
  type UnifiedIngestionSourceKind,
  type UnifiedIngestionStrategyKind,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";

export interface StageAssetMappingAsset {
  readonly assetId: string;
  readonly assetVersion?: string;
  readonly handlerKind?: UnifiedIngestionRouteHandlerKind;
  readonly configDefaults?: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface StageAssetMappingStaticDefinition {
  readonly type: "static";
  readonly stageKind: DatasetPipelineStageKind;
  readonly assets: ReadonlyArray<StageAssetMappingAsset>;
}

export interface StageAssetMappingConditionalClause {
  readonly id: string;
  readonly matches: {
    readonly detectedSourceKind?: UnifiedIngestionSourceKind;
    readonly strategy?: UnifiedIngestionStrategyKind;
    readonly outputTarget?: UnifiedIngestionOutputTargetKind;
  };
  readonly policy: UnifiedIngestionRoutePolicyKind;
  readonly fallbackUsed: boolean;
  readonly reason: string;
  readonly assets: ReadonlyArray<StageAssetMappingAsset>;
}

export interface StageAssetMappingConditionalDefinition {
  readonly type: "conditional";
  readonly stageKind: DatasetPipelineStageKind;
  readonly clauses: ReadonlyArray<StageAssetMappingConditionalClause>;
  readonly unsupported: {
    readonly failureCode: UnifiedIngestionRouteFailureCode;
    readonly reason: string;
  };
}

export type StageAssetMappingDefinition =
  | StageAssetMappingStaticDefinition
  | StageAssetMappingConditionalDefinition;

export interface ResolveStageAssetMappingRequest {
  readonly stageKind: DatasetPipelineStageKind;
  readonly detectedSourceKind?: UnifiedIngestionSourceKind;
  readonly strategy?: UnifiedIngestionStrategyKind;
  readonly outputTarget?: UnifiedIngestionOutputTargetKind;
}

export interface StageAssetMappingResolution {
  readonly status: "resolved";
  readonly stageKind: DatasetPipelineStageKind;
  readonly assets: ReadonlyArray<StageAssetMappingAsset>;
  readonly policy?: UnifiedIngestionRoutePolicyKind;
  readonly fallbackUsed?: boolean;
  readonly reason?: string;
  readonly matchedClauseId?: string;
}

export interface StageAssetMappingUnsupported {
  readonly status: "unsupported";
  readonly stageKind: DatasetPipelineStageKind;
  readonly failureCode: UnifiedIngestionRouteFailureCode;
  readonly reason: string;
  readonly fallbackUsed: boolean;
}

export type StageAssetMappingResult = StageAssetMappingResolution | StageAssetMappingUnsupported;

const StageKindSchema = z.nativeEnum(DatasetPipelineStageKinds);
const SourceKindSchema = z.nativeEnum(UnifiedIngestionSourceKinds);
const StrategyKindSchema = z.nativeEnum(UnifiedIngestionStrategyKinds);
const OutputTargetKindSchema = z.nativeEnum(UnifiedIngestionOutputTargetKinds);
const RouteHandlerKindSchema = z.nativeEnum(UnifiedIngestionRouteHandlerKinds);
const RoutePolicyKindSchema = z.nativeEnum(UnifiedIngestionRoutePolicyKinds);
const RouteFailureCodeSchema = z.nativeEnum(UnifiedIngestionRouteFailureCodes);

const StageAssetMappingAssetSchema = z.object({
  assetId: z.string().trim().min(1),
  assetVersion: z.string().trim().min(1).optional(),
  handlerKind: RouteHandlerKindSchema.optional(),
  configDefaults: z.record(z.any()).optional(),
});

const StageAssetMappingStaticDefinitionSchema = z.object({
  type: z.literal("static"),
  stageKind: StageKindSchema,
  assets: z.array(StageAssetMappingAssetSchema).min(1),
});

const StageAssetMappingConditionalClauseSchema = z.object({
  id: z.string().trim().min(1),
  matches: z.object({
    detectedSourceKind: SourceKindSchema.optional(),
    strategy: StrategyKindSchema.optional(),
    outputTarget: OutputTargetKindSchema.optional(),
  }).superRefine((value, ctx) => {
    if (!value.detectedSourceKind && !value.strategy && !value.outputTarget) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Conditional stage mapping clauses must declare at least one match condition.",
      });
    }
  }),
  policy: RoutePolicyKindSchema,
  fallbackUsed: z.boolean(),
  reason: z.string().trim().min(1),
  assets: z.array(StageAssetMappingAssetSchema).min(1),
});

const StageAssetMappingConditionalDefinitionSchema = z.object({
  type: z.literal("conditional"),
  stageKind: StageKindSchema,
  clauses: z.array(StageAssetMappingConditionalClauseSchema).min(1),
  unsupported: z.object({
    failureCode: RouteFailureCodeSchema,
    reason: z.string().trim().min(1),
  }),
});

const StageAssetMappingDefinitionSchema = z.union([
  StageAssetMappingStaticDefinitionSchema,
  StageAssetMappingConditionalDefinitionSchema,
]);

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeAsset(asset: StageAssetMappingAsset): StageAssetMappingAsset {
  return Object.freeze({
    assetId: asset.assetId.trim(),
    assetVersion: normalizeOptional(asset.assetVersion),
    handlerKind: asset.handlerKind,
    configDefaults: asset.configDefaults,
  });
}

function toDefaultsRecord(): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze({
    outputTarget: UnifiedIngestionOutputTargetKinds.records,
    previewSampleLimit: 25,
    strategy: UnifiedIngestionStrategyKinds.auto,
    enableContentSniffing: true,
    textEncoding: "utf-8",
    normalizeHeadersToLowercase: false,
    flattenJson: false,
  });
}

const DefaultStageAssetMappings: ReadonlyArray<StageAssetMappingDefinition> = Object.freeze([
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.source,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
        configDefaults: toDefaultsRecord(),
      }),
    ]),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.sourceSelection,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
        configDefaults: toDefaultsRecord(),
      }),
    ]),
  }),
  Object.freeze({
    type: "conditional",
    stageKind: DatasetPipelineStageKinds.ingestion,
    clauses: Object.freeze([
      Object.freeze({
        id: "advanced-strategy-csv",
        matches: Object.freeze({ strategy: UnifiedIngestionStrategyKinds.csv }),
        policy: UnifiedIngestionRoutePolicyKinds.advancedStrategy,
        fallbackUsed: false,
        reason: "Advanced strategy 'csv' selected 'csv-ingestor'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.csv,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.csv,
          }),
        ]),
      }),
      Object.freeze({
        id: "advanced-strategy-json",
        matches: Object.freeze({ strategy: UnifiedIngestionStrategyKinds.json }),
        policy: UnifiedIngestionRoutePolicyKinds.advancedStrategy,
        fallbackUsed: false,
        reason: "Advanced strategy 'json' selected 'json-ingestor'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.json,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.json,
          }),
        ]),
      }),
      Object.freeze({
        id: "advanced-strategy-document",
        matches: Object.freeze({ strategy: UnifiedIngestionStrategyKinds.document }),
        policy: UnifiedIngestionRoutePolicyKinds.advancedStrategy,
        fallbackUsed: false,
        reason: "Advanced strategy 'document' selected 'document-pdf-ingestor'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.document,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.document,
          }),
        ]),
      }),
      Object.freeze({
        id: "advanced-strategy-image",
        matches: Object.freeze({ strategy: UnifiedIngestionStrategyKinds.image }),
        policy: UnifiedIngestionRoutePolicyKinds.advancedStrategy,
        fallbackUsed: false,
        reason: "Advanced strategy 'image' selected 'image-ingestor-v1'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.image,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.image,
          }),
        ]),
      }),
      Object.freeze({
        id: "detected-csv",
        matches: Object.freeze({ detectedSourceKind: UnifiedIngestionSourceKinds.csv }),
        policy: UnifiedIngestionRoutePolicyKinds.detectedKind,
        fallbackUsed: false,
        reason: "Detected source kind 'csv' mapped to 'csv-ingestor'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.csv,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.csv,
          }),
        ]),
      }),
      Object.freeze({
        id: "detected-json",
        matches: Object.freeze({ detectedSourceKind: UnifiedIngestionSourceKinds.json }),
        policy: UnifiedIngestionRoutePolicyKinds.detectedKind,
        fallbackUsed: false,
        reason: "Detected source kind 'json' mapped to 'json-ingestor'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.json,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.json,
          }),
        ]),
      }),
      Object.freeze({
        id: "detected-document",
        matches: Object.freeze({ detectedSourceKind: UnifiedIngestionSourceKinds.document }),
        policy: UnifiedIngestionRoutePolicyKinds.detectedKind,
        fallbackUsed: false,
        reason: "Detected source kind 'document' mapped to 'document-pdf-ingestor'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.document,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.document,
          }),
        ]),
      }),
      Object.freeze({
        id: "detected-image",
        matches: Object.freeze({ detectedSourceKind: UnifiedIngestionSourceKinds.image }),
        policy: UnifiedIngestionRoutePolicyKinds.detectedKind,
        fallbackUsed: false,
        reason: "Detected source kind 'image' mapped to 'image-ingestor-v1'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.image,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.image,
          }),
        ]),
      }),
      Object.freeze({
        id: "unknown-fallback-text-items",
        matches: Object.freeze({
          detectedSourceKind: UnifiedIngestionSourceKinds.unknown,
          outputTarget: UnifiedIngestionOutputTargetKinds.textItems,
        }),
        policy: UnifiedIngestionRoutePolicyKinds.outputTargetFallback,
        fallbackUsed: true,
        reason: "Detected source kind is unknown; fallback route selected 'document-pdf-ingestor' for output target 'canonical-text-items'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.document,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.document,
          }),
        ]),
      }),
      Object.freeze({
        id: "unknown-fallback-image-metadata-records",
        matches: Object.freeze({
          detectedSourceKind: UnifiedIngestionSourceKinds.unknown,
          outputTarget: UnifiedIngestionOutputTargetKinds.imageMetadataRecords,
        }),
        policy: UnifiedIngestionRoutePolicyKinds.outputTargetFallback,
        fallbackUsed: true,
        reason: "Detected source kind is unknown; fallback route selected 'image-ingestor-v1' for output target 'canonical-image-metadata-records'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.image,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.image,
          }),
        ]),
      }),
      Object.freeze({
        id: "unknown-fallback-default",
        matches: Object.freeze({
          detectedSourceKind: UnifiedIngestionSourceKinds.unknown,
        }),
        policy: UnifiedIngestionRoutePolicyKinds.outputTargetFallback,
        fallbackUsed: true,
        reason: "Detected source kind is unknown; fallback route selected 'json-ingestor' for output target 'canonical-records'.",
        assets: Object.freeze([
          Object.freeze({
            assetId: DatasetIngestionStageAssetIds.json,
            assetVersion: "1.0.0",
            handlerKind: UnifiedIngestionRouteHandlerKinds.json,
          }),
        ]),
      }),
    ]),
    unsupported: Object.freeze({
      failureCode: UnifiedIngestionRouteFailureCodes.missingRouteMapping,
      reason: "No low-level ingestor mapping is available for the ingestion stage request.",
    }),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.rawStorage,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
      }),
    ]),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.extraction,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
      }),
    ]),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.chunking,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
      }),
    ]),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.profiling,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
      }),
    ]),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.normalization,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
      }),
    ]),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.cleaning,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
      }),
    ]),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.transformation,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
      }),
    ]),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.aggregation,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
      }),
    ]),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.preparedStorage,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
      }),
    ]),
  }),
  Object.freeze({
    type: "static",
    stageKind: DatasetPipelineStageKinds.preview,
    assets: Object.freeze([
      Object.freeze({
        assetId: DatasetIngestionStageAssetIds.unified,
        assetVersion: "1.0.0",
      }),
    ]),
  }),
]);

function matchClause(
  clause: StageAssetMappingConditionalClause,
  request: ResolveStageAssetMappingRequest,
): boolean {
  if (clause.matches.strategy && clause.matches.strategy !== request.strategy) {
    return false;
  }
  if (clause.matches.detectedSourceKind && clause.matches.detectedSourceKind !== request.detectedSourceKind) {
    return false;
  }
  if (clause.matches.outputTarget && clause.matches.outputTarget !== request.outputTarget) {
    return false;
  }
  return true;
}

export class StageAssetMappingService {
  private readonly definitions: ReadonlyArray<StageAssetMappingDefinition>;

  constructor(definitions: ReadonlyArray<StageAssetMappingDefinition> = DefaultStageAssetMappings) {
    this.definitions = Object.freeze(definitions.map((definition) => {
      const validated = StageAssetMappingDefinitionSchema.parse(definition) as StageAssetMappingDefinition;
      if (validated.type === "static") {
        return Object.freeze({
          ...validated,
          assets: Object.freeze(validated.assets.map((asset) => normalizeAsset(asset))),
        });
      }
      return Object.freeze({
        ...validated,
        clauses: Object.freeze(validated.clauses.map((clause) => Object.freeze({
          ...clause,
          assets: Object.freeze(clause.assets.map((asset) => normalizeAsset(asset))),
        }))),
      });
    }));
  }

  public listDefinitions(): ReadonlyArray<StageAssetMappingDefinition> {
    return this.definitions;
  }

  public resolveStage(request: ResolveStageAssetMappingRequest): StageAssetMappingResult {
    const normalizedRequest = Object.freeze({
      ...request,
      strategy: request.strategy ?? UnifiedIngestionStrategyKinds.auto,
      outputTarget: request.outputTarget ?? UnifiedIngestionOutputTargetKinds.records,
    });
    const definition = this.definitions.find((entry) => entry.stageKind === normalizedRequest.stageKind);
    if (!definition) {
      return Object.freeze({
        status: "unsupported",
        stageKind: normalizedRequest.stageKind,
        failureCode: UnifiedIngestionRouteFailureCodes.missingRouteMapping,
        reason: `No stage-to-asset mapping definition is registered for stage '${normalizedRequest.stageKind}'.`,
        fallbackUsed: false,
      });
    }

    if (definition.type === "static") {
      return Object.freeze({
        status: "resolved",
        stageKind: normalizedRequest.stageKind,
        assets: Object.freeze(definition.assets.map((asset) => normalizeAsset(asset))),
      });
    }

    const clause = definition.clauses.find((entry) => matchClause(entry, normalizedRequest));
    if (!clause) {
      return Object.freeze({
        status: "unsupported",
        stageKind: normalizedRequest.stageKind,
        failureCode: definition.unsupported.failureCode,
        reason: definition.unsupported.reason,
        fallbackUsed: false,
      });
    }

    return Object.freeze({
      status: "resolved",
      stageKind: normalizedRequest.stageKind,
      assets: Object.freeze(clause.assets.map((asset) => normalizeAsset(asset))),
      policy: clause.policy,
      fallbackUsed: clause.fallbackUsed,
      reason: clause.reason,
      matchedClauseId: clause.id,
    });
  }
}

export function createStageAssetMappingService(
  definitions?: ReadonlyArray<StageAssetMappingDefinition>,
): StageAssetMappingService {
  return new StageAssetMappingService(definitions);
}
