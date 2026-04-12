import { afterEach, describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { createIdentityAuthTestHarness } from "../../../../api/identity/tests/TestIdentityAuthHarness";
import {
  createIdentityHttpServer,
  type IdentityHttpServerLogEvent,
  type IdentityHttpServerLogger,
} from "../IdentityHttpServer";
import { ImageAssetManagementBackendApi } from "../../../../api/image-assets/ImageAssetManagementBackendApi";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { ImageAssetAuditEvent, ImageAssetAuditSink } from "@application/image-assets/ports/ImageAssetAuditPort";
import {
  ImageAssetStorageObjectAreas,
} from "@application/image-assets/ports/ImageAssetStoragePort";
import { FinalizeImageAssetUploadUseCase } from "@application/image-assets/use-cases/FinalizeImageAssetUploadUseCase";
import { GetImageAssetMetadataUseCase } from "@application/image-assets/use-cases/GetImageAssetMetadataUseCase";
import { GetImageAssetOriginalContentUseCase } from "@application/image-assets/use-cases/GetImageAssetOriginalContentUseCase";
import { InitiateImageAssetCreationUseCase } from "@application/image-assets/use-cases/InitiateImageAssetCreationUseCase";
import { ListImageAssetMetadataUseCase } from "@application/image-assets/use-cases/ListImageAssetMetadataUseCase";
import { OpenImageAssetPreviewContentUseCase } from "@application/image-assets/use-cases/OpenImageAssetPreviewContentUseCase";
import { RequestImageAssetPreviewContentUseCase } from "@application/image-assets/use-cases/RequestImageAssetPreviewContentUseCase";
import type { StorageInstanceListQuery, IStorageInstanceRepository } from "@application/storage/ports/IStorageInstanceRepository";
import type { IStoragePolicyEvaluationPort } from "@application/storage/ports/StoragePolicyEvaluationPort";
import type {
  CreateStorageObjectKeyRequest,
  CreateStorageObjectKeyResult,
  IStorageObjectPort,
  StorageObjectDeleteRequest,
  StorageObjectDeleteResult,
  StorageObjectMetadata,
  StorageObjectReference,
  StorageObjectWriteRequest,
  StorageObjectWriteResult,
} from "@application/storage/ports/StorageObjectPort";
import type { IStorageLogicalAccessResolutionService } from "@application/storage/use-cases/StorageLogicalAccessResolutionServiceContracts";
import { ImageAssetStatuses } from "@domain/image-assets/ImageAssetDomain";
import { ResourceVisibilities, SharingPolicyModes } from "@domain/authorization/AuthorizationDomain";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageInstance,
  type StorageInstance,
} from "@domain/storage/StorageDomain";
import {
  createWorkspaceMembership,
  WorkspaceMembershipStatuses,
  WorkspaceRoles,
  WorkspaceStatuses,
  createWorkspace,
} from "@domain/workspaces/WorkspaceDomain";
import { SqliteImageAssetPersistenceAdapter } from "@infrastructure/persistence/image-assets/SqliteImageAssetPersistenceAdapter";
import { ManagedImageAssetStorageAdapter } from "@infrastructure/storage/image-assets/ManagedImageAssetStorageAdapter";
import { StudioShellBackendApi } from "../../../../api/studio-shell/StudioShellBackendApi";
import { InMemoryStudioShellRepository } from "@infrastructure/studio-shell/InMemoryStudioShellRepository";
import { ReferenceImageSystemTemplate } from "@application/system-studio/ReferenceImageSystemTemplate";
import type { IWorkspaceAuthorizationReadRepository } from "@application/workspaces/ports/IWorkspaceAuthorizationReadRepository";
import type {
  WorkspaceAuthorizationSnapshot,
  WorkspaceAuthorizationSnapshotQuery,
} from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";

const servers: Server[] = [];
const createdRoots: string[] = [];
const sqliteDisposables: SqliteImageAssetPersistenceAdapter[] = [];

class CapturingLogger implements IdentityHttpServerLogger {
  public readonly events: IdentityHttpServerLogEvent[] = [];
  public info(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }
  public warn(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }
  public error(event: IdentityHttpServerLogEvent): void {
    this.events.push(event);
  }
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  })));

  while (sqliteDisposables.length > 0) {
    const adapter = sqliteDisposables.pop();
    adapter?.dispose();
  }

  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

class ImageAssetStateStore {
  public state = Object.freeze({
    assetId: "image-asset:001",
    workspaceId: "workspace-alpha",
    ownerUserId: "user-owner",
    originKind: "uploaded-source" as const,
    mediaType: "image/png" as const,
    originalFilename: "image.png",
    normalizedFilename: "image.png",
    sizeBytes: 5,
    fingerprint: Object.freeze({
      algorithm: "sha256" as const,
      digest: "a".repeat(64),
    }),
    visibility: ResourceVisibilities.private,
    sharingPolicy: Object.freeze({
      mode: SharingPolicyModes.ownerOnly,
    }),
    storageInstanceId: "storage-alpha",
    storageBindingReference: "storage-instance://storage-alpha/image-assets",
    lifecycle: Object.freeze({
      status: ImageAssetStatuses.ingesting,
    }),
    createdBy: "user-owner",
    lastModifiedBy: "user-owner",
    createdAt: "2026-04-08T12:00:00.000Z",
    updatedAt: "2026-04-08T12:00:00.000Z",
  });
}

