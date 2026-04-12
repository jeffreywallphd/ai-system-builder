import { describe, expect, it } from "bun:test";
import {
  ImageAssetFingerprintAlgorithms,
  ImageAssetOriginKinds,
  ImageAssetStatuses,
  SupportedImageMediaTypes,
} from "@domain/image-assets/ImageAssetDomain";
import { ResourceVisibilities, SharingPolicyModes } from "@domain/authorization/AuthorizationDomain";
import { ImageAssetStorageObjectAreas } from "@application/image-assets/ports/ImageAssetStoragePort";
import { ImageAssetManagementBackendApi } from "../ImageAssetManagementBackendApi";
import { ImageAssetManagementObservability } from "../ImageAssetManagementObservability";
import type { ImageAssetManagementObservabilityLogEvent, ImageAssetManagementObservabilityLogger } from "../ImageAssetManagementObservability";
import type {
  IRuntimeSecurityMaterialResolverPort,
  ResolveServerProviderCredentialMaterialInput,
  ResolveServerSigningMaterialInput,
  ResolveUserProviderCredentialMaterialInput,
  ResolveWorkspaceProviderCredentialMaterialInput,
  ResolvedSecurityMaterialCredential,
} from "@application/security/ports/SecurityMaterialResolutionPorts";
import type { SecretServiceResult } from "@application/security/use-cases/SecretManagementServiceContracts";

const baseAsset = Object.freeze({
  assetId: "image-asset:001",
  workspaceId: "workspace-alpha",
  ownerUserId: "user-owner",
  originKind: ImageAssetOriginKinds.uploadedSource,
  mediaType: SupportedImageMediaTypes[0],
  originalFilename: "image.png",
  normalizedFilename: "image.png",
  sizeBytes: 4,
  fingerprint: Object.freeze({
    algorithm: ImageAssetFingerprintAlgorithms.sha256,
    digest: "a".repeat(64),
  }),
  visibility: ResourceVisibilities.private,
  sharingPolicy: Object.freeze({
    mode: SharingPolicyModes.ownerOnly,
  }),
  storage: Object.freeze({
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/image-assets",
  }),
  lifecycle: Object.freeze({
    status: ImageAssetStatuses.ingesting,
  }),
  createdBy: "user-owner",
  lastModifiedBy: "user-owner",
  createdAt: "2026-04-08T10:00:00.000Z",
  updatedAt: "2026-04-08T10:00:00.000Z",
});

