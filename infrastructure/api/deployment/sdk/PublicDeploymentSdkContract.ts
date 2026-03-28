export const DeploymentSdkErrorCodes = Object.freeze({
  unauthorized: "unauthorized",
  forbidden: "forbidden",
  invalidRequest: "invalid-request",
  notFound: "not-found",
  quotaExceeded: "quota-exceeded",
  internal: "internal",
} as const);

export type DeploymentSdkErrorCode = typeof DeploymentSdkErrorCodes[keyof typeof DeploymentSdkErrorCodes];

export interface DeploymentSdkValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface DeploymentSdkError {
  readonly code: DeploymentSdkErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<DeploymentSdkValidationError>;
}

export interface DeploymentSdkResponse<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: DeploymentSdkError;
}

export interface DeploymentSdkAuthentication {
  readonly bearerToken?: string;
}

export interface DeploymentSdkAccessContext {
  readonly callerKind: "user" | "service" | "tool";
  readonly callerId: string;
  readonly sessionId?: string;
  readonly roles?: ReadonlyArray<string>;
  readonly tenantId?: string;
  readonly source?: "deployment-api" | "external-api" | "studio-shell-internal" | "internal-trusted";
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface DeploymentSdkSelection {
  readonly targetId: string;
  readonly targetType: "local" | "cloud" | "edge";
  readonly tenantId?: string;
  readonly environmentId?: string;
}

export interface DeploymentSdkTargetDefinition {
  readonly targetId: string;
  readonly name: string;
  readonly type: "local" | "cloud" | "edge";
  readonly capabilities: {
    readonly supportsNestedSystems: boolean;
    readonly maxDependencyDepth: number;
    readonly supportedRuntimeEnvironments: ReadonlyArray<string>;
    readonly providedRuntimeRequirements: ReadonlyArray<string>;
    readonly supportedExportTargets: ReadonlyArray<string>;
    readonly supportedDeploymentSettings: ReadonlyArray<string>;
    readonly supportedRuntimeSettings: ReadonlyArray<string>;
  };
}

export interface DeploymentSdkSystemPackage {
  readonly packageId: string;
  readonly manifest: {
    readonly rootSystemAssetId: string;
    readonly rootSystemVersionId: string;
    readonly dependencyGraph: {
      readonly nodes: ReadonlyArray<{
        readonly nodeId: string;
        readonly assetId: string;
        readonly versionId?: string;
        readonly structuralKind: "atomic" | "composite" | "system" | "unknown";
        readonly relation: "root" | "component" | "dependency";
        readonly parentNodeId?: string;
        readonly discoveredAtDepth: number;
      }>;
      readonly edges: ReadonlyArray<{
        readonly fromNodeId: string;
        readonly toNodeId: string;
        readonly relation: "contains" | "depends-on";
      }>;
    };
    readonly dependencyVersionSnapshot: ReadonlyArray<{
      readonly assetId: string;
      readonly versionId?: string;
      readonly relation: "direct" | "transitive";
      readonly discoveredInSystemAssetId: string;
      readonly discoveredAtDepth: number;
    }>;
    readonly requirements: {
      readonly runtimeEnvironment?: string;
      readonly runtimeRequirements: ReadonlyArray<string>;
      readonly exportTargets: ReadonlyArray<string>;
      readonly requiresNestedSystemSupport: boolean;
      readonly maxDependencyDepth: number;
    };
    readonly lineage: {
      readonly parentVersionId?: string;
      readonly upstreamVersionIds: ReadonlyArray<string>;
    };
    readonly recursion: {
      readonly status: "complete" | "cycle-detected" | "max-depth-exceeded";
      readonly unresolvedNestedSystemCount: number;
      readonly maxDepth: number;
    };
    readonly packagingMetadata: {
      readonly packagingVersion: string;
      readonly packagedAt: string;
      readonly determinismKey: string;
    };
  };
}

export interface DeploymentSdkConfiguration {
  readonly configurationId: string;
  readonly packageId: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly targetId: string;
  readonly targetType: "local" | "cloud" | "edge";
  readonly schema: {
    readonly schemaId: string;
    readonly schemaVersion: string;
    readonly requiredDeploymentSettings: ReadonlyArray<string>;
    readonly optionalDeploymentSettings: ReadonlyArray<string>;
    readonly requiredRuntimeSettings: ReadonlyArray<string>;
    readonly optionalRuntimeSettings: ReadonlyArray<string>;
  };
  readonly valueSet: {
    readonly deploymentSettings: Readonly<Record<string, string>>;
    readonly runtimeSettings: Readonly<Record<string, string>>;
  };
  readonly nestedSystemBindings?: ReadonlyArray<{
    readonly systemAssetId: string;
    readonly systemVersionId?: string;
    readonly valueSet?: {
      readonly deploymentSettings: Readonly<Record<string, string>>;
      readonly runtimeSettings: Readonly<Record<string, string>>;
    };
  }>;
  readonly createdAt: string;
}

export interface DeploymentSdkStartDeploymentRequest {
  readonly requestId: string;
  readonly requestedAt: string;
  readonly systemPackage: DeploymentSdkSystemPackage;
  readonly target: DeploymentSdkTargetDefinition;
  readonly deploymentConfiguration: DeploymentSdkConfiguration;
  readonly selection?: DeploymentSdkSelection;
}

export interface DeploymentSdkDeploymentSummary {
  readonly deploymentId: string;
  readonly requestId: string;
  readonly status: "pending" | "succeeded" | "rejected";
  readonly state: string;
  readonly activationState: "active" | "inactive" | "superseded";
  readonly activationUpdatedAt: string;
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId: string;
  readonly packageId: string;
  readonly bundleId: string;
  readonly bundleVersionKey: string;
  readonly deploymentConfigurationId: string;
  readonly targetId: string;
  readonly targetType: "local" | "cloud" | "edge";
  readonly deploymentEnvironmentId?: string;
  readonly nestedSystemCount: number;
  readonly deployedAt: string;
  readonly tenantId?: string;
}

export interface DeploymentSdkStartDeploymentResponse {
  readonly deployment: DeploymentSdkDeploymentSummary;
  readonly issues: ReadonlyArray<{ readonly code: string; readonly message: string }>;
}

export interface DeploymentSdkDeploymentStatusRequest {
  readonly deploymentId: string;
  readonly tenantId?: string;
}

export interface DeploymentSdkDeploymentStatusResponse {
  readonly deployment: DeploymentSdkDeploymentSummary;
  readonly stateSnapshot: {
    readonly currentState: string;
    readonly updatedAt: string;
    readonly sequence: number;
  };
  readonly stateTransitions: ReadonlyArray<{
    readonly transitionId: string;
    readonly fromState?: string;
    readonly toState: string;
    readonly reason: string;
    readonly at: string;
    readonly sequence: number;
  }>;
}

export interface DeploymentSdkListDeploymentsRequest {
  readonly rootSystemAssetId: string;
  readonly rootSystemVersionId?: string;
  readonly targetId?: string;
  readonly targetType?: "local" | "cloud" | "edge";
  readonly tenantId?: string;
}

export interface DeploymentSdkListDeploymentsResponse {
  readonly deployments: ReadonlyArray<DeploymentSdkDeploymentSummary>;
}

export interface DeploymentSdkGetActiveDeploymentRequest {
  readonly rootSystemAssetId: string;
  readonly targetId: string;
  readonly targetType: "local" | "cloud" | "edge";
  readonly tenantId?: string;
}

export interface DeploymentSdkGetActiveDeploymentResponse {
  readonly activeDeployment?: DeploymentSdkDeploymentSummary;
}

export interface DeploymentSdkRollbackRequest {
  readonly requestId: string;
  readonly rootSystemAssetId: string;
  readonly targetId: string;
  readonly targetType: "local" | "cloud" | "edge";
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly toDeploymentId?: string;
  readonly reason?: string;
  readonly tenantId?: string;
}

export interface DeploymentSdkRollbackResponse {
  readonly requestId: string;
  readonly actionId: string;
  readonly performed: boolean;
  readonly requestedAt: string;
  readonly requestedBy: string;
  readonly rootSystemAssetId: string;
  readonly targetId: string;
  readonly targetType: "local" | "cloud" | "edge";
  readonly fromDeploymentId?: string;
  readonly toDeploymentId?: string;
  readonly decision: {
    readonly eligible: boolean;
    readonly code: "eligible" | "no-active-deployment" | "target-mismatch" | "candidate-not-found" | "candidate-not-eligible" | "already-active";
    readonly message: string;
  };
}

export interface DeploymentSdkHealthRequest {
  readonly deploymentId: string;
  readonly tenantId?: string;
}

export interface DeploymentSdkHealthResponse {
  readonly deploymentId: string;
  readonly status: "healthy" | "degraded" | "unhealthy" | "pending" | "unknown";
  readonly evaluatedAt: string;
  readonly reasons: ReadonlyArray<string>;
  readonly linkage: {
    readonly rootSystemAssetId: string;
    readonly rootSystemVersionId: string;
    readonly targetId: string;
    readonly targetType: "local" | "cloud" | "edge";
    readonly deploymentEnvironmentId?: string;
    readonly endpointIds: ReadonlyArray<string>;
    readonly activeDeploymentId?: string;
    readonly nestedSystemCount: number;
    readonly tenantId?: string;
  };
  readonly signals: {
    readonly deploymentStatus: "pending" | "succeeded" | "rejected";
    readonly deploymentState: string;
    readonly activationState: "active" | "inactive" | "superseded";
    readonly diagnosticErrorCount: number;
    readonly diagnosticWarningCount: number;
    readonly endpointExposureCount: number;
    readonly endpointResolvableCount: number;
  };
}
