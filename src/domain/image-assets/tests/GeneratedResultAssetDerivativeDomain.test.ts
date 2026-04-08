import { describe, expect, it } from "bun:test";
import {
  GeneratedResultAssetDerivativeDomainError,
  GeneratedResultDerivativeAvailabilityStatuses,
  GeneratedResultDerivativeKinds,
  GeneratedResultDerivativePresentationRoles,
  createPendingGeneratedResultAssetDerivativeDescriptor,
  rehydrateGeneratedResultAssetDerivativeCatalog,
  rehydrateGeneratedResultAssetDerivativeDescriptor,
} from "../GeneratedResultAssetDerivativeDomain";

describe("GeneratedResultAssetDerivativeDomain", () => {
  it("creates deferred pending preview descriptors without access handles", () => {
    const derivative = createPendingGeneratedResultAssetDerivativeDescriptor({
      derivativeId: "preview-thumbnail-001",
      resultAssetId: "asset-generated-result-001",
      resultLogicalAssetVersionId: "asset-generated-result-001:v1",
      presentationRole: GeneratedResultDerivativePresentationRoles.preview,
      derivativeKind: GeneratedResultDerivativeKinds.thumbnail,
      previewKind: "thumbnail",
      isPrimaryPreview: true,
      label: "Thumbnail",
      requestedBy: "system-preview-service",
      requestedAt: "2026-04-08T14:05:00.000Z",
      generationMode: "deferred",
      generationRevision: 1,
      sourceResultVersionId: "asset-generated-result-001:v1",
    });

    expect(derivative.derivativeId).toBe("preview-thumbnail-001");
    expect(derivative.resultAssetId).toBe("asset-generated-result-001");
    expect(derivative.access).toBeUndefined();
    expect(derivative.availability.status).toBe(GeneratedResultDerivativeAvailabilityStatuses.pending);
    expect(derivative.availability.generationMode).toBe("deferred");
  });

  it("rehydrates available display-safe previews with protected access descriptors", () => {
    const derivative = rehydrateGeneratedResultAssetDerivativeDescriptor({
      derivativeId: "preview-display-safe-001",
      resultAssetId: "asset-generated-result-001",
      resultLogicalAssetVersionId: "asset-generated-result-001:v1",
      presentationRole: GeneratedResultDerivativePresentationRoles.preview,
      derivativeKind: GeneratedResultDerivativeKinds.displaySafe,
      previewKind: "display-safe",
      isPrimaryPreview: true,
      label: "Gallery display-safe",
      dimensions: {
        width: 2048,
        height: 2048,
      },
      access: {
        protectedResourceId: "protected-resource://asset-generated-result-001-preview-display-safe",
        accessHandle: "preview-access://workspace-alpha/gallery/preview-display-safe-001",
        mediaType: "image/jpeg",
        byteSize: 182_331,
      },
      availability: {
        status: GeneratedResultDerivativeAvailabilityStatuses.available,
        generationMode: "on-demand",
        generationRevision: 2,
        requestedAt: "2026-04-08T14:05:00.000Z",
        requestedBy: "system-preview-service",
        generatedAt: "2026-04-08T14:05:02.000Z",
        generatedBy: "system-preview-service",
        sourceResultVersionId: "asset-generated-result-001:v1",
      },
      attributes: {
        qualityProfile: "display-safe-default",
      },
    });

    expect(derivative.availability.status).toBe(GeneratedResultDerivativeAvailabilityStatuses.available);
    expect(derivative.access?.protectedResourceId).toContain("protected-resource://");
    expect(derivative.previewKind).toBe("display-safe");
  });

  it("supports stale derivatives for regeneration-ready previews", () => {
    const derivative = rehydrateGeneratedResultAssetDerivativeDescriptor({
      derivativeId: "preview-history-safe-001",
      resultAssetId: "asset-generated-result-001",
      presentationRole: GeneratedResultDerivativePresentationRoles.preview,
      derivativeKind: GeneratedResultDerivativeKinds.historySafe,
      previewKind: "history-safe",
      access: {
        protectedResourceId: "protected-resource://asset-generated-result-001-preview-history-safe",
        accessHandle: "preview-access://workspace-alpha/history/preview-history-safe-001",
        mediaType: "image/jpeg",
      },
      availability: {
        status: GeneratedResultDerivativeAvailabilityStatuses.stale,
        generationMode: "eager",
        generationRevision: 3,
        requestedAt: "2026-04-08T14:05:00.000Z",
        requestedBy: "system-preview-service",
        generatedAt: "2026-04-08T14:05:03.000Z",
        generatedBy: "system-preview-service",
        refreshedAt: "2026-04-08T14:10:00.000Z",
        refreshedBy: "system-preview-service",
      },
    });

    expect(derivative.availability.status).toBe(GeneratedResultDerivativeAvailabilityStatuses.stale);
    expect(derivative.availability.generationRevision).toBe(3);
  });

  it("rejects preview contracts that leak raw storage references", () => {
    expect(() => rehydrateGeneratedResultAssetDerivativeDescriptor({
      derivativeId: "preview-storage-leak-001",
      resultAssetId: "asset-generated-result-001",
      presentationRole: GeneratedResultDerivativePresentationRoles.preview,
      derivativeKind: GeneratedResultDerivativeKinds.thumbnail,
      previewKind: "thumbnail",
      access: {
        protectedResourceId: "protected-resource://asset-generated-result-001-preview-thumbnail",
        accessHandle: "storage-instance://storage-alpha/output/preview-thumbnail-001.jpg",
        mediaType: "image/jpeg",
      },
      availability: {
        status: GeneratedResultDerivativeAvailabilityStatuses.available,
        generationMode: "on-demand",
        generationRevision: 1,
        requestedAt: "2026-04-08T14:05:00.000Z",
        requestedBy: "system-preview-service",
        generatedAt: "2026-04-08T14:05:02.000Z",
        generatedBy: "system-preview-service",
      },
    })).toThrow("cannot expose storage-instance references");
  });

  it("rejects pending and failed descriptors that include access", () => {
    expect(() => rehydrateGeneratedResultAssetDerivativeDescriptor({
      derivativeId: "preview-pending-with-access-001",
      resultAssetId: "asset-generated-result-001",
      presentationRole: GeneratedResultDerivativePresentationRoles.preview,
      derivativeKind: GeneratedResultDerivativeKinds.thumbnail,
      previewKind: "thumbnail",
      access: {
        protectedResourceId: "protected-resource://asset-generated-result-001-preview-thumbnail",
        accessHandle: "preview-access://workspace-alpha/gallery/preview-thumbnail-001",
        mediaType: "image/jpeg",
      },
      availability: {
        status: GeneratedResultDerivativeAvailabilityStatuses.pending,
        generationMode: "deferred",
        generationRevision: 1,
        requestedAt: "2026-04-08T14:05:00.000Z",
        requestedBy: "system-preview-service",
      },
    })).toThrow(GeneratedResultAssetDerivativeDomainError);

    expect(() => rehydrateGeneratedResultAssetDerivativeDescriptor({
      derivativeId: "preview-failed-with-access-001",
      resultAssetId: "asset-generated-result-001",
      presentationRole: GeneratedResultDerivativePresentationRoles.preview,
      derivativeKind: GeneratedResultDerivativeKinds.thumbnail,
      previewKind: "thumbnail",
      access: {
        protectedResourceId: "protected-resource://asset-generated-result-001-preview-thumbnail",
        accessHandle: "preview-access://workspace-alpha/gallery/preview-thumbnail-001",
        mediaType: "image/jpeg",
      },
      availability: {
        status: GeneratedResultDerivativeAvailabilityStatuses.failed,
        generationMode: "on-demand",
        generationRevision: 1,
        requestedAt: "2026-04-08T14:05:00.000Z",
        requestedBy: "system-preview-service",
        failedAt: "2026-04-08T14:05:01.000Z",
        failedBy: "system-preview-service",
        failureCode: "preview-render-failed",
        failureMessage: "The preview renderer returned an error.",
      },
    })).toThrow(GeneratedResultAssetDerivativeDomainError);
  });

  it("requires preview role descriptors to include matching preview kinds", () => {
    expect(() => rehydrateGeneratedResultAssetDerivativeDescriptor({
      derivativeId: "preview-kind-missing-001",
      resultAssetId: "asset-generated-result-001",
      presentationRole: GeneratedResultDerivativePresentationRoles.preview,
      derivativeKind: GeneratedResultDerivativeKinds.displaySafe,
      availability: {
        status: GeneratedResultDerivativeAvailabilityStatuses.pending,
        generationMode: "deferred",
        generationRevision: 1,
        requestedAt: "2026-04-08T14:05:00.000Z",
        requestedBy: "system-preview-service",
      },
    })).toThrow("require previewKind");

    expect(() => rehydrateGeneratedResultAssetDerivativeDescriptor({
      derivativeId: "preview-kind-mismatch-001",
      resultAssetId: "asset-generated-result-001",
      presentationRole: GeneratedResultDerivativePresentationRoles.preview,
      derivativeKind: GeneratedResultDerivativeKinds.thumbnail,
      previewKind: "display-safe",
      availability: {
        status: GeneratedResultDerivativeAvailabilityStatuses.pending,
        generationMode: "deferred",
        generationRevision: 1,
        requestedAt: "2026-04-08T14:05:00.000Z",
        requestedBy: "system-preview-service",
      },
    })).toThrow("match previewKind");
  });

  it("enforces descriptor-to-result mapping and uniqueness in derivative catalogs", () => {
    const descriptor = createPendingGeneratedResultAssetDerivativeDescriptor({
      derivativeId: "preview-thumbnail-001",
      resultAssetId: "asset-generated-result-001",
      presentationRole: GeneratedResultDerivativePresentationRoles.preview,
      derivativeKind: GeneratedResultDerivativeKinds.thumbnail,
      previewKind: "thumbnail",
      requestedBy: "system-preview-service",
      requestedAt: "2026-04-08T14:05:00.000Z",
    });

    const catalog = rehydrateGeneratedResultAssetDerivativeCatalog({
      resultAssetId: "asset-generated-result-001",
      descriptors: [descriptor],
      updatedAt: "2026-04-08T14:05:05.000Z",
      updatedBy: "system-preview-service",
    });

    expect(catalog.resultAssetId).toBe("asset-generated-result-001");
    expect(catalog.descriptors).toHaveLength(1);

    expect(() => rehydrateGeneratedResultAssetDerivativeCatalog({
      resultAssetId: "asset-generated-result-002",
      descriptors: [descriptor],
      updatedAt: "2026-04-08T14:05:05.000Z",
      updatedBy: "system-preview-service",
    })).toThrow("must match catalog resultAssetId");
  });
});
