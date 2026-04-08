import { describe, expect, it } from "bun:test";
import {
  RunOrchestrationTransportContractVersions,
  type RunDetail,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  RunSubmissionValidationErrorCodes,
  type CanonicalRunSubmissionCommand,
  type ValidateRunSubmissionResult,
} from "../use-cases/RunSubmissionValidationContracts";
import { SubmitImageRunUseCase } from "../use-cases/SubmitImageRunUseCase";
import { buildImageRunSubmissionReadinessResult } from "@application/image-workflows/ImageRunSubmissionReadinessContracts";

class StubValidateRunSubmissionUseCase {
  public result: ValidateRunSubmissionResult = Object.freeze({
    ok: true as const,
    command: createCanonicalCommand(),
  });

  public async execute(): Promise<ValidateRunSubmissionResult> {
    return this.result;
  }
}

class StubCreateAuthoritativeRunUseCase {
  public calls = 0;

  public async execute(): Promise<{
    readonly run: RunDetail;
    readonly persistedRunRevision: number;
    readonly orchestrationIntentEventId: string;
  }> {
    this.calls += 1;
    return Object.freeze({
      run: createRunDetail("run:queued"),
      persistedRunRevision: 1,
      orchestrationIntentEventId: "audit:queued",
    });
  }
}

