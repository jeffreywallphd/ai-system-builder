import type { CanonicalDataShapeKind } from "../../domain/dataset-studio/CanonicalDataShapes";
import type { DatasetSchemaIntentId } from "../../domain/dataset-studio/schema-intents/DatasetSchemaIntent";
import type { DataAssetRegistry } from "../dataset-studio/DataAssetRegistry";

export interface DatasetInstanceAssetDefinition {
  readonly assetId: string;
  readonly versionId?: string;
  readonly schemaIntentId: DatasetSchemaIntentId;
  readonly outputShapeKind: CanonicalDataShapeKind;
}

export interface DatasetInstanceAssetCatalog {
  resolveAsset(input: {
    readonly assetId: string;
    readonly versionId?: string;
  }): DatasetInstanceAssetDefinition | undefined;
}

export class DataAssetRegistryDatasetInstanceAssetCatalog implements DatasetInstanceAssetCatalog {
  public constructor(private readonly registry: DataAssetRegistry) {}

  public resolveAsset(input: {
    readonly assetId: string;
    readonly versionId?: string;
  }): DatasetInstanceAssetDefinition | undefined {
    const assetId = input.assetId.trim();
    if (!assetId) {
      return undefined;
    }

    const entry = this.registry.get({
      assetId,
      versionId: input.versionId?.trim(),
    });
    if (!entry) {
      return undefined;
    }

    return Object.freeze({
      assetId: entry.descriptor.assetId,
      versionId: entry.descriptor.versionId,
      schemaIntentId: entry.descriptor.schemaIntent.id,
      outputShapeKind: entry.descriptor.outputShapeKind,
    });
  }
}
