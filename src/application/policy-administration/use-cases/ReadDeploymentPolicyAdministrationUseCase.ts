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

export interface ReadDeploymentPolicyAdministrationUseCaseDependencies {
  readonly deploymentPolicyRepository: IDeploymentPolicyPersistenceRepository;
  readonly familyCatalog?: DeploymentPolicyFamilyCatalog;
  readonly presetCatalog?: DeploymentProfilePresetCatalog;
  readonly presetDefinitions?: DeploymentProfilePresetDefinitionCatalog;
}

export class ReadDeploymentPolicyAdministrationUseCase {
  private readonly familyCatalog: DeploymentPolicyFamilyCatalog;
  private readonly presetCatalog: DeploymentProfilePresetCatalog;
  private readonly presetDefinitions: DeploymentProfilePresetDefinitionCatalog;

  public constructor(private readonly dependencies: ReadDeploymentPolicyAdministrationUseCaseDependencies) {
    const registry = createCanonicalDeploymentPolicyConfigurationRegistry();
    this.familyCatalog = dependencies.familyCatalog ?? registry.familyCatalog;
    this.presetCatalog = dependencies.presetCatalog ?? registry.presetCatalog;
    this.presetDefinitions = dependencies.presetDefinitions ?? createCanonicalDeploymentProfilePresetDefinitions();
  }

  public async execute(
    input: ReadDeploymentPolicyStateRequest,
  ): Promise<ReadDeploymentPolicyStateResponse> {
    const scope = Object.freeze({
      kind: input.scope.kind,
      scopeId: input.scope.scopeId.trim().toLowerCase(),
    });
    const activeSelection = await this.dependencies.deploymentPolicyRepository.getActiveProfileSelection(scope);
    const activeProfileId = activeSelection?.profileId ?? DeploymentProfileIds.home;
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

    return Object.freeze({
      scope,
      activeProfile: this.toActiveProfileReadModel(activeSelection),
      snapshot: resolved.snapshot,
      validation: resolved.validation,
      overrideRecords: includeOverrideRecords ? overrideRecords : undefined,
      effectiveMetadata: includeEffectiveMetadata
        ? await this.dependencies.deploymentPolicyRepository.getEffectivePolicyMetadata(scope)
        : undefined,
      catalog: includeCatalog ? this.buildCatalog() : undefined,
    });
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
        profileId: DeploymentProfileIds.home,
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
