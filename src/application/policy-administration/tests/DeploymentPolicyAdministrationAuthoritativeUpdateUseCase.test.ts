
import { describe, expect, it } from "bun:test";
import type {
  DeploymentPolicyActiveProfileSelectionRecord,
  DeploymentPolicyEffectiveMetadataRecord,
  DeploymentPolicyOverrideHistoryRecord,
  DeploymentPolicyOverridePersistenceRecord,
  DeploymentPolicyPersistenceMutationEnvelope,
  DeploymentPolicyPersistenceMutationResult,
  DeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import {
  DeploymentPolicyPersistenceScopeKinds,
  createDeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import type {
  DeploymentPolicyOverrideHistoryQuery,
  DeploymentPolicyOverrideLookupQuery,
  IDeploymentPolicyPersistenceRepository,
  RemoveDeploymentPolicyOverridePersistenceRecordInput,
  SaveDeploymentPolicyEffectiveMetadataInput,
  UpsertDeploymentPolicyOverridePersistenceRecordInput,
} from "@application/deployment/ports/IDeploymentPolicyPersistenceRepository";
import {
  DeploymentPolicyUpdateOperationKinds,
  DeploymentPolicyValueKinds,
  type DeploymentPolicyAdminUpdateCommand,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import {
  DeploymentPolicyAdministrationAuthoritativeUpdateUseCase,
  DeploymentPolicyAdministrationPermissionKeys,
  DeploymentPolicyAdministrationUpdateErrorCodes,
  type IDeploymentPolicyAdministrationPermissionService,
  type DeploymentPolicyAdministrationPermissionKey,
} from "../use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase";
import { DeploymentProfileIds } from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import type {
  DeploymentPolicyGovernanceEvent,
  IDeploymentPolicyGovernanceEventSink,
} from "@application/policy-administration/ports/DeploymentPolicyGovernanceEventPorts";
import type {
  DeploymentPolicyAdministrationObservabilityEvent,
  IDeploymentPolicyAdministrationObservabilityPort,
} from "@application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts";

class InMemoryDeploymentPolicyRepository implements IDeploymentPolicyPersistenceRepository {
  public activeByScope = new Map<string, DeploymentPolicyActiveProfileSelectionRecord>();
  public overridesByKey = new Map<string, DeploymentPolicyOverridePersistenceRecord>();
  public history: DeploymentPolicyOverrideHistoryRecord[] = [];
  public effectiveByScope = new Map<string, DeploymentPolicyEffectiveMetadataRecord>();

  public setActiveProfileCalls = 0;
  public upsertOverrideCalls = 0;
  public removeOverrideCalls = 0;
  public saveMetadataCalls = 0;

  public async getActiveProfileSelection(
    scope: DeploymentPolicyPersistenceScope,
  ): Promise<DeploymentPolicyActiveProfileSelectionRecord | undefined> {
    return this.activeByScope.get(scope.scopeId);
  }

  public async setActiveProfileSelection(input: {
    readonly record: DeploymentPolicyActiveProfileSelectionRecord;
    readonly mutation: DeploymentPolicyPersistenceMutationEnvelope;
  }): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyActiveProfileSelectionRecord>> {
    this.setActiveProfileCalls += 1;
    const existing = this.activeByScope.get(input.record.scope.scopeId);
    const next = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
    });
    this.activeByScope.set(input.record.scope.scopeId, next);
    return Object.freeze({ record: next, changed: true, wasReplay: false });
  }

  public async listOverrideRecords(
    query: DeploymentPolicyOverrideLookupQuery,
  ): Promise<ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>> {
    return [...this.overridesByKey.values()].filter((record) => {
      if (record.scope.scopeId !== query.scope.scopeId || record.scope.kind !== query.scope.kind) {
        return false;
      }
      if (query.profileId && record.profileId !== query.profileId) {
        return false;
      }
      if (query.familyId && record.familyId !== query.familyId) {
        return false;
      }
      if (query.settingKey && record.settingKey !== query.settingKey) {
        return false;
      }
      return true;
    });
  }

  public async upsertOverrideRecord(
    input: UpsertDeploymentPolicyOverridePersistenceRecordInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverridePersistenceRecord>> {
    this.upsertOverrideCalls += 1;
    const key = this.toKey(input.record.scope, input.record.profileId, input.record.familyId, input.record.settingKey);
    const existing = this.overridesByKey.get(key);
    const next = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
    });
    this.overridesByKey.set(key, next);
    return Object.freeze({ record: next, changed: true, wasReplay: false });
  }

  public async removeOverrideRecord(
    input: RemoveDeploymentPolicyOverridePersistenceRecordInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverrideHistoryRecord>> {
    this.removeOverrideCalls += 1;
    const key = this.toKey(input.scope, input.profileId, input.familyId, input.settingKey);
    const existing = this.overridesByKey.get(key);
    if (!existing) {
      throw new Error("Override record not found.");
    }

    this.overridesByKey.delete(key);
    const history = Object.freeze({
      changeId: `${key}:remove`,
      scope: input.scope,
      profileId: input.profileId,
      familyId: input.familyId,
      settingKey: input.settingKey,
      operation: "remove" as const,
      operationKey: input.mutation.operationKey,
      changedAt: input.mutation.context.occurredAt ?? "2026-04-08T12:00:00.000Z",
      changedByUserIdentityId: input.mutation.context.actorUserIdentityId,
      revision: existing.revision + 1,
      value: existing.value,
      valueType: existing.valueType,
      provenance: existing.provenance,
      reason: input.mutation.context.reason,
      ticketReference: input.mutation.context.ticketReference,
      correlationId: input.mutation.context.correlationId,
    });
    this.history.push(history);
    return Object.freeze({ record: history, changed: true, wasReplay: false });
  }

  public async listOverrideHistory(
    _query: DeploymentPolicyOverrideHistoryQuery,
  ): Promise<ReadonlyArray<DeploymentPolicyOverrideHistoryRecord>> {
    return this.history;
  }

  public async getEffectivePolicyMetadata(
    scope: DeploymentPolicyPersistenceScope,
  ): Promise<DeploymentPolicyEffectiveMetadataRecord | undefined> {
    return this.effectiveByScope.get(scope.scopeId);
  }

  public async saveEffectivePolicyMetadata(
    input: SaveDeploymentPolicyEffectiveMetadataInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyEffectiveMetadataRecord>> {
    this.saveMetadataCalls += 1;
    const existing = this.effectiveByScope.get(input.record.scope.scopeId);
    const next = Object.freeze({
      ...input.record,
      revision: existing ? existing.revision + 1 : 1,
    });
    this.effectiveByScope.set(input.record.scope.scopeId, next);
    return Object.freeze({ record: next, changed: true, wasReplay: false });
  }

  private toKey(
    scope: DeploymentPolicyPersistenceScope,
    profileId: string,
    familyId: string,
    settingKey: string,
  ): string {
    return `${scope.kind}:${scope.scopeId}:${profileId}:${familyId}:${settingKey}`;
  }
}

class StubPermissionService implements IDeploymentPolicyAdministrationPermissionService {
  public denied = new Set<DeploymentPolicyAdministrationPermissionKey>();

  public async evaluatePermission(input: {
    readonly actorUserIdentityId: string;
    readonly requiredPermission: DeploymentPolicyAdministrationPermissionKey;
    readonly scope: DeploymentPolicyPersistenceScope;
    readonly asOf?: string;
  }): Promise<{ readonly allowed: boolean; readonly reasonCode?: string; readonly reason?: string }> {
    if (this.denied.has(input.requiredPermission)) {
      return Object.freeze({
        allowed: false,
        reasonCode: "insufficient-permissions",
        reason: `Missing permission ${input.requiredPermission}`,
      });
    }

    return Object.freeze({
      allowed: true,
    });
  }
}

class CapturingDeploymentPolicyGovernanceEventSink implements IDeploymentPolicyGovernanceEventSink {
  public readonly events: DeploymentPolicyGovernanceEvent[] = [];

  public async recordDeploymentPolicyGovernanceEvent(event: DeploymentPolicyGovernanceEvent): Promise<void> {
    this.events.push(event);
  }
}

class CapturingDeploymentPolicyAdministrationObservabilityPort
  implements IDeploymentPolicyAdministrationObservabilityPort {
  public readonly events: DeploymentPolicyAdministrationObservabilityEvent[] = [];

  public async recordDeploymentPolicyAdministrationEvent(
    event: DeploymentPolicyAdministrationObservabilityEvent,
  ): Promise<void> {
    this.events.push(event);
  }
}

function createScope(scopeId: string): DeploymentPolicyPersistenceScope {
  return createDeploymentPolicyPersistenceScope({
    kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
    scopeId,
  });
}

function createCommand(input: {
  readonly profileId?: DeploymentPolicyAdminUpdateCommand["profileId"];
  readonly operations: DeploymentPolicyAdminUpdateCommand["operations"];
  readonly expectedRevision?: number;
}): DeploymentPolicyAdminUpdateCommand {
  return Object.freeze({
    profileId: input.profileId ?? DeploymentProfileIds.classroom,
    actorUserIdentityId: "user-admin",
    submittedAt: "2026-04-08T12:00:00.000Z",
    expectedRevision: input.expectedRevision,
    operations: input.operations,
  });
}

describe("DeploymentPolicyAdministrationAuthoritativeUpdateUseCase", () => {
  it("rejects unsupported scope kinds with structured validation semantics", async () => {
    const repository = new InMemoryDeploymentPolicyRepository();
    const permissionService = new StubPermissionService();

    const useCase = new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
    });

    const result = await useCase.execute({
      scope: Object.freeze({
        kind: "unsupported-scope" as DeploymentPolicyPersistenceScope["kind"],
        scopeId: "root",
      }),
      actorUserIdentityId: "user-admin",
      operations: [
        {
          kind: "set-active-profile",
          profileId: DeploymentProfileIds.home,
        },
      ],
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(DeploymentPolicyAdministrationUpdateErrorCodes.invalidRequest);
      expect(result.error.validation?.issues[0]?.code).toBe("invalid-update-operation");
    }
  });

  it("rejects unauthorized active-profile updates with structured permission semantics", async () => {
    const repository = new InMemoryDeploymentPolicyRepository();
    const permissionService = new StubPermissionService();
    permissionService.denied.add(DeploymentPolicyAdministrationPermissionKeys.selectActiveProfile);

    const useCase = new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
    });

    const result = await useCase.execute({
      scope: createScope("workspace-a"),
      actorUserIdentityId: "user-admin",
      operations: [{
        kind: "set-active-profile",
        profileId: DeploymentProfileIds.organization,
      }],
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(DeploymentPolicyAdministrationUpdateErrorCodes.forbidden);
      expect(result.error.permission?.required).toBe(DeploymentPolicyAdministrationPermissionKeys.selectActiveProfile);
      expect(result.error.permission?.reasonCode).toBe("insufficient-permissions");
    }
    expect(repository.setActiveProfileCalls).toBe(0);
  });

  it("rejects invalid override values and does not persist changes", async () => {
    const repository = new InMemoryDeploymentPolicyRepository();
    const permissionService = new StubPermissionService();
    const observabilityPort = new CapturingDeploymentPolicyAdministrationObservabilityPort();

    const useCase = new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
      observabilityPort,
    });

    const result = await useCase.execute({
      scope: createScope("workspace-b"),
      actorUserIdentityId: "user-admin",
      operations: [{
        kind: "apply-override-operations",
        command: createCommand({
          operations: [{
            operation: DeploymentPolicyUpdateOperationKinds.upsert,
            familyId: "storage-governance",
            settingKey: "retentionDaysDefault",
            value: 2,
            valueType: DeploymentPolicyValueKinds.number,
          }],
        }),
      }],
      ticketReference: "CHG-1234",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(DeploymentPolicyAdministrationUpdateErrorCodes.validationFailed);
      expect(result.error.validation?.issues.map((issue) => issue.code)).toContain("invalid-value-kind");
    }
    expect(repository.upsertOverrideCalls).toBe(0);
    expect(repository.saveMetadataCalls).toBe(0);
    expect(observabilityPort.events.some((event) => (
      event.event === "deployment-policy-admin.write.validation-failed"
      && event.operation === "write"
      && event.outcome === "failure"
    ))).toBeTrue();
  });

  it("rejects remove operations when override is missing", async () => {
    const repository = new InMemoryDeploymentPolicyRepository();
    const permissionService = new StubPermissionService();

    const useCase = new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
    });

    const result = await useCase.execute({
      scope: createScope("workspace-c"),
      actorUserIdentityId: "user-admin",
      operations: [{
        kind: "apply-override-operations",
        command: createCommand({
          operations: [{
            operation: DeploymentPolicyUpdateOperationKinds.remove,
            familyId: "sharing-posture",
            settingKey: "defaultWorkspaceVisibility",
          }],
        }),
      }],
      ticketReference: "CHG-2222",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(DeploymentPolicyAdministrationUpdateErrorCodes.validationFailed);
      expect(result.error.validation?.issues[0]?.code).toBe("invalid-update-operation");
    }
    expect(repository.removeOverrideCalls).toBe(0);
  });

  it("persists valid active profile selection and safe override updates", async () => {
    const repository = new InMemoryDeploymentPolicyRepository();
    const permissionService = new StubPermissionService();
    const governanceEventSink = new CapturingDeploymentPolicyGovernanceEventSink();
    const observabilityPort = new CapturingDeploymentPolicyAdministrationObservabilityPort();

    const useCase = new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
      governanceEventSink,
      observabilityPort,
    });

    const result = await useCase.execute({
      scope: createScope("workspace-d"),
      actorUserIdentityId: "user-admin",
      ticketReference: "CHG-3000",
      operations: [
        {
          kind: "set-active-profile",
          profileId: DeploymentProfileIds.classroom,
        },
        {
          kind: "apply-override-operations",
          command: createCommand({
            profileId: DeploymentProfileIds.classroom,
            operations: [{
              operation: DeploymentPolicyUpdateOperationKinds.upsert,
              familyId: "sharing-posture",
              settingKey: "defaultWorkspaceVisibility",
              value: "private",
              valueType: DeploymentPolicyValueKinds.string,
            }],
          }),
        },
      ],
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.validation.valid).toBeTrue();
    expect(result.value.activeProfileSelection?.record.profileId).toBe(DeploymentProfileIds.classroom);
    expect(result.value.overrideMutations).toHaveLength(1);
    expect(result.value.overrideMutations[0]?.operation.familyId).toBe("sharing-posture");
    expect(result.value.snapshot.families["sharing-posture"]?.settings.defaultWorkspaceVisibility?.value).toBe("private");
    expect(result.value.snapshot.families["sharing-posture"]?.settings.defaultWorkspaceVisibility?.source).toBe("admin-state");

    expect(repository.setActiveProfileCalls).toBe(1);
    expect(repository.upsertOverrideCalls).toBe(1);
    expect(repository.saveMetadataCalls).toBe(1);
    expect(governanceEventSink.events).toHaveLength(4);
    expect(governanceEventSink.events.map((event) => event.type)).toEqual([
      "deployment-policy-active-profile-changed",
      "deployment-policy-active-profile-changed",
      "deployment-policy-overrides-mutated",
      "deployment-policy-overrides-mutated",
    ]);
    expect(governanceEventSink.events.map((event) => event.channel)).toEqual([
      "audit",
      "operational",
      "audit",
      "operational",
    ]);
    const overrideEvent = governanceEventSink.events.find((event) => (
      event.type === "deployment-policy-overrides-mutated" && event.channel === "audit"
    ));
    const mutationDetails = (overrideEvent?.details as { mutations?: ReadonlyArray<Record<string, unknown>> } | undefined)?.mutations;
    expect(overrideEvent?.policyFamilyIds).toEqual(["sharing-posture"]);
    expect(mutationDetails?.[0]?.before).toEqual({ existed: false });
    expect(mutationDetails?.[0]?.after).toEqual({ existed: true, valueType: "string", revision: 1 });
    expect(JSON.stringify(overrideEvent?.details)).not.toContain("\"private\"");
    expect(observabilityPort.events.some((event) => (
      event.event === "deployment-policy-admin.write.attempted"
      && event.outcome === "success"
    ))).toBeTrue();
    expect(observabilityPort.events.some((event) => (
      event.event === "deployment-policy-admin.write.completed"
      && event.outcome === "success"
    ))).toBeTrue();
  });

  it("supports dry-run validation without mutating persistence", async () => {
    const repository = new InMemoryDeploymentPolicyRepository();
    const permissionService = new StubPermissionService();
    const governanceEventSink = new CapturingDeploymentPolicyGovernanceEventSink();

    const useCase = new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
      governanceEventSink,
    });

    const result = await useCase.execute({
      scope: createScope("workspace-e"),
      actorUserIdentityId: "user-admin",
      dryRun: true,
      ticketReference: "CHG-4000",
      operations: [{
        kind: "apply-override-operations",
        command: createCommand({
          operations: [{
            operation: DeploymentPolicyUpdateOperationKinds.upsert,
            familyId: "security-governance",
            settingKey: "localCredentialRotationDays",
            value: 120,
            valueType: DeploymentPolicyValueKinds.number,
          }],
        }),
      }],
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.dryRun).toBeTrue();
    expect(result.value.snapshot.families["security-governance"]?.settings.localCredentialRotationDays?.value).toBe(120);
    expect(repository.upsertOverrideCalls).toBe(0);
    expect(repository.saveMetadataCalls).toBe(0);
    expect(governanceEventSink.events).toHaveLength(0);
  });

  it("uses set-active-profile operation for dry-run snapshot profile resolution", async () => {
    const repository = new InMemoryDeploymentPolicyRepository();
    const permissionService = new StubPermissionService();

    const useCase = new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
      defaultProfileId: DeploymentProfileIds.classroom,
    });

    const result = await useCase.execute({
      scope: createScope("workspace-g"),
      actorUserIdentityId: "user-admin",
      dryRun: true,
      operations: [Object.freeze({
        kind: "set-active-profile" as const,
        profileId: DeploymentProfileIds.organization,
      })],
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }

    expect(result.value.snapshot.profileId).toBe(DeploymentProfileIds.organization);
    expect(result.value.activeProfileSelection).toBeUndefined();
    expect(repository.setActiveProfileCalls).toBe(0);
    expect(repository.saveMetadataCalls).toBe(0);
  });

  it("enforces runtime-admin permission for runtime-admin setting mutations", async () => {
    const repository = new InMemoryDeploymentPolicyRepository();
    const permissionService = new StubPermissionService();
    const observabilityPort = new CapturingDeploymentPolicyAdministrationObservabilityPort();
    permissionService.denied.add(DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides);

    const useCase = new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
      observabilityPort,
    });

    const result = await useCase.execute({
      scope: createScope("workspace-f"),
      actorUserIdentityId: "user-admin",
      ticketReference: "CHG-5000",
      operations: [{
        kind: "apply-override-operations",
        command: createCommand({
          operations: [{
            operation: DeploymentPolicyUpdateOperationKinds.upsert,
            familyId: "storage-governance",
            settingKey: "retentionDaysDefault",
            value: 120,
            valueType: DeploymentPolicyValueKinds.number,
          }],
        }),
      }],
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.error.code).toBe(DeploymentPolicyAdministrationUpdateErrorCodes.forbidden);
      expect(result.error.permission?.required).toBe(DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides);
    }
    expect(repository.upsertOverrideCalls).toBe(0);
    expect(observabilityPort.events.some((event) => (
      event.event === "deployment-policy-admin.write.failed"
      && event.outcome === "rejected"
    ))).toBeTrue();
  });
});
