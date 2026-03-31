import { Asset } from "../assets/Asset";
import type {
  IAssetAuditInfo,
  IAssetLocation,
  IAssetRelationship,
  IAssetSemanticMetadata,
  IAssetSourceInfo,
  IAssetTechnicalMetadata,
} from "../assets/interfaces/IAsset";
import {
  createAssetContractDescriptor,
  type AssetContractDescriptor,
  type AssetContractExecutionMetadata,
  type AssetContractParameterDescriptor,
  type AssetContractShapeDescriptor,
} from "../contracts/AssetContract";
import type {
  CanonicalDataShape,
  CanonicalDataShapeKind,
  CanonicalRecordValue,
} from "./CanonicalDataShapes";

export interface DataAssetDependencyReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly relationship: "input" | "reference" | "enrichment" | "composed-from";
}

export interface DataAssetVersionMetadata {
  readonly schemaVersion: string;
  readonly contractVersion: string;
  readonly revision: number;
  readonly publishedVersionId?: string;
}

export interface DataAssetContracts {
  readonly input: AssetContractShapeDescriptor;
  readonly output: AssetContractShapeDescriptor;
  readonly parameters?: ReadonlyArray<AssetContractParameterDescriptor>;
  readonly execution?: AssetContractExecutionMetadata;
  readonly version?: string;
}

export interface DataAssetConfigSurface {
  readonly values: Readonly<Record<string, CanonicalRecordValue>>;
}

