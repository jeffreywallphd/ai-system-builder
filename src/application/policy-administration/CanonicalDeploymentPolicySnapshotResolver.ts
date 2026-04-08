import {
  DeploymentPolicyEvaluationRequestLayers,
  evaluateDeploymentPolicyAdministrationSnapshot,
  resolveDeploymentPolicyAdministrationSnapshotWithOverrides,
} from "@application/deployment/DeploymentPolicyAdministrationContracts";
import {
  createCanonicalDeploymentPolicyConfigurationRegistry,
  type DeploymentPolicyConfigurationRegistry,
} from "@domain/deployment/DeploymentProfilePolicyAdministrationDomain";
import type { DeploymentPolicyAdministrationSnapshot } from "@shared/contracts/deployment/DeploymentPolicyAdministrationContracts";
import type { DeploymentPolicyEvaluationContext } from "./DeploymentPolicyEvaluationContracts";
import type { IDeploymentPolicyEvaluationSnapshotResolverPort } from "./DeploymentPolicyEvaluationPorts";

export interface CanonicalDeploymentPolicySnapshotResolverDependencies {
  readonly configurationRegistry?: DeploymentPolicyConfigurationRegistry;
}

export class CanonicalDeploymentPolicySnapshotResolver implements IDeploymentPolicyEvaluationSnapshotResolverPort {
  private readonly configurationRegistry: DeploymentPolicyConfigurationRegistry;

  public constructor(dependencies: CanonicalDeploymentPolicySnapshotResolverDependencies = {}) {
    this.configurationRegistry = dependencies.configurationRegistry
      ?? createCanonicalDeploymentPolicyConfigurationRegistry();
  }

  public resolveSnapshot(input: DeploymentPolicyEvaluationContext): DeploymentPolicyAdministrationSnapshot {
    if (input.overrideRecords) {
      return resolveDeploymentPolicyAdministrationSnapshotWithOverrides({
        profileId: input.profileId,
        familyCatalog: this.configurationRegistry.familyCatalog,
        presetCatalog: this.configurationRegistry.presetCatalog,
        overrideRecords: input.overrideRecords,
        evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
        evaluatedAt: input.evaluatedAt,
      }).snapshot;
    }

    return evaluateDeploymentPolicyAdministrationSnapshot({
      profileId: input.profileId,
      familyCatalog: this.configurationRegistry.familyCatalog,
      presetCatalog: this.configurationRegistry.presetCatalog,
      adminState: input.adminState,
      evaluationLayer: DeploymentPolicyEvaluationRequestLayers.application,
      evaluatedAt: input.evaluatedAt,
    });
  }
}
