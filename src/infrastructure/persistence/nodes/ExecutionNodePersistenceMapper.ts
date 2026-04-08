import {
  createExecutionNodeRecord,
  type ExecutionNodeActivationStatus,
  type ExecutionNodeBackendFamilyCapability,
  type ExecutionNodeHealthStatus,
  type ExecutionNodeOperationalAvailabilityMode,
  type ExecutionNodeRecord,
} from "@domain/nodes/ExecutionNodeDomain";
import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  NodeTypes,
  createNodeCapabilityProfile,
  type NodeApprovalStatus,
  type NodeRoleCapability,
  type NodeTrustState,
  type NodeType,
} from "@domain/nodes/NodeTrustDomain";
import {
  normalizePersistenceLookup,
  normalizePersistenceLookupLowercase,
  parseOptionalPersistenceObjectJson,
} from "../common/PersistenceMapperUtilities";

export interface ExecutionNodeRow {
  readonly node_id: string;
  readonly display_name: string;
  readonly node_type: NodeType;
  readonly capability_enabled_json: string;
  readonly capability_profile_version: string | null;
  readonly supports_remote_scheduling: number;
  readonly max_concurrent_workloads: number | null;
  readonly backend_family_capabilities_json: string;
  readonly approval_status: NodeApprovalStatus;
  readonly trust_state: NodeTrustState;
  readonly activation_status: ExecutionNodeActivationStatus;
  readonly health_status: ExecutionNodeHealthStatus;
  readonly availability_override_mode: ExecutionNodeOperationalAvailabilityMode;
  readonly availability_override_suppressed_until: string | null;
  readonly availability_override_reason: string | null;
  readonly availability_override_updated_at: string;
  readonly deployment_tags_json: string;
  readonly endpoint_ref: string;
  readonly configuration_ref: string | null;
  readonly certificate_ref: string | null;
  readonly last_seen_at: string | null;
  readonly metadata_json: string;
  readonly created_at: string;
  readonly created_by: string;
  readonly last_modified_at: string;
  readonly last_modified_by: string;
  readonly revision: number;
}

export interface ExecutionNodeMutationReplayRow {
  readonly operation_key: string;
  readonly mutation_kind: string;
  readonly record_snapshot_json: string;
  readonly created_at: string;
}

export function normalizeExecutionNodeLookup(value: string): string | undefined {
  return normalizePersistenceLookup(value);
}

export function mapExecutionNodeRowToRecord(row: ExecutionNodeRow): ExecutionNodeRecord {
  const capabilityProfile = createNodeCapabilityProfile({
    enabledCapabilities: parseNodeRoleCapabilities(row.capability_enabled_json),
    capabilityProfileVersion: normalizePersistenceLookup(row.capability_profile_version),
    supportsRemoteScheduling: row.supports_remote_scheduling === 1,
    maxConcurrentWorkloads: row.max_concurrent_workloads ?? undefined,
  });

  const backendFamilyCapabilities = parseBackendFamilyCapabilities(row.backend_family_capabilities_json);
  const metadata = parseOptionalPersistenceObjectJson(row.metadata_json, "execution-node-metadata") ?? Object.freeze({});

  return createExecutionNodeRecord({
    nodeId: row.node_id,
    displayName: row.display_name,
    nodeType: assertNodeType(row.node_type),
    capabilityProfile,
    backendFamilyCapabilities,
    approvalStatus: assertNodeApprovalStatus(row.approval_status),
    trustState: assertNodeTrustState(row.trust_state),
    activationStatus: assertActivationStatus(row.activation_status),
    healthStatus: assertHealthStatus(row.health_status),
    availabilityOverride: {
      mode: assertOperationalAvailabilityMode(row.availability_override_mode),
      suppressedUntil: normalizePersistenceLookup(row.availability_override_suppressed_until),
      reason: normalizePersistenceLookup(row.availability_override_reason),
      updatedAt: row.availability_override_updated_at,
    },
    deploymentTags: parseStringArray(row.deployment_tags_json),
    endpoint: {
      endpointRef: row.endpoint_ref,
      configurationRef: normalizePersistenceLookup(row.configuration_ref),
    },
    certificateRef: normalizePersistenceLookup(row.certificate_ref),
    lastSeenAt: normalizePersistenceLookup(row.last_seen_at),
    metadata: normalizeMetadataRecord(metadata),
    createdAt: row.created_at,
    updatedAt: row.last_modified_at,
  });
}