describe("ImageAssetManagementBackendApi", () => {
  class CapturingLogger implements ImageAssetManagementObservabilityLogger {
    public readonly infoEvents: ImageAssetManagementObservabilityLogEvent[] = [];
    public readonly warnEvents: ImageAssetManagementObservabilityLogEvent[] = [];
    public readonly errorEvents: ImageAssetManagementObservabilityLogEvent[] = [];

    public info(event: ImageAssetManagementObservabilityLogEvent): void {
      this.infoEvents.push(event);
    }

    public warn(event: ImageAssetManagementObservabilityLogEvent): void {
      this.warnEvents.push(event);
    }

    public error(event: ImageAssetManagementObservabilityLogEvent): void {
      this.errorEvents.push(event);
    }
  }

  class MutableClock {
    public constructor(private nowValue: Date) {}

    public now(): Date {
      return new Date(this.nowValue);
    }

    public setNow(value: string): void {
      this.nowValue = new Date(value);
    }
  }

  class StubRuntimeSecurityMaterialResolver implements IRuntimeSecurityMaterialResolverPort {
    private activeSigningVersionId = "secret:server:image-upload-session-token:v1";
    private readonly signingMaterialByVersion = new Map<string, string>([
      ["secret:server:image-upload-session-token:v1", "upload-token-signing-secret-v1"],
      ["secret:server:image-upload-session-token:v2", "upload-token-signing-secret-v2"],
    ]);

    public setActiveSigningVersion(versionId: string): void {
      this.activeSigningVersionId = versionId;
    }

    public async resolveServerProviderCredential(
      _input: ResolveServerProviderCredentialMaterialInput,
    ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>> {
      throw new Error("not used");
    }

    public async resolveIdentitySessionSigningMaterial(
      input: ResolveServerSigningMaterialInput,
    ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>> {
      return this.resolveServerSigningMaterial(input);
    }

    public async resolveServerSigningMaterial(
      input: ResolveServerSigningMaterialInput,
    ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>> {
      const requestedVersionId = input.versionId?.trim() || this.activeSigningVersionId;
      const credential = this.signingMaterialByVersion.get(requestedVersionId);
      if (!credential) {
        return {
          ok: false,
          error: {
            code: "secret-not-found",
            message: `Missing signing material for '${requestedVersionId}'.`,
          },
        };
      }

      return {
        ok: true,
        value: {
          secretId: input.secretId,
          currentVersionId: this.activeSigningVersionId,
          credential,
        },
      };
    }

    public async resolveWorkspaceProviderCredential(
      _input: ResolveWorkspaceProviderCredentialMaterialInput,
    ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>> {
      throw new Error("not used");
    }

    public async resolveUserProviderCredential(
      _input: ResolveUserProviderCredentialMaterialInput,
    ): Promise<SecretServiceResult<ResolvedSecurityMaterialCredential>> {
      throw new Error("not used");
    }
  }

  it("creates, ingests upload content, finalizes upload, gets detail, and lists assets", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: baseAsset,
              upload: Object.freeze({
                status: "upload-pending" as const,
                reservation: Object.freeze({
                  reservationId: "reservation-001",
                  reference: Object.freeze({
                    storageInstanceId: "storage-alpha",
                    objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                    area: ImageAssetStorageObjectAreas.original,
                  }),
                  expiresAt: "2026-04-08T10:20:00.000Z",
                }),
              }),
            }),
          };
        },
      },
      finalizeImageAssetUploadUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: Object.freeze({
                ...baseAsset,
                lifecycle: Object.freeze({
                  status: ImageAssetStatuses.available,
                  ingestedAt: "2026-04-08T10:05:00.000Z",
                }),
              }),
              upload: Object.freeze({
                status: "finalized" as const,
                reference: Object.freeze({
                  storageInstanceId: "storage-alpha",
                  objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                  area: ImageAssetStorageObjectAreas.original,
                }),
                finalizedAt: "2026-04-08T10:05:00.000Z",
                observedSizeBytes: 4,
                observedChecksumSha256: "b".repeat(64),
              }),
            }),
          };
        },
      },
      getImageAssetMetadataUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              asset: baseAsset,
            }),
          };
        },
      },
      listImageAssetMetadataUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              items: Object.freeze([baseAsset]),
              pagination: Object.freeze({
                limit: 25,
                offset: 0,
                returned: 1,
                hasMore: false,
              }),
            }),
          };
        },
      },
      getImageAssetOriginalContentUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              assetId: "image-asset:001",
              workspaceId: "workspace-alpha",
              mediaType: "image/png" as const,
              sizeBytes: 4,
              contentDisposition: "attachment" as const,
              contentDispositionFileName: "image.png",
              stream: (async function* bytes() {
                yield new Uint8Array([1, 2, 3, 4]);
              })(),
            }),
          };
        },
      },
      requestImageAssetPreviewContentUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              assetId: "image-asset:001",
              workspaceId: "workspace-alpha",
              representation: "gallery" as const,
              status: "available" as const,
              mediaType: "image/png" as const,
              resolvedFrom: "original-fallback" as const,
              access: Object.freeze({
                previewToken: "preview-token-001",
                expiresAt: "2026-04-08T10:10:00.000Z",
              }),
            }),
          };
        },
      },
      openImageAssetPreviewContentUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              assetId: "image-asset:001",
              workspaceId: "workspace-alpha",
              mediaType: "image/png" as const,
              sizeBytes: 4,
              contentDisposition: "inline" as const,
              contentDispositionFileName: "image.png",
              stream: (async function* bytes() {
                yield new Uint8Array([5, 6, 7, 8]);
              })(),
            }),
          };
        },
      },
      imageAssetStoragePort: {
        async reserveStorageLocation() {
          throw new Error("not used");
        },
        async writeObject() {
          return Object.freeze({
            reference: Object.freeze({
              storageInstanceId: "storage-alpha",
              objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
              area: ImageAssetStorageObjectAreas.original,
            }),
            sizeBytes: 4,
            checksum: Object.freeze({
              algorithm: "sha256" as const,
              digest: "b".repeat(64),
            }),
            writtenAt: "2026-04-08T10:04:00.000Z",
          });
        },
        async openReadStream() {
          throw new Error("not used");
        },
        async createAccessHandle() {
          throw new Error("not used");
        },
        async resolveAccessHandle() {
          throw new Error("not used");
        },
        async deleteObject() {
          throw new Error("not used");
        },
      },
    });

    const created = await backend.createImageAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      mediaType: "image/png",
      originalFilename: "image.png",
      sizeBytes: 4,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
    });
    expect(created.ok).toBeTrue();
    if (!created.ok || !created.data) {
      return;
    }
    expect(created.data.asset.assetId).toBe("image-asset:001");
    expect(created.data.upload.uploadEndpoint).toContain("/api/v1/image-assets/image-asset%3A001/uploads/");
    expect(created.data.upload.uploadSessionId.length).toBeGreaterThan(20);

    const uploadSessionId = created.data.upload.uploadSessionId;

    const ingested = await backend.ingestImageAssetUploadContent({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId,
      contentType: "image/png",
      content: (async function* bytes() {
        yield new Uint8Array([1, 2, 3, 4]);
      })(),
    });
    expect(ingested.ok).toBeTrue();
    if (!ingested.ok || !ingested.data) {
      return;
    }
    expect(ingested.data.sizeBytes).toBe(4);

    const completed = await backend.completeImageAssetUpload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId,
    });
    expect(completed.ok).toBeTrue();
    if (!completed.ok || !completed.data) {
      return;
    }
    expect(completed.data.asset.lifecycle.status).toBe("available");
    expect(completed.data.finalizedAt).toBe("2026-04-08T10:05:00.000Z");

    const detail = await backend.getImageAssetMetadata({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });
    expect(detail.ok).toBeTrue();
    if (!detail.ok || !detail.data) {
      return;
    }
    expect(detail.data.asset.assetId).toBe("image-asset:001");

    const listed = await backend.listImageAssetMetadata({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
    });
    expect(listed.ok).toBeTrue();
    if (!listed.ok || !listed.data) {
      return;
    }
    expect(listed.data.items).toHaveLength(1);
    expect(listed.data.pagination.returned).toBe(1);
  });

  it("rejects invalid upload session tokens", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: { async execute() { throw new Error("not used"); } },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      requestImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      openImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const response = await backend.completeImageAssetUpload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: "invalid",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("invalid-request");
  });

  it("validates upload session tokens signed by a superseded key during the transition window", async () => {
    const clock = new MutableClock(new Date("2026-04-08T10:00:00.000Z"));
    const runtimeSecurityMaterialResolver = new StubRuntimeSecurityMaterialResolver();
    const backend = new ImageAssetManagementBackendApi({
      runtimeSecurityMaterialResolver,
      uploadSessionTokenSecretId: "secret:server:image-upload-session-token",
      uploadSessionTokenSigningPurpose: "image-asset-upload-session-token-signing",
      clock,
      initiateImageAssetCreationUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: baseAsset,
              upload: Object.freeze({
                status: "upload-pending" as const,
                reservation: Object.freeze({
                  reservationId: "reservation-001",
                  reference: Object.freeze({
                    storageInstanceId: "storage-alpha",
                    objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                    area: ImageAssetStorageObjectAreas.original,
                  }),
                  expiresAt: "2026-04-08T12:00:00.000Z",
                }),
              }),
            }),
          };
        },
      },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      requestImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      openImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() {
          return Object.freeze({
            reference: Object.freeze({
              storageInstanceId: "storage-alpha",
              objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
              area: ImageAssetStorageObjectAreas.original,
            }),
            sizeBytes: 4,
            checksum: Object.freeze({
              algorithm: "sha256" as const,
              digest: "b".repeat(64),
            }),
            writtenAt: "2026-04-08T10:04:00.000Z",
          });
        },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const created = await backend.createImageAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      mediaType: "image/png",
      originalFilename: "image.png",
      sizeBytes: 4,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
    });
    expect(created.ok).toBeTrue();
    if (!created.ok || !created.data) {
      return;
    }

    runtimeSecurityMaterialResolver.setActiveSigningVersion("secret:server:image-upload-session-token:v2");
    clock.setNow("2026-04-08T10:05:00.000Z");
    const ingested = await backend.ingestImageAssetUploadContent({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: created.data.upload.uploadSessionId,
      contentType: "image/png",
      content: (async function* bytes() {
        yield new Uint8Array([1, 2, 3, 4]);
      })(),
    });

    expect(ingested.ok).toBeTrue();
  });

  it("retires superseded upload token signing keys after the configured transition window", async () => {
    const clock = new MutableClock(new Date("2026-04-08T10:00:00.000Z"));
    const runtimeSecurityMaterialResolver = new StubRuntimeSecurityMaterialResolver();
    const backend = new ImageAssetManagementBackendApi({
      runtimeSecurityMaterialResolver,
      uploadSessionTokenSecretId: "secret:server:image-upload-session-token",
      uploadSessionTokenSigningPurpose: "image-asset-upload-session-token-signing",
      uploadSessionTokenPreviousVersionValidationWindowMs: 5 * 60 * 1000,
      clock,
      initiateImageAssetCreationUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: baseAsset,
              upload: Object.freeze({
                status: "upload-pending" as const,
                reservation: Object.freeze({
                  reservationId: "reservation-001",
                  reference: Object.freeze({
                    storageInstanceId: "storage-alpha",
                    objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                    area: ImageAssetStorageObjectAreas.original,
                  }),
                  expiresAt: "2026-04-08T12:00:00.000Z",
                }),
              }),
            }),
          };
        },
      },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      requestImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      openImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const created = await backend.createImageAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      mediaType: "image/png",
      originalFilename: "image.png",
      sizeBytes: 4,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
    });
    expect(created.ok).toBeTrue();
    if (!created.ok || !created.data) {
      return;
    }

    runtimeSecurityMaterialResolver.setActiveSigningVersion("secret:server:image-upload-session-token:v2");
    clock.setNow("2026-04-08T10:07:00.000Z");
    const response = await backend.completeImageAssetUpload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: created.data.upload.uploadSessionId,
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("invalid-request");
  });

  it("rejects upload ingestion when contentType is missing or mismatched", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: baseAsset,
              upload: Object.freeze({
                status: "upload-pending" as const,
                reservation: Object.freeze({
                  reservationId: "reservation-001",
                  reference: Object.freeze({
                    storageInstanceId: "storage-alpha",
                    objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                    area: ImageAssetStorageObjectAreas.original,
                  }),
                  expiresAt: "2026-04-08T10:20:00.000Z",
                }),
              }),
            }),
          };
        },
      },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      requestImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      openImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const created = await backend.createImageAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      mediaType: "image/png",
      originalFilename: "image.png",
      sizeBytes: 4,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
    });
    expect(created.ok).toBeTrue();
    if (!created.ok || !created.data) {
      return;
    }

    const missingType = await backend.ingestImageAssetUploadContent({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: created.data.upload.uploadSessionId,
      content: (async function* bytes() {
        yield new Uint8Array([1, 2, 3, 4]);
      })(),
    });
    expect(missingType.ok).toBeFalse();
    if (!missingType.ok && missingType.error) {
      expect(missingType.error.code).toBe("invalid-request");
      expect(missingType.error.details).toEqual(
        expect.objectContaining({
          validationCode: "content-type-required",
        }),
      );
    }

    const mismatch = await backend.ingestImageAssetUploadContent({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: created.data.upload.uploadSessionId,
      contentType: "image/jpeg",
      content: (async function* bytes() {
        yield new Uint8Array([1, 2, 3, 4]);
      })(),
    });
    expect(mismatch.ok).toBeFalse();
    if (!mismatch.ok && mismatch.error) {
      expect(mismatch.error.code).toBe("invalid-request");
      expect(mismatch.error.details).toEqual(
        expect.objectContaining({
          validationCode: "content-type-mismatch",
        }),
      );
    }

    const invalidChecksum = await backend.ingestImageAssetUploadContent({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: created.data.upload.uploadSessionId,
      contentType: "image/png",
      expectedChecksumSha256: "not-a-sha",
      content: (async function* bytes() {
        yield new Uint8Array([1, 2, 3, 4]);
      })(),
    });
    expect(invalidChecksum.ok).toBeFalse();
    if (!invalidChecksum.ok && invalidChecksum.error) {
      expect(invalidChecksum.error.code).toBe("invalid-request");
      expect(invalidChecksum.error.details).toEqual(
        expect.objectContaining({
          validationCode: "expected-checksum-invalid",
        }),
      );
    }
  });

  it("rejects upload session tokens with tampered signature length without throwing", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: baseAsset,
              upload: Object.freeze({
                status: "upload-pending" as const,
                reservation: Object.freeze({
                  reservationId: "reservation-001",
                  reference: Object.freeze({
                    storageInstanceId: "storage-alpha",
                    objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                    area: ImageAssetStorageObjectAreas.original,
                  }),
                  expiresAt: "2026-04-08T10:20:00.000Z",
                }),
              }),
            }),
          };
        },
      },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      requestImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      openImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const created = await backend.createImageAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      mediaType: "image/png",
      originalFilename: "image.png",
      sizeBytes: 4,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
    });
    expect(created.ok).toBeTrue();
    if (!created.ok || !created.data) {
      return;
    }

    const tokenParts = created.data.upload.uploadSessionId.split(".");
    const tamperedToken = `${tokenParts[0]}.${tokenParts[1]}.x`;

    const response = await backend.completeImageAssetUpload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: tamperedToken,
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("invalid-request");
  });

  it("opens protected image-asset original content streams", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: { async execute() { throw new Error("not used"); } },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              assetId: "image-asset:001",
              workspaceId: "workspace-alpha",
              mediaType: "image/png" as const,
              sizeBytes: 4,
              contentDisposition: "attachment" as const,
              contentDispositionFileName: "image.png",
              stream: (async function* bytes() {
                yield new Uint8Array([1, 2, 3, 4]);
              })(),
            }),
          };
        },
      },
      requestImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      openImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const opened = await backend.openImageAssetOriginalContentStream({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });

    expect(opened.ok).toBeTrue();
    if (!opened.ok || !opened.data) {
      return;
    }
    expect(opened.data.mimeType).toBe("image/png");
    expect(opened.data.contentDisposition).toBe("attachment");

    const chunks: number[] = [];
    for await (const chunk of opened.data.stream) {
      chunks.push(...chunk);
    }
    expect(chunks).toEqual([1, 2, 3, 4]);
  });

  it("issues preview contracts and opens protected preview content streams", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: { async execute() { throw new Error("not used"); } },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      requestImageAssetPreviewContentUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              assetId: "image-asset:001",
              workspaceId: "workspace-alpha",
              representation: "thumbnail" as const,
              status: "available" as const,
              mediaType: "image/png" as const,
              resolvedFrom: "original-fallback" as const,
              access: Object.freeze({
                previewToken: "preview-token-123",
                expiresAt: "2026-04-08T10:10:00.000Z",
              }),
            }),
          };
        },
      },
      openImageAssetPreviewContentUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              assetId: "image-asset:001",
              workspaceId: "workspace-alpha",
              mediaType: "image/png" as const,
              sizeBytes: 4,
              contentDisposition: "inline" as const,
              contentDispositionFileName: "image.png",
              stream: (async function* bytes() {
                yield new Uint8Array([9, 8, 7, 6]);
              })(),
            }),
          };
        },
      },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const preview = await backend.requestImageAssetPreview({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      representation: "thumbnail",
      preferredMediaTypes: ["image/png"],
    });
    expect(preview.ok).toBeTrue();
    if (!preview.ok || !preview.data) {
      return;
    }
    expect(preview.data.preview.status).toBe("available");
    expect(preview.data.preview.access?.previewToken).toBe("preview-token-123");
    expect(preview.data.preview.access?.contentEndpoint).toBe("/api/v1/image-assets/image-asset%3A001/preview/content");

    const opened = await backend.openImageAssetPreviewContentStream({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      previewToken: "preview-token-123",
    });
    expect(opened.ok).toBeTrue();
    if (!opened.ok || !opened.data) {
      return;
    }
    expect(opened.data.contentDisposition).toBe("inline");

    const chunks: number[] = [];
    for await (const chunk of opened.data.stream) {
      chunks.push(...chunk);
    }
    expect(chunks).toEqual([9, 8, 7, 6]);
  });

  it("includes normalized failure taxonomy details for malformed retrieval requests", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      initiateImageAssetCreationUseCase: { async execute() { throw new Error("not used"); } },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      requestImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      openImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const response = await backend.openImageAssetOriginalContentStream({
      actorUserIdentityId: "   ",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
    });

    expect(response.ok).toBeFalse();
    if (response.ok || !response.error) {
      return;
    }
    expect(response.error.code).toBe("invalid-request");
    expect(response.error.details).toEqual(expect.objectContaining({
      validationCode: "actor-user-identity-required",
      imageManipulationFailure: expect.any(Object),
    }));
  });

  it("rejects stale upload session ids during finalize with invalid-state", async () => {
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      clock: {
        now: () => new Date("2026-04-08T10:30:00.000Z"),
      },
      initiateImageAssetCreationUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: baseAsset,
              upload: Object.freeze({
                status: "upload-pending" as const,
                reservation: Object.freeze({
                  reservationId: "reservation-001",
                  reference: Object.freeze({
                    storageInstanceId: "storage-alpha",
                    objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                    area: ImageAssetStorageObjectAreas.original,
                  }),
                  expiresAt: "2026-04-08T10:20:00.000Z",
                }),
              }),
            }),
          };
        },
      },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      requestImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      openImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const created = await backend.createImageAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      mediaType: "image/png",
      originalFilename: "image.png",
      sizeBytes: 4,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
    });
    expect(created.ok).toBeTrue();
    if (!created.ok || !created.data) {
      return;
    }

    const completed = await backend.completeImageAssetUpload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: created.data.upload.uploadSessionId,
    });

    expect(completed.ok).toBeFalse();
    if (completed.ok || !completed.error) {
      return;
    }
    expect(completed.error.code).toBe("invalid-state");
    expect(completed.error.details).toEqual(expect.objectContaining({
      validationCode: "upload-session-expired",
      staleRequest: true,
      imageManipulationFailure: expect.any(Object),
    }));
  });

  it("emits observability with request-to-asset trace metadata", async () => {
    const logger = new CapturingLogger();
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      observability: new ImageAssetManagementObservability({ logger }),
      initiateImageAssetCreationUseCase: { async execute() { throw new Error("not used"); } },
      finalizeImageAssetUploadUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      requestImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      openImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() { throw new Error("not used"); },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const response = await backend.openImageAssetPreviewContentStream({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      previewToken: "preview-token-secret",
      correlationId: "corr-preview-1",
    });

    expect(response.ok).toBeFalse();
    expect(logger.warnEvents).toHaveLength(1);
    const event = logger.warnEvents[0];
    expect(event.flow).toBe("preview-open");
    expect(event.trace.assetId).toBe("image-asset:001");
    expect(event.trace.workspaceId).toBe("workspace-alpha");
    expect(event.trace.correlationId).toBe("corr-preview-1");
    expect(event.slice).toBe("image-manipulation");
    expect(event.correlation.correlationId).toBe("corr-preview-1");
    expect(event.correlation.assetId).toBe("image-asset:001");
    expect(event.resilience?.[0]?.category).toBe("validation");

    const serialized = JSON.stringify(event);
    expect(serialized).not.toContain("preview-token-secret");
    expect(serialized).toContain("[REDACTED]");
  });

  it("emits create/ingest/finalize observability events for upload flow", async () => {
    const logger = new CapturingLogger();
    const clock = new MutableClock(new Date("2026-04-08T10:01:00.000Z"));
    const backend = new ImageAssetManagementBackendApi({
      uploadSessionTokenSecret: "test-secret",
      clock,
      observability: new ImageAssetManagementObservability({ logger }),
      initiateImageAssetCreationUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: baseAsset,
              upload: Object.freeze({
                status: "upload-pending" as const,
                reservation: Object.freeze({
                  reservationId: "reservation-001",
                  reference: Object.freeze({
                    storageInstanceId: "storage-alpha",
                    objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                    area: ImageAssetStorageObjectAreas.original,
                  }),
                  expiresAt: "2026-04-08T10:20:00.000Z",
                }),
              }),
            }),
          };
        },
      },
      finalizeImageAssetUploadUseCase: {
        async execute() {
          return {
            ok: true as const,
            value: Object.freeze({
              imageAsset: Object.freeze({
                ...baseAsset,
                lifecycle: Object.freeze({
                  status: ImageAssetStatuses.available,
                  ingestedAt: "2026-04-08T10:05:00.000Z",
                }),
              }),
              upload: Object.freeze({
                status: "finalized" as const,
                reference: Object.freeze({
                  storageInstanceId: "storage-alpha",
                  objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                  area: ImageAssetStorageObjectAreas.original,
                }),
                finalizedAt: "2026-04-08T10:05:00.000Z",
                observedSizeBytes: 4,
                observedChecksumSha256: "b".repeat(64),
              }),
            }),
          };
        },
      },
      getImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      listImageAssetMetadataUseCase: { async execute() { throw new Error("not used"); } },
      getImageAssetOriginalContentUseCase: { async execute() { throw new Error("not used"); } },
      requestImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      openImageAssetPreviewContentUseCase: { async execute() { throw new Error("not used"); } },
      imageAssetStoragePort: {
        async reserveStorageLocation() { throw new Error("not used"); },
        async writeObject() {
          return Object.freeze({
            reference: Object.freeze({
              storageInstanceId: "storage-alpha",
              objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
              area: ImageAssetStorageObjectAreas.original,
            }),
            sizeBytes: 4,
            checksum: Object.freeze({
              algorithm: "sha256" as const,
              digest: "b".repeat(64),
            }),
            writtenAt: "2026-04-08T10:04:00.000Z",
          });
        },
        async openReadStream() { throw new Error("not used"); },
        async createAccessHandle() { throw new Error("not used"); },
        async resolveAccessHandle() { throw new Error("not used"); },
        async deleteObject() { throw new Error("not used"); },
      },
    });

    const created = await backend.createImageAsset({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      mediaType: "image/png",
      originalFilename: "image.png",
      sizeBytes: 4,
      fingerprint: {
        algorithm: "sha256",
        digest: "a".repeat(64),
      },
      correlationId: "corr-upload-flow-1",
    });
    expect(created.ok).toBeTrue();
    if (!created.ok || !created.data) {
      return;
    }

    const ingested = await backend.ingestImageAssetUploadContent({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: created.data.upload.uploadSessionId,
      contentType: "image/png",
      content: new Uint8Array([1, 2, 3, 4]),
      correlationId: "corr-upload-flow-1",
    });
    expect(ingested.ok).toBeTrue();

    const finalized = await backend.completeImageAssetUpload({
      actorUserIdentityId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "image-asset:001",
      uploadSessionId: created.data.upload.uploadSessionId,
      correlationId: "corr-upload-flow-1",
    });
    expect(finalized.ok).toBeTrue();

    const emittedFlows = logger.infoEvents.map((event) => event.flow);
    expect(emittedFlows).toEqual(expect.arrayContaining(["create", "upload-ingest", "upload-finalize"]));
  });
});
