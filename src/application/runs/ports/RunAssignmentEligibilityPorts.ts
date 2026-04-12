import type { PlatformRunRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import type { NodeRoleCapability } from "@domain/nodes/NodeTrustDomain";
import type { NodeIdentityPersistenceRecord } from "@shared/dto/nodes/NodeTrustPersistenceDtos";
import type { AuthoritativeRunQueueEntryRecord } from "./RunOrchestrationPersistencePorts";
import type {
  RunSubmissionResourceReference,
  RunSubmissionSecurityPrerequisite,
  RunSubmissionStorageReference,
} from "./RunSubmissionValidationPorts";

export const RunAssignmentIneligibilityCodes = Object.freeze({
  requirementsUnavailable: "requirements-unavailable",
  nodeNotFound: "node-not-found",
  nodeNotApproved: "node-not-approved",
  nodeNotTrusted: "node-not-trusted",
  nodeRevoked: "node-revoked",
  nodeMissingCertificate: "node-missing-certificate",
  nodeMissingCapability: "node-missing-capability",
  remoteSchedulingUnsupported: "remote-scheduling-unsupported",
  policyDenied: "policy-denied",
});

export type RunAssignmentIneligibilityCode =
  typeof RunAssignmentIneligibilityCodes[keyof typeof RunAssignmentIneligibilityCodes];

export interface RunAssignmentIneligibilityReason {
  readonly code: RunAssignmentIneligibilityCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface RunAssignmentExecutionCharacteristics {
  readonly systemId: string;
  readonly versionId: string;
  readonly async: boolean;
}

export interface RunAssignmentRequirementSet {
  readonly workspaceId?: string;
  readonly execution: RunAssignmentExecutionCharacteristics;
  readonly requiredCapabilities: ReadonlyArray<NodeRoleCapability>;
  readonly requiresRemoteScheduling: boolean;
  readonly storageReferences: ReadonlyArray<RunSubmissionStorageReference>;
  readonly resourceReferences: ReadonlyArray<RunSubmissionResourceReference>;
  readonly policyPrerequisites: ReadonlyArray<RunSubmissionSecurityPrerequisite>;
}

export interface RunAssignmentEligibilityDecision {
  readonly eligible: boolean;
  readonly nodeId: string;
  readonly requirements?: RunAssignmentRequirementSet;
  readonly reasons: ReadonlyArray<RunAssignmentIneligibilityReason>;
}

export interface IRunAssignmentNodeCatalogPort {
  findNodeById(nodeId: string): Promise<NodeIdentityPersistenceRecord | undefined>;
}

export interface RunAssignmentPolicyEvaluationResult {
  readonly allowed: boolean;
  readonly reasons?: ReadonlyArray<RunAssignmentIneligibilityReason>;
}

export interface IRunAssignmentPolicyPort {
  evaluateNodeAssignmentPreconditions(input: {
    readonly asOf: string;
    readonly run: PlatformRunRecord;
    readonly queueEntry: AuthoritativeRunQueueEntryRecord;
    readonly node: NodeIdentityPersistenceRecord;
    readonly requirements: RunAssignmentRequirementSet;
  }): Promise<RunAssignmentPolicyEvaluationResult>;
}

export interface IRunNodeAssignmentEligibilityService {
  evaluateNodeEligibility(input: {
    readonly asOf: string;
    readonly run: PlatformRunRecord;
    readonly queueEntry: AuthoritativeRunQueueEntryRecord;
    readonly nodeId: string;
  }): Promise<RunAssignmentEligibilityDecision>;
}

