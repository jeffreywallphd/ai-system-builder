import { describe, expect, it } from "bun:test";
import {
  RunOrchestrationTransportContractVersions,
  type RunDetail,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { RunSubmissionValidationErrorCodes } from "@application/runs/use-cases/RunSubmissionValidationContracts";
import { AuthoritativeRunSubmissionBackendApi } from "../AuthoritativeRunSubmissionBackendApi";
import { AssetBackedRunSubmissionTargetResolver } from "../AssetBackedRunSubmissionTargetResolver";

describe("AuthoritativeRunSubmissionBackendApi", () => {
  it("returns canonical run submission acceptance payload when validation passes", async () => {
    const backend = new AuthoritativeRunSubmissionBackendApi({
      validateRunSubmissionUseCase: {
        execute: async () => Object.freeze({
          ok: true as const,
          command: Object.freeze({
            actor: Object.freeze({
              actorUserIdentityId: "user:1",
              activeWorkspaceId: "workspace-alpha",
            }),
            workspaceId: "workspace-alpha",
            source: "api",
            runtimeTarget: Object.freeze({
              systemId: "system-demo",
              versionId: "version-1",
              async: true,
            }),
            tags: Object.freeze([]),
            parameters: Object.freeze({}),
            storageReferences: Object.freeze([]),
            resourceReferences: Object.freeze([]),
            policyPrerequisites: Object.freeze([]),
            submissionContext: Object.freeze({
              submittedByActorId: "user:1",
            }),
            occurredAt: "2026-04-07T12:00:00.000Z",
          }),
        }),
      } as any,
      createAuthoritativeRunUseCase: {
        execute: async () => Object.freeze({
          run: createRunDetail("run:1"),
          persistedRunRevision: 1,
          orchestrationIntentEventId: "audit:1",
        }),
      } as any,
    });

    const response = await backend.submitRun({
      actorUserIdentityId: "user:1",
      workspaceId: "workspace-alpha",
      submission: Object.freeze({
        runtimeTarget: Object.freeze({
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        }),
      }),
    });

    expect(response.ok).toBe(true);
    expect(response.data?.run.runId).toBe("run:1");
    expect(response.data?.mutation.changed).toBe(true);
    expect(response.data?.mutation.mutationId).toBe("audit:1");
  });

  it("maps policy-ineligible validation denials to stable forbidden semantics with validation details", async () => {
    const backend = new AuthoritativeRunSubmissionBackendApi({
      validateRunSubmissionUseCase: {
        execute: async () => Object.freeze({
          ok: false as const,
          error: Object.freeze({
            code: RunSubmissionValidationErrorCodes.policyIneligible,
            message: "Run submission is policy-ineligible.",
            validationIssues: Object.freeze([Object.freeze({
              kind: "policy",
              path: "submission.parameters.unsafe",
              code: "parameter-not-allowed",
              message: "Parameter is not allowed.",
            })]),
          }),
        }),
      } as any,
      createAuthoritativeRunUseCase: {
        execute: async () => {
          throw new Error("should not execute");
        },
      } as any,
    });

    const response = await backend.submitRun({
      actorUserIdentityId: "user:1",
      workspaceId: "workspace-alpha",
      submission: Object.freeze({
        runtimeTarget: Object.freeze({
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        }),
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe("forbidden");
    expect(response.error?.domainCode).toBe("policy-ineligible");
    expect(response.error?.validationErrors?.[0]?.path).toBe("submission.parameters.unsafe");
  });

  it("maps run-creation conflicts to shared conflict error responses", async () => {
    const backend = new AuthoritativeRunSubmissionBackendApi({
      validateRunSubmissionUseCase: {
        execute: async () => Object.freeze({
          ok: true as const,
          command: Object.freeze({
            actor: Object.freeze({
              actorUserIdentityId: "user:1",
              activeWorkspaceId: "workspace-alpha",
            }),
            workspaceId: "workspace-alpha",
            source: "api",
            runtimeTarget: Object.freeze({
              systemId: "system-demo",
              versionId: "version-1",
              async: true,
            }),
            tags: Object.freeze([]),
            parameters: Object.freeze({}),
            storageReferences: Object.freeze([]),
            resourceReferences: Object.freeze([]),
            policyPrerequisites: Object.freeze([]),
            submissionContext: Object.freeze({
              submittedByActorId: "user:1",
            }),
            occurredAt: "2026-04-07T12:00:00.000Z",
          }),
        }),
      } as any,
      createAuthoritativeRunUseCase: {
        execute: async () => {
          throw new Error("Platform run 'run:1' already exists.");
        },
      } as any,
    });

    const response = await backend.submitRun({
      actorUserIdentityId: "user:1",
      workspaceId: "workspace-alpha",
      submission: Object.freeze({
        runtimeTarget: Object.freeze({
          systemId: "system-demo",
          versionId: "version-1",
          async: true,
        }),
      }),
    });

    expect(response.ok).toBe(false);
    expect(response.error?.code).toBe("conflict");
  });
});

describe("AssetBackedRunSubmissionTargetResolver", () => {
  it("resolves target availability from workspace-scoped persisted assets and versions", async () => {
    const resolver = new AssetBackedRunSubmissionTargetResolver({
      findAssetById: async (assetId: string) => assetId === "system-demo"
        ? Object.freeze({
          id: "system-demo",
          ownership: Object.freeze({
            workspaceId: "workspace-alpha",
          }),
          lifecycle: Object.freeze({
            state: "active",
          }),
          versions: Object.freeze([Object.freeze({ versionId: "version-1" })]),
        })
        : undefined,
    } as any);

    const resolved = await resolver.resolveRunSubmissionTarget({
      workspaceId: "workspace-alpha",
      systemId: "system-demo",
      versionId: "version-1",
    });
    const workspaceMismatch = await resolver.resolveRunSubmissionTarget({
      workspaceId: "workspace-beta",
      systemId: "system-demo",
      versionId: "version-1",
    });

    expect(resolved.systemExists).toBe(true);
    expect(resolved.versionExists).toBe(true);
    expect(workspaceMismatch.systemExists).toBe(false);
  });

  it("treats deleted assets as unavailable runtime targets", async () => {
    const resolver = new AssetBackedRunSubmissionTargetResolver({
      findAssetById: async () => Object.freeze({
        id: "system-demo",
        ownership: Object.freeze({
          workspaceId: "workspace-alpha",
        }),
        lifecycle: Object.freeze({
          state: "deleted",
        }),
        versions: Object.freeze([Object.freeze({ versionId: "version-1" })]),
      }),
    } as any);

    const resolved = await resolver.resolveRunSubmissionTarget({
      workspaceId: "workspace-alpha",
      systemId: "system-demo",
      versionId: "version-1",
    });
    expect(resolved.systemExists).toBe(false);
    expect(resolved.versionExists).toBe(false);
  });
});

function createRunDetail(runId: string): RunDetail {
  return Object.freeze({
    contractVersion: RunOrchestrationTransportContractVersions.v1,
    runId,
    workflowId: "system:system-demo:version-1",
    workspaceId: "workspace-alpha",
    source: "api",
    state: "submitted",
    assignmentStatus: "unassigned",
    executionOutcome: "none",
    submittedAt: "2026-04-07T12:00:00.000Z",
    updatedAt: "2026-04-07T12:00:00.000Z",
    submission: Object.freeze({
      submittedByActorId: "user:1",
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
