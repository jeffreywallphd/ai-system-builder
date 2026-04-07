import type { RunSubmissionRequest } from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import type { AuthorizationActorReference } from "@application/authorization/contracts/AuthorizationPolicyEvaluationContracts";
import type {
  RunSubmissionResourceReference,
  RunSubmissionSecurityPrerequisite,
  RunSubmissionStorageReference,
} from "@application/runs/ports/RunSubmissionValidationPorts";

export const RunSubmissionValidationErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  forbidden: "forbidden",
  notFound: "not-found",
  policyIneligible: "policy-ineligible",
});

export type RunSubmissionValidationErrorCode =
  typeof RunSubmissionValidationErrorCodes[keyof typeof RunSubmissionValidationErrorCodes];

export const RunSubmissionValidationIssueKinds = Object.freeze({
  structural: "structural",
  authorization: "authorization",
  policy: "policy",
  availability: "availability",
});

export type RunSubmissionValidationIssueKind =
  typeof RunSubmissionValidationIssueKinds[keyof typeof RunSubmissionValidationIssueKinds];

export interface RunSubmissionValidationIssue {
  readonly kind: RunSubmissionValidationIssueKind;
  readonly path: string;
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ValidateRunSubmissionRequest {
  readonly actor: AuthorizationActorReference;
  readonly submission: RunSubmissionRequest & {
    readonly templateId?: string;
    readonly parameters?: Readonly<Record<string, unknown>>;
    readonly storageReferences?: ReadonlyArray<RunSubmissionStorageReference>;
    readonly resourceReferences?: ReadonlyArray<RunSubmissionResourceReference>;
    readonly policyPrerequisites?: ReadonlyArray<RunSubmissionSecurityPrerequisite>;
  };
  readonly occurredAt?: string;
}

export interface CanonicalRunSubmissionCommand {
  readonly actor: {
    readonly actorUserIdentityId?: string;
    readonly actorServiceId?: string;
    readonly activeWorkspaceId?: string;
  };
  readonly workspaceId: string;
  readonly workflowId?: string;
  readonly templateId?: string;
  readonly source: RunSubmissionRequest["source"];
  readonly runtimeTarget: {
    readonly systemId: string;
    readonly versionId: string;
    readonly executionId?: string;
    readonly tenantId?: string;
    readonly async: boolean;
  };
  readonly tags: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly storageReferences: ReadonlyArray<RunSubmissionStorageReference>;
  readonly resourceReferences: ReadonlyArray<RunSubmissionResourceReference>;
  readonly policyPrerequisites: ReadonlyArray<RunSubmissionSecurityPrerequisite>;
  readonly submissionContext: {
    readonly submittedByActorId?: string;
    readonly clientRequestId?: string;
    readonly correlationId?: string;
    readonly idempotencyKey?: string;
  };
  readonly occurredAt: string;
}

export interface ValidateRunSubmissionSuccess {
  readonly ok: true;
  readonly command: CanonicalRunSubmissionCommand;
}

export interface ValidateRunSubmissionFailure {
  readonly ok: false;
  readonly error: {
    readonly code: RunSubmissionValidationErrorCode;
    readonly message: string;
    readonly validationIssues: ReadonlyArray<RunSubmissionValidationIssue>;
  };
}

export type ValidateRunSubmissionResult =
  | ValidateRunSubmissionSuccess
  | ValidateRunSubmissionFailure;
