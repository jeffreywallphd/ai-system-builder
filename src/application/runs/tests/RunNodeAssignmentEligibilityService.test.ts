import { describe, expect, it } from "bun:test";
import { PlatformRunStatuses, type PlatformRunRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  RunAssignmentIneligibilityCodes,
  type IRunAssignmentNodeCatalogPort,
  type IRunAssignmentPolicyPort,
  type RunAssignmentRequirementSet,
  type RunAssignmentPolicyEvaluationResult,
} from "@application/runs/ports/RunAssignmentEligibilityPorts";
import type { AuthoritativeRunQueueEntryRecord } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { RunSubmissionSecurityPrerequisiteKinds } from "@application/runs/ports/RunSubmissionValidationPorts";
import { RunNodeAssignmentEligibilityService } from "@application/runs/use-cases/RunNodeAssignmentEligibilityService";
import { RunLifecycleStates, RunSubmissionSources, createCanonicalRunRecord } from "@domain/runs/RunDomain";
import {
  NodeApprovalStatuses,
  NodeHeartbeatStatuses,
  NodeRevocationStates,
  NodeRoleCapabilities,
  NodeTrustStates,
} from "@domain/nodes/NodeTrustDomain";
import type { RunAuthoritativeMetadata } from "@application/runs/use-cases/RunCreationPersistenceMapper";
import type { NodeIdentityPersistenceRecord } from "@shared/dto/nodes/NodeTrustPersistenceDtos";

class InMemoryNodeCatalog implements IRunAssignmentNodeCatalogPort {
  public readonly nodes = new Map<string, NodeIdentityPersistenceRecord>();

  public async findNodeById(nodeId: string): Promise<NodeIdentityPersistenceRecord | undefined> {
    return this.nodes.get(nodeId);
  }
}

class DenyWorkspacePolicyPort implements IRunAssignmentPolicyPort {
  public async evaluateNodeAssignmentPreconditions(input: {
    readonly asOf: string;
    readonly run: PlatformRunRecord;
    readonly queueEntry: AuthoritativeRunQueueEntryRecord;
    readonly node: NodeIdentityPersistenceRecord;
    readonly requirements: RunAssignmentRequirementSet;
  }): Promise<RunAssignmentPolicyEvaluationResult> {
    if (input.requirements.workspaceId === "workspace-denied") {
      return Object.freeze({
        allowed: false,
        reasons: Object.freeze([
          Object.freeze({
            code: RunAssignmentIneligibilityCodes.policyDenied,
            message: "Workspace policy denied this node assignment.",
          }),
        ]),
      });
    }

    return Object.freeze({
      allowed: true,
    });
  }
}

function createNodeRecord(input?: Partial<NodeIdentityPersistenceRecord>): NodeIdentityPersistenceRecord {
  const now = "2026-04-07T12:00:00.000Z";
  return Object.freeze({
    nodeId: input?.nodeId ?? "node-trusted",
    nodeType: input?.nodeType ?? "compute",
    displayName: input?.displayName ?? "Trusted node",
    capabilityProfile: input?.capabilityProfile ?? Object.freeze({
      enabledCapabilities: Object.freeze([
        NodeRoleCapabilities.executor,
        NodeRoleCapabilities.storageAccess,
        NodeRoleCapabilities.previewWorker,
      ]),
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 4,
    }),
    approvalStatus: input?.approvalStatus ?? NodeApprovalStatuses.approved,
    trustState: input?.trustState ?? NodeTrustStates.trusted,
    certificate: input?.certificate ?? Object.freeze({
      certificateRef: "cert:node-trusted",
      certificateAssignedAt: now,
    }),
    deploymentTags: input?.deploymentTags ?? Object.freeze(["region-east"]),
    lastSeen: input?.lastSeen ?? Object.freeze({
      lastSeenAt: now,
      heartbeatStatus: NodeHeartbeatStatuses.online,
      observedBy: "system:heartbeat",
    }),
    revocation: input?.revocation ?? Object.freeze({
      state: NodeRevocationStates.active,
    }),
    enrolledAt: input?.enrolledAt ?? now,
    approvedAt: input?.approvedAt ?? now,
    revokedAt: input?.revokedAt,
    enrollmentRequestId: input?.enrollmentRequestId,
    createdAt: input?.createdAt ?? now,
    createdBy: input?.createdBy ?? "admin:user",
    lastModifiedAt: input?.lastModifiedAt ?? now,
    lastModifiedBy: input?.lastModifiedBy ?? "admin:user",
    revision: input?.revision ?? 1,
  });
}