export function mapExecutionNodeRecordToRowValues(input: {
  readonly record: ExecutionNodeRecord;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly lastModifiedAt: string;
  readonly lastModifiedBy: string;
  readonly revision: number;
}): ReadonlyArray<unknown> {
  return Object.freeze([
    input.record.nodeId,
    input.record.displayName,
    input.record.nodeType,
    JSON.stringify(input.record.capabilityProfile.enabledCapabilities),
    input.record.capabilityProfile.capabilityProfileVersion ?? null,
    input.record.capabilityProfile.supportsRemoteScheduling ? 1 : 0,
    input.record.capabilityProfile.maxConcurrentWorkloads ?? null,
    JSON.stringify(input.record.backendFamilyCapabilities),
    input.record.approvalStatus,
    input.record.trustState,
    input.record.activationStatus,
    input.record.healthStatus,
    input.record.availabilityOverride.mode,
    input.record.availabilityOverride.suppressedUntil ?? null,
    input.record.availabilityOverride.reason ?? null,
    input.record.availabilityOverride.updatedAt,
    JSON.stringify(input.record.deploymentTags),
    input.record.endpoint.endpointRef,
    input.record.endpoint.configurationRef ?? null,
    input.record.certificateRef ?? null,
    input.record.lastSeenAt ?? null,
    JSON.stringify(input.record.metadata),
    input.createdAt,
    input.createdBy,
    input.lastModifiedAt,
    input.lastModifiedBy,
    input.revision,
  ]);
}

export function parseExecutionNodeMutationReplayRecord(row: ExecutionNodeMutationReplayRow): ExecutionNodeRecord {
  try {
    const parsed = JSON.parse(row.record_snapshot_json) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Execution node mutation replay record is not an object.");
    }

    return createExecutionNodeRecord(parsed as Parameters<typeof createExecutionNodeRecord>[0]);
  } catch {
    throw new Error(`Execution node mutation replay snapshot for operation '${row.operation_key}' is malformed.`);
  }
}

export function toExecutionNodeBackendFamilies(record: ExecutionNodeRecord): ReadonlyArray<string> {
  const families = new Set<string>();
  for (const capability of record.backendFamilyCapabilities) {
    const normalized = normalizePersistenceLookupLowercase(capability.backendFamily);
    if (normalized) {
      families.add(normalized);
    }
  }
  return Object.freeze([...families.values()].sort((left, right) => left.localeCompare(right)));
}

export function toExecutionNodeExecutionTargets(record: ExecutionNodeRecord): ReadonlyArray<{
  readonly backendFamily: string;
  readonly executionTarget: string;
}> {
  const pairs = new Map<string, { backendFamily: string; executionTarget: string }>();
  for (const capability of record.backendFamilyCapabilities) {
    const backendFamily = normalizePersistenceLookupLowercase(capability.backendFamily);
    if (!backendFamily) {
      continue;
    }

    for (const targetValue of capability.supportedExecutionTargets) {
      const executionTarget = normalizePersistenceLookupLowercase(String(targetValue));
      if (!executionTarget) {
        continue;
      }
      const key = `${backendFamily}|${executionTarget}`;
      if (!pairs.has(key)) {
        pairs.set(key, Object.freeze({ backendFamily, executionTarget }));
      }
    }
  }

  return Object.freeze([...pairs.values()]);
}

export function toExecutionNodeAvailabilitySummary(record: ExecutionNodeRecord): string {
  if (record.activationStatus === "revoked" || record.trustState === NodeTrustStates.revoked) {
    return "revoked";
  }

  if (record.activationStatus === "active" && record.healthStatus === "ready") {
    return "routable";
  }

  if (record.activationStatus === "degraded" || record.healthStatus === "degraded") {
    return "degraded";
  }

  if (record.activationStatus === "unavailable" || record.healthStatus === "unavailable") {
    return "unavailable";
  }

  return "non-routable";
}

function parseStringArray(value: string): ReadonlyArray<string> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return Object.freeze([]);
    }

    const normalized = parsed
      .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
      .filter((entry, index, values) => entry.length > 0 && values.indexOf(entry) === index);
    return Object.freeze(normalized);
  } catch {
    return Object.freeze([]);
  }
}

