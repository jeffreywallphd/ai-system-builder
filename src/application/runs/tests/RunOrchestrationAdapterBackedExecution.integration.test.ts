import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type {
  AuthorizationPolicyDecisionEvaluationRequest,
  AuthorizationPolicyDecisionEvaluationResult,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import type { IPlatformAuditEventRepository, PlatformAuditEventRecord, PlatformPersistenceMutationContext } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  IRunOrchestrationIntentRepository,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import {
  RunDispatchGuardError,
  RunDispatchGuardErrorCodes,
} from "@application/runs/use-cases/DispatchAssignedRunExecutionUseCase";
import { BuildAssignedRunExecutionCommandUseCase } from "@application/runs/use-cases/BuildAssignedRunExecutionCommandUseCase";
import { ClaimRunForNodeDispatchPreparationUseCase } from "@application/runs/use-cases/ClaimRunForNodeDispatchPreparationUseCase";
import { CreateAuthoritativeRunUseCase } from "@application/runs/use-cases/CreateAuthoritativeRunUseCase";
import { DispatchAssignedRunExecutionUseCase } from "@application/runs/use-cases/DispatchAssignedRunExecutionUseCase";
import { GetAuthoritativeRunUseCase } from "@application/runs/use-cases/GetAuthoritativeRunUseCase";
import { HandleRunDispatchResultUseCase } from "@application/runs/use-cases/HandleRunDispatchResultUseCase";
import { IngestRunExecutionUpdateUseCase } from "@application/runs/use-cases/IngestRunExecutionUpdateUseCase";
import {
  RequestAuthoritativeRunCancellationUseCase,
  RunCancellationOutcomes,
} from "@application/runs/use-cases/RequestAuthoritativeRunCancellationUseCase";
import { SelectAssignmentReadyRunsUseCase } from "@application/runs/use-cases/SelectAssignmentReadyRunsUseCase";
import { SubmitImageRunUseCase } from "@application/runs/use-cases/SubmitImageRunUseCase";
import { ValidateRunSubmissionUseCase } from "@application/runs/use-cases/ValidateRunSubmissionUseCase";
import type {
  IRunSubmissionTargetResolverPort,
  RunSubmissionTargetResolutionRequest,
  RunSubmissionTargetResolutionResult,
} from "@application/runs/ports/RunSubmissionValidationPorts";
import type { IWorkspaceRepository } from "@application/workspaces/ports/IWorkspaceRepository";
import type { Workspace } from "@domain/workspaces/WorkspaceDomain";
import { WorkspaceStatuses, createWorkspace } from "@domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";
import type { WorkspaceListQuery } from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import { ComfyUiRunExecutionDispatchAdapter, type ComfyUiDispatchPayload } from "@infrastructure/execution/runs/ComfyUiRunExecutionDispatchAdapter";
import { RunExecutionDispatchRouter } from "@infrastructure/execution/runs/RunExecutionDispatchRouter";
import { SqlitePlatformPersistenceAdapter } from "@infrastructure/persistence/platform/SqlitePlatformPersistenceAdapter";

const createdRoots: string[] = [];

afterEach(() => {
  while (createdRoots.length > 0) {
    const root = createdRoots.pop();
    if (root) {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

class InMemoryWorkspaceRepository implements IWorkspaceRepository {
  private readonly workspaces = new Map<string, Workspace>();

  public async findWorkspaceById(workspaceId: string): Promise<Workspace | undefined> {
    return this.workspaces.get(workspaceId);
  }

  public async findWorkspaceBySlug(_slug: string): Promise<Workspace | undefined> {
    return undefined;
  }

  public async listWorkspaces(_query: WorkspaceListQuery): Promise<ReadonlyArray<Workspace>> {
    return Object.freeze([...this.workspaces.values()]);
  }

  public async saveWorkspace(workspace: Workspace): Promise<Workspace> {
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }
}

class AllowAllAuthorizationPolicyDecisionEvaluator implements IAuthorizationPolicyDecisionEvaluator {
  public async evaluateDecision(
    request: AuthorizationPolicyDecisionEvaluationRequest,
  ): Promise<AuthorizationPolicyDecisionEvaluationResult> {
    return Object.freeze({
      decision: Object.freeze({
        isAllowed: true,
        outcome: "allow",
        requiredPermissionKey: request.requiredPermissionKey,
        reasonCode: "integration-allow",
        reason: "Allowed in orchestration integration test harness.",
        evaluatedAt: "2026-04-08T16:00:00.000Z",
        matchedRoleAssignmentIds: Object.freeze([]),
        matchedPermissionGrantIds: Object.freeze([]),
        matchedSharingGrantIds: Object.freeze([]),
      }),
      debug: Object.freeze({
        targetKind: request.target.kind,
        sourceKind: "integration-harness",
        roleAssignmentCount: 0,
        permissionGrantCount: 0,
        sharingGrantCount: 0,
      }),
    });
  }
}

class StaticSubmissionTargetResolver implements IRunSubmissionTargetResolverPort {
  public async resolveRunSubmissionTarget(
    _request: RunSubmissionTargetResolutionRequest,
  ): Promise<RunSubmissionTargetResolutionResult> {
    return Object.freeze({
      systemExists: true,
      versionExists: true,
      workflowExists: true,
      templateExists: true,
      allowedParameterKeys: Object.freeze([
        "prompt",
        "seed",
        "strength",
        "scaleFactor",
        "preserveUnmaskedAreas",
      ]),
      requiredPolicyPrerequisiteIds: Object.freeze([]),
    });
  }
}

class PlatformAuditIntentRepository implements IRunOrchestrationIntentRepository {
  public constructor(private readonly auditRepository: IPlatformAuditEventRepository) {}

  public async appendOrchestrationIntent(
    event: PlatformAuditEventRecord,
    mutation: PlatformPersistenceMutationContext,
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly record: PlatformAuditEventRecord }> {
    return this.auditRepository.appendAuditEvent(event, mutation);
  }
}

class SequenceIdGenerator {
  private value = 0;

  public nextId(prefix: string): string {
    this.value += 1;
    return `${prefix}:${this.value}`;
  }
}

class StubComfyDispatchGateway {
  public readonly payloads: ComfyUiDispatchPayload[] = [];
  public failRunIds = new Set<string>();

  public async submitComfyUiDispatch(payload: ComfyUiDispatchPayload): Promise<{
    readonly acceptedAt?: string;
    readonly backendRunId?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }> {
    this.payloads.push(payload);
    if (this.failRunIds.has(payload.runId)) {
      throw new Error("comfy backend unavailable");
    }

    return Object.freeze({
      acceptedAt: "2026-04-08T16:02:00.000Z",
      backendRunId: `comfy-run:${payload.runId}`,
      metadata: Object.freeze({
        queueNumber: 7,
      }),
    });
  }
}

function createWorkspaceRecord(workspaceId: string): Workspace {
  return createWorkspace({
    id: workspaceId,
    slug: workspaceId.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase(),
    displayName: workspaceId,
    ownerUserId: "user:artist",
    createdBy: "user:artist",
    status: WorkspaceStatuses.active,
    visibility: WorkspaceVisibilities.team,
    now: new Date("2026-04-08T16:00:00.000Z"),
  });
}

function createSubmissionInput(input: {
  readonly workflowId: string;
  readonly operationTag: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}) {
  return Object.freeze({
    actor: Object.freeze({
      actorUserIdentityId: "user:artist",
      activeWorkspaceId: "workspace-alpha",
    }),
    workspaceId: "workspace-alpha",
    submission: Object.freeze({
      source: "api" as const,
      workflowId: input.workflowId,
      submittedByActorId: "user:artist",
      correlationId: input.correlationId,
      idempotencyKey: input.idempotencyKey,
      runtimeTarget: Object.freeze({
        systemId: "comfyui",
        versionId: "comfyui:v1",
        async: true,
      }),
      tags: Object.freeze([
        "queue:default",
        input.operationTag,
      ]),
      parameters: input.parameters,
      policyPrerequisites: Object.freeze([]),
      storageReferences: Object.freeze([]),
      resourceReferences: Object.freeze([]),
    }),
    occurredAt: input.occurredAt,
  });
}

function createHarness() {
  const root = mkdtempSync(path.join(tmpdir(), "loom-run-orch-adapter-integration-"));
  createdRoots.push(root);
  const persistence = new SqlitePlatformPersistenceAdapter(path.join(root, "platform.sqlite"));
  const intentRepository = new PlatformAuditIntentRepository(persistence);
  const idGenerator = new SequenceIdGenerator();

  const workspaceRepository = new InMemoryWorkspaceRepository();
  workspaceRepository.saveWorkspace(createWorkspaceRecord("workspace-alpha"));

  const validate = new ValidateRunSubmissionUseCase({
    workspaceRepository,
    authorizationDecisionEvaluator: new AllowAllAuthorizationPolicyDecisionEvaluator(),
    targetResolver: new StaticSubmissionTargetResolver(),
  });

  const createRun = new CreateAuthoritativeRunUseCase({
    runRepository: persistence,
    queueRepository: persistence,
    orchestrationIntentRepository: intentRepository,
    transactionManager: persistence,
    idGenerator,
  });

  const submit = new SubmitImageRunUseCase({
    validateRunSubmissionUseCase: validate,
    createAuthoritativeRunUseCase: createRun,
  });

  const selectReady = new SelectAssignmentReadyRunsUseCase({
    runRepository: persistence,
    queueRepository: persistence,
    now: () => new Date("2026-04-08T16:01:00.000Z"),
  });
  const claim = new ClaimRunForNodeDispatchPreparationUseCase({
    runRepository: persistence,
    queueRepository: persistence,
    transactionManager: persistence,
    idGenerator,
  });
  const commandBuilder = new BuildAssignedRunExecutionCommandUseCase({
    runRepository: persistence,
    queueRepository: persistence,
  });
  const dispatchResultHandler = new HandleRunDispatchResultUseCase({
    runRepository: persistence,
    queueRepository: persistence,
    orchestrationIntentRepository: intentRepository,
    transactionManager: persistence,
    idGenerator,
  });

  const comfyGateway = new StubComfyDispatchGateway();
  const dispatchRouter = new RunExecutionDispatchRouter([
    new ComfyUiRunExecutionDispatchAdapter({
      gateway: comfyGateway,
    }),
  ]);

  const dispatch = new DispatchAssignedRunExecutionUseCase({
    commandBuilder,
    dispatchPort: dispatchRouter,
    dispatchResultHandler,
    runRepository: persistence,
    queueRepository: persistence,
    transactionManager: persistence,
    now: () => new Date("2026-04-08T16:02:00.000Z"),
  });
  const ingest = new IngestRunExecutionUpdateUseCase({
    runRepository: persistence,
    queueRepository: persistence,
    orchestrationIntentRepository: intentRepository,
    transactionManager: persistence,
    idGenerator,
  });
  const cancel = new RequestAuthoritativeRunCancellationUseCase({
    runRepository: persistence,
    queueRepository: persistence,
    orchestrationIntentRepository: intentRepository,
    transactionManager: persistence,
    idGenerator,
    cancellationSignalPort: {
      signalCancellation: async () => Object.freeze({
        status: "accepted",
        acknowledgedAt: "2026-04-08T16:04:10.000Z",
      }),
    },
  });
  const getRun = new GetAuthoritativeRunUseCase(persistence);

  return Object.freeze({
    persistence,
    submit,
    selectReady,
    claim,
    commandBuilder,
    dispatchResultHandler,
    dispatch,
    dispatchRouter,
    comfyGateway,
    ingest,
    cancel,
    getRun,
  });
}

async function claimSingleRunForDispatch(input: {
  readonly runId: string;
  readonly selectReady: SelectAssignmentReadyRunsUseCase;
  readonly claim: ClaimRunForNodeDispatchPreparationUseCase;
  readonly preparedAt: string;
}): Promise<{ readonly dispatchAttemptId: string }> {
  const selection = await input.selectReady.execute({
    reservationOwner: "orchestrator:image-default",
    queueId: "queue:default",
    workspaceId: "workspace-alpha",
    limit: 5,
    reservationTtlSeconds: 120,
  });

  const selected = selection.items.find((entry) => entry.run.runId === input.runId);
  if (!selected) {
    throw new Error(`Run '${input.runId}' was not selected for assignment-ready claiming.`);
  }

  const claimed = await input.claim.execute({
    runId: selected.run.runId,
    nodeId: "node:image-executor:1",
    reservationOwner: "orchestrator:image-default",
    claimToken: selected.queue.claimToken,
    preparedAt: input.preparedAt,
  });

  return Object.freeze({
    dispatchAttemptId: claimed.dispatchPreparation.dispatchAttemptId,
  });
}

describe("Run orchestration adapter-backed execution integration", () => {
  it("routes validated image submission through queue, adapter dispatch, progress sync, and terminal completion", async () => {
    const harness = createHarness();
    const submission = await harness.submit.execute(createSubmissionInput({
      workflowId: "workflow:image-to-image",
      operationTag: "op:image-to-image",
      idempotencyKey: "image-success-1",
      correlationId: "corr:image-success-1",
      occurredAt: "2026-04-08T16:00:00.000Z",
      parameters: Object.freeze({
        prompt: "cinematic portrait",
        seed: 7,
        strength: 0.55,
      }),
    }));
    expect(submission.ok).toBeTrue();
    if (!submission.ok) {
      return;
    }

    const runId = submission.response.run.runId;
    expect(submission.response.run.state).toBe("queued");

    const claim = await claimSingleRunForDispatch({
      runId,
      selectReady: harness.selectReady,
      claim: harness.claim,
      preparedAt: "2026-04-08T16:01:00.000Z",
    });

    const dispatchResult = await harness.dispatch.execute({
      runId,
      dispatchAttemptId: claim.dispatchAttemptId,
    });
    expect(dispatchResult.receipt.backendKind).toBe("comfyui");
    expect(harness.comfyGateway.payloads).toHaveLength(1);
    expect(harness.comfyGateway.payloads[0]?.workflowId).toBe("workflow:image-to-image");
    expect(harness.comfyGateway.payloads[0]?.inputParameters).toEqual({
      prompt: "cinematic portrait",
      seed: 7,
      strength: 0.55,
    });

    await harness.ingest.execute({
      runId,
      senderNodeId: "node:image-executor:1",
      update: Object.freeze({
        runId,
        senderNodeId: "node:image-executor:1",
        senderBackendKind: "comfyui",
        senderBackendRunId: dispatchResult.receipt.backendRunId,
        heartbeatAt: "2026-04-08T16:02:30.000Z",
        progress: Object.freeze({
          updatedAt: "2026-04-08T16:02:30.000Z",
          percent: 64,
          stage: "sampler",
          message: "Rendering latent samples.",
        }),
      }),
    });

    await harness.ingest.execute({
      runId,
      senderNodeId: "node:image-executor:1",
      update: Object.freeze({
        runId,
        senderNodeId: "node:image-executor:1",
        senderBackendKind: "comfyui",
        senderBackendRunId: dispatchResult.receipt.backendRunId,
        occurredAt: "2026-04-08T16:03:00.000Z",
        toState: "completed",
        execution: Object.freeze({
          outcome: "succeeded",
          finishedAt: "2026-04-08T16:03:00.000Z",
        }),
        result: Object.freeze({
          summary: "Generated one stylized image.",
          externalResultId: "result:image-success-1",
          outputs: Object.freeze([
            Object.freeze({
              outputId: "generatedImage",
              kind: "asset",
              assetId: "asset:generated-1",
            }),
          ]),
          outputAvailabilityHint: "available",
          terminalQualityHint: "standard",
        }),
      }),
    });

    const run = await harness.getRun.execute({
      runId,
      workspaceId: "workspace-alpha",
    });
    expect(run?.state).toBe("completed");
    expect(run?.executionOutcome).toBe("succeeded");
    expect(run?.finalization?.outputs[0]?.assetId).toBe("asset:generated-1");

    const queueEntry = await harness.persistence.getQueueEntryByRunId(runId);
    expect(queueEntry?.lifecycleState).toBe("completed");
    expect(queueEntry?.claimToken).toBeUndefined();

    const statusHistory = await harness.persistence.listRunStatusHistory({
      runId,
      workspaceId: "workspace-alpha",
    });
    const lifecycleStates = statusHistory.map((entry) => entry.lifecycleState);
    expect(lifecycleStates).toContain("queued");
    expect(lifecycleStates).toContain("assigned");
    expect(lifecycleStates).toContain("dispatching");
    expect(lifecycleStates).toContain("running");
    expect(lifecycleStates).toContain("completed");

    const completedEntry = statusHistory.find((entry) => entry.lifecycleState === "completed");
    expect(completedEntry?.backendKind).toBe("comfyui");
    expect(completedEntry?.backendRunId).toBe(dispatchResult.receipt.backendRunId);
  });

  it("records authoritative failed dispatch outcomes when adapter-backed dispatch cannot start", async () => {
    const harness = createHarness();
    const submission = await harness.submit.execute(createSubmissionInput({
      workflowId: "workflow:enhance-upscale",
      operationTag: "op:enhance-upscale",
      idempotencyKey: "image-failure-1",
      correlationId: "corr:image-failure-1",
      occurredAt: "2026-04-08T16:10:00.000Z",
      parameters: Object.freeze({
        prompt: "high-detail upscale",
        scaleFactor: 2,
      }),
    }));
    expect(submission.ok).toBeTrue();
    if (!submission.ok) {
      return;
    }
    const runId = submission.response.run.runId;
    harness.comfyGateway.failRunIds.add(runId);

    const claim = await claimSingleRunForDispatch({
      runId,
      selectReady: harness.selectReady,
      claim: harness.claim,
      preparedAt: "2026-04-08T16:11:00.000Z",
    });

    await expect(harness.dispatch.execute({
      runId,
      dispatchAttemptId: claim.dispatchAttemptId,
    })).rejects.toBeInstanceOf(Error);

    const run = await harness.getRun.execute({
      runId,
      workspaceId: "workspace-alpha",
    });
    expect(run?.state).toBe("failed");
    expect(run?.executionOutcome).toBe("failed");

    const queueEntry = await harness.persistence.getQueueEntryByRunId(runId);
    expect(queueEntry?.lifecycleState).toBe("failed");

    const statusHistory = await harness.persistence.listRunStatusHistory({
      runId,
      workspaceId: "workspace-alpha",
    });
    const failedEntry = statusHistory.find((entry) => entry.lifecycleState === "failed");
    expect(failedEntry?.safeFailureCode).toBe("dispatch-failed-to-start");
    expect(failedEntry?.safeFailureMessage).toBe("Run failed to start on the selected execution backend.");
  });

  it("guards duplicate dispatch and supports cancellation to cancelled terminal state", async () => {
    const harness = createHarness();
    const submission = await harness.submit.execute(createSubmissionInput({
      workflowId: "workflow:mask-guided-edit",
      operationTag: "op:mask-guided-edit",
      idempotencyKey: "image-cancel-1",
      correlationId: "corr:image-cancel-1",
      occurredAt: "2026-04-08T16:20:00.000Z",
      parameters: Object.freeze({
        prompt: "remove distracting object",
        preserveUnmaskedAreas: true,
      }),
    }));
    expect(submission.ok).toBeTrue();
    if (!submission.ok) {
      return;
    }

    const runId = submission.response.run.runId;
    const claim = await claimSingleRunForDispatch({
      runId,
      selectReady: harness.selectReady,
      claim: harness.claim,
      preparedAt: "2026-04-08T16:21:00.000Z",
    });

    const cachedCommand = await harness.commandBuilder.execute({
      runId,
      dispatchAttemptId: claim.dispatchAttemptId,
    });
    const cachedDispatch = new DispatchAssignedRunExecutionUseCase({
      commandBuilder: {
        execute: async () => cachedCommand,
      },
      dispatchPort: harness.dispatchRouter,
      dispatchResultHandler: harness.dispatchResultHandler,
      runRepository: harness.persistence,
      queueRepository: harness.persistence,
      transactionManager: harness.persistence,
      now: () => new Date("2026-04-08T16:22:00.000Z"),
    });

    const firstDispatch = await cachedDispatch.execute({
      runId,
      dispatchAttemptId: claim.dispatchAttemptId,
    });
    expect(firstDispatch.receipt.backendKind).toBe("comfyui");

    await expect(cachedDispatch.execute({
      runId,
      dispatchAttemptId: claim.dispatchAttemptId,
    })).rejects.toMatchObject({
      name: "RunDispatchGuardError",
      code: RunDispatchGuardErrorCodes.dispatchAttemptAlreadyFinalized,
    } satisfies Partial<RunDispatchGuardError>);

    const cancellation = await harness.cancel.execute({
      workspaceId: "workspace-alpha",
      actorUserIdentityId: "user:artist",
      request: Object.freeze({
        runId,
        requestedAt: "2026-04-08T16:23:00.000Z",
        reason: "User aborted edit preview.",
      }),
    });
    expect(cancellation.outcome).toBe(RunCancellationOutcomes.cancellationRequested);
    expect(cancellation.status.state).toBe("cancelling");

    await harness.ingest.execute({
      runId,
      senderNodeId: "node:image-executor:1",
      update: Object.freeze({
        runId,
        senderNodeId: "node:image-executor:1",
        senderBackendKind: "comfyui",
        senderBackendRunId: firstDispatch.receipt.backendRunId,
        occurredAt: "2026-04-08T16:23:30.000Z",
        toState: "cancelled",
        execution: Object.freeze({
          outcome: "cancelled",
          finishedAt: "2026-04-08T16:23:30.000Z",
        }),
      }),
    });

    const run = await harness.getRun.execute({
      runId,
      workspaceId: "workspace-alpha",
    });
    expect(run?.state).toBe("cancelled");
    expect(run?.executionOutcome).toBe("cancelled");
    expect(run?.finalization?.outcome).toBe("cancelled");

    const statusHistory = await harness.persistence.listRunStatusHistory({
      runId,
      workspaceId: "workspace-alpha",
    });
    expect(statusHistory.some((entry) => entry.lifecycleState === "cancelling")).toBeTrue();
    expect(statusHistory.some((entry) => entry.lifecycleState === "cancelled")).toBeTrue();
  });
});
