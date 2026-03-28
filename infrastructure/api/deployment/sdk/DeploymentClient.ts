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
import type { DeploymentSdkTransport, DeploymentSdkTransportRequestContext } from "./DeploymentSdkTransport";

export interface DeploymentClientOptions {
  readonly transport: DeploymentSdkTransport;
  readonly authentication?: DeploymentSdkAuthentication;
  readonly accessContext?: DeploymentSdkAccessContext;
}

function mergeContext(
  defaults: Pick<DeploymentClientOptions, "authentication" | "accessContext">,
  overrides?: DeploymentSdkTransportRequestContext,
): DeploymentSdkTransportRequestContext {
  return Object.freeze({
    authentication: overrides?.authentication ?? defaults.authentication,
    accessContext: overrides?.accessContext ?? defaults.accessContext,
  });
}

export class DeploymentClient {
  private readonly transport: DeploymentSdkTransport;
  private readonly defaultContext: DeploymentSdkTransportRequestContext;

  public constructor(options: DeploymentClientOptions) {
    this.transport = options.transport;
    this.defaultContext = Object.freeze({
      authentication: options.authentication,
      accessContext: options.accessContext,
    });
  }

  public startDeployment(
    request: DeploymentSdkStartDeploymentRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkStartDeploymentResponse>> {
    return this.transport.startDeployment(request, mergeContext(this.defaultContext, context));
  }

  public getDeploymentStatus(
    request: DeploymentSdkDeploymentStatusRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkDeploymentStatusResponse>> {
    return this.transport.getDeploymentStatus(request, mergeContext(this.defaultContext, context));
  }

  public listDeployments(
    request: DeploymentSdkListDeploymentsRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkListDeploymentsResponse>> {
    return this.transport.listDeployments(request, mergeContext(this.defaultContext, context));
  }

  public getActiveDeployment(
    request: DeploymentSdkGetActiveDeploymentRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkGetActiveDeploymentResponse>> {
    return this.transport.getActiveDeployment(request, mergeContext(this.defaultContext, context));
  }

  public rollbackDeployment(
    request: DeploymentSdkRollbackRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkRollbackResponse>> {
    return this.transport.rollbackDeployment(request, mergeContext(this.defaultContext, context));
  }

  public getDeploymentHealth(
    request: DeploymentSdkHealthRequest,
    context?: DeploymentSdkTransportRequestContext,
  ): Promise<DeploymentSdkResponse<DeploymentSdkHealthResponse>> {
    return this.transport.getDeploymentHealth(request, mergeContext(this.defaultContext, context));
  }
}
