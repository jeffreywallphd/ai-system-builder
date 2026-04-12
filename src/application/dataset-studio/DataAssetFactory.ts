import { AssetContractShapeKinds } from "@domain/contracts/AssetContract";
import { CanonicalDataAsset } from "@domain/dataset-studio/CanonicalDataAsset";
import type { CanonicalDataShapeKind, CanonicalRecordValue } from "@domain/dataset-studio/CanonicalDataShapes";
import type { DataAssetDependencyReference } from "@domain/dataset-studio/DataAssetBase";
import type { DataConverterResult, DataConverterSuccessResult } from "./DataConverterContracts";
import { DataPreviewEngine, type DataPreviewEngineOptions, type DataPreviewModel } from "../data-studio/DataPreviewEngine";
import type { DataAssetExecutionResult } from "./DataAssetExecutionFramework";

export interface DataAssetFactoryOptions {
  readonly previewEngine?: Pick<DataPreviewEngine, "buildFromConverterResult">;
}

export interface CreateDataAssetFromConversionRequest {
  readonly assetId: string;
  readonly name: string;
  readonly version?: string;
  readonly config?: Readonly<Record<string, CanonicalRecordValue>>;
  readonly composableInputShapeKinds?: ReadonlyArray<CanonicalDataShapeKind>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function toDependencies(result: DataConverterSuccessResult): ReadonlyArray<DataAssetDependencyReference> {
  const dependencies = result.metadata.lineage?.map((lineage) => Object.freeze({
    assetId: lineage.assetId,
    versionId: lineage.versionId,
    relationship: lineage.relationship === "source" ? "input" : "reference",
  } satisfies DataAssetDependencyReference)) ?? [];

  return Object.freeze(dependencies);
}

export class DataAssetFactory {
  private readonly previewEngine: Pick<DataPreviewEngine, "buildFromConverterResult">;

  constructor(options: DataAssetFactoryOptions = {}) {
    this.previewEngine = options.previewEngine ?? new DataPreviewEngine();
  }

  public createFromConverterResult(
    request: CreateDataAssetFromConversionRequest,
    result: DataConverterResult,
  ): CanonicalDataAsset {
    if (!result.ok) {
      const reason = result.diagnostics[0]?.message;
      throw new Error(
        reason
          ? `Cannot create data asset from a failed conversion result: ${reason}`
          : "Cannot create data asset from a failed conversion result.",
      );
    }

    const sourceReference = normalizeOptional(result.metadata.source?.fileName)
      ?? normalizeOptional(result.context.lineageAssetId)
      ?? `${request.assetId}/source`;

    return new CanonicalDataAsset({
      id: request.assetId,
      name: request.name,
      version: request.version,
      source: {
        type: result.metadata.lineage?.length ? "derived" : "generated",
        parentAssetId: result.metadata.lineage?.[0]?.assetId,
        provider: result.contract.converterId,
      },
      location: {
        accessMethod: "virtual",
        location: `dataset://${request.assetId}`,
        format: result.output.kind,
      },
      outputShape: result.output,
      contracts: {
        version: result.contract.schemaVersion,
        input: {
          kind: AssetContractShapeKinds.jsonSchema,
          description: `Converter input contract (${result.contract.inputBoundary}) for ${result.contract.operation}.`,
        },
        output: {
          kind: AssetContractShapeKinds.jsonSchema,
          description: `Canonical ${result.contract.outputShapeKind} output contract.`,
        },
      },
      config: request.config,
      dependencies: toDependencies(result),
      composableInputShapeKinds: request.composableInputShapeKinds,
      semanticMetadata: {
        description: `Canonical data asset produced by ${result.contract.converterId}.`,
        tags: ["dataset", "data-studio", result.contract.operation],
        attributes: {
          sourceReference,
        },
      },
      versionMetadata: {
        schemaVersion: result.metadata.schemaVersion,
        contractVersion: result.contract.schemaVersion,
        revision: 1,
        publishedVersionId: request.version,
      },
    });
  }

  public createPreviewFromConverterResult(
    result: DataConverterResult,
    options?: DataPreviewEngineOptions,
  ): DataPreviewModel {
    return this.previewEngine.buildFromConverterResult(result, options);
  }

  public createFromExecutionResult(
    request: CreateDataAssetFromConversionRequest,
    execution: DataAssetExecutionResult,
  ): CanonicalDataAsset {
    if (!execution.ok || !execution.output) {
      const reason = execution.diagnostics[0]?.message;
      throw new Error(
        reason
          ? `Cannot create data asset from failed execution result: ${reason}`
          : "Cannot create data asset from failed execution result.",
      );
    }

    return new CanonicalDataAsset({
      id: request.assetId,
      name: request.name,
      version: request.version,
      source: {
        type: "derived",
        parentAssetId: execution.asset.assetId,
        executionId: execution.context.executionId,
        provider: "dataset-studio-data-asset-execution-framework",
      },
      location: {
        accessMethod: "virtual",
        location: `dataset://${request.assetId}`,
        format: execution.output.kind,
      },
      outputShape: execution.output,
      contracts: {
        version: "1.0.0",
        input: {
          kind: AssetContractShapeKinds.jsonSchema,
          description: "Data asset execution request payload.",
        },
        output: {
          kind: AssetContractShapeKinds.jsonSchema,
          description: `Canonical ${execution.output.kind} output contract.`,
        },
      },
      config: request.config,
      dependencies: Object.freeze([
        ...execution.lineage.inputs
          .filter((reference) => typeof reference.assetId === "string")
          .map((reference) => Object.freeze({
            assetId: reference.assetId!,
            versionId: reference.versionId,
            relationship: "input",
          } satisfies DataAssetDependencyReference)),
      ]),
      composableInputShapeKinds: request.composableInputShapeKinds,
      semanticMetadata: {
        description: "Canonical data asset produced by data asset execution.",
        tags: ["dataset", "data-studio", "execution"],
        attributes: {
          executionId: execution.context.executionId,
        },
      },
      versionMetadata: {
        schemaVersion: execution.output.metadata.schemaVersion,
        contractVersion: "1.0.0",
        revision: 1,
        publishedVersionId: request.version,
      },
    });
  }
}


