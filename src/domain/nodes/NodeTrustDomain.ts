export class NodeTrustDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NodeTrustDomainError";
  }
}

export class NodeApprovalLifecycleTransitionError extends NodeTrustDomainError {
  constructor(fromStatus: NodeApprovalStatus, toStatus: NodeApprovalStatus) {
    super(`Node approval lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "NodeApprovalLifecycleTransitionError";
  }
}

export class NodeTrustLifecycleTransitionError extends NodeTrustDomainError {
  constructor(fromStatus: NodeTrustState, toStatus: NodeTrustState) {
    super(`Node trust lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "NodeTrustLifecycleTransitionError";
  }
}

export class NodeEnrollmentLifecycleTransitionError extends NodeTrustDomainError {
  constructor(fromStatus: NodeEnrollmentRequestStatus, toStatus: NodeEnrollmentRequestStatus) {
    super(`Node enrollment request lifecycle cannot transition from '${fromStatus}' to '${toStatus}'.`);
    this.name = "NodeEnrollmentLifecycleTransitionError";
  }
}

export const NodeTypes = Object.freeze({
  compute: "compute",
  hybrid: "hybrid",
  edge: "edge",
});

export type NodeType = typeof NodeTypes[keyof typeof NodeTypes];

export const NodeRoleCapabilities = Object.freeze({
  ui: "ui",
  api: "api",
  scheduler: "scheduler",
  executor: "executor",
  storageAccess: "storage-access",
  previewWorker: "preview-worker",
});

export type NodeRoleCapability = typeof NodeRoleCapabilities[keyof typeof NodeRoleCapabilities];

export interface NodeCapabilityProfile {
  readonly enabledCapabilities: ReadonlyArray<NodeRoleCapability>;
  readonly capabilityProfileVersion?: string;
  readonly supportsRemoteScheduling: boolean;
  readonly maxConcurrentWorkloads?: number;
}

export const NodeApprovalStatuses = Object.freeze({
  pending: "pending",
  approved: "approved",
  rejected: "rejected",
  suspended: "suspended",
});

export type NodeApprovalStatus = typeof NodeApprovalStatuses[keyof typeof NodeApprovalStatuses];

export const NodeTrustStates = Object.freeze({
  pendingEnrollment: "pending-enrollment",
  pendingApproval: "pending-approval",
  trusted: "trusted",
  quarantined: "quarantined",
  revoked: "revoked",
});

export type NodeTrustState = typeof NodeTrustStates[keyof typeof NodeTrustStates];

export const NodeRevocationStates = Object.freeze({
  active: "active",
  pendingRevocation: "pending-revocation",
  revoked: "revoked",
});

export type NodeRevocationState = typeof NodeRevocationStates[keyof typeof NodeRevocationStates];

export const NodeRevocationReasons = Object.freeze({
  ownerRequest: "owner-request",
  operatorAction: "operator-action",
  certificateCompromise: "certificate-compromise",
  policyViolation: "policy-violation",
  decommissioned: "decommissioned",
});

export type NodeRevocationReason = typeof NodeRevocationReasons[keyof typeof NodeRevocationReasons];

export const NodeHeartbeatStatuses = Object.freeze({
  online: "online",
  degraded: "degraded",
  offline: "offline",
});

export type NodeHeartbeatStatus = typeof NodeHeartbeatStatuses[keyof typeof NodeHeartbeatStatuses];

export interface LastSeenMetadata {
  readonly lastSeenAt: string;
  readonly heartbeatStatus: NodeHeartbeatStatus;
  readonly observedBy?: string;
}

export interface NodeRevocation {
  readonly state: NodeRevocationState;
  readonly reason?: NodeRevocationReason;
  readonly revokedAt?: string;
  readonly revokedByUserIdentityId?: string;
  readonly note?: string;
}

export interface NodeIdentity {
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly capabilityProfile: NodeCapabilityProfile;
  readonly approvalStatus: NodeApprovalStatus;
  readonly trustState: NodeTrustState;
  readonly certificateRef?: string;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly lastSeen?: LastSeenMetadata;
  readonly revocation: NodeRevocation;
  readonly revokedAt?: string;
  readonly enrolledAt: string;
  readonly approvedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const NodeEnrollmentRequestStatuses = Object.freeze({
  submitted: "submitted",
  underReview: "under-review",
  approved: "approved",
  rejected: "rejected",
  withdrawn: "withdrawn",
  expired: "expired",
});

export type NodeEnrollmentRequestStatus =
  typeof NodeEnrollmentRequestStatuses[keyof typeof NodeEnrollmentRequestStatuses];

export interface NodeEnrollmentRequest {
  readonly requestId: string;
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly capabilityProfile: NodeCapabilityProfile;
  readonly deploymentTags: ReadonlyArray<string>;
  readonly certificateRef?: string;
  readonly requestedAt: string;
  readonly status: NodeEnrollmentRequestStatus;
  readonly reviewedAt?: string;
  readonly reviewedByUserIdentityId?: string;
  readonly decisionNote?: string;
  readonly updatedAt: string;
}

export const NodeApprovalLifecycleTransitions: Readonly<
  Record<NodeApprovalStatus, ReadonlyArray<NodeApprovalStatus>>
> = Object.freeze({
  [NodeApprovalStatuses.pending]: Object.freeze([
    NodeApprovalStatuses.approved,
    NodeApprovalStatuses.rejected,
  ]),
  [NodeApprovalStatuses.approved]: Object.freeze([NodeApprovalStatuses.suspended]),
  [NodeApprovalStatuses.rejected]: Object.freeze([NodeApprovalStatuses.pending]),
  [NodeApprovalStatuses.suspended]: Object.freeze([
    NodeApprovalStatuses.approved,
    NodeApprovalStatuses.rejected,
  ]),
});

export const NodeTrustLifecycleTransitions: Readonly<
  Record<NodeTrustState, ReadonlyArray<NodeTrustState>>
> = Object.freeze({
  [NodeTrustStates.pendingEnrollment]: Object.freeze([
    NodeTrustStates.pendingApproval,
    NodeTrustStates.revoked,
  ]),
  [NodeTrustStates.pendingApproval]: Object.freeze([
    NodeTrustStates.trusted,
    NodeTrustStates.quarantined,
    NodeTrustStates.revoked,
  ]),
  [NodeTrustStates.trusted]: Object.freeze([
    NodeTrustStates.quarantined,
    NodeTrustStates.revoked,
  ]),
  [NodeTrustStates.quarantined]: Object.freeze([
    NodeTrustStates.pendingApproval,
    NodeTrustStates.trusted,
    NodeTrustStates.revoked,
  ]),
  [NodeTrustStates.revoked]: Object.freeze([]),
});

export const NodeEnrollmentRequestLifecycleTransitions: Readonly<
  Record<NodeEnrollmentRequestStatus, ReadonlyArray<NodeEnrollmentRequestStatus>>
> = Object.freeze({
  [NodeEnrollmentRequestStatuses.submitted]: Object.freeze([
    NodeEnrollmentRequestStatuses.underReview,
    NodeEnrollmentRequestStatuses.withdrawn,
    NodeEnrollmentRequestStatuses.expired,
  ]),
  [NodeEnrollmentRequestStatuses.underReview]: Object.freeze([
    NodeEnrollmentRequestStatuses.approved,
    NodeEnrollmentRequestStatuses.rejected,
    NodeEnrollmentRequestStatuses.withdrawn,
    NodeEnrollmentRequestStatuses.expired,
  ]),
  [NodeEnrollmentRequestStatuses.approved]: Object.freeze([]),
  [NodeEnrollmentRequestStatuses.rejected]: Object.freeze([]),
  [NodeEnrollmentRequestStatuses.withdrawn]: Object.freeze([]),
  [NodeEnrollmentRequestStatuses.expired]: Object.freeze([]),
});

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new NodeTrustDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

const LegacyNodeRoleCapabilityAliases: Readonly<Record<string, NodeRoleCapability>> = Object.freeze({
  "workflow-execution": NodeRoleCapabilities.executor,
  "model-inference": NodeRoleCapabilities.api,
  "model-training": NodeRoleCapabilities.executor,
  "mcp-tool-execution": NodeRoleCapabilities.api,
  "scheduling-participation": NodeRoleCapabilities.scheduler,
});

const NodeRoleCapabilityPriority = Object.freeze([
  NodeRoleCapabilities.ui,
  NodeRoleCapabilities.api,
  NodeRoleCapabilities.scheduler,
  NodeRoleCapabilities.executor,
  NodeRoleCapabilities.storageAccess,
  NodeRoleCapabilities.previewWorker,
]);

const NodeRoleCapabilityPriorityByValue = Object.freeze(
  NodeRoleCapabilityPriority.reduce<Record<NodeRoleCapability, number>>((acc, value, index) => {
    acc[value] = index;
    return acc;
  }, Object.create(null) as Record<NodeRoleCapability, number>),
);

function normalizeIsoTimestamp(value: Date | string, field: string): string {
  const iso = value instanceof Date ? value.toISOString() : value.trim();
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new NodeTrustDomainError(`${field} must be a valid timestamp.`);
  }
  return parsed.toISOString();
}

function normalizeNodeType(value: NodeType): NodeType {
  if (!Object.values(NodeTypes).includes(value)) {
    throw new NodeTrustDomainError(`Node type '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeNodeApprovalStatus(value?: NodeApprovalStatus): NodeApprovalStatus {
  const normalized = value ?? NodeApprovalStatuses.pending;
  if (!Object.values(NodeApprovalStatuses).includes(normalized)) {
    throw new NodeTrustDomainError(`Node approval status '${String(value)}' is invalid.`);
  }
  return normalized;
}

function normalizeNodeTrustState(value?: NodeTrustState): NodeTrustState {
  const normalized = value ?? NodeTrustStates.pendingEnrollment;
  if (!Object.values(NodeTrustStates).includes(normalized)) {
    throw new NodeTrustDomainError(`Node trust state '${String(value)}' is invalid.`);
  }
  return normalized;
}

function normalizeRevocation(input?: {
  readonly state?: NodeRevocationState;
  readonly reason?: NodeRevocationReason;
  readonly revokedAt?: Date | string;
  readonly revokedByUserIdentityId?: string;
  readonly note?: string;
}): NodeRevocation {
  const state = input?.state ?? NodeRevocationStates.active;
  if (!Object.values(NodeRevocationStates).includes(state)) {
    throw new NodeTrustDomainError(`Node revocation state '${String(state)}' is invalid.`);
  }

  const reason = input?.reason;
  if (reason !== undefined && !Object.values(NodeRevocationReasons).includes(reason)) {
    throw new NodeTrustDomainError(`Node revocation reason '${String(reason)}' is invalid.`);
  }

  const revokedAt = input?.revokedAt
    ? normalizeIsoTimestamp(input.revokedAt, "Node revocation revokedAt")
    : undefined;

  return Object.freeze({
    state,
    reason,
    revokedAt,
    revokedByUserIdentityId: normalizeOptional(input?.revokedByUserIdentityId),
    note: normalizeOptional(input?.note),
  });
}

function normalizeDeploymentTags(value?: ReadonlyArray<string>): ReadonlyArray<string> {
  const deduped = new Set<string>();
  for (const tag of value ?? []) {
    const normalized = tag.trim().toLowerCase();
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return Object.freeze([...deduped.values()]);
}

function normalizeHeartbeatStatus(value: NodeHeartbeatStatus): NodeHeartbeatStatus {
  if (!Object.values(NodeHeartbeatStatuses).includes(value)) {
    throw new NodeTrustDomainError(`Node heartbeat status '${String(value)}' is invalid.`);
  }
  return value;
}

function normalizeLastSeen(input?: {
  readonly lastSeenAt: Date | string;
  readonly heartbeatStatus?: NodeHeartbeatStatus;
  readonly observedBy?: string;
}): LastSeenMetadata | undefined {
  if (!input) {
    return undefined;
  }

  return Object.freeze({
    lastSeenAt: normalizeIsoTimestamp(input.lastSeenAt, "Node lastSeenAt"),
    heartbeatStatus: normalizeHeartbeatStatus(input.heartbeatStatus ?? NodeHeartbeatStatuses.online),
    observedBy: normalizeOptional(input.observedBy),
  });
}

function assertNodeIdentityState(node: NodeIdentity): void {
  if (node.displayName.length > 120) {
    throw new NodeTrustDomainError("Node displayName must be 120 characters or fewer.");
  }

  if (node.capabilityProfile.enabledCapabilities.length === 0) {
    throw new NodeTrustDomainError("Node capabilityProfile must include at least one enabled capability.");
  }

  if (node.approvalStatus === NodeApprovalStatuses.approved && !node.approvedAt) {
    throw new NodeTrustDomainError("Approved nodes must include approvedAt.");
  }

  if (node.approvalStatus === NodeApprovalStatuses.rejected && node.approvedAt) {
    throw new NodeTrustDomainError("Rejected nodes cannot include approvedAt.");
  }

  if (node.trustState === NodeTrustStates.trusted) {
    if (node.approvalStatus !== NodeApprovalStatuses.approved) {
      throw new NodeTrustDomainError("Trusted nodes must be approved.");
    }
    if (!node.certificateRef) {
      throw new NodeTrustDomainError("Trusted nodes must include certificateRef.");
    }
    if (node.revocation.state === NodeRevocationStates.revoked) {
      throw new NodeTrustDomainError("Trusted nodes cannot be revoked.");
    }
  }

  if (node.revocation.state === NodeRevocationStates.revoked) {
    if (!node.revokedAt || !node.revocation.revokedAt) {
      throw new NodeTrustDomainError("Revoked nodes must include revokedAt.");
    }
    if (!node.revocation.reason) {
      throw new NodeTrustDomainError("Revoked nodes must include revocation reason.");
    }
    if (node.trustState !== NodeTrustStates.revoked) {
      throw new NodeTrustDomainError("Revocation state 'revoked' requires trustState='revoked'.");
    }
  } else if (node.revokedAt || node.revocation.revokedAt || node.revocation.reason) {
    throw new NodeTrustDomainError("Only revoked nodes can include revocation metadata.");
  }

  if (new Date(node.updatedAt).getTime() < new Date(node.createdAt).getTime()) {
    throw new NodeTrustDomainError("Node updatedAt cannot be earlier than createdAt.");
  }
  if (new Date(node.enrolledAt).getTime() < new Date(node.createdAt).getTime()) {
    throw new NodeTrustDomainError("Node enrolledAt cannot be earlier than createdAt.");
  }
  if (node.approvedAt && new Date(node.approvedAt).getTime() < new Date(node.enrolledAt).getTime()) {
    throw new NodeTrustDomainError("Node approvedAt cannot be earlier than enrolledAt.");
  }
  if (node.lastSeen && new Date(node.lastSeen.lastSeenAt).getTime() < new Date(node.enrolledAt).getTime()) {
    throw new NodeTrustDomainError("Node lastSeenAt cannot be earlier than enrolledAt.");
  }
}

export function createNodeCapabilityProfile(input: {
  readonly enabledCapabilities: ReadonlyArray<NodeRoleCapability | string>;
  readonly capabilityProfileVersion?: string;
  readonly supportsRemoteScheduling?: boolean;
  readonly maxConcurrentWorkloads?: number;
}): NodeCapabilityProfile {
  const deduped = new Set<NodeRoleCapability>();
  for (const capability of input.enabledCapabilities) {
    const normalizedCapability = normalizeNodeRoleCapability(capability);
    if (!normalizedCapability) {
      throw new NodeTrustDomainError(`Node role capability '${String(capability)}' is invalid.`);
    }
    deduped.add(normalizedCapability);
  }

  if (deduped.size === 0) {
    throw new NodeTrustDomainError("Node capability profile must include at least one enabled capability.");
  }

  if (deduped.has(NodeRoleCapabilities.ui) && !deduped.has(NodeRoleCapabilities.api)) {
    throw new NodeTrustDomainError("Node capability profile with 'ui' capability must also include 'api'.");
  }

  if (deduped.has(NodeRoleCapabilities.scheduler) && !deduped.has(NodeRoleCapabilities.api)) {
    throw new NodeTrustDomainError("Node capability profile with 'scheduler' capability must also include 'api'.");
  }

  if (deduped.has(NodeRoleCapabilities.scheduler) && !deduped.has(NodeRoleCapabilities.executor)) {
    throw new NodeTrustDomainError(
      "Node capability profile with 'scheduler' capability must also include 'executor'.",
    );
  }

  if (deduped.has(NodeRoleCapabilities.previewWorker) && !deduped.has(NodeRoleCapabilities.executor)) {
    throw new NodeTrustDomainError(
      "Node capability profile with 'preview-worker' capability must also include 'executor'.",
    );
  }

  const maxConcurrentWorkloads = input.maxConcurrentWorkloads;
  if (
    maxConcurrentWorkloads !== undefined
    && (!Number.isInteger(maxConcurrentWorkloads) || maxConcurrentWorkloads <= 0)
  ) {
    throw new NodeTrustDomainError("Node capability profile maxConcurrentWorkloads must be a positive integer.");
  }

  if (maxConcurrentWorkloads !== undefined && !deduped.has(NodeRoleCapabilities.executor)) {
    throw new NodeTrustDomainError(
      "Node capability profile maxConcurrentWorkloads requires 'executor' capability.",
    );
  }

  const supportsRemoteScheduling = input.supportsRemoteScheduling ?? deduped.has(NodeRoleCapabilities.executor);
  if (supportsRemoteScheduling && !deduped.has(NodeRoleCapabilities.executor)) {
    throw new NodeTrustDomainError(
      "Node capability profile supportsRemoteScheduling requires 'executor' capability.",
    );
  }

  return Object.freeze({
    enabledCapabilities: Object.freeze(
      [...deduped.values()].sort((left, right) => (
        NodeRoleCapabilityPriorityByValue[left] - NodeRoleCapabilityPriorityByValue[right]
      )),
    ),
    capabilityProfileVersion: normalizeOptional(input.capabilityProfileVersion),
    supportsRemoteScheduling,
    maxConcurrentWorkloads,
  });
}

function normalizeNodeRoleCapability(value: string): NodeRoleCapability | undefined {
  if (Object.values(NodeRoleCapabilities).includes(value as NodeRoleCapability)) {
    return value as NodeRoleCapability;
  }
  return LegacyNodeRoleCapabilityAliases[value];
}

export function createLastSeenMetadata(input: {
  readonly lastSeenAt: Date | string;
  readonly heartbeatStatus?: NodeHeartbeatStatus;
  readonly observedBy?: string;
}): LastSeenMetadata {
  return normalizeLastSeen(input)!;
}

export function createNodeIdentity(input: {
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly capabilityProfile: NodeCapabilityProfile;
  readonly approvalStatus?: NodeApprovalStatus;
  readonly trustState?: NodeTrustState;
  readonly certificateRef?: string;
  readonly deploymentTags?: ReadonlyArray<string>;
  readonly lastSeen?: {
    readonly lastSeenAt: Date | string;
    readonly heartbeatStatus?: NodeHeartbeatStatus;
    readonly observedBy?: string;
  };
  readonly revocation?: {
    readonly state?: NodeRevocationState;
    readonly reason?: NodeRevocationReason;
    readonly revokedAt?: Date | string;
    readonly revokedByUserIdentityId?: string;
    readonly note?: string;
  };
  readonly enrolledAt?: Date | string;
  readonly approvedAt?: Date | string;
  readonly createdAt?: Date | string;
  readonly updatedAt?: Date | string;
}): NodeIdentity {
  const createdAt = normalizeIsoTimestamp(input.createdAt ?? new Date(), "Node createdAt");
  const enrolledAt = normalizeIsoTimestamp(input.enrolledAt ?? createdAt, "Node enrolledAt");
  const approvalStatus = normalizeNodeApprovalStatus(input.approvalStatus);
  const trustState = normalizeNodeTrustState(input.trustState);
  const revocation = normalizeRevocation(input.revocation);
  const lastSeen = normalizeLastSeen(input.lastSeen);
  const approvedAt = input.approvedAt ? normalizeIsoTimestamp(input.approvedAt, "Node approvedAt") : undefined;
  const updatedAt = normalizeIsoTimestamp(input.updatedAt ?? enrolledAt, "Node updatedAt");

  const node: NodeIdentity = Object.freeze({
    nodeId: normalizeRequired(input.nodeId, "Node nodeId"),
    nodeType: normalizeNodeType(input.nodeType),
    displayName: normalizeRequired(input.displayName, "Node displayName"),
    capabilityProfile: createNodeCapabilityProfile(input.capabilityProfile),
    approvalStatus,
    trustState,
    certificateRef: normalizeOptional(input.certificateRef),
    deploymentTags: normalizeDeploymentTags(input.deploymentTags),
    lastSeen,
    revocation,
    revokedAt: revocation.revokedAt,
    enrolledAt,
    approvedAt,
    createdAt,
    updatedAt,
  });

  assertNodeIdentityState(node);
  return node;
}

export function createNodeEnrollmentRequest(input: {
  readonly requestId: string;
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly displayName: string;
  readonly capabilityProfile: NodeCapabilityProfile;
  readonly deploymentTags?: ReadonlyArray<string>;
  readonly certificateRef?: string;
  readonly status?: NodeEnrollmentRequestStatus;
  readonly requestedAt?: Date | string;
  readonly reviewedAt?: Date | string;
  readonly reviewedByUserIdentityId?: string;
  readonly decisionNote?: string;
  readonly updatedAt?: Date | string;
}): NodeEnrollmentRequest {
  const status = input.status ?? NodeEnrollmentRequestStatuses.submitted;
  if (!Object.values(NodeEnrollmentRequestStatuses).includes(status)) {
    throw new NodeTrustDomainError(`Node enrollment request status '${String(status)}' is invalid.`);
  }

  const requestedAt = normalizeIsoTimestamp(input.requestedAt ?? new Date(), "Node enrollment requestedAt");
  const reviewedAt = input.reviewedAt
    ? normalizeIsoTimestamp(input.reviewedAt, "Node enrollment reviewedAt")
    : undefined;

  const request: NodeEnrollmentRequest = Object.freeze({
    requestId: normalizeRequired(input.requestId, "Node enrollment requestId"),
    nodeId: normalizeRequired(input.nodeId, "Node enrollment nodeId"),
    nodeType: normalizeNodeType(input.nodeType),
    displayName: normalizeRequired(input.displayName, "Node enrollment displayName"),
    capabilityProfile: createNodeCapabilityProfile(input.capabilityProfile),
    deploymentTags: normalizeDeploymentTags(input.deploymentTags),
    certificateRef: normalizeOptional(input.certificateRef),
    requestedAt,
    status,
    reviewedAt,
    reviewedByUserIdentityId: normalizeOptional(input.reviewedByUserIdentityId),
    decisionNote: normalizeOptional(input.decisionNote),
    updatedAt: normalizeIsoTimestamp(input.updatedAt ?? requestedAt, "Node enrollment updatedAt"),
  });

  if (
    (request.status === NodeEnrollmentRequestStatuses.approved
      || request.status === NodeEnrollmentRequestStatuses.rejected)
    && !request.reviewedAt
  ) {
    throw new NodeTrustDomainError("Approved or rejected enrollment requests must include reviewedAt.");
  }

  if (request.reviewedAt && new Date(request.reviewedAt).getTime() < new Date(request.requestedAt).getTime()) {
    throw new NodeTrustDomainError("Node enrollment reviewedAt cannot be earlier than requestedAt.");
  }

  return request;
}

export function isNodeApprovalTransitionAllowed(from: NodeApprovalStatus, to: NodeApprovalStatus): boolean {
  if (from === to) {
    return true;
  }
  return NodeApprovalLifecycleTransitions[from].includes(to);
}

function assertNodeApprovalTransitionAllowed(from: NodeApprovalStatus, to: NodeApprovalStatus): void {
  if (!isNodeApprovalTransitionAllowed(from, to)) {
    throw new NodeApprovalLifecycleTransitionError(from, to);
  }
}

export function isNodeTrustTransitionAllowed(from: NodeTrustState, to: NodeTrustState): boolean {
  if (from === to) {
    return true;
  }
  return NodeTrustLifecycleTransitions[from].includes(to);
}

function assertNodeTrustTransitionAllowed(from: NodeTrustState, to: NodeTrustState): void {
  if (!isNodeTrustTransitionAllowed(from, to)) {
    throw new NodeTrustLifecycleTransitionError(from, to);
  }
}

export function isNodeEnrollmentRequestTransitionAllowed(
  from: NodeEnrollmentRequestStatus,
  to: NodeEnrollmentRequestStatus,
): boolean {
  if (from === to) {
    return true;
  }
  return NodeEnrollmentRequestLifecycleTransitions[from].includes(to);
}

function assertNodeEnrollmentRequestTransitionAllowed(
  from: NodeEnrollmentRequestStatus,
  to: NodeEnrollmentRequestStatus,
): void {
  if (!isNodeEnrollmentRequestTransitionAllowed(from, to)) {
    throw new NodeEnrollmentLifecycleTransitionError(from, to);
  }
}

export function transitionNodeApprovalStatus(
  node: NodeIdentity,
  toStatus: NodeApprovalStatus,
  now: Date = new Date(),
): NodeIdentity {
  assertNodeApprovalTransitionAllowed(node.approvalStatus, toStatus);
  if (node.approvalStatus === toStatus) {
    return node;
  }

  const nowIso = now.toISOString();
  const updated = Object.freeze({
    ...node,
    approvalStatus: toStatus,
    approvedAt: toStatus === NodeApprovalStatuses.approved ? (node.approvedAt ?? nowIso) : undefined,
    updatedAt: nowIso,
  });

  assertNodeIdentityState(updated);
  return updated;
}

export function transitionNodeTrustState(
  node: NodeIdentity,
  toState: NodeTrustState,
  now: Date = new Date(),
): NodeIdentity {
  assertNodeTrustTransitionAllowed(node.trustState, toState);
  if (node.trustState === toState) {
    return node;
  }

  const nowIso = now.toISOString();
  const updated = Object.freeze({
    ...node,
    trustState: toState,
    updatedAt: nowIso,
  });

  assertNodeIdentityState(updated);
  return updated;
}

export function assignNodeCertificate(
  node: NodeIdentity,
  certificateRef: string,
  now: Date = new Date(),
): NodeIdentity {
  const updated = Object.freeze({
    ...node,
    certificateRef: normalizeRequired(certificateRef, "Node certificateRef"),
    updatedAt: now.toISOString(),
  });
  assertNodeIdentityState(updated);
  return updated;
}

export function setNodeCapabilityProfile(
  node: NodeIdentity,
  capabilityProfile: NodeCapabilityProfile,
  now: Date = new Date(),
): NodeIdentity {
  const updated = Object.freeze({
    ...node,
    capabilityProfile: createNodeCapabilityProfile(capabilityProfile),
    updatedAt: now.toISOString(),
  });

  assertNodeIdentityState(updated);
  return updated;
}

export function recordNodeLastSeen(
  node: NodeIdentity,
  input: {
    readonly seenAt?: Date | string;
    readonly heartbeatStatus?: NodeHeartbeatStatus;
    readonly observedBy?: string;
  },
): NodeIdentity {
  if (node.trustState === NodeTrustStates.revoked || node.revocation.state === NodeRevocationStates.revoked) {
    throw new NodeTrustDomainError("Revoked nodes cannot be marked as seen.");
  }

  const seenAt = normalizeIsoTimestamp(input.seenAt ?? new Date(), "Node lastSeenAt");
  const updated = Object.freeze({
    ...node,
    lastSeen: createLastSeenMetadata({
      lastSeenAt: seenAt,
      heartbeatStatus: input.heartbeatStatus ?? NodeHeartbeatStatuses.online,
      observedBy: input.observedBy,
    }),
    updatedAt: seenAt,
  });

  assertNodeIdentityState(updated);
  return updated;
}

export function revokeNodeIdentity(
  node: NodeIdentity,
  input: {
    readonly reason: NodeRevocationReason;
    readonly revokedAt?: Date | string;
    readonly revokedByUserIdentityId?: string;
    readonly note?: string;
  },
): NodeIdentity {
  const revokedAt = normalizeIsoTimestamp(input.revokedAt ?? new Date(), "Node revokedAt");
  const revocation = normalizeRevocation({
    state: NodeRevocationStates.revoked,
    reason: input.reason,
    revokedAt,
    revokedByUserIdentityId: input.revokedByUserIdentityId,
    note: input.note,
  });

  const updated = Object.freeze({
    ...node,
    trustState: NodeTrustStates.revoked,
    revocation,
    revokedAt,
    updatedAt: revokedAt,
  });

  assertNodeIdentityState(updated);
  return updated;
}

export function transitionNodeEnrollmentRequestStatus(
  request: NodeEnrollmentRequest,
  toStatus: NodeEnrollmentRequestStatus,
  input?: {
    readonly reviewedAt?: Date | string;
    readonly reviewedByUserIdentityId?: string;
    readonly decisionNote?: string;
  },
): NodeEnrollmentRequest {
  assertNodeEnrollmentRequestTransitionAllowed(request.status, toStatus);
  if (request.status === toStatus) {
    return request;
  }

  const transitionAt = normalizeIsoTimestamp(input?.reviewedAt ?? new Date(), "Node enrollment transition timestamp");
  const reviewedAt = (
    toStatus === NodeEnrollmentRequestStatuses.approved
    || toStatus === NodeEnrollmentRequestStatuses.rejected
  ) ? transitionAt : request.reviewedAt;

  const updated = Object.freeze({
    ...request,
    status: toStatus,
    reviewedAt,
    reviewedByUserIdentityId: normalizeOptional(input?.reviewedByUserIdentityId) ?? request.reviewedByUserIdentityId,
    decisionNote: normalizeOptional(input?.decisionNote) ?? request.decisionNote,
    updatedAt: transitionAt,
  });

  if (
    (updated.status === NodeEnrollmentRequestStatuses.approved
      || updated.status === NodeEnrollmentRequestStatuses.rejected)
    && !updated.reviewedAt
  ) {
    throw new NodeTrustDomainError("Approved or rejected enrollment requests must include reviewedAt.");
  }
  if (new Date(updated.updatedAt).getTime() < new Date(updated.requestedAt).getTime()) {
    throw new NodeTrustDomainError("Node enrollment updatedAt cannot be earlier than requestedAt.");
  }

  return updated;
}
