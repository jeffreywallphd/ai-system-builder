import type {
  ExecutionNodeBackendAvailabilityReadResponseDto,
  ExecutionNodeBackendInternalAvailabilitySummaryDto,
  ExecutionNodeDetailDto,
  ExecutionNodeEligibilityCheckResponseDto,
  ExecutionNodeGetResponseDto,
  ExecutionNodeInternalDetailDto,
  ExecutionNodeInternalSummaryDto,
  ExecutionNodeListResponseDto,
  ExecutionNodeReadinessCheckResponseDto,
  ExecutionNodeSetAvailabilityOverrideResponseDto,
  ExecutionNodeSummaryDto,
} from "@shared/contracts/nodes/ExecutionNodeManagementApiContracts";
import {
  toExecutionNodeBackendAvailabilitySummaryDto,
  toExecutionNodeDetailDto,
  toExecutionNodeSummaryDto,
} from "@shared/contracts/nodes/ExecutionNodeManagementApiContracts";

export function toExecutionNodeListResponseDto(input: {
  readonly contractVersion: ExecutionNodeListResponseDto["contractVersion"];
  readonly items: ReadonlyArray<ExecutionNodeSummaryDto>;
  readonly totalCount: number;
  readonly asOf: string;
}): ExecutionNodeListResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    items: Object.freeze([...input.items]),
    totalCount: input.totalCount,
    asOf: input.asOf,
  });
}

export function toExecutionNodeListResponseFromInternalDto(input: {
  readonly contractVersion: ExecutionNodeListResponseDto["contractVersion"];
  readonly items: ReadonlyArray<ExecutionNodeInternalSummaryDto>;
  readonly totalCount: number;
  readonly asOf: string;
}): ExecutionNodeListResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    items: Object.freeze(input.items.map((item) => toExecutionNodeSummaryDto(item))),
    totalCount: input.totalCount,
    asOf: input.asOf,
  });
}

export function toExecutionNodeGetResponseDto(input: {
  readonly contractVersion: ExecutionNodeGetResponseDto["contractVersion"];
  readonly node: ExecutionNodeDetailDto;
  readonly asOf: string;
}): ExecutionNodeGetResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    node: input.node,
    asOf: input.asOf,
  });
}

export function toExecutionNodeGetResponseFromInternalDto(input: {
  readonly contractVersion: ExecutionNodeGetResponseDto["contractVersion"];
  readonly node: ExecutionNodeInternalDetailDto;
  readonly asOf: string;
}): ExecutionNodeGetResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    node: toExecutionNodeDetailDto(input.node),
    asOf: input.asOf,
  });
}

export function toExecutionNodeSetAvailabilityOverrideResponseDto(input: {
  readonly contractVersion: ExecutionNodeSetAvailabilityOverrideResponseDto["contractVersion"];
  readonly node: ExecutionNodeSummaryDto;
  readonly mutation: ExecutionNodeSetAvailabilityOverrideResponseDto["mutation"];
  readonly asOf: string;
}): ExecutionNodeSetAvailabilityOverrideResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    node: input.node,
    mutation: Object.freeze({
      changed: input.mutation.changed,
      wasReplay: input.mutation.wasReplay,
    }),
    asOf: input.asOf,
  });
}

export function toExecutionNodeSetAvailabilityOverrideResponseFromInternalDto(input: {
  readonly contractVersion: ExecutionNodeSetAvailabilityOverrideResponseDto["contractVersion"];
  readonly node: ExecutionNodeInternalSummaryDto;
  readonly mutation: ExecutionNodeSetAvailabilityOverrideResponseDto["mutation"];
  readonly asOf: string;
}): ExecutionNodeSetAvailabilityOverrideResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    node: toExecutionNodeSummaryDto(input.node),
    mutation: Object.freeze({
      changed: input.mutation.changed,
      wasReplay: input.mutation.wasReplay,
    }),
    asOf: input.asOf,
  });
}

export function toExecutionNodeReadinessCheckResponseDto(
  input: ExecutionNodeReadinessCheckResponseDto,
): ExecutionNodeReadinessCheckResponseDto {
  return Object.freeze({
    ...input,
    nodeResults: Object.freeze([...input.nodeResults]),
    issues: Object.freeze([...input.issues]),
  });
}

export function toExecutionNodeEligibilityCheckResponseDto(
  input: ExecutionNodeEligibilityCheckResponseDto,
): ExecutionNodeEligibilityCheckResponseDto {
  return Object.freeze({
    ...input,
    evaluations: Object.freeze([...input.evaluations]),
  });
}

export function toExecutionNodeBackendAvailabilityReadResponseDto(input: {
  readonly contractVersion: ExecutionNodeBackendAvailabilityReadResponseDto["contractVersion"];
  readonly asOf: string;
  readonly backends: ReadonlyArray<ExecutionNodeBackendAvailabilityReadResponseDto["backends"][number]>;
}): ExecutionNodeBackendAvailabilityReadResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    asOf: input.asOf,
    backends: Object.freeze([...input.backends]),
  });
}

export function toExecutionNodeBackendAvailabilityReadResponseFromInternalDto(input: {
  readonly contractVersion: ExecutionNodeBackendAvailabilityReadResponseDto["contractVersion"];
  readonly asOf: string;
  readonly backends: ReadonlyArray<ExecutionNodeBackendInternalAvailabilitySummaryDto>;
}): ExecutionNodeBackendAvailabilityReadResponseDto {
  return Object.freeze({
    contractVersion: input.contractVersion,
    asOf: input.asOf,
    backends: Object.freeze(input.backends.map((entry) => toExecutionNodeBackendAvailabilitySummaryDto(entry))),
  });
}