describe("SubmitImageRunUseCase", () => {
  it("returns authoritative submission response with readiness findings and warnings on success", async () => {
    const validate = new StubValidateRunSubmissionUseCase();
    const create = new StubCreateAuthoritativeRunUseCase();
    const useCase = new SubmitImageRunUseCase({
      validateRunSubmissionUseCase: validate as never,
      createAuthoritativeRunUseCase: create as never,
      imageRunReadinessResolver: Object.freeze({
        resolveRunSubmissionReadiness: async () => buildImageRunSubmissionReadinessResult({
          checkedAt: "2026-04-08T14:00:00.000Z",
          issues: Object.freeze([Object.freeze({
            code: "adapter-degraded",
            summary: "Execution adapter reports degraded health.",
            category: "advisory",
            severity: "warning",
            blocking: false,
            path: "submission.readiness.adapter",
          })]),
          policyDenials: Object.freeze([]),
          assetBinding: Object.freeze({
            complete: true,
            missingInputBindingIds: Object.freeze([]),
            missingOutputBindingIds: Object.freeze([]),
            unresolvedAssetReferences: Object.freeze([]),
          }),
          workflowValidity: Object.freeze({
            valid: true,
            issues: Object.freeze([]),
          }),
          systemValidity: Object.freeze({
            valid: true,
            issues: Object.freeze([]),
          }),
          backendReadinessDependency: Object.freeze({
            adapterHealth: "degraded",
            ready: true,
            issues: Object.freeze([]),
          }),
          compatibility: Object.freeze({
            compatible: true,
            issues: Object.freeze([]),
          }),
        }),
      }),
    });

    const result = await useCase.execute({
      actor: Object.freeze({
        actorUserIdentityId: "user:alpha",
        activeWorkspaceId: "workspace-alpha",
      }),
      workspaceId: "workspace-alpha",
      submission: Object.freeze({
        runtimeTarget: Object.freeze({
          systemId: "system-alpha",
          versionId: "version-1",
          async: true,
        }),
      }),
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.response.run.runId).toBe("run:queued");
    expect(result.response.run.state).toBe("queued");
    expect(result.readiness.state).toBe("advisory");
    expect(result.warnings).toHaveLength(1);
    expect(result.response.validationIssues).toHaveLength(1);
    expect(result.response.validationIssues?.[0]?.code).toBe("adapter-degraded");
    expect(create.calls).toBe(1);
  });

  it("rejects cleanly when validation denies submission", async () => {
    const validate = new StubValidateRunSubmissionUseCase();
    validate.result = Object.freeze({
      ok: false,
      error: Object.freeze({
        code: RunSubmissionValidationErrorCodes.forbidden,
        message: "Actor is not authorized.",
        validationIssues: Object.freeze([Object.freeze({
          kind: "authorization",
          path: "submission.runtimeTarget.systemId",
          code: "system-execute-not-authorized",
          message: "Actor is not authorized.",
        })]),
      }),
    });
    const create = new StubCreateAuthoritativeRunUseCase();
    const useCase = new SubmitImageRunUseCase({
      validateRunSubmissionUseCase: validate as never,
      createAuthoritativeRunUseCase: create as never,
    });

    const result = await useCase.execute({
      actor: Object.freeze({
        actorUserIdentityId: "user:alpha",
        activeWorkspaceId: "workspace-alpha",
      }),
      workspaceId: "workspace-alpha",
      submission: Object.freeze({
        runtimeTarget: Object.freeze({
          systemId: "system-alpha",
          versionId: "version-1",
          async: true,
        }),
      }),
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("forbidden");
    expect(result.error.validationIssues).toHaveLength(1);
    expect(create.calls).toBe(0);
  });

  it("rejects submission when readiness is blocked", async () => {
    const validate = new StubValidateRunSubmissionUseCase();
    const create = new StubCreateAuthoritativeRunUseCase();
    const useCase = new SubmitImageRunUseCase({
      validateRunSubmissionUseCase: validate as never,
      createAuthoritativeRunUseCase: create as never,
      imageRunReadinessResolver: Object.freeze({
        resolveRunSubmissionReadiness: async () => buildImageRunSubmissionReadinessResult({
          checkedAt: "2026-04-08T14:00:00.000Z",
          issues: Object.freeze([Object.freeze({
            code: "backend-unavailable",
            summary: "Execution backend is unavailable.",
            category: "backend-readiness-dependency",
            severity: "error",
            blocking: true,
          })]),
          policyDenials: Object.freeze([]),
          assetBinding: Object.freeze({
            complete: true,
            missingInputBindingIds: Object.freeze([]),
            missingOutputBindingIds: Object.freeze([]),
            unresolvedAssetReferences: Object.freeze([]),
          }),
          workflowValidity: Object.freeze({
            valid: true,
            issues: Object.freeze([]),
          }),
          systemValidity: Object.freeze({
            valid: true,
            issues: Object.freeze([]),
          }),
          backendReadinessDependency: Object.freeze({
            adapterHealth: "unavailable",
            ready: false,
            issues: Object.freeze([]),
          }),
          compatibility: Object.freeze({
            compatible: true,
            issues: Object.freeze([]),
          }),
        }),
      }),
    });

    const result = await useCase.execute({
      actor: Object.freeze({
        actorUserIdentityId: "user:alpha",
        activeWorkspaceId: "workspace-alpha",
      }),
      workspaceId: "workspace-alpha",
      submission: Object.freeze({
        runtimeTarget: Object.freeze({
          systemId: "system-alpha",
          versionId: "version-1",
          async: true,
        }),
      }),
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("policy-ineligible");
    expect(result.error.validationIssues[0]?.code).toBe("backend-unavailable");
    expect(create.calls).toBe(0);
  });
});

function createCanonicalCommand(): CanonicalRunSubmissionCommand {
  return Object.freeze({
    actor: Object.freeze({
      actorUserIdentityId: "user:alpha",
      activeWorkspaceId: "workspace-alpha",
    }),
    workspaceId: "workspace-alpha",
    workflowId: "workflow-alpha",
    source: "api",
    runtimeTarget: Object.freeze({
      systemId: "system-alpha",
      versionId: "version-1",
      async: true,
    }),
    tags: Object.freeze([]),
    parameters: Object.freeze({}),
    storageReferences: Object.freeze([]),
    resourceReferences: Object.freeze([]),
    policyPrerequisites: Object.freeze([]),
    submissionContext: Object.freeze({
      submittedByActorId: "user:alpha",
    }),
    occurredAt: "2026-04-08T14:00:00.000Z",
  });
}

function createRunDetail(runId: string): RunDetail {
  return Object.freeze({
    contractVersion: RunOrchestrationTransportContractVersions.v1,
    runId,
    workflowId: "workflow-alpha",
    workspaceId: "workspace-alpha",
    source: "api",
    state: "queued",
    assignmentStatus: "unassigned",
    executionOutcome: "none",
    submittedAt: "2026-04-08T14:00:00.000Z",
    updatedAt: "2026-04-08T14:00:00.000Z",
    queue: Object.freeze({
      queueId: "queue:default",
      enteredAt: "2026-04-08T14:00:00.000Z",
      position: null,
      positionAsOf: "2026-04-08T14:00:00.000Z",
    }),
    submission: Object.freeze({
      submittedByActorId: "user:alpha",
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
  });
}
