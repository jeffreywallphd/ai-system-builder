import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  AuthProviderCategories,
  AuthProviderKinds,
  IdentitySessionAccessChannels,
  createAuthProvider,
  createSession,
  createUserIdentity,
} from "../../../domain/identity/IdentityDomain";
import {
  DevicePairingMethods,
  DeviceTrustMaterialKinds,
  DeviceTrustStatuses,
  createDeviceFingerprint,
  createDeviceTrustMaterialRef,
  createTrustedDevice,
} from "../../../domain/identity/TrustedDeviceDomain";
import {
  WorkspaceStatuses,
  createWorkspace,
} from "../../../domain/workspaces/WorkspaceDomain";
import {
  NodeApprovalStatuses,
  NodeEnrollmentRequestStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
} from "../../../domain/nodes/NodeTrustDomain";
import {
  StorageAccessModes,
  StorageAccessScopes,
  StorageBackendTypes,
  StorageLifecycleStates,
  createStorageAttribution,
  createStorageInstance,
  transitionStorageLifecycle,
} from "../../../domain/storage/StorageDomain";
import {
  PlatformAuditEventKinds,
} from "../../../application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  createAuthoritativePersistentPlatformServices,
} from "../AuthoritativePersistenceComposition";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

describe("PersistentPlatformServices integration", () => {
  it("persists and reloads representative identity/workspace/device/node/storage/run/audit flows", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "loom-persistent-platform-integration-"));
    createdRoots.push(root);
    const databasePath = path.join(root, "authoritative.sqlite");

    const services = createAuthoritativePersistentPlatformServices({ databasePath });
    try {
      const provider = await services.identityRepository.saveAuthProvider(createAuthProvider({
        id: "provider:local-password",
        kind: AuthProviderKinds.localPassword,
        category: AuthProviderCategories.local,
        displayName: "Local Password",
      }));

      const user = await services.identityRepository.saveUserIdentity(createUserIdentity({
        id: "user:story-13.4.3",
        username: "story-user",
        email: "story-user@example.com",
        status: "active",
        linkedProviders: [{
          providerId: provider.id,
          providerSubject: "story-user",
          isPrimary: true,
          linkedAt: "2026-04-06T12:00:00.000Z",
        }],
      }));

      const workspace = await services.workspaceRepository.saveWorkspace(createWorkspace({
        id: "workspace:story-13.4.3",
        slug: "story-13-4-3",
        displayName: "Story 13.4.3 Workspace",
        ownerUserId: user.id,
        createdBy: user.id,
        status: WorkspaceStatuses.active,
        now: new Date("2026-04-06T12:01:00.000Z"),
      }));

      const trustedDevice = await services.trustedDeviceRepository.createTrustedDevice(createTrustedDevice({
        id: "trusted-device:story-13.4.3",
        userIdentityId: user.id,
        workspaceId: workspace.id,
        displayName: "Story Test Device",
        fingerprint: createDeviceFingerprint({
          algorithm: "sha256",
          value: "fingerprint:story-13.4.3",
          capturedAt: "2026-04-06T12:02:00.000Z",
        }),
        pairingMethod: DevicePairingMethods.oneTimeCode,
        trustStatus: DeviceTrustStatuses.trusted,
        trustMaterialRef: createDeviceTrustMaterialRef({
          materialId: "trust-material:story-13.4.3",
          kind: DeviceTrustMaterialKinds.sessionSigningKey,
          issuedAt: "2026-04-06T12:02:00.000Z",
        }),
        registeredAt: "2026-04-06T12:02:00.000Z",
        pairedAt: "2026-04-06T12:02:00.000Z",
        updatedAt: "2026-04-06T12:02:00.000Z",
      }));

      const session = await services.identityRepository.saveSession(createSession({
        id: "session:story-13.4.3",
        userIdentityId: user.id,
        providerId: provider.id,
        providerSubject: "story-user",
        issuedAt: new Date("2026-04-06T12:03:00.000Z"),
        expiresAt: new Date("2026-04-06T13:03:00.000Z"),
        client: {
          accessChannel: IdentitySessionAccessChannels.thinClient,
          trustedDeviceBindingId: trustedDevice.id,
          trustMarker: "trust-marker:story-13.4.3",
        },
      }));

      await services.identityRepository.saveSessionTokenMaterial({
        sessionId: session.id,
        tokenHash: "token-hash:session-story-13.4.3",
        hashAlgorithm: "sha256",
        tokenType: "opaque-bearer",
        createdAt: "2026-04-06T12:03:00.000Z",
        updatedAt: "2026-04-06T12:03:00.000Z",
        expiresAt: "2026-04-06T13:03:00.000Z",
      });

      const enrolledNode = await services.nodeTrustRepository.registerNode({
        record: {
          nodeId: "node:story-13.4.3:worker",
          nodeType: NodeTypes.compute,
          displayName: "Story Worker Node",
          capabilityProfile: {
            enabledCapabilities: [NodeRoleCapabilities.executor],
            supportsRemoteScheduling: true,
          },
          approvalStatus: NodeApprovalStatuses.pending,
          trustState: NodeTrustStates.pendingApproval,
          deploymentTags: ["story", "13-4-3"],
          revocation: { state: NodeRevocationStates.active },
          enrolledAt: "2026-04-06T12:04:00.000Z",
          createdAt: "2026-04-06T12:04:00.000Z",
          createdBy: user.id,
          lastModifiedAt: "2026-04-06T12:04:00.000Z",
          lastModifiedBy: user.id,
          revision: 0,
        },
        mutation: {
          operationKey: "op:story-13.4.3:node:create",
          context: {
            actorUserIdentityId: user.id,
            workspaceId: workspace.id,
            occurredAt: "2026-04-06T12:04:00.000Z",
          },
        },
      });
      expect(enrolledNode.changed).toBeTrue();

      const enrollmentRequest = await services.nodeTrustRepository.saveEnrollmentRequest({
        record: {
          requestId: "enrollment:story-13.4.3",
          nodeId: "node:story-13.4.3:worker",
          nodeType: NodeTypes.compute,
          displayName: "Story Worker Node",
          capabilityProfile: {
            enabledCapabilities: [NodeRoleCapabilities.executor],
            supportsRemoteScheduling: true,
          },
          deploymentTags: ["story", "13-4-3"],
          requestedAt: "2026-04-06T12:05:00.000Z",
          status: NodeEnrollmentRequestStatuses.submitted,
          createdAt: "2026-04-06T12:05:00.000Z",
          createdBy: user.id,
          lastModifiedAt: "2026-04-06T12:05:00.000Z",
          lastModifiedBy: user.id,
          revision: 0,
        },
        mutation: {
          operationKey: "op:story-13.4.3:enrollment:create",
          context: {
            actorUserIdentityId: user.id,
            workspaceId: workspace.id,
            occurredAt: "2026-04-06T12:05:00.000Z",
          },
        },
      });
      expect(enrollmentRequest.changed).toBeTrue();

      const storage = createStorageInstance({
        id: "storage:story-13.4.3",
        displayName: "Story Storage",
        backendType: StorageBackendTypes.managedFilesystem,
        ownership: {
          workspaceId: workspace.id,
          ownerUserIdentityId: user.id,
        },
        access: {
          mode: StorageAccessModes.readWrite,
          scope: StorageAccessScopes.workspaceMembers,
        },
        lifecycleState: StorageLifecycleStates.provisioning,
        policy: {
          policyId: "policy:storage:story-13.4.3",
          encryption: {
            profileId: "profile:default",
            envelopeRequired: true,
          },
        },
        createdBy: user.id,
        createdAt: "2026-04-06T12:06:00.000Z",
        lastCorrelationId: "corr:story-13.4.3:storage:create",
      });

      const createdStorage = await services.storageInstanceRepository.createStorageInstance(storage, {
        operationKey: "op:story-13.4.3:storage:create",
        actorUserIdentityId: user.id,
        workspaceId: workspace.id,
        occurredAt: "2026-04-06T12:06:00.000Z",
        correlationId: "corr:story-13.4.3:storage:create",
      });
      expect(createdStorage.changed).toBeTrue();

      const activeStorage = transitionStorageLifecycle(
        storage,
        StorageLifecycleStates.active,
        createStorageAttribution({
          actorUserIdentityId: user.id,
          occurredAt: "2026-04-06T12:06:30.000Z",
          correlationId: "corr:story-13.4.3:storage:activate",
        }),
      );
      const savedStorage = await services.storageInstanceRepository.saveStorageInstance(activeStorage, {
        operationKey: "op:story-13.4.3:storage:activate",
        actorUserIdentityId: user.id,
        workspaceId: workspace.id,
        occurredAt: "2026-04-06T12:06:30.000Z",
        correlationId: "corr:story-13.4.3:storage:activate",
      });
      expect(savedStorage.storageInstance.lifecycleState).toBe(StorageLifecycleStates.active);

      const createdRun = await services.platformPersistenceRepository.createRun({
        runId: "run:story-13.4.3",
        runKind: "workflow",
        status: "pending",
        workspaceId: workspace.id,
        userIdentityId: user.id,
        sourceAggregateRef: "workflow:story-13.4.3",
        initiatedAt: "2026-04-06T12:07:00.000Z",
        metadata: {
          trigger: "manual",
        },
        revision: 0,
      }, {
        operationKey: "op:story-13.4.3:run:create",
        actorId: user.id,
        occurredAt: "2026-04-06T12:07:00.000Z",
        correlationId: "corr:story-13.4.3:run",
      });
      expect(createdRun.record.revision).toBe(1);

      const completedRun = await services.platformPersistenceRepository.saveRun({
        ...createdRun.record,
        status: "completed",
        startedAt: "2026-04-06T12:07:10.000Z",
        completedAt: "2026-04-06T12:08:00.000Z",
        terminalReason: "succeeded",
        revision: createdRun.record.revision,
      }, {
        operationKey: "op:story-13.4.3:run:complete",
        actorId: "system:orchestrator",
        occurredAt: "2026-04-06T12:08:00.000Z",
        expectedRevision: createdRun.record.revision,
        correlationId: "corr:story-13.4.3:run",
      });
      expect(completedRun.record.status).toBe("completed");

      const appendedAudit = await services.platformPersistenceRepository.appendAuditEvent({
        eventId: "audit:story-13.4.3",
        eventKind: PlatformAuditEventKinds.runs,
        action: "run.completed",
        actorId: "system:orchestrator",
        workspaceId: workspace.id,
        userIdentityId: user.id,
        targetRef: "run:story-13.4.3",
        outcome: "succeeded",
        occurredAt: "2026-04-06T12:08:01.000Z",
        correlationId: "corr:story-13.4.3:run",
        details: {
          runId: "run:story-13.4.3",
          status: "completed",
        },
      }, {
        operationKey: "op:story-13.4.3:audit:append",
        actorId: "system:orchestrator",
        occurredAt: "2026-04-06T12:08:01.000Z",
        correlationId: "corr:story-13.4.3:run",
      });
      expect(appendedAudit.changed).toBeTrue();
    } finally {
      services.dispose();
    }

    const reloadedServices = createAuthoritativePersistentPlatformServices({ databasePath });
    try {
      expect((await reloadedServices.identityRepository.findUserIdentityById("user:story-13.4.3"))?.email)
        .toBe("story-user@example.com");
      expect((await reloadedServices.workspaceRepository.findWorkspaceById("workspace:story-13.4.3"))?.slug)
        .toBe("story-13-4-3");
      expect((await reloadedServices.trustedDeviceRepository.getTrustedDeviceById("trusted-device:story-13.4.3"))?.trustStatus)
        .toBe(DeviceTrustStatuses.trusted);
      expect((await reloadedServices.identityRepository.getSessionById("session:story-13.4.3"))?.client?.trustedDeviceBindingId)
        .toBe("trusted-device:story-13.4.3");

      const pendingEnrollment = await reloadedServices.nodeTrustRepository.findPendingEnrollmentRequestByNodeId(
        "node:story-13.4.3:worker",
      );
      expect(pendingEnrollment?.requestId).toBe("enrollment:story-13.4.3");

      expect((await reloadedServices.storageInstanceRepository.findStorageInstanceById("storage:story-13.4.3"))?.lifecycleState)
        .toBe(StorageLifecycleStates.active);

      const runs = await reloadedServices.platformPersistenceRepository.listRuns({
        workspaceId: "workspace:story-13.4.3",
        statuses: ["completed"],
      });
      expect(runs).toHaveLength(1);
      expect(runs[0]?.runId).toBe("run:story-13.4.3");

      const auditEvents = await reloadedServices.platformPersistenceRepository.listAuditEvents({
        eventKinds: [PlatformAuditEventKinds.runs],
        workspaceId: "workspace:story-13.4.3",
      });
      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]?.eventId).toBe("audit:story-13.4.3");
    } finally {
      reloadedServices.dispose();
    }
  });
});
