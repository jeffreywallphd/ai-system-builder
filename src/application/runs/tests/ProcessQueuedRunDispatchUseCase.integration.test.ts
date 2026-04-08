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
  AuthoritativeRunNodeClaimResult,
  AuthoritativeRunQueueEntryRecord,
  AuthoritativeRunQueueMutationResult,
  IAuthoritativeRunPersistenceRepository,
  IRunOrchestrationIntentRepository,
  IRunOrchestrationQueuePersistenceRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { RunNodeClaimConflictReasons } from "@application/runs/ports/RunOrchestrationPersistencePorts";
import { CreateAuthoritativeRunUseCase } from "@application/runs/use-cases/CreateAuthoritativeRunUseCase";
import { SelectAssignmentReadyRunsUseCase } from "@application/runs/use-cases/SelectAssignmentReadyRunsUseCase";
import { ClaimRunForNodeDispatchPreparationUseCase } from "@application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase";
import { BuildAssignedRunExecutionCommandUseCase } from "@application/runs/use-cases/BuildAssignedRunExecutionCommandUseCase";
import { DispatchAssignedRunExecutionUseCase } from "@application/runs/use-cases/DispatchAssignedRunExecutionUseCase";
import { HandleRunDispatchResultUseCase } from "@application/runs/use-cases/HandleRunDispatchResultUseCase";
import { IngestRunExecutionUpdateUseCase } from "@application/runs/use-cases/IngestRunExecutionUpdateUseCase";
import { ProcessQueuedRunDispatchUseCase } from "@application/runs/use-cases/ProcessQueuedRunDispatchUseCase";
import { RunLifecycleStates, RunSubmissionSources, type RunLifecycleState } from "@domain/runs/RunDomain";
import {
  createExecutionNodeRecord,
  ExecutionNodeActivationStatuses,
  ExecutionNodeBackendReadinessStates,
  ExecutionNodeHealthStatuses,
  ExecutionNodeTargetKinds,
  type ExecutionNodeRecord,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
} from "@domain/nodes/NodeTrustDomain";
import { ImageRunExecutionNodeSelectionOutcomes } from "@application/nodes/ports/ExecutionNodeManagementPorts";
import type {
  ExecutionNodeListQuery,
  IImageRunExecutionNodeSelectionServicePort,
  ImageRunExecutionNodeSelectionDecision,
  ImageRunExecutionNodeSelectionReason,
} from "@application/nodes/ports/ExecutionNodeManagementPorts";
import { ImageRunNodeEligibilityEvaluationService } from "@application/nodes/use-cases/ImageRunNodeEligibilityEvaluationService";
import { ImageRunExecutionNodeSelectionService } from "@application/nodes/use-cases/ImageRunExecutionNodeSelectionService";
import { mapPlatformRunRecordToCanonicalRun } from "@application/runs/use-cases/RunCreationPersistenceMapper";

class InMemoryRunRepository implements IAuthoritativeRunPersistenceRepository {
  private readonly runs = new Map<string, PlatformRunRecord>();

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
    const current = this.runs.get(record.runId);
    if (!current) {
      throw new Error(`Run '${record.runId}' not found.`);
    }
    if (typeof mutation.expectedRevision === "number" && mutation.expectedRevision !== current.revision) {
      throw new Error("expectedRevision mismatch");
    }
    const persisted = Object.freeze({
      ...record,
      revision: current.revision + 1,
    });
    this.runs.set(record.runId, persisted);
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: persisted,
    });
  }
}

