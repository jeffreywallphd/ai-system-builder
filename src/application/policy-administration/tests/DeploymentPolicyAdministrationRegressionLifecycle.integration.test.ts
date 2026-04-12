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
  createDeploymentPolicyPersistenceScope,
  DeploymentPolicyPersistenceScopeKinds,
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
  DeploymentPolicyAdministrationAuthoritativeUpdateUseCase,
  DeploymentPolicyAdministrationPermissionKeys,
  type DeploymentPolicyAdministrationPermissionKey,
  type IDeploymentPolicyAdministrationPermissionService,
} from "../use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase";
import { ReadDeploymentPolicyAdministrationUseCase } from "../use-cases/ReadDeploymentPolicyAdministrationUseCase";
import { DeploymentPolicyWriteBackendApi } from "@infrastructure/api/deployment/DeploymentPolicyWriteBackendApi";
import { DeploymentPolicyReadBackendApi } from "@infrastructure/api/deployment/DeploymentPolicyReadBackendApi";
import {
  DeploymentPolicyUpdateOperationKinds,
  DeploymentPolicyValueKinds,
} from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import { DeploymentProfileIds } from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import { DeploymentPolicyBootstrapResolutionService } from "@application/configuration/DeploymentPolicyBootstrapResolutionService";
import type {
  DeploymentPolicyAdministrationObservabilityEvent,
  IDeploymentPolicyAdministrationObservabilityPort,
} from "../ports/DeploymentPolicyAdministrationObservabilityPorts";
import type {
  DeploymentPolicyGovernanceEvent,
  IDeploymentPolicyGovernanceEventSink,
} from "../ports/DeploymentPolicyGovernanceEventPorts";

class InMemoryDeploymentPolicyRepository implements IDeploymentPolicyPersistenceRepository {
  private readonly activeByScope = new Map<string, DeploymentPolicyActiveProfileSelectionRecord>();
  private readonly overridesByKey = new Map<string, DeploymentPolicyOverridePersistenceRecord>();
  private readonly historyByScope = new Map<string, DeploymentPolicyOverrideHistoryRecord[]>();
  private readonly effectiveByScope = new Map<string, DeploymentPolicyEffectiveMetadataRecord>();
  private readonly replayByScope = new Map<string, Set<string>>();

  public async getActiveProfileSelection(
    scope: DeploymentPolicyPersistenceScope,
  ): Promise<DeploymentPolicyActiveProfileSelectionRecord | undefined> {
    return this.activeByScope.get(this.scopeKey(scope));
  }

  public async setActiveProfileSelection(input: {
    readonly record: DeploymentPolicyActiveProfileSelectionRecord;
    readonly mutation: DeploymentPolicyPersistenceMutationEnvelope;
  }): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyActiveProfileSelectionRecord>> {
    const scopeKey = this.scopeKey(input.record.scope);
    if (this.isReplay(scopeKey, input.mutation.operationKey)) {
      const existing = this.activeByScope.get(scopeKey);
      return Object.freeze({
        record: existing ?? input.record,
        changed: false,
        wasReplay: true,
      });
    }
    const current = this.activeByScope.get(scopeKey);
    this.assertExpectedRevision(current?.revision, input.mutation.expectedRevision, "active profile");
    const next = Object.freeze({
      ...input.record,
      revision: (current?.revision ?? 0) + 1,
    });
    this.activeByScope.set(scopeKey, next);
    this.recordReplay(scopeKey, input.mutation.operationKey);
    return Object.freeze({
      record: next,
      changed: true,
      wasReplay: false,
    });
  }

