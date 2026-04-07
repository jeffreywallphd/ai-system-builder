import { describe, expect, it } from "bun:test";
import type {
  PlatformAuditEventRecord,
  PlatformPersistenceMutationContext,
  PlatformRunListQuery,
  PlatformRunMutationResult,
  PlatformRunRecord,
} from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  AuthoritativeRunDispatchAttemptRecord,
  AuthoritativeRunDispatchAttemptResult,
  AuthoritativeRunNodePlacementHoldResult,
  AuthoritativeRunNodeClaimResult,
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  IAuthoritativeRunPersistenceRepository,
  IRunNodePlacementHoldRepository,
  IRunOrchestrationIntentRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunNodeClaimConflictReasons,
  RunNodePlacementHoldConflictReasons,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { CreateAuthoritativeRunUseCase } from "@application/runs/use-cases/CreateAuthoritativeRunUseCase";
import { SelectAssignmentReadyRunsUseCase } from "@application/runs/use-cases/SelectAssignmentReadyRunsUseCase";
import { ClaimRunForNodeDispatchPreparationUseCase } from "@application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase";
import { MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase } from "@application/runs/use-cases/MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase";
import { ProcessAuthoritativeRunQueueSchedulingUseCase } from "@application/runs/use-cases/ProcessAuthoritativeRunQueueSchedulingUseCase";
import { EvaluateAuthoritativeSchedulingPolicyUseCase } from "@application/scheduling/use-cases/EvaluateAuthoritativeSchedulingPolicyUseCase";
import { EvaluateAuthoritativeSchedulingDecisionPipelineUseCase } from "@application/scheduling/use-cases/EvaluateAuthoritativeSchedulingDecisionPipelineUseCase";
import { AssembleAuthoritativeSchedulingInputUseCase } from "@application/scheduling/use-cases/AssembleAuthoritativeSchedulingInputUseCase";
import type { INodeTrustIdentityPersistenceRepository } from "@application/nodes/ports/INodeTrustIdentityPersistenceRepository";
import type { NodeIdentityPersistenceRecord } from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { NodeIdentityPersistenceLookupQuery } from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { IAuthorizationRoleAssignmentPersistenceRepository } from "@application/authorization/ports/IAuthorizationRoleAssignmentPersistenceRepository";
import type { AuthorizationRoleAssignmentPersistenceLookupQuery } from "@shared/dto/authorization/AuthorizationPersistenceDtos";
import { WorkspaceAuthorizationRoleKeys } from "@domain/authorization/AuthorizationRoleDefinitions";
import { RoleAssignmentScopes, RoleAssignmentStatuses } from "@domain/authorization/AuthorizationDomain";
import { NodeApprovalStatuses, NodeTrustStates, NodeTypes } from "@domain/nodes/NodeTrustDomain";
import { RunLifecycleStates, RunSubmissionSources, type RunLifecycleState } from "@domain/runs/RunDomain";
import { SchedulingNodeUsageModes } from "@domain/scheduling/SchedulingDomain";

class InMemoryRunRepository implements IAuthoritativeRunPersistenceRepository {
  public readonly runs = new Map<string, PlatformRunRecord>();

  public async findRunById(runId: string): Promise<PlatformRunRecord | undefined> {
    return this.runs.get(runId);
  }

  public async listRuns(_query: PlatformRunListQuery): Promise<ReadonlyArray<PlatformRunRecord>> {
    return Object.freeze([...this.runs.values()]);
  }

  public async createRun(
    record: PlatformRunRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<PlatformRunMutationResult> {
    const persisted = Object.freeze({
      ...record,
      revision: Math.max(1, record.revision),
    });
    this.runs.set(record.runId, persisted);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: persisted,
    });
  }

  public async saveRun(
    record: PlatformRunRecord,
    mutation: PlatformPersistenceMutationContext & { readonly expectedRevision?: number },
  ): Promise<PlatformRunMutationResult> {
    const existing = this.runs.get(record.runId);
    if (!existing) {
      throw new Error(`Run '${record.runId}' not found.`);
    }
    if (typeof mutation.expectedRevision === "number" && mutation.expectedRevision !== existing.revision) {
      throw new Error("expectedRevision mismatch");
    }
    const persisted = Object.freeze({
      ...record,
      revision: existing.revision + 1,
    });
    this.runs.set(record.runId, persisted);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: persisted,
    });
  }
}

