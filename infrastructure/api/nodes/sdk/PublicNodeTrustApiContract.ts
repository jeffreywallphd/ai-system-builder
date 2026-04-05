import type {
  ApproveNodeEnrollmentActionRequestDto,
  NodeDetailDto,
  NodeEnrollmentDecisionResponseDto,
  NodeEnrollmentDetailDto,
  NodeEnrollmentSubmissionRequestDto,
  NodeEnrollmentSubmissionResponseDto,
  NodeHeartbeatPayloadDto,
  NodeHeartbeatResponseDto,
  NodePendingEnrollmentSummaryDto,
  RejectNodeEnrollmentActionRequestDto,
} from "../../../../src/shared/contracts/nodes/NodeTrustApiContracts";
import {
  NodeEnrollmentRequestStatuses,
  type NodeRoleCapability,
  type NodeType,
} from "../../../../src/domain/nodes/NodeTrustDomain";

export const NodeTrustApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  internal: "internal",
} as const);

export type NodeTrustApiErrorCode =
  typeof NodeTrustApiErrorCodes[keyof typeof NodeTrustApiErrorCodes];

export interface NodeTrustApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface NodeTrustApiError {
  readonly code: NodeTrustApiErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<NodeTrustApiValidationError>;
}

export interface NodeTrustApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: NodeTrustApiError;
}

export type SubmitNodeEnrollmentApiRequest = NodeEnrollmentSubmissionRequestDto;

export type SubmitNodeEnrollmentApiResponse = NodeEnrollmentSubmissionResponseDto;

export interface ListPendingNodeEnrollmentsApiRequest {
  readonly actorUserIdentityId: string;
  readonly nodeId?: string;
  readonly statuses?: ReadonlyArray<
    typeof NodeEnrollmentRequestStatuses.submitted
    | typeof NodeEnrollmentRequestStatuses.underReview
  >;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListPendingNodeEnrollmentsApiResponse {
  readonly enrollments: ReadonlyArray<NodePendingEnrollmentSummaryDto>;
}

export interface GetNodeEnrollmentDetailApiRequest {
  readonly actorUserIdentityId: string;
  readonly requestId: string;
}

export interface GetNodeEnrollmentDetailApiResponse {
  readonly enrollment: NodeEnrollmentDetailDto;
}

export type ApproveNodeEnrollmentApiRequest = ApproveNodeEnrollmentActionRequestDto;

export type ApproveNodeEnrollmentApiResponse = NodeEnrollmentDecisionResponseDto;

export type RejectNodeEnrollmentApiRequest = RejectNodeEnrollmentActionRequestDto;

export type RejectNodeEnrollmentApiResponse = NodeEnrollmentDecisionResponseDto;

export type RecordNodeHeartbeatApiRequest = NodeHeartbeatPayloadDto;

export type RecordNodeHeartbeatApiResponse = NodeHeartbeatResponseDto;

export interface ListTrustedNodeInventoryApiRequest {
  readonly actorUserIdentityId: string;
  readonly nodeTypes?: ReadonlyArray<NodeType>;
  readonly capabilityAnyOf?: ReadonlyArray<NodeRoleCapability>;
  readonly deploymentTagAnyOf?: ReadonlyArray<string>;
  readonly lastSeenAfter?: string;
  readonly lastSeenBefore?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListTrustedNodeInventoryApiResponse {
  readonly nodes: ReadonlyArray<NodeDetailDto>;
}