class InMemoryQueueRepository implements IRunOrchestrationQueuePersistenceRepository {
  private readonly entries = new Map<string, AuthoritativeRunQueueEntryRecord>();
  private readonly attempts = new Map<string, AuthoritativeRunDispatchAttemptRecord>();

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
    return Object.freeze(
      [...this.entries.values()]
        .filter((entry) => !entry.dequeuedAt)
        .filter((entry) => entry.eligibilityMarker === "ready")
        .filter((entry) => entry.eligibleAt <= asOf)
        .filter((entry) => !entry.claimExpiresAt || entry.claimExpiresAt <= asOf)
        .filter((entry) => !query.queueId || entry.queueId === query.queueId)
        .filter((entry) => !query.workspaceId || entry.workspaceId === query.workspaceId)
        .sort((left, right) => left.orderKey.localeCompare(right.orderKey) || left.runId.localeCompare(right.runId))
        .slice(0, limit),
    );
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
    const claimed = ready.map((entry) => {
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
      return next;
    });
    return Object.freeze(claimed);
  }

  public async releaseRunClaim(input: {
    readonly runId: string;
    readonly claimToken: string;
    readonly releasedAt: string;
  }): Promise<boolean> {
    const current = this.entries.get(input.runId);
    if (!current || current.claimToken !== input.claimToken) {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...current,
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      updatedAt: input.releasedAt,
      revision: current.revision + 1,
    }));
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
    const current = this.entries.get(input.runId);
    if (!current) {
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
    if (current.assignmentNodeId) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.alreadyAssigned,
          runId: input.runId,
          nodeId: input.nodeId,
          message: "Queue entry already assigned.",
          currentEntry: current,
        }),
      });
    }
    if (
      current.claimToken !== input.claimToken
      || current.claimedBy !== input.reservationOwner
      || !current.claimExpiresAt
      || current.claimExpiresAt < input.preparedAt
    ) {
      return Object.freeze({
        outcome: "conflict",
        conflict: Object.freeze({
          reason: RunNodeClaimConflictReasons.reservationConflict,
          runId: input.runId,
          nodeId: input.nodeId,
          message: "Queue reservation mismatch.",
          currentEntry: current,
        }),
      });
    }

    const nextQueue = Object.freeze({
      ...current,
      lifecycleState: RunLifecycleStates.assigned,
      assignmentNodeId: input.nodeId,
      assignmentClaimedAt: input.preparedAt,
      dispatchPreparedAt: input.preparedAt,
      lastDispatchAttemptId: input.dispatchAttemptId,
      dequeuedAt: input.preparedAt,
      updatedAt: input.preparedAt,
      revision: current.revision + 1,
    });
    this.entries.set(input.runId, nextQueue);
    const attempt = Object.freeze({
      attemptId: input.dispatchAttemptId,
      runId: input.runId,
      queueId: current.queueId,
      workspaceId: current.workspaceId,
      nodeId: input.nodeId,
      reservationOwner: input.reservationOwner,
      claimToken: input.claimToken,
      preparedAt: input.preparedAt,
      dispatchMetadata: input.dispatchMetadata,
    });
    this.attempts.set(input.dispatchAttemptId, attempt);
    return Object.freeze({
      outcome: "claimed",
      queueEntry: nextQueue,
      dispatchAttempt: attempt,
    });
  }

  public async recordDispatchAttemptResult(input: {
    readonly runId: string;
    readonly attemptId: string;
    readonly result: AuthoritativeRunDispatchAttemptResult;
  }): Promise<boolean> {
    const current = this.attempts.get(input.attemptId);
    if (!current || current.runId !== input.runId) {
      return false;
    }
    this.attempts.set(input.attemptId, Object.freeze({
      ...current,
      dispatchResult: input.result,
    }));
    return true;
  }

  public async finalizeRunQueueEntry(input: {
    readonly runId: string;
    readonly finalizedAt: string;
    readonly lifecycleState: RunLifecycleState;
  }): Promise<boolean> {
    const current = this.entries.get(input.runId);
    if (!current) {
      return false;
    }
    this.entries.set(input.runId, Object.freeze({
      ...current,
      lifecycleState: input.lifecycleState,
      claimToken: undefined,
      claimedBy: undefined,
      claimedAt: undefined,
      claimExpiresAt: undefined,
      updatedAt: input.finalizedAt,
      revision: current.revision + 1,
    }));
    return true;
  }

  public async listDispatchAttemptsByRunId(runId: string): Promise<ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>> {
    return Object.freeze(
      [...this.attempts.values()]
        .filter((attempt) => attempt.runId === runId)
        .sort((left, right) => right.preparedAt.localeCompare(left.preparedAt) || left.attemptId.localeCompare(right.attemptId)),
    );
  }
}

class InMemoryIntentRepository implements IRunOrchestrationIntentRepository {
  public async appendOrchestrationIntent(
    event: PlatformAuditEventRecord,
    _mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    return Object.freeze({
      changed: true,
      wasReplay: false,
      record: event,
    });
  }
}

