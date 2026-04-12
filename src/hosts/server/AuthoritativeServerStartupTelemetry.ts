import type { HostBootConfiguration } from "@application/common/HostCompositionContracts";
import type { StartupTracer } from "../bootstrap/startupTracer";
import type { AuthoritativeServerStartupBaselineRecordResult } from "./AuthoritativeServerStartupBaselineRecorder";
import type { AuthoritativeServerBootstrapReadinessReport } from "./AuthoritativeServerBootstrapOrchestrator";

export interface AuthoritativeServerPipelineStageSummary {
  readonly stageId: string;
  readonly sequence: number;
  readonly status: "completed" | "failed";
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly failure?: Readonly<Record<string, string>>;
}

export interface AuthoritativeServerStartupTelemetryLogger {
  info(event: Readonly<Record<string, unknown>>): void;
  warn(event: Readonly<Record<string, unknown>>): void;
  error(event: Readonly<Record<string, unknown>>): void;
}

export interface AuthoritativeServerStartupBaselineMeasurement {
  readonly hostId: string;
  readonly startupReason: string;
  readonly outcome: "succeeded" | "failed";
  readonly durationMs: number;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly traceId?: string;
  readonly startupCorrelationId?: string;
  readonly pipelineStageDurations: Readonly<Record<string, number>>;
  readonly authoritativeStageDurations: Readonly<Record<string, number>>;
}

export type AuthoritativeServerRecordStartupBaseline = (
  measurement: AuthoritativeServerStartupBaselineMeasurement,
) => Promise<AuthoritativeServerStartupBaselineRecordResult | void> | AuthoritativeServerStartupBaselineRecordResult | void;

interface AuthoritativeServerStageRuntimeStatus {
  readonly stageId: string;
  readonly sequence: number;
  readonly state: string;
  readonly durationMs?: number;
  readonly failure?: Readonly<Record<string, string>>;
}

function emitInfo(
  logger: AuthoritativeServerStartupTelemetryLogger | undefined,
  event: Readonly<Record<string, unknown>>,
): void {
  if (logger) {
    logger.info(event);
    return;
  }
  console.info(event);
}

function emitWarn(
  logger: AuthoritativeServerStartupTelemetryLogger | undefined,
  event: Readonly<Record<string, unknown>>,
): void {
  if (logger) {
    logger.warn(event);
    return;
  }
  console.warn(event);
}

function emitError(
  logger: AuthoritativeServerStartupTelemetryLogger | undefined,
  event: Readonly<Record<string, unknown>>,
): void {
  if (logger) {
    logger.error(event);
    return;
  }
  console.error(event);
}

export function summarizeStartupError(error: unknown): Readonly<Record<string, string>> {
  if (error instanceof Error) {
    return Object.freeze({
      name: error.name || "Error",
      message: error.message || "Authoritative server startup failed.",
    });
  }
  return Object.freeze({
    name: "Error",
    message: String(error),
  });
}

export function attachStartupCorrelationIdToError(
  error: unknown,
  startupCorrelationId: string | undefined,
): void {
  if (!(error instanceof Error) || !startupCorrelationId) {
    return;
  }
  (error as Error & { startupCorrelationId?: string }).startupCorrelationId = startupCorrelationId;
  (error as Error & { traceId?: string }).traceId = startupCorrelationId;
}

function resolveSummaryReadinessReport(input: {
  readonly startupReadinessReport: AuthoritativeServerBootstrapReadinessReport;
  readonly authoritativeStageStatus: ReadonlyArray<AuthoritativeServerStageRuntimeStatus>;
  readonly pipelineFailures: ReadonlyArray<unknown>;
}): AuthoritativeServerBootstrapReadinessReport {
  if (
    input.startupReadinessReport.totalCheckCount > 0
    || input.authoritativeStageStatus.length > 0
  ) {
    return input.startupReadinessReport;
  }
  return Object.freeze({
    ...input.startupReadinessReport,
    state: input.pipelineFailures.length > 0 ? "degraded" : "not-ready",
  } satisfies AuthoritativeServerBootstrapReadinessReport);
}

function createStartupSummary(input: {
  readonly boot: HostBootConfiguration;
  readonly startupTracer: StartupTracer | undefined;
  readonly startupStartedAt: string;
  readonly startupCompletedAt: string;
  readonly startupDurationMs: number;
  readonly startupFailure: unknown | undefined;
  readonly pipelineStageSummaries: ReadonlyArray<AuthoritativeServerPipelineStageSummary>;
  readonly authoritativeStageStatus: ReadonlyArray<AuthoritativeServerStageRuntimeStatus>;
  readonly startupReadinessReport: AuthoritativeServerBootstrapReadinessReport;
}): Readonly<Record<string, unknown>> {
  const pipelineFailures = input.pipelineStageSummaries
    .filter((stage) => stage.status === "failed")
    .map((stage) => Object.freeze({
      stageId: stage.stageId,
      sequence: stage.sequence,
      failure: stage.failure,
    }));
  const summaryReadinessReport = resolveSummaryReadinessReport({
    startupReadinessReport: input.startupReadinessReport,
    authoritativeStageStatus: input.authoritativeStageStatus,
    pipelineFailures,
  });
  return Object.freeze({
    event: "authoritative-server.startup.summary",
    hostId: input.boot.host.hostId,
    startupReason: input.boot.startupReason,
    outcome: input.startupFailure ? "failed" : "succeeded",
    traceId: input.startupTracer?.traceId,
    startupCorrelationId: input.startupTracer?.startupCorrelationId,
    startedAt: input.startupStartedAt,
    completedAt: input.startupCompletedAt,
    durationMs: input.startupDurationMs,
    pipeline: Object.freeze({
      stageCount: input.pipelineStageSummaries.length,
      stages: Object.freeze([...input.pipelineStageSummaries]),
      failedStageCount: pipelineFailures.length,
      failures: Object.freeze(pipelineFailures),
    }),
    authoritativeStages: Object.freeze({
      stageCount: input.authoritativeStageStatus.length,
      stages: Object.freeze(input.authoritativeStageStatus),
      failedStageCount: input.authoritativeStageStatus.filter((stage) => stage.state === "failed").length,
      failures: Object.freeze(input.authoritativeStageStatus
        .filter((stage) => stage.state === "failed")
        .map((stage) => Object.freeze({
          stageId: stage.stageId,
          sequence: stage.sequence,
          failure: stage.failure,
        }))),
    }),
    startupResult: Object.freeze({
      outcome: input.startupFailure ? "failed" : "succeeded",
      readiness: summaryReadinessReport,
    }),
    startupFailure: input.startupFailure ? summarizeStartupError(input.startupFailure) : undefined,
  });
}

