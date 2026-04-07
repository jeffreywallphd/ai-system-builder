import type { DeploymentBackendApi } from "../DeploymentBackendApi";
import type {
  DeploymentSdkAccessContext,
  DeploymentSdkAuthentication,
  DeploymentSdkDeploymentStatusRequest,
  DeploymentSdkDeploymentStatusResponse,
  DeploymentSdkGetActiveDeploymentRequest,
  DeploymentSdkGetActiveDeploymentResponse,
  DeploymentSdkHealthRequest,
  DeploymentSdkHealthResponse,
  DeploymentSdkListDeploymentsRequest,
  DeploymentSdkListDeploymentsResponse,
  DeploymentSdkResponse,
  DeploymentSdkRollbackRequest,
  DeploymentSdkRollbackResponse,
  DeploymentSdkStartDeploymentRequest,
  DeploymentSdkStartDeploymentResponse,
} from "./PublicDeploymentSdkContract";

export interface DeploymentSdkTransportRequestContext {
  readonly authentication?: DeploymentSdkAuthentication;
  readonly accessContext?: DeploymentSdkAccessContext;
}

export interface DeploymentSdkTransport {
  startDeployment(
    request: DeploymentSdkStartDeploymentRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkStartDeploymentResponse>>;
  getDeploymentStatus(
    request: DeploymentSdkDeploymentStatusRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkDeploymentStatusResponse>>;
  listDeployments(
    request: DeploymentSdkListDeploymentsRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkListDeploymentsResponse>>;
  getActiveDeployment(
    request: DeploymentSdkGetActiveDeploymentRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkGetActiveDeploymentResponse>>;
  rollbackDeployment(
    request: DeploymentSdkRollbackRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkRollbackResponse>>;
  getDeploymentHealth(
    request: DeploymentSdkHealthRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkHealthResponse>>;
}

export class DeploymentApiSdkTransport implements DeploymentSdkTransport {
  public constructor(private readonly deploymentApi: DeploymentBackendApi) {}

  public async startDeployment(
    request: DeploymentSdkStartDeploymentRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkStartDeploymentResponse>> {
    return this.deploymentApi.startDeployment(request, { accessContext: context?.accessContext });
  }

  public async getDeploymentStatus(
    request: DeploymentSdkDeploymentStatusRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkDeploymentStatusResponse>> {
    return this.deploymentApi.getDeploymentStatus(request, { accessContext: context?.accessContext });
  }

  public async listDeployments(
    request: DeploymentSdkListDeploymentsRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkListDeploymentsResponse>> {
    return this.deploymentApi.listDeployments(request, { accessContext: context?.accessContext });
  }

  public async getActiveDeployment(
    request: DeploymentSdkGetActiveDeploymentRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkGetActiveDeploymentResponse>> {
    return this.deploymentApi.getActiveDeployment(request, { accessContext: context?.accessContext });
  }

  public async rollbackDeployment(
    request: DeploymentSdkRollbackRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkRollbackResponse>> {
    return this.deploymentApi.rollbackDeployment(request, { accessContext: context?.accessContext });
  }

  public async getDeploymentHealth(
    request: DeploymentSdkHealthRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkHealthResponse>> {
    return this.deploymentApi.getDeploymentHealth(request, { accessContext: context?.accessContext });
  }
}
