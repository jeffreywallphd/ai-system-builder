import type { SharedApiResponseEnvelope } from "@shared/contracts/api/SharedApiContractPrimitives";
import type {
  ExecutionNodeActivationStatus,
  ExecutionNodeBackendReadinessState,
  ExecutionNodeHealthStatus,
  ImageExecutionNodeCompatibilityFindingKind,
} from "@domain/nodes/ExecutionNodeDomain";
import type {
  NodeApprovalStatus,
  NodeRoleCapability,
  NodeTrustState,
  NodeType,
} from "@domain/nodes/NodeTrustDomain";

export const ExecutionNodeManagementTransportContractVersions = Object.freeze({
  v1: "execution-node-management-api/v1",
} as const);

export type ExecutionNodeManagementTransportContractVersion =
  typeof ExecutionNodeManagementTransportContractVersions[keyof typeof ExecutionNodeManagementTransportContractVersions];

export const ExecutionNodeManagementTransportRoutes = Object.freeze({
  listNodes: "/api/v1/execution-nodes",
  getNode: "/api/v1/execution-nodes/:nodeId",
  checkReadiness: "/api/v1/execution-nodes/readiness",
  checkEligibility: "/api/v1/execution-nodes/eligibility",
  listBackendAvailability: "/api/v1/execution-nodes/backends/availability",
} as const);

export const ExecutionNodeReadinessStates = Object.freeze({
  ready: "ready",
  degraded: "degraded",
  blocked: "blocked",
} as const);

export type ExecutionNodeReadinessState =
  typeof ExecutionNodeReadinessStates[keyof typeof ExecutionNodeReadinessStates];

export const ExecutionNodeEligibilityDecisionKinds = Object.freeze({
  eligible: "eligible",
  incompatible: "incompatible",
  unavailable: "unavailable",
} as const);

export type ExecutionNodeEligibilityDecisionKind =
  typeof ExecutionNodeEligibilityDecisionKinds[keyof typeof ExecutionNodeEligibilityDecisionKinds];

export const ExecutionNodeReadinessIssueSeverities = Object.freeze({
  error: "error",
  warning: "warning",
  info: "info",
} as const);

export type ExecutionNodeReadinessIssueSeverity =
  typeof ExecutionNodeReadinessIssueSeverities[keyof typeof ExecutionNodeReadinessIssueSeverities];

export const ExecutionNodeCompatibilityFindingKinds = Object.freeze({
  hardIncompatibility: "hard-incompatibility",
  softAdvisory: "soft-advisory",
  transientAvailability: "transient-availability",
} as const);

export type ExecutionNodeCompatibilityFindingKind =
  typeof ExecutionNodeCompatibilityFindingKinds[keyof typeof ExecutionNodeCompatibilityFindingKinds];

export interface ExecutionNodeBackendReadinessSummaryDto {
  readonly state: ExecutionNodeBackendReadinessState;
  readonly checkedAt?: string;
  readonly summary?: string;
}

export interface ExecutionNodeBackendCapabilitySummaryDto {
  readonly backendFamily: string;
  readonly supportedExecutionTargets: ReadonlyArray<string>;
  readonly supportedOperationKinds: ReadonlyArray<string>;
  readonly supportedOperationCapabilities: ReadonlyArray<string>;
  readonly supportedInputKinds: ReadonlyArray<string>;
  readonly supportedOutputKinds: ReadonlyArray<string>;
  readonly supportedTranslationContractVersions: ReadonlyArray<string>;
  readonly resourceClassHints: ReadonlyArray<string>;
  readonly capabilityProfileVersion?: string;
  readonly metadataTags: ReadonlyArray<string>;
  readonly readiness: ExecutionNodeBackendReadinessSummaryDto;
}

export interface ExecutionNodeHealthSummaryDto {
  readonly activationStatus: ExecutionNodeActivationStatus;
  readonly healthStatus: ExecutionNodeHealthStatus;
  readonly lastSeenAt?: string;
  readonly stale: boolean;
  readonly staleReasonCode?: string;
}