class SequenceIdGenerator {
  private value = 0;

  public nextId(prefix: string): string {
    this.value += 1;
    return `${prefix}:${this.value}`;
  }
}

class StubImageRunNodeSelectionService {
  public decisionByRunId = new Map<string, ImageRunExecutionNodeSelectionDecision>();
  public selectedNodeId = "node:image-executor:1";

  public async selectExecutionNodeForRun(input: {
    readonly asOf: string;
    readonly run: {
      readonly runId: string;
      readonly workspaceId: string;
      readonly systemId?: string;
      readonly workflowId?: string;
      readonly operationKind?: string;
      readonly translationContractVersion?: string;
    };
  }): Promise<ImageRunExecutionNodeSelectionDecision> {
    const existing = this.decisionByRunId.get(input.run.runId);
    if (existing) {
      return existing;
    }

    const reasons: ReadonlyArray<ImageRunExecutionNodeSelectionReason> = Object.freeze([Object.freeze({
      code: ImageRunExecutionNodeSelectionOutcomes.selected,
      message: "Test selection succeeded.",
      details: Object.freeze({
        selectedNodeId: this.selectedNodeId,
      }),
    })]);

    return Object.freeze({
      asOf: input.asOf,
      run: Object.freeze({ ...input.run }),
      strategyId: "test.image-run-selection",
      outcome: ImageRunExecutionNodeSelectionOutcomes.selected,
      selectedNodeId: this.selectedNodeId,
      selectedCandidate: Object.freeze({
        nodeId: this.selectedNodeId,
        rank: 1,
        decision: "eligible",
        eligible: true,
        blockingReasonCodes: Object.freeze([]),
        advisoryReasonCodes: Object.freeze([]),
        transientAvailabilityReasonCodes: Object.freeze([]),
      }),
      reasons,
      candidates: Object.freeze([Object.freeze({
        nodeId: this.selectedNodeId,
        rank: 1,
        decision: "eligible",
        eligible: true,
        blockingReasonCodes: Object.freeze([]),
        advisoryReasonCodes: Object.freeze([]),
        transientAvailabilityReasonCodes: Object.freeze([]),
      })]),
    });
  }
}

class InMemoryExecutionNodeRepository {
  public readonly records = new Map<string, ExecutionNodeRecord>();

  public async findExecutionNodeById(nodeId: string): Promise<ExecutionNodeRecord | undefined> {
    return this.records.get(nodeId);
  }

  public async listExecutionNodes(query: ExecutionNodeListQuery): Promise<ReadonlyArray<ExecutionNodeRecord>> {
    const nodeIds = query.nodeIds && query.nodeIds.length > 0
      ? new Set(query.nodeIds)
      : undefined;
    const records = [...this.records.values()]
      .filter((record) => !nodeIds || nodeIds.has(record.nodeId));
    return Object.freeze(records);
  }
}

class CapturingSelectionService implements Pick<IImageRunExecutionNodeSelectionServicePort, "selectExecutionNodeForRun"> {
  public readonly decisionsByRunId = new Map<string, ImageRunExecutionNodeSelectionDecision>();

  public constructor(
    private readonly delegate: Pick<IImageRunExecutionNodeSelectionServicePort, "selectExecutionNodeForRun">,
  ) {}

  public async selectExecutionNodeForRun(input: Parameters<IImageRunExecutionNodeSelectionServicePort["selectExecutionNodeForRun"]>[0]) {
    const decision = await this.delegate.selectExecutionNodeForRun(input);
    this.decisionsByRunId.set(input.run.runId, decision);
    return decision;
  }
}

