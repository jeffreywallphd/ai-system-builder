import {
  createEnvironmentProvisioningPlan,
  createEnvironmentProvisioningRequest,
  createProvisionedDeploymentEnvironment,
  EnvironmentProvisioningStatuses,
  type EnvironmentProvisioningInterface,
  type EnvironmentProvisioningRequest,
  type EnvironmentProvisioningResult,
} from "@domain/deployment/EnvironmentProvisioningDomain";
import { EnvironmentProvisioningCompatibilityValidator } from "./EnvironmentProvisioningCompatibilityValidator";

export class EnvironmentProvisioningService implements EnvironmentProvisioningInterface {
  public constructor(
    private readonly compatibilityValidator: EnvironmentProvisioningCompatibilityValidator = new EnvironmentProvisioningCompatibilityValidator(),
    private readonly clock: () => Date = () => new Date(),
  ) {}

  public provision(request: EnvironmentProvisioningRequest): EnvironmentProvisioningResult {
    const normalizedRequest = createEnvironmentProvisioningRequest(request);
    const plan = createEnvironmentProvisioningPlan({
      bundle: normalizedRequest.bundle,
      deploymentConfiguration: normalizedRequest.deploymentConfiguration,
      target: normalizedRequest.target,
    });

    const compatibility = this.compatibilityValidator.validate({
      bundle: normalizedRequest.bundle,
      deploymentConfiguration: normalizedRequest.deploymentConfiguration,
      target: normalizedRequest.target,
    });

    if (!compatibility.compatible) {
      return Object.freeze({
        requestId: normalizedRequest.requestId,
        status: EnvironmentProvisioningStatuses.failed,
        plan,
        issues: compatibility.issues,
      });
    }

    const provisionedEnvironment = createProvisionedDeploymentEnvironment({
      target: normalizedRequest.target,
      bundle: normalizedRequest.bundle,
      deploymentConfiguration: normalizedRequest.deploymentConfiguration,
      plan,
      provisionedAt: this.clock().toISOString(),
    });

    return Object.freeze({
      requestId: normalizedRequest.requestId,
      status: EnvironmentProvisioningStatuses.ready,
      plan,
      provisionedEnvironment,
      issues: Object.freeze([]),
    });
  }
}