class InMemoryQueueRepository implements IRunOrchestrationQueuePersistenceRepository, IRunNodePlacementHoldRepository {
  public readonly entries = new Map<string, AuthoritativeRunQueueEntryRecord>();
  public readonly attempts = new Map<string, AuthoritativeRunDispatchAttemptRecord>();
  public readonly placementHolds = new Map<string, {
    readonly holdToken: string;
    readonly runId: string;
    readonly queueId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly decisionId?: string;
    readonly heldAt: string;
    readonly expiresAt: string;
  }>();

  public async getQueueEntryByRunId(runId: string): Promise<AuthoritativeRunQueueEntryRecord | undefined> {
    return this.entries.get(runId);
  }

  public async enqueueRunForAssignment(
    record: Omit<AuthoritativeRunQueueEntryRecord, "claimToken" | "claimedBy" | "claimedAt" | "claimExpiresAt" | "dequeuedAt" | "revision">,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<AuthoritativeRunQueueMutationResult> {
    const persisted = Object.freeze({
      ...record,
      revision: 1,
    });
    this.entries.set(record.runId, persisted);
    return Object.freeze({
      changed: true,
      record: persisted,
    });
  }

  public async listAssignmentReadyRuns(query: {
    readonly asOf: string;
    readonly queueId?: string;
    readonly workspaceId?: string;
    readonly limit?: number;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    const asOf = query.asOf;
    const limit = Math.max(1, query.limit ?? 10);
    const items = [...this.entries.values()]
      .filter((entry) => !entry.dequeuedAt)
      .filter((entry) => entry.eligibilityMarker === "ready")
      .filter((entry) => entry.eligibleAt <= asOf)
      .filter((entry) => !entry.claimExpiresAt || entry.claimExpiresAt <= asOf)
      .filter((entry) => !query.queueId || query.queueId === entry.queueId)
      .filter((entry) => !query.workspaceId || query.workspaceId === entry.workspaceId)
      .sort((left, right) => left.orderKey.localeCompare(right.orderKey) || left.runId.localeCompare(right.runId))
      .slice(0, limit);
    return Object.freeze(items);
  }

  public async claimAssignmentReadyRuns(input: {
    readonly asOf: string;
    readonly reservationOwner: string;
    readonly reservationTtlSeconds: number;
    readonly limit: number;
    readonly queueId?: string;
    readonly workspaceId?: string;
  }): Promise<ReadonlyArray<AuthoritativeRunQueueEntryRecord>> {
    const ready = await this.listAssignmentReadyRuns({
      asOf: input.asOf,
      queueId: input.queueId,
      workspaceId: input.workspaceId,
      limit: input.limit,
    });
    const claimExpiresAt = new Date(Date.parse(input.asOf) + (input.reservationTtlSeconds * 1000)).toISOString();
    const claimed: AuthoritativeRunQueueEntryRecord[] = [];
    for (const entry of ready) {
      const next = Object.freeze({
        ...entry,
        claimToken: `claim:${entry.runId}`,
        claimedBy: input.reservationOwner,
        claimedAt: input.asOf,
        claimExpiresAt,
        updatedAt: input.asOf,
        revision: entry.revision + 1,
      });
      this.entries.set(entry.runId, next);
      claimed.push(next);
    }
    return Object.freeze(claimed);
  }

  public async releaseRunClaim(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    const existing = this.entries.get(input.runId);
    if (!existing || existing.claimToken !== input.claimToken) {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...existing,
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      updatedAt: input.releasedAt,
      revision: existing.revision + 1,
    }));
    return true;
  }

