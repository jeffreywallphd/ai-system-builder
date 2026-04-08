import {
  createCanonicalDeploymentPolicyConfigurationRegistry,
  createCanonicalDeploymentProfilePresetDefinitions,
  DeploymentProfileIds,
  type DeploymentPolicyFamilyCatalog,
  type DeploymentProfilePresetCatalog,
  type DeploymentProfilePresetDefinitionCatalog,
  type DeploymentProfileId,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import type { IDeploymentPolicyPersistenceRepository } from "@application/deployment/ports/IDeploymentPolicyPersistenceRepository";
import {
  DeploymentPolicyEvaluationRequestLayers,
  resolveDeploymentPolicyAdministrationSnapshotWithOverrides,
} from "@application/deployment/DeploymentPolicyAdministrationContracts";
import type { DeploymentPolicyAdminOverrideRecord } from "@application/deployment/DeploymentPolicyEffectiveResolutionService";
import type { DeploymentPolicyActiveProfileSelectionRecord } from "@shared/dto/deployment/DeploymentPolicyAdministrationPersistenceDtos";
import {
  DeploymentPolicyActiveProfileSourceKinds,
  toDeploymentPolicyFamilyMetadataReadModel,
  type ReadDeploymentPolicyStateRequest,
  type ReadDeploymentPolicyStateResponse,
} from "@shared/contracts/deployment/DeploymentPolicyReadContracts";
import {
  DeploymentPolicyAdministrationPermissionKeys,
  type IDeploymentPolicyAdministrationPermissionService,
} from "./DeploymentPolicyAdministrationAuthoritativeUpdateUseCase";
import {
  DeploymentPolicyAdministrationObservabilityOperations,
  DeploymentPolicyAdministrationObservabilityOutcomes,
  publishDeploymentPolicyAdministrationObservabilityBestEffort,
  type IDeploymentPolicyAdministrationObservabilityPort,
} from "@application/policy-administration/ports/DeploymentPolicyAdministrationObservabilityPorts";

export interface ReadDeploymentPolicyAdministrationUseCaseDependencies {
  readonly deploymentPolicyRepository: IDeploymentPolicyPersistenceRepository;
  readonly permissionService: IDeploymentPolicyAdministrationPermissionService;
  readonly observabilityPort?: IDeploymentPolicyAdministrationObservabilityPort;
  readonly familyCatalog?: DeploymentPolicyFamilyCatalog;
  readonly presetCatalog?: DeploymentProfilePresetCatalog;
  readonly presetDefinitions?: DeploymentProfilePresetDefinitionCatalog;
  readonly defaultProfileId?: DeploymentProfileId;
}

export class ReadDeploymentPolicyAdministrationPermissionError extends Error {
  public readonly reasonCode?: string;
  public readonly reason?: string;

  public constructor(input: {
    readonly reasonCode?: string;
    readonly reason?: string;
  }) {
    super("Actor is not authorized to inspect deployment policy administration state.");
    this.name = "ReadDeploymentPolicyAdministrationPermissionError";
    this.reasonCode = input.reasonCode;
    this.reason = input.reason;
  }
}

export class ReadDeploymentPolicyAdministrationUseCase {
  private readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  private readonly presetCatalog: DeploymentProfilePresetCatalog;
  private readonly presetDefinitions: DeploymentProfilePresetDefinitionCatalog;
  private readonly defaultProfileId: DeploymentProfileId;

  public constructor(private readonly dependencies: ReadDeploymentPolicyAdministrationUseCaseDependencies) {
    const registry = createCanonicalDeploymentPolicyConfigurationRegistry();
    this.familyCatalog = dependencies.familyCatalog ?? registry.familyCatalog;
    this.presetCatalog = dependencies.presetCatalog ?? registry.presetCatalog;
    this.presetDefinitions = dependencies.presetDefinitions ?? createCanonicalDeploymentProfilePresetDefinitions();
    this.defaultProfileId = dependencies.defaultProfileId ?? DeploymentProfileIds.home;
  }

  public async execute(
    input: ReadDeploymentPolicyStateRequest,
  ): Promise<ReadDeploymentPolicyStateResponse> {
    const scope = Object.freeze({
      kind: input.scope.kind,
      scopeId: input.scope.scopeId.trim().toLowerCase(),
    });
    const occurredAt = input.evaluatedAt ?? new Date().toISOString();
    try {
      const readPermission = await this.dependencies.permissionService.evaluatePermission({
        actorUserIdentityId: input.actorUserIdentityId,
        requiredPermission: DeploymentPolicyAdministrationPermissionKeys.readState,
        scope,
        asOf: input.evaluatedAt,
      });
      if (!readPermission.allowed) {
        await this.publishReadObservability({
          event: "deployment-policy-admin.read.rejected",
          occurredAt,
          outcome: DeploymentPolicyAdministrationObservabilityOutcomes.rejected,
          severity: "warn",
          scope,
          actorUserIdentityId: input.actorUserIdentityId,
          details: Object.freeze({
            reasonCode: readPermission.reasonCode,
            reason: readPermission.reason,
          }),
        });
        throw new ReadDeploymentPolicyAdministrationPermissionError({
          reasonCode: readPermission.reasonCode,
          reason: readPermission.reason,
        });
      }

      const canSelectActiveProfile = await this.isAllowed({
        actorUserIdentityId: input.actorUserIdentityId,
        requiredPermission: DeploymentPolicyAdministrationPermissionKeys.selectActiveProfile,
        scope,
        asOf: input.evaluatedAt,
      });
      const canManageOverrides = await this.isAllowed({
        actorUserIdentityId: input.actorUserIdentityId,
        requiredPermission: DeploymentPolicyAdministrationPermissionKeys.manageOverrides,
        scope,
        asOf: input.evaluatedAt,
      });
      const canManageRuntimeAdminOverrides = await this.isAllowed({
        actorUserIdentityId: input.actorUserIdentityId,
        requiredPermission: DeploymentPolicyAdministrationPermissionKeys.manageRuntimeAdminOverrides,
        scope,
        asOf: input.evaluatedAt,
      });

      const activeSelection = await this.dependencies.deploymentPolicyRepository.getActiveProfileSelection(scope);
      const activeProfileId = activeSelection?.profileId ?? this.defaultProfileId;
      const resolvedProfileId = input.profileId ?? activeProfileId;

      const overrideRecords = await this.dependencies.deploymentPolicyRepository.listOverrideRecords({
        scope,
        profileId: resolvedProfileId,
      });

      const resolved = resolveDeploymentPolicyAdministrationSnapshotWithOverrides({
        profileId: resolvedProfileId,
        familyCatalog: this.familyCatalog,
        presetCatalog: this.presetCatalog,
        overrideRecords: overrideRecords.map((record) => this.toOverrideRecord(record)),
        evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
        evaluatedAt: input.evaluatedAt,
      });

      const includeCatalog = input.includeCatalog ?? true;
      const includeOverrideRecords = input.includeOverrideRecords ?? true;
      const includeEffectiveMetadata = input.includeEffectiveMetadata ?? true;
      const response = Object.freeze({
        scope,
        authorization: Object.freeze({
          canReadState: true,
          canSelectActiveProfile,
          canManageOverrides,
          canManageRuntimeAdminOverrides,
        }),
        activeProfile: this.toActiveProfileReadModel(activeSelection),
        snapshot: resolved.snapshot,
        validation: resolved.validation,
        overrideRecords: includeOverrideRecords ? overrideRecords : undefined,
        effectiveMetadata: includeEffectiveMetadata
          ? await this.dependencies.deploymentPolicyRepository.getEffectivePolicyMetadata(scope)
          : undefined,
        catalog: includeCatalog ? this.buildCatalog() : undefined,
      });
      await this.publishReadObservability({
        event: "deployment-policy-admin.read.completed",
        occurredAt,
        outcome: DeploymentPolicyAdministrationObservabilityOutcomes.success,
        severity: resolved.validation.valid ? "info" : "warn",
        scope,
        actorUserIdentityId: input.actorUserIdentityId,
        profileId: resolvedProfileId,
        details: Object.freeze({
          includeCatalog,
          includeOverrideRecords,
          includeEffectiveMetadata,
          activeProfileSource: response.activeProfile.source,
        }),
        counters: Object.freeze({
          overrideRecordCount: overrideRecords.length,
          validationIssueCount: resolved.validation.issues.length,
          familyCount: resolved.snapshot.summary.familyCount,
          settingCount: resolved.snapshot.summary.settingCount,
        }),
      });
      return response;
    } catch (error) {
      if (error instanceof ReadDeploymentPolicyAdministrationPermissionError) {
        throw error;
      }
      await this.publishReadObservability({
        event: "deployment-policy-admin.read.failed",
        occurredAt,
        outcome: DeploymentPolicyAdministrationObservabilityOutcomes.failure,
        severity: "error",
        scope,
        actorUserIdentityId: input.actorUserIdentityId,
        details: Object.freeze({
          message: error instanceof Error ? error.message : "Unknown read failure.",
        }),
      });
      throw error;
    }
  }

  private async publishReadObservability(input: {
    readonly event: string;
    readonly occurredAt: string;
    readonly outcome: "success" | "rejected" | "failure";
    readonly severity: "info" | "warn" | "error";
    readonly scope: ReadDeploymentPolicyStateRequest["scope"];
    readonly actorUserIdentityId: string;
    readonly profileId?: string;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly counters?: Readonly<Record<string, number>>;
  }): Promise<void> {
    await publishDeploymentPolicyAdministrationObservabilityBestEffort(this.dependencies.observabilityPort, Object.freeze({
      event: input.event,
      operation: DeploymentPolicyAdministrationObservabilityOperations.read,
      outcome: input.outcome,
      severity: input.severity,
      occurredAt: input.occurredAt,
      scope: input.scope,
      actorUserIdentityId: input.actorUserIdentityId,
      profileId: input.profileId,
      details: input.details,
      counters: input.counters,
    }));
  }

  private async isAllowed(input: {
    readonly actorUserIdentityId: string;
    readonly requiredPermission: typeof DeploymentPolicyAdministrationPermissionKeys[keyof typeof DeploymentPolicyAdministrationPermissionKeys];
    readonly scope: ReadDeploymentPolicyStateRequest["scope"];
    readonly asOf?: string;
  }): Promise<boolean> {
    const permission = await this.dependencies.permissionService.evaluatePermission({
      actorUserIdentityId: input.actorUserIdentityId,
      requiredPermission: input.requiredPermission,
      scope: input.scope,
      asOf: input.asOf,
    });
    return permission.allowed;
  }

  private buildCatalog(): NonNullable<ReadDeploymentPolicyStateResponse["catalog"]> {
    const presets = Object.freeze({
      [DeploymentProfileIds.home]: this.toPresetReadModel(DeploymentProfileIds.home),
      [DeploymentProfileIds.classroom]: this.toPresetReadModel(DeploymentProfileIds.classroom),
      [DeploymentProfileIds.organization]: this.toPresetReadModel(DeploymentProfileIds.organization),
    });
    const families = Object.freeze(Object.fromEntries(
      Object.values(this.familyCatalog).map((family) => [family.familyId, toDeploymentPolicyFamilyMetadataReadModel(family)]),
    ));

    return Object.freeze({
      presets,
      families,
    });
  }

  private toPresetReadModel(profileId: DeploymentProfileId): NonNullable<ReadDeploymentPolicyStateResponse["catalog"]>["presets"][DeploymentProfileId] {
    const preset = this.presetCatalog[profileId];
    const definition = this.presetDefinitions[profileId];
    const lineage = this.resolveLineage(profileId);
    return Object.freeze({
      profileId,
      parentProfileId: preset.parentProfileId,
      lineage,
      inheritedFrom: Object.freeze(lineage.filter((entry) => entry !== profileId)),
      scope: definition.scope,
      rationale: definition.rationale,
    });
  }

  private resolveLineage(profileId: DeploymentProfileId): ReadonlyArray<DeploymentProfileId> {
    const lineage: DeploymentProfileId[] = [];
    let current: DeploymentProfileId | undefined = profileId;
    while (current) {
      lineage.unshift(current);
      current = this.presetCatalog[current]?.parentProfileId;
    }
    return Object.freeze(lineage);
  }

  private toActiveProfileReadModel(
    selection: DeploymentPolicyActiveProfileSelectionRecord | undefined,
  ): ReadDeploymentPolicyStateResponse["activeProfile"] {
    if (!selection) {
      return Object.freeze({
        profileId: this.defaultProfileId,
        source: DeploymentPolicyActiveProfileSourceKinds.defaultFallback,
      });
    }
    return Object.freeze({
      profileId: selection.profileId,
      source: DeploymentPolicyActiveProfileSourceKinds.persistedSelection,
      selectionRecord: selection,
    });
  }

  private toOverrideRecord(record: Readonly<{
    profileId: DeploymentProfileId;
    familyId: string;
    settingKey: string;
    value: string | number | boolean;
    provenance?: {
      actorUserIdentityId?: string;
      ticketReference?: string;
      reason?: string;
      updatedAt?: string;
    };
  }>): DeploymentPolicyAdminOverrideRecord {
    return Object.freeze({
      profileId: record.profileId,
      familyId: record.familyId,
      settingKey: record.settingKey,
      value: record.value,
      provenance: record.provenance,
    });
  }
}
