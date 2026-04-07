import { AssetId } from "../../assets/AssetId";

export const ImageAssetReferenceKinds = Object.freeze({
  localFile: "local-file",
  generatedOutput: "generated-output",
  externalUri: "external-uri",
  canonicalAsset: "canonical-asset",
} as const);

export type ImageAssetReferenceKind =
  typeof ImageAssetReferenceKinds[keyof typeof ImageAssetReferenceKinds];

export interface ImageAssetReferenceBase {
  readonly kind: ImageAssetReferenceKind;
  readonly stableId: string;
  readonly sourceSystem?: string;
  readonly sourceContext?: Readonly<Record<string, string>>;
  readonly mimeTypeHint?: string;
  readonly formatHint?: string;
}

export interface LocalFileImageAssetReference extends ImageAssetReferenceBase {
  readonly kind: typeof ImageAssetReferenceKinds.localFile;
  readonly path: string;
}

export interface GeneratedOutputImageAssetReference extends ImageAssetReferenceBase {
  readonly kind: typeof ImageAssetReferenceKinds.generatedOutput;
  readonly outputId?: string;
  readonly path?: string;
}

export interface ExternalUriImageAssetReference extends ImageAssetReferenceBase {
  readonly kind: typeof ImageAssetReferenceKinds.externalUri;
  readonly uri: string;
}

export interface CanonicalAssetImageAssetReference extends ImageAssetReferenceBase {
  readonly kind: typeof ImageAssetReferenceKinds.canonicalAsset;
  readonly assetId: AssetId;
  readonly assetVersionId?: string;
}

export type ImageAssetReference =
  | LocalFileImageAssetReference
  | GeneratedOutputImageAssetReference
  | ExternalUriImageAssetReference
  | CanonicalAssetImageAssetReference;

export type ImageAssetReferenceInput =
  | string
  | {
    readonly kind?: ImageAssetReferenceKind;
    readonly stableId?: string;
    readonly path?: string;
    readonly uri?: string;
    readonly outputId?: string;
    readonly sourceSystem?: string;
    readonly sourceContext?: Readonly<Record<string, string>>;
    readonly mimeTypeHint?: string;
    readonly formatHint?: string;
    readonly assetId?: AssetId | string;
    readonly assetVersionId?: string;
  };

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeLowerOptional(value?: string): string | undefined {
  const normalized = normalizeOptional(value);
  return normalized ? normalized.toLowerCase() : undefined;
}

function normalizeSourceContext(
  sourceContext?: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> | undefined {
  if (!sourceContext) {
    return undefined;
  }

  const entries = Object.entries(sourceContext)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0);
  if (entries.length === 0) {
    return undefined;
  }

  return Object.freeze(Object.fromEntries(entries));
}

function toStableId(kind: ImageAssetReferenceKind, seed: string): string {
  const normalizedSeed = seed.trim();
  if (!normalizedSeed) {
    throw new Error("Image asset references require a non-empty stable identifier seed.");
  }
  return `${kind}:${normalizedSeed}`;
}

function inferKindFromString(input: string): ImageAssetReferenceKind {
  const normalized = input.trim();
  if (!normalized) {
    throw new Error("Image asset reference string cannot be empty.");
  }
  if (normalized.startsWith("asset:")) {
    return ImageAssetReferenceKinds.canonicalAsset;
  }
  if (/^https?:\/\//i.test(normalized)) {
    return ImageAssetReferenceKinds.externalUri;
  }
  if (normalized.includes("://")) {
    return ImageAssetReferenceKinds.generatedOutput;
  }
  return ImageAssetReferenceKinds.localFile;
}

function freezeBase<T extends ImageAssetReferenceBase>(input: T): T {
  return Object.freeze({
    ...input,
    sourceContext: normalizeSourceContext(input.sourceContext),
  });
}

