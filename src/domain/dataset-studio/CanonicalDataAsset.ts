import type {
  IAssetAuditInfo,
  IAssetLocation,
  IAssetRelationship,
  IAssetSemanticMetadata,
  IAssetSourceInfo,
  IAssetTechnicalMetadata,
} from "../assets/interfaces/IAsset";
import { AssetContractShapeKinds } from "../contracts/AssetContract";
import type { CanonicalDataShape, CanonicalDataShapeKind, CanonicalRecordValue } from "./CanonicalDataShapes";
import {
  DataAssetBase,
  type DataAssetContracts,
  type DataAssetDependencyReference,
  type DataAssetRuntimeOperationalContract,
  type DataAssetVersionMetadata,
} from "./DataAssetBase";

function defaultContracts(outputShapeKind: CanonicalDataShapeKind): DataAssetContracts {
  return Object.freeze({
    version: "1.0.0",
    input: Object.freeze({
      kind: AssetContractShapeKinds.jsonSchema,
      description: "Canonical data asset input payload for deterministic conversion/normalization steps.",
    }),
    output: Object.freeze({
      kind: AssetContractShapeKinds.jsonSchema,
      description: `Canonical ${outputShapeKind} preview/output payload.`,
    }),
    parameters: Object.freeze([]),
    execution: Object.freeze({
      invocationMode: "deferred",
      sideEffects: "none",
    }),
  });
}

function defaultComposableInputShapeKinds(): ReadonlyArray<CanonicalDataShapeKind> {
  return Object.freeze([
    "records",
    "table",
    "text-items",
    "image-metadata-records",
  ]);
}

export class CanonicalDataAsset extends DataAssetBase {
  private readonly outputShape: CanonicalDataShape;

  constructor(params: {
    readonly id: string;
    readonly name: string;
    readonly outputShape: CanonicalDataShape;
    readonly source: IAssetSourceInfo;
    readonly location: IAssetLocation;
    readonly version?: string;
    readonly contracts?: DataAssetContracts;
    readonly config?: Readonly<Record<string, CanonicalRecordValue>>;
    readonly versionMetadata?: Partial<DataAssetVersionMetadata>;
    readonly dependencies?: ReadonlyArray<DataAssetDependencyReference>;
    readonly composableInputShapeKinds?: ReadonlyArray<CanonicalDataShapeKind>;
    readonly supportsPreview?: boolean;
    readonly runtime?: Partial<DataAssetRuntimeOperationalContract>;
    readonly status?: "draft" | "pending" | "available" | "missing" | "failed" | "archived" | "deleted";
    readonly technicalMetadata?: IAssetTechnicalMetadata;
    readonly semanticMetadata?: IAssetSemanticMetadata;
    readonly relationships?: ReadonlyArray<IAssetRelationship>;
    readonly audit?: IAssetAuditInfo;
  }) {
    super({
      id: params.id,
      name: params.name,
      version: params.version,
      source: params.source,
      location: params.location,
      contracts: params.contracts ?? defaultContracts(params.outputShape.kind),
      config: params.config,
      versionMetadata: params.versionMetadata,
      dependencies: params.dependencies,
      composableInputShapeKinds: params.composableInputShapeKinds ?? defaultComposableInputShapeKinds(),
      supportsPreview: params.supportsPreview,
      runtime: params.runtime,
      status: params.status,
      technicalMetadata: params.technicalMetadata,
      semanticMetadata: params.semanticMetadata,
      relationships: params.relationships,
      audit: params.audit,
    });

    this.outputShape = params.outputShape;
  }

  public override toCanonicalDataShape(): CanonicalDataShape {
    return this.outputShape;
  }
}