function createRunRecord(input?: {
  readonly runId?: string;
  readonly workspaceId?: string;
  readonly async?: boolean;
  readonly includeStorageReferences?: boolean;
  readonly includePreviewPolicyPrerequisite?: boolean;
  readonly omitSubmissionSnapshot?: boolean;
}): PlatformRunRecord {
  const runId = input?.runId ?? "run-1";
  const workspaceId = input?.workspaceId ?? "workspace-alpha";
  const canonicalRun = createCanonicalRunRecord({
    identity: {
      runId,
      workflowId: `workflow:${runId}`,
      workspaceId,
    },
    submission: {
      source: RunSubmissionSources.api,
      submittedAt: "2026-04-07T10:00:00.000Z",
      submittedByActorId: "user-alpha",
    },
    state: RunLifecycleStates.queued,
    queue: Object.freeze({
      queueId: "queue:default",
      enteredAt: "2026-04-07T10:00:00.000Z",
      position: null,
      positionAsOf: "2026-04-07T10:00:00.000Z",
    }),
    assignment: Object.freeze({
      status: "unassigned",
    }),
    execution: Object.freeze({
      outcome: "none",
    }),
    retry: Object.freeze({
      attempt: 1,
      maxAttempts: 1,
    }),
    updatedAt: "2026-04-07T10:00:00.000Z",
  });

  if (input?.omitSubmissionSnapshot) {
    return Object.freeze({
      runId,
      runKind: "workflow",
      status: PlatformRunStatuses.pending,
      workspaceId,
      userIdentityId: "user-alpha",
      sourceAggregateRef: `workflow:${runId}`,
      initiatedAt: "2026-04-07T10:00:00.000Z",
      metadata: Object.freeze({
        schemaVersion: 1,
        canonicalRun,
      }),
      revision: 1,
    });
  }

  const metadata: RunAuthoritativeMetadata = Object.freeze({
    schemaVersion: 1,
    canonicalRun,
    submissionSnapshot: Object.freeze({
      actor: Object.freeze({
        actorUserIdentityId: "user-alpha",
        activeWorkspaceId: workspaceId,
      }),
      runtimeTarget: Object.freeze({
        systemId: "system:image",
        versionId: "system:image:v1",
        async: input?.async !== false,
      }),
      tags: Object.freeze([]),
      parameters: Object.freeze({ seed: 7 }),
      storageReferences: Object.freeze(input?.includeStorageReferences
        ? [Object.freeze({ storageInstanceId: "storage-a" })]
        : []),
      resourceReferences: Object.freeze([]),
      policyPrerequisites: Object.freeze(input?.includePreviewPolicyPrerequisite
        ? [Object.freeze({
          kind: RunSubmissionSecurityPrerequisiteKinds.previewDecryptionAllowed,
          expected: true,
        })]
        : []),
    }),
    visibility: Object.freeze({
      workspaceScope: "workspace",
      sharingPosture: "workspace-members",
    }),
    orchestration: Object.freeze({
      initialLifecycleState: RunLifecycleStates.queued,
      initialQueueState: "queued",
      intent: Object.freeze({
        kind: "queue-admission-requested",
        queueId: "queue:default",
        recordedAt: "2026-04-07T10:00:00.000Z",
      }),
    }),
  });

  return Object.freeze({
    runId,
    runKind: "workflow",
    status: PlatformRunStatuses.pending,
    workspaceId,
    userIdentityId: "user-alpha",
    sourceAggregateRef: `workflow:${runId}`,
    initiatedAt: "2026-04-07T10:00:00.000Z",
    metadata,
    revision: 1,
  });
}

function createQueueEntry(runId: string): AuthoritativeRunQueueEntryRecord {
  return Object.freeze({
    runId,
    queueId: "queue:default",
    workspaceId: "workspace-alpha",
    lifecycleState: RunLifecycleStates.queued,
    enteredAt: "2026-04-07T10:00:00.000Z",
    orderKey: `2026-04-07T10:00:00.000Z:${runId}`,
    eligibilityMarker: "ready",
    eligibleAt: "2026-04-07T10:00:00.000Z",
    updatedAt: "2026-04-07T10:00:00.000Z",
    revision: 1,
  });
}