function parseNodeRoleCapabilities(value: string): ReadonlyArray<NodeRoleCapability> {
  const parsed = parseStringArray(value);
  const mapped: NodeRoleCapability[] = [];
  for (const capability of parsed) {
    const resolved = normalizeNodeRoleCapability(capability);
    if (!resolved) {
      throw new Error(`Persisted execution node capability '${capability}' is invalid.`);
    }
    if (!mapped.includes(resolved)) {
      mapped.push(resolved);
    }
  }

  return Object.freeze(mapped);
}

function parseBackendFamilyCapabilities(value: string): ReadonlyArray<ExecutionNodeBackendFamilyCapability> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return Object.freeze([]);
    }

    return Object.freeze(parsed.filter((entry): entry is ExecutionNodeBackendFamilyCapability => (
      Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
    )));
  } catch {
    return Object.freeze([]);
  }
}

function normalizeNodeRoleCapability(value: string): NodeRoleCapability | undefined {
  if (Object.values(NodeRoleCapabilities).includes(value as NodeRoleCapability)) {
    return value as NodeRoleCapability;
  }

  switch (value) {
    case "workflow-execution":
    case "model-training":
      return NodeRoleCapabilities.executor;
    case "model-inference":
    case "mcp-tool-execution":
      return NodeRoleCapabilities.api;
    case "scheduling-participation":
      return NodeRoleCapabilities.scheduler;
    default:
      return undefined;
  }
}

function normalizeMetadataRecord(value: Readonly<Record<string, unknown>>): Readonly<Record<string, string>> {
  const entries: Array<readonly [string, string]> = [];
  for (const [key, rawValue] of Object.entries(value)) {
    if (typeof rawValue !== "string") {
      continue;
    }

    const normalizedKey = normalizePersistenceLookup(key);
    const normalizedValue = normalizePersistenceLookup(rawValue);
    if (normalizedKey && normalizedValue) {
      entries.push([normalizedKey, normalizedValue]);
    }
  }
  return Object.freeze(Object.fromEntries(entries));
}

function assertNodeType(value: string): NodeType {
  if (Object.values(NodeTypes).includes(value as NodeType)) {
    return value as NodeType;
  }
  throw new Error(`Persisted execution node type '${value}' is invalid.`);
}

function assertNodeApprovalStatus(value: string): NodeApprovalStatus {
  if (Object.values(NodeApprovalStatuses).includes(value as NodeApprovalStatus)) {
    return value as NodeApprovalStatus;
  }
  throw new Error(`Persisted execution node approval status '${value}' is invalid.`);
}

function assertNodeTrustState(value: string): NodeTrustState {
  if (Object.values(NodeTrustStates).includes(value as NodeTrustState)) {
    return value as NodeTrustState;
  }
  throw new Error(`Persisted execution node trust state '${value}' is invalid.`);
}

function assertActivationStatus(value: string): ExecutionNodeActivationStatus {
  const allowed: ExecutionNodeActivationStatus[] = [
    "inactive",
    "pending",
    "approved",
    "active",
    "degraded",
    "unavailable",
    "revoked",
  ];
  if (allowed.includes(value as ExecutionNodeActivationStatus)) {
    return value as ExecutionNodeActivationStatus;
  }

  throw new Error(`Persisted execution node activation status '${value}' is invalid.`);
}

function assertHealthStatus(value: string): ExecutionNodeHealthStatus {
  const allowed: ExecutionNodeHealthStatus[] = ["unknown", "ready", "degraded", "unavailable"];
  if (allowed.includes(value as ExecutionNodeHealthStatus)) {
    return value as ExecutionNodeHealthStatus;
  }

  throw new Error(`Persisted execution node health status '${value}' is invalid.`);
}

function assertOperationalAvailabilityMode(value: string): ExecutionNodeOperationalAvailabilityMode {
  const allowed: ExecutionNodeOperationalAvailabilityMode[] = ["enabled", "disabled", "suppressed"];
  if (allowed.includes(value as ExecutionNodeOperationalAvailabilityMode)) {
    return value as ExecutionNodeOperationalAvailabilityMode;
  }

  throw new Error(`Persisted execution node operational availability mode '${value}' is invalid.`);
}
