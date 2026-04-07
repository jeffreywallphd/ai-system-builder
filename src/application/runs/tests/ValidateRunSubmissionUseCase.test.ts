import { describe, expect, it } from "bun:test";
import type { IWorkspaceRepository } from "@application/workspaces/ports/IWorkspaceRepository";
import type { Workspace } from "@domain/workspaces/WorkspaceDomain";
import { WorkspaceStatuses, createWorkspace } from "@domain/workspaces/WorkspaceDomain";
import { WorkspaceVisibilities } from "@shared/workspaces/WorkspaceOwnership";
import type { WorkspaceListQuery } from "@shared/contracts/workspaces/WorkspaceRepositoryContracts";
import type { IAuthorizationPolicyDecisionEvaluator } from "@application/authorization/ports/IAuthorizationPolicyDecisionEvaluator";
import {
  AuthorizationPolicyDecisionDenialReasons,
  type AuthorizationPolicyDecisionEvaluationRequest,
  type AuthorizationPolicyDecisionEvaluationResult,
} from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import {
  AuthorizationResourceFamilies,
  type AuthorizationResourceFamily,
} from "@domain/authorization/AuthorizationPermissionCatalog";
import type {
  IRunSubmissionTargetResolverPort,
  RunSubmissionTargetResolutionRequest,
  RunSubmissionTargetResolutionResult,
} from "@application/runs/ports/RunSubmissionValidationPorts";
import { RunSubmissionSecurityPrerequisiteKinds } from "@application/runs/ports/RunSubmissionValidationPorts";
import type { IStorageInstanceRepository } from "@application/storage/ports/IStorageInstanceRepository";
import type { StorageInstanceListQuery } from "@application/storage/ports/IStorageInstanceRepository";
import type { StorageInstance } from "@domain/storage/StorageDomain";
import type {
  IStoragePolicyEvaluationPort,
  StoragePolicyDecision,
  StoragePolicyEvaluationRequest,
  StorageAccessibleInstanceResolutionRequest,
} from "@application/storage/ports/StoragePolicyEvaluationPort";
import type {
  ContentEncryptionRequirementRequest,
  ContentEncryptionRequirementDecision,
  EffectiveEncryptionPolicyEvaluation,
  EffectiveEncryptionPolicyEvaluationRequest,
  EncryptionPolicyEvaluationServiceResult,
  IEncryptionPolicyEvaluationService,
  PreviewDecryptionAllowanceDecision,
  PreviewDecryptionAllowanceRequest,
  WorkerDecryptionAllowanceDecision,
  WorkerDecryptionAllowanceRequest,
} from "@application/security/use-cases/EncryptionPolicyEvaluationServiceContracts";
import { EncryptionPolicyEvaluationErrorCodes } from "@application/security/use-cases/EncryptionPolicyEvaluationServiceContracts";
import { ProtectedDataClasses } from "@domain/security/EncryptionAtRestPolicyDomain";
import {
  ValidateRunSubmissionUseCase,
} from "../use-cases/ValidateRunSubmissionUseCase";
import { RunSubmissionValidationErrorCodes } from "../use-cases/RunSubmissionValidationContracts";

class InMemoryWorkspaceRepository implements IWorkspaceRepository {
  public readonly workspaces = new Map<string, Workspace>();

  public async findWorkspaceById(workspaceId: string): Promise<Workspace | undefined> {
    return this.workspaces.get(workspaceId);
  }

  public async findWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const normalized = slug.trim().toLowerCase();
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === normalized) {
        return workspace;
      }
    }
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

class StubAuthorizationDecisionEvaluator implements IAuthorizationPolicyDecisionEvaluator {
  public deniedPermissions = new Set<string>();

  public async evaluateDecision(
    request: AuthorizationPolicyDecisionEvaluationRequest,
  ): Promise<AuthorizationPolicyDecisionEvaluationResult> {
    const denied = this.deniedPermissions.has(request.requiredPermissionKey);
    return Object.freeze({
      decision: Object.freeze({
        isAllowed: !denied,
        outcome: denied ? "deny" : "allow",
        requiredPermissionKey: request.requiredPermissionKey,
        reasonCode: denied ? "insufficient-permissions" : "matched-role-grant",
        reason: denied ? "Denied" : "Allowed",
        denialReason: denied ? AuthorizationPolicyDecisionDenialReasons.insufficientPermissions : undefined,
        evaluatedAt: "2026-04-07T15:00:00.000Z",
        matchedRoleAssignmentIds: Object.freeze([]),
        matchedPermissionGrantIds: Object.freeze([]),
        matchedSharingGrantIds: Object.freeze([]),
      }),
      debug: Object.freeze({
        targetKind: request.target.kind,
        sourceKind: "test",
        roleAssignmentCount: 0,
        permissionGrantCount: 0,
        sharingGrantCount: 0,
      }),
    });
  }
}

