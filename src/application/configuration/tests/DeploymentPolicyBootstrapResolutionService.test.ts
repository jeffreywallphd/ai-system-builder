import { describe, expect, it } from "bun:test";
import {
  DeploymentPolicyBootstrapActiveProfileSourceKinds,
  DeploymentPolicyBootstrapResolutionError,
  DeploymentPolicyBootstrapResolutionErrorCodes,
  DeploymentPolicyBootstrapResolutionService,
} from "../DeploymentPolicyBootstrapResolutionService";
import type { IDeploymentPolicyPersistenceRepository } from "@application/deployment/ports/IDeploymentPolicyPersistenceRepository";
import {
  DeploymentProfileIds,
  type DeploymentProfileId,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import {
  createDeploymentPolicyPersistenceScope,
  type DeploymentPolicyActiveProfileSelectionRecord,
  type DeploymentPolicyEffectiveMetadataRecord,
  type DeploymentPolicyOverrideHistoryRecord,
  type DeploymentPolicyOverridePersistenceRecord,
  type DeploymentPolicyPersistenceMutationResult,
  type DeploymentPolicyPersistenceScope,
} from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import type {
  DeploymentPolicyAdministrationObservabilityEvent,
  IDeploymentPolicyAdministrationObservabilityPort,
} from "@application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts";

class InMemoryDeploymentPolicyPersistenceRepository implements IDeploymentPolicyPersistenceRepository {
  private activeSelection: DeploymentPolicyActiveProfileSelectionRecord | undefined;
  private readonly overrides = new Map<string, DeploymentPolicyOverridePersistenceRecord>();

  public setActiveSelection(record: DeploymentPolicyActiveProfileSelectionRecord | undefined): void {
    this.activeSelection = record;
  }

  public setOverride(record: DeploymentPolicyOverridePersistenceRecord): void {
    this.overrides.set(`${record.scope.kind}:${record.scope.scopeId}:${record.profileId}:${record.familyId}.${record.settingKey}`, record);
  }

  public async getActiveProfileSelection(): Promise<DeploymentPolicyActiveProfileSelectionRecord | undefined> {
    return this.activeSelection;
  }

  public async setActiveProfileSelection(): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyActiveProfileSelectionRecord>> {
    throw new Error("not implemented for bootstrap-resolution tests");
  }

  public async listOverrideRecords(query: {
    readonly scope: DeploymentPolicyPersistenceScope;
    readonly profileId?: DeploymentProfileId;
  }): Promise<ReadonlyArray<DeploymentPolicyOverridePersistenceRecord>> {
    const values = [...this.overrides.values()].filter((record) => (
      record.scope.kind === query.scope.kind
      && record.scope.scopeId === query.scope.scopeId
      && (!query.profileId || record.profileId === query.profileId)
    ));
    return Object.freeze(values);
  }

  public async upsertOverrideRecord(): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverridePersistenceRecord>> {
    throw new Error("not implemented for bootstrap-resolution tests");
  }

  public async removeOverrideRecord(): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyOverrideHistoryRecord>> {
    throw new Error("not implemented for bootstrap-resolution tests");
  }

  public async listOverrideHistory(): Promise<ReadonlyArray<DeploymentPolicyOverrideHistoryRecord>> {
    return Object.freeze([]);
  }

  public async getEffectivePolicyMetadata(): Promise<DeploymentPolicyEffectiveMetadataRecord | undefined> {
    return undefined;
  }

  public async saveEffectivePolicyMetadata(): Promise<DeploymentPolicyPersistenceMutationResult<DeploymentPolicyEffectiveMetadataRecord>> {
    throw new Error("not implemented for bootstrap-resolution tests");
  }
}

class RecordingDeploymentPolicyAdministrationObservabilityPort
  implements IDeploymentPolicyAdministrationObservabilityPort {
  public readonly events: DeploymentPolicyAdministrationObservabilityEvent[] = [];

  public async recordDeploymentPolicyAdministrationEvent(
    event: DeploymentPolicyAdministrationObservabilityEvent,
  ): Promise<void> {
    this.events.push(event);
  }
}

function createScope(): DeploymentPolicyPersistenceScope {
  return createDeploymentPolicyPersistenceScope({
    scopeId: "platform:default",
  });
}

function createSelection(profileId: DeploymentProfileId): DeploymentPolicyActiveProfileSelectionRecord {
  return Object.freeze({
    scope: createScope(),
    profileId,
    changedAt: "2026-04-06T10:00:00.000Z",
    changedByUserIdentityId: "user:admin",
    createdAt: "2026-04-06T10:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-04-06T10:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

function createOverrideRecord(input: {
  readonly profileId: DeploymentProfileId;
  readonly familyId: string;
  readonly settingKey: string;
  readonly value: string | number | boolean;
}): DeploymentPolicyOverridePersistenceRecord {
  return Object.freeze({
    scope: createScope(),
    profileId: input.profileId,
    familyId: input.familyId as DeploymentPolicyOverridePersistenceRecord["familyId"],
    settingKey: input.settingKey as DeploymentPolicyOverridePersistenceRecord["settingKey"],
    value: input.value,
    valueType: typeof input.value === "string" ? "string" : (typeof input.value === "number" ? "number" : "boolean"),
    createdAt: "2026-04-06T10:00:00.000Z",
    createdBy: "user:admin",
    lastModifiedAt: "2026-04-06T10:00:00.000Z",
    lastModifiedBy: "user:admin",
    revision: 1,
  });
}

describe("DeploymentPolicyBootstrapResolutionService", () => {
  it("resolves persisted active profile and effective snapshot for runtime evaluation seams", async () => {
    const repository = new InMemoryDeploymentPolicyPersistenceRepository();
    const observabilityPort = new RecordingDeploymentPolicyAdministrationObservabilityPort();
    repository.setActiveSelection(createSelection(DeploymentProfileIds.organization));
    repository.setOverride(createOverrideRecord({
      profileId: DeploymentProfileIds.organization,
      familyId: "sharing-posture",
      settingKey: "defaultWorkspaceVisibility",
      value: "private",
    }));

    const service = new DeploymentPolicyBootstrapResolutionService({
      deploymentPolicyRepository: repository,
      observabilityPort,
      now: () => new Date("2026-04-06T12:00:00.000Z"),
    });

    const resolved = await service.execute();
    const context = await resolved.contextResolver.resolveContext({
      workspaceId: "workspace:alpha",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });
    const authorizationPolicy = await resolved.evaluationService.evaluateAuthorizationPolicy(context);

    expect(resolved.activeProfile.profileId).toBe(DeploymentProfileIds.organization);
    expect(resolved.activeProfile.source).toBe(DeploymentPolicyBootstrapActiveProfileSourceKinds.persistedSelection);
    expect(resolved.validation.valid).toBeTrue();
    expect(resolved.snapshot.profileId).toBe(DeploymentProfileIds.organization);
    expect(authorizationPolicy.defaultWorkspaceVisibility.value).toBe("private");
    expect(authorizationPolicy.defaultWorkspaceVisibility.source).toBe("admin-state");
    expect(observabilityPort.events.some((event) => (
      event.event === "deployment-policy-admin.bootstrap.resolved"
      && event.outcome === "success"
    ))).toBeTrue();
  });

  it("uses deterministic fallback behavior when persisted profile selection is missing", async () => {
    const repository = new InMemoryDeploymentPolicyPersistenceRepository();
    const service = new DeploymentPolicyBootstrapResolutionService({
      deploymentPolicyRepository: repository,
      now: () => new Date("2026-04-06T12:00:00.000Z"),
    });

    const resolved = await service.execute();
    const context = await resolved.contextResolver.resolveContext({
      workspaceSlug: "alpha",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    expect(resolved.activeProfile.profileId).toBe(DeploymentProfileIds.home);
    expect(resolved.activeProfile.source).toBe(DeploymentPolicyBootstrapActiveProfileSourceKinds.defaultFallback);
    expect(resolved.overrideRecords).toHaveLength(0);
    expect(context.profileId).toBe(DeploymentProfileIds.home);
  });

  it("supports configured non-home fallback behavior when persisted profile selection is missing", async () => {
    const repository = new InMemoryDeploymentPolicyPersistenceRepository();
    const service = new DeploymentPolicyBootstrapResolutionService({
      deploymentPolicyRepository: repository,
      fallbackProfileId: DeploymentProfileIds.organization,
      now: () => new Date("2026-04-06T12:00:00.000Z"),
    });

    const resolved = await service.execute();
    const context = await resolved.contextResolver.resolveContext({
      workspaceSlug: "beta",
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    expect(resolved.activeProfile.profileId).toBe(DeploymentProfileIds.organization);
    expect(resolved.activeProfile.source).toBe(DeploymentPolicyBootstrapActiveProfileSourceKinds.defaultFallback);
    expect(context.profileId).toBe(DeploymentProfileIds.organization);
  });

  it("fails startup resolution explicitly when persisted state is invalid", async () => {
    const repository = new InMemoryDeploymentPolicyPersistenceRepository();
    const observabilityPort = new RecordingDeploymentPolicyAdministrationObservabilityPort();
    repository.setActiveSelection(createSelection(DeploymentProfileIds.classroom));
    repository.setOverride(createOverrideRecord({
      profileId: DeploymentProfileIds.classroom,
      familyId: "unknown-family",
      settingKey: "unsupported",
      value: true,
    }));

    const service = new DeploymentPolicyBootstrapResolutionService({
      deploymentPolicyRepository: repository,
      observabilityPort,
      now: () => new Date("2026-04-06T12:00:00.000Z"),
    });

    await expect(service.execute()).rejects.toMatchObject({
      name: "DeploymentPolicyBootstrapResolutionError",
      code: DeploymentPolicyBootstrapResolutionErrorCodes.invalidPersistedState,
    } satisfies Partial<DeploymentPolicyBootstrapResolutionError>);

    try {
      await service.execute();
      throw new Error("Expected invalid persisted deployment policy state failure.");
    } catch (error) {
      const bootstrapError = error as DeploymentPolicyBootstrapResolutionError;
      expect(bootstrapError.metadata.validationIssues.length).toBeGreaterThan(0);
    }
    expect(observabilityPort.events.some((event) => (
      event.event === "deployment-policy-admin.bootstrap.failed"
      && event.outcome === "failure"
    ))).toBeTrue();
  });
});
