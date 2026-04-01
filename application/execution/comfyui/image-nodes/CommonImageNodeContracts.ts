export const CommonImageNodeKinds = Object.freeze([
  "load-image",
  "save-image",
  "model-loader",
  "prompt-input",
  "sampler-wrapper",
  "resize-upscale",
  "vae-encode",
  "vae-decode",
] as const);

export type CommonImageNodeKind = (typeof CommonImageNodeKinds)[number];

export interface IImageNodeAssetReference {
  readonly assetId: string;
  readonly versionId?: string;
  readonly role?: string;
}

export interface ICommonImageNodeInternalImage {
  readonly buffer: Uint8Array;
  readonly mimeType?: string;
  readonly format?: string;
  readonly width?: number;
  readonly height?: number;
  readonly filename?: string;
}

export interface ICommonImageNodeDatasetSelection {
  readonly recordId?: string;
  readonly index?: number;
  readonly strategy?: "latest" | "index" | "random";
}

export type ImageNodeDataType =
  | "image"
  | "latent"
  | "model"
  | "text"
  | "conditioning"
  | "numeric"
  | "boolean"
  | "path"
  | "asset-reference"
  | "metadata"
  | "generic";

export interface IImageNodeInputSpec {
  readonly id: string;
  readonly type: ImageNodeDataType;
  readonly required: boolean;
  readonly inspectable?: boolean;
  readonly previewable?: boolean;
  readonly description?: string;
}

export interface IImageNodeOutputSpec {
  readonly id: string;
  readonly type: ImageNodeDataType;
  readonly inspectable?: boolean;
  readonly previewable?: boolean;
  readonly versioned?: boolean;
  readonly description?: string;
}

export interface IImageNodeConfigSpecField {
  readonly id: string;
  readonly type: "string" | "number" | "boolean" | "enum" | "object";
  readonly required?: boolean;
  readonly defaultValue?: unknown;
  readonly description?: string;
  readonly options?: ReadonlyArray<string>;
}

export interface IImageNodeConfigContract {
  readonly version: string;
  readonly fields: ReadonlyArray<IImageNodeConfigSpecField>;
}

export interface IImageNodeIdentity {
  readonly id: string;
  readonly kind: CommonImageNodeKind;
  readonly version: string;
  readonly displayName: string;
}

export interface IImageNodeCapabilities {
  readonly composable: boolean;
  readonly inspectable: boolean;
  readonly previewable: boolean;
  readonly versionedInputs: boolean;
  readonly deterministicByDefault: boolean;
}

export interface IImageNodeExecutionRequest {
  readonly nodeId: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly consumedAssets?: ReadonlyArray<IImageNodeAssetReference>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IImageNodeExecutionOutput {
  readonly outputId: string;
  readonly value: unknown;
  readonly assetRef?: IImageNodeAssetReference;
  readonly preview?: Readonly<Record<string, unknown>>;
  readonly inspection?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IImageNodeExecutionError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly category?: "validation" | "execution" | "transport" | "unknown";
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IImageNodeExecutionResponse {
  readonly nodeId: string;
  readonly status: "completed" | "failed";
  readonly outputs: ReadonlyArray<IImageNodeExecutionOutput>;
  readonly error?: IImageNodeExecutionError;
  readonly inspection?: Readonly<{
    readonly durationMs?: number;
    readonly diagnostics?: Readonly<Record<string, unknown>>;
  }>;
}

export interface IImageNodeInspectionMetadata {
  readonly tags?: ReadonlyArray<string>;
  readonly summary?: Readonly<Record<string, unknown>>;
  readonly diagnostics?: Readonly<Record<string, unknown>>;
}

export interface ICommonImageNodeContract {
  readonly identity: IImageNodeIdentity;
  readonly capabilities: IImageNodeCapabilities;
  readonly inputContract: ReadonlyArray<IImageNodeInputSpec>;
  readonly outputContract: ReadonlyArray<IImageNodeOutputSpec>;
  readonly configContract: IImageNodeConfigContract;
  readonly inspection?: IImageNodeInspectionMetadata;
}
