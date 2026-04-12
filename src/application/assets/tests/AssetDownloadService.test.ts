import { describe, expect, it } from "bun:test";
import type { IAssetRepository } from "../ports/IAssetRepository";
import type { IWorkspaceAuthorizationReadRepository } from "../../workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type { IStorageLogicalAccessResolutionService } from "../../storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import type { IAssetDownloadGrantPort } from "../ports/AssetDownloadGrantPort";
import {
  AssetKinds,
  AssetVisibilities,
  createAsset,
  createAssetLocationRef,
  createAssetOwnershipMetadata,
  createAssetVersion,
  createContentDescriptor,
  createStorageInstanceRef,
  type Asset,
} from "@domain/assets/AssetDomain";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageInstance,
  createStoragePolicy,
} from "@domain/storage/StorageDomain";
import { AssetDownloadPurposes } from "../use-cases/AssetServiceContracts";
import { AssetDownloadService } from "../use-cases/AssetDownloadService";
import type { IEncryptionAtRestPolicyContextResolverPort } from "../../security/ports/EncryptionAtRestPolicyEvaluationPorts";
import { EncryptionPolicyEvaluationService } from "../../security/use-cases/EncryptionPolicyEvaluationService";
import {
  createEncryptionAtRestPolicyDefinition,
  EncryptionKeyScopes,
  EncryptionModes,
  EncryptionPolicyScopes,
  ProtectedDataClasses,
} from "@domain/security/EncryptionAtRestPolicyDomain";
import { DeterministicScopeEncryptionKeyPort } from "@infrastructure/security/encryption/DeterministicScopeEncryptionKeyPort";
import { AesGcmAssetContentCipherPort } from "@infrastructure/security/encryption/AesGcmAssetContentCipherPort";
import type { AssetAuditEvent, AssetAuditSink } from "../ports/AssetAuditPort";
import type { IEncryptionEnforcementObservabilityPort } from "../../security/ports/EncryptionEnforcementObservabilityPorts";

class InMemoryAssetRepository implements IAssetRepository {
  public constructor(private readonly asset: Asset) {}

  public async findAssetById(assetId: string): Promise<Asset | undefined> {
    return this.asset.id === assetId ? this.asset : undefined;
  }

  public async listAssets(): Promise<ReadonlyArray<Asset>> {
    return Object.freeze([this.asset]);
  }

  public async createAsset(asset: Asset) {
    return Object.freeze({ changed: true, asset });
  }

  public async saveAsset(asset: Asset) {
    return Object.freeze({ changed: true, asset });
  }

  public async replaceAssetLineage(): Promise<void> {
    throw new Error("not implemented");
  }
}

class WorkspaceAuthorizationRepository implements IWorkspaceAuthorizationReadRepository {
  public allow = true;

  public isAdmin = false;

  public async getWorkspaceAuthorizationSnapshot(
    query: Parameters<IWorkspaceAuthorizationReadRepository["getWorkspaceAuthorizationSnapshot"]>[0],
  ) {
    if (!this.allow) {
      return undefined;
    }
    return Object.freeze({
      workspace: {
        id: query.workspaceId,
        slug: "workspace-alpha",
        displayName: "Workspace Alpha",
        status: "active",
        ownership: {
          workspaceId: query.workspaceId,
          ownerUserId: "user-owner",
          visibility: "team",
          createdBy: "user-owner",
          lastModifiedBy: "user-owner",
          createdAt: "2026-04-06T12:00:00.000Z",
          lastModifiedAt: "2026-04-06T12:00:00.000Z",
        },
      },
      membership: {
        id: "membership-alpha",
        workspaceId: query.workspaceId,
        userIdentityId: query.userIdentityId,
        status: "active",
        createdAt: "2026-04-06T12:00:00.000Z",
        updatedAt: "2026-04-06T12:00:00.000Z",
        createdBy: query.userIdentityId,
        lastModifiedBy: query.userIdentityId,
      },
      activeRoleAssignments: Object.freeze([]),
      effectiveRoles: this.isAdmin ? Object.freeze(["admin"]) : Object.freeze(["member"]),
      isWorkspaceOwner: false,
    });
  }
}

