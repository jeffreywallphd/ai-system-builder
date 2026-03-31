import {
  UnifiedIngestionOutputTargetKinds,
  UnifiedIngestionRouteFailureCodes,
  UnifiedIngestionRouteHandlerKinds,
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
import { CsvIngestorAsset } from "./CsvIngestorAsset";
import { DocumentPdfIngestorAsset } from "./DocumentPdfIngestorAsset";
import { ImageIngestorAsset } from "./ImageIngestorAsset";
import { JsonIngestorAsset } from "./JsonIngestorAsset";

export interface UnifiedIngestionRouteDescriptor {
  readonly sourceKind: Exclude<UnifiedIngestionSourceKind, "unknown">;
  readonly handlerKind: UnifiedIngestionRouteHandlerKind;
  readonly assetId: string;
  readonly assetVersion?: string;
}

const DefaultUnifiedIngestionRouteDescriptors: ReadonlyArray<UnifiedIngestionRouteDescriptor> = Object.freeze([
  Object.freeze({
    sourceKind: UnifiedIngestionSourceKinds.csv,
    handlerKind: UnifiedIngestionRouteHandlerKinds.csv,
    assetId: CsvIngestorAsset.assetId,
    assetVersion: CsvIngestorAsset.assetVersion,
  }),
  Object.freeze({
    sourceKind: UnifiedIngestionSourceKinds.json,
    handlerKind: UnifiedIngestionRouteHandlerKinds.json,
    assetId: JsonIngestorAsset.assetId,
    assetVersion: JsonIngestorAsset.assetVersion,
  }),
  Object.freeze({
    sourceKind: UnifiedIngestionSourceKinds.document,
    handlerKind: UnifiedIngestionRouteHandlerKinds.document,
    assetId: DocumentPdfIngestorAsset.assetId,
    assetVersion: DocumentPdfIngestorAsset.assetVersion,
  }),
  Object.freeze({
    sourceKind: UnifiedIngestionSourceKinds.image,
    handlerKind: UnifiedIngestionRouteHandlerKinds.image,
    assetId: ImageIngestorAsset.assetId,
    assetVersion: ImageIngestorAsset.assetVersion,
  }),
]);

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
  private readonly descriptorsBySourceKind: Readonly<Record<Exclude<UnifiedIngestionSourceKind, "unknown">, UnifiedIngestionRouteDescriptor | undefined>>;

  constructor(
    descriptors: ReadonlyArray<UnifiedIngestionRouteDescriptor> = DefaultUnifiedIngestionRouteDescriptors,
  ) {
    this.descriptorsBySourceKind = Object.freeze({
      csv: descriptors.find((entry) => entry.sourceKind === UnifiedIngestionSourceKinds.csv),
      json: descriptors.find((entry) => entry.sourceKind === UnifiedIngestionSourceKinds.json),
      document: descriptors.find((entry) => entry.sourceKind === UnifiedIngestionSourceKinds.document),
      image: descriptors.find((entry) => entry.sourceKind === UnifiedIngestionSourceKinds.image),
    });
  }

  public route(request: UnifiedIngestionRouteRequest): UnifiedIngestionRouteResult {
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

