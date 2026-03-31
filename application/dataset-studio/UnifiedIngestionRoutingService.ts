import {
  DatasetPipelineStageKinds,
} from "../../domain/dataset-studio/StagePipelineDomain";
import {
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionRouteFailureCodes,
  UnifiedIngestionRoutePolicyKinds,
  UnifiedIngestionSourceKinds,
  UnifiedIngestionStrategyKinds,
  type IUnifiedIngestionRouter,
  type UnifiedIngestionRouteFailure,
  type UnifiedIngestionRouteHandlerKind,
  type UnifiedIngestionRouteRequest,
  type UnifiedIngestionRouteResolution,
  type UnifiedIngestionRouteResult,
  type UnifiedIngestionSourceKind,
} from "../../domain/dataset-studio/UnifiedIngestionDomain";
import { StageAssetMappingService } from "./StageAssetMappingService";

export interface UnifiedIngestionRouteDescriptor {
  readonly sourceKind: Exclude<UnifiedIngestionSourceKind, "unknown">;
  readonly handlerKind: UnifiedIngestionRouteHandlerKind;
  readonly assetId: string;
  readonly assetVersion?: string;
}

function buildResolvedRoute(
  sourceKind: UnifiedIngestionSourceKind,
  descriptor: UnifiedIngestionRouteDescriptor,
  policy: UnifiedIngestionRouteResolution["policy"],
  fallbackUsed: boolean,
  reason: string,
): UnifiedIngestionRouteResolution {
  return Object.freeze({
    status: "resolved",
    sourceKind,
    handlerKind: descriptor.handlerKind,
    assetId: descriptor.assetId,
    assetVersion: descriptor.assetVersion,
    policy,
    fallbackUsed,
    reason,
  });
}

function buildUnsupportedRoute(
  sourceKind: UnifiedIngestionSourceKind,
  failureCode: UnifiedIngestionRouteFailure["failureCode"],
  fallbackUsed: boolean,
  reason: string,
): UnifiedIngestionRouteFailure {
  return Object.freeze({
    status: "unsupported",
    sourceKind,
    failureCode,
    fallbackUsed,
    reason,
  });
}

export class UnifiedIngestionRoutingService implements IUnifiedIngestionRouter {
  private readonly descriptorsBySourceKind: Readonly<Record<Exclude<UnifiedIngestionSourceKind, "unknown">, UnifiedIngestionRouteDescriptor | undefined>> | undefined;
  private readonly stageAssetMappingService: StageAssetMappingService;

  constructor(
    descriptors?: ReadonlyArray<UnifiedIngestionRouteDescriptor>,
    stageAssetMappingService: StageAssetMappingService = new StageAssetMappingService(),
  ) {
    this.stageAssetMappingService = stageAssetMappingService;
    if (descriptors) {
      this.descriptorsBySourceKind = Object.freeze({
        csv: descriptors.find((entry) => entry.sourceKind === UnifiedIngestionSourceKinds.csv),
        json: descriptors.find((entry) => entry.sourceKind === UnifiedIngestionSourceKinds.json),
        document: descriptors.find((entry) => entry.sourceKind === UnifiedIngestionSourceKinds.document),
        image: descriptors.find((entry) => entry.sourceKind === UnifiedIngestionSourceKinds.image),
      });
      return;
    }

    this.descriptorsBySourceKind = undefined;
  }

