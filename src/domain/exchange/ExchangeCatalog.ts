import {
  PublishablePackageId,
  type PublishablePackage,
  type PublishablePackageProvenance,
} from "./PublishablePackage";

export class ExchangeCatalogId {
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static from(value: string): ExchangeCatalogId {
    const normalized = value.trim();
    if (!normalized) {
      throw new Error("ExchangeCatalogId cannot be empty.");
    }
    return new ExchangeCatalogId(normalized);
  }
}

export interface ExchangeCatalog {
  readonly catalogId: ExchangeCatalogId;
  readonly label?: string;
  readonly description?: string;
  readonly kind: "local" | "shared" | "remote";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExchangeCatalogStorageReference {
  readonly storageKind: "local-file" | "local-directory" | "opaque";
  readonly location: string;
  readonly mediaType?: string;
  readonly byteLength?: number;
  readonly sha256?: string;
}

export interface ExchangeCatalogEntryMetadata {
  readonly title?: string;
  readonly summary?: string;
  readonly tags: ReadonlyArray<string>;
  readonly capabilityHints: ReadonlyArray<string>;
  readonly configurationHints?: Readonly<Record<string, unknown>>;
  readonly sourceBundleId: string;
  readonly sourceBundleVersion: string;
  readonly sourceRootAssetId: string;
  readonly sourceRootVersionId: string;
  readonly sourceRootKind: PublishablePackage["source"]["rootSubject"]["kind"];
  readonly sourceProvenance?: PublishablePackageProvenance;
}

export interface ExchangeCatalogEntry {
  readonly catalogId: ExchangeCatalogId;
  readonly packageId: PublishablePackageId;
  readonly package: PublishablePackage;
  readonly metadata: ExchangeCatalogEntryMetadata;
  readonly storageReference: ExchangeCatalogStorageReference;
  readonly registeredAt: string;
  readonly updatedAt: string;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringArray(values?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...(values ?? [])]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry, index, source) => source.indexOf(entry) === index)
    .sort((left, right) => left.localeCompare(right)));
}

function normalizeRecord(record?: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | undefined {
  if (!record) {
    return undefined;
  }
  return Object.freeze(JSON.parse(JSON.stringify(record)) as Record<string, unknown>);
}

function normalizeStorageReference(input: ExchangeCatalogStorageReference): ExchangeCatalogStorageReference {
  const location = input.location.trim();
  if (!location) {
    throw new Error("Exchange catalog storage reference location is required.");
  }

  return Object.freeze({
    storageKind: input.storageKind,
    location,
    mediaType: normalizeOptional(input.mediaType),
    byteLength: typeof input.byteLength === "number" && Number.isFinite(input.byteLength)
      ? Math.max(0, Math.floor(input.byteLength))
      : undefined,
    sha256: normalizeOptional(input.sha256),
  });
}

export function createExchangeCatalogEntry(input: {
  readonly catalogId: string;
  readonly package: PublishablePackage;
  readonly storageReference: ExchangeCatalogStorageReference;
  readonly metadata?: Partial<Omit<ExchangeCatalogEntryMetadata, "sourceBundleId" | "sourceBundleVersion" | "sourceRootAssetId" | "sourceRootVersionId" | "sourceRootKind" | "sourceProvenance">>;
  readonly registeredAt?: string;
  readonly updatedAt?: string;
}): ExchangeCatalogEntry {
  const packageId = PublishablePackageId.from(input.package.packageId.value);
  const registeredAt = normalizeOptional(input.registeredAt) ?? new Date().toISOString();
  const updatedAt = normalizeOptional(input.updatedAt) ?? registeredAt;

  return Object.freeze({
    catalogId: ExchangeCatalogId.from(input.catalogId),
    packageId,
    package: input.package,
    metadata: Object.freeze({
      title: normalizeOptional(input.metadata?.title) ?? input.package.metadata.label,
      summary: normalizeOptional(input.metadata?.summary) ?? input.package.metadata.summary,
      tags: normalizeStringArray(input.metadata?.tags ?? input.package.metadata.tags),
      capabilityHints: normalizeStringArray(input.metadata?.capabilityHints ?? input.package.metadata.capabilityHints),
      configurationHints: normalizeRecord(input.metadata?.configurationHints ?? input.package.metadata.configurationHints),
      sourceBundleId: input.package.source.bundleId.value,
      sourceBundleVersion: input.package.source.bundleFormatVersion.value,
      sourceRootAssetId: input.package.source.rootSubject.assetId,
      sourceRootVersionId: input.package.source.rootSubject.versionId,
      sourceRootKind: input.package.source.rootSubject.kind,
      sourceProvenance: input.package.provenance,
    }),
    storageReference: normalizeStorageReference(input.storageReference),
    registeredAt,
    updatedAt,
  });
}
