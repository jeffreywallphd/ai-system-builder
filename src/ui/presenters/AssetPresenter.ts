import type { IAsset } from "@domain/assets/interfaces/IAsset";
import type { AssetResponse } from "@application/dto/AssetResponse";
import { formatBytes, toTitleCase } from "./PresenterFormatting";

export interface AssetListItemViewModel {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly kind: string;
  readonly status: string;
  readonly format?: string;
  readonly location?: string;
  readonly sizeLabel?: string;
  readonly durationLabel?: string;
  readonly dimensionsLabel?: string;
  readonly tags: ReadonlyArray<string>;
  readonly workflowId?: string;
  readonly nodeId?: string;
  readonly isAvailable: boolean;
  readonly isGenerated: boolean;
  readonly isDerived: boolean;
  readonly reference: string;
}

export interface AssetDetailViewModel extends AssetResponse {
  readonly statusLabel: string;
  readonly sourceLabel: string;
  readonly sizeLabel?: string;
  readonly durationLabel?: string;
  readonly dimensionsLabel?: string;
  readonly createdAtLabel?: string;
  readonly updatedAtLabel?: string;
}

export class AssetPresenter {
  public present(asset: IAsset): AssetDetailViewModel {
    const response = this.toResponse(asset);

    return Object.freeze({
      ...response,
      statusLabel: toTitleCase(response.status),
      sourceLabel: this.buildSourceLabel(asset),
      sizeLabel: formatBytes(asset.technicalMetadata?.sizeBytes),
      durationLabel: this.formatDuration(asset.technicalMetadata?.durationMs),
      dimensionsLabel: this.formatDimensions(
        asset.technicalMetadata?.width,
        asset.technicalMetadata?.height
      ),
      createdAtLabel: this.formatDate(asset.audit?.createdAt),
      updatedAtLabel: this.formatDate(asset.audit?.updatedAt),
    });
  }

  public presentList(assets: ReadonlyArray<IAsset>): ReadonlyArray<AssetListItemViewModel> {
    return Object.freeze(assets.map((asset) => this.presentListItem(asset)));
  }

  public presentListItem(asset: IAsset): AssetListItemViewModel {
    return Object.freeze({
      id: asset.id,
      title: asset.name,
      subtitle: this.buildSubtitle(asset),
      kind: toTitleCase(asset.kind),
      status: toTitleCase(asset.status),
      format: asset.location.format,
      location: asset.location.location,
      sizeLabel: formatBytes(asset.technicalMetadata?.sizeBytes),
      durationLabel: this.formatDuration(asset.technicalMetadata?.durationMs),
      dimensionsLabel: this.formatDimensions(
        asset.technicalMetadata?.width,
        asset.technicalMetadata?.height
      ),
      tags: Object.freeze([...(asset.semanticMetadata?.tags ?? [])]),
      workflowId: asset.source.workflowId,
      nodeId: asset.source.nodeId,
      isAvailable: asset.isAvailable(),
      isGenerated: asset.isGenerated(),
      isDerived: asset.isDerived(),
      reference: asset.toReferenceString(),
    });
  }

  public toResponse(asset: IAsset): AssetResponse {
    return Object.freeze({
      id: asset.id,
      name: asset.name,
      version: asset.version,
      kind: asset.kind,
      status: asset.status,
      source: Object.freeze({
        type: asset.source.type,
        workflowId: asset.source.workflowId,
        nodeId: asset.source.nodeId,
        executionId: asset.source.executionId,
        parentAssetId: asset.source.parentAssetId,
        runtime: asset.source.runtime,
        provider: asset.source.provider,
      }),
      location: Object.freeze({
        accessMethod: asset.location.accessMethod,
        location: asset.location.location,
        format: asset.location.format,
        contentType: asset.location.contentType,
      }),
      technicalMetadata: asset.technicalMetadata
        ? Object.freeze({
            sizeBytes: asset.technicalMetadata.sizeBytes,
            sha256: asset.technicalMetadata.sha256,
            width: asset.technicalMetadata.width,
            height: asset.technicalMetadata.height,
            durationMs: asset.technicalMetadata.durationMs,
            sampleRateHz: asset.technicalMetadata.sampleRateHz,
            channels: asset.technicalMetadata.channels,
            frameRate: asset.technicalMetadata.frameRate,
            tokenCount: asset.technicalMetadata.tokenCount,
            itemCount: asset.technicalMetadata.itemCount,
          })
        : undefined,
      semanticMetadata: asset.semanticMetadata
        ? Object.freeze({
            description: asset.semanticMetadata.description,
            tags: Object.freeze([...(asset.semanticMetadata.tags ?? [])]),
            languageCodes: Object.freeze([...(asset.semanticMetadata.languageCodes ?? [])]),
            attributes: asset.semanticMetadata.attributes
              ? Object.freeze({ ...asset.semanticMetadata.attributes })
              : undefined,
          })
        : undefined,
      relationships: Object.freeze(
        asset.relationships.map((relationship) =>
          Object.freeze({
            assetId: relationship.assetId,
            kind: relationship.kind,
          })
        )
      ),
      audit: asset.audit
        ? Object.freeze({
            createdAt: asset.audit.createdAt?.toISOString(),
            updatedAt: asset.audit.updatedAt?.toISOString(),
          })
        : undefined,
      isAvailable: asset.isAvailable(),
      isGenerated: asset.isGenerated(),
      isDerived: asset.isDerived(),
      reference: asset.toReferenceString(),
    });
  }

  private buildSubtitle(asset: IAsset): string | undefined {
    const parts: string[] = [];

    if (asset.location.format) {
      parts.push(asset.location.format.toUpperCase());
    }

    const sourceLabel = this.buildSourceLabel(asset);
    if (sourceLabel) {
      parts.push(sourceLabel);
    }

    return parts.length > 0 ? parts.join(" â€¢ ") : undefined;
  }

  private buildSourceLabel(asset: IAsset): string {
    if (asset.source.provider?.trim()) {
      return asset.source.provider.trim();
    }

    return toTitleCase(asset.source.type);
  }

  private formatDuration(durationMs?: number): string | undefined {
    if (durationMs === undefined || durationMs < 0) {
      return undefined;
    }

    const totalSeconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
      return `${minutes}:${String(seconds).padStart(2, "0")}`;
    }

    return `${seconds}s`;
  }

  private formatDimensions(width?: number, height?: number): string | undefined {
    if (width === undefined || height === undefined) {
      return undefined;
    }

    return `${width} Ã— ${height}`;
  }

  private formatDate(value?: Date): string | undefined {
    if (!value) {
      return undefined;
    }

    return value.toLocaleString();
  }
}

