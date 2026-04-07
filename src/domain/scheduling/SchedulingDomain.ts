import {
  WorkspaceAuthorizationRoleKeys,
  type WorkspaceAuthorizationRoleKey,
} from "@domain/authorization/AuthorizationRoleDefinitions";
import { NodeTypes, type NodeRoleCapability, type NodeType } from "@domain/nodes/NodeTrustDomain";

export class SchedulingDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchedulingDomainError";
  }
}

export const SchedulingPolicySourceKinds = Object.freeze({
  runSubmission: "run-submission",
  nodeTrustInventory: "node-trust-inventory",
  workspaceMembershipRoles: "workspace-membership-roles",
  deploymentProfile: "deployment-profile",
  activeReservations: "active-reservations",
  futureQuotaPolicy: "future-quota-policy",
  futureAffinityPolicy: "future-affinity-policy",
});

export type SchedulingPolicySourceKind =
  typeof SchedulingPolicySourceKinds[keyof typeof SchedulingPolicySourceKinds];

export const SchedulingDecisionOutcomes = Object.freeze({
  assignmentRecommended: "assignment-recommended",
  deferred: "deferred",
  denied: "denied",
});

export type SchedulingDecisionOutcome = typeof SchedulingDecisionOutcomes[keyof typeof SchedulingDecisionOutcomes];

export const SchedulingRunPriorityBands = Object.freeze({
  critical: "critical",
  high: "high",
  normal: "normal",
  low: "low",
});

export type SchedulingRunPriorityBand =
  typeof SchedulingRunPriorityBands[keyof typeof SchedulingRunPriorityBands];

export const SchedulingCandidateDenialCodes = Object.freeze({
  nodeNotSchedulable: "node-not-schedulable",
  nodeMissingCapability: "node-missing-capability",
  remoteSchedulingUnsupported: "remote-scheduling-unsupported",
  reservationConflict: "reservation-conflict",
  hybridLocalInteractiveProtection: "hybrid-local-interactive-protection",
  policyDenied: "policy-denied",
});

export type SchedulingCandidateDenialCode =
  typeof SchedulingCandidateDenialCodes[keyof typeof SchedulingCandidateDenialCodes];

