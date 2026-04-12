import type { PlatformAuditEventRecord, PlatformRunRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import { deriveRunAssignmentRequirementSet } from "@application/runs/use-cases/RunAssignmentRequirementDerivation";
import { mapPlatformRunRecordToCanonicalRun } from "@application/runs/use-cases/RunCreationPersistenceMapper";
import type {
  AuthoritativeRunDispatchAttemptRecord,
  AuthoritativeRunQueueEntryRecord,
} from "@application/runs/ports/RunOrchestrationPersistencePorts";
import type {
  RunQueueSchedulingAdminSummary,
  RunSchedulingPriorityBand,
  RunSchedulingVisibilityProjection,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function parseReasonCodes(value: unknown): ReadonlyArray<string> {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }

  const normalized = value
    .map((entry) => normalizeOptional(entry))
    .filter((entry): entry is string => Boolean(entry));
  return Object.freeze([...new Set(normalized)]);
}

function mapPriorityBandFromScore(rolePriorityScore: number): RunSchedulingPriorityBand {
  if (rolePriorityScore >= 4) {
    return "critical";
  }
  if (rolePriorityScore >= 3) {
    return "high";
  }
  if (rolePriorityScore >= 2) {
    return "normal";
  }
  return "low";
}

function resolveLatestSchedulingAuditEvent(
  auditEvents: ReadonlyArray<PlatformAuditEventRecord>,
  action: string,
): PlatformAuditEventRecord | undefined {
  return [...auditEvents]
    .filter((event) => event.action === action)
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt) || right.eventId.localeCompare(left.eventId))[0];
}

function toReasonCodeCounts(values: ReadonlyArray<string>): ReadonlyArray<{ readonly code: string; readonly count: number }> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }

  return Object.freeze(
    [...counts.entries()]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([code, count]) => Object.freeze({ code, count })),
  );
}

