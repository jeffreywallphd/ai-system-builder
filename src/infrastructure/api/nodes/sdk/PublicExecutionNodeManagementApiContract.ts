import type {
  ExecutionNodeBackendAvailabilityReadRequestDto,
  ExecutionNodeBackendAvailabilityReadResponseDto,
  ExecutionNodeEligibilityCheckRequestDto,
  ExecutionNodeEligibilityCheckResponseDto,
  ExecutionNodeGetRequestDto,
  ExecutionNodeGetResponseDto,
  ExecutionNodeListRequestDto,
  ExecutionNodeListResponseDto,
  ExecutionNodeReadinessCheckRequestDto,
  ExecutionNodeReadinessCheckResponseDto,
  ExecutionNodeSetAvailabilityOverrideRequestDto,
  ExecutionNodeSetAvailabilityOverrideResponseDto,
} from "@shared/contracts/nodes/ExecutionNodeManagementApiContracts";

export const ExecutionNodeManagementApiErrorCodes = Object.freeze({
  invalidRequest: "invalid-request",
  authenticationFailed: "authentication-failed",
  forbidden: "forbidden",
  notFound: "not-found",
  conflict: "conflict",
  internal: "internal",
} as const);

export type ExecutionNodeManagementApiErrorCode =
  typeof ExecutionNodeManagementApiErrorCodes[keyof typeof ExecutionNodeManagementApiErrorCodes];

export interface ExecutionNodeManagementApiValidationError {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface ExecutionNodeManagementApiError {
  readonly code: ExecutionNodeManagementApiErrorCode;
  readonly message: string;
  readonly validationErrors?: ReadonlyArray<ExecutionNodeManagementApiValidationError>;
}

export interface ExecutionNodeManagementApiResponse<TData> {
  readonly ok: boolean;
  readonly data?: TData;
  readonly error?: ExecutionNodeManagementApiError;
}

export type ExecutionNodeListApiRequest = ExecutionNodeListRequestDto & {
  readonly actorUserIdentityId: string;
};

export type ExecutionNodeListApiResponse = ExecutionNodeListResponseDto;

export type ExecutionNodeGetApiRequest = ExecutionNodeGetRequestDto & {
  readonly actorUserIdentityId: string;
};

export type ExecutionNodeGetApiResponse = ExecutionNodeGetResponseDto;

export type ExecutionNodeSetAvailabilityOverrideApiRequest = ExecutionNodeSetAvailabilityOverrideRequestDto & {
  readonly actorUserIdentityId: string;
};

export type ExecutionNodeSetAvailabilityOverrideApiResponse = ExecutionNodeSetAvailabilityOverrideResponseDto;

export type ExecutionNodeReadinessCheckApiRequest = ExecutionNodeReadinessCheckRequestDto & {
  readonly actorUserIdentityId: string;
};

export type ExecutionNodeReadinessCheckApiResponse = ExecutionNodeReadinessCheckResponseDto;

export type ExecutionNodeEligibilityCheckApiRequest = ExecutionNodeEligibilityCheckRequestDto & {
  readonly actorUserIdentityId: string;
};

export type ExecutionNodeEligibilityCheckApiResponse = ExecutionNodeEligibilityCheckResponseDto;

export type ExecutionNodeBackendAvailabilityReadApiRequest = ExecutionNodeBackendAvailabilityReadRequestDto & {
  readonly actorUserIdentityId: string;
};

export type ExecutionNodeBackendAvailabilityReadApiResponse = ExecutionNodeBackendAvailabilityReadResponseDto;