  public async acquireNodePlacementHold(input: {
    readonly holdToken: string;
    readonly runId: string;
    readonly queueId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly decisionId?: string;
    readonly heldAt: string;
    readonly expiresAt: string;
  }): Promise<AuthoritativeRunNodePlacementHoldResult> {
    const existing = this.placementHolds.get(input.nodeId);
    if (existing && existing.expiresAt > input.heldAt && existing.holdToken !== input.holdToken) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodePlacementHoldConflictReasons.heldByAnotherOwner,
          nodeId: input.nodeId,
          message: "Node already has an active placement hold.",
          currentHold: Object.freeze({
            holdToken: existing.holdToken,
            runId: existing.runId,
            queueId: existing.queueId,
            nodeId: existing.nodeId,
            reservationOwner: existing.reservationOwner,
            claimToken: existing.claimToken,
            decisionId: existing.decisionId,
            heldAt: existing.heldAt,
            expiresAt: existing.expiresAt,
          }),
        }),
      });
    }

    const hold = Object.freeze({
      holdToken: input.holdToken,
      runId: input.runId,
      queueId: input.queueId,
      nodeId: input.nodeId,
      reservationOwner: input.reservationOwner,
      claimToken: input.claimToken,
      decisionId: input.decisionId,
      heldAt: input.heldAt,
      expiresAt: input.expiresAt,
    });
    this.placementHolds.set(input.nodeId, hold);
    return Object.freeze({
      outcome: "acquired",
      hold,
    });
  }

  public async releaseNodePlacementHold(input: {
    readonly nodeId: string;
    readonly holdToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    const existing = this.placementHolds.get(input.nodeId);
    if (!existing || existing.holdToken !== input.holdToken) {
      return false;
    }
    this.placementHolds.delete(input.nodeId);
    return true;
  }

  public async claimQueuedRunForNodeDispatch(input: {
    readonly runId: string;
    readonly nodeId: string;
    readonly reservationOwner: string;
    readonly claimToken: string;
    readonly dispatchAttemptId: string;
    readonly preparedAt: string;
    readonly dispatchMetadata: Readonly<Record<string, unknown>>;
  }): Promise<AuthoritativeRunNodeClaimResult> {
    const existing = this.entries.get(input.runId);
    if (!existing) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.notFound,
          runId: input.runId,
          nodeId: input.nodeId,
          message: "Queue entry not found.",
        }),
      });
    }
    if (existing.assignmentNodeId) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.alreadyAssigned,
          runId: input.runId,
          nodeId: input.nodeId,
          message: "Queue entry already assigned.",
          currentEntry: existing,
        }),
      });
    }
    if (
      existing.claimToken !== input.claimToken
      || existing.claimedBy !== input.reservationOwner
      || !existing.claimExpiresAt
      || existing.claimExpiresAt < input.preparedAt
    ) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.reservationConflict,
          runId: input.runId,
          nodeId: input.nodeId,
          message: "Queue reservation mismatch.",
          currentEntry: existing,
        }),
      });
    }

    const queueEntry = Object.freeze({
      ...existing,
      lifecycleState: RunLifecycleStates.assigned,
      assignmentNodeId: input.nodeId,
      assignmentClaimedAt: input.preparedAt,
      dispatchPreparedAt: input.preparedAt,
      lastDispatchAttemptId: input.dispatchAttemptId,
      dequeuedAt: input.preparedAt,
      updatedAt: input.preparedAt,
      revision: existing.revision + 1,
    });
    this.entries.set(input.runId, queueEntry);

    const dispatchAttempt = Object.freeze({
      attemptId: input.dispatchAttemptId,
      runId: input.runId,
      queueId: queueEntry.queueId,
      workspaceId: queueEntry.workspaceId,
      nodeId: input.nodeId,
      reservationOwner: input.reservationOwner,
      claimToken: input.claimToken,
      preparedAt: input.preparedAt,
      dispatchMetadata: input.dispatchMetadata,
    });
    this.attempts.set(dispatchAttempt.attemptId, dispatchAttempt);

    return Object.freeze({
      outcome: "claimed",
      queueEntry,
      dispatchAttempt,
    });
  }

  public async recordDispatchAttemptResult(input: {
    readonly runId: string;
    readonly attemptId: string;
    readonly result: AuthoritativeRunDispatchAttemptResult;
  }): Promise<boolean> {
    const existing = this.attempts.get(input.attemptId);
    if (!existing || existing.runId !== input.runId) {
      return false;
    }
    this.attempts.set(input.attemptId, Object.freeze({
      ...existing,
      dispatchResult: input.result,
    }));
    return true;
  }

  public async finalizeRunQueueEntry(input: {
    readonly runId: string;
    readonly finalizedAt: string;
    readonly lifecycleState: RunLifecycleState;
  }): Promise<boolean> {
    const existing = this.entries.get(input.runId);
    if (!existing) {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...existing,
      lifecycleState: input.lifecycleState,
      updatedAt: input.finalizedAt,
      revision: existing.revision + 1,
    }));
    return true;
  }

  public async listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze([...this.attempts.values()].filter((entry) => entry.runId === runId));
  }
}