async function startServer(logger?: CapturingLogger): Promise<string> {
  const identityHarness = await createIdentityAuthTestHarness();
  const store = new ImageAssetStateStore();

  const imageAssetManagementBackendApi = new ImageAssetManagementBackendApi({
    uploadSessionTokenSecret: "image-asset-http-server-test-secret",
    initiateImageAssetCreationUseCase: {
      async execute() {
        return {
          ok: true as const,
          value: Object.freeze({
            imageAsset: store.state,
            upload: Object.freeze({
              status: "upload-pending" as const,
              reservation: Object.freeze({
                reservationId: "reservation-001",
                reference: Object.freeze({
                  storageInstanceId: "storage-alpha",
                  objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                  area: ImageAssetStorageObjectAreas.original,
                }),
                expiresAt: "2026-04-08T12:20:00.000Z",
              }),
            }),
          }),
        };
      },
    },
    finalizeImageAssetUploadUseCase: {
      async execute() {
        store.state = Object.freeze({
          ...store.state,
          lifecycle: Object.freeze({
            status: ImageAssetStatuses.available,
            ingestedAt: "2026-04-08T12:05:00.000Z",
          }),
          updatedAt: "2026-04-08T12:05:00.000Z",
        });
        return {
          ok: true as const,
          value: Object.freeze({
            imageAsset: store.state,
            upload: Object.freeze({
              status: "finalized" as const,
              reference: Object.freeze({
                storageInstanceId: "storage-alpha",
                objectKey: "workspaces/workspace-alpha/image-assets/image-asset-001/original/image.png",
                area: ImageAssetStorageObjectAreas.original,
              }),
              finalizedAt: "2026-04-08T12:05:00.000Z",
              observedSizeBytes: 5,
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
            asset: store.state,
          }),
        };
      },
    },
    listImageAssetMetadataUseCase: {
      async execute(request) {
        expect(request.ownerUserIds).toContain("user-owner");
        return {
          ok: true as const,
          value: Object.freeze({
            items: Object.freeze([store.state]),
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
            sizeBytes: 5,
            contentDisposition: "attachment" as const,
            contentDispositionFileName: "image.png",
            stream: (async function* stream() {
              yield Buffer.from("hello", "utf8");
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
              previewToken: "preview-token-http-001",
              expiresAt: "2026-04-08T12:10:00.000Z",
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
            sizeBytes: 5,
            contentDisposition: "inline" as const,
            contentDispositionFileName: "image.png",
            stream: (async function* stream() {
              yield Buffer.from("hello", "utf8");
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
          sizeBytes: 5,
          checksum: Object.freeze({
            algorithm: "sha256" as const,
            digest: "b".repeat(64),
          }),
          writtenAt: "2026-04-08T12:04:00.000Z",
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

  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    imageAssetManagementBackendApi,
    logger,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}`;
}

async function registerAndLogin(baseUrl: string, username: string): Promise<string> {
  const registerResponse = await fetch(`${baseUrl}/api/v1/identity/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(registerResponse.status).toBe(200);

  const loginResponse = await fetch(`${baseUrl}/api/v1/identity/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      providerSubject: username,
      credential: {
        candidate: "StrongPass!2026",
      },
    }),
  });
  expect(loginResponse.status).toBe(200);
  const loginBody = await loginResponse.json();
  return loginBody.data.sessionToken as string;
}

async function resolveSessionUserIdentityId(baseUrl: string, token: string): Promise<string> {
  const sessionResponse = await fetch(`${baseUrl}/api/v1/identity/session`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  expect(sessionResponse.status).toBe(200);
  const sessionBody = await sessionResponse.json();
  return sessionBody.data.user.id as string;
}

class InMemoryStorageObjectPort implements IStorageObjectPort {
  private readonly objects = new Map<string, {
    readonly bytes: Uint8Array;
    readonly writtenAt: string;
  }>();

  public createObjectKey(input: CreateStorageObjectKeyRequest): CreateStorageObjectKeyResult {
    const fileName = (input.originalFileName ?? "image.bin").trim().replace(/[^a-zA-Z0-9._-]/g, "-");
    return Object.freeze({
      objectKey: [
        input.namespace,
        ...input.logicalPathSegments,
        fileName,
      ].join("/"),
      normalizedFileName: fileName,
      partition: Object.freeze([]),
    });
  }

  public async writeObject(input: StorageObjectWriteRequest): Promise<StorageObjectWriteResult> {
    const chunks: Uint8Array[] = [];
    if (input.content instanceof Uint8Array) {
      chunks.push(input.content);
    } else {
      for await (const chunk of input.content) {
        chunks.push(chunk);
      }
    }

    const sizeBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const bytes = new Uint8Array(sizeBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const writtenAt = "2026-04-08T12:04:00.000Z";
    this.objects.set(this.key(input.reference), {
      bytes,
      writtenAt,
    });

    return Object.freeze({
      objectKey: input.reference.objectKey,
      sizeBytes,
      checksum: Object.freeze({
        algorithm: "sha256" as const,
        digest: createHash("sha256").update(bytes).digest("hex"),
      }),
      writtenAt,
    });
  }

  public async objectExists(reference: StorageObjectReference): Promise<boolean> {
    return this.objects.has(this.key(reference));
  }

  public async readObjectMetadata(reference: StorageObjectReference): Promise<StorageObjectMetadata> {
    const stored = this.objects.get(this.key(reference));
    if (!stored) {
      throw new Error("storage object not found");
    }

    return Object.freeze({
      objectKey: reference.objectKey,
      sizeBytes: stored.bytes.byteLength,
      lastModifiedAt: stored.writtenAt,
      checksum: Object.freeze({
        algorithm: "sha256" as const,
        digest: createHash("sha256").update(stored.bytes).digest("hex"),
      }),
    });
  }

  public async openObjectReadStream(reference: StorageObjectReference): Promise<AsyncIterable<Uint8Array>> {
    const stored = this.objects.get(this.key(reference));
    if (!stored) {
      throw new Error("storage object not found");
    }

    return (async function* stream() {
      yield stored.bytes;
    }());
  }

  public async deleteObject(input: StorageObjectDeleteRequest): Promise<StorageObjectDeleteResult> {
    const deletedAt = "2026-04-08T12:08:00.000Z";
    const deleted = this.objects.delete(this.key(input.reference));
    return Object.freeze({
      objectKey: input.reference.objectKey,
      deleted,
      deletedAt,
    });
  }

  private key(reference: StorageObjectReference): string {
    return `${reference.storageInstance.id}:${reference.objectKey}`;
  }
}

class StaticStorageLogicalAccessResolutionService implements IStorageLogicalAccessResolutionService {
  public constructor(
    private readonly storageInstance: StorageInstance,
    private readonly objectPort: IStorageObjectPort,
  ) {}

  public async resolveLogicalAccessPlan(
    command: Parameters<IStorageLogicalAccessResolutionService["resolveLogicalAccessPlan"]>[0],
  ): Promise<Awaited<ReturnType<IStorageLogicalAccessResolutionService["resolveLogicalAccessPlan"]>>> {
    if (command.workspaceId !== this.storageInstance.ownership.workspaceId) {
      return {
        ok: false,
        error: {
          code: "storage-logical-access-policy-violation",
          message: "workspace denied",
        },
      };
    }

    const requestedStorageInstanceId = command.storageInstanceId ?? command.storageInstanceRef;
    if (requestedStorageInstanceId && requestedStorageInstanceId !== this.storageInstance.id) {
      return {
        ok: false,
        error: {
          code: "storage-logical-access-not-found",
          message: "storage instance not found",
        },
      };
    }

    return {
      ok: true,
      value: Object.freeze({
        intent: command.intent,
        storageInstance: this.storageInstance,
        objectPort: this.objectPort,
        occurredAt: command.occurredAt ?? "2026-04-08T12:00:00.000Z",
      }),
    };
  }
}

class StaticStorageInstanceRepository implements IStorageInstanceRepository {
  public constructor(private readonly storageInstance: StorageInstance) {}

  public async findStorageInstanceById(storageInstanceId: string): Promise<StorageInstance | undefined> {
    return storageInstanceId === this.storageInstance.id ? this.storageInstance : undefined;
  }

  public async listStorageInstances(query: StorageInstanceListQuery): Promise<ReadonlyArray<StorageInstance>> {
    if (query.workspaceId && query.workspaceId !== this.storageInstance.ownership.workspaceId) {
      return Object.freeze([]);
    }
    return Object.freeze([this.storageInstance]);
  }

  public async createStorageInstance(): Promise<never> {
    throw new Error("not used");
  }

  public async saveStorageInstance(): Promise<never> {
    throw new Error("not used");
  }
}

class AllowAllStoragePolicyEvaluationPort implements IStoragePolicyEvaluationPort {
  public async evaluateStorageAction(input: Parameters<IStoragePolicyEvaluationPort["evaluateStorageAction"]>[0]) {
    return Object.freeze({
      allowed: true,
      reasonCode: `allowed:${input.action}`,
      occurredAt: input.occurredAt ?? "2026-04-08T12:00:00.000Z",
    });
  }

  public async resolveAccessibleStorageInstanceIds(
    input: Parameters<IStoragePolicyEvaluationPort["resolveAccessibleStorageInstanceIds"]>[0],
  ) {
    return Object.freeze(input.candidateStorageInstanceIds);
  }
}

class MutableWorkspaceAuthorizationReadRepository implements IWorkspaceAuthorizationReadRepository {
  private ownerUserIdentityId = "user-owner";

  private readonly activeMemberUserIdentityIds = new Set<string>();

  public setOwnerUserIdentityId(value: string): void {
    this.ownerUserIdentityId = value;
    this.activeMemberUserIdentityIds.add(value);
  }

  public setActiveMembers(userIdentityIds: ReadonlyArray<string>): void {
    this.activeMemberUserIdentityIds.clear();
    for (const userIdentityId of userIdentityIds) {
      this.activeMemberUserIdentityIds.add(userIdentityId);
    }
  }

  public async getWorkspaceAuthorizationSnapshot(query: WorkspaceAuthorizationSnapshotQuery): Promise<WorkspaceAuthorizationSnapshot | undefined> {
    if (query.workspaceId !== "workspace-alpha") {
      return undefined;
    }

    if (query.userIdentityId === this.ownerUserIdentityId) {
      const workspace = createWorkspace({
        id: "workspace-alpha",
        slug: "workspace-alpha",
        displayName: "Workspace Alpha",
        ownerUserId: this.ownerUserIdentityId,
        createdBy: this.ownerUserIdentityId,
        status: WorkspaceStatuses.active,
        now: new Date("2026-04-08T12:00:00.000Z"),
      });
      return Object.freeze({
        workspace,
        membership: undefined,
        activeRoleAssignments: Object.freeze([]),
        effectiveRoles: Object.freeze([WorkspaceRoles.owner]),
        isWorkspaceOwner: true,
      });
    }

    if (!this.activeMemberUserIdentityIds.has(query.userIdentityId)) {
      return undefined;
    }

    const workspace = createWorkspace({
      id: "workspace-alpha",
      slug: "workspace-alpha",
      displayName: "Workspace Alpha",
      ownerUserId: this.ownerUserIdentityId,
      createdBy: this.ownerUserIdentityId,
      status: WorkspaceStatuses.active,
      now: new Date("2026-04-08T12:00:00.000Z"),
    });

    return Object.freeze({
      workspace,
      membership: createWorkspaceMembership({
        id: `workspace-membership:${query.userIdentityId}`,
        workspaceId: "workspace-alpha",
        userIdentityId: query.userIdentityId,
        status: WorkspaceMembershipStatuses.active,
        invitedByUserId: this.ownerUserIdentityId,
        joinedAt: "2026-04-08T11:00:00.000Z",
        createdBy: this.ownerUserIdentityId,
        now: new Date("2026-04-08T11:00:00.000Z"),
      }),
      activeRoleAssignments: Object.freeze([]),
      effectiveRoles: Object.freeze([WorkspaceRoles.member]),
      isWorkspaceOwner: false,
    });
  }
}

class MutableAuthorizationPolicyDecisionEvaluator implements IAuthorizationPolicyDecisionEvaluator {
  public readonly calls: Array<{
    readonly actorUserIdentityId?: string;
    readonly targetKind: string;
  }> = [];

  private readonly deniedResourceInstanceActors = new Set<string>();

  public denyResourceInstanceForActor(actorUserIdentityId: string): void {
    this.deniedResourceInstanceActors.add(actorUserIdentityId);
  }

  public async evaluateDecision(
    request: Parameters<IAuthorizationPolicyDecisionEvaluator["evaluateDecision"]>[0],
  ): Promise<Awaited<ReturnType<IAuthorizationPolicyDecisionEvaluator["evaluateDecision"]>>> {
    const actorUserIdentityId = request.actor.actorUserIdentityId;
    const targetKind = request.target.kind;
    const denied = targetKind === "resource-instance"
      && !!actorUserIdentityId
      && this.deniedResourceInstanceActors.has(actorUserIdentityId);

    this.calls.push({
      actorUserIdentityId,
      targetKind,
    });

    return Object.freeze({
      decision: Object.freeze({
        isAllowed: !denied,
        outcome: denied ? "deny" as const : "allow" as const,
        requiredPermissionKey: request.requiredPermissionKey,
        reasonCode: denied ? "integration-test-policy-deny" : "integration-test-policy-allow",
        reason: denied ? "Denied by integration test policy evaluator." : "Allowed by integration test policy evaluator.",
        evaluatedAt: request.asOf ?? "2026-04-08T12:00:00.000Z",
        matchedRoleAssignmentIds: Object.freeze([]),
        matchedPermissionGrantIds: Object.freeze([]),
        matchedSharingGrantIds: Object.freeze([]),
      }),
    });
  }
}

class CapturingImageAssetAuditSink implements ImageAssetAuditSink {
  public readonly events: ImageAssetAuditEvent[] = [];

  public async recordImageAssetEvent(event: ImageAssetAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

interface ProductionImageAssetServerFixture {
  readonly baseUrl: string;
  readonly imageAssetPersistenceAdapter: SqliteImageAssetPersistenceAdapter;
  readonly workspaceAuthorizationReadRepository: MutableWorkspaceAuthorizationReadRepository;
  readonly authorizationPolicyDecisionEvaluator: MutableAuthorizationPolicyDecisionEvaluator;
  readonly auditSink: CapturingImageAssetAuditSink;
}

async function startProductionImageAssetServer(): Promise<ProductionImageAssetServerFixture> {
  const identityHarness = await createIdentityAuthTestHarness();

  const root = mkdtempSync(path.join(tmpdir(), "loom-image-asset-http-integration-"));
  createdRoots.push(root);
  const imageAssetPersistenceAdapter = new SqliteImageAssetPersistenceAdapter(path.join(root, "image-assets.sqlite"));
  sqliteDisposables.push(imageAssetPersistenceAdapter);
  const storageInstance = createStorageInstance({
    id: "storage-alpha",
    displayName: "Storage Alpha",
    backendType: StorageBackendTypes.managedFilesystem,
    lifecycleState: StorageLifecycleStates.active,
    ownership: {
      workspaceId: "workspace-alpha",
      ownerUserIdentityId: "user-owner",
    },
    access: {
      mode: StorageAccessModes.readWrite,
      scope: StorageAccessScopes.workspaceMembers,
    },
    policy: {
      policyId: "policy-storage-alpha",
      encryption: {
        profileId: "enc-default",
        envelopeRequired: true,
      },
    },
    createdBy: "user-owner",
    createdAt: "2026-04-08T11:00:00.000Z",
    lastCorrelationId: "corr:storage-alpha:create",
  });

  const workspaceAuthorizationReadRepository = new MutableWorkspaceAuthorizationReadRepository();
  const authorizationPolicyDecisionEvaluator = new MutableAuthorizationPolicyDecisionEvaluator();
  const auditSink = new CapturingImageAssetAuditSink();

  const imageAssetStorageAdapter = new ManagedImageAssetStorageAdapter({
    storageLogicalAccessResolutionService: new StaticStorageLogicalAccessResolutionService(
      storageInstance,
      new InMemoryStorageObjectPort(),
    ),
    tokenSecret: "image-asset-storage-token-secret:integration",
    reservationTtlSeconds: 300,
    accessHandleTtlSeconds: 300,
  });

  const imageAssetManagementBackendApi = new ImageAssetManagementBackendApi({
    uploadSessionTokenSecret: "image-asset-upload-session-secret:integration",
    initiateImageAssetCreationUseCase: new InitiateImageAssetCreationUseCase({
      imageAssetRepository: imageAssetPersistenceAdapter,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository,
      storageInstanceRepository: new StaticStorageInstanceRepository(storageInstance),
      storagePolicyEvaluationPort: new AllowAllStoragePolicyEvaluationPort(),
      authorizationPolicyDecisionEvaluator,
      auditSink,
    }),
    finalizeImageAssetUploadUseCase: new FinalizeImageAssetUploadUseCase({
      imageAssetRepository: imageAssetPersistenceAdapter,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository,
      auditSink,
    }),
    getImageAssetMetadataUseCase: new GetImageAssetMetadataUseCase({
      imageAssetRepository: imageAssetPersistenceAdapter,
      workspaceAuthorizationReadRepository,
      authorizationPolicyDecisionEvaluator,
    }),
    listImageAssetMetadataUseCase: new ListImageAssetMetadataUseCase({
      imageAssetRepository: imageAssetPersistenceAdapter,
      workspaceAuthorizationReadRepository,
      authorizationPolicyDecisionEvaluator,
    }),
    getImageAssetOriginalContentUseCase: new GetImageAssetOriginalContentUseCase({
      imageAssetRepository: imageAssetPersistenceAdapter,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository,
      authorizationPolicyDecisionEvaluator,
      auditSink,
    }),
    requestImageAssetPreviewContentUseCase: new RequestImageAssetPreviewContentUseCase({
      imageAssetRepository: imageAssetPersistenceAdapter,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository,
      authorizationPolicyDecisionEvaluator,
      auditSink,
    }),
    openImageAssetPreviewContentUseCase: new OpenImageAssetPreviewContentUseCase({
      imageAssetRepository: imageAssetPersistenceAdapter,
      imageAssetStoragePort: imageAssetStorageAdapter,
      workspaceAuthorizationReadRepository,
      authorizationPolicyDecisionEvaluator,
      auditSink,
    }),
    imageAssetStoragePort: imageAssetStorageAdapter,
  });

  const server = createIdentityHttpServer({
    backendApi: identityHarness.backendApi,
    imageAssetManagementBackendApi,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  servers.push(server);
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    imageAssetPersistenceAdapter,
    workspaceAuthorizationReadRepository,
    authorizationPolicyDecisionEvaluator,
    auditSink,
  };
}

describe("IdentityHttpServer image asset management routes", () => {
  it("enforces auth/workspace guards and serves create/upload/finalize/get/list flows", async () => {
    const logger = new CapturingLogger();
    const baseUrl = await startServer(logger);
    const token = await registerAndLogin(baseUrl, "image.asset.http.owner");

    const unauthenticated = await fetch(`${baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha`);
    expect(unauthenticated.status).toBe(401);
    const unauthenticatedOriginal = await fetch(`${baseUrl}/api/v1/image-assets/image-asset%3A001/original?workspaceId=workspace-alpha`);
    expect(unauthenticatedOriginal.status).toBe(401);

    const created = await fetch(`${baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mediaType: "image/png",
        originalFilename: "image.png",
        sizeBytes: 5,
        fingerprint: {
          algorithm: "sha256",
          digest: "a".repeat(64),
        },
      }),
    });
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    expect(createdBody.ok).toBe(true);
    const uploadEndpoint = createdBody.data.upload.uploadEndpoint as string;
    expect(uploadEndpoint).toContain("/api/v1/image-assets/image-asset%3A001/uploads/");

    const uploaded = await fetch(`${baseUrl}${uploadEndpoint}?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "image/png",
      },
      body: Buffer.from("hello", "utf8"),
    });
    expect(uploaded.status).toBe(200);
    const uploadedBody = await uploaded.json();
    expect(uploadedBody.ok).toBe(true);
    expect(uploadedBody.data.sizeBytes).toBe(5);

    const completeEndpoint = uploadEndpoint.replace("/content", "/complete");
    const finalized = await fetch(`${baseUrl}${completeEndpoint}?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(finalized.status).toBe(200);
    const finalizedBody = await finalized.json();
    expect(finalizedBody.ok).toBe(true);
    expect(finalizedBody.data.asset.lifecycle.status).toBe("available");

    const detail = await fetch(`${baseUrl}/api/v1/image-assets/image-asset%3A001?workspaceId=workspace-alpha`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(detail.status).toBe(200);
    const detailBody = await detail.json();
    expect(detailBody.ok).toBe(true);
    expect(detailBody.data.asset.assetId).toBe("image-asset:001");

    const listed = await fetch(`${baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha&status=available&ownerUserId=user-owner`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.ok).toBe(true);
    expect(listedBody.data.items).toHaveLength(1);

    const original = await fetch(`${baseUrl}/api/v1/image-assets/image-asset%3A001/original?workspaceId=workspace-alpha`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(original.status).toBe(200);
    expect(original.headers.get("content-type")).toBe("image/png");
    expect(original.headers.get("content-disposition")).toContain("attachment");
    expect(await original.text()).toBe("hello");

    const preview = await fetch(`${baseUrl}/api/v1/image-assets/image-asset%3A001/preview?workspaceId=workspace-alpha&representation=gallery&preferredMediaType=image%2Fpng`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(preview.status).toBe(200);
    const previewBody = await preview.json();
    expect(previewBody.ok).toBe(true);
    expect(previewBody.data.preview.status).toBe("available");
    expect(previewBody.data.preview.access.previewToken).toBe("preview-token-http-001");

    const previewContent = await fetch(`${baseUrl}/api/v1/image-assets/image-asset%3A001/preview/content?workspaceId=workspace-alpha&previewToken=preview-token-http-001`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    expect(previewContent.status).toBe(200);
    expect(previewContent.headers.get("content-type")).toBe("image/png");
    expect(previewContent.headers.get("content-disposition")).toContain("inline");
    expect(await previewContent.text()).toBe("hello");
    expect(
      logger.events.some((event) => event.event === "identity-http.route-family.modular-handled" && event.path === "/api/v1/image-assets"),
    ).toBeTrue();
  });

  it("runs end-to-end API-to-storage flows with persistence, policy seams, and audit hooks", async () => {
    const fixture = await startProductionImageAssetServer();
    const ownerToken = await registerAndLogin(fixture.baseUrl, "image.asset.integration.owner");
    const memberToken = await registerAndLogin(fixture.baseUrl, "image.asset.integration.member");
    const outsiderToken = await registerAndLogin(fixture.baseUrl, "image.asset.integration.outsider");

    const ownerUserIdentityId = await resolveSessionUserIdentityId(fixture.baseUrl, ownerToken);
    const memberUserIdentityId = await resolveSessionUserIdentityId(fixture.baseUrl, memberToken);
    const outsiderUserIdentityId = await resolveSessionUserIdentityId(fixture.baseUrl, outsiderToken);

    fixture.workspaceAuthorizationReadRepository.setOwnerUserIdentityId(ownerUserIdentityId);
    fixture.workspaceAuthorizationReadRepository.setActiveMembers([ownerUserIdentityId, memberUserIdentityId]);
    fixture.authorizationPolicyDecisionEvaluator.denyResourceInstanceForActor(memberUserIdentityId);

    const unauthenticatedList = await fetch(`${fixture.baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha`);
    expect(unauthenticatedList.status).toBe(401);

    const outsiderList = await fetch(`${fixture.baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha`, {
      headers: {
        authorization: `Bearer ${outsiderToken}`,
      },
    });
    expect(outsiderList.status).toBe(403);

    const created = await fetch(`${fixture.baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ownerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mediaType: "image/png",
        originalFilename: "original-source.png",
        sizeBytes: 5,
        fingerprint: {
          algorithm: "sha256",
          digest: createHash("sha256").update(Buffer.from("hello", "utf8")).digest("hex"),
        },
      }),
    });
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    expect(createdBody.ok).toBe(true);
    const assetId = createdBody.data.asset.assetId as string;
    const uploadSessionId = createdBody.data.upload.uploadSessionId as string;
    const uploadEndpoint = createdBody.data.upload.uploadEndpoint as string;
    expect(uploadEndpoint).toContain(`/api/v1/image-assets/${encodeURIComponent(assetId)}/uploads/`);
    expect(createdBody.data.asset.storage.storageInstanceId).toBe("storage-alpha");
    expect(createdBody.data.asset.storage.objectKey).toBeUndefined();

    const uploaded = await fetch(`${fixture.baseUrl}${uploadEndpoint}?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ownerToken}`,
        "content-type": "image/png",
      },
      body: Buffer.from("hello", "utf8"),
    });
    expect(uploaded.status).toBe(200);
    const uploadedBody = await uploaded.json();
    expect(uploadedBody.ok).toBe(true);
    expect(uploadedBody.data.sizeBytes).toBe(5);

    const finalized = await fetch(
      `${fixture.baseUrl}${uploadEndpoint.replace("/content", "/complete")}?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedSizeBytes: 5,
          expectedChecksumSha256: createHash("sha256").update(Buffer.from("hello", "utf8")).digest("hex"),
        }),
      },
    );
    expect(finalized.status).toBe(200);
    const finalizedBody = await finalized.json();
    expect(finalizedBody.ok).toBe(true);
    expect(finalizedBody.data.uploadSessionId).toBe(uploadSessionId);
    expect(finalizedBody.data.asset.lifecycle.status).toBe("available");
    expect(finalizedBody.data.asset.storage.objectKey).toBeUndefined();

    const metadata = await fetch(`${fixture.baseUrl}/api/v1/image-assets/${encodeURIComponent(assetId)}?workspaceId=workspace-alpha`, {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
    });
    expect(metadata.status).toBe(200);
    const metadataBody = await metadata.json();
    expect(metadataBody.ok).toBe(true);
    expect(metadataBody.data.asset.assetId).toBe(assetId);
    expect(metadataBody.data.asset.lifecycle.status).toBe("available");
    expect(metadataBody.data.asset.storage.storageBindingReference).toContain("storage-instance://storage-alpha");
    expect(metadataBody.data.asset.storage.objectKey).toBeUndefined();

    const listed = await fetch(`${fixture.baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha&status=available`, {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
    });
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.ok).toBe(true);
    expect(listedBody.data.items).toHaveLength(1);
    expect(listedBody.data.items[0]?.assetId).toBe(assetId);
    expect(listedBody.data.items[0]?.storage?.objectKey).toBeUndefined();

    const preview = await fetch(
      `${fixture.baseUrl}/api/v1/image-assets/${encodeURIComponent(assetId)}/preview?workspaceId=workspace-alpha&representation=gallery`,
      {
        headers: {
          authorization: `Bearer ${ownerToken}`,
        },
      },
    );
    expect(preview.status).toBe(200);
    const previewBody = await preview.json();
    expect(previewBody.ok).toBe(true);
    expect(previewBody.data.preview.status).toBe("available");
    const previewToken = previewBody.data.preview.access.previewToken as string;
    expect(previewBody.data.preview.access.contentEndpoint).toBe(`/api/v1/image-assets/${encodeURIComponent(assetId)}/preview/content`);

    const previewContent = await fetch(
      `${fixture.baseUrl}/api/v1/image-assets/${encodeURIComponent(assetId)}/preview/content?workspaceId=workspace-alpha&previewToken=${encodeURIComponent(previewToken)}`,
      {
        headers: {
          authorization: `Bearer ${ownerToken}`,
        },
      },
    );
    expect(previewContent.status).toBe(200);
    expect(previewContent.headers.get("content-type")).toBe("image/png");
    expect(previewContent.headers.get("content-disposition")).toContain("inline");
    expect(await previewContent.text()).toBe("hello");

    const original = await fetch(`${fixture.baseUrl}/api/v1/image-assets/${encodeURIComponent(assetId)}/original?workspaceId=workspace-alpha`, {
      headers: {
        authorization: `Bearer ${ownerToken}`,
      },
    });
    expect(original.status).toBe(200);
    expect(original.headers.get("content-type")).toBe("image/png");
    expect(original.headers.get("content-disposition")).toContain("attachment");
    expect(await original.text()).toBe("hello");

    const unauthorizedMetadata = await fetch(
      `${fixture.baseUrl}/api/v1/image-assets/${encodeURIComponent(assetId)}?workspaceId=workspace-alpha`,
      {
        headers: {
          authorization: `Bearer ${memberToken}`,
        },
      },
    );
    expect(unauthorizedMetadata.status).toBe(404);

    const unauthorizedOriginal = await fetch(
      `${fixture.baseUrl}/api/v1/image-assets/${encodeURIComponent(assetId)}/original?workspaceId=workspace-alpha`,
      {
        headers: {
          authorization: `Bearer ${memberToken}`,
        },
      },
    );
    expect(unauthorizedOriginal.status).toBe(404);

    const unauthorizedPreview = await fetch(
      `${fixture.baseUrl}/api/v1/image-assets/${encodeURIComponent(assetId)}/preview?workspaceId=workspace-alpha`,
      {
        headers: {
          authorization: `Bearer ${memberToken}`,
        },
      },
    );
    expect(unauthorizedPreview.status).toBe(404);

    const persisted = await fixture.imageAssetPersistenceAdapter.findImageAssetById(assetId, {
      includeDeleted: true,
    });
    expect(persisted?.assetId).toBe(assetId);
    expect(persisted?.workspaceId).toBe("workspace-alpha");
    expect(persisted?.ownerUserId).toBe(ownerUserIdentityId);
    expect(persisted?.lifecycle.status).toBe(ImageAssetStatuses.available);

    const originalReference = await fixture.imageAssetPersistenceAdapter.getImageAssetOriginalObjectReference(assetId);
    expect(originalReference?.storageInstanceId).toBe("storage-alpha");
    expect(originalReference?.objectKey).toContain("workspaces/workspace-alpha/image-assets/");

    const responseBodies = [
      JSON.stringify(createdBody),
      JSON.stringify(finalizedBody),
      JSON.stringify(metadataBody),
      JSON.stringify(listedBody),
      JSON.stringify(previewBody),
    ];
    for (const responseBody of responseBodies) {
      expect(responseBody.includes("\"objectKey\"")).toBeFalse();
      expect(responseBody.includes("\"objectVersionId\"")).toBeFalse();
      expect(responseBody.includes("filesystem_path")).toBeFalse();
      expect(responseBody.includes("raw_path")).toBeFalse();
    }

    const auditEventTypes = fixture.auditSink.events.map((event) => event.type);
    expect(auditEventTypes).toContain("image-asset-creation-initiated");
    expect(auditEventTypes).toContain("image-asset-upload-finalized");
    expect(auditEventTypes).toContain("image-asset-preview-access-requested");
    expect(auditEventTypes).toContain("image-asset-preview-content-opened");
    expect(auditEventTypes).toContain("image-asset-original-content-accessed");
    expect(fixture.auditSink.events.some((event) => (
      event.outcome === "rejected" && event.actorUserId === memberUserIdentityId
    ))).toBeTrue();

    const policyCallsForMember = fixture.authorizationPolicyDecisionEvaluator.calls.filter((call) => (
      call.actorUserIdentityId === memberUserIdentityId && call.targetKind === "resource-instance"
    ));
    expect(policyCallsForMember.length).toBeGreaterThan(0);

    expect(outsiderUserIdentityId).not.toBe(memberUserIdentityId);
  });

  it("supports studio reuse flow via protected original retrieval and canonical image-asset ids", async () => {
    const fixture = await startProductionImageAssetServer();
    const ownerToken = await registerAndLogin(fixture.baseUrl, "image.asset.integration.studio.owner");
    const ownerUserIdentityId = await resolveSessionUserIdentityId(fixture.baseUrl, ownerToken);

    fixture.workspaceAuthorizationReadRepository.setOwnerUserIdentityId(ownerUserIdentityId);
    fixture.workspaceAuthorizationReadRepository.setActiveMembers([ownerUserIdentityId]);

    const tinyPngBytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z2YcAAAAASUVORK5CYII=",
      "base64",
    );
    const tinyPngDigest = createHash("sha256").update(tinyPngBytes).digest("hex");

    const created = await fetch(`${fixture.baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ownerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mediaType: "image/png",
        originalFilename: "studio-reuse.png",
        sizeBytes: tinyPngBytes.byteLength,
        fingerprint: {
          algorithm: "sha256",
          digest: tinyPngDigest,
        },
      }),
    });
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    expect(createdBody.ok).toBe(true);
    const assetId = createdBody.data.asset.assetId as string;
    const uploadEndpoint = createdBody.data.upload.uploadEndpoint as string;
    const uploadSessionId = createdBody.data.upload.uploadSessionId as string;

    const uploaded = await fetch(`${fixture.baseUrl}${uploadEndpoint}?workspaceId=workspace-alpha`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${ownerToken}`,
        "content-type": "image/png",
      },
      body: tinyPngBytes,
    });
    expect(uploaded.status).toBe(200);

    const finalized = await fetch(
      `${fixture.baseUrl}${uploadEndpoint.replace("/content", "/complete")}?workspaceId=workspace-alpha`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          expectedSizeBytes: tinyPngBytes.byteLength,
          expectedChecksumSha256: tinyPngDigest,
        }),
      },
    );
    expect(finalized.status).toBe(200);

    const listed = await fetch(
      `${fixture.baseUrl}/api/v1/image-assets?workspaceId=workspace-alpha&status=available&ownerUserIdentityId=${encodeURIComponent(ownerUserIdentityId)}`,
      {
        headers: {
          authorization: `Bearer ${ownerToken}`,
        },
      },
    );
    expect(listed.status).toBe(200);
    const listedBody = await listed.json();
    expect(listedBody.ok).toBe(true);
    expect(listedBody.data.items.some((item: { readonly assetId: string }) => item.assetId === assetId)).toBeTrue();

    const original = await fetch(
      `${fixture.baseUrl}/api/v1/image-assets/${encodeURIComponent(assetId)}/original?workspaceId=workspace-alpha`,
      {
        headers: {
          authorization: `Bearer ${ownerToken}`,
        },
      },
    );
    expect(original.status).toBe(200);
    const originalBytes = new Uint8Array(await original.arrayBuffer());
    const payloadBase64 = Buffer.from(originalBytes).toString("base64");

    const studioApi = new StudioShellBackendApi(new InMemoryStudioShellRepository());
    const initialized = await studioApi.initializeStudio("studio-system", "System Studio");
    const createdDraft = await studioApi.createDraft({
      studioId: "studio-system",
      sessionId: initialized.data!.activeSessionId!,
      assetId: ReferenceImageSystemTemplate.systemAsset.assetId,
      content: JSON.stringify({ systemSpec: {} }),
      metadata: {
        title: "Reference image",
        tags: ["system"],
        taxonomy: {
          structuralKind: "system",
          semanticRole: "system",
          behaviorKind: "deterministic",
        },
      },
    });

    const ingested = await studioApi.ingestReferenceImageUpload({
      studioId: "studio-system",
      draftId: createdDraft.data!.draft!.draftId,
      fileName: "studio-reuse.png",
      mimeType: "image/png",
      payloadBase64,
      sourceImageAssetId: assetId,
      targetDatasetBindingId: "input-image-dataset",
    });

    expect(ingested.ok).toBeTrue();
    expect(ingested.data?.image.assetId).toBe(assetId);
    expect(ingested.data?.selectedRecordId).toBe(ingested.data?.recordId);
    expect(ingested.data?.datasetInstanceId).toBe("dataset-instance:reference-image:input");

    const inputItems = await studioApi.listReferenceImageDatasetItems({
      studioId: "studio-system",
      draftId: createdDraft.data!.draft!.draftId,
      datasetBindingId: "input-image-dataset",
      limit: 10,
      offset: 0,
    });
    expect(inputItems.ok).toBeTrue();
    expect(inputItems.data?.items[0]?.image.imageReference).toBe(assetId);
    expect(inputItems.data?.items[0]?.image.imageReference).not.toContain("/uploads/");
    expect(uploadSessionId.length).toBeGreaterThan(0);
  });
});
