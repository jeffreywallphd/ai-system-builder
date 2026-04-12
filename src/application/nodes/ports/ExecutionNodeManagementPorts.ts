import type { PlatformPersistenceMutationContext } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type {
  ExecutionNodeActivationStatus,
  ExecutionNodeBackendFamilyCapability,
  ImageExecutionNodeCompatibilityFinding,
  ExecutionNodeHealthStatus,
  ExecutionNodeOperationalAvailabilityMode,
  ExecutionNodeRecord,
  ImageExecutionNodeCompatibilityRequirements,
  ImageExecutionNodeCompatibilityResult,
} from "@domain/nodes/ExecutionNodeDomain";
import type {
  NodeApprovalStatus,
  NodeRoleCapability,
  NodeTrustState,
} from "@domain/nodes/NodeTrustDomain";

export interface ExecutionNodeMutationContext extends PlatformPersistenceMutationContext {
  readonly expectedRevision?: number;
  readonly reason?: string;
}

export interface ExecutionNodeMutationResult {
  readonly changed: boolean;
  readonly wasReplay: boolean;
  readonly record: ExecutionNodeRecord;
}

export interface ExecutionNodeListQuery {
  readonly nodeIds?: ReadonlyArray<string>;
  readonly backendFamilies?: ReadonlyArray<string>;
  readonly executionTargets?: ReadonlyArray<string>;
  readonly activationStatuses?: ReadonlyArray<ExecutionNodeActivationStatus>;
  readonly healthStatuses?: ReadonlyArray<ExecutionNodeHealthStatus>;
  readonly operationalAvailabilityModes?: ReadonlyArray<ExecutionNodeOperationalAvailabilityMode>;
  readonly approvalStatuses?: ReadonlyArray<NodeApprovalStatus>;
  readonly trustStates?: ReadonlyArray<NodeTrustState>;
  readonly requiredCapabilitiesAnyOf?: ReadonlyArray<NodeRoleCapability>;
  readonly supportsRemoteScheduling?: boolean;
  readonly requireCertificateRef?: boolean;
  readonly deploymentTagAnyOf?: ReadonlyArray<string>;
  readonly includeRevoked?: boolean;
  readonly lastSeenAfter?: string;
  readonly lastSeenBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface RegisterExecutionNodeInput {
  readonly record: ExecutionNodeRecord;
  readonly mutation: ExecutionNodeMutationContext;
}

export interface UpdateExecutionNodeHealthInput {
  readonly nodeId: string;
  readonly healthStatus: ExecutionNodeHealthStatus;
  readonly observedAt: string;
  readonly mutation: ExecutionNodeMutationContext;
}

export interface UpdateExecutionNodeCapabilitiesInput {
  readonly nodeId: string;
  readonly backendFamilyCapabilities: ReadonlyArray<ExecutionNodeBackendFamilyCapability>;
  readonly refreshedAt: string;
  readonly mutation: ExecutionNodeMutationContext;
}

export interface UpdateExecutionNodeAvailabilityInput {
  readonly nodeId: string;
  readonly activationStatus: ExecutionNodeActivationStatus;
  readonly healthStatus?: ExecutionNodeHealthStatus;
  readonly changedAt: string;
  readonly mutation: ExecutionNodeMutationContext;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface UpdateExecutionNodeOperationalAvailabilityInput {
  readonly nodeId: string;
  readonly mode: ExecutionNodeOperationalAvailabilityMode;
  readonly suppressedUntil?: string;
  readonly changedAt: string;
  readonly mutation: ExecutionNodeMutationContext;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IExecutionNodeRepository {
  findExecutionNodeById(nodeId: string): Promise<ExecutionNodeRecord | undefined>;
  listExecutionNodes(query: ExecutionNodeListQuery): Promise<ReadonlyArray<ExecutionNodeRecord>>;
  registerExecutionNode(input: RegisterExecutionNodeInput): Promise<ExecutionNodeMutationResult>;
  saveExecutionNode(input: RegisterExecutionNodeInput): Promise<ExecutionNodeMutationResult>;
  updateExecutionNodeHealth(input: UpdateExecutionNodeHealthInput): Promise<ExecutionNodeMutationResult>;
  updateExecutionNodeCapabilities(input: UpdateExecutionNodeCapabilitiesInput): Promise<ExecutionNodeMutationResult>;
  updateExecutionNodeAvailability(input: UpdateExecutionNodeAvailabilityInput): Promise<ExecutionNodeMutationResult>;
  updateExecutionNodeOperationalAvailability(
    input: UpdateExecutionNodeOperationalAvailabilityInput,
  ): Promise<ExecutionNodeMutationResult>;
}

export interface ExecutionNodeHealthRefreshObservation {
  readonly healthStatus: ExecutionNodeHealthStatus;
  readonly observedAt: string;
  readonly summary?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ExecutionNodeCapabilityRefreshObservation {
  readonly backendFamilyCapabilities: ReadonlyArray<ExecutionNodeBackendFamilyCapability>;
  readonly observedAt: string;
  readonly summary?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ExecutionNodeHealthRefreshResult {
  readonly nodeId: string;
  readonly changed: boolean;
  readonly record: ExecutionNodeRecord;
  readonly observation: ExecutionNodeHealthRefreshObservation;
}

export interface ExecutionNodeCapabilityRefreshResult {
  readonly nodeId: string;
  readonly changed: boolean;
  readonly record: ExecutionNodeRecord;
  readonly observation: ExecutionNodeCapabilityRefreshObservation;
}

export interface IExecutionNodeHealthRefreshServicePort {
  refreshExecutionNodeHealth(input: {
    readonly nodeId: string;
    readonly observation: ExecutionNodeHealthRefreshObservation;
    readonly mutation: ExecutionNodeMutationContext;
  }): Promise<ExecutionNodeHealthRefreshResult>;
}

export interface IExecutionNodeCapabilityRefreshServicePort {
  refreshExecutionNodeCapabilities(input: {
    readonly nodeId: string;
    readonly observation: ExecutionNodeCapabilityRefreshObservation;
    readonly mutation: ExecutionNodeMutationContext;
  }): Promise<ExecutionNodeCapabilityRefreshResult>;
}

export const ExecutionNodeEligibilityDecisionKinds = Object.freeze({
  eligible: "eligible",
  incompatible: "incompatible",
  unavailable: "unavailable",
});

export type ExecutionNodeEligibilityDecisionKind =
  typeof ExecutionNodeEligibilityDecisionKinds[keyof typeof ExecutionNodeEligibilityDecisionKinds];

export interface ExecutionNodeEligibilityEvaluation {
  readonly nodeId: string;
  readonly decision: ExecutionNodeEligibilityDecisionKind;
  readonly compatibility: ImageExecutionNodeCompatibilityResult;
}

export interface IExecutionNodeEligibilityEvaluationServicePort {
  evaluateExecutionNodeEligibility(input: {
    readonly asOf: string;
    readonly requirements?: ImageExecutionNodeCompatibilityRequirements;
    readonly candidateNodeIds?: ReadonlyArray<string>;
    readonly query?: ExecutionNodeListQuery;
  }): Promise<ReadonlyArray<ExecutionNodeEligibilityEvaluation>>;
}

export interface ImageRunNodeEligibilityRunContext {
  readonly runId: string;
  readonly workspaceId: string;
  readonly systemId?: string;
  readonly workflowId?: string;
  readonly operationKind?: string;
  readonly translationContractVersion?: string;
}

export interface ImageRunNodeCompatibilityHints {
  readonly requiredOperationCapability?: string;
  readonly requiredInputKinds?: ReadonlyArray<string>;
  readonly requiredOutputKinds?: ReadonlyArray<string>;
  readonly translationBackendFamilies?: ReadonlyArray<string>;
  readonly readinessChecks?: {
    readonly operationCapability?: boolean;
    readonly inputKinds?: boolean;
    readonly outputKinds?: boolean;
    readonly translationBackendFamily?: boolean;
  };
}

export interface ImageRunNodeEligibilityRequirements extends ImageExecutionNodeCompatibilityRequirements {
  readonly compatibilityHints?: ImageRunNodeCompatibilityHints;
}

export interface ImageRunNodeEligibilitySummary {
  readonly blockingReasonCodes: ReadonlyArray<string>;
  readonly advisoryReasonCodes: ReadonlyArray<string>;
  readonly transientAvailabilityReasonCodes: ReadonlyArray<string>;
  readonly findingCount: number;
}

export interface ImageRunNodeEligibilityResult {
  readonly run: ImageRunNodeEligibilityRunContext;
  readonly nodeId: string;
  readonly decision: ExecutionNodeEligibilityDecisionKind;
  readonly eligible: boolean;
  readonly compatible: boolean;
  readonly routable: boolean;
  readonly matchedBackendFamily?: string;
  readonly matchedExecutionTarget?: string;
  readonly findings: ReadonlyArray<ImageExecutionNodeCompatibilityFinding>;
  readonly blockingReasons: ReadonlyArray<ImageExecutionNodeCompatibilityFinding>;
  readonly advisories: ReadonlyArray<ImageExecutionNodeCompatibilityFinding>;
  readonly transientAvailabilityIssues: ReadonlyArray<ImageExecutionNodeCompatibilityFinding>;
  readonly normalizedRequirements: ImageExecutionNodeCompatibilityRequirements;
  readonly summary: ImageRunNodeEligibilitySummary;
}

export interface IImageRunNodeEligibilityEvaluationServicePort {
  evaluateRunToNodeEligibility(input: {
    readonly asOf: string;
    readonly run: ImageRunNodeEligibilityRunContext;
    readonly nodeId: string;
    readonly requirements?: ImageRunNodeEligibilityRequirements;
  }): Promise<ImageRunNodeEligibilityResult>;
  evaluateRunToCandidateNodes(input: {
    readonly asOf: string;
    readonly run: ImageRunNodeEligibilityRunContext;
    readonly requirements?: ImageRunNodeEligibilityRequirements;
    readonly candidateNodeIds?: ReadonlyArray<string>;
    readonly query?: ExecutionNodeListQuery;
  }): Promise<ReadonlyArray<ImageRunNodeEligibilityResult>>;
}

export const ImageRunExecutionNodeSelectionOutcomes = Object.freeze({
  selected: "selected",
  noEligibleNode: "no-eligible-node",
  noCandidateNodes: "no-candidate-nodes",
});

export type ImageRunExecutionNodeSelectionOutcome =
  typeof ImageRunExecutionNodeSelectionOutcomes[keyof typeof ImageRunExecutionNodeSelectionOutcomes];

export interface ImageRunExecutionNodeSelectionReason {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageRunExecutionNodeSelectionCandidate {
  readonly nodeId: string;
  readonly rank: number;
  readonly decision: ExecutionNodeEligibilityDecisionKind;
  readonly eligible: boolean;
  readonly matchedBackendFamily?: string;
  readonly matchedExecutionTarget?: string;
  readonly blockingReasonCodes: ReadonlyArray<string>;
  readonly advisoryReasonCodes: ReadonlyArray<string>;
  readonly transientAvailabilityReasonCodes: ReadonlyArray<string>;
}

export interface ImageRunExecutionNodeSelectionDecision {
  readonly run: ImageRunNodeEligibilityRunContext;
  readonly asOf: string;
  readonly strategyId: string;
  readonly outcome: ImageRunExecutionNodeSelectionOutcome;
  readonly selectedNodeId?: string;
  readonly selectedCandidate?: ImageRunExecutionNodeSelectionCandidate;
  readonly reasons: ReadonlyArray<ImageRunExecutionNodeSelectionReason>;
  readonly candidates: ReadonlyArray<ImageRunExecutionNodeSelectionCandidate>;
}

export interface IImageRunExecutionNodeSelectionServicePort {
  selectExecutionNodeForRun(input: {
    readonly asOf: string;
    readonly run: ImageRunNodeEligibilityRunContext;
    readonly requirements?: ImageRunNodeEligibilityRequirements;
    readonly candidateNodeIds?: ReadonlyArray<string>;
    readonly query?: ExecutionNodeListQuery;
  }): Promise<ImageRunExecutionNodeSelectionDecision>;
}

export interface ExecutionNodeAvailabilityChangeResult {
  readonly changed: boolean;
  readonly record: ExecutionNodeRecord;
  readonly previousActivationStatus: ExecutionNodeActivationStatus;
  readonly previousHealthStatus: ExecutionNodeHealthStatus;
}

export interface IExecutionNodeAvailabilityManagementServicePort {
  setExecutionNodeAvailability(input: {
    readonly nodeId: string;
    readonly activationStatus: ExecutionNodeActivationStatus;
    readonly healthStatus?: ExecutionNodeHealthStatus;
    readonly changedAt: string;
    readonly mutation: ExecutionNodeMutationContext;
    readonly details?: Readonly<Record<string, unknown>>;
  }): Promise<ExecutionNodeAvailabilityChangeResult>;
}

export interface ExecutionNodeSelectionHint {
  readonly nodeId: string;
  readonly rank: number;
  readonly decision: ExecutionNodeEligibilityDecisionKind;
  readonly matchedBackendFamily?: string;
  readonly matchedExecutionTarget?: string;
  readonly reasonCodes: ReadonlyArray<string>;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IExecutionNodeSelectionHintsServicePort {
  suggestExecutionNodeSelectionHints(input: {
    readonly asOf: string;
    readonly requirements?: ImageExecutionNodeCompatibilityRequirements;
    readonly candidateNodeIds?: ReadonlyArray<string>;
    readonly query?: ExecutionNodeListQuery;
    readonly limit?: number;
  }): Promise<ReadonlyArray<ExecutionNodeSelectionHint>>;
}

export interface ExecutionNodeManagementServicePorts {
  readonly healthRefresh: IExecutionNodeHealthRefreshServicePort;
  readonly capabilityRefresh: IExecutionNodeCapabilityRefreshServicePort;
  readonly eligibility: IExecutionNodeEligibilityEvaluationServicePort;
  readonly availability: IExecutionNodeAvailabilityManagementServicePort;
  readonly selectionHints: IExecutionNodeSelectionHintsServicePort;
  readonly runSelection?: IImageRunExecutionNodeSelectionServicePort;
}