describe("RunNodeAssignmentEligibilityService", () => {
  it("marks approved, trusted nodes with required capabilities as eligible", async () => {
    const nodeCatalog = new InMemoryNodeCatalog();
    nodeCatalog.nodes.set("node-trusted", createNodeRecord());

    const service = new RunNodeAssignmentEligibilityService({
      nodeCatalog,
    });

    const decision = await service.evaluateNodeEligibility({
      asOf: "2026-04-07T10:30:00.000Z",
      run: createRunRecord({
        runId: "run-eligible",
        includeStorageReferences: true,
      }),
      queueEntry: createQueueEntry("run-eligible"),
      nodeId: "node-trusted",
    });

    expect(decision.eligible).toBeTrue();
    expect(decision.reasons).toEqual([]);
    expect(decision.requirements?.requiredCapabilities).toEqual([
      NodeRoleCapabilities.executor,
      NodeRoleCapabilities.storageAccess,
    ]);
  });

  it("rejects unapproved nodes", async () => {
    const nodeCatalog = new InMemoryNodeCatalog();
    nodeCatalog.nodes.set("node-pending", createNodeRecord({
      nodeId: "node-pending",
      approvalStatus: NodeApprovalStatuses.pending,
    }));

    const service = new RunNodeAssignmentEligibilityService({
      nodeCatalog,
    });

    const decision = await service.evaluateNodeEligibility({
      asOf: "2026-04-07T10:30:00.000Z",
      run: createRunRecord({
        runId: "run-pending",
      }),
      queueEntry: createQueueEntry("run-pending"),
      nodeId: "node-pending",
    });

    expect(decision.eligible).toBeFalse();
    expect(decision.reasons.some((reason) => reason.code === RunAssignmentIneligibilityCodes.nodeNotApproved)).toBeTrue();
  });

  it("rejects nodes missing capability requirements derived from run prerequisites", async () => {
    const nodeCatalog = new InMemoryNodeCatalog();
    nodeCatalog.nodes.set("node-missing-preview", createNodeRecord({
      nodeId: "node-missing-preview",
      capabilityProfile: Object.freeze({
        enabledCapabilities: Object.freeze([
          NodeRoleCapabilities.executor,
          NodeRoleCapabilities.storageAccess,
        ]),
        supportsRemoteScheduling: true,
      }),
    }));

    const service = new RunNodeAssignmentEligibilityService({
      nodeCatalog,
    });

    const decision = await service.evaluateNodeEligibility({
      asOf: "2026-04-07T10:30:00.000Z",
      run: createRunRecord({
        runId: "run-preview",
        includePreviewPolicyPrerequisite: true,
      }),
      queueEntry: createQueueEntry("run-preview"),
      nodeId: "node-missing-preview",
    });

    expect(decision.eligible).toBeFalse();
    expect(decision.reasons.some((reason) => (
      reason.code === RunAssignmentIneligibilityCodes.nodeMissingCapability
      && reason.details?.requiredCapability === NodeRoleCapabilities.previewWorker
    ))).toBeTrue();
  });

  it("rejects nodes without remote scheduling support when run requires async execution", async () => {
    const nodeCatalog = new InMemoryNodeCatalog();
    nodeCatalog.nodes.set("node-no-remote", createNodeRecord({
      nodeId: "node-no-remote",
      capabilityProfile: Object.freeze({
        enabledCapabilities: Object.freeze([
          NodeRoleCapabilities.executor,
        ]),
        supportsRemoteScheduling: false,
      }),
    }));

    const service = new RunNodeAssignmentEligibilityService({
      nodeCatalog,
    });

    const decision = await service.evaluateNodeEligibility({
      asOf: "2026-04-07T10:30:00.000Z",
      run: createRunRecord({
        runId: "run-remote-required",
        async: true,
      }),
      queueEntry: createQueueEntry("run-remote-required"),
      nodeId: "node-no-remote",
    });

    expect(decision.eligible).toBeFalse();
    expect(decision.reasons.some((reason) => reason.code === RunAssignmentIneligibilityCodes.remoteSchedulingUnsupported)).toBeTrue();
  });

  it("applies policy-port denials for workspace and runtime constraints", async () => {
    const nodeCatalog = new InMemoryNodeCatalog();
    nodeCatalog.nodes.set("node-trusted", createNodeRecord());

    const service = new RunNodeAssignmentEligibilityService({
      nodeCatalog,
      policyPort: new DenyWorkspacePolicyPort(),
    });

    const decision = await service.evaluateNodeEligibility({
      asOf: "2026-04-07T10:30:00.000Z",
      run: createRunRecord({
        runId: "run-policy-denied",
        workspaceId: "workspace-denied",
      }),
      queueEntry: createQueueEntry("run-policy-denied"),
      nodeId: "node-trusted",
    });

    expect(decision.eligible).toBeFalse();
    expect(decision.reasons.some((reason) => reason.code === RunAssignmentIneligibilityCodes.policyDenied)).toBeTrue();
  });

  it("fails closed when authoritative submission requirements are missing", async () => {
    const nodeCatalog = new InMemoryNodeCatalog();
    nodeCatalog.nodes.set("node-trusted", createNodeRecord());

    const service = new RunNodeAssignmentEligibilityService({
      nodeCatalog,
    });

    const decision = await service.evaluateNodeEligibility({
      asOf: "2026-04-07T10:30:00.000Z",
      run: createRunRecord({
        runId: "run-legacy",
        omitSubmissionSnapshot: true,
      }),
      queueEntry: createQueueEntry("run-legacy"),
      nodeId: "node-trusted",
    });

    expect(decision.eligible).toBeFalse();
    expect(decision.reasons).toEqual([
      Object.freeze({
        code: RunAssignmentIneligibilityCodes.requirementsUnavailable,
        message: "Run 'run-legacy' is missing authoritative submission requirements for assignment matching.",
      }),
    ]);
  });
});