  public route(request: UnifiedIngestionRouteRequest): UnifiedIngestionRouteResult {
    if (!this.descriptorsBySourceKind) {
      const result = this.stageAssetMappingService.resolveStage({
        stageKind: DatasetPipelineStageKinds.ingestion,
        detectedSourceKind: request.detection.detectedKind,
        strategy: request.configuration?.mode === "advanced"
          ? request.configuration.strategy ?? UnifiedIngestionStrategyKinds.auto
          : UnifiedIngestionStrategyKinds.auto,
        outputTarget: request.configuration?.outputTarget ?? UnifiedIngestionOutputTargetKinds.records,
      });

      if (result.status === "unsupported") {
        return buildUnsupportedRoute(
          request.detection.detectedKind,
          result.failureCode,
          result.fallbackUsed,
          result.reason,
        );
      }

      const resolvedAsset = result.assets[0];
      if (!resolvedAsset?.handlerKind) {
        return buildUnsupportedRoute(
          request.detection.detectedKind,
          UnifiedIngestionRouteFailureCodes.missingRouteMapping,
          false,
          `Stage mapping for '${DatasetPipelineStageKinds.ingestion}' did not provide a handlerKind.`,
        );
      }

      return buildResolvedRoute(
        request.detection.detectedKind,
        {
          sourceKind: request.detection.detectedKind === UnifiedIngestionSourceKinds.unknown
            ? UnifiedIngestionSourceKinds.json
            : request.detection.detectedKind,
          handlerKind: resolvedAsset.handlerKind,
          assetId: resolvedAsset.assetId,
          assetVersion: resolvedAsset.assetVersion,
        },
        result.policy ?? UnifiedIngestionRoutePolicyKinds.detectedKind,
        Boolean(result.fallbackUsed),
        result.reason ?? `Stage mapping resolved asset '${resolvedAsset.assetId}'.`,
      );
    }

    if (request.configuration?.mode === "advanced") {
      const strategy = request.configuration.strategy ?? UnifiedIngestionStrategyKinds.auto;
      if (strategy !== UnifiedIngestionStrategyKinds.auto) {
        const pinnedDescriptor = this.descriptorsBySourceKind[strategy];
        if (!pinnedDescriptor) {
          return buildUnsupportedRoute(
            request.detection.detectedKind,
            UnifiedIngestionRouteFailureCodes.missingRouteMapping,
            false,
            `Advanced strategy '${strategy}' does not have a registered ingestor route.`,
          );
        }
        return buildResolvedRoute(
          request.detection.detectedKind,
          pinnedDescriptor,
          UnifiedIngestionRoutePolicyKinds.advancedStrategy,
          false,
          `Advanced strategy '${strategy}' selected '${pinnedDescriptor.assetId}'.`,
        );
      }
    }

    const detectedKind = request.detection.detectedKind;
    if (detectedKind !== UnifiedIngestionSourceKinds.unknown) {
      const direct = this.descriptorsBySourceKind[detectedKind];
      if (!direct) {
        return buildUnsupportedRoute(
          detectedKind,
          UnifiedIngestionRouteFailureCodes.missingRouteMapping,
          false,
          `No low-level ingestor is registered for detected source kind '${detectedKind}'.`,
        );
      }
      return buildResolvedRoute(
        detectedKind,
        direct,
        UnifiedIngestionRoutePolicyKinds.detectedKind,
        false,
        `Detected source kind '${detectedKind}' mapped to '${direct.assetId}'.`,
      );
    }

    const fallbackKind = request.configuration?.outputTarget === UnifiedIngestionOutputTargetKinds.textItems
      ? UnifiedIngestionSourceKinds.document
      : request.configuration?.outputTarget === UnifiedIngestionOutputTargetKinds.imageMetadataRecords
        ? UnifiedIngestionSourceKinds.image
        : UnifiedIngestionSourceKinds.json;
    const fallback = this.descriptorsBySourceKind[fallbackKind];
    if (!fallback) {
      return buildUnsupportedRoute(
        detectedKind,
        UnifiedIngestionRouteFailureCodes.missingRouteMapping,
        true,
        `Detected source kind is unknown and fallback target '${fallbackKind}' has no registered ingestor.`,
      );
    }

    return buildResolvedRoute(
      detectedKind,
      fallback,
      UnifiedIngestionRoutePolicyKinds.outputTargetFallback,
      true,
      `Detected source kind is unknown; fallback route selected '${fallback.assetId}' for output target '${request.configuration?.outputTarget ?? UnifiedIngestionOutputTargetKinds.records}'.`,
    );
  }
}

export function createUnifiedIngestionRoutingService(
  descriptors?: ReadonlyArray<UnifiedIngestionRouteDescriptor>,
): IUnifiedIngestionRouter {
  return new UnifiedIngestionRoutingService(descriptors);
}