export interface SchedulingPolicyReason {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface SchedulingRunRequirements {
  readonly requiredCapabilities: ReadonlyArray<NodeRoleCapability>;
  readonly requiresRemoteScheduling: boolean;
}

export interface SchedulingRunPolicyInput {
  readonly runId: string;
  readonly workspaceId?: string;
  readonly submittedByUserIdentityId?: string;
  readonly workspaceRoleKeys: ReadonlyArray<WorkspaceAuthorizationRoleKey | string>;
  readonly requirements: SchedulingRunRequirements;
  readonly queue: Readonly<{
    readonly queueId: string;
    readonly enteredAt: string;
    readonly eligibleAt: string;
    readonly claimToken: string;
    readonly claimOwner: string;
  }>;
}

export const SchedulingNodeUsageModes = Object.freeze({
  idle: "idle",
  remoteQueuedWork: "remote-queued-work",
  interactiveLocalSession: "interactive-local-session",
  maintenance: "maintenance",
});

export type SchedulingNodeUsageMode = typeof SchedulingNodeUsageModes[keyof typeof SchedulingNodeUsageModes];

export interface SchedulingNodePolicyInput {
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly schedulable: boolean;
  readonly supportsRemoteScheduling: boolean;
  readonly enabledCapabilities: ReadonlyArray<NodeRoleCapability>;
  readonly usageMode: SchedulingNodeUsageMode;
  readonly localInteractiveOwnerUserIdentityId?: string;
  readonly hybridLocalUseProtection?: Readonly<{
    readonly reservedLocalCapacityUnits?: number;
    readonly activeRemoteAssignmentCount?: number;
    readonly protectedLocalUserWindow?: Readonly<{
      readonly startsAt: string;
      readonly endsAt: string;
      readonly protectedUserIdentityId?: string;
    }>;
  }>;
  readonly reservationOwner?: string;
  readonly deploymentProfileId?: string;
}

export interface SchedulingCandidateScorecard {
  readonly priorityBand: SchedulingRunPriorityBand;
  readonly rolePriorityScore: number;
  readonly queueAgeSeconds: number;
}

export interface SchedulingCandidateDecision {
  readonly runId: string;
  readonly nodeId: string;
  readonly eligible: boolean;
  readonly denialReasons: ReadonlyArray<SchedulingPolicyReason>;
  readonly scorecard: SchedulingCandidateScorecard;
}

export interface SchedulingPolicyDecision {
  readonly decisionId: string;
  readonly occurredAt: string;
  readonly outcome: SchedulingDecisionOutcome;
  readonly selected?: Readonly<{
    readonly runId: string;
    readonly nodeId: string;
    readonly claimToken: string;
    readonly reservationOwner: string;
  }>;
  readonly evaluatedCandidates: ReadonlyArray<SchedulingCandidateDecision>;
  readonly reasons: ReadonlyArray<SchedulingPolicyReason>;
  readonly policySources: ReadonlyArray<SchedulingPolicySourceKind>;
}

const SchedulingPriorityOrder = Object.freeze([
  SchedulingRunPriorityBands.critical,
  SchedulingRunPriorityBands.high,
  SchedulingRunPriorityBands.normal,
  SchedulingRunPriorityBands.low,
]);

const SchedulingPriorityWeight = Object.freeze(
  SchedulingPriorityOrder.reduce<Record<SchedulingRunPriorityBand, number>>((acc, band, index) => {
    acc[band] = SchedulingPriorityOrder.length - index;
    return acc;
  }, Object.create(null) as Record<SchedulingRunPriorityBand, number>),
);

const WorkspaceRolePriorityBands = Object.freeze<Record<WorkspaceAuthorizationRoleKey, SchedulingRunPriorityBand>>({
  [WorkspaceAuthorizationRoleKeys.owner]: SchedulingRunPriorityBands.critical,
  [WorkspaceAuthorizationRoleKeys.admin]: SchedulingRunPriorityBands.high,
  [WorkspaceAuthorizationRoleKeys.member]: SchedulingRunPriorityBands.normal,
  [WorkspaceAuthorizationRoleKeys.viewer]: SchedulingRunPriorityBands.low,
});

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new SchedulingDomainError(`${field} is required.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeIsoTimestamp(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  if (Number.isNaN(Date.parse(normalized))) {
    throw new SchedulingDomainError(`${field} must be a valid ISO timestamp.`);
  }
  return normalized;
}

function normalizeUsageMode(value: SchedulingNodeUsageMode): SchedulingNodeUsageMode {
  if (!Object.values(SchedulingNodeUsageModes).includes(value)) {
    throw new SchedulingDomainError(`Scheduling node usage mode '${String(value)}' is invalid.`);
  }
  return value;
}

function toPolicyReason(
  code: string,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): SchedulingPolicyReason {
  return Object.freeze({
    code,
    message,
    details,
  });
}

function normalizePriorityBand(value: SchedulingRunPriorityBand): SchedulingRunPriorityBand {
  if (!Object.values(SchedulingRunPriorityBands).includes(value)) {
    throw new SchedulingDomainError(`Scheduling run priority band '${String(value)}' is invalid.`);
  }
  return value;
}

export function deriveSchedulingRunPriorityBand(
  roleKeys: ReadonlyArray<WorkspaceAuthorizationRoleKey | string>,
): SchedulingRunPriorityBand {
  if (roleKeys.length === 0) {
    return SchedulingRunPriorityBands.normal;
  }

  let winner = SchedulingRunPriorityBands.low;
  for (const roleKey of roleKeys) {
    if (typeof roleKey !== "string") {
      continue;
    }
    const normalizedRole = roleKey.trim().toLowerCase();
    if (!normalizedRole) {
      continue;
    }

    const priorityBand = WorkspaceRolePriorityBands[normalizedRole as WorkspaceAuthorizationRoleKey];
    if (!priorityBand) {
      continue;
    }
    if (SchedulingPriorityWeight[priorityBand] > SchedulingPriorityWeight[winner]) {
      winner = priorityBand;
    }
  }

  return winner;
}

export function evaluateHybridNodeLocalInteractiveProtection(input: {
  readonly asOf?: string;
  readonly nodeType: NodeType;
  readonly nodeUsageMode: SchedulingNodeUsageMode;
  readonly localInteractiveOwnerUserIdentityId?: string;
  readonly runSubmittedByUserIdentityId?: string;
  readonly hybridLocalUseProtection?: Readonly<{
    readonly reservedLocalCapacityUnits?: number;
    readonly activeRemoteAssignmentCount?: number;
    readonly protectedLocalUserWindow?: Readonly<{
      readonly startsAt: string;
      readonly endsAt: string;
      readonly protectedUserIdentityId?: string;
    }>;
  }>;
}): Readonly<{ allowed: boolean; reason?: SchedulingPolicyReason }> {
  const nodeUsageMode = normalizeUsageMode(input.nodeUsageMode);

  if (input.nodeType !== NodeTypes.hybrid) {
    return Object.freeze({ allowed: true });
  }
  const interactiveOwner = normalizeOptional(input.localInteractiveOwnerUserIdentityId);
  const runActor = normalizeOptional(input.runSubmittedByUserIdentityId);
  const hybridProtection = input.hybridLocalUseProtection;
  const sameInteractiveUser = Boolean(interactiveOwner && runActor && interactiveOwner === runActor);

  if (nodeUsageMode === SchedulingNodeUsageModes.interactiveLocalSession && !sameInteractiveUser) {
    return Object.freeze({
      allowed: false,
      reason: toPolicyReason(
        SchedulingCandidateDenialCodes.hybridLocalInteractiveProtection,
        "Hybrid node is reserved for a local interactive session and is not eligible for remote assignment.",
        Object.freeze({
          protectionKind: "interactive-local-session",
          nodeType: input.nodeType,
          usageMode: nodeUsageMode,
          localInteractiveOwnerUserIdentityId: interactiveOwner,
        }),
      ),
    });
  }

  const reservedLocalCapacityUnits = hybridProtection?.reservedLocalCapacityUnits;
  const activeRemoteAssignmentCount = hybridProtection?.activeRemoteAssignmentCount;
  if (
    typeof reservedLocalCapacityUnits === "number"
    && Number.isFinite(reservedLocalCapacityUnits)
    && reservedLocalCapacityUnits > 0
    && typeof activeRemoteAssignmentCount === "number"
    && Number.isFinite(activeRemoteAssignmentCount)
    && activeRemoteAssignmentCount >= reservedLocalCapacityUnits
    && !sameInteractiveUser
  ) {
    return Object.freeze({
      allowed: false,
      reason: toPolicyReason(
        SchedulingCandidateDenialCodes.hybridLocalInteractiveProtection,
        "Hybrid node remote-assignment capacity is constrained to preserve local interactive availability.",
        Object.freeze({
          protectionKind: "reserved-local-capacity",
          nodeType: input.nodeType,
          usageMode: nodeUsageMode,
          reservedLocalCapacityUnits,
          activeRemoteAssignmentCount,
        }),
      ),
    });
  }

  const protectedWindow = hybridProtection?.protectedLocalUserWindow;
  if (protectedWindow) {
    if (!input.asOf) {
      throw new SchedulingDomainError("Scheduling asOf is required when hybrid protected local-user windows are evaluated.");
    }
    const asOf = normalizeIsoTimestamp(input.asOf, "Scheduling asOf");
    const startsAt = normalizeIsoTimestamp(protectedWindow.startsAt, "Hybrid local protection startsAt");
    const endsAt = normalizeIsoTimestamp(protectedWindow.endsAt, "Hybrid local protection endsAt");
    if (Date.parse(startsAt) >= Date.parse(endsAt)) {
      throw new SchedulingDomainError("Hybrid local protection endsAt must be after startsAt.");
    }

    const protectedUserIdentityId = normalizeOptional(protectedWindow.protectedUserIdentityId);
    const inProtectedWindow = Date.parse(asOf) >= Date.parse(startsAt) && Date.parse(asOf) < Date.parse(endsAt);
    const protectedUserMatch = Boolean(
      protectedUserIdentityId
      && runActor
      && protectedUserIdentityId === runActor,
    );

    if (inProtectedWindow && !protectedUserMatch) {
      return Object.freeze({
        allowed: false,
        reason: toPolicyReason(
          SchedulingCandidateDenialCodes.hybridLocalInteractiveProtection,
          "Hybrid node is in a protected local-user window and is not eligible for remote assignment.",
          Object.freeze({
            protectionKind: "protected-local-user-window",
            nodeType: input.nodeType,
            usageMode: nodeUsageMode,
            protectedUserIdentityId,
            startsAt,
            endsAt,
          }),
        ),
      });
    }
  }

  return Object.freeze({ allowed: true });
}

export function evaluateSchedulingCandidate(input: {
  readonly asOf: string;
  readonly run: SchedulingRunPolicyInput;
  readonly node: SchedulingNodePolicyInput;
}): SchedulingCandidateDecision {
  const asOf = normalizeIsoTimestamp(input.asOf, "Scheduling asOf");
  const runId = normalizeRequired(input.run.runId, "Scheduling runId");
  const nodeId = normalizeRequired(input.node.nodeId, "Scheduling nodeId");
  const priorityBand = deriveSchedulingRunPriorityBand(input.run.workspaceRoleKeys);

  const denialReasons: SchedulingPolicyReason[] = [];

  if (!input.node.schedulable) {
    denialReasons.push(toPolicyReason(
      SchedulingCandidateDenialCodes.nodeNotSchedulable,
      `Node '${nodeId}' is not schedulable.`,
    ));
  }

  const nodeCapabilities = new Set(input.node.enabledCapabilities);
  for (const capability of input.run.requirements.requiredCapabilities) {
    if (!nodeCapabilities.has(capability)) {
      denialReasons.push(toPolicyReason(
        SchedulingCandidateDenialCodes.nodeMissingCapability,
        `Node '${nodeId}' is missing required capability '${capability}'.`,
        Object.freeze({ requiredCapability: capability }),
      ));
    }
  }

  if (input.run.requirements.requiresRemoteScheduling && !input.node.supportsRemoteScheduling) {
    denialReasons.push(toPolicyReason(
      SchedulingCandidateDenialCodes.remoteSchedulingUnsupported,
      `Node '${nodeId}' does not support remote scheduling.`,
    ));
  }

  const localProtection = evaluateHybridNodeLocalInteractiveProtection({
    asOf,
    nodeType: input.node.nodeType,
    nodeUsageMode: input.node.usageMode,
    localInteractiveOwnerUserIdentityId: input.node.localInteractiveOwnerUserIdentityId,
    runSubmittedByUserIdentityId: input.run.submittedByUserIdentityId,
    hybridLocalUseProtection: input.node.hybridLocalUseProtection,
  });
  if (!localProtection.allowed && localProtection.reason) {
    denialReasons.push(localProtection.reason);
  }

  if (input.node.reservationOwner && input.node.reservationOwner !== input.run.queue.claimOwner) {
    denialReasons.push(toPolicyReason(
      SchedulingCandidateDenialCodes.reservationConflict,
      `Node '${nodeId}' is reserved by another scheduling owner.`,
      Object.freeze({
        reservationOwner: input.node.reservationOwner,
        claimOwner: input.run.queue.claimOwner,
      }),
    ));
  }

  const queueAgeSeconds = Math.max(0, Math.floor((Date.parse(asOf) - Date.parse(input.run.queue.enteredAt)) / 1000));

  return Object.freeze({
    runId,
    nodeId,
    eligible: denialReasons.length === 0,
    denialReasons: Object.freeze(denialReasons),
    scorecard: Object.freeze({
      priorityBand,
      rolePriorityScore: SchedulingPriorityWeight[priorityBand],
      queueAgeSeconds,
    }),
  });
}

export function createSchedulingPolicyDecision(input: {
  readonly decisionId: string;
  readonly occurredAt: string;
  readonly outcome: SchedulingDecisionOutcome;
  readonly selected?: {
    readonly runId: string;
    readonly nodeId: string;
    readonly claimToken: string;
    readonly reservationOwner: string;
  };
  readonly evaluatedCandidates: ReadonlyArray<SchedulingCandidateDecision>;
  readonly reasons?: ReadonlyArray<SchedulingPolicyReason>;
  readonly policySources: ReadonlyArray<SchedulingPolicySourceKind>;
}): SchedulingPolicyDecision {
  const decisionId = normalizeRequired(input.decisionId, "Scheduling decisionId");
  const occurredAt = normalizeIsoTimestamp(input.occurredAt, "Scheduling occurredAt");

  if (!Object.values(SchedulingDecisionOutcomes).includes(input.outcome)) {
    throw new SchedulingDomainError(`Scheduling decision outcome '${String(input.outcome)}' is invalid.`);
  }

  if (input.selected && input.outcome !== SchedulingDecisionOutcomes.assignmentRecommended) {
    throw new SchedulingDomainError("Scheduling selected assignment is only allowed for assignment-recommended outcome.");
  }

  const selected = input.selected
    ? Object.freeze({
      runId: normalizeRequired(input.selected.runId, "Scheduling selected runId"),
      nodeId: normalizeRequired(input.selected.nodeId, "Scheduling selected nodeId"),
      claimToken: normalizeRequired(input.selected.claimToken, "Scheduling selected claimToken"),
      reservationOwner: normalizeRequired(input.selected.reservationOwner, "Scheduling selected reservationOwner"),
    })
    : undefined;

  const policySources = Object.freeze([...new Set(input.policySources.values())]);
  if (policySources.length === 0) {
    throw new SchedulingDomainError("Scheduling policySources must include at least one authoritative source.");
  }

  for (const source of policySources) {
    if (!Object.values(SchedulingPolicySourceKinds).includes(source)) {
      throw new SchedulingDomainError(`Scheduling policy source '${String(source)}' is invalid.`);
    }
  }

  const candidates = Object.freeze(input.evaluatedCandidates.map((candidate) => Object.freeze({
    ...candidate,
    scorecard: Object.freeze({
      priorityBand: normalizePriorityBand(candidate.scorecard.priorityBand),
      rolePriorityScore: candidate.scorecard.rolePriorityScore,
      queueAgeSeconds: candidate.scorecard.queueAgeSeconds,
    }),
    denialReasons: Object.freeze([...candidate.denialReasons]),
  })));

  return Object.freeze({
    decisionId,
    occurredAt,
    outcome: input.outcome,
    selected,
    evaluatedCandidates: candidates,
    reasons: Object.freeze([...(input.reasons ?? [])]),
    policySources,
  });
}