export function createImageAssetReference(input: ImageAssetReferenceInput): ImageAssetReference {
  if (typeof input === "string") {
    const normalized = input.trim();
    const inferredKind = inferKindFromString(normalized);
    if (inferredKind === ImageAssetReferenceKinds.canonicalAsset) {
      return freezeBase({
        kind: ImageAssetReferenceKinds.canonicalAsset,
        stableId: toStableId(ImageAssetReferenceKinds.canonicalAsset, normalized),
        assetId: AssetId.from(normalized),
      });
    }
    if (inferredKind === ImageAssetReferenceKinds.externalUri) {
      return freezeBase({
        kind: ImageAssetReferenceKinds.externalUri,
        stableId: toStableId(ImageAssetReferenceKinds.externalUri, normalized),
        uri: normalized,
      });
    }
    if (inferredKind === ImageAssetReferenceKinds.generatedOutput) {
      return freezeBase({
        kind: ImageAssetReferenceKinds.generatedOutput,
        stableId: toStableId(ImageAssetReferenceKinds.generatedOutput, normalized),
        outputId: normalized,
      });
    }
    return freezeBase({
      kind: ImageAssetReferenceKinds.localFile,
      stableId: toStableId(ImageAssetReferenceKinds.localFile, normalized),
      path: normalized,
    });
  }

  if (input.assetId) {
    const assetId = AssetId.from(input.assetId);
    if (!assetId.toString().startsWith("asset:")) {
      throw new Error("Canonical image asset references require 'asset:' identity.");
    }
    return freezeBase({
      kind: ImageAssetReferenceKinds.canonicalAsset,
      stableId: normalizeOptional(input.stableId)
        ?? toStableId(ImageAssetReferenceKinds.canonicalAsset, assetId.toString()),
      assetId,
      assetVersionId: normalizeOptional(input.assetVersionId),
      sourceSystem: normalizeOptional(input.sourceSystem),
      sourceContext: input.sourceContext,
      mimeTypeHint: normalizeLowerOptional(input.mimeTypeHint),
      formatHint: normalizeLowerOptional(input.formatHint),
    });
  }

  const kind = input.kind
    ?? (input.uri
      ? ImageAssetReferenceKinds.externalUri
      : input.path
        ? ImageAssetReferenceKinds.localFile
        : ImageAssetReferenceKinds.generatedOutput);

  if (kind === ImageAssetReferenceKinds.externalUri) {
    const uri = normalizeOptional(input.uri);
    if (!uri) {
      throw new Error("External image asset references require a non-empty uri.");
    }
    return freezeBase({
      kind,
      stableId: normalizeOptional(input.stableId) ?? toStableId(kind, uri),
      uri,
      sourceSystem: normalizeOptional(input.sourceSystem),
      sourceContext: input.sourceContext,
      mimeTypeHint: normalizeLowerOptional(input.mimeTypeHint),
      formatHint: normalizeLowerOptional(input.formatHint),
    });
  }

  if (kind === ImageAssetReferenceKinds.localFile) {
    const path = normalizeOptional(input.path);
    if (!path) {
      throw new Error("Local-file image asset references require a non-empty path.");
    }
    return freezeBase({
      kind,
      stableId: normalizeOptional(input.stableId) ?? toStableId(kind, path),
      path,
      sourceSystem: normalizeOptional(input.sourceSystem),
      sourceContext: input.sourceContext,
      mimeTypeHint: normalizeLowerOptional(input.mimeTypeHint),
      formatHint: normalizeLowerOptional(input.formatHint),
    });
  }

  if (kind === ImageAssetReferenceKinds.canonicalAsset) {
    throw new Error("Canonical image asset references require assetId.");
  }

  const outputId = normalizeOptional(input.outputId);
  const path = normalizeOptional(input.path);
  if (!outputId && !path) {
    throw new Error("Generated image asset references require outputId or path.");
  }
  const stableSeed = outputId ?? path ?? "generated";
  return freezeBase({
    kind: ImageAssetReferenceKinds.generatedOutput,
    stableId: normalizeOptional(input.stableId)
      ?? toStableId(ImageAssetReferenceKinds.generatedOutput, stableSeed),
    outputId,
    path,
    sourceSystem: normalizeOptional(input.sourceSystem),
    sourceContext: input.sourceContext,
    mimeTypeHint: normalizeLowerOptional(input.mimeTypeHint),
    formatHint: normalizeLowerOptional(input.formatHint),
  });
}