function createExecutionNode(input: {
  readonly nodeId: string;
  readonly backendFamily?: string;
  readonly activationStatus?: ExecutionNodeRecord["activationStatus"];
  readonly healthStatus?: ExecutionNodeRecord["healthStatus"];
  readonly backendReadinessState?: "ready" | "degraded" | "unavailable" | "unknown";
}): ExecutionNodeRecord {
  return createExecutionNodeRecord({
    nodeId: input.nodeId,
    displayName: `Execution node ${input.nodeId}`,
    nodeType: NodeTypes.compute,
    capabilityProfile: createNodeCapabilityProfile({
      enabledCapabilities: [
        NodeRoleCapabilities.executor,
        NodeRoleCapabilities.storageAccess,
      ],
      supportsRemoteScheduling: true,
      maxConcurrentWorkloads: 4,
    }),
    backendFamilyCapabilities: [Object.freeze({
      backendFamily: input.backendFamily ?? "comfyui",
      supportedExecutionTargets: [ExecutionNodeTargetKinds.imageManipulation],
      supportedOperationKinds: ["image-to-image"],
      supportedInputKinds: ["source-image"],
      supportedOutputKinds: ["generated-image"],
      supportedTranslationContractVersions: ["1.0.0"],
      executionReadiness: Object.freeze({
        state: input.backendReadinessState ?? ExecutionNodeBackendReadinessStates.ready,
        checkedAt: "2026-04-08T13:00:00.000Z",
      }),
    })],
    approvalStatus: NodeApprovalStatuses.approved,
    trustState: NodeTrustStates.trusted,
    activationStatus: input.activationStatus ?? ExecutionNodeActivationStatuses.active,
    healthStatus: input.healthStatus ?? ExecutionNodeHealthStatuses.ready,
    availabilityOverride: Object.freeze({
      mode: "enabled",
      updatedAt: "2026-04-08T13:00:00.000Z",
    }),
    deploymentTags: ["region-east"],
    endpoint: Object.freeze({
      endpointRef: `node://${input.nodeId}`,
    }),
    certificateRef: `cert:${input.nodeId}`,
    lastSeenAt: "2026-04-08T13:00:00.000Z",
    metadata: {},
    createdAt: "2026-04-08T13:00:00.000Z",
    updatedAt: "2026-04-08T13:00:00.000Z",
  });
}

function buildSubmissionCommand(occurredAt: string) {
  return Object.freeze({
    actor: Object.freeze({
      actorUserIdentityId: "user:owner",
      activeWorkspaceId: "workspace-alpha",
    }),
    workspaceId: "workspace-alpha",
    workflowId: "workflow:image-demo",
    source: RunSubmissionSources.api,
    runtimeTarget: Object.freeze({
      systemId: "comfyui",
      versionId: "system:comfyui:v1",
      async: true,
    }),
    tags: Object.freeze(["queue:default"]),
    metadata: Object.freeze({
      origin: "image-studio",
    }),
    parameters: Object.freeze({
      prompt: "make a watercolor portrait",
    }),
    storageReferences: Object.freeze([]),
    resourceReferences: Object.freeze([]),
    policyPrerequisites: Object.freeze([]),
    submissionContext: Object.freeze({
      submittedByActorId: "user:owner",
      correlationId: "corr:image-dispatch",
      idempotencyKey: `image-dispatch:${occurredAt}`,
    }),
    occurredAt,
  });
}

