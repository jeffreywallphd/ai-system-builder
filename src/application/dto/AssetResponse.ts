import type {
  AssetKind,
  AssetLifecycleStatus,
  AssetSourceType,
} from "../../domain/assets/interfaces/IAsset";

export interface AssetResponse {
  readonly id: string;
  readonly name: string;
  readonly version?: string;
  readonly kind: AssetKind;
  readonly status: AssetLifecycleStatus;

  readonly source: {
    readonly type: AssetSourceType;
    readonly workflowId?: string;
    readonly nodeId?: string;
    readonly executionId?: string;
    readonly parentAssetId?: string;
    readonly runtime?: string;
    readonly provider?: string;
  };

  readonly location: {
    readonly accessMethod: string;
    readonly location?: string;
    readonly format?: string;
    readonly contentType?: string;
  };

  readonly technicalMetadata?: {
    readonly sizeBytes?: number;
    readonly sha256?: string;
    readonly width?: number;
    readonly height?: number;
    readonly durationMs?: number;
    readonly sampleRateHz?: number;
    readonly channels?: number;
    readonly frameRate?: number;
    readonly tokenCount?: number;
    readonly itemCount?: number;
  };

  readonly semanticMetadata?: {
    readonly description?: string;
    readonly tags?: ReadonlyArray<string>;
    readonly languageCodes?: ReadonlyArray<string>;
    readonly attributes?: Readonly<
      Record<string, string | number | boolean | null>
    >;
  };

  readonly relationships: ReadonlyArray<{
    readonly assetId: string;
    readonly kind: string;
  }>;

  readonly audit?: {
    readonly createdAt?: string;
    readonly updatedAt?: string;
  };

  readonly isAvailable: boolean;
  readonly isGenerated: boolean;
  readonly isDerived: boolean;
  readonly reference: string;
}