class StubStorageLogicalAccessResolutionService implements IStorageLogicalAccessResolutionService {
  public constructor(private readonly payload: Uint8Array = Buffer.from("hello", "utf8")) {}

  private readonly storageInstance = createStorageInstance({
    id: "storage-alpha",
    displayName: "Storage Alpha",
    backendType: StorageBackendTypes.managedFilesystem,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    policy: createStoragePolicy({
      policyId: "policy-alpha",
      allowCrossWorkspaceReads: false,
      immutableWrites: false,
      encryption: {
        profileId: "enc-profile",
        envelopeRequired: true,
      },
      security: {
        allowPreviewDecryption: true,
        allowWorkerDecryption: true,
      },
    }),
    lifecycleState: StorageLifecycleStates.active,
    createdBy: "user-owner",
    createdAt: "2026-04-06T12:00:00.000Z",
    lastModifiedBy: "user-owner",
    lastModifiedAt: "2026-04-06T12:00:00.000Z",
    lastCorrelationId: "corr-storage-alpha",
  });

  public async resolveLogicalAccessPlan() {
    return {
      ok: true as const,
      value: {
        intent: "open-object-read-stream" as const,
        storageInstance: this.storageInstance,
        objectPort: {
          createObjectKey: () => {
            throw new Error("not used");
          },
          writeObject: async () => {
            throw new Error("not used");
          },
          objectExists: async () => true,
          readObjectMetadata: async () => ({
            objectKey: "object",
            sizeBytes: 5,
            lastModifiedAt: "2026-04-06T12:00:00.000Z",
          }),
          openObjectReadStream: async () => (async function* stream(payload: Uint8Array) {
            yield payload;
          })(this.payload),
          deleteObject: async () => ({
            objectKey: "object",
            deleted: true,
            deletedAt: "2026-04-06T12:00:00.000Z",
          }),
        },
        occurredAt: "2026-04-06T12:00:00.000Z",
      },
    };
  }
}

class InMemoryDownloadGrantPort implements IAssetDownloadGrantPort {
  private readonly grants = new Map<string, Awaited<ReturnType<IAssetDownloadGrantPort["resolveDownloadGrant"]>>>();

  public async issueDownloadGrant(request: Parameters<IAssetDownloadGrantPort["issueDownloadGrant"]>[0]) {
    const token = `token-${request.assetId}-${request.versionId}`;
    this.grants.set(token, {
      workspaceId: request.workspaceId,
      actorUserId: request.actorUserId,
      assetId: request.assetId,
      versionId: request.versionId,
      storageInstanceId: request.storageInstanceId,
      objectKey: request.objectKey,
      objectVersionId: request.objectVersionId,
      area: request.area,
      mimeType: request.mimeType,
      sizeBytes: request.sizeBytes,
      contentDispositionFileName: request.contentDispositionFileName,
      purpose: request.purpose,
      expiresAt: "2026-04-06T12:10:00.000Z",
    });
    return Object.freeze({
      contentToken: token,
      expiresAt: "2026-04-06T12:10:00.000Z",
    });
  }

  public async resolveDownloadGrant(request: Parameters<IAssetDownloadGrantPort["resolveDownloadGrant"]>[0]) {
    const claim = this.grants.get(request.contentToken);
    if (!claim) {
      return undefined;
    }
    return claim;
  }
}

class RecordingAuditSink implements AssetAuditSink {
  public readonly events: AssetAuditEvent[] = [];

