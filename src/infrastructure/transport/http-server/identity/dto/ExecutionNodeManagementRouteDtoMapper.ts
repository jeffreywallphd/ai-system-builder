import type { URLSearchParams } from "node:url";

interface ExecutionNodeQueryParsingPrimitives {
  readonly parseOptionalStringList: (
    searchParams: URLSearchParams,
    singularKey: string,
    pluralKey: string,
  ) => ReadonlyArray<string> | undefined;
  readonly parseOptionalBoolean: (value: string | null | undefined) => boolean | undefined;
  readonly parseOptionalInteger: (value: string | null | undefined) => number | undefined;
  readonly normalizeOptionalString: (value: string | null | undefined) => string | undefined;
}

export function buildExecutionNodeListRequestPayload(
  searchParams: URLSearchParams,
  primitives: ExecutionNodeQueryParsingPrimitives,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    nodeIds: primitives.parseOptionalStringList(searchParams, "nodeId", "nodeIds"),
    nodeTypes: primitives.parseOptionalStringList(searchParams, "nodeType", "nodeTypes"),
    approvalStatuses: primitives.parseOptionalStringList(searchParams, "approvalStatus", "approvalStatuses"),
    trustStates: primitives.parseOptionalStringList(searchParams, "trustState", "trustStates"),
    activationStatuses: primitives.parseOptionalStringList(searchParams, "activationStatus", "activationStatuses"),
    healthStatuses: primitives.parseOptionalStringList(searchParams, "healthStatus", "healthStatuses"),
    operationalAvailabilityModes: primitives.parseOptionalStringList(
      searchParams,
      "operationalAvailabilityMode",
      "operationalAvailabilityModes",
    ),
    backendFamilies: primitives.parseOptionalStringList(searchParams, "backendFamily", "backendFamilies"),
    executionTargets: primitives.parseOptionalStringList(searchParams, "executionTarget", "executionTargets"),
    requiredCapabilitiesAnyOf: primitives.parseOptionalStringList(
      searchParams,
      "requiredCapability",
      "requiredCapabilitiesAnyOf",
    ),
    supportsRemoteScheduling: primitives.parseOptionalBoolean(searchParams.get("supportsRemoteScheduling")),
    deploymentTagAnyOf: primitives.parseOptionalStringList(searchParams, "deploymentTag", "deploymentTagAnyOf"),
    includeRevoked: primitives.parseOptionalBoolean(searchParams.get("includeRevoked")),
    lastSeenAfter: primitives.normalizeOptionalString(searchParams.get("lastSeenAfter")),
    lastSeenBefore: primitives.normalizeOptionalString(searchParams.get("lastSeenBefore")),
    limit: primitives.parseOptionalInteger(searchParams.get("limit")),
    offset: primitives.parseOptionalInteger(searchParams.get("offset")),
  });
}

export function buildExecutionNodeReadinessRequestPayload(
  searchParams: URLSearchParams,
  primitives: ExecutionNodeQueryParsingPrimitives,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    workspaceId: primitives.normalizeOptionalString(searchParams.get("workspaceId")),
    workflowId: primitives.normalizeOptionalString(searchParams.get("workflowId")),
    runId: primitives.normalizeOptionalString(searchParams.get("runId")),
    candidateNodeIds: primitives.parseOptionalStringList(searchParams, "candidateNodeId", "candidateNodeIds"),
    requiredBackendFamilies: primitives.parseOptionalStringList(
      searchParams,
      "requiredBackendFamily",
      "requiredBackendFamilies",
    ),
    requiredExecutionTarget: primitives.normalizeOptionalString(searchParams.get("requiredExecutionTarget")),
    requiredNodeCapabilities: primitives.parseOptionalStringList(
      searchParams,
      "requiredNodeCapability",
      "requiredNodeCapabilities",
    ),
    requiresRemoteScheduling: primitives.parseOptionalBoolean(searchParams.get("requiresRemoteScheduling")),
    requiredOperationKind: primitives.normalizeOptionalString(searchParams.get("requiredOperationKind")),
    requiredOperationCapability: primitives.normalizeOptionalString(searchParams.get("requiredOperationCapability")),
    requiredInputKinds: primitives.parseOptionalStringList(searchParams, "requiredInputKind", "requiredInputKinds"),
    requiredOutputKinds: primitives.parseOptionalStringList(searchParams, "requiredOutputKind", "requiredOutputKinds"),
    requiredTranslationContractVersion: primitives.normalizeOptionalString(
      searchParams.get("requiredTranslationContractVersion"),
    ),
    preferredResourceClassHints: primitives.parseOptionalStringList(
      searchParams,
      "preferredResourceClassHint",
      "preferredResourceClassHints",
    ),
    allowDegraded: primitives.parseOptionalBoolean(searchParams.get("allowDegraded")),
    maxLastSeenAgeMs: primitives.parseOptionalInteger(searchParams.get("maxLastSeenAgeMs")),
    now: primitives.normalizeOptionalString(searchParams.get("now")),
  });
}

export function buildExecutionNodeBackendAvailabilityRequestPayload(
  searchParams: URLSearchParams,
  primitives: ExecutionNodeQueryParsingPrimitives,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    backendFamilies: primitives.parseOptionalStringList(searchParams, "backendFamily", "backendFamilies"),
    executionTarget: primitives.normalizeOptionalString(searchParams.get("executionTarget")),
    includeUnavailable: primitives.parseOptionalBoolean(searchParams.get("includeUnavailable")),
  });
}

export function toExecutionNodeActorScopedApiRequest(
  actorUserIdentityId: string,
  parsedRequest: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    actorUserIdentityId,
    ...parsedRequest,
  });
}

export function toExecutionNodeGetApiRequest(
  actorUserIdentityId: string,
  nodeId: string,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    actorUserIdentityId,
    nodeId,
  });
}

