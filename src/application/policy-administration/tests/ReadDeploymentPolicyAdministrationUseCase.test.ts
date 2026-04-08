import { describe, expect, it } from "bun:test";
import type { IDeploymentPolicyPersistenceRepository } from "@application/deployment/ports/IDeploymentPolicyPersistenceRepository";
import {
  DeploymentPolicyPersistenceScopeKinds,
  type DeploymentPolicyActiveProfileSelectionRecord,
  type DeploymentPolicyEffectiveMetadataRecord,
  type DeploymentPolicyOverrideHistoryRecord,
  type DeploymentPolicyOverridePersistenceRecord,
  type DeploymentPolicyPersistenceMutationResult,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import { DeploymentPolicyResolutionSources } from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import { ReadDeploymentPolicyAdministrationUseCase } from "../use-cases/ReadDeploymentPolicyAdministrationUseCase";
import { DeploymentPolicyAdministrationPermissionKeys } from "../use-cases/DeploymentPolicyAdministrationAuthoritativeUpdateUseCase";
import type {
  DeploymentPolicyAdministrationObservabilityEvent,
  IDeploymentPolicyAdministrationObservabilityPort,
} from "@application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts";

class InMemoryDeploymentPolicyPersistenceRepository implements IDeploymentPolicyPersistenceRepository {
  public activeProfileSelection: DeploymentPolicyActiveProfileSelectionRecord | undefined;
  public overrideRecords: ReadonlyArray<DeploymentPolicyOverridePersistenceRecord> = Object.freeze([]);
  public effectiveMetadata: DeploymentPolicyEffectiveMetadataRecord | undefined;

  public async getActiveProfileSelection() {
    return this.activeProfileSelection;
  }

  public async setActiveProfileSelection(): Promise<
    DeploymentPolicyPersistenceMutationResult<DeploymentPolicyActiveProfileSelectionRecord>
  > {
    throw new Error("Not implemented.");
  }

  public async listOverrideRecords() {
    return this.overrideRecords;
  }

  public async upsertOverrideRecord(): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverridePersistenceRecord>> {
    throw new Error("Not implemented.");
  }

  public async removeOverrideRecord(): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverrideHistoryRecord>> {
    throw new Error("Not implemented.");
  }

  public async listOverrideHistory(): Promise<ReadonlyArray<DeploymentPolicyOverrideHistoryRecord>> {
    return Object.freeze([]);
  }

  public async getEffectivePolicyMetadata() {
    return this.effectiveMetadata;
  }

  public async saveEffectivePolicyMetadata(): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyEffectiveMetadataRecord>> {
    throw new Error("Not implemented.");
  }
}

class StubPermissionService {
  public denied = new Set<string>();

  public async evaluatePermission(input: {
    readonly actorUserIdentityId: string;
    readonly requiredPermission: string;
    readonly scope: { readonly kind: string; readonly scopeId: string };
    readonly asOf?: string;
  }) {
    void input.actorUserIdentityId;
    void input.scope;
    void input.asOf;
    return Object.freeze({
      allowed: !this.denied.has(input.requiredPermission),
      reasonCode: this.denied.has(input.requiredPermission) ? "forbidden" : undefined,
      reason: this.denied.has(input.requiredPermission) ? "Denied by test policy." : undefined,
    });
  }
}

class RecordingDeploymentPolicyAdministrationObservabilityPort implements IDeploymentPolicyAdministrationObservabilityPort {
  public readonly events: DeploymentPolicyAdministrationObservabilityEvent[] = [];

  public async recordDeploymentPolicyAdministrationEvent(
    event: DeploymentPolicyAdministrationObservabilityEvent,
  ): Promise<void> {
    this.events.push(event);
  }
}

describe("ReadDeploymentPolicyAdministrationUseCase", () => {
  it("returns active profile, effective snapshot, override provenance, and catalog metadata", async () => {
    const repository = new InMemoryDeploymentPolicyPersistenceRepository();
    const permissionService = new StubPermissionService();
    const observabilityPort = new RecordingDeploymentPolicyAdministrationObservabilityPort();
    repository.activeProfileSelection = Object.freeze({
      scope: Object.freeze({
        kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
        scopeId: "workspace-alpha",
      }),
      profileId: "organization",
      changedAt: "2026-04-07T18:00:00.000Z",
      changedByUserIdentityId: "user:admin",
      createdAt: "2026-04-07T18:00:00.000Z",
      createdBy: "user:admin",
      lastModifiedAt: "2026-04-07T18:00:00.000Z",
      lastModifiedBy: "user:admin",
      revision: 1,
    });
    repository.overrideRecords = Object.freeze([Object.freeze({
      scope: Object.freeze({
        kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
        scopeId: "workspace-alpha",
      }),
      profileId: "organization",
      familyId: "approval-governance",
      settingKey: "approvalEscalationTimeoutMinutes",
      value: 45,
      valueType: "number",
      provenance: Object.freeze({
        actorUserIdentityId: "user:policy-admin",
        ticketReference: "CHG-2201",
        updatedAt: "2026-04-07T18:02:00.000Z",
      }),
      createdAt: "2026-04-07T18:02:00.000Z",
      createdBy: "user:policy-admin",
      lastModifiedAt: "2026-04-07T18:02:00.000Z",
      lastModifiedBy: "user:policy-admin",
      revision: 2,
    })]);
    repository.effectiveMetadata = Object.freeze({
      scope: Object.freeze({
        kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
        scopeId: "workspace-alpha",
      }),
      profileId: "organization",
      evaluatedAt: "2026-04-07T18:03:00.000Z",
      evaluationLayer: "application",
      contractVersion: "deployment-policy-administration/v1",
      familyCount: 6,
      settingCount: 18,
      sourceCounts: Object.freeze({
        [DeploymentPolicyResolutionSources.profilePreset]: 12,
        [DeploymentPolicyResolutionSources.policyDefault]: 2,
        [DeploymentPolicyResolutionSources.adminState]: 4,
      }),
      validation: Object.freeze({
        valid: true,
        issues: Object.freeze([]),
        evaluatedAt: "2026-04-07T18:03:00.000Z",
      }),
      recordedAt: "2026-04-07T18:03:00.000Z",
      recordedByUserIdentityId: "user:policy-admin",
      revision: 1,
    });

    const useCase = new ReadDeploymentPolicyAdministrationUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
      observabilityPort,
    });

    const response = await useCase.execute({
      scope: Object.freeze({
        kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
        scopeId: "workspace-alpha",
      }),
      actorUserIdentityId: "user:admin",
    });

    expect(response.authorization.canReadState).toBeTrue();
    expect(response.authorization.canSelectActiveProfile).toBeTrue();
    expect(response.authorization.canManageOverrides).toBeTrue();
    expect(response.authorization.canManageRuntimeAdminOverrides).toBeTrue();
    expect(response.activeProfile.profileId).toBe("organization");
    expect(response.snapshot.profileId).toBe("organization");
    expect(response.overrideRecords?.[0]?.provenance?.ticketReference).toBe("CHG-2201");
    expect(response.catalog?.presets.organization?.lineage).toEqual(["home", "classroom", "organization"]);
    expect(response.catalog?.families["approval-governance"]?.settings.approvalEscalationTimeoutMinutes?.valueKind).toBe("number");
    expect(response.effectiveMetadata?.profileId).toBe("organization");
    expect(observabilityPort.events.some((event) => (
      event.event === "deployment-policy-admin.read.completed"
      && event.operation === "read"
      && event.outcome === "success"
    ))).toBeTrue();
  });

  it("falls back to home profile when no persisted active profile exists", async () => {
    const repository = new InMemoryDeploymentPolicyPersistenceRepository();
    const permissionService = new StubPermissionService();
    const useCase = new ReadDeploymentPolicyAdministrationUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
    });

    const response = await useCase.execute({
      scope: Object.freeze({
        kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
        scopeId: "workspace-beta",
      }),
      actorUserIdentityId: "user:viewer",
      includeCatalog: false,
      includeOverrideRecords: false,
      includeEffectiveMetadata: false,
    });

    expect(response.activeProfile.profileId).toBe("home");
    expect(response.activeProfile.source).toBe("default-fallback");
    expect(response.snapshot.profileId).toBe("home");
    expect(response.catalog).toBeUndefined();
    expect(response.overrideRecords).toBeUndefined();
    expect(response.effectiveMetadata).toBeUndefined();
  });

  it("throws permission error when actor lacks deployment-policy read permission", async () => {
    const repository = new InMemoryDeploymentPolicyPersistenceRepository();
    const permissionService = new StubPermissionService();
    const observabilityPort = new RecordingDeploymentPolicyAdministrationObservabilityPort();
    permissionService.denied.add(DeploymentPolicyAdministrationPermissionKeys.readState);
    const useCase = new ReadDeploymentPolicyAdministrationUseCase({
      deploymentPolicyRepository: repository,
      permissionService,
      observabilityPort,
    });

    await expect(useCase.execute({
        scope: Object.freeze({
          kind: DeploymentPolicyPersistenceScopeKinds.deploymentPolicyScope,
          scopeId: "workspace-gamma",
        }),
        actorUserIdentityId: "user:member",
      })).rejects.toThrow("not authorized");
    expect(observabilityPort.events.some((event) => (
      event.event === "deployment-policy-admin.read.rejected"
      && event.outcome === "rejected"
    ))).toBeTrue();
  });
});