  public async recordAssetEvent(event: AssetAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

class RecordingEncryptionObservabilityPort implements IEncryptionEnforcementObservabilityPort {
  public readonly events: Parameters<IEncryptionEnforcementObservabilityPort["recordEncryptionEnforcementEvent"]>[0][] = [];

  public async recordEncryptionEnforcementEvent(
    event: Parameters<IEncryptionEnforcementObservabilityPort["recordEncryptionEnforcementEvent"]>[0],
  ): Promise<void> {
    this.events.push(event);
  }
}

function createEncryptionDependencies(input?: {
  readonly contentEncryptionRequired?: boolean;
  readonly allowPreviewDecryption?: boolean;
  readonly allowWorkerDecryption?: boolean;
}) {
  const policyState = {
    contentEncryptionRequired: input?.contentEncryptionRequired ?? false,
    allowPreviewDecryption: input?.allowPreviewDecryption ?? false,
    allowWorkerDecryption: input?.allowWorkerDecryption ?? false,
  };

  const policyResolver: IEncryptionAtRestPolicyContextResolverPort = {
    async resolvePolicyContext() {
      return Object.freeze({
        platformPolicy: createEncryptionAtRestPolicyDefinition({
          policyId: "policy:platform:test",
          scope: EncryptionPolicyScopes.platform,
          rules: Object.freeze([
            Object.freeze({
              dataClass: ProtectedDataClasses.secretMaterial,
              encryptionMode: EncryptionModes.scopedContent,
              keyScope: EncryptionKeyScopes.server,
              decryption: Object.freeze({ allowPreview: false, allowWorker: false }),
            }),
            Object.freeze({
              dataClass: ProtectedDataClasses.secretMetadata,
              encryptionMode: EncryptionModes.metadataOnly,
              keyScope: EncryptionKeyScopes.server,
              decryption: Object.freeze({ allowPreview: false, allowWorker: false }),
            }),
            Object.freeze({
              dataClass: ProtectedDataClasses.sensitiveMetadata,
              encryptionMode: EncryptionModes.metadataOnly,
              keyScope: EncryptionKeyScopes.server,
              decryption: Object.freeze({ allowPreview: false, allowWorker: false }),
            }),
          ]),
        }),
        storageInstancePolicy: createEncryptionAtRestPolicyDefinition({
          policyId: "policy:storage:test",
          scope: EncryptionPolicyScopes.storageInstance,
          workspaceId: "workspace-alpha",
          storageInstanceId: "storage-alpha",
          rules: Object.freeze([
            Object.freeze({
              dataClass: ProtectedDataClasses.assetContent,
              encryptionMode: policyState.contentEncryptionRequired ? EncryptionModes.scopedContent : EncryptionModes.none,
              keyScope: policyState.contentEncryptionRequired ? EncryptionKeyScopes.storageInstance : undefined,
              decryption: Object.freeze({
                allowPreview: policyState.allowPreviewDecryption,
                allowWorker: policyState.allowWorkerDecryption,
              }),
            }),
          ]),
        }),
      });
    },
  };

  const keyPort = new DeterministicScopeEncryptionKeyPort({
    encodedKey: Buffer.alloc(32, 9).toString("base64"),
    keyPrefix: "kek:asset-content:test",
  });

  return {
    encryptionPolicyEvaluationService: new EncryptionPolicyEvaluationService({
      encryptionAtRestPolicyContextResolverPort: policyResolver,
    }),
    assetContentCipherPort: new AesGcmAssetContentCipherPort({
      keyMaterialPort: keyPort,
    }),
    keyPort,
    setPolicyState(
      next: Partial<{
        readonly contentEncryptionRequired: boolean;
        readonly allowPreviewDecryption: boolean;
        readonly allowWorkerDecryption: boolean;
      }>,
    ) {
      if (next.contentEncryptionRequired !== undefined) {
        policyState.contentEncryptionRequired = next.contentEncryptionRequired;
      }
      if (next.allowPreviewDecryption !== undefined) {
        policyState.allowPreviewDecryption = next.allowPreviewDecryption;
      }
      if (next.allowWorkerDecryption !== undefined) {
        policyState.allowWorkerDecryption = next.allowWorkerDecryption;
      }
    },
  };
}

function createTestAsset(input?: { readonly encryption?: NonNullable<ReturnType<typeof createContentDescriptor>["encryption"]> }): Asset {
  return createAsset({
    id: "asset-download-001",
    kind: AssetKinds.generatedOutput,
    ownership: createAssetOwnershipMetadata({
      workspaceId: "workspace-alpha",
      ownerUserId: "user-owner",
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
    visibility: AssetVisibilities.private,
    storageBinding: createStorageInstanceRef({
      storageInstanceId: "storage-alpha",
    }),
    initialVersion: createAssetVersion({
      versionId: "asset-download-001:v1",
      revision: 1,
      location: createAssetLocationRef({
        storageInstance: { storageInstanceId: "storage-alpha" },
        objectKey: "workspaces/workspace-alpha/assets/asset-download-001/output/v1/file.png",
        area: "output",
      }),
      content: createContentDescriptor({
        mimeType: "image/png",
        sizeBytes: 5,
        checksum: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
        originalFileName: "file.png",
        encryption: input?.encryption,
      }),
      createdBy: "user-owner",
      createdAt: "2026-04-06T12:00:00.000Z",
    }),
  });
}

async function createEncryptedAssetFixture(
  encryption: ReturnType<typeof createEncryptionDependencies>,
): Promise<{ readonly asset: Asset; readonly encryptedBytes: Uint8Array }> {
  const activeKey = await encryption.keyPort.resolveActiveKeyForScope({
    scopeOwner: {
      scope: "storage-instance",
      workspaceId: "workspace-alpha",
      storageInstanceId: "storage-alpha",
    },
  });
  if (!activeKey) {
    throw new Error("expected deterministic key");
  }

  const encryptedSession = await encryption.assetContentCipherPort.beginEncryption({
    plaintext: (async function* () {
      yield Buffer.from("hello", "utf8");
    })(),
    key: activeKey,
    aad: "asset-content-encryption/v1;workspace=workspace-alpha;storage=storage-alpha;asset=asset-download-001;version=asset-download-001:v1;area=output;object=workspaces/workspace-alpha/assets/asset-download-001/output/v1/file.png",
    encryptedAt: "2026-04-06T12:00:00.000Z",
  });
  const encryptedChunks: Buffer[] = [];
  for await (const chunk of encryptedSession.ciphertext) {
    encryptedChunks.push(Buffer.from(chunk));
  }
  const encryptedResult = await encryptedSession.complete();
  return Object.freeze({
    asset: createTestAsset({
      encryption: encryptedResult.descriptor,
    }),
    encryptedBytes: Buffer.concat(encryptedChunks),
  });
}

describe("AssetDownloadService", () => {
  it("authorizes download and opens a streaming response for the same actor", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const grantPort = new InMemoryDownloadGrantPort();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: false,
    });
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(createTestAsset()),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(),
      downloadGrantPort: grantPort,
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
    });

    const authorization = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.download,
    });
    expect(authorization.ok).toBeTrue();
    if (!authorization.ok) {
      return;
    }
    expect(authorization.value.contentToken).toContain("token-asset-download-001");

