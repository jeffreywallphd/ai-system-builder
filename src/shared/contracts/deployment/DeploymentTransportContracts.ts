import type {
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
} from "@infrastructure/api/deployment/sdk/PublicDeploymentSdkContract";
export type * from "@infrastructure/api/deployment/sdk/PublicDeploymentSdkContract";

export const DeploymentTransportRoutes = Object.freeze({
  startDeployment: "/api/v1/deployment/start",
  getDeploymentStatus: "/api/v1/deployment/:deploymentId/status",
  listDeployments: "/api/v1/deployment/list",
  getActiveDeployment: "/api/v1/deployment/active",
  rollbackDeployment: "/api/v1/deployment/rollback",
  getDeploymentHealth: "/api/v1/deployment/:deploymentId/health",
} as const);

export interface DeploymentTransportContract {
  readonly startDeployment: {
    readonly request: DeploymentSdkStartDeploymentRequest;
    readonly response: DeploymentSdkResponse<DeploymentSdkStartDeploymentResponse>;
  };
  readonly getDeploymentStatus: {
    readonly request: DeploymentSdkDeploymentStatusRequest;
    readonly response: DeploymentSdkResponse<DeploymentSdkDeploymentStatusResponse>;
  };
  readonly listDeployments: {
    readonly request: DeploymentSdkListDeploymentsRequest;
    readonly response: DeploymentSdkResponse<DeploymentSdkListDeploymentsResponse>;
  };
  readonly getActiveDeployment: {
    readonly request: DeploymentSdkGetActiveDeploymentRequest;
    readonly response: DeploymentSdkResponse<DeploymentSdkGetActiveDeploymentResponse>;
  };
  readonly rollbackDeployment: {
    readonly request: DeploymentSdkRollbackRequest;
    readonly response: DeploymentSdkResponse<DeploymentSdkRollbackResponse>;
  };
  readonly getDeploymentHealth: {
    readonly request: DeploymentSdkHealthRequest;
    readonly response: DeploymentSdkResponse<DeploymentSdkHealthResponse>;
  };
}
