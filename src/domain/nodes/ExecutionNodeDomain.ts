import {
  NodeApprovalStatuses,
  NodeRoleCapabilities,
  NodeTrustStates,
  createNodeCapabilityProfile,
  type NodeApprovalStatus,
  type NodeCapabilityProfile,
  type NodeRoleCapability,
  type NodeTrustState,
  type NodeType,
} from "./NodeTrustDomain";
import type {
  ImageWorkflowInputSlotKind,
  ImageWorkflowOperationKind,
  ImageWorkflowOutputKind,
} from "../image-workflows/ImageWorkflowDomain";

export class ExecutionNodeDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutionNodeDomainError";
  }
}

export class ExecutionNodeActivationTransitionError extends ExecutionNodeDomainError {
  constructor(from: ExecutionNodeActivationStatus, to: ExecutionNodeActivationStatus) {
    super(`Execution node activation lifecycle cannot transition from '${from}' to '${to}'.`);
    this.name = "ExecutionNodeActivationTransitionError";
  }
}

export const ExecutionNodeActivationStatuses = Object.freeze({
  inactive: "inactive",
  pending: "pending",
  approved: "approved",
  active: "active",
  degraded: "degraded",
  unavailable: "unavailable",
  revoked: "revoked",
});

export type ExecutionNodeActivationStatus =
  typeof ExecutionNodeActivationStatuses[keyof typeof ExecutionNodeActivationStatuses];

export const ExecutionNodeHealthStatuses = Object.freeze({
  unknown: "unknown",
  ready: "ready",
  degraded: "degraded",
  unavailable: "unavailable",
});

export type ExecutionNodeHealthStatus =
  typeof ExecutionNodeHealthStatuses[keyof typeof ExecutionNodeHealthStatuses];

export const ExecutionNodeTargetKinds = Object.freeze({
  imageManipulation: "image-manipulation",
});

export type ExecutionNodeTargetKind =
  typeof ExecutionNodeTargetKinds[keyof typeof ExecutionNodeTargetKinds];

export const ExecutionNodeResourceClassHints = Object.freeze({
  cpuStandard: "cpu-standard",
  gpuGeneral: "gpu-general",
  gpuHighMemory: "gpu-high-memory",
  gpuHighThroughput: "gpu-high-throughput",
});

export type ExecutionNodeResourceClassHint =
  typeof ExecutionNodeResourceClassHints[keyof typeof ExecutionNodeResourceClassHints] | (string & {});

export const ExecutionNodeBackendReadinessStates = Object.freeze({
  ready: "ready",
  degraded: "degraded",
  unavailable: "unavailable",
  unknown: "unknown",
});

export type ExecutionNodeBackendReadinessState =
  typeof ExecutionNodeBackendReadinessStates[keyof typeof ExecutionNodeBackendReadinessStates];

export interface ExecutionNodeBackendReadinessProfile {
  readonly state: ExecutionNodeBackendReadinessState;
  readonly checkedAt?: string;
  readonly summary?: string;
}

export interface ExecutionNodeEndpointReference {
  readonly endpointRef: string;
  readonly configurationRef?: string;
}

export interface ExecutionNodeBackendFamilyCapability {
  readonly backendFamily: string;
  readonly supportedExecutionTargets: ReadonlyArray<ExecutionNodeTargetKind | string>;
  readonly supportedOperationKinds?: ReadonlyArray<ImageWorkflowOperationKind | string>;
  readonly supportedOperationCapabilities?: ReadonlyArray<string>;
  readonly supportedInputKinds?: ReadonlyArray<ImageWorkflowInputSlotKind | string>;
  readonly supportedOutputKinds?: ReadonlyArray<ImageWorkflowOutputKind | string>;
  readonly supportedTranslationContractVersions?: ReadonlyArray<string>;
  readonly resourceClassHints?: ReadonlyArray<ExecutionNodeResourceClassHint | string>;
  readonly executionReadiness?: ExecutionNodeBackendReadinessProfile;
  readonly capabilityProfileVersion?: string;
  readonly metadataTags?: ReadonlyArray<string>;
}