export function buildRunSchedulingVisibilityProjection(input: {
  readonly runRecord: PlatformRunRecord;
  readonly queueEntry?: AuthoritativeRunQueueEntryRecord;
  readonly auditEvents?: ReadonlyArray<PlatformAuditEventRecord>;
  readonly dispatchAttempts?: ReadonlyArray<AuthoritativeRunDispatchAttemptRecord>;
}): RunSchedulingVisibilityProjection {
  const requirements = deriveRunAssignmentRequirementSet(input.runRecord);
  const auditEvents = input.auditEvents ?? Object.freeze([]);
  const latestPlacementSelectedEvent = resolveLatestSchedulingAuditEvent(
    auditEvents,
    "run.scheduling.priority-placement.selected",
  );
  const latestDeferredEvent = resolveLatestSchedulingAuditEvent(
    auditEvents,
    "run.scheduling.no-placement.deferred",
  );
  const selectedDetails = asRecord(latestPlacementSelectedEvent?.details);
  const deferredDetails = asRecord(latestDeferredEvent?.details);
  const selectedReasonCodes = parseReasonCodes(selectedDetails?.reasonCodes);
  const decisionReasonCodes = parseReasonCodes(
    selectedDetails?.reasonCodes ?? deferredDetails?.reasonCodes,
  );
  const exclusionReasonCodes = parseReasonCodes(deferredDetails?.exclusionReasonCodes);

  const rolePriorityScore = typeof selectedDetails?.rolePriorityScore === "number"
    ? selectedDetails.rolePriorityScore
    : undefined;
  const priorityBandRaw = normalizeOptional(selectedDetails?.priorityBand);
  const priorityBand = priorityBandRaw === "critical"
    || priorityBandRaw === "high"
    || priorityBandRaw === "normal"
    || priorityBandRaw === "low"
    ? priorityBandRaw
    : (typeof rolePriorityScore === "number" ? mapPriorityBandFromScore(rolePriorityScore) : undefined);
  const queueAgeSeconds = typeof selectedDetails?.queueAgeSeconds === "number"
    ? Math.max(0, Math.floor(selectedDetails.queueAgeSeconds))
    : undefined;

  const latestDispatchAttempt = [...(input.dispatchAttempts ?? Object.freeze([]))]
    .sort((left, right) => right.preparedAt.localeCompare(left.preparedAt) || right.attemptId.localeCompare(left.attemptId))[0];

  const assignmentNodeId = normalizeOptional(
    mapPlatformRunRecordToCanonicalRun(input.runRecord).assignment.assignedNodeId,
  );

  const queueReasonCodes = Object.freeze([...(input.queueEntry?.lastNoPlacementReasonCodes ?? Object.freeze([]))]);
  const placementReasonCodes = selectedReasonCodes.length > 0
    ? selectedReasonCodes
    : queueReasonCodes;
  const placementOutcome = assignmentNodeId
    ? "assignment-recommended" as const
    : input.queueEntry?.lastNoPlacementRecordedAt
      ? input.queueEntry.eligibilityMarker === "deferred"
        ? "deferred" as const
        : "no-placement" as const
      : "not-applicable" as const;

  return Object.freeze({
    effectivePriority: priorityBand && typeof rolePriorityScore === "number"
      ? Object.freeze({
        priorityBand,
        rolePriorityScore,
        queueAgeSeconds,
        asOf: latestPlacementSelectedEvent?.occurredAt ?? input.runRecord.initiatedAt,
      })
      : undefined,
    candidateConstraints: requirements
      ? Object.freeze({
        requiredCapabilities: Object.freeze([...requirements.requiredCapabilities]),
        requiresRemoteScheduling: requirements.requiresRemoteScheduling,
      })
      : undefined,
    defer: input.queueEntry
      ? Object.freeze({
        eligibilityMarker: input.queueEntry.eligibilityMarker,
        deferCount: Math.max(0, input.queueEntry.deferCount ?? 0),
        nextEligibleAt: input.queueEntry.eligibleAt,
        reasonCodes: queueReasonCodes,
        reasonMessage: input.queueEntry.lastNoPlacementReasonMessage,
        decisionId: input.queueEntry.lastNoPlacementDecisionId,
        recordedAt: input.queueEntry.lastNoPlacementRecordedAt,
      })
      : undefined,
    placement: Object.freeze({
      outcome: placementOutcome,
      selectedNodeId: assignmentNodeId ?? input.queueEntry?.assignmentNodeId,
      dispatchAttemptNodeId: latestDispatchAttempt?.nodeId,
      reasonCodes: placementReasonCodes,
      reasonMessage: input.queueEntry?.lastNoPlacementReasonMessage,
      decisionId: input.queueEntry?.lastNoPlacementDecisionId,
    }),
    admin: Object.freeze({
      requiresAdministrativeAttention: input.queueEntry?.lastNoPlacementRequiresAdministrativeAttention === true,
      noPlacementCategory: input.queueEntry?.lastNoPlacementCategory,
      reasonCodes: queueReasonCodes,
      decisionReasonCodes,
      exclusionReasonCodes,
    }),
  });
}

export function stripRunSchedulingAdminDiagnostics(
  scheduling: RunSchedulingVisibilityProjection | undefined,
): RunSchedulingVisibilityProjection | undefined {
  if (!scheduling || !scheduling.admin) {
    return scheduling;
  }

  return Object.freeze({
    ...scheduling,
    admin: undefined,
  });
}

export function buildRunQueueSchedulingAdminSummary(input: {
  readonly asOf: string;
  readonly items: ReadonlyArray<{ readonly scheduling?: RunSchedulingVisibilityProjection }>;
}): RunQueueSchedulingAdminSummary {
  const deferredRuns = input.items.filter((item) => (
    item.scheduling?.defer?.eligibilityMarker === "deferred"
    || item.scheduling?.placement.outcome === "deferred"
  )).length;
  const requiresAdministrativeAttentionRuns = input.items.filter((item) => (
    item.scheduling?.admin?.requiresAdministrativeAttention === true
  )).length;
  const reasonCodes = input.items.flatMap((item) => item.scheduling?.admin?.reasonCodes ?? Object.freeze([]));
  const decisionReasonCodes = input.items.flatMap((item) => (
    item.scheduling?.admin?.decisionReasonCodes ?? Object.freeze([])
  ));
  const exclusionReasonCodes = input.items.flatMap((item) => (
    item.scheduling?.admin?.exclusionReasonCodes ?? Object.freeze([])
  ));

  return Object.freeze({
    asOf: input.asOf,
    totalRuns: input.items.length,
    deferredRuns,
    requiresAdministrativeAttentionRuns,
    reasonCodes: toReasonCodeCounts(reasonCodes),
    decisionReasonCodes: toReasonCodeCounts(decisionReasonCodes),
    exclusionReasonCodes: toReasonCodeCounts(exclusionReasonCodes),
  });
}