class InMemoryIntentRepository implements IRunOrchestrationIntentRepository {
  public readonly events: PlatformAuditEventRecord[] = [];

  public async appendOrchestrationIntent(
    event: PlatformAuditEventRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    this.events.push(event);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: event,
    });
  }
}

class InMemoryNodeRepository implements Pick<INodeTrustIdentityPersistenceRepository, "listNodes"> {
  public constructor(private readonly nodes: ReadonlyArray<NodeIdentityPersistenceRecord>) {}

  public async listNodes(_query: NodeIdentityPersistenceLookupQuery) {
    return this.nodes;
  }
}

class InMemoryRoleAssignmentRepository implements Pick<IAuthorizationRoleAssignmentPersistenceRepository, "listRoleAssignments"> {
  public async listRoleAssignments(query: AuthorizationRoleAssignmentPersistenceLookupQuery) {
    if (!query.workspaceId || !query.actorUserIdentityId) {
      return Object.freeze([]);
    }

    const roleKey = query.actorUserIdentityId === "user:owner"
      ? WorkspaceAuthorizationRoleKeys.owner
      : WorkspaceAuthorizationRoleKeys.viewer;
    return Object.freeze([Object.freeze({
      id: `role:${query.actorUserIdentityId}`,
      actorUserIdentityId: query.actorUserIdentityId,
      roleKey,
      scope: RoleAssignmentScopes.workspace,
      workspaceId: query.workspaceId,
      status: RoleAssignmentStatuses.active,
      assignedAt: "2026-04-07T11:00:00.000Z",
      assignedByUserIdentityId: "user:admin",
      createdAt: "2026-04-07T11:00:00.000Z",
      createdBy: "user:admin",
      lastModifiedAt: "2026-04-07T11:00:00.000Z",
      lastModifiedBy: "user:admin",
      revision: 1,
    })]);
  }
}

class SequenceIdGenerator {
  private value = 0;

  public nextId(prefix: string): string {
    this.value += 1;
    return `${prefix}:${this.value}`;
  }
}