    const streamResult = await service.openAuthorizedAssetDownloadStream({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      contentToken: authorization.value.contentToken,
    });
    expect(streamResult.ok).toBeTrue();
    if (!streamResult.ok) {
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of streamResult.value.stream) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString("utf8")).toBe("hello");
  });

  it("returns not-found for private assets owned by another user", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: false,
    });
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(createTestAsset()),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(),
      downloadGrantPort: new InMemoryDownloadGrantPort(),
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
    });

    const outcome = await service.authorizeAssetDownload({
      actorUserId: "user-other",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.download,
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("asset-not-found");
  });

  it("blocks stream opening when content token is invalid", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: false,
    });
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(createTestAsset()),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(),
      downloadGrantPort: new InMemoryDownloadGrantPort(),
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
    });

    const outcome = await service.openAuthorizedAssetDownloadStream({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      contentToken: "invalid-token",
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("asset-access-denied");
  });

  it("decrypts encrypted asset content for authorized downloads when policy allows", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const grantPort = new InMemoryDownloadGrantPort();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: true,
      allowPreviewDecryption: true,
      allowWorkerDecryption: true,
    });
    const fixture = await createEncryptedAssetFixture(encryption);

    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(fixture.asset),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(fixture.encryptedBytes),
      downloadGrantPort: grantPort,
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
    });

    const authorization = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.download,
    });
    expect(authorization.ok).toBeTrue();
    if (!authorization.ok) {
      return;
    }

    const streamResult = await service.openAuthorizedAssetDownloadStream({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      contentToken: authorization.value.contentToken,
    });
    expect(streamResult.ok).toBeTrue();
    if (!streamResult.ok) {
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of streamResult.value.stream) {
      chunks.push(Buffer.from(chunk));
    }
    expect(Buffer.concat(chunks).toString("utf8")).toBe("hello");
  });

  it("denies download authorization when policy requires encryption but asset content is plaintext", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: true,
      allowPreviewDecryption: true,
      allowWorkerDecryption: true,
    });
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(createTestAsset()),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(),
      downloadGrantPort: new InMemoryDownloadGrantPort(),
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
    });

    const outcome = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.download,
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("asset-policy-violation");
  });

  it("denies inline-preview authorization when encrypted content preview decryption is disallowed", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: true,
      allowPreviewDecryption: false,
      allowWorkerDecryption: true,
    });
    const fixture = await createEncryptedAssetFixture(encryption);
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(fixture.asset),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(fixture.encryptedBytes),
      downloadGrantPort: new InMemoryDownloadGrantPort(),
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
    });

    const outcome = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.inlinePreview,
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("asset-policy-violation");
    expect(outcome.error.details?.reasonCode).toBe("preview-decryption-not-allowed");
  });

  it("denies worker-process authorization when encrypted content worker decryption is disallowed", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: true,
      allowPreviewDecryption: true,
      allowWorkerDecryption: false,
    });
    const fixture = await createEncryptedAssetFixture(encryption);
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(fixture.asset),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(fixture.encryptedBytes),
      downloadGrantPort: new InMemoryDownloadGrantPort(),
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
    });

    const outcome = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.workerProcess,
    });

    expect(outcome.ok).toBeFalse();
    if (outcome.ok) {
      return;
    }
    expect(outcome.error.code).toBe("asset-policy-violation");
    expect(outcome.error.details?.reasonCode).toBe("worker-decryption-not-allowed");
  });

  it("denies stream-open decryption when policy no longer allows inline-preview decryption", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const grantPort = new InMemoryDownloadGrantPort();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: true,
      allowPreviewDecryption: true,
      allowWorkerDecryption: true,
    });
    const fixture = await createEncryptedAssetFixture(encryption);
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(fixture.asset),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(fixture.encryptedBytes),
      downloadGrantPort: grantPort,
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
    });

    const authorization = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.inlinePreview,
    });
    expect(authorization.ok).toBeTrue();
    if (!authorization.ok) {
      return;
    }

    encryption.setPolicyState({
      allowPreviewDecryption: false,
    });

    const streamResult = await service.openAuthorizedAssetDownloadStream({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      contentToken: authorization.value.contentToken,
    });
    expect(streamResult.ok).toBeFalse();
    if (streamResult.ok) {
      return;
    }
    expect(streamResult.error.code).toBe("asset-policy-violation");
    expect(streamResult.error.details?.reasonCode).toBe("preview-decryption-not-allowed");
  });

  it("emits audit events for download authorization and stream-open outcomes", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const grantPort = new InMemoryDownloadGrantPort();
    const auditSink = new RecordingAuditSink();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: false,
    });
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(createTestAsset()),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(),
      downloadGrantPort: grantPort,
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
      auditSink,
    });

    const authorization = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.download,
    });
    expect(authorization.ok).toBeTrue();
    if (!authorization.ok) {
      return;
    }

    const streamResult = await service.openAuthorizedAssetDownloadStream({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      contentToken: authorization.value.contentToken,
    });
    expect(streamResult.ok).toBeTrue();

    const failedStream = await service.openAuthorizedAssetDownloadStream({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      contentToken: "invalid-token",
    });
    expect(failedStream.ok).toBeFalse();

    expect(auditSink.events.some((event) => event.type === "asset-download-authorized" && event.outcome === "success")).toBeTrue();
    expect(auditSink.events.some((event) => event.type === "asset-download-opened" && event.outcome === "success")).toBeTrue();
    expect(auditSink.events.some((event) => event.type === "asset-download-opened" && event.outcome === "rejected")).toBeTrue();
  });

  it("emits rejected audit events when preview decryption is denied", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const auditSink = new RecordingAuditSink();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: true,
      allowPreviewDecryption: false,
      allowWorkerDecryption: true,
    });
    const fixture = await createEncryptedAssetFixture(encryption);
    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(fixture.asset),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(fixture.encryptedBytes),
      downloadGrantPort: new InMemoryDownloadGrantPort(),
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
      auditSink,
    });

    const outcome = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.inlinePreview,
    });

    expect(outcome.ok).toBeFalse();
    const rejected = auditSink.events.find((event) => (
      event.type === "asset-download-authorized"
      && event.outcome === "rejected"
      && event.details?.reasonCode === "preview-decryption-not-allowed"
    ));
    expect(rejected).toBeDefined();
  });

  it("emits decryption grant/deny diagnostics for preview and worker access decisions", async () => {
    const workspaceAuthorization = new WorkspaceAuthorizationRepository();
    const encryptionObservabilityPort = new RecordingEncryptionObservabilityPort();
    const encryption = createEncryptionDependencies({
      contentEncryptionRequired: true,
      allowPreviewDecryption: false,
      allowWorkerDecryption: true,
    });
    const fixture = await createEncryptedAssetFixture(encryption);

    const service = new AssetDownloadService({
      repository: new InMemoryAssetRepository(fixture.asset),
      workspaceAuthorizationReadRepository: workspaceAuthorization,
      storageLogicalAccessResolutionService: new StubStorageLogicalAccessResolutionService(fixture.encryptedBytes),
      downloadGrantPort: new InMemoryDownloadGrantPort(),
      encryptionPolicyEvaluationService: encryption.encryptionPolicyEvaluationService,
      assetContentCipherPort: encryption.assetContentCipherPort,
      encryptionObservabilityPort,
    });

    const deniedPreview = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.inlinePreview,
    });
    expect(deniedPreview.ok).toBeFalse();

    const allowedWorker = await service.authorizeAssetDownload({
      actorUserId: "user-owner",
      workspaceId: "workspace-alpha",
      assetId: "asset-download-001",
      purpose: AssetDownloadPurposes.workerProcess,
    });
    expect(allowedWorker.ok).toBeTrue();

    expect(encryptionObservabilityPort.events.some((event) => (
      event.event === "asset-content.decryption-access-authorized"
      && event.outcome === "denied"
      && event.details?.reasonCode === "preview-decryption-not-allowed"
    ))).toBeTrue();
    expect(encryptionObservabilityPort.events.some((event) => (
      event.event === "asset-content.decryption-access-authorized"
      && event.outcome === "succeeded"
      && event.details?.purpose === "worker-process"
    ))).toBeTrue();
  });
});