function createBaselineMeasurement(input: {
  readonly summary: Readonly<Record<string, unknown>>;
  readonly pipelineStageSummaries: ReadonlyArray<AuthoritativeServerPipelineStageSummary>;
  readonly authoritativeStageStatus: ReadonlyArray<AuthoritativeServerStageRuntimeStatus>;
}): AuthoritativeServerStartupBaselineMeasurement {
  return Object.freeze({
    hostId: input.summary.hostId as string,
    startupReason: input.summary.startupReason as string,
    outcome: input.summary.outcome as "succeeded" | "failed",
    durationMs: input.summary.durationMs as number,
    startedAt: input.summary.startedAt as string,
    completedAt: input.summary.completedAt as string,
    traceId: input.summary.traceId as string | undefined,
    startupCorrelationId: input.summary.startupCorrelationId as string | undefined,
    pipelineStageDurations: Object.freeze(Object.fromEntries(
      input.pipelineStageSummaries.map((stage) => [stage.stageId, stage.durationMs] as const),
    )),
    authoritativeStageDurations: Object.freeze(Object.fromEntries(
      input.authoritativeStageStatus
        .filter((stage) => typeof stage.durationMs === "number")
        .map((stage) => [stage.stageId, stage.durationMs ?? 0] as const),
    )),
  });
}

export async function emitAuthoritativeServerStartupTelemetry(input: {
  readonly boot: HostBootConfiguration;
  readonly startupTracer: StartupTracer | undefined;
  readonly startupStartedAtMs: number;
  readonly startupStartedAt: string;
  readonly startupFailure: unknown | undefined;
  readonly pipelineStageSummaries: ReadonlyArray<AuthoritativeServerPipelineStageSummary>;
  readonly authoritativeStageStatus: ReadonlyArray<AuthoritativeServerStageRuntimeStatus>;
  readonly startupReadinessReport: AuthoritativeServerBootstrapReadinessReport;
  readonly logger?: AuthoritativeServerStartupTelemetryLogger;
  readonly recordStartupBaseline?: AuthoritativeServerRecordStartupBaseline;
}): Promise<void> {
  const startupCompletedAtMs = Date.now();
  const startupCompletedAt = new Date(startupCompletedAtMs).toISOString();
  const summary = createStartupSummary({
    boot: input.boot,
    startupTracer: input.startupTracer,
    startupStartedAt: input.startupStartedAt,
    startupCompletedAt,
    startupDurationMs: Math.max(0, startupCompletedAtMs - input.startupStartedAtMs),
    startupFailure: input.startupFailure,
    pipelineStageSummaries: input.pipelineStageSummaries,
    authoritativeStageStatus: input.authoritativeStageStatus,
    startupReadinessReport: input.startupReadinessReport,
  });

  if (input.startupFailure) {
    emitError(input.logger, summary);
  } else {
    emitInfo(input.logger, summary);
  }

  if (!input.recordStartupBaseline) {
    return;
  }

  const startupBaselineMeasurement = createBaselineMeasurement({
    summary,
    pipelineStageSummaries: input.pipelineStageSummaries,
    authoritativeStageStatus: input.authoritativeStageStatus,
  });

  try {
    const baselineRecord = await input.recordStartupBaseline(startupBaselineMeasurement);
    const regressionWarning = baselineRecord?.regressionWarning;
    if (!regressionWarning) {
      return;
    }
    emitWarn(input.logger, Object.freeze({
      event: "authoritative-server.startup.baseline-regression.detected",
      hostId: startupBaselineMeasurement.hostId,
      startupReason: startupBaselineMeasurement.startupReason,
      traceId: startupBaselineMeasurement.traceId,
      startupCorrelationId: startupBaselineMeasurement.startupCorrelationId,
      baselinePath: baselineRecord?.baselinePath,
      sampleCount: baselineRecord?.sampleCount,
      thresholdMs: regressionWarning.thresholdMs,
      baselineDurationMs: regressionWarning.baselineDurationMs,
      currentDurationMs: regressionWarning.currentDurationMs,
      regressionDurationMs: regressionWarning.regressionDurationMs,
      previousSampleCount: regressionWarning.previousSampleCount,
    }));
  } catch (baselineError) {
    emitWarn(input.logger, Object.freeze({
      event: "authoritative-server.startup.baseline-recording.failed",
      hostId: startupBaselineMeasurement.hostId,
      startupReason: startupBaselineMeasurement.startupReason,
      traceId: startupBaselineMeasurement.traceId,
      startupCorrelationId: startupBaselineMeasurement.startupCorrelationId,
      error: summarizeStartupError(baselineError),
    }));
  }
}
