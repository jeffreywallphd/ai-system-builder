import { ExecutionNodeDomainError, type ExecutionNodeRecord } from "@domain/nodes/ExecutionNodeDomain";
import type {
  ExecutionNodeBackendCapabilitySummaryDto,
  ExecutionNodeHealthSummaryDto,
  ExecutionNodeInternalDetailDto,
  ExecutionNodeInternalSummaryDto,
  ExecutionNodeOperationalSummaryDto,
} from "@shared/contracts/nodes/ExecutionNodeManagementApiContracts";
import type { ExecutionNodeMutationContext } from "../ports/ExecutionNodeManagementPorts";

export const ExecutionNodeManagementUseCaseErrorCodes = Object.freeze({
  invalidRequest: "execution-node-invalid-request",
  forbidden: "execution-node-forbidden",
  notFound: "execution-node-not-found",
  conflict: "execution-node-conflict",
  invalidState: "execution-node-invalid-state",
});

export type ExecutionNodeManagementUseCaseErrorCode =
  typeof ExecutionNodeManagementUseCaseErrorCodes[keyof typeof ExecutionNodeManagementUseCaseErrorCodes];

export interface ExecutionNodeManagementUseCaseError {
  readonly code: ExecutionNodeManagementUseCaseErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export type ExecutionNodeManagementUseCaseOutcome<TValue> =
  | {
    readonly ok: true;
    readonly value: TValue;
  }
  | {
    readonly ok: false;
    readonly error: ExecutionNodeManagementUseCaseError;
  };

export interface ExecutionNodeManagementUseCaseClock {
  now(): Date;
}

export interface ExecutionNodeManagementUseCaseIdGenerator {
  nextId(namespace: string): string;
}

export const ExecutionNodeManagementUseCaseIdNamespaces = Object.freeze({
  mutationOperation: "execution-node-mutation",
});

export class DefaultExecutionNodeManagementUseCaseIdGenerator implements ExecutionNodeManagementUseCaseIdGenerator {
  public nextId(namespace: string): string {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return `${namespace}:${globalThis.crypto.randomUUID()}`;
    }

    return `${namespace}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
  }
}

export function toExecutionNodeManagementFailure<TValue>(
  code: ExecutionNodeManagementUseCaseErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): ExecutionNodeManagementUseCaseOutcome<TValue> {
  return {
    ok: false,
    error: Object.freeze({
      code,
      message,
      details,
    }),
  };
}

export function normalizeRequired(value: string): string | undefined {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : undefined;
}

export function normalizeTimestamp(value: string, fieldName: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} is required.`);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

export function createExecutionNodeMutationContext(input: {
  readonly actorUserIdentityId: string;
  readonly operationPrefix: string;
  readonly idGenerator: ExecutionNodeManagementUseCaseIdGenerator;
  readonly clock: ExecutionNodeManagementUseCaseClock;
  readonly expectedRevision?: number;
  readonly reason?: string;
  readonly correlationId?: string;
}): ExecutionNodeMutationContext {
  return Object.freeze({
    operationKey: `${input.operationPrefix}:${input.idGenerator.nextId(ExecutionNodeManagementUseCaseIdNamespaces.mutationOperation)}`,
    actorId: input.actorUserIdentityId,
    occurredAt: input.clock.now().toISOString(),
    expectedRevision: input.expectedRevision,
    reason: normalizeOptional(input.reason),
    correlationId: normalizeOptional(input.correlationId),
  });
}

export function mapExecutionNodeDomainError<TValue>(
  error: unknown,
  fallbackMessage: string,
): ExecutionNodeManagementUseCaseOutcome<TValue> | undefined {
  if (!(error instanceof ExecutionNodeDomainError)) {
    return undefined;
  }

  return toExecutionNodeManagementFailure(
    ExecutionNodeManagementUseCaseErrorCodes.invalidRequest,
    error.message || fallbackMessage,
  );
}

function toHealthSummary(record: ExecutionNodeRecord): ExecutionNodeHealthSummaryDto {
  return Object.freeze({
    activationStatus: record.activationStatus,
    healthStatus: record.healthStatus,
    lastSeenAt: record.lastSeenAt,
    stale: false,
  });
}

function toOperationalSummary(record: ExecutionNodeRecord): ExecutionNodeOperationalSummaryDto {
  return Object.freeze({
    approvalStatus: record.approvalStatus,
    trustState: record.trustState,
    enabledCapabilities: Object.freeze([...record.capabilityProfile.enabledCapabilities]),
    supportsRemoteScheduling: record.capabilityProfile.supportsRemoteScheduling,
    maxConcurrentWorkloads: record.capabilityProfile.maxConcurrentWorkloads,
    deploymentTags: Object.freeze([...record.deploymentTags]),
    certificateAssigned: Boolean(record.certificateRef),
  });
}

export function toExecutionNodeInternalSummary(record: ExecutionNodeRecord): ExecutionNodeInternalSummaryDto {
  return Object.freeze({
    nodeId: record.nodeId,
    displayName: record.displayName,
    nodeType: record.nodeType,
    health: toHealthSummary(record),
    operational: toOperationalSummary(record),
    backendFamilies: Object.freeze(record.backendFamilyCapabilities.map((capability) => capability.backendFamily)),
    endpointRef: record.endpoint.endpointRef,
    configurationRef: record.endpoint.configurationRef,
    certificateRef: record.certificateRef,
  });
}

function toBackendCapabilitySummary(
  record: ExecutionNodeRecord,
): ReadonlyArray<ExecutionNodeBackendCapabilitySummaryDto> {
  return Object.freeze(record.backendFamilyCapabilities.map((capability) => Object.freeze({
    backendFamily: capability.backendFamily,
    supportedExecutionTargets: Object.freeze([...capability.supportedExecutionTargets]),
    supportedOperationKinds: Object.freeze([...(capability.supportedOperationKinds ?? [])]),
    supportedOperationCapabilities: Object.freeze([...(capability.supportedOperationCapabilities ?? [])]),
    supportedInputKinds: Object.freeze([...(capability.supportedInputKinds ?? [])]),
    supportedOutputKinds: Object.freeze([...(capability.supportedOutputKinds ?? [])]),
    supportedTranslationContractVersions: Object.freeze([...(capability.supportedTranslationContractVersions ?? [])]),
    resourceClassHints: Object.freeze([...(capability.resourceClassHints ?? [])]),
    capabilityProfileVersion: capability.capabilityProfileVersion,
    metadataTags: Object.freeze([...(capability.metadataTags ?? [])]),
    readiness: Object.freeze({
      state: capability.executionReadiness?.state ?? "unknown",
      checkedAt: capability.executionReadiness?.checkedAt,
      summary: capability.executionReadiness?.summary,
    }),
  })));
}

export function toExecutionNodeInternalDetail(record: ExecutionNodeRecord): ExecutionNodeInternalDetailDto {
  return Object.freeze({
    ...toExecutionNodeInternalSummary(record),
    backendCapabilities: toBackendCapabilitySummary(record),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    endpointRef: record.endpoint.endpointRef,
    configurationRef: record.endpoint.configurationRef,
    certificateRef: record.certificateRef,
  });
}