function createNode(nodeId: string, nodeType = NodeTypes.compute): NodeIdentityPersistenceRecord {
  return Object.freeze({
    nodeId,
    nodeType,
    displayName: nodeId,
    capabilityProfile: Object.freeze({
      enabledCapabilities: Object.freeze(["executor"]),
      supportsRemoteScheduling: true,
    }),
    approvalStatus: NodeApprovalStatuses.approved,
    trustState: NodeTrustStates.trusted,
    certificate: Object.freeze({
      certificateRef: `cert:${nodeId}`,
    }),
    deploymentTags: Object.freeze([]),
    revocation: Object.freeze({
      state: "active",
    }),
    enrolledAt: "2026-04-07T10:00:00.000Z",
    createdAt: "2026-04-07T10:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-04-07T10:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

function buildSubmissionCommand(input: {
  readonly actorUserIdentityId: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
}) {
  return Object.freeze({
    actor: Object.freeze({
      actorUserIdentityId: input.actorUserIdentityId,
      activeWorkspaceId: "workspace-alpha",
    }),
    workspaceId: "workspace-alpha",
    workflowId: "workflow:demo",
    source: RunSubmissionSources.api,
    runtimeTarget: Object.freeze({
      systemId: "system:demo",
      versionId: "system:demo:v1",
      async: true,
    }),
    tags: Object.freeze(["queue:default"]),
    metadata: Object.freeze({}),
    parameters: Object.freeze({ prompt: "test" }),
    storageReferences: Object.freeze([]),
    resourceReferences: Object.freeze([]),
    policyPrerequisites: Object.freeze([]),
    submissionContext: Object.freeze({
      submittedByActorId: input.actorUserIdentityId,
      correlationId: "corr:policy",
      idempotencyKey: input.idempotencyKey,
    }),
    occurredAt: input.occurredAt,
  });
}

describe("ProcessAuthoritativeRunQueueSchedulingUseCase integration", () => {
  it("uses scheduler decisions as the authoritative queue-selection and assignment path", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    const idGenerator = new SequenceIdGenerator();

    const createRun = new CreateAuthoritativeRunUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
    });
    const viewerRun = await createRun.execute({
      command: buildSubmissionCommand({
        actorUserIdentityId: "user:viewer",
        idempotencyKey: "run:viewer",
        occurredAt: "2026-04-07T12:00:00.000Z",
      }),
    });
    const ownerRun = await createRun.execute({
      command: buildSubmissionCommand({
        actorUserIdentityId: "user:owner",
        idempotencyKey: "run:owner",
        occurredAt: "2026-04-07T12:00:10.000Z",
      }),
    });

    const selectAssignmentReadyRunsUseCase = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-07T12:01:00.000Z"),
    });
    const schedulingInputAssembler = new AssembleAuthoritativeSchedulingInputUseCase({
      selectAssignmentReadyRunsUseCase,
      runRepository,
      nodeRepository: new InMemoryNodeRepository(Object.freeze([
        createNode("node:compute:1"),
        createNode("node:hybrid:1", NodeTypes.hybrid),
      ])),
      roleAssignmentRepository: new InMemoryRoleAssignmentRepository(),
      nodePolicyStatePort: {
        listNodePolicyState: async () => Object.freeze([Object.freeze({
          nodeId: "node:hybrid:1",
          usageMode: SchedulingNodeUsageModes.interactiveLocalSession,
          localInteractiveOwnerUserIdentityId: "user:desktop-owner",
          hybridLocalUseProtection: Object.freeze({
            reservedLocalCapacityUnits: 1,
            activeRemoteAssignmentCount: 1,
          }),
        })]),
      },
    });
    const schedulingPolicyEvaluator = new EvaluateAuthoritativeSchedulingPolicyUseCase({
      now: () => new Date("2026-04-07T12:01:00.000Z"),
      decisionIdFactory: () => "decision:scheduler-integration",
    });
    const schedulingDecisionPipeline = new EvaluateAuthoritativeSchedulingDecisionPipelineUseCase({
      inputAssembler: schedulingInputAssembler,
      policyEvaluator: schedulingPolicyEvaluator,
      now: () => new Date("2026-04-07T12:01:00.000Z"),
    });
    const claimUseCase = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator,
    });
    const schedulingAssignmentGateway = new MaterializeAuthoritativeSchedulingAssignmentGatewayUseCase({
      queueRepository,
      placementHoldRepository: queueRepository,
      claimRunForNodeDispatchPreparationUseCase: claimUseCase,
      now: () => new Date("2026-04-07T12:01:00.000Z"),
    });
    const processUseCase = new ProcessAuthoritativeRunQueueSchedulingUseCase({
      schedulingDecisionPipeline,
      schedulingAssignmentGateway,
    });

    const result = await processUseCase.execute({
      reservationOwner: "scheduler:alpha",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 2,
    });

    expect(result.decisionBundle.decision.selected?.runId).toBe(ownerRun.run.runId);
    expect(result.decisionBundle.decision.selected?.nodeId).toBe("node:compute:1");
    expect(result.materializedAssignmentIntents).toHaveLength(1);
    expect(result.materializedAssignmentIntents[0]?.runId).toBe(ownerRun.run.runId);

    const ownerQueueEntry = await queueRepository.getQueueEntryByRunId(ownerRun.run.runId);
    const viewerQueueEntry = await queueRepository.getQueueEntryByRunId(viewerRun.run.runId);
    expect(ownerQueueEntry?.lifecycleState).toBe("assigned");
    expect(ownerQueueEntry?.assignmentNodeId).toBe("node:compute:1");
    expect(viewerQueueEntry?.lifecycleState).toBe("queued");
    expect(viewerQueueEntry?.claimToken).toBeUndefined();
  });
});
