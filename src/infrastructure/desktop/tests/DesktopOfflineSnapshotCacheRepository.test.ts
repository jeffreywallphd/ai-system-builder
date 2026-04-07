import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DesktopOfflineSnapshotCacheRepository } from "../DesktopOfflineSnapshotCacheRepository";
import {
  computeOfflineSnapshotDigest,
  OfflineSnapshotCacheProtectionPostures,
  type OfflineAuthoritativeSnapshotRecord,
} from "@application/common/OfflineAuthoritativeSnapshotCache";
import {
  OfflineAuthorityScopes,
  OfflineDeviceTrustPostures,
  OfflineResourceClasses,
  OfflineSensitivityMarkings,
  OfflineStorageRules,
  OfflineWorkspaceAccessRoles,
  OfflineWorkspaceSharingPostures,
} from "@domain/platform/OfflineLocalModeBoundaries";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop()!, { recursive: true, force: true });
  }
});

function createSnapshotRecord(input: {
  readonly workspaceId: string;
  readonly resourceId: string;
  readonly cachedAt: string;
}): OfflineAuthoritativeSnapshotRecord {
  return Object.freeze({
    workspaceId: input.workspaceId,
    resourceClass: OfflineResourceClasses.workflowDefinition,
    resourceId: input.resourceId,
    authoritativeRevision: `rev-${input.resourceId}`,
    authoritativeSnapshotRevision: `snapshot-${input.resourceId}`,
    authorityScope: OfflineAuthorityScopes.authoritativeServer,
    storageBucket: "offline-cache",
    behaviorClass: "cached-read-only",
    cachedAt: input.cachedAt,
    lastSynchronizedAt: input.cachedAt,
    cachedByActorUserIdentityId: "user-1",
    cacheProtectionPosture: OfflineSnapshotCacheProtectionPostures.unprotectedAtRest,
    snapshotDigest: computeOfflineSnapshotDigest({
      id: input.resourceId,
      kind: "workflow-definition",
    }),
    eligibilityMarkers: Object.freeze({
      workspaceVisibility: WorkspaceVisibilities.private,
      workspaceAccessRole: OfflineWorkspaceAccessRoles.owner,
      workspaceSharingPosture: OfflineWorkspaceSharingPostures.workspaceOnly,
      sensitivityMarking: OfflineSensitivityMarkings.standard,
      storageRule: OfflineStorageRules.allowOfflineCache,
      deviceTrustPosture: OfflineDeviceTrustPostures.trusted,
      exclusionReasons: Object.freeze([]),
    }),
    snapshot: Object.freeze({
      id: input.resourceId,
      kind: "workflow-definition",
    }),
  });
}

describe("DesktopOfflineSnapshotCacheRepository", () => {
  it("persists and retrieves authoritative snapshot records with metadata integrity checks", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-cache-"));
    tempRoots.push(root);

    const repository = new DesktopOfflineSnapshotCacheRepository({
      databasePath: path.join(root, "offline-cache.sqlite"),
      maxEntries: 10,
      supportsProtectedAtRestStorage: false,
    });

    await repository.upsertSnapshot(createSnapshotRecord({
      workspaceId: "workspace-a",
      resourceId: "wf-1",
      cachedAt: "2026-04-07T19:00:00.000Z",
    }));

    const loaded = await repository.findSnapshot({
      workspaceId: "workspace-a",
      resourceClass: OfflineResourceClasses.workflowDefinition,
      resourceId: "wf-1",
    });

    expect(loaded).toBeDefined();
    expect(loaded?.workspaceId).toBe("workspace-a");
    expect(loaded?.snapshot.id).toBe("wf-1");
    expect(loaded?.eligibilityMarkers.workspaceAccessRole).toBe("owner");
    expect(loaded?.cacheProtectionPosture).toBe("unprotected-at-rest");
    repository.dispose();
  });

  it("enforces retention limits to avoid uncontrolled cache growth", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-loom-offline-cache-retention-"));
    tempRoots.push(root);

    const repository = new DesktopOfflineSnapshotCacheRepository({
      databasePath: path.join(root, "offline-cache.sqlite"),
      maxEntries: 2,
    });

    await repository.upsertSnapshot(createSnapshotRecord({
      workspaceId: "workspace-a",
      resourceId: "wf-1",
      cachedAt: "2026-04-07T18:00:00.000Z",
    }));
    await repository.upsertSnapshot(createSnapshotRecord({
      workspaceId: "workspace-a",
      resourceId: "wf-2",
      cachedAt: "2026-04-07T18:01:00.000Z",
    }));
    await repository.upsertSnapshot(createSnapshotRecord({
      workspaceId: "workspace-a",
      resourceId: "wf-3",
      cachedAt: "2026-04-07T18:02:00.000Z",
    }));

    const snapshots = await repository.listWorkspaceSnapshots("workspace-a");
    expect(snapshots.length).toBe(2);
    expect(snapshots.map((entry) => entry.resourceId)).toEqual(["wf-3", "wf-2"]);
    repository.dispose();
  });
});