  public async listOverrideRecords(
    query: DeploymentPolicyOverrideLookupQuery,
  ): Promise<ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>> {
    return Object.freeze(
      [...this.overridesByKey.values()].filter((record) => {
        if (this.scopeKey(record.scope) !== this.scopeKey(query.scope)) {
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
      }),
    );
  }

  public async upsertOverrideRecord(
    input: UpsertDeploymentPolicyOverridePersistenceRecordInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverridePersistenceRecord>> {
    const scopeKey = this.scopeKey(input.record.scope);
    if (this.isReplay(scopeKey, input.mutation.operationKey)) {
      const existing = this.overridesByKey.get(
        this.overrideKey(input.record.scope, input.record.profileId, input.record.familyId, input.record.settingKey),
      );
      return Object.freeze({
        record: existing ?? input.record,
        changed: false,
        wasReplay: true,
      });
    }
    const key = this.overrideKey(input.record.scope, input.record.profileId, input.record.familyId, input.record.settingKey);
    const current = this.overridesByKey.get(key);
    this.assertExpectedRevision(current?.revision, input.mutation.expectedRevision, "override");
    const next = Object.freeze({
      ...input.record,
      revision: (current?.revision ?? 0) + 1,
    });
    this.overridesByKey.set(key, next);
    this.recordHistory({
      scope: input.record.scope,
      profileId: input.record.profileId,
      familyId: input.record.familyId,
      settingKey: input.record.settingKey,
      operation: "upsert",
      revision: next.revision,
      value: next.value,
      valueType: next.valueType,
      provenance: next.provenance,
      mutation: input.mutation,
    });
    this.recordReplay(scopeKey, input.mutation.operationKey);
    return Object.freeze({
      record: next,
      changed: true,
      wasReplay: false,
    });
  }

  public async removeOverrideRecord(
    input: RemoveDeploymentPolicyOverridePersistenceRecordInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverrideHistoryRecord>> {
    const scopeKey = this.scopeKey(input.scope);
    if (this.isReplay(scopeKey, input.mutation.operationKey)) {
      const existing = this.getHistory(scopeKey)[0];
      if (!existing) {
        throw new Error("Missing replay history.");
      }
      return Object.freeze({
        record: existing,
        changed: false,
        wasReplay: true,
      });
    }
    const key = this.overrideKey(input.scope, input.profileId, input.familyId, input.settingKey);
    const current = this.overridesByKey.get(key);
    if (!current) {
      throw new Error("Override record not found.");
    }
    this.assertExpectedRevision(current.revision, input.mutation.expectedRevision, "override");
    this.overridesByKey.delete(key);
    const history = this.recordHistory({
      scope: input.scope,
      profileId: input.profileId,
      familyId: input.familyId,
      settingKey: input.settingKey,
      operation: "remove",
      revision: current.revision + 1,
      value: current.value,
      valueType: current.valueType,
      provenance: current.provenance,
      mutation: input.mutation,
    });
    this.recordReplay(scopeKey, input.mutation.operationKey);
    return Object.freeze({
      record: history,
      changed: true,
      wasReplay: false,
    });
  }

  public async listOverrideHistory(
    query: DeploymentPolicyOverrideHistoryQuery,
  ): Promise<ReadonlyArray<DeploymentPolicyOverrideHistoryRecord>> {
    return Object.freeze(this.getHistory(this.scopeKey(query.scope)).filter((record) => {
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
    }));
  }

  public async getEffectivePolicyMetadata(
    scope: DeploymentPolicyPersistenceScope,
  ): Promise<DeploymentPolicyEffectiveMetadataRecord | undefined> {
    return this.effectiveByScope.get(this.scopeKey(scope));
  }

  public async saveEffectivePolicyMetadata(
    input: SaveDeploymentPolicyEffectiveMetadataInput,
  ): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyEffectiveMetadataRecord>> {
    const scopeKey = this.scopeKey(input.record.scope);
    if (this.isReplay(scopeKey, input.mutation.operationKey)) {
      const existing = this.effectiveByScope.get(scopeKey);
      return Object.freeze({
        record: existing ?? input.record,
        changed: false,
        wasReplay: true,
      });
    }
    const current = this.effectiveByScope.get(scopeKey);
    this.assertExpectedRevision(current?.revision, input.mutation.expectedRevision, "effective metadata");
    const next = Object.freeze({
      ...input.record,
      revision: (current?.revision ?? 0) + 1,
    });
    this.effectiveByScope.set(scopeKey, next);
    this.recordReplay(scopeKey, input.mutation.operationKey);
    return Object.freeze({
      record: next,
      changed: true,
      wasReplay: false,
    });
  }

  private scopeKey(scope: DeploymentPolicyPersistenceScope): string {
    return `${scope.kind}:${scope.scopeId}`;
  }

  private overrideKey(
    scope: DeploymentPolicyPersistenceScope,
    profileId: string,
    familyId: string,
    settingKey: string,
  ): string {
    return `${this.scopeKey(scope)}:${profileId}:${familyId}:${settingKey}`;
  }

  private isReplay(scopeKey: string, operationKey: string): boolean {
    return this.replayByScope.get(scopeKey)?.has(operationKey) ?? false;
  }

  private recordReplay(scopeKey: string, operationKey: string): void {
    const existing = this.replayByScope.get(scopeKey) ?? new Set<string>();
    existing.add(operationKey);
    this.replayByScope.set(scopeKey, existing);
  }

  private assertExpectedRevision(current: number | undefined, expected: number | undefined, area: string): void {
    if (expected === undefined) {
      return;
    }
    if ((current ?? 0) !== expected) {
      throw new Error(`Expected ${area} revision '${expected}' but found '${current ?? 0}'.`);
    }
  }

  private getHistory(scopeKey: string): DeploymentPolicyOverrideHistoryRecord[] {
    const existing = this.historyByScope.get(scopeKey);
    if (existing) {
      return existing;
    }
    const created: DeploymentPolicyOverrideHistoryRecord[] = [];
    this.historyByScope.set(scopeKey, created);
    return created;
  }

  private recordHistory(input: {
    readonly scope: DeploymentPolicyPersistenceScope;
    readonly profileId: string;
    readonly familyId: string;
    readonly settingKey: string;
    readonly operation: "upsert" | "remove";
    readonly revision: number;
    readonly value: string | number | boolean;
    readonly valueType: "string" | "number" | "boolean";
    readonly provenance: DeploymentPolicyOverridePersistenceRecord["provenance"];
    readonly mutation: DeploymentPolicyPersistenceMutationEnvelope;
  }): DeploymentPolicyOverrideHistoryRecord {
    const record = Object.freeze({
      changeId: `${this.scopeKey(input.scope)}:${input.profileId}:${input.familyId}:${input.settingKey}:${input.operation}:${input.revision}`,
      scope: input.scope,
      profileId: input.profileId as DeploymentPolicyOverrideHistoryRecord["profileId"],
      familyId: input.familyId as DeploymentPolicyOverrideHistoryRecord["familyId"],
      settingKey: input.settingKey as DeploymentPolicyOverrideHistoryRecord["settingKey"],
      operation: input.operation,
      operationKey: input.mutation.operationKey,
      changedAt: input.mutation.context.occurredAt ?? "2026-04-08T01:00:00.000Z",
      changedByUserIdentityId: input.mutation.context.actorUserIdentityId,
      revision: input.revision,
      value: input.value,
      valueType: input.valueType,
      provenance: input.provenance,
      reason: input.mutation.context.reason,
      ticketReference: input.mutation.context.ticketReference,
      correlationId: input.mutation.context.correlationId,
    }) satisfies DeploymentPolicyOverrideHistoryRecord;
    const history = this.getHistory(this.scopeKey(input.scope));
    history.unshift(record);
    return record;
  }
}

class StubPermissionService implements IDeploymentPolicyAdministrationPermissionService {
  public readonly denied = new Set<DeploymentPolicyAdministrationPermissionKey>();

  public async evaluatePermission(input: {
    readonly actorUserIdentityId: string;
    readonly requiredPermission: DeploymentPolicyAdministrationPermissionKey;
    readonly scope: DeploymentPolicyPersistenceScope;
    readonly asOf?: string;
  }): Promise<{ readonly allowed: boolean; readonly reasonCode?: string; readonly reason?: string }> {
    void input.actorUserIdentityId;
    void input.scope;
    void input.asOf;
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

class CapturingGovernanceEventSink implements IDeploymentPolicyGovernanceEventSink {
  public readonly events: DeploymentPolicyGovernanceEvent[] = [];

  public async recordDeploymentPolicyGovernanceEvent(event: DeploymentPolicyGovernanceEvent): Promise<void> {
    this.events.push(event);
  }
}

class CapturingObservabilityPort implements IDeploymentPolicyAdministrationObservabilityPort {
  public readonly events: DeploymentPolicyAdministrationObservabilityEvent[] = [];

  public async recordDeploymentPolicyAdministrationEvent(
    event: DeploymentPolicyAdministrationObservabilityEvent,
  ): Promise<void> {
    this.events.push(event);
  }
}

const scope = createDeploymentPolicyPersistenceScope({
  kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
  scopeId: "workspace-regression",
});

describe("Deployment policy administration lifecycle regression hardening", () => {
  it("enforces profile/override provenance, seam-only evaluation, permission boundaries, and safe governance signals", async () => {
    const repository = new InMemoryDeploymentPolicyRepository();
    const permissionService = new StubPermissionService();
    const governanceEventSink = new CapturingGovernanceEventSink();
    const observabilityPort = new CapturingObservabilityPort();

    const writeUseCase = new DeploymentPolicyAdministrationAuthoritativeUpdateUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
      governanceEventSink,
      observabilityPort,
      defaultProfileId: DeploymentProfileIds.classroom,
    });
    const readUseCase = new ReadDeploymentPolicyAdministrationUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
      observabilityPort,
      defaultProfileId: DeploymentProfileIds.classroom,
    });
    const writeApi = new DeploymentPolicyWriteBackendApi({
      updateDeploymentPolicyStateUseCase: writeUseCase,
      observabilityPort,
    });
    const readApi = new DeploymentPolicyReadBackendApi({
      readDeploymentPolicyStateUseCase: readUseCase,
      observabilityPort,
    });

    const bootstrapBeforeWrites = await new DeploymentPolicyBootstrapResolutionService({
      deploymentPolicyRepository: repository,
      scope,
      fallbackProfileId: DeploymentProfileIds.classroom,
      observabilityPort,
      now: () => new Date("2026-04-08T01:00:00.000Z"),
    }).execute();
    expect(bootstrapBeforeWrites.activeProfile.profileId).toBe(DeploymentProfileIds.classroom);
    expect(bootstrapBeforeWrites.activeProfile.source).toBe("default-fallback");

    const setProfileResponse = await writeApi.updateActiveProfile(
      Object.freeze({
        actorUserIdentityId: "user:admin",
        workspaceId: scope.scopeId,
        correlationId: "corr-regression-1",
      }),
      Object.freeze({
        profileId: DeploymentProfileIds.organization,
        reason: "Promote organization baseline",
        ticketReference: "CHG-3001",
      }),
    );
    expect(setProfileResponse.ok).toBeTrue();

    const upsertOverrideResponse = await writeApi.applyOverrideOperations(
      Object.freeze({
        actorUserIdentityId: "user:admin",
        workspaceId: scope.scopeId,
        correlationId: "corr-regression-2",
      }),
      Object.freeze({
        profileId: DeploymentProfileIds.organization,
        reason: "Tighten workspace sharing defaults",
        ticketReference: "CHG-3002",
        operations: Object.freeze([
          Object.freeze({
            operation: DeploymentPolicyUpdateOperationKinds.upsert,
            familyId: "sharing-posture",
            settingKey: "defaultWorkspaceVisibility",
            value: "private",
            valueType: DeploymentPolicyValueKinds.string,
            expectedControlMode: "profile-default-admin-overridable",
            provenance: Object.freeze({
              actorUserIdentityId: "spoofed:actor",
              ticketReference: "CHG-3002",
              reason: "Intentional actor spoof attempt",
              updatedAt: "2026-04-08T01:01:00.000Z",
            }),
          }),
        ]),
      }),
    );
    expect(upsertOverrideResponse.ok).toBeTrue();

    const readAfterUpsert = await readApi.readPolicyState({
      actorUserIdentityId: "user:admin",
      workspaceId: scope.scopeId,
      correlationId: "corr-regression-read-1",
      includeCatalog: true,
      includeOverrideRecords: true,
      includeEffectiveMetadata: true,
    });
    expect(readAfterUpsert.ok).toBeTrue();
    if (!readAfterUpsert.ok) {
      return;
    }
    expect(readAfterUpsert.data.activeProfile.profileId).toBe(DeploymentProfileIds.organization);
    expect(readAfterUpsert.data.activeProfile.source).toBe("persisted-selection");
    expect(readAfterUpsert.data.snapshot.families["sharing-posture"]?.settings.defaultWorkspaceVisibility?.value).toBe("private");
    expect(readAfterUpsert.data.snapshot.families["sharing-posture"]?.settings.defaultWorkspaceVisibility?.source).toBe("admin-state");
    expect(readAfterUpsert.data.overrideRecords?.[0]?.provenance?.actorUserIdentityId).toBe("user:admin");
    expect(readAfterUpsert.data.catalog?.presets.organization?.lineage).toEqual(["home", "classroom", "organization"]);

    const bootstrapAfterUpsert = await new DeploymentPolicyBootstrapResolutionService({
      deploymentPolicyRepository: repository,
      scope,
      fallbackProfileId: DeploymentProfileIds.classroom,
      observabilityPort,
      now: () => new Date("2026-04-08T01:02:00.000Z"),
    }).execute();
    const evaluationContext = await bootstrapAfterUpsert.contextResolver.resolveContext({
      workspaceId: scope.scopeId,
      occurredAt: "2026-04-08T01:02:00.000Z",
    });
    const authorizationDecision = await bootstrapAfterUpsert.evaluationService.evaluateAuthorizationPolicy(evaluationContext);
    expect(authorizationDecision.defaultWorkspaceVisibility.value).toBe("private");
    expect(authorizationDecision.defaultWorkspaceVisibility.source).toBe("admin-state");

    permissionService.denied.add(DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides);
    const forbiddenRuntimeOverride = await writeApi.applyOverrideOperations(
      Object.freeze({
        actorUserIdentityId: "user:admin",
        workspaceId: scope.scopeId,
      }),
      Object.freeze({
        profileId: DeploymentProfileIds.organization,
        reason: "Attempt runtime-admin mutation without permission",
        ticketReference: "CHG-3003",
        operations: Object.freeze([
          Object.freeze({
            operation: DeploymentPolicyUpdateOperationKinds.upsert,
            familyId: "storage-governance",
            settingKey: "retentionDaysDefault",
            value: 120,
            valueType: DeploymentPolicyValueKinds.number,
          }),
        ]),
      }),
    );
    expect(forbiddenRuntimeOverride.ok).toBeFalse();
    if (!forbiddenRuntimeOverride.ok) {
      expect(forbiddenRuntimeOverride.error?.code).toBe("forbidden");
    }

    permissionService.denied.delete(DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides);
    const removeOverrideResponse = await writeApi.applyOverrideOperations(
      Object.freeze({
        actorUserIdentityId: "user:admin",
        workspaceId: scope.scopeId,
      }),
      Object.freeze({
        profileId: DeploymentProfileIds.organization,
        reason: "Return to profile preset visibility",
        ticketReference: "CHG-3004",
        operations: Object.freeze([
          Object.freeze({
            operation: DeploymentPolicyUpdateOperationKinds.remove,
            familyId: "sharing-posture",
            settingKey: "defaultWorkspaceVisibility",
          }),
        ]),
      }),
    );
    expect(removeOverrideResponse.ok).toBeTrue();

    const readAfterRemoval = await readApi.readPolicyState({
      actorUserIdentityId: "user:admin",
      workspaceId: scope.scopeId,
      includeOverrideRecords: true,
      includeCatalog: false,
      includeEffectiveMetadata: false,
    });
    expect(readAfterRemoval.ok).toBeTrue();
    if (!readAfterRemoval.ok) {
      return;
    }
    expect(readAfterRemoval.data.overrideRecords).toHaveLength(0);
    expect(readAfterRemoval.data.snapshot.families["sharing-posture"]?.settings.defaultWorkspaceVisibility?.value).toBe("workspace");
    expect(readAfterRemoval.data.snapshot.families["sharing-posture"]?.settings.defaultWorkspaceVisibility?.source).toBe("profile-preset");
    expect(readAfterRemoval.data.snapshot.families["storage-governance"]?.settings.retentionDaysDefault?.value).toBe(90);
    expect(readAfterRemoval.data.snapshot.families["storage-governance"]?.settings.retentionDaysDefault?.source).toBe("policy-default");

    expect(governanceEventSink.events.some((event) => event.type === "deployment-policy-active-profile-changed")).toBeTrue();
    expect(governanceEventSink.events.some((event) => event.type === "deployment-policy-overrides-mutated")).toBeTrue();
    expect(governanceEventSink.events.some((event) => event.channel === "audit")).toBeTrue();
    expect(governanceEventSink.events.some((event) => event.channel === "operational")).toBeTrue();
    expect(governanceEventSink.events.every((event) => !JSON.stringify(event.details ?? {}).includes("\"private\""))).toBeTrue();

    const observedEvents = observabilityPort.events.map((event) => event.event);
    expect(observedEvents).toContain("deployment-policy-admin.bootstrap.resolved");
    expect(observedEvents).toContain("deployment-policy-admin.surface.write.active-profile.completed");
    expect(observedEvents).toContain("deployment-policy-admin.surface.write.overrides.completed");
    expect(observedEvents).toContain("deployment-policy-admin.surface.write.overrides.rejected");
    expect(observedEvents).toContain("deployment-policy-admin.surface.read.completed");
  });
});