describe("ProcessQueuedRunDispatchUseCase integration", () => {
  it("advances queued runs through claim + dispatch into running state with dispatch linkage", async () => {
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
    const created = await createRun.execute({
      command: buildSubmissionCommand("2026-04-08T12:00:00.000Z"),
    });
    expect(created.run.state).toBe("queued");

    const selectReady = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T12:00:05.000Z"),
    });
    const claimForDispatch = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator,
      now: () => new Date("2026-04-08T12:00:06.000Z"),
    });
    const dispatchResultHandler = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-08T12:00:07.000Z"),
    });
    const dispatchAssigned = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: new BuildAssignedRunExecutionCommandUseCase({
        runRepository,
        queueRepository,
      }),
      dispatchPort: {
        dispatch: async () => Object.freeze({
          dispatchId: "dispatch:run:1",
          backendKind: "comfyui",
          backendRunId: "comfy-job:1",
          acceptedAt: "2026-04-08T12:00:07.000Z",
        }),
      },
      dispatchResultHandler,
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T12:00:07.000Z"),
    });
    const nodeSelection = new StubImageRunNodeSelectionService();

    const useCase = new ProcessQueuedRunDispatchUseCase({
      selectAssignmentReadyRunsUseCase: selectReady,
      claimRunForNodeDispatchPreparationUseCase: claimForDispatch,
      dispatchAssignedRunExecutionUseCase: dispatchAssigned,
      runNodeSelectionService: nodeSelection,
      queueRepository,
      now: () => new Date("2026-04-08T12:00:05.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:image-default",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 1,
      reservationTtlSeconds: 120,
    });

    expect(result.selectedCount).toBe(1);
    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.status).toBe("dispatched");
    if (result.outcomes[0]?.status === "dispatched") {
      expect(result.outcomes[0].nodeId).toBe("node:image-executor:1");
      expect(result.outcomes[0].dispatchAttemptId).toContain("dispatch-attempt:");
      expect(result.outcomes[0].dispatchId).toBe("dispatch:run:1");
      expect(result.outcomes[0].backendRunId).toBe("comfy-job:1");
    }

    const persisted = await runRepository.findRunById(created.run.runId);
    expect(persisted?.status).toBe("running");
    const queueEntry = await queueRepository.getQueueEntryByRunId(created.run.runId);
    expect(queueEntry?.lifecycleState).toBe("running");
    const attempts = await queueRepository.listDispatchAttemptsByRunId(created.run.runId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.nodeId).toBe("node:image-executor:1");
    expect(attempts[0]?.dispatchResult?.status).toBe("accepted");
    expect(attempts[0]?.dispatchResult?.dispatchId).toBe("dispatch:run:1");
    expect(attempts[0]?.dispatchResult?.backendRunId).toBe("comfy-job:1");
  });

  it("captures dispatch failures while leaving authoritative lifecycle transitions to dispatch result handling", async () => {
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
    const created = await createRun.execute({
      command: buildSubmissionCommand("2026-04-08T12:10:00.000Z"),
    });

    const selectReady = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T12:10:05.000Z"),
    });
    const claimForDispatch = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator,
      now: () => new Date("2026-04-08T12:10:06.000Z"),
    });
    const dispatchResultHandler = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-08T12:10:07.000Z"),
    });
    const dispatchAssigned = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: new BuildAssignedRunExecutionCommandUseCase({
        runRepository,
        queueRepository,
      }),
      dispatchPort: {
        dispatch: async () => {
          throw new Error("comfy backend unavailable");
        },
      },
      dispatchResultHandler,
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T12:10:07.000Z"),
    });
    const nodeSelection = new StubImageRunNodeSelectionService();

    const useCase = new ProcessQueuedRunDispatchUseCase({
      selectAssignmentReadyRunsUseCase: selectReady,
      claimRunForNodeDispatchPreparationUseCase: claimForDispatch,
      dispatchAssignedRunExecutionUseCase: dispatchAssigned,
      runNodeSelectionService: nodeSelection,
      queueRepository,
      now: () => new Date("2026-04-08T12:10:05.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:image-default",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 1,
      reservationTtlSeconds: 120,
    });

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.status).toBe("failed");
    if (result.outcomes[0]?.status === "failed") {
      expect(result.outcomes[0].stage).toBe("dispatch");
      expect(result.outcomes[0].message).toContain("unavailable");
      expect(result.outcomes[0].dispatchAttemptId).toContain("dispatch-attempt:");
    }

    const persisted = await runRepository.findRunById(created.run.runId);
    expect(persisted?.status).toBe("failed");
    const queueEntry = await queueRepository.getQueueEntryByRunId(created.run.runId);
    expect(queueEntry?.lifecycleState).toBe("failed");
    const attempts = await queueRepository.listDispatchAttemptsByRunId(created.run.runId);
    expect(attempts).toHaveLength(1);
    expect(attempts[0]?.dispatchResult?.status).toBe("failed-to-start");
  });

  it("fails cleanly with structured selection reasons and releases claim when no eligible node exists", async () => {
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
    const created = await createRun.execute({
      command: buildSubmissionCommand("2026-04-08T12:20:00.000Z"),
    });

    const selectReady = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T12:20:05.000Z"),
    });
    const claimForDispatch = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator,
      now: () => new Date("2026-04-08T12:20:06.000Z"),
    });
    const dispatchResultHandler = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-08T12:20:07.000Z"),
    });
    const dispatchAssigned = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: new BuildAssignedRunExecutionCommandUseCase({
        runRepository,
        queueRepository,
      }),
      dispatchPort: {
        dispatch: async () => Object.freeze({
          dispatchId: "dispatch:run:unreachable",
          backendKind: "comfyui",
          backendRunId: "comfy-job:unreachable",
          acceptedAt: "2026-04-08T12:20:07.000Z",
        }),
      },
      dispatchResultHandler,
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T12:20:07.000Z"),
    });
    const nodeSelection = new StubImageRunNodeSelectionService();
    nodeSelection.decisionByRunId.set(created.run.runId, Object.freeze({
      asOf: "2026-04-08T12:20:05.000Z",
      run: Object.freeze({
        runId: created.run.runId,
        workspaceId: "workspace-alpha",
        workflowId: "workflow:image-demo",
      }),
      strategyId: "test.image-run-selection",
      outcome: ImageRunExecutionNodeSelectionOutcomes.noEligibleNode,
      reasons: Object.freeze([Object.freeze({
        code: "no-eligible-node",
        message: "No eligible execution node was found for this run.",
        details: Object.freeze({
          topBlockingReasonCodes: Object.freeze(["node-health-not-routable"]),
        }),
      })]),
      candidates: Object.freeze([Object.freeze({
        nodeId: "node:image-executor:blocked",
        rank: 1,
        decision: "unavailable",
        eligible: false,
        blockingReasonCodes: Object.freeze(["node-health-not-routable"]),
        advisoryReasonCodes: Object.freeze([]),
        transientAvailabilityReasonCodes: Object.freeze(["node-health-not-routable"]),
      })]),
    }));

    const useCase = new ProcessQueuedRunDispatchUseCase({
      selectAssignmentReadyRunsUseCase: selectReady,
      claimRunForNodeDispatchPreparationUseCase: claimForDispatch,
      dispatchAssignedRunExecutionUseCase: dispatchAssigned,
      runNodeSelectionService: nodeSelection,
      queueRepository,
      now: () => new Date("2026-04-08T12:20:05.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:image-default",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 1,
      reservationTtlSeconds: 120,
    });

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.status).toBe("failed");
    if (result.outcomes[0]?.status === "failed") {
      expect(result.outcomes[0].stage).toBe("selection");
      expect(result.outcomes[0].selection?.outcome).toBe(ImageRunExecutionNodeSelectionOutcomes.noEligibleNode);
      expect(result.outcomes[0].selection?.reasons[0]?.code).toBe("no-eligible-node");
      expect(result.outcomes[0].selection?.candidateCount).toBe(1);
    }

    const persisted = await runRepository.findRunById(created.run.runId);
    expect(persisted?.status).toBe("pending");
    const queueEntry = await queueRepository.getQueueEntryByRunId(created.run.runId);
    expect(queueEntry?.lifecycleState).toBe("queued");
    expect(queueEntry?.claimToken).toBeUndefined();
    expect(queueEntry?.claimedBy).toBeUndefined();
    const attempts = await queueRepository.listDispatchAttemptsByRunId(created.run.runId);
    expect(attempts).toHaveLength(0);
  });

  it("falls back to a degraded eligible node, excludes unavailable/incompatible nodes, and preserves assignment lineage", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    const idGenerator = new SequenceIdGenerator();
    const nodeRepository = new InMemoryExecutionNodeRepository();
    nodeRepository.records.set("node-unavailable", createExecutionNode({
      nodeId: "node-unavailable",
      activationStatus: ExecutionNodeActivationStatuses.unavailable,
      healthStatus: ExecutionNodeHealthStatuses.unavailable,
      backendReadinessState: ExecutionNodeBackendReadinessStates.unavailable,
    }));
    nodeRepository.records.set("node-incompatible", createExecutionNode({
      nodeId: "node-incompatible",
      backendFamily: "custom-runtime",
    }));
    nodeRepository.records.set("node-degraded", createExecutionNode({
      nodeId: "node-degraded",
      activationStatus: ExecutionNodeActivationStatuses.degraded,
      healthStatus: ExecutionNodeHealthStatuses.degraded,
      backendReadinessState: ExecutionNodeBackendReadinessStates.degraded,
    }));

    const createRun = new CreateAuthoritativeRunUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
    });
    const created = await createRun.execute({
      command: buildSubmissionCommand("2026-04-08T13:00:00.000Z"),
    });

    const selectReady = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T13:00:05.000Z"),
    });
    const claimForDispatch = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator,
      now: () => new Date("2026-04-08T13:00:06.000Z"),
    });
    const dispatchResultHandler = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-08T13:00:07.000Z"),
    });
    const dispatchAssigned = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: new BuildAssignedRunExecutionCommandUseCase({
        runRepository,
        queueRepository,
      }),
      dispatchPort: {
        dispatch: async () => Object.freeze({
          dispatchId: "dispatch:run:degraded-fallback",
          backendKind: "comfyui",
          backendRunId: "comfy-job:degraded-fallback",
          acceptedAt: "2026-04-08T13:00:07.000Z",
        }),
      },
      dispatchResultHandler,
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T13:00:07.000Z"),
    });
    const selectionService = new CapturingSelectionService(new ImageRunExecutionNodeSelectionService({
      eligibilityService: new ImageRunNodeEligibilityEvaluationService({
        nodeRepository,
      }),
    }));

    const useCase = new ProcessQueuedRunDispatchUseCase({
      selectAssignmentReadyRunsUseCase: selectReady,
      claimRunForNodeDispatchPreparationUseCase: claimForDispatch,
      dispatchAssignedRunExecutionUseCase: dispatchAssigned,
      runNodeSelectionService: selectionService,
      queueRepository,
      now: () => new Date("2026-04-08T13:00:05.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:image-default",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 1,
      reservationTtlSeconds: 120,
    });

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.status).toBe("dispatched");
    if (result.outcomes[0]?.status === "dispatched") {
      expect(result.outcomes[0].nodeId).toBe("node-degraded");
    }

    const selectionDecision = selectionService.decisionsByRunId.get(created.run.runId);
    expect(selectionDecision?.outcome).toBe(ImageRunExecutionNodeSelectionOutcomes.selected);
    expect(selectionDecision?.selectedNodeId).toBe("node-degraded");
    expect(selectionDecision?.candidates.map((candidate) => candidate.nodeId)).toEqual([
      "node-degraded",
      "node-unavailable",
      "node-incompatible",
    ]);
    const candidateByNodeId = new Map(selectionDecision?.candidates.map((candidate) => [candidate.nodeId, candidate]));
    expect(candidateByNodeId.get("node-degraded")?.decision).toBe("eligible");
    expect(candidateByNodeId.get("node-unavailable")?.decision).toBe("unavailable");
    expect(candidateByNodeId.get("node-incompatible")?.decision).toBe("incompatible");

    const runningRecord = await runRepository.findRunById(created.run.runId);
    expect(runningRecord).toBeDefined();
    const runningCanonical = mapPlatformRunRecordToCanonicalRun(runningRecord!);
    expect(runningCanonical.state).toBe("running");
    expect(runningCanonical.assignment.status).toBe("assigned");
    expect(runningCanonical.assignment.assignedNodeId).toBe("node-degraded");

    const ingest = new IngestRunExecutionUpdateUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-08T13:01:00.000Z"),
    });
    await ingest.execute({
      runId: created.run.runId,
      senderNodeId: "node-degraded",
      update: Object.freeze({
        runId: created.run.runId,
        senderNodeId: "node-degraded",
        senderBackendKind: "comfyui",
        senderBackendRunId: "comfy-job:degraded-fallback",
        occurredAt: "2026-04-08T13:01:00.000Z",
        toState: "completed",
        execution: Object.freeze({
          outcome: "succeeded",
          finishedAt: "2026-04-08T13:01:00.000Z",
        }),
        result: Object.freeze({
          summary: "Generated one image from degraded fallback node.",
          outputs: Object.freeze([]),
        }),
      }),
    });

    const completedRecord = await runRepository.findRunById(created.run.runId);
    expect(completedRecord).toBeDefined();
    const completedCanonical = mapPlatformRunRecordToCanonicalRun(completedRecord!);
    expect(completedCanonical.state).toBe("completed");
    expect(completedCanonical.assignment.status).toBe("released");
    expect(completedCanonical.assignment.assignedNodeId).toBe("node-degraded");
    expect(completedCanonical.assignment.releaseReason).toBe("execution-completed");
  });

  it("rejects incompatible requested nodes before dispatch to prevent hidden single-backend assumptions", async () => {
    const runRepository = new InMemoryRunRepository();
    const queueRepository = new InMemoryQueueRepository();
    const intentRepository = new InMemoryIntentRepository();
    const idGenerator = new SequenceIdGenerator();
    const nodeRepository = new InMemoryExecutionNodeRepository();
    nodeRepository.records.set("node-incompatible", createExecutionNode({
      nodeId: "node-incompatible",
      backendFamily: "custom-runtime",
    }));
    nodeRepository.records.set("node-compatible", createExecutionNode({
      nodeId: "node-compatible",
      backendFamily: "comfyui",
    }));

    const createRun = new CreateAuthoritativeRunUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
    });
    const created = await createRun.execute({
      command: buildSubmissionCommand("2026-04-08T13:10:00.000Z"),
    });

    const selectReady = new SelectAssignmentReadyRunsUseCase({
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T13:10:05.000Z"),
    });
    const claimForDispatch = new ClaimRunForNodeDispatchPreparationUseCase({
      runRepository,
      queueRepository,
      idGenerator,
      now: () => new Date("2026-04-08T13:10:06.000Z"),
    });
    const dispatchResultHandler = new HandleRunDispatchResultUseCase({
      runRepository,
      queueRepository,
      orchestrationIntentRepository: intentRepository,
      idGenerator,
      now: () => new Date("2026-04-08T13:10:07.000Z"),
    });
    let dispatchCalls = 0;
    const dispatchAssigned = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: new BuildAssignedRunExecutionCommandUseCase({
        runRepository,
        queueRepository,
      }),
      dispatchPort: {
        dispatch: async () => {
          dispatchCalls += 1;
          return Object.freeze({
            dispatchId: "dispatch:run:should-not-happen",
            backendKind: "comfyui",
            backendRunId: "comfy-job:should-not-happen",
            acceptedAt: "2026-04-08T13:10:07.000Z",
          });
        },
      },
      dispatchResultHandler,
      runRepository,
      queueRepository,
      now: () => new Date("2026-04-08T13:10:07.000Z"),
    });
    const selectionService = new CapturingSelectionService(new ImageRunExecutionNodeSelectionService({
      eligibilityService: new ImageRunNodeEligibilityEvaluationService({
        nodeRepository,
      }),
    }));

    const useCase = new ProcessQueuedRunDispatchUseCase({
      selectAssignmentReadyRunsUseCase: selectReady,
      claimRunForNodeDispatchPreparationUseCase: claimForDispatch,
      dispatchAssignedRunExecutionUseCase: dispatchAssigned,
      runNodeSelectionService: selectionService,
      queueRepository,
      now: () => new Date("2026-04-08T13:10:05.000Z"),
    });

    const result = await useCase.execute({
      reservationOwner: "orchestrator:image-default",
      nodeId: "node-incompatible",
      queueId: "queue:default",
      workspaceId: "workspace-alpha",
      limit: 1,
      reservationTtlSeconds: 120,
    });

    expect(result.outcomes).toHaveLength(1);
    expect(result.outcomes[0]?.status).toBe("failed");
    if (result.outcomes[0]?.status === "failed") {
      expect(result.outcomes[0].stage).toBe("selection");
      expect(result.outcomes[0].selection?.outcome).toBe(ImageRunExecutionNodeSelectionOutcomes.noEligibleNode);
      expect(result.outcomes[0].selection?.candidateCount).toBe(1);
    }

    expect(dispatchCalls).toBe(0);
    const selectionDecision = selectionService.decisionsByRunId.get(created.run.runId);
    expect(selectionDecision?.outcome).toBe(ImageRunExecutionNodeSelectionOutcomes.noEligibleNode);
    expect(selectionDecision?.candidates[0]?.nodeId).toBe("node-incompatible");
    expect(selectionDecision?.candidates[0]?.decision).toBe("incompatible");

    const persisted = await runRepository.findRunById(created.run.runId);
    expect(persisted?.status).toBe("pending");
    const queueEntry = await queueRepository.getQueueEntryByRunId(created.run.runId);
    expect(queueEntry?.lifecycleState).toBe("queued");
    expect(queueEntry?.claimToken).toBeUndefined();
    const attempts = await queueRepository.listDispatchAttemptsByRunId(created.run.runId);
    expect(attempts).toHaveLength(0);
  });
});