export interface ExecutionNodeRecord {
  readonly nodeId: string;
  readonly displayName: string;
  readonly nodeType: NodeType;
  readonly capabilityProfile: NodeCapabilityProfile;
  readonly backendFamilyCapabilities: ReadonlyArray<ExecutionNodeBackendFamilyCapability>;
  readonly approvalStatus: NodeApprovalStatus;
  readonly trustState: NodeTrustState;
  readonly activationStatus: ExecutionNodeActivationStatus;
  readonly healthStatus: ExecutionNodeHealthStatus;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly endpoint: ExecutionNodeEndpointReference;
  readonly certificateRef?: string;
  readonly lastSeenAt?: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ImageExecutionEligibilityResult {
  readonly isEligible: boolean;
  readonly reasons: ReadonlyArray<string>;
  readonly matchedBackendFamily?: string;
  readonly matchedExecutionTarget?: string;
}

export const ImageExecutionNodeCompatibilityFindingKinds = Object.freeze({
  hardIncompatibility: "hard-incompatibility",
  softAdvisory: "soft-advisory",
  transientAvailability: "transient-availability",
});

export type ImageExecutionNodeCompatibilityFindingKind =
  typeof ImageExecutionNodeCompatibilityFindingKinds[keyof typeof ImageExecutionNodeCompatibilityFindingKinds];

export interface ImageExecutionNodeCompatibilityFinding {
  readonly code: string;
  readonly kind: ImageExecutionNodeCompatibilityFindingKind;
  readonly message: string;
  readonly blocking: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ImageExecutionNodeCompatibilityRequirements {
  readonly requiredBackendFamilies?: ReadonlyArray<string>;
  readonly requiredExecutionTarget?: ExecutionNodeTargetKind | string;
  readonly requiredNodeCapabilities?: ReadonlyArray<NodeRoleCapability>;
  readonly requiresRemoteScheduling?: boolean;
  readonly requiredOperationKind?: ImageWorkflowOperationKind | string;
  readonly requiredOperationCapability?: string;
  readonly requiredInputKinds?: ReadonlyArray<ImageWorkflowInputSlotKind | string>;
  readonly requiredOutputKinds?: ReadonlyArray<ImageWorkflowOutputKind | string>;
  readonly requiredTranslationContractVersion?: string;
  readonly preferredResourceClassHints?: ReadonlyArray<ExecutionNodeResourceClassHint | string>;
  readonly allowDegraded?: boolean;
  readonly maxLastSeenAgeMs?: number;
  readonly now?: Date | string;
}

export interface ImageExecutionNodeCompatibilityResult {
  readonly compatible: boolean;
  readonly routable: boolean;
  readonly findings: ReadonlyArray<ImageExecutionNodeCompatibilityFinding>;
  readonly hardIncompatibilities: ReadonlyArray<ImageExecutionNodeCompatibilityFinding>;
  readonly softAdvisories: ReadonlyArray<ImageExecutionNodeCompatibilityFinding>;
  readonly transientAvailabilityIssues: ReadonlyArray<ImageExecutionNodeCompatibilityFinding>;
  readonly matchedBackendFamily?: string;
  readonly matchedExecutionTarget?: string;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new ExecutionNodeDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new ExecutionNodeDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeStringSet(value?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const entry of value ?? []) {
    const normalized = entry.trim().toLowerCase();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeActivationStatus(value?: ExecutionNodeActivationStatus): ExecutionNodeActivationStatus {
  const normalized = value ?? ExecutionNodeActivationStatuses.inactive;
  if (!Object.values(ExecutionNodeActivationStatuses).includes(normalized)) {
    throw new ExecutionNodeDomainError(`Execution node activation status '${String(value)}' is invalid.`);
  }
  return normalized;
}

function normalizeHealthStatus(value?: ExecutionNodeHealthStatus): ExecutionNodeHealthStatus {
  const normalized = value ?? ExecutionNodeHealthStatuses.unknown;
  if (!Object.values(ExecutionNodeHealthStatuses).includes(normalized)) {
    throw new ExecutionNodeDomainError(`Execution node health status '${String(value)}' is invalid.`);
  }
  return normalized;
}

function normalizeBackendReadinessProfile(
  value?: ExecutionNodeBackendReadinessProfile,
): ExecutionNodeBackendReadinessProfile | undefined {
  if (!value) {
    return undefined;
  }

  if (!Object.values(ExecutionNodeBackendReadinessStates).includes(value.state)) {
    throw new ExecutionNodeDomainError(
      `Execution node backend readiness state '${String(value.state)}' is invalid.`,
    );
  }

  return Object.freeze({
    state: value.state,
    checkedAt: value.checkedAt
      ? normalizeIsoTimestamp(value.checkedAt, "Execution node backend readiness checkedAt")
      : undefined,
    summary: normalizeOptional(value.summary),
  });
}

function normalizeEndpoint(input: ExecutionNodeEndpointReference): ExecutionNodeEndpointReference {
  return Object.freeze({
    endpointRef: normalizeRequired(input.endpointRef, "Execution node endpointRef"),
    configurationRef: normalizeOptional(input.configurationRef),
  });
}

function normalizeBackendFamilyCapabilities(
  value: ReadonlyArray<ExecutionNodeBackendFamilyCapability>,
): ReadonlyArray<ExecutionNodeBackendFamilyCapability> {
  if (value.length === 0) {
    throw new ExecutionNodeDomainError(
      "Execution node backendFamilyCapabilities must include at least one backend family.",
    );
  }

  const seenFamilies = new Set<string>();
  const normalized = value.map((entry, index) => {
    const backendFamily = normalizeRequired(
      entry.backendFamily,
      `Execution node backendFamilyCapabilities[${index}] backendFamily`,
    ).toLowerCase();

    if (seenFamilies.has(backendFamily)) {
      throw new ExecutionNodeDomainError(`Execution node backend family '${backendFamily}' is duplicated.`);
    }
    seenFamilies.add(backendFamily);

    const supportedExecutionTargets = normalizeStringSet(
      entry.supportedExecutionTargets.map((target) => String(target)),
    );
    if (supportedExecutionTargets.length === 0) {
      throw new ExecutionNodeDomainError(
        `Execution node backend family '${backendFamily}' must support at least one execution target.`,
      );
    }

    return Object.freeze({
      backendFamily,
      supportedExecutionTargets,
      supportedOperationKinds: normalizeStringSet(
        (entry.supportedOperationKinds ?? []).map((operationKind) => String(operationKind)),
      ),
      supportedOperationCapabilities: normalizeStringSet(
        entry.supportedOperationCapabilities,
      ),
      supportedInputKinds: normalizeStringSet(
        (entry.supportedInputKinds ?? []).map((inputKind) => String(inputKind)),
      ),
      supportedOutputKinds: normalizeStringSet(
        (entry.supportedOutputKinds ?? []).map((outputKind) => String(outputKind)),
      ),
      supportedTranslationContractVersions: normalizeStringSet(
        entry.supportedTranslationContractVersions,
      ),
      resourceClassHints: normalizeStringSet(
        (entry.resourceClassHints ?? []).map((resourceClassHint) => String(resourceClassHint)),
      ),
      executionReadiness: normalizeBackendReadinessProfile(entry.executionReadiness),
      capabilityProfileVersion: normalizeOptional(entry.capabilityProfileVersion),
      metadataTags: normalizeStringSet(entry.metadataTags),
    });
  });

  return Object.freeze(normalized);
}

function assertExecutionNodeState(node: ExecutionNodeRecord): void {
  if (node.displayName.length > 120) {
    throw new ExecutionNodeDomainError("Execution node displayName must be 120 characters or fewer.");
  }

  if (!node.capabilityProfile.enabledCapabilities.includes(NodeRoleCapabilities.executor)) {
    throw new ExecutionNodeDomainError("Execution node capabilityProfile must include 'executor'.");
  }

  const approvalRequiredStatuses = new Set<ExecutionNodeActivationStatus>([
    ExecutionNodeActivationStatuses.approved,
    ExecutionNodeActivationStatuses.active,
    ExecutionNodeActivationStatuses.degraded,
    ExecutionNodeActivationStatuses.unavailable,
  ]);

  if (approvalRequiredStatuses.has(node.activationStatus) && node.approvalStatus !== NodeApprovalStatuses.approved) {
    throw new ExecutionNodeDomainError(
      `Execution node activation status '${node.activationStatus}' requires approvalStatus='approved'.`,
    );
  }

  if (node.activationStatus === ExecutionNodeActivationStatuses.revoked && node.trustState !== NodeTrustStates.revoked) {
    throw new ExecutionNodeDomainError("Execution node activation status 'revoked' requires trustState='revoked'.");
  }

  if (node.trustState === NodeTrustStates.revoked && node.activationStatus !== ExecutionNodeActivationStatuses.revoked) {
    throw new ExecutionNodeDomainError("Execution node with trustState='revoked' must use activationStatus='revoked'.");
  }

  const trustedOperationalStatuses = new Set<ExecutionNodeActivationStatus>([
    ExecutionNodeActivationStatuses.active,
    ExecutionNodeActivationStatuses.degraded,
    ExecutionNodeActivationStatuses.unavailable,
  ]);

  if (trustedOperationalStatuses.has(node.activationStatus)) {
    if (node.trustState !== NodeTrustStates.trusted) {
      throw new ExecutionNodeDomainError(
        `Execution node activation status '${node.activationStatus}' requires trustState='trusted'.`,
      );
    }
    if (!node.certificateRef) {
      throw new ExecutionNodeDomainError(
        `Execution node activation status '${node.activationStatus}' requires certificateRef.`,
      );
    }
  }

  if (node.healthStatus === ExecutionNodeHealthStatuses.ready && node.activationStatus !== ExecutionNodeActivationStatuses.active) {
    throw new ExecutionNodeDomainError("Execution node health status 'ready' requires activationStatus='active'.");
  }

  if (node.healthStatus === ExecutionNodeHealthStatuses.unavailable && node.activationStatus === ExecutionNodeActivationStatuses.active) {
    throw new ExecutionNodeDomainError("Execution node health status 'unavailable' cannot be paired with activationStatus='active'.");
  }

  if (Date.parse(node.updatedAt) < Date.parse(node.createdAt)) {
    throw new ExecutionNodeDomainError("Execution node updatedAt cannot be earlier than createdAt.");
  }

  if (node.lastSeenAt && Date.parse(node.lastSeenAt) < Date.parse(node.createdAt)) {
    throw new ExecutionNodeDomainError("Execution node lastSeenAt cannot be earlier than createdAt.");
  }
}

export const ExecutionNodeActivationLifecycleTransitions: Readonly<
  Record<ExecutionNodeActivationStatus, ReadonlyArray<ExecutionNodeActivationStatus>>
> = Object.freeze({
  [ExecutionNodeActivationStatuses.inactive]: Object.freeze([
    ExecutionNodeActivationStatuses.pending,
    ExecutionNodeActivationStatuses.revoked,
  ]),
  [ExecutionNodeActivationStatuses.pending]: Object.freeze([
    ExecutionNodeActivationStatuses.inactive,
    ExecutionNodeActivationStatuses.approved,
    ExecutionNodeActivationStatuses.revoked,
  ]),
  [ExecutionNodeActivationStatuses.approved]: Object.freeze([
    ExecutionNodeActivationStatuses.inactive,
    ExecutionNodeActivationStatuses.active,
    ExecutionNodeActivationStatuses.revoked,
  ]),
  [ExecutionNodeActivationStatuses.active]: Object.freeze([
    ExecutionNodeActivationStatuses.inactive,
    ExecutionNodeActivationStatuses.degraded,
    ExecutionNodeActivationStatuses.unavailable,
    ExecutionNodeActivationStatuses.revoked,
  ]),
  [ExecutionNodeActivationStatuses.degraded]: Object.freeze([
    ExecutionNodeActivationStatuses.inactive,
    ExecutionNodeActivationStatuses.active,
    ExecutionNodeActivationStatuses.unavailable,
    ExecutionNodeActivationStatuses.revoked,
  ]),
  [ExecutionNodeActivationStatuses.unavailable]: Object.freeze([
    ExecutionNodeActivationStatuses.inactive,
    ExecutionNodeActivationStatuses.active,
    ExecutionNodeActivationStatuses.degraded,
    ExecutionNodeActivationStatuses.revoked,
  ]),
  [ExecutionNodeActivationStatuses.revoked]: Object.freeze([]),
});

export function isExecutionNodeActivationTransitionAllowed(
  from: ExecutionNodeActivationStatus,
  to: ExecutionNodeActivationStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return ExecutionNodeActivationLifecycleTransitions[from].includes(to);
}

function assertExecutionNodeActivationTransitionAllowed(
  from: ExecutionNodeActivationStatus,
  to: ExecutionNodeActivationStatus,
): void {
  if (!isExecutionNodeActivationTransitionAllowed(from, to)) {
    throw new ExecutionNodeActivationTransitionError(from, to);
  }
}

export function createExecutionNodeRecord(input: {
  readonly nodeId: string;
  readonly displayName: string;
  readonly nodeType: NodeType;
  readonly capabilityProfile: NodeCapabilityProfile;
  readonly backendFamilyCapabilities: ReadonlyArray<ExecutionNodeBackendFamilyCapability>;
  readonly approvalStatus?: NodeApprovalStatus;
  readonly trustState?: NodeTrustState;
  readonly activationStatus?: ExecutionNodeActivationStatus;
  readonly healthStatus?: ExecutionNodeHealthStatus;
  readonly deploymentTags?: ReadonlyArray<string>;
  readonly endpoint: ExecutionNodeEndpointReference;
  readonly certificateRef?: string;
  readonly lastSeenAt?: Date | string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly createdAt?: Date | string;
  readonly updatedAt?: Date | string;
}): ExecutionNodeRecord {
  const createdAt = normalizeIsoTimestamp(input.createdAt ?? new Date(), "Execution node createdAt");
  const updatedAt = normalizeIsoTimestamp(input.updatedAt ?? createdAt, "Execution node updatedAt");

  const metadataEntries = Object.entries(input.metadata ?? {}).map(([key, value]) => [
    normalizeRequired(key, "Execution node metadata key"),
    normalizeRequired(value, `Execution node metadata.${key}`),
  ] as const);

  const record: ExecutionNodeRecord = Object.freeze({
    nodeId: normalizeRequired(input.nodeId, "Execution node nodeId"),
    displayName: normalizeRequired(input.displayName, "Execution node displayName"),
    nodeType: input.nodeType,
    capabilityProfile: createNodeCapabilityProfile(input.capabilityProfile),
    backendFamilyCapabilities: normalizeBackendFamilyCapabilities(input.backendFamilyCapabilities),
    approvalStatus: input.approvalStatus ?? NodeApprovalStatuses.pending,
    trustState: input.trustState ?? NodeTrustStates.pendingEnrollment,
    activationStatus: normalizeActivationStatus(input.activationStatus),
    healthStatus: normalizeHealthStatus(input.healthStatus),
    deploymentTags: normalizeStringSet(input.deploymentTags),
    endpoint: normalizeEndpoint(input.endpoint),
    certificateRef: normalizeOptional(input.certificateRef),
    lastSeenAt: input.lastSeenAt
      ? normalizeIsoTimestamp(input.lastSeenAt, "Execution node lastSeenAt")
      : undefined,
    metadata: Object.freeze(Object.fromEntries(metadataEntries)),
    createdAt,
    updatedAt,
  });

  assertExecutionNodeState(record);
  return record;
}

export function transitionExecutionNodeActivationStatus(
  node: ExecutionNodeRecord,
  toStatus: ExecutionNodeActivationStatus,
  now: Date = new Date(),
): ExecutionNodeRecord {
  assertExecutionNodeActivationTransitionAllowed(node.activationStatus, toStatus);
  if (node.activationStatus === toStatus) {
    return node;
  }

  const updated: ExecutionNodeRecord = Object.freeze({
    ...node,
    activationStatus: toStatus,
    updatedAt: now.toISOString(),
  });

  assertExecutionNodeState(updated);
  return updated;
}

export function recordExecutionNodeHealth(
  node: ExecutionNodeRecord,
  input: {
    readonly healthStatus: ExecutionNodeHealthStatus;
    readonly observedAt?: Date | string;
  },
): ExecutionNodeRecord {
  const observedAt = normalizeIsoTimestamp(input.observedAt ?? new Date(), "Execution node health observedAt");

  const updated: ExecutionNodeRecord = Object.freeze({
    ...node,
    healthStatus: normalizeHealthStatus(input.healthStatus),
    lastSeenAt: observedAt,
    updatedAt: observedAt,
  });

  assertExecutionNodeState(updated);
  return updated;
}

export function setExecutionNodeBackendFamilyCapabilities(
  node: ExecutionNodeRecord,
  backendFamilyCapabilities: ReadonlyArray<ExecutionNodeBackendFamilyCapability>,
  now: Date = new Date(),
): ExecutionNodeRecord {
  const updated: ExecutionNodeRecord = Object.freeze({
    ...node,
    backendFamilyCapabilities: normalizeBackendFamilyCapabilities(backendFamilyCapabilities),
    updatedAt: now.toISOString(),
  });

  assertExecutionNodeState(updated);
  return updated;
}

function hasCapabilities(
  profile: NodeCapabilityProfile,
  required: ReadonlyArray<NodeRoleCapability>,
): boolean {
  const available = new Set(profile.enabledCapabilities);
  return required.every((capability) => available.has(capability));
}

export function evaluateImageExecutionNodeEligibility(
  node: ExecutionNodeRecord,
  input?: {
    readonly requiredBackendFamily?: string;
    readonly requiredExecutionTarget?: ExecutionNodeTargetKind | string;
    readonly requiredCapabilities?: ReadonlyArray<NodeRoleCapability>;
    readonly requiresRemoteScheduling?: boolean;
    readonly maxLastSeenAgeMs?: number;
    readonly now?: Date | string;
    readonly allowDegraded?: boolean;
  },
): ImageExecutionEligibilityResult {
  const requiredCapabilities = Object.freeze([
    NodeRoleCapabilities.executor,
    ...(input?.requiredCapabilities ?? []),
  ]);
  const requiredExecutionTarget = (input?.requiredExecutionTarget ?? ExecutionNodeTargetKinds.imageManipulation)
    .trim()
    .toLowerCase();
  const requiredBackendFamily = normalizeOptional(input?.requiredBackendFamily)?.toLowerCase();
  const allowDegraded = input?.allowDegraded ?? true;
  const reasons: string[] = [];

  if (node.approvalStatus !== NodeApprovalStatuses.approved) {
    reasons.push("node-not-approved");
  }
  if (node.trustState !== NodeTrustStates.trusted) {
    reasons.push("node-not-trusted");
  }
  if (!node.certificateRef) {
    reasons.push("node-certificate-missing");
  }
  if (node.activationStatus === ExecutionNodeActivationStatuses.revoked || node.trustState === NodeTrustStates.revoked) {
    reasons.push("node-revoked");
  }

  const allowedActivationStatuses = allowDegraded
    ? new Set<ExecutionNodeActivationStatus>([
      ExecutionNodeActivationStatuses.active,
      ExecutionNodeActivationStatuses.degraded,
    ])
    : new Set<ExecutionNodeActivationStatus>([
      ExecutionNodeActivationStatuses.active,
    ]);

  if (!allowedActivationStatuses.has(node.activationStatus)) {
    reasons.push("node-activation-not-routable");
  }

  const allowedHealthStatuses = allowDegraded
    ? new Set<ExecutionNodeHealthStatus>([
      ExecutionNodeHealthStatuses.ready,
      ExecutionNodeHealthStatuses.degraded,
    ])
    : new Set<ExecutionNodeHealthStatus>([
      ExecutionNodeHealthStatuses.ready,
    ]);
  if (!allowedHealthStatuses.has(node.healthStatus)) {
    reasons.push("node-health-not-routable");
  }

  if (!hasCapabilities(node.capabilityProfile, requiredCapabilities)) {
    reasons.push("node-missing-capability");
  }

  if (input?.requiresRemoteScheduling && !node.capabilityProfile.supportsRemoteScheduling) {
    reasons.push("node-remote-scheduling-unsupported");
  }

  const matchingCapabilities = node.backendFamilyCapabilities.filter((entry) => {
    if (requiredBackendFamily && entry.backendFamily !== requiredBackendFamily) {
      return false;
    }
    return entry.supportedExecutionTargets.includes(requiredExecutionTarget);
  });

  if (matchingCapabilities.length === 0) {
    reasons.push(requiredBackendFamily ? "node-backend-family-unsupported" : "node-execution-target-unsupported");
  }

  if (input?.maxLastSeenAgeMs !== undefined) {
    if (!Number.isInteger(input.maxLastSeenAgeMs) || input.maxLastSeenAgeMs <= 0) {
      throw new ExecutionNodeDomainError("Execution node maxLastSeenAgeMs must be a positive integer.");
    }

    if (!node.lastSeenAt) {
      reasons.push("node-last-seen-missing");
    } else {
      const nowIso = normalizeIsoTimestamp(input.now ?? new Date(), "Execution node eligibility now");
      const ageMs = Date.parse(nowIso) - Date.parse(node.lastSeenAt);
      if (ageMs > input.maxLastSeenAgeMs) {
        reasons.push("node-last-seen-stale");
      }
    }
  }

  return Object.freeze({
    isEligible: reasons.length === 0,
    reasons: Object.freeze(reasons),
    matchedBackendFamily: matchingCapabilities[0]?.backendFamily,
    matchedExecutionTarget: matchingCapabilities[0]?.supportedExecutionTargets.find(
      (target) => target === requiredExecutionTarget,
    ),
  });
}

function pushCompatibilityFinding(
  findings: ImageExecutionNodeCompatibilityFinding[],
  input: {
    readonly code: string;
    readonly kind: ImageExecutionNodeCompatibilityFindingKind;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  },
): void {
  const blocking = input.kind !== ImageExecutionNodeCompatibilityFindingKinds.softAdvisory;
  findings.push(Object.freeze({
    code: input.code,
    kind: input.kind,
    message: input.message,
    blocking,
    details: input.details,
  }));
}

function normalizeStringSetInput(values?: ReadonlyArray<string>): ReadonlySet<string> {
  return new Set(normalizeStringSet(values));
}

function evaluateBackendFamilyCompatibility(
  backendFamilyCapability: ExecutionNodeBackendFamilyCapability,
  requirements: {
    readonly requiredOperationKind?: string;
    readonly requiredOperationCapability?: string;
    readonly requiredInputKinds: ReadonlySet<string>;
    readonly requiredOutputKinds: ReadonlySet<string>;
    readonly requiredTranslationContractVersion?: string;
    readonly preferredResourceClassHints: ReadonlySet<string>;
  },
): ReadonlyArray<ImageExecutionNodeCompatibilityFinding> {
  const findings: ImageExecutionNodeCompatibilityFinding[] = [];

  if (requirements.requiredOperationKind) {
    const supported = normalizeStringSetInput(backendFamilyCapability.supportedOperationKinds);
    if (supported.size > 0 && !supported.has(requirements.requiredOperationKind)) {
      pushCompatibilityFinding(findings, {
        code: "backend-operation-kind-unsupported",
        kind: ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility,
        message:
          `Backend family '${backendFamilyCapability.backendFamily}' does not support operation '${requirements.requiredOperationKind}'.`,
      });
    }
  }

  if (requirements.requiredOperationCapability) {
    const supported = normalizeStringSetInput(backendFamilyCapability.supportedOperationCapabilities);
    if (supported.size > 0 && !supported.has(requirements.requiredOperationCapability)) {
      pushCompatibilityFinding(findings, {
        code: "backend-operation-capability-missing",
        kind: ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility,
        message:
          `Backend family '${backendFamilyCapability.backendFamily}' is missing operation capability '${requirements.requiredOperationCapability}'.`,
      });
    }
  }

  const supportedInputKinds = normalizeStringSetInput(backendFamilyCapability.supportedInputKinds);
  for (const requiredInputKind of requirements.requiredInputKinds.values()) {
    if (supportedInputKinds.size > 0 && !supportedInputKinds.has(requiredInputKind)) {
      pushCompatibilityFinding(findings, {
        code: "backend-required-input-kind-unsupported",
        kind: ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility,
        message:
          `Backend family '${backendFamilyCapability.backendFamily}' does not support required input kind '${requiredInputKind}'.`,
      });
    }
  }

  const supportedOutputKinds = normalizeStringSetInput(backendFamilyCapability.supportedOutputKinds);
  for (const requiredOutputKind of requirements.requiredOutputKinds.values()) {
    if (supportedOutputKinds.size > 0 && !supportedOutputKinds.has(requiredOutputKind)) {
      pushCompatibilityFinding(findings, {
        code: "backend-required-output-kind-unsupported",
        kind: ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility,
        message:
          `Backend family '${backendFamilyCapability.backendFamily}' does not support required output kind '${requiredOutputKind}'.`,
      });
    }
  }

  if (requirements.requiredTranslationContractVersion) {
    const supported = normalizeStringSetInput(backendFamilyCapability.supportedTranslationContractVersions);
    if (supported.size > 0 && !supported.has(requirements.requiredTranslationContractVersion)) {
      pushCompatibilityFinding(findings, {
        code: "backend-translation-contract-version-unsupported",
        kind: ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility,
        message:
          `Backend family '${backendFamilyCapability.backendFamily}' does not support translation contract version '${requirements.requiredTranslationContractVersion}'.`,
      });
    }
  }

  const preferredResourceClassHints = requirements.preferredResourceClassHints;
  if (preferredResourceClassHints.size > 0) {
    const providedHints = normalizeStringSetInput(backendFamilyCapability.resourceClassHints);
    const hasPreferredHint = [...preferredResourceClassHints.values()].some((hint) => providedHints.has(hint));
    if (providedHints.size > 0 && !hasPreferredHint) {
      pushCompatibilityFinding(findings, {
        code: "backend-resource-class-preference-unmet",
        kind: ImageExecutionNodeCompatibilityFindingKinds.softAdvisory,
        message:
          `Backend family '${backendFamilyCapability.backendFamily}' does not advertise preferred resource-class hints.`,
        details: Object.freeze({
          preferredResourceClassHints: Object.freeze([...preferredResourceClassHints.values()]),
          resourceClassHints: Object.freeze([...providedHints.values()]),
        }),
      });
    }
  }

  if (backendFamilyCapability.executionReadiness) {
    if (backendFamilyCapability.executionReadiness.state === ExecutionNodeBackendReadinessStates.unavailable) {
      pushCompatibilityFinding(findings, {
        code: "backend-readiness-unavailable",
        kind: ImageExecutionNodeCompatibilityFindingKinds.transientAvailability,
        message:
          `Backend family '${backendFamilyCapability.backendFamily}' is currently unavailable for execution.`,
      });
    } else if (backendFamilyCapability.executionReadiness.state === ExecutionNodeBackendReadinessStates.unknown) {
      pushCompatibilityFinding(findings, {
        code: "backend-readiness-unknown",
        kind: ImageExecutionNodeCompatibilityFindingKinds.transientAvailability,
        message:
          `Backend family '${backendFamilyCapability.backendFamily}' readiness is unknown.`,
      });
    } else if (backendFamilyCapability.executionReadiness.state === ExecutionNodeBackendReadinessStates.degraded) {
      pushCompatibilityFinding(findings, {
        code: "backend-readiness-degraded",
        kind: ImageExecutionNodeCompatibilityFindingKinds.softAdvisory,
        message:
          `Backend family '${backendFamilyCapability.backendFamily}' is degraded and may have reduced execution quality.`,
      });
    }
  }

  return Object.freeze(findings);
}

function classifyEligibilityReason(reason: string): ImageExecutionNodeCompatibilityFinding {
  const kind = reason === "node-health-not-routable" || reason === "node-last-seen-missing" || reason === "node-last-seen-stale"
    ? ImageExecutionNodeCompatibilityFindingKinds.transientAvailability
    : ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility;

  const messages: Readonly<Record<string, string>> = Object.freeze({
    "node-not-approved": "Node is not approved for execution routing.",
    "node-not-trusted": "Node is not trusted for execution routing.",
    "node-certificate-missing": "Node is missing trusted certificate material.",
    "node-revoked": "Node is revoked and cannot execute workloads.",
    "node-activation-not-routable": "Node activation status is not routable for execution.",
    "node-health-not-routable": "Node health status is not currently routable.",
    "node-missing-capability": "Node capability profile does not satisfy required capabilities.",
    "node-remote-scheduling-unsupported": "Node does not support required remote scheduling.",
    "node-execution-target-unsupported": "Node does not support the required execution target.",
    "node-backend-family-unsupported": "Node does not support the required backend family.",
    "node-last-seen-missing": "Node freshness cannot be verified because last-seen is missing.",
    "node-last-seen-stale": "Node freshness is stale for current routing policy.",
  });

  return Object.freeze({
    code: reason,
    kind,
    message: messages[reason] ?? `Execution node is not compatible: ${reason}.`,
    blocking: kind !== ImageExecutionNodeCompatibilityFindingKinds.softAdvisory,
  });
}

export function evaluateImageExecutionNodeCompatibility(
  node: ExecutionNodeRecord,
  input?: ImageExecutionNodeCompatibilityRequirements,
): ImageExecutionNodeCompatibilityResult {
  const requiredExecutionTarget = (input?.requiredExecutionTarget ?? ExecutionNodeTargetKinds.imageManipulation)
    .trim()
    .toLowerCase();
  const requiredBackendFamilies = normalizeStringSet(input?.requiredBackendFamilies);
  const requiredOperationKind = normalizeOptional(input?.requiredOperationKind)?.toLowerCase();
  const requiredOperationCapability = normalizeOptional(input?.requiredOperationCapability)?.toLowerCase();
  const requiredInputKinds = normalizeStringSet(
    (input?.requiredInputKinds ?? []).map((inputKind) => String(inputKind)),
  );
  const requiredOutputKinds = normalizeStringSet(
    (input?.requiredOutputKinds ?? []).map((outputKind) => String(outputKind)),
  );
  const requiredTranslationContractVersion = normalizeOptional(input?.requiredTranslationContractVersion)?.toLowerCase();
  const preferredResourceClassHints = normalizeStringSet(
    (input?.preferredResourceClassHints ?? []).map((resourceClassHint) => String(resourceClassHint)),
  );

  const findings: ImageExecutionNodeCompatibilityFinding[] = [];
  const eligibility = evaluateImageExecutionNodeEligibility(node, {
    requiredExecutionTarget,
    requiredCapabilities: input?.requiredNodeCapabilities,
    requiresRemoteScheduling: input?.requiresRemoteScheduling,
    maxLastSeenAgeMs: input?.maxLastSeenAgeMs,
    now: input?.now,
    allowDegraded: input?.allowDegraded,
  });

  for (const reason of eligibility.reasons) {
    findings.push(classifyEligibilityReason(reason));
  }

  const backendFamilyCandidates = node.backendFamilyCapabilities.filter((backendFamilyCapability) => {
    if (!backendFamilyCapability.supportedExecutionTargets.includes(requiredExecutionTarget)) {
      return false;
    }
    if (requiredBackendFamilies.length === 0) {
      return true;
    }
    return requiredBackendFamilies.includes(backendFamilyCapability.backendFamily);
  });

  if (backendFamilyCandidates.length === 0 && requiredBackendFamilies.length > 0) {
    pushCompatibilityFinding(findings, {
      code: "backend-family-not-matched",
      kind: ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility,
      message: `Node does not advertise any required backend family for execution target '${requiredExecutionTarget}'.`,
      details: Object.freeze({
        requiredBackendFamilies,
      }),
    });
  }

  let matchedBackendFamily = eligibility.matchedBackendFamily;
  let matchedExecutionTarget = eligibility.matchedExecutionTarget;

  if (backendFamilyCandidates.length > 0) {
    const evaluatedCandidates = backendFamilyCandidates.map((backendFamilyCapability) => {
      const backendFindings = evaluateBackendFamilyCompatibility(backendFamilyCapability, {
        requiredOperationKind,
        requiredOperationCapability,
        requiredInputKinds: new Set(requiredInputKinds),
        requiredOutputKinds: new Set(requiredOutputKinds),
        requiredTranslationContractVersion,
        preferredResourceClassHints: new Set(preferredResourceClassHints),
      });

      const hardCount = backendFindings.filter((entry) => (
        entry.kind === ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility
      )).length;
      const transientCount = backendFindings.filter((entry) => (
        entry.kind === ImageExecutionNodeCompatibilityFindingKinds.transientAvailability
      )).length;
      const softCount = backendFindings.length - hardCount - transientCount;

      return Object.freeze({
        backendFamilyCapability,
        findings: backendFindings,
        hardCount,
        transientCount,
        softCount,
      });
    });

    const selected = evaluatedCandidates
      .slice()
      .sort((left, right) => {
        if (left.hardCount !== right.hardCount) {
          return left.hardCount - right.hardCount;
        }
        if (left.transientCount !== right.transientCount) {
          return left.transientCount - right.transientCount;
        }
        return left.softCount - right.softCount;
      })[0];

    if (selected) {
      matchedBackendFamily = selected.backendFamilyCapability.backendFamily;
      matchedExecutionTarget = selected.backendFamilyCapability.supportedExecutionTargets.find(
        (entry) => entry === requiredExecutionTarget,
      );
      findings.push(...selected.findings);
    }
  }

  const hardIncompatibilities = Object.freeze(findings.filter((entry) => (
    entry.kind === ImageExecutionNodeCompatibilityFindingKinds.hardIncompatibility
  )));
  const softAdvisories = Object.freeze(findings.filter((entry) => (
    entry.kind === ImageExecutionNodeCompatibilityFindingKinds.softAdvisory
  )));
  const transientAvailabilityIssues = Object.freeze(findings.filter((entry) => (
    entry.kind === ImageExecutionNodeCompatibilityFindingKinds.transientAvailability
  )));

  return Object.freeze({
    compatible: hardIncompatibilities.length === 0,
    routable: hardIncompatibilities.length === 0 && transientAvailabilityIssues.length === 0,
    findings: Object.freeze(findings),
    hardIncompatibilities,
    softAdvisories,
    transientAvailabilityIssues,
    matchedBackendFamily,
    matchedExecutionTarget,
  });
}