class StubTargetResolver implements IRunSubmissionTargetResolverPort {
  public response: RunSubmissionTargetResolutionResult = Object.freeze({
    systemExists: true,
    versionExists: true,
    workflowExists: true,
    templateExists: true,
    allowedParameterKeys: Object.freeze(["seed", "steps"]),
    requiredPolicyPrerequisiteIds: Object.freeze([]),
  });

  public async resolveRunSubmissionTarget(
    _request: RunSubmissionTargetResolutionRequest,
  ): Promise<RunSubmissionTargetResolutionResult> {
    return this.response;
  }
}

class InMemoryStorageInstanceRepository implements IStorageInstanceRepository {
  public readonly storage = new Map<string, StorageInstance>();

  public async findStorageInstanceById(storageInstanceId: string): Promise<StorageInstance | undefined> {
    return this.storage.get(storageInstanceId);
  }

  public async listStorageInstances(
    _query: StorageInstanceListQuery,
  ): Promise<ReadonlyArray<StorageInstance>> {
    return Object.freeze([...this.storage.values()]);
  }

  public async createStorageInstance(
    storageInstance: StorageInstance,
    _mutation: {
      readonly operationKey: string;
      readonly actorUserIdentityId: string;
      readonly occurredAt?: string;
      readonly correlationId?: string;
    },
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly storageInstance: StorageInstance; }> {
    this.storage.set(storageInstance.id, storageInstance);
    return Object.freeze({ changed: true, wasReplay: false, storageInstance });
  }

  public async saveStorageInstance(
    storageInstance: StorageInstance,
    _mutation: {
      readonly operationKey: string;
      readonly actorUserIdentityId: string;
      readonly occurredAt?: string;
      readonly correlationId?: string;
    },
  ): Promise<{ readonly changed: boolean; readonly wasReplay: boolean; readonly storageInstance: StorageInstance; }> {
    this.storage.set(storageInstance.id, storageInstance);
    return Object.freeze({ changed: true, wasReplay: false, storageInstance });
  }
}

class StubStoragePolicyPort implements IStoragePolicyEvaluationPort {
  public deny = false;

  public async evaluateStorageAction(
    _input: StoragePolicyEvaluationRequest,
  ): Promise<StoragePolicyDecision> {
    return Object.freeze({
      allowed: !this.deny,
      reasonCode: this.deny ? "storage-policy-denied" : "storage-policy-allowed",
      message: this.deny ? "Storage access denied." : "Allowed",
      occurredAt: "2026-04-07T15:00:00.000Z",
    });
  }

  public async resolveAccessibleStorageInstanceIds(
    input: StorageAccessibleInstanceResolutionRequest,
  ): Promise<ReadonlyArray<string>> {
    return input.candidateStorageInstanceIds;
  }
}

class StubEncryptionPolicyEvaluationService implements IEncryptionPolicyEvaluationService {
  public allow = true;

  public async evaluateEffectivePolicy(
    _request: EffectiveEncryptionPolicyEvaluationRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<EffectiveEncryptionPolicyEvaluation>> {
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: EncryptionPolicyEvaluationErrorCodes.internal,
        message: "Not implemented for this test.",
      }),
    });
  }

  public async evaluateContentEncryptionRequirement(
    request: ContentEncryptionRequirementRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<ContentEncryptionRequirementDecision>> {
    if (!this.allow) {
      return Object.freeze({
        ok: false,
        error: Object.freeze({
          code: EncryptionPolicyEvaluationErrorCodes.policyViolation,
          message: "Content encryption policy violated.",
        }),
      });
    }
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        dataClass: request.dataClass,
        required: true,
        resolvedFrom: "workspace",
      }),
    });
  }

  public async evaluatePreviewDecryptionAllowance(
    request: PreviewDecryptionAllowanceRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<PreviewDecryptionAllowanceDecision>> {
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        dataClass: request.dataClass,
        allowed: true,
        resolvedFrom: "workspace",
      }),
    });
  }

  public async evaluateWorkerDecryptionAllowance(
    request: WorkerDecryptionAllowanceRequest,
  ): Promise<EncryptionPolicyEvaluationServiceResult<WorkerDecryptionAllowanceDecision>> {
    return Object.freeze({
      ok: true,
      value: Object.freeze({
        dataClass: request.dataClass,
        allowed: true,
        resolvedFrom: "workspace",
      }),
    });
  }
}

