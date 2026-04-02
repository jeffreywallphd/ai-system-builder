export const ReferenceImagePerformancePhaseIds = Object.freeze({
  intake: "intake",
  preparation: "preparation",
  execution: "execution",
  persistence: "persistence",
  refresh: "refresh",
});

export type ReferenceImagePerformancePhaseId =
  typeof ReferenceImagePerformancePhaseIds[keyof typeof ReferenceImagePerformancePhaseIds];

export interface ReferenceImagePerformancePhaseMeasurement {
  readonly phaseId: ReferenceImagePerformancePhaseId;
  readonly durationMs: number;
}

export interface ReferenceImagePerformanceRunReport {
  readonly runId?: string;
  readonly startedAt: number;
  readonly finishedAt: number;
  readonly totalDurationMs: number;
  readonly phaseMeasurements: ReadonlyArray<ReferenceImagePerformancePhaseMeasurement>;
  readonly persistedItemCount: number;
  readonly batchItemCount: number;
  readonly status: "completed" | "failed" | "partially-completed";
}

export interface ReferenceImagePerformanceBaselineSummary {
  readonly scenario: "single" | "repeated" | "batch";
  readonly runCount: number;
  readonly averageDurationMs: number;
  readonly averagePersistedItems: number;
  readonly throughputItemsPerSecond: number;
  readonly slowestPhase?: {
    readonly phaseId: ReferenceImagePerformancePhaseId;
    readonly averageDurationMs: number;
  };
}

interface MutablePhase {
  readonly phaseId: ReferenceImagePerformancePhaseId;
  startedAt: number;
  finishedAt?: number;
}

function readNow(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export class ReferenceImagePerformanceTelemetrySession {
  private readonly startedAt = readNow();

  private readonly phases = new Map<ReferenceImagePerformancePhaseId, MutablePhase>();

  public startPhase(phaseId: ReferenceImagePerformancePhaseId): void {
    const existing = this.phases.get(phaseId);
    if (existing && existing.finishedAt === undefined) {
      return;
    }
    this.phases.set(phaseId, { phaseId, startedAt: readNow() });
  }

  public endPhase(phaseId: ReferenceImagePerformancePhaseId): void {
    const phase = this.phases.get(phaseId);
    if (!phase || phase.finishedAt !== undefined) {
      return;
    }
    phase.finishedAt = readNow();
  }

  public finalize(input: {
    readonly runId?: string;
    readonly status: ReferenceImagePerformanceRunReport["status"];
    readonly persistedItemCount?: number;
    readonly batchItemCount?: number;
  }): ReferenceImagePerformanceRunReport {
    const finishedAt = readNow();
    const measurements = Array.from(this.phases.values())
      .filter((phase) => phase.finishedAt !== undefined)
      .map((phase) => Object.freeze({
        phaseId: phase.phaseId,
        durationMs: Math.max(0, (phase.finishedAt as number) - phase.startedAt),
      }));

    return Object.freeze({
      runId: input.runId,
      startedAt: this.startedAt,
      finishedAt,
      totalDurationMs: Math.max(0, finishedAt - this.startedAt),
      phaseMeasurements: Object.freeze(measurements),
      persistedItemCount: Math.max(0, input.persistedItemCount ?? 0),
      batchItemCount: Math.max(0, input.batchItemCount ?? 0),
      status: input.status,
    });
  }
}

function summarizeScenario(
  scenario: ReferenceImagePerformanceBaselineSummary["scenario"],
  reports: ReadonlyArray<ReferenceImagePerformanceRunReport>,
): ReferenceImagePerformanceBaselineSummary | undefined {
  if (reports.length === 0) {
    return undefined;
  }

  const totalDurationMs = reports.reduce((sum, report) => sum + report.totalDurationMs, 0);
  const totalPersisted = reports.reduce((sum, report) => sum + report.persistedItemCount, 0);

  const phaseTotals = new Map<ReferenceImagePerformancePhaseId, number[]>();
  for (const report of reports) {
    for (const measurement of report.phaseMeasurements) {
      const existing = phaseTotals.get(measurement.phaseId) ?? [];
      existing.push(measurement.durationMs);
      phaseTotals.set(measurement.phaseId, existing);
    }
  }

  let slowestPhase: ReferenceImagePerformanceBaselineSummary["slowestPhase"];
  for (const [phaseId, durations] of phaseTotals.entries()) {
    const avg = average(durations);
    if (!slowestPhase || avg > slowestPhase.averageDurationMs) {
      slowestPhase = Object.freeze({ phaseId, averageDurationMs: avg });
    }
  }

  return Object.freeze({
    scenario,
    runCount: reports.length,
    averageDurationMs: totalDurationMs / reports.length,
    averagePersistedItems: totalPersisted / reports.length,
    throughputItemsPerSecond: totalDurationMs <= 0 ? 0 : (totalPersisted * 1000) / totalDurationMs,
    slowestPhase,
  });
}

export function buildReferenceImagePerformanceBaselines(
  reports: ReadonlyArray<ReferenceImagePerformanceRunReport>,
): ReadonlyArray<ReferenceImagePerformanceBaselineSummary> {
  const completedReports = reports.filter((report) => report.status !== "failed");
  if (completedReports.length === 0) {
    return Object.freeze([]);
  }

  const single = completedReports.filter((report) => report.batchItemCount <= 1);
  const repeated = completedReports.slice(Math.max(0, completedReports.length - 5));
  const batch = completedReports.filter((report) => report.batchItemCount > 1);

  return Object.freeze([
    summarizeScenario("single", single),
    summarizeScenario("repeated", repeated),
    summarizeScenario("batch", batch),
  ].filter((entry): entry is ReferenceImagePerformanceBaselineSummary => Boolean(entry)));
}
