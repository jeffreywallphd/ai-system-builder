import type { PlatformRunRecord } from "@application/common/ports/PlatformPersistenceBoundaryPorts";
import {
  extractRunFinalizationSnapshot,
  mapPlatformRunRecordToCanonicalRun,
} from "@application/runs/use-cases/RunCreationPersistenceMapper";
import type {
  RunDetail,
  RunExecutionProgressSnapshot,
  RunLifecycleState,
  RunSummary,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import {
  toRunDetail,
  toRunSummary,
} from "@shared/contracts/runtime/RunOrchestrationTransportContracts";
import { RunLifecycleStates } from "@domain/runs/RunDomain";

export const RunHistoryNormalizedStatuses = Object.freeze({
  pending: "pending",
  active: "active",
  succeeded: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
});

export type RunHistoryNormalizedStatus =
  typeof RunHistoryNormalizedStatuses[keyof typeof RunHistoryNormalizedStatuses];

export interface RunHistoryMetadataHints {
  readonly normalizedStatus: RunHistoryNormalizedStatus;
  readonly progressSnapshot?: RunExecutionProgressSnapshot;
  readonly hasFailure: boolean;
  readonly hasResult: boolean;
}

export interface RunSummaryWithHistoryHints extends RunSummary {
  readonly ownerUserIdentityId?: string;
  readonly systemId?: string;
  readonly historyHints: RunHistoryMetadataHints;
}

export interface RunDetailWithHistoryHints extends RunDetail {
  readonly ownerUserIdentityId?: string;
  readonly systemId?: string;
  readonly historyHints: RunHistoryMetadataHints;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function resolveSystemId(record: PlatformRunRecord): string | undefined {
  const metadata = asRecord(record.metadata);
  const submissionSnapshot = asRecord(metadata?.submissionSnapshot);
  const runtimeTarget = asRecord(submissionSnapshot?.runtimeTarget);
  const systemId = typeof runtimeTarget?.systemId === "string"
    ? runtimeTarget.systemId
    : undefined;
  return normalizeOptional(systemId);
}

function resolveOwnerUserIdentityId(record: PlatformRunRecord): string | undefined {
  return normalizeOptional(record.userIdentityId);
}

function toNormalizedStatus(state: RunLifecycleState): RunHistoryNormalizedStatus {
  if (state === RunLifecycleStates.running || state === RunLifecycleStates.cancelling) {
    return RunHistoryNormalizedStatuses.active;
  }
  if (state === RunLifecycleStates.completed) {
    return RunHistoryNormalizedStatuses.succeeded;
  }
  if (state === RunLifecycleStates.failed) {
    return RunHistoryNormalizedStatuses.failed;
  }
  if (state === RunLifecycleStates.cancelled) {
    return RunHistoryNormalizedStatuses.cancelled;
  }
  return RunHistoryNormalizedStatuses.pending;
}

function toProgressSnapshot(record: PlatformRunRecord): RunExecutionProgressSnapshot | undefined {
  const run = mapPlatformRunRecordToCanonicalRun(record);
  const progress = run.execution.progress;
  if (!progress) {
    return undefined;
  }
  return Object.freeze({
    updatedAt: progress.updatedAt,
    percent: progress.percent,
    stage: progress.stage,
    message: progress.message,
  });
}

function hasResultSnapshot(record: PlatformRunRecord): boolean {
  const finalization = extractRunFinalizationSnapshot(record.metadata);
  if (!finalization) {
    return false;
  }
  return finalization.outputs.length > 0
    || Boolean(finalization.externalResultId)
    || Boolean(finalization.summary)
    || Boolean(finalization.metrics);
}

function toHistoryHints(record: PlatformRunRecord): RunHistoryMetadataHints {
  const run = mapPlatformRunRecordToCanonicalRun(record);
  return Object.freeze({
    normalizedStatus: toNormalizedStatus(run.state),
    progressSnapshot: toProgressSnapshot(record),
    hasFailure: run.execution.outcome === "failed",
    hasResult: hasResultSnapshot(record),
  });
}

export function toRunSummaryWithHistoryHints(record: PlatformRunRecord): RunSummaryWithHistoryHints {
  const run = mapPlatformRunRecordToCanonicalRun(record);
  const summary = toRunSummary(run);
  return Object.freeze({
    ...summary,
    ownerUserIdentityId: resolveOwnerUserIdentityId(record),
    systemId: resolveSystemId(record),
    historyHints: toHistoryHints(record),
  });
}

export function toRunDetailWithHistoryHints(record: PlatformRunRecord): RunDetailWithHistoryHints {
  const run = mapPlatformRunRecordToCanonicalRun(record);
  const detail = toRunDetail(run);
  const finalization = extractRunFinalizationSnapshot(record.metadata);

  return Object.freeze({
    ...detail,
    ...(finalization ? { finalization } : {}),
    ownerUserIdentityId: resolveOwnerUserIdentityId(record),
    systemId: resolveSystemId(record),
    historyHints: toHistoryHints(record),
  });
}