function createWorkspaceRecord(workspaceId: string, status = WorkspaceStatuses.active): Workspace {
  return createWorkspace({
    id: workspaceId,
    slug: workspaceId.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase(),
    displayName: workspaceId,
    ownerUserId: "user:owner",
    createdBy: "user:owner",
    status,
    visibility: WorkspaceVisibilities.team,
    now: new Date("2026-04-07T14:00:00.000Z"),
  });
}

function createStorageRecord(storageInstanceId: string, workspaceId: string): StorageInstance {
  return Object.freeze({
    id: storageInstanceId,
    lifecycleState: "active",
    ownership: Object.freeze({
      workspaceId,
      ownerUserIdentityId: "user:owner",
    }),
    access: Object.freeze({
      mode: "managed",
      scope: "workspace",
      allowCrossWorkspaceReads: false,
      immutableWrites: false,
    }),
  }) as unknown as StorageInstance;
}

function createBaseRequest() {
  return Object.freeze({
    actor: Object.freeze({
      actorUserIdentityId: "user:owner",
      activeWorkspaceId: "workspace-alpha",
    }),
    submission: Object.freeze({
      workspaceId: "workspace-alpha",
      workflowId: "workflow-alpha",
      templateId: "template-alpha",
      source: "api" as const,
      runtimeTarget: Object.freeze({
        systemId: "system-alpha",
        versionId: "system-alpha:v1",
        async: true,
      }),
      parameters: Object.freeze({
        seed: 42,
      }),
      storageReferences: Object.freeze([
        Object.freeze({ storageInstanceId: "storage-alpha" }),
      ]),
      resourceReferences: Object.freeze([
        Object.freeze({
          resourceFamily: AuthorizationResourceFamilies.asset as AuthorizationResourceFamily,
          resourceType: "asset-record",
          resourceId: "asset-alpha",
          requiredPermissionKey: "asset.read",
        }),
      ]),
      policyPrerequisites: Object.freeze([
        Object.freeze({
          id: "enc-required",
          kind: RunSubmissionSecurityPrerequisiteKinds.contentEncryptionRequired,
          dataClass: ProtectedDataClasses.assetContent,
          expected: true,
          storageInstanceId: "storage-alpha",
        }),
      ]),
      metadata: Object.freeze({ requestScope: "integration" }),
      tags: Object.freeze(["queue:default"]),
    }),
    occurredAt: "2026-04-07T15:00:00.000Z",
  });
}