export interface DataAssetInspection {
  readonly assetId: string;
  readonly name: string;
  readonly version?: string;
  readonly outputShapeKind: CanonicalDataShapeKind;
  readonly inputContract: AssetContractShapeDescriptor;
  readonly outputContract: AssetContractShapeDescriptor;
  readonly contractVersion: string;
  readonly schemaVersion: string;
  readonly revision: number;
  readonly configKeys: ReadonlyArray<string>;
  readonly dependencies: ReadonlyArray<DataAssetDependencyReference>;
  readonly supportsPreview: boolean;
  readonly composableInputShapeKinds: ReadonlyArray<CanonicalDataShapeKind>;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeConfig(
  values?: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> {
  const entries = Object.entries(values ?? {})
    .map(([key, value]) => [key.trim(), value] as const)
    .filter(([key]) => key.length > 0);

  return Object.freeze(Object.fromEntries(entries));
}

function normalizeDependencies(
  dependencies?: ReadonlyArray<DataAssetDependencyReference>,
): ReadonlyArray<DataAssetDependencyReference> {
  const deduped = new Map<string, DataAssetDependencyReference>();
  for (const dependency of dependencies ?? []) {
    const assetId = dependency.assetId.trim();
    if (!assetId) {
      throw new Error("Data asset dependency references require a non-empty assetId.");
    }

    const versionId = normalizeOptional(dependency.versionId);
    const normalized = Object.freeze({
      assetId,
      versionId,
      relationship: dependency.relationship,
    });

    deduped.set(`${assetId}:${versionId ?? ""}:${dependency.relationship}`, normalized);
  }

  return Object.freeze([...deduped.values()]);
}

function normalizeComposableKinds(
  kinds?: ReadonlyArray<CanonicalDataShapeKind>,
): ReadonlyArray<CanonicalDataShapeKind> {
  const normalized = [...new Set((kinds ?? []).map((kind) => kind.trim() as CanonicalDataShapeKind).filter(Boolean))];
  return Object.freeze(normalized);
}

function normalizeVersionMetadata(
  metadata?: Partial<DataAssetVersionMetadata>,
  defaultContractVersion: string = "1.0.0",
): DataAssetVersionMetadata {
  const schemaVersion = normalizeOptional(metadata?.schemaVersion) ?? "1.0.0";
  const contractVersion = normalizeOptional(metadata?.contractVersion) ?? defaultContractVersion;
  const revision = metadata?.revision ?? 1;

  if (!Number.isInteger(revision) || revision < 1) {
    throw new Error("DataAssetVersionMetadata.revision must be a positive integer.");
  }

  return Object.freeze({
    schemaVersion,
    contractVersion,
    revision,
    publishedVersionId: normalizeOptional(metadata?.publishedVersionId),
  });
}

export abstract class DataAssetBase extends Asset {
  public readonly contract: AssetContractDescriptor;
  public readonly config: DataAssetConfigSurface;
  public readonly versionMetadata: DataAssetVersionMetadata;
  public readonly dependencies: ReadonlyArray<DataAssetDependencyReference>;
  public readonly composableInputShapeKinds: ReadonlyArray<CanonicalDataShapeKind>;
  public readonly supportsPreview: boolean;

  protected constructor(params: {
    readonly id: string;
    readonly name: string;
    readonly version?: string;
    readonly source: IAssetSourceInfo;
    readonly location: IAssetLocation;
    readonly contracts: DataAssetContracts;
    readonly config?: Readonly<Record<string, CanonicalRecordValue>>;
    readonly versionMetadata?: Partial<DataAssetVersionMetadata>;
    readonly dependencies?: ReadonlyArray<DataAssetDependencyReference>;
    readonly composableInputShapeKinds?: ReadonlyArray<CanonicalDataShapeKind>;
    readonly supportsPreview?: boolean;
    readonly status?: "draft" | "pending" | "available" | "missing" | "failed" | "archived" | "deleted";
    readonly technicalMetadata?: IAssetTechnicalMetadata;
    readonly semanticMetadata?: IAssetSemanticMetadata;
    readonly relationships?: ReadonlyArray<IAssetRelationship>;
    readonly audit?: IAssetAuditInfo;
  }) {
    const contractVersion = normalizeOptional(params.contracts.version) ?? "1.0.0";
    const contract = createAssetContractDescriptor({
      version: contractVersion,
      input: params.contracts.input,
      output: params.contracts.output,
      parameters: params.contracts.parameters ?? Object.freeze([]),
      execution: params.contracts.execution,
    });

    if (!contract.input || !contract.output) {
      throw new Error("Data assets require explicit input and output contracts.");
    }

    super({
      id: params.id,
      name: params.name,
      version: params.version,
      kind: "dataset",
      status: params.status ?? "available",
      source: params.source,
      location: params.location,
      technicalMetadata: params.technicalMetadata,
      semanticMetadata: params.semanticMetadata,
      relationships: params.relationships,
      audit: params.audit,
    });

    this.contract = contract;
    this.config = Object.freeze({ values: normalizeConfig(params.config) });
    this.versionMetadata = normalizeVersionMetadata(params.versionMetadata, contract.version);
    this.dependencies = normalizeDependencies(params.dependencies);
    this.composableInputShapeKinds = normalizeComposableKinds(params.composableInputShapeKinds);
    this.supportsPreview = params.supportsPreview ?? true;
  }

  public abstract toCanonicalDataShape(): CanonicalDataShape;

  public getInputContract(): AssetContractShapeDescriptor {
    return this.contract.input!;
  }

  public getOutputContract(): AssetContractShapeDescriptor {
    return this.contract.output!;
  }

  public canComposeFrom(upstream: { readonly outputShapeKind: CanonicalDataShapeKind }): boolean {
    return this.composableInputShapeKinds.includes(upstream.outputShapeKind);
  }

  public inspect(): DataAssetInspection {
    const outputShape = this.toCanonicalDataShape();
    return Object.freeze({
      assetId: this.id,
      name: this.name,
      version: this.version,
      outputShapeKind: outputShape.kind,
      inputContract: this.contract.input!,
      outputContract: this.contract.output!,
      contractVersion: this.contract.version,
      schemaVersion: this.versionMetadata.schemaVersion,
      revision: this.versionMetadata.revision,
      configKeys: Object.freeze(Object.keys(this.config.values)),
      dependencies: this.dependencies,
      supportsPreview: this.supportsPreview,
      composableInputShapeKinds: this.composableInputShapeKinds,
    });
  }
}

