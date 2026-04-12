import type {
  AtomicAssetExportResult,
  AtomicAssetImportResult,
  CompositeAssetExportResult,
  CompositeAssetImportResult,
  SystemAssetExportResult,
  SystemAssetImportResult,
} from "@application/exchange/AssetExportServices";
import type { ExchangeCatalogEntry } from "@domain/exchange/ExchangeCatalog";
import type { PublishPackageResult } from "@application/exchange/ExchangePublishWorkflow";
import type {
  ExchangeSdkCatalogEntrySummary,
  ExchangeSdkExportResult,
  ExchangeSdkImportResult,
  ExchangeSdkPackageMetadata,
  ExchangeSdkPublishResult,
} from "./PublicExchangeSdkContract";

function toSdkMetadata(entry: ExchangeCatalogEntry): ExchangeSdkPackageMetadata {
  return Object.freeze({
    title: entry.metadata.title,
    summary: entry.metadata.summary,
    tags: entry.metadata.tags,
    capabilityHints: entry.metadata.capabilityHints,
    configurationHints: entry.metadata.configurationHints,
    provenance: entry.metadata.sourceProvenance
      ? {
        origin: entry.metadata.sourceProvenance.origin,
        sourceBundleId: entry.metadata.sourceProvenance.sourceBundleProvenance?.sourceBundleId,
        sourceVersionLineage: entry.metadata.sourceProvenance.sourceBundleProvenance?.sourceVersionLineage ?? [],
        metadata: entry.metadata.sourceProvenance.metadata,
      }
      : undefined,
  });
}

export function toExchangeSdkCatalogEntrySummary(entry: ExchangeCatalogEntry): ExchangeSdkCatalogEntrySummary {
  return Object.freeze({
    catalogId: entry.catalogId.value,
    packageId: entry.packageId.value,
    identity: {
      assetId: entry.metadata.sourceRootAssetId,
      versionId: entry.metadata.sourceRootVersionId,
      subjectKind: entry.metadata.sourceRootKind,
      bundleId: entry.metadata.sourceBundleId,
      bundleFormatVersion: entry.metadata.sourceBundleVersion,
      packageId: entry.packageId.value,
      catalogEntryId: `${entry.catalogId.value}:${entry.packageId.value}`,
    },
    metadata: toSdkMetadata(entry),
    artifact: entry.storageReference,
    registeredAt: entry.registeredAt,
    updatedAt: entry.updatedAt,
  });
}

type SupportedExportResult = AtomicAssetExportResult | CompositeAssetExportResult | SystemAssetExportResult;

export function toExchangeSdkExportResult(result: Extract<SupportedExportResult, { ok: true }>): ExchangeSdkExportResult {
  return Object.freeze({
    identity: {
      assetId: result.assetId,
      versionId: result.versionId,
      subjectKind: result.subjectKind,
      bundleId: result.bundleId,
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
    },
    artifact: {
      fileName: result.artifact.fileName,
      mediaType: result.artifact.mediaType,
      byteLength: result.artifact.byteLength,
      sha256: result.artifact.sha256,
      content: result.artifact.content,
    },
    counts: {
      compositionCount: "compositionCount" in result ? result.compositionCount : undefined,
      nodeCount: "nodeCount" in result ? result.nodeCount : undefined,
    },
  });
}

type SupportedImportResult = AtomicAssetImportResult | CompositeAssetImportResult | SystemAssetImportResult;

export function toExchangeSdkImportResult(result: Extract<SupportedImportResult, { ok: true }>): ExchangeSdkImportResult {
  return Object.freeze({
    identity: {
      assetId: result.imported.assetId,
      versionId: result.imported.versionId,
      subjectKind: result.subjectKind,
      bundleId: result.imported.bundleId,
      bundleFormatVersion: "ai-loom.exchange-bundle.v1",
    },
    importedAt: result.imported.importedAt,
    existingAsset: result.imported.existingAsset,
    existingVersion: result.imported.existingVersion,
    dependencyCount: "dependencyCount" in result ? result.dependencyCount : undefined,
    counts: {
      compositionCount: "compositionCount" in result.imported ? result.imported.compositionCount : undefined,
      nodeCount: "nodeCount" in result.imported ? result.imported.nodeCount : undefined,
    },
  });
}

export function toExchangeSdkPublishResult(result: Extract<PublishPackageResult, { ok: true }>): ExchangeSdkPublishResult {
  return Object.freeze({
    identity: {
      assetId: result.catalogEntry.metadata.sourceRootAssetId,
      versionId: result.catalogEntry.metadata.sourceRootVersionId,
      subjectKind: result.catalogEntry.metadata.sourceRootKind,
      bundleId: result.catalogEntry.metadata.sourceBundleId,
      bundleFormatVersion: result.catalogEntry.metadata.sourceBundleVersion,
      packageId: result.catalogEntry.packageId.value,
      catalogEntryId: `${result.catalogEntry.catalogId.value}:${result.catalogEntry.packageId.value}`,
    },
    status: "published",
    catalog: {
      catalogId: result.catalogEntry.catalogId.value,
      registeredAt: result.catalogEntry.registeredAt,
      artifact: result.catalogEntry.storageReference,
    },
    metadata: toSdkMetadata(result.catalogEntry),
    published: {
      publishedAt: result.publishedRecord.publishedAt,
      publishedBy: result.publishedRecord.publishedBy,
      accessPolicyId: result.publishedRecord.accessPolicyId,
    },
  });
}