describe("ValidateRunSubmissionUseCase", () => {
  it("rejects structurally invalid submissions", async () => {
    const workspaceRepository = new InMemoryWorkspaceRepository();
    const useCase = new ValidateRunSubmissionUseCase({
      workspaceRepository,
      authorizationDecisionEvaluator: new StubAuthorizationDecisionEvaluator(),
      targetResolver: new StubTargetResolver(),
    });

    const result = await useCase.execute({
      actor: Object.freeze({}),
      submission: Object.freeze({
        runtimeTarget: Object.freeze({
          systemId: "",
          versionId: "",
        }),
      }),
    });

    expect(result.ok).toBeFalse();
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe(RunSubmissionValidationErrorCodes.invalidRequest);
    expect(result.error.validationIssues.length).toBeGreaterThan(0);
  });

  it("rejects unauthorized submissions", async () => {
    const workspaceRepository = new InMemoryWorkspaceRepository();
    await workspaceRepository.saveWorkspace(createWorkspaceRecord("workspace-alpha"));

    const authorization = new StubAuthorizationDecisionEvaluator();
    authorization.deniedPermissions.add("system.execute");

    const storageRepository = new InMemoryStorageInstanceRepository();
    await storageRepository.createStorageInstance(createStorageRecord("storage-alpha", "workspace-alpha"), {
      operationKey: "seed",
      actorUserIdentityId: "user:owner",
    });

    const useCase = new ValidateRunSubmissionUseCase({
      workspaceRepository,
      authorizationDecisionEvaluator: authorization,
      targetResolver: new StubTargetResolver(),
      storageInstanceRepository: storageRepository,
      storagePolicyEvaluationPort: new StubStoragePolicyPort(),
      encryptionPolicyEvaluationService: new StubEncryptionPolicyEvaluationService(),
    });

    const result = await useCase.execute(createBaseRequest());

    expect(result.ok).toBeFalse();
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe(RunSubmissionValidationErrorCodes.forbidden);
    expect(result.error.validationIssues.some((issue) => issue.code === "system-execute-not-authorized")).toBeTrue();
  });

  it("rejects policy-ineligible submissions", async () => {
    const workspaceRepository = new InMemoryWorkspaceRepository();
    await workspaceRepository.saveWorkspace(createWorkspaceRecord("workspace-alpha"));

    const targetResolver = new StubTargetResolver();
    targetResolver.response = Object.freeze({
      systemExists: true,
      versionExists: true,
      workflowExists: true,
      templateExists: true,
      allowedParameterKeys: Object.freeze(["steps"]),
      requiredPolicyPrerequisiteIds: Object.freeze(["enc-required"]),
    });

    const storageRepository = new InMemoryStorageInstanceRepository();
    await storageRepository.createStorageInstance(createStorageRecord("storage-alpha", "workspace-alpha"), {
      operationKey: "seed",
      actorUserIdentityId: "user:owner",
    });

    const encryption = new StubEncryptionPolicyEvaluationService();
    encryption.allow = false;

    const useCase = new ValidateRunSubmissionUseCase({
      workspaceRepository,
      authorizationDecisionEvaluator: new StubAuthorizationDecisionEvaluator(),
      targetResolver,
      storageInstanceRepository: storageRepository,
      storagePolicyEvaluationPort: new StubStoragePolicyPort(),
      encryptionPolicyEvaluationService: encryption,
    });

    const result = await useCase.execute(createBaseRequest());

    expect(result.ok).toBeFalse();
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe(RunSubmissionValidationErrorCodes.policyIneligible);
    expect(result.error.validationIssues.some((issue) => issue.code === "parameter-not-allowed")).toBeTrue();
  });

  it("returns not-found when referenced targets are unavailable", async () => {
    const workspaceRepository = new InMemoryWorkspaceRepository();
    await workspaceRepository.saveWorkspace(createWorkspaceRecord("workspace-alpha"));

    const targetResolver = new StubTargetResolver();
    targetResolver.response = Object.freeze({
      systemExists: false,
      versionExists: false,
      workflowExists: false,
      templateExists: false,
      allowedParameterKeys: Object.freeze(["seed"]),
      requiredPolicyPrerequisiteIds: Object.freeze([]),
    });

    const useCase = new ValidateRunSubmissionUseCase({
      workspaceRepository,
      authorizationDecisionEvaluator: new StubAuthorizationDecisionEvaluator(),
      targetResolver,
    });

    const result = await useCase.execute(createBaseRequest());

    expect(result.ok).toBeFalse();
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe(RunSubmissionValidationErrorCodes.notFound);
    expect(result.error.validationIssues.some((issue) => issue.code === "target-system-not-found")).toBeTrue();
  });

  it("accepts eligible submissions and returns a canonical command", async () => {
    const workspaceRepository = new InMemoryWorkspaceRepository();
    await workspaceRepository.saveWorkspace(createWorkspaceRecord("workspace-alpha"));

    const storageRepository = new InMemoryStorageInstanceRepository();
    await storageRepository.createStorageInstance(createStorageRecord("storage-alpha", "workspace-alpha"), {
      operationKey: "seed",
      actorUserIdentityId: "user:owner",
    });

    const useCase = new ValidateRunSubmissionUseCase({
      workspaceRepository,
      authorizationDecisionEvaluator: new StubAuthorizationDecisionEvaluator(),
      targetResolver: new StubTargetResolver(),
      storageInstanceRepository: storageRepository,
      storagePolicyEvaluationPort: new StubStoragePolicyPort(),
      encryptionPolicyEvaluationService: new StubEncryptionPolicyEvaluationService(),
    });

    const result = await useCase.execute(createBaseRequest());

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.command.workspaceId).toBe("workspace-alpha");
    expect(result.command.runtimeTarget.systemId).toBe("system-alpha");
    expect(result.command.runtimeTarget.versionId).toBe("system-alpha:v1");
    expect(result.command.parameters.seed).toBe(42);
    expect(result.command.storageReferences[0]?.storageInstanceId).toBe("storage-alpha");
  });
});