export interface ExecutionNodeOperationalSummaryDto {
  readonly approvalStatus: NodeApprovalStatus;
  readonly trustState: NodeTrustState;
  readonly enabledCapabilities: ReadonlyArray<NodeRoleCapability>;
  readonly supportsRemoteScheduling: boolean;
  readonly maxConcurrentWorkloads?: number;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly certificateAssigned: boolean;
  readonly enrollmentRequestId?: string;
}

export interface ExecutionNodeSummaryDto {
  readonly nodeId: string;
  readonly displayName: string;
  readonly nodeType: NodeType;
  readonly health: ExecutionNodeHealthSummaryDto;
  readonly operational: ExecutionNodeOperationalSummaryDto;
  readonly backendFamilies: ReadonlyArray<string>;
}

export interface ExecutionNodeDetailDto extends ExecutionNodeSummaryDto {
  readonly backendCapabilities: ReadonlyArray<ExecutionNodeBackendCapabilitySummaryDto>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExecutionNodeReadinessIssueDto {
  readonly code: string;
  readonly severity: ExecutionNodeReadinessIssueSeverity;
  readonly message: string;
}

export interface ExecutionNodeCompatibilityFindingSummaryDto {
  readonly code: string;
  readonly kind: ImageExecutionNodeCompatibilityFindingKind | ExecutionNodeCompatibilityFindingKind;
  readonly message: string;
  readonly blocking: boolean;
}

export interface ExecutionNodeEligibilityResultDto {
  readonly nodeId: string;
  readonly displayName: string;
  readonly decision: ExecutionNodeEligibilityDecisionKind;
  readonly compatible: boolean;
  readonly routable: boolean;
  readonly matchedBackendFamily?: string;
  readonly matchedExecutionTarget?: string;
  readonly findingCodes: ReadonlyArray<string>;
  readonly findings: ReadonlyArray<ExecutionNodeCompatibilityFindingSummaryDto>;
}

export interface ExecutionNodeReadinessNodeResultDto {
  readonly nodeId: string;
  readonly displayName: string;
  readonly readiness: ExecutionNodeReadinessState;
  readonly eligible: boolean;
  readonly compatible: boolean;
  readonly routable: boolean;
  readonly matchedBackendFamily?: string;
  readonly matchedExecutionTarget?: string;
  readonly findingCodes: ReadonlyArray<string>;
}

export interface ExecutionNodeBackendAvailabilitySummaryDto {
  readonly backendFamily: string;
  readonly readiness: ExecutionNodeBackendReadinessState;
  readonly totalNodeCount: number;
  readonly readyNodeCount: number;
  readonly degradedNodeCount: number;
  readonly unavailableNodeCount: number;
  readonly unknownNodeCount: number;
  readonly checkedAt: string;
  readonly summary?: string;
}

export interface ExecutionNodeListRequestDto {
  readonly nodeIds?: ReadonlyArray<string>;
  readonly nodeTypes?: ReadonlyArray<NodeType>;
  readonly approvalStatuses?: ReadonlyArray<NodeApprovalStatus>;
  readonly trustStates?: ReadonlyArray<NodeTrustState>;
  readonly activationStatuses?: ReadonlyArray<ExecutionNodeActivationStatus>;
  readonly healthStatuses?: ReadonlyArray<ExecutionNodeHealthStatus>;
  readonly backendFamilies?: ReadonlyArray<string>;
  readonly executionTargets?: ReadonlyArray<string>;
  readonly requiredCapabilitiesAnyOf?: ReadonlyArray<NodeRoleCapability>;
  readonly supportsRemoteScheduling?: boolean;
  readonly deploymentTagAnyOf?: ReadonlyArray<string>;
  readonly includeRevoked?: boolean;
  readonly lastSeenAfter?: string;
  readonly lastSeenBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ExecutionNodeGetRequestDto {
  readonly nodeId: string;
}

export interface ExecutionNodeReadinessCheckRequestDto {
  readonly workspaceId?: string;
  readonly workflowId?: string;
  readonly runId?: string;
  readonly candidateNodeIds?: ReadonlyArray<string>;
  readonly requiredBackendFamilies?: ReadonlyArray<string>;
  readonly requiredExecutionTarget?: string;
  readonly requiredNodeCapabilities?: ReadonlyArray<NodeRoleCapability>;
  readonly requiresRemoteScheduling?: boolean;
  readonly requiredOperationKind?: string;
  readonly requiredOperationCapability?: string;
  readonly requiredInputKinds?: ReadonlyArray<string>;
  readonly requiredOutputKinds?: ReadonlyArray<string>;
  readonly requiredTranslationContractVersion?: string;
  readonly preferredResourceClassHints?: ReadonlyArray<string>;
  readonly allowDegraded?: boolean;
  readonly maxLastSeenAgeMs?: number;
  readonly now?: string;
}

export interface ExecutionNodeEligibilityCheckRequestDto extends ExecutionNodeReadinessCheckRequestDto {}

export interface ExecutionNodeBackendAvailabilityReadRequestDto {
  readonly backendFamilies?: ReadonlyArray<string>;
  readonly executionTarget?: string;
  readonly includeUnavailable?: boolean;
}

export interface ExecutionNodeListResponseDto {
  readonly contractVersion: ExecutionNodeManagementTransportContractVersion;
  readonly items: ReadonlyArray<ExecutionNodeSummaryDto>;
  readonly totalCount: number;
  readonly asOf: string;
}

export interface ExecutionNodeGetResponseDto {
  readonly contractVersion: ExecutionNodeManagementTransportContractVersion;
  readonly node: ExecutionNodeDetailDto;
  readonly asOf: string;
}

export interface ExecutionNodeReadinessCheckResponseDto {
  readonly contractVersion: ExecutionNodeManagementTransportContractVersion;
  readonly checkedAt: string;
  readonly readyForExecution: boolean;
  readonly readiness: ExecutionNodeReadinessState;
  readonly nodeResults: ReadonlyArray<ExecutionNodeReadinessNodeResultDto>;
  readonly issues: ReadonlyArray<ExecutionNodeReadinessIssueDto>;
}

export interface ExecutionNodeEligibilityCheckResponseDto {
  readonly contractVersion: ExecutionNodeManagementTransportContractVersion;
  readonly checkedAt: string;
  readonly evaluations: ReadonlyArray<ExecutionNodeEligibilityResultDto>;
}

export interface ExecutionNodeBackendAvailabilityReadResponseDto {
  readonly contractVersion: ExecutionNodeManagementTransportContractVersion;
  readonly asOf: string;
  readonly backends: ReadonlyArray<ExecutionNodeBackendAvailabilitySummaryDto>;
}

export interface ExecutionNodeInternalSummaryDto extends ExecutionNodeSummaryDto {
  readonly endpointRef: string;
  readonly configurationRef?: string;
  readonly certificateRef?: string;
  readonly adapterDiagnosticKeys?: ReadonlyArray<string>;
}

export interface ExecutionNodeInternalDetailDto extends ExecutionNodeDetailDto {
  readonly endpointRef: string;
  readonly configurationRef?: string;
  readonly certificateRef?: string;
  readonly adapterDiagnosticKeys?: ReadonlyArray<string>;
  readonly connectionSecretRef?: string;
  readonly backendProbePayloadRef?: string;
}

export interface ExecutionNodeBackendInternalAvailabilitySummaryDto extends ExecutionNodeBackendAvailabilitySummaryDto {
  readonly probePayloadRefIds?: ReadonlyArray<string>;
  readonly connectionSecretRefIds?: ReadonlyArray<string>;
}

export interface ExecutionNodeManagementApiContract {
  readonly listNodes: {
    readonly request: ExecutionNodeListRequestDto;
    readonly response: SharedApiResponseEnvelope<ExecutionNodeListResponseDto>;
  };
  readonly getNode: {
    readonly request: ExecutionNodeGetRequestDto;
    readonly response: SharedApiResponseEnvelope<ExecutionNodeGetResponseDto>;
  };
  readonly checkReadiness: {
    readonly request: ExecutionNodeReadinessCheckRequestDto;
    readonly response: SharedApiResponseEnvelope<ExecutionNodeReadinessCheckResponseDto>;
  };
  readonly checkEligibility: {
    readonly request: ExecutionNodeEligibilityCheckRequestDto;
    readonly response: SharedApiResponseEnvelope<ExecutionNodeEligibilityCheckResponseDto>;
  };
  readonly listBackendAvailability: {
    readonly request: ExecutionNodeBackendAvailabilityReadRequestDto;
    readonly response: SharedApiResponseEnvelope<ExecutionNodeBackendAvailabilityReadResponseDto>;
  };
}

function cloneArray<T>(value: ReadonlyArray<T>): ReadonlyArray<T> {
  return Object.freeze([...value]);
}

export function toExecutionNodeSummaryDto(value: ExecutionNodeInternalSummaryDto): ExecutionNodeSummaryDto {
  return Object.freeze({
    nodeId: value.nodeId,
    displayName: value.displayName,
    nodeType: value.nodeType,
    health: Object.freeze({
      activationStatus: value.health.activationStatus,
      healthStatus: value.health.healthStatus,
      lastSeenAt: value.health.lastSeenAt,
      stale: value.health.stale,
      staleReasonCode: value.health.staleReasonCode,
    }),
    operational: Object.freeze({
      approvalStatus: value.operational.approvalStatus,
      trustState: value.operational.trustState,
      enabledCapabilities: cloneArray(value.operational.enabledCapabilities),
      supportsRemoteScheduling: value.operational.supportsRemoteScheduling,
      maxConcurrentWorkloads: value.operational.maxConcurrentWorkloads,
      deploymentTags: cloneArray(value.operational.deploymentTags),
      certificateAssigned: value.operational.certificateAssigned || Boolean(value.certificateRef),
      enrollmentRequestId: value.operational.enrollmentRequestId,
    }),
    backendFamilies: cloneArray(value.backendFamilies),
  });
}

export function toExecutionNodeDetailDto(value: ExecutionNodeInternalDetailDto): ExecutionNodeDetailDto {
  return Object.freeze({
    ...toExecutionNodeSummaryDto(value),
    backendCapabilities: cloneArray(value.backendCapabilities.map((capability) => Object.freeze({
      backendFamily: capability.backendFamily,
      supportedExecutionTargets: cloneArray(capability.supportedExecutionTargets),
      supportedOperationKinds: cloneArray(capability.supportedOperationKinds),
      supportedOperationCapabilities: cloneArray(capability.supportedOperationCapabilities),
      supportedInputKinds: cloneArray(capability.supportedInputKinds),
      supportedOutputKinds: cloneArray(capability.supportedOutputKinds),
      supportedTranslationContractVersions: cloneArray(capability.supportedTranslationContractVersions),
      resourceClassHints: cloneArray(capability.resourceClassHints),
      capabilityProfileVersion: capability.capabilityProfileVersion,
      metadataTags: cloneArray(capability.metadataTags),
      readiness: Object.freeze({
        state: capability.readiness.state,
        checkedAt: capability.readiness.checkedAt,
        summary: capability.readiness.summary,
      }),
    }))),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  });
}

export function toExecutionNodeBackendAvailabilitySummaryDto(
  value: ExecutionNodeBackendInternalAvailabilitySummaryDto,
): ExecutionNodeBackendAvailabilitySummaryDto {
  return Object.freeze({
    backendFamily: value.backendFamily,
    readiness: value.readiness,
    totalNodeCount: value.totalNodeCount,
    readyNodeCount: value.readyNodeCount,
    degradedNodeCount: value.degradedNodeCount,
    unavailableNodeCount: value.unavailableNodeCount,
    unknownNodeCount: value.unknownNodeCount,
    checkedAt: value.checkedAt,
    summary: value.summary,
  });
}
