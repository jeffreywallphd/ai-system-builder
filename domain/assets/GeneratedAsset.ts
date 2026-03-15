import type {
  AssetKind,
  IAssetLocation,
  IAssetRelationship,
  IAssetSemanticMetadata,
  IAssetSourceInfo,
  IAssetTechnicalMetadata,
} from "./interfaces/IAsset";
import type { RuntimeEngine } from "../models/interfaces/IModelCompatibility";
import { Asset } from "./Asset";

export class GeneratedAsset extends Asset {
  constructor(params: {
    id: string;
    name: string;
    version?: string;
    kind: AssetKind;
    location: IAssetLocation;
    workflowId?: string;
    nodeId?: string;
    executionId?: string;
    parentAssetId?: string;
    runtime?: RuntimeEngine;
    provider?: string;
    technicalMetadata?: IAssetTechnicalMetadata;
    semanticMetadata?: IAssetSemanticMetadata;
    relationships?: ReadonlyArray<IAssetRelationship>;
  }) {
    const sourceType: IAssetSourceInfo["type"] = params.parentAssetId
      ? "derived"
      : "generated";

    super({
      id: params.id,
      name: params.name,
      version: params.version,
      kind: params.kind,
      status: "available",
      source: {
        type: sourceType,
        workflowId: params.workflowId,
        nodeId: params.nodeId,
        executionId: params.executionId,
        parentAssetId: params.parentAssetId,
        runtime: params.runtime,
        provider: params.provider,
      },
      location: params.location,
      technicalMetadata: params.technicalMetadata,
      semanticMetadata: params.semanticMetadata,
      relationships: params.relationships,
    });

    if (!this.source.workflowId && !this.source.nodeId && !this.source.executionId) {
      throw new Error(
        "GeneratedAsset should reference at least one of workflowId, nodeId, or executionId."
      );
    }
  }

  public override isGenerated(): boolean {
    return true;
  }

  public override isDerived(): boolean {
    return this.source.type === "derived" || !!this.source.parentAssetId;
  }

  public withDerivedFrom(parentAssetId: string): GeneratedAsset {
    return new GeneratedAsset({
      id: this.id,
      name: this.name,
      version: this.version,
      kind: this.kind,
      location: this.location,
      workflowId: this.source.workflowId,
      nodeId: this.source.nodeId,
      executionId: this.source.executionId,
      parentAssetId,
      runtime: this.source.runtime,
      provider: this.source.provider,
      technicalMetadata: this.technicalMetadata,
      semanticMetadata: this.semanticMetadata,
      relationships: this.relationships,
    });
  }

  public withGenerationContext(params: {
    workflowId?: string;
    nodeId?: string;
    executionId?: string;
    runtime?: RuntimeEngine;
    provider?: string;
  }): GeneratedAsset {
    return new GeneratedAsset({
      id: this.id,
      name: this.name,
      version: this.version,
      kind: this.kind,
      location: this.location,
      workflowId: params.workflowId ?? this.source.workflowId,
      nodeId: params.nodeId ?? this.source.nodeId,
      executionId: params.executionId ?? this.source.executionId,
      parentAssetId: this.source.parentAssetId,
      runtime: params.runtime ?? this.source.runtime,
      provider: params.provider ?? this.source.provider,
      technicalMetadata: this.technicalMetadata,
      semanticMetadata: this.semanticMetadata,
      relationships: this.relationships,
    });
  }

  public static fromGenerated(asset: Asset): GeneratedAsset {
    return new GeneratedAsset({
      id: asset.id,
      name: asset.name,
      version: asset.version,
      kind: asset.kind,
      location: asset.location,
      workflowId: asset.source.workflowId,
      nodeId: asset.source.nodeId,
      executionId: asset.source.executionId,
      parentAssetId: asset.source.parentAssetId,
      runtime: asset.source.runtime,
      provider: asset.source.provider,
      technicalMetadata: asset.technicalMetadata,
      semanticMetadata: asset.semanticMetadata,
      relationships: asset.relationships,
    });
  }
}
