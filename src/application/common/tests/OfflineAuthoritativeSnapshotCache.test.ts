import { describe, expect, it } from "bun:test";
import {
  type IOfflineAuthoritativeSnapshotCacheRepository,
  type OfflineAuthoritativeSnapshotCacheKey,
  type OfflineAuthoritativeSnapshotRecord,
  OfflineAuthoritativeSnapshotCacheError,
  OfflineAuthoritativeSnapshotCacheService,
  OfflineSnapshotCacheProtectionPostures,
} from "../OfflineAuthoritativeSnapshotCache";
import {
  OfflineResourceClasses,
  OfflineSensitivityMarkings,
  OfflineStorageRules,
  OfflineWorkspaceAccessRoles,
  OfflineWorkspaceSharingPostures,
  type OfflineResourcePolicyEvaluationInput,
  OfflineDeviceTrustPostures,
} from "@domain/platform/OfflineLocalModeBoundaries";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";

class InMemoryOfflineAuthoritativeSnapshotCacheRepository
implements IOfflineAuthoritativeSnapshotCacheRepository {
  private readonly records = new Map<string, OfflineAuthoritativeSnapshotRecord>();

  constructor(private readonly supportsProtectedAtRestStorage: boolean) {}

  public getCapabilities() {
    return Object.freeze({
      supportsProtectedAtRestStorage: this.supportsProtectedAtRestStorage,
      maxEntries: 100,
    });
  }

  public async upsertSnapshot(record: OfflineAuthoritativeSnapshotRecord): Promise<void> {
    this.records.set(this.keyOf(record), record);
  }

  public async findSnapshot(
    key: OfflineAuthoritativeSnapshotCacheKey,
  ): Promise<OfflineAuthoritativeSnapshotRecord | undefined> {
    return this.records.get(this.keyOf(key));
  }

  public async listWorkspaceSnapshots(workspaceId: string): Promise<ReadonlyArray<OfflineAuthoritativeSnapshotRecord>> {
    return Object.freeze(
      [...this.records.values()].filter((record) => record.workspaceId === workspaceId),
    );
  }

  public async deleteSnapshot(key: OfflineAuthoritativeSnapshotCacheKey): Promise<boolean> {
    return this.records.delete(this.keyOf(key));
  }

  private keyOf(key: OfflineAuthoritativeSnapshotCacheKey): string {
    return `${key.workspaceId}::${key.resourceClass}::${key.resourceId}`;
  }
}

function createPolicy(overrides?: Partial<OfflineResourcePolicyEvaluationInput>): OfflineResourcePolicyEvaluationInput {
  return Object.freeze({
    workspaceVisibility: WorkspaceVisibilities.private,
    workspaceAccessRole: OfflineWorkspaceAccessRoles.owner,
    workspaceSharingPosture: OfflineWorkspaceSharingPostures.workspaceOnly,
    sensitivityMarking: OfflineSensitivityMarkings.standard,
    storageRule: OfflineStorageRules.allowOfflineCache,
    deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
    ...(overrides ?? {}),
  });
}

describe("OfflineAuthoritativeSnapshotCacheService", () => {
  it("persists and retrieves authoritative snapshots with sync metadata", async () => {
    const service = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(true),
    );

    const cached = await service.cacheSnapshot({
      workspaceId: "workspace-a",
      resourceClass: OfflineResourceClasses.workflowDefinition,
      resourceId: "workflow-1",
      authoritativeRevision: "rev-9",
      authoritativeSnapshotRevision: "rev-8",
      snapshot: Object.freeze({
        workflowId: "workflow-1",
        nodes: 12,
      }),
      policy: createPolicy({
        storageRule: OfflineStorageRules.requireEncryptedOfflineCache,
        sensitivityMarking: OfflineSensitivityMarkings.sensitive,
      }),
      cachedByActorUserIdentityId: "user-1",
      cachedAt: "2026-04-07T18:00:00.000Z",
      lastSynchronizedAt: "2026-04-07T18:05:00.000Z",
    });

    expect(cached.cacheProtectionPosture).toBe(OfflineSnapshotCacheProtectionPostures.protectedAtRest);
    expect(cached.eligibilityMarkers.storageRule).toBe(OfflineStorageRules.requireEncryptedOfflineCache);
    expect(cached.snapshotDigest.length).toBe(64);

    const loaded = await service.getSnapshot({
      workspaceId: "workspace-a",
      resourceClass: OfflineResourceClasses.workflowDefinition,
      resourceId: "workflow-1",
    });
    expect(loaded?.authoritativeRevision).toBe("rev-9");
    expect(loaded?.lastSynchronizedAt).toBe("2026-04-07T18:05:00.000Z");
    expect(loaded?.snapshot.workflowId).toBe("workflow-1");
  });

  it("rejects resource classes that are not server-authoritative snapshots", async () => {
    const service = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(true),
    );

    await expect(
      service.cacheSnapshot({
        workspaceId: "workspace-a",
        resourceClass: OfflineResourceClasses.workflowDraft,
        resourceId: "draft-1",
        authoritativeRevision: "rev-1",
        snapshot: Object.freeze({ draftId: "draft-1" }),
        policy: createPolicy(),
        cachedByActorUserIdentityId: "user-1",
      }),
    ).rejects.toThrow(OfflineAuthoritativeSnapshotCacheError);
  });

  it("rejects cache writes when policy requires protected-at-rest storage but repository cannot provide it", async () => {
    const service = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(false),
    );

    await expect(
      service.cacheSnapshot({
        workspaceId: "workspace-a",
        resourceClass: OfflineResourceClasses.workflowDefinition,
        resourceId: "workflow-1",
        authoritativeRevision: "rev-1",
        snapshot: Object.freeze({ workflowId: "workflow-1" }),
        policy: createPolicy({
          storageRule: OfflineStorageRules.requireEncryptedOfflineCache,
          sensitivityMarking: OfflineSensitivityMarkings.sensitive,
        }),
        cachedByActorUserIdentityId: "user-1",
      }),
    ).rejects.toThrow("requires protected-at-rest storage");
  });

  it("rejects logical snapshots that attempt to persist filesystem references", async () => {
    const service = new OfflineAuthoritativeSnapshotCacheService(
      new InMemoryOfflineAuthoritativeSnapshotCacheRepository(true),
    );

    await expect(
      service.cacheSnapshot({
        workspaceId: "workspace-a",
        resourceClass: OfflineResourceClasses.workspaceCatalog,
        resourceId: "catalog-1",
        authoritativeRevision: "rev-1",
        snapshot: Object.freeze({
          catalogId: "catalog-1",
          leakedPath: "C:\\Users\\jeffr\\secret.txt",
        }),
        policy: createPolicy(),
        cachedByActorUserIdentityId: "user-1",
      }),
    ).rejects.toThrow("cannot store filesystem references");
  });
});
