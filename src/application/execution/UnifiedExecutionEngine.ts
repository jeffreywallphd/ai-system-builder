import {
  ExecutionPlan,
  ExecutionStatuses,
  type ExecutionStatus,
  type ExecutionUnitDefinition,
} from "@domain/execution/ExecutionPlan";
import type {
  IExecutionArtifact,
  IExecutionDiagnostics,
  IExecutionEngineEvent,
  IExecutionProvenance,
  IExecutionRunSnapshot,
} from "./ExecutionContracts";
import type {
  IExecutionRunRecord,
  IExecutionRunSummary,
  IExecutionRunTransitionRecord,
  IExecutionUnitRunRecord,
} from "@domain/execution/ExecutionRun";
import type { IExecutionRunRepository } from "../ports/interfaces/IExecutionRunRepository";
import { ExecutionRunHandle, type IExecutionRunHandle } from "./ExecutionRunHandle";

export interface IExecutionUnitExecutionRequest {
  readonly plan: ExecutionPlan;
  readonly runId: string;
  readonly unit: ExecutionUnitDefinition;
  readonly unitInputs?: Readonly<Record<string, unknown>>;
}

export interface IExecutionUnitExecutionResult {
  readonly unitId: string;
  readonly status: Extract<ExecutionStatus, "completed" | "failed" | "skipped" | "cancelled">;
  readonly outputMetadata?: Readonly<Record<string, unknown>>;
  readonly outputSummary?: IExecutionRunSummary;
  readonly errorMessage?: string;
  readonly provenance?: IExecutionProvenance;
  readonly diagnostics?: ReadonlyArray<IExecutionDiagnostics>;
  readonly artifacts?: ReadonlyArray<IExecutionArtifact>;
}

export interface IExecutionUnitRunHandle {
  readonly unitId: string;
  waitForCompletion(): Promise<IExecutionUnitExecutionResult>;
  cancel(): Promise<void>;
  subscribe?(
    listener: (event: IExecutionEngineEvent) => void
  ): Promise<() => void> | (() => void);
}

export interface IExecutionUnitHandler {
  canHandle(unit: ExecutionUnitDefinition): boolean;
  execute(
    request: IExecutionUnitExecutionRequest,
    onEvent?: (event: IExecutionEngineEvent) => void
  ): Promise<IExecutionUnitExecutionResult>;
  startExecution?(
    request: IExecutionUnitExecutionRequest,
    onEvent?: (event: IExecutionEngineEvent) => void
  ): Promise<IExecutionUnitRunHandle>;
}

export interface IExecutionPlanRequest {
  readonly plan: ExecutionPlan;
  readonly unitInputs?: Readonly<Record<string, unknown>>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface IExecutionUnitTransition {
  readonly unitId: string;
  readonly fromStatus?: ExecutionStatus;
  readonly toStatus: ExecutionStatus;
  readonly message?: string;
  readonly provenance?: IExecutionProvenance;
  readonly diagnostics?: ReadonlyArray<IExecutionDiagnostics>;
  readonly occurredAt: string;
}

export interface IExecutionPlanResult {
  readonly runId: string;
  readonly planId: string;
  readonly status: Extract<ExecutionStatus, "completed" | "failed" | "cancelled">;
  readonly unitStatuses: Readonly<Record<string, ExecutionStatus>>;
  readonly transitions: ReadonlyArray<IExecutionUnitTransition>;
  readonly unitResults: Readonly<Record<string, IExecutionUnitExecutionResult>>;
  readonly run: IExecutionRunSnapshot;
}

interface IExecutionUnitRuntimeState {
  readonly outputMetadata?: Readonly<Record<string, unknown>>;
  readonly outputSummary?: IExecutionRunSummary;
  readonly provenance?: IExecutionProvenance;
  readonly diagnostics?: ReadonlyArray<IExecutionDiagnostics>;
  readonly artifacts?: ReadonlyArray<IExecutionArtifact>;
  readonly errorMessage?: string;
  readonly updatedAt: string;
}

function freezeRecord<TValue>(value: Record<string, TValue>): Readonly<Record<string, TValue>> {
  return Object.freeze({ ...value });
}

function cloneArtifacts(artifacts?: ReadonlyArray<IExecutionArtifact>): ReadonlyArray<IExecutionArtifact> | undefined {
  return artifacts
    ? Object.freeze(artifacts.map((artifact) => Object.freeze({ ...artifact })))
    : undefined;
}

function cloneDiagnostics(
  diagnostics?: ReadonlyArray<IExecutionDiagnostics>,
): ReadonlyArray<IExecutionDiagnostics> | undefined {
  return diagnostics
    ? Object.freeze(diagnostics.map((diagnostic) => Object.freeze({ ...diagnostic })))
    : undefined;
}

function cloneSummary(summary?: IExecutionRunSummary): IExecutionRunSummary | undefined {
  return summary
    ? Object.freeze({
        ...summary,
        metadata: summary.metadata ? Object.freeze({ ...summary.metadata }) : undefined,
      })
    : undefined;
}

function cloneProvenance(provenance?: IExecutionProvenance): IExecutionProvenance | undefined {
  return provenance
    ? Object.freeze({
        ...provenance,
        fallback: provenance.fallback ? Object.freeze({ ...provenance.fallback }) : undefined,
        diagnostics: cloneDiagnostics(provenance.diagnostics),
        metadata: provenance.metadata ? Object.freeze({ ...provenance.metadata }) : undefined,
      })
    : undefined;
}

export class UnifiedExecutionEngine {
  private readonly handlers: ReadonlyArray<IExecutionUnitHandler>;

  constructor(
    handlers: ReadonlyArray<IExecutionUnitHandler>,
    private readonly executionRunRepository?: IExecutionRunRepository,
  ) {
    this.handlers = Object.freeze([...handlers]);
  }

  public async execute(
    request: IExecutionPlanRequest,
    onEvent?: (event: IExecutionEngineEvent) => void
  ): Promise<IExecutionPlanResult> {
    const handle = await this.startExecution(request, onEvent);
    return handle.waitForCompletion();
  }

  public async startExecution(
    request: IExecutionPlanRequest,
    onEvent?: (event: IExecutionEngineEvent) => void,
  ): Promise<IExecutionRunHandle> {
    const runId = this.createRunId(request.plan.id);
    const listeners = new Set<(event: IExecutionEngineEvent) => void>();
    const statuses = request.plan.units.reduce<Record<string, ExecutionStatus>>((acc, unit) => {
      acc[unit.id] = unit.dependsOn.length === 0 ? ExecutionStatuses.ready : ExecutionStatuses.pending;
      return acc;
    }, {});
    let cancellationRequested = false;
    let activeUnitHandle: IExecutionUnitRunHandle | undefined;
    const runtimeStates: Record<string, IExecutionUnitRuntimeState | undefined> = {};
    let persistCurrentRun: ((reason?: string) => Promise<void>) | undefined;

    const emit = (event: IExecutionEngineEvent) => {
      const nextRuntimeState = this.toRuntimeState(event);
      if (nextRuntimeState) {
        runtimeStates[event.unitId] = nextRuntimeState;
        void persistCurrentRun?.("event");
      }
      onEvent?.(event);
      for (const listener of listeners) {
        listener(event);
      }
    };

    const buildRunRecord = (params: {
      readonly unitResults: Readonly<Record<string, IExecutionUnitExecutionResult>>;
      readonly transitions: ReadonlyArray<IExecutionRunTransitionRecord>;
      readonly startedAt: string;
      readonly status?: ExecutionStatus;
      readonly completedAt?: string;
      readonly cancellationSupported: boolean;
      readonly metadata?: Readonly<Record<string, unknown>>;
    }): IExecutionRunRecord => {
      const units = request.plan.units.reduce<Record<string, IExecutionUnitRunRecord>>((acc, unit) => {
        const unitResult = params.unitResults[unit.id];
        const runtimeState = runtimeStates[unit.id];
        const matchingTransitions = params.transitions.filter((transition) => transition.unitId === unit.id);
        const runningTransition = matchingTransitions.find((transition) => transition.toStatus === ExecutionStatuses.running);
        const terminalTransition = [...matchingTransitions].reverse().find((transition) =>
          transition.toStatus === ExecutionStatuses.completed
          || transition.toStatus === ExecutionStatuses.failed
          || transition.toStatus === ExecutionStatuses.skipped
          || transition.toStatus === ExecutionStatuses.cancelled,
        );
        const latestTransition = matchingTransitions[matchingTransitions.length - 1];

        acc[unit.id] = Object.freeze({
          unitId: unit.id,
          kind: unit.kind,
          label: unit.label,
          dependsOn: Object.freeze([...unit.dependsOn]),
          status: statuses[unit.id],
          outputMetadata: unitResult?.outputMetadata
            ? Object.freeze({ ...unitResult.outputMetadata })
            : runtimeState?.outputMetadata
              ? Object.freeze({ ...runtimeState.outputMetadata })
              : undefined,
          outputSummary: cloneSummary(unitResult?.outputSummary ?? runtimeState?.outputSummary),
          errorMessage: unitResult?.errorMessage ?? runtimeState?.errorMessage,
          provenance: cloneProvenance(unitResult?.provenance ?? runtimeState?.provenance),
          diagnostics: cloneDiagnostics(unitResult?.diagnostics ?? runtimeState?.diagnostics),
          artifacts: cloneArtifacts(unitResult?.artifacts ?? runtimeState?.artifacts),
          startedAt: runningTransition?.occurredAt,
          completedAt: terminalTransition?.occurredAt,
          updatedAt: runtimeState?.updatedAt ?? latestTransition?.occurredAt ?? params.startedAt,
        });
        return acc;
      }, {});
      const finalStatus = params.status ?? this.derivePlanStatus(statuses, cancellationRequested);

      return Object.freeze({
        runId,
        planId: request.plan.id,
        status: finalStatus,
        unitIds: Object.freeze(request.plan.units.map((unit) => unit.id)),
        units: freezeRecord(units),
        transitions: Object.freeze(params.transitions.map((transition) => Object.freeze({ ...transition }))),
        startedAt: params.startedAt,
        updatedAt: params.completedAt ?? params.transitions[params.transitions.length - 1]?.occurredAt ?? params.startedAt,
        completedAt: params.completedAt,
        cancellationSupported: params.cancellationSupported,
        metadata: params.metadata ? Object.freeze({ ...params.metadata }) : undefined,
        terminalSummary: this.resolveTerminalSummary(finalStatus, params.unitResults),
        diagnosticsSummary: this.resolveDiagnosticsSummary(params.unitResults),
        finalErrorMessage: this.resolveFinalErrorMessage(finalStatus, params.unitResults),
      });
    };

    const startedAt = new Date().toISOString();
    const transitions: IExecutionRunTransitionRecord[] = [];
    const unitResults: Record<string, IExecutionUnitExecutionResult> = {};
    const supportsCancellation = request.plan.units.every((unit) => {
      const handler = this.resolveHandler(unit);
      return typeof handler.startExecution === "function";
    });

    let currentRun = buildRunRecord({
      unitResults,
      transitions,
      startedAt,
      cancellationSupported: supportsCancellation,
      metadata: request.metadata,
    });
    await this.persistRun(currentRun);
    persistCurrentRun = async () => {
      const nextRun = buildRunRecord({
        unitResults,
        transitions,
        startedAt,
        cancellationSupported: supportsCancellation,
        metadata: request.metadata,
      });
      currentRun = nextRun;
      handleRef?.updateSnapshot(nextRun);
      await this.persistRun(nextRun);
    };

    let handleRef: ExecutionRunHandle | undefined;

    const handle = new ExecutionRunHandle({
      runId,
      planId: request.plan.id,
      initialSnapshot: currentRun,
      cancel: async () => {
        cancellationRequested = true;
        if (activeUnitHandle) {
          await activeUnitHandle.cancel();
        }
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      completionPromise: Promise.resolve().then(() => this.executeRun({
        request,
        runId,
        statuses,
        startedAt,
        transitions,
        unitResults,
        buildRunRecord,
        setCurrentRun: async (run) => {
          currentRun = run;
          handleRef?.updateSnapshot(run);
          await this.persistRun(run);
        },
        emit,
        isCancellationRequested: () => cancellationRequested,
        setActiveUnitHandle: (nextHandle) => {
          activeUnitHandle = nextHandle;
        },
      })),
    });

    handleRef = handle;

    return handle;
  }

  private async executeRun(params: {
    readonly request: IExecutionPlanRequest;
    readonly runId: string;
    readonly statuses: Record<string, ExecutionStatus>;
    readonly startedAt: string;
    readonly transitions: IExecutionRunTransitionRecord[];
    readonly unitResults: Record<string, IExecutionUnitExecutionResult>;
    readonly buildRunRecord: (params: {
      readonly unitResults: Readonly<Record<string, IExecutionUnitExecutionResult>>;
      readonly transitions: ReadonlyArray<IExecutionRunTransitionRecord>;
      readonly startedAt: string;
      readonly status?: ExecutionStatus;
      readonly completedAt?: string;
      readonly cancellationSupported: boolean;
      readonly metadata?: Readonly<Record<string, unknown>>;
    }) => IExecutionRunRecord;
    readonly setCurrentRun: (run: IExecutionRunRecord) => Promise<void>;
    readonly emit: (event: IExecutionEngineEvent) => void;
    readonly isCancellationRequested: () => boolean;
    readonly setActiveUnitHandle: (handle: IExecutionUnitRunHandle | undefined) => void;
  }): Promise<IExecutionPlanResult> {
    const cancellationSupported = params.request.plan.units.every((unit) => {
      const handler = this.resolveHandler(unit);
      return typeof handler.startExecution === "function";
    });

    while (true) {
      if (params.isCancellationRequested()) {
        return this.finishRun({
          ...params,
          finalStatus: ExecutionStatuses.cancelled,
          message: "Execution run was cancelled before the next unit started.",
          failedUnitId: undefined,
          cancellationSupported,
        });
      }

      const readyUnits = params.request.plan.getReadyUnits(params.statuses);
      const nextUnit = readyUnits.find((unit) => params.statuses[unit.id] === ExecutionStatuses.ready)
        ?? readyUnits[0];

      if (!nextUnit) {
        break;
      }

      this.recordTransition({
        transitions: params.transitions,
        statuses: params.statuses,
        unitId: nextUnit.id,
        toStatus: ExecutionStatuses.running,
      });
      await params.setCurrentRun(params.buildRunRecord({
        unitResults: params.unitResults,
        transitions: params.transitions,
        startedAt: params.startedAt,
        cancellationSupported,
        metadata: params.request.metadata,
      }));
      params.emit({
        planId: params.request.plan.id,
        runId: params.runId,
        unitId: nextUnit.id,
        status: ExecutionStatuses.running,
        message: `Running execution unit '${nextUnit.id}'.`,
      });

      const handler = this.resolveHandler(nextUnit);
      const result = await this.executeUnit({
        handler,
        request: {
          plan: params.request.plan,
          runId: params.runId,
          unit: nextUnit,
          unitInputs: params.request.unitInputs,
        },
        onEvent: params.emit,
        setActiveUnitHandle: params.setActiveUnitHandle,
      });
      params.unitResults[nextUnit.id] = Object.freeze({
        ...result,
        outputMetadata: result.outputMetadata ? Object.freeze({ ...result.outputMetadata }) : undefined,
        outputSummary: cloneSummary(result.outputSummary),
        provenance: cloneProvenance(result.provenance),
        diagnostics: cloneDiagnostics(result.diagnostics),
        artifacts: cloneArtifacts(result.artifacts),
      });
      this.recordTransition({
        transitions: params.transitions,
        statuses: params.statuses,
        unitId: nextUnit.id,
        toStatus: result.status,
        message: result.errorMessage,
        provenance: result.provenance,
        diagnostics: result.diagnostics,
      });
      await params.setCurrentRun(params.buildRunRecord({
        unitResults: params.unitResults,
        transitions: params.transitions,
        startedAt: params.startedAt,
        cancellationSupported,
        metadata: params.request.metadata,
      }));

      if (result.status === ExecutionStatuses.failed || result.status === ExecutionStatuses.cancelled) {
        return this.finishRun({
          ...params,
          finalStatus: result.status,
          message: result.errorMessage,
          failedUnitId: nextUnit.id,
          cancellationSupported,
        });
      }

      this.refreshReadyStatuses(params.request.plan, params.statuses, params.transitions);
      await params.setCurrentRun(params.buildRunRecord({
        unitResults: params.unitResults,
        transitions: params.transitions,
        startedAt: params.startedAt,
        cancellationSupported,
        metadata: params.request.metadata,
      }));
    }

    const hasIncompleteUnits = params.request.plan.units.some((unit) => {
      const status = params.statuses[unit.id];
      return status !== ExecutionStatuses.completed && status !== ExecutionStatuses.skipped;
    });

    if (hasIncompleteUnits) {
      throw new Error(
        `Execution plan '${params.request.plan.id}' could not resolve the next executable unit.`,
      );
    }

    const completedAt = new Date().toISOString();
    const run = params.buildRunRecord({
      unitResults: params.unitResults,
      transitions: params.transitions,
      startedAt: params.startedAt,
      status: ExecutionStatuses.completed,
      completedAt,
      cancellationSupported,
      metadata: params.request.metadata,
    });
    await params.setCurrentRun(run);

    return Object.freeze({
      runId: params.runId,
      planId: params.request.plan.id,
      status: ExecutionStatuses.completed,
      unitStatuses: freezeRecord(params.statuses),
      transitions: Object.freeze(params.transitions.map((transition) => Object.freeze({ ...transition }))),
      unitResults: freezeRecord(params.unitResults),
      run,
    });
  }

  private async executeUnit(params: {
    readonly handler: IExecutionUnitHandler;
    readonly request: IExecutionUnitExecutionRequest;
    readonly onEvent: (event: IExecutionEngineEvent) => void;
    readonly setActiveUnitHandle: (handle: IExecutionUnitRunHandle | undefined) => void;
  }): Promise<IExecutionUnitExecutionResult> {
    if (typeof params.handler.startExecution !== "function") {
      params.setActiveUnitHandle(undefined);
      return params.handler.execute(params.request, params.onEvent);
    }

    const unitHandle = await params.handler.startExecution(params.request, params.onEvent);
    params.setActiveUnitHandle(unitHandle);

    try {
      let unsubscribe: (() => void) | undefined;
      if (typeof unitHandle.subscribe === "function") {
        const maybeUnsubscribe = await unitHandle.subscribe((event) => params.onEvent(event));
        unsubscribe = typeof maybeUnsubscribe === "function" ? maybeUnsubscribe : undefined;
      }

      try {
        return await unitHandle.waitForCompletion();
      } finally {
        unsubscribe?.();
      }
    } finally {
      params.setActiveUnitHandle(undefined);
    }
  }

  private async finishRun(params: {
    readonly request: IExecutionPlanRequest;
    readonly runId: string;
    readonly statuses: Record<string, ExecutionStatus>;
    readonly startedAt: string;
    readonly transitions: IExecutionRunTransitionRecord[];
    readonly unitResults: Record<string, IExecutionUnitExecutionResult>;
    readonly buildRunRecord: (params: {
      readonly unitResults: Readonly<Record<string, IExecutionUnitExecutionResult>>;
      readonly transitions: ReadonlyArray<IExecutionRunTransitionRecord>;
      readonly startedAt: string;
      readonly status?: ExecutionStatus;
      readonly completedAt?: string;
      readonly cancellationSupported: boolean;
      readonly metadata?: Readonly<Record<string, unknown>>;
    }) => IExecutionRunRecord;
    readonly setCurrentRun: (run: IExecutionRunRecord) => Promise<void>;
    readonly emit: (event: IExecutionEngineEvent) => void;
    readonly finalStatus: Extract<ExecutionStatus, "failed" | "cancelled">;
    readonly message?: string;
    readonly failedUnitId?: string;
    readonly cancellationSupported: boolean;
  }): Promise<IExecutionPlanResult> {
    this.skipRemainingUnits({
      plan: params.request.plan,
      statuses: params.statuses,
      transitions: params.transitions,
      failedUnitId: params.failedUnitId,
      finalStatus: params.finalStatus,
    });
    const completedAt = new Date().toISOString();
    const run = params.buildRunRecord({
      unitResults: params.unitResults,
      transitions: params.transitions,
      startedAt: params.startedAt,
      status: params.finalStatus,
      completedAt,
      cancellationSupported: params.cancellationSupported,
      metadata: params.request.metadata,
    });
    await params.setCurrentRun(run);
    params.emit({
      planId: params.request.plan.id,
      runId: params.runId,
      unitId: params.failedUnitId ?? params.request.plan.units[0]?.id ?? "plan",
      status: params.finalStatus,
      message: params.message,
    });

    return Object.freeze({
      runId: params.runId,
      planId: params.request.plan.id,
      status: params.finalStatus,
      unitStatuses: freezeRecord(params.statuses),
      transitions: Object.freeze(params.transitions.map((transition) => Object.freeze({ ...transition }))),
      unitResults: freezeRecord(params.unitResults),
      run,
    });
  }

  private refreshReadyStatuses(
    plan: ExecutionPlan,
    statuses: Record<string, ExecutionStatus>,
    transitions: IExecutionRunTransitionRecord[],
  ): void {
    for (const unit of plan.getReadyUnits(statuses)) {
      if (statuses[unit.id] === ExecutionStatuses.pending) {
        this.recordTransition({
          transitions,
          statuses,
          unitId: unit.id,
          toStatus: ExecutionStatuses.ready,
        });
      }
    }
  }

  private skipRemainingUnits(params: {
    readonly plan: ExecutionPlan;
    readonly statuses: Record<string, ExecutionStatus>;
    readonly transitions: IExecutionRunTransitionRecord[];
    readonly failedUnitId?: string;
    readonly finalStatus: Extract<ExecutionStatus, "failed" | "cancelled">;
  }): void {
    for (const unit of params.plan.units) {
      const status = params.statuses[unit.id];
      if (
        status === ExecutionStatuses.completed
        || status === ExecutionStatuses.failed
        || status === ExecutionStatuses.skipped
        || status === ExecutionStatuses.cancelled
      ) {
        continue;
      }

      this.recordTransition({
        transitions: params.transitions,
        statuses: params.statuses,
        unitId: unit.id,
        toStatus: params.finalStatus === ExecutionStatuses.cancelled ? ExecutionStatuses.cancelled : ExecutionStatuses.skipped,
        message: params.finalStatus === ExecutionStatuses.cancelled
          ? `Cancelled after '${params.failedUnitId ?? "run"}' stopped the plan.`
          : `Skipped after '${params.failedUnitId}' failed.`,
      });
    }
  }

  private resolveHandler(unit: ExecutionUnitDefinition): IExecutionUnitHandler {
    const handler = this.handlers.find((candidate) => candidate.canHandle(unit));

    if (!handler) {
      throw new Error(`No execution unit handler is registered for '${unit.kind}'.`);
    }

    return handler;
  }

  private recordTransition(params: {
    readonly transitions: IExecutionRunTransitionRecord[];
    readonly statuses: Record<string, ExecutionStatus>;
    readonly unitId: string;
    readonly toStatus: ExecutionStatus;
    readonly message?: string;
    readonly provenance?: IExecutionProvenance;
    readonly diagnostics?: ReadonlyArray<IExecutionDiagnostics>;
  }): void {
    const fromStatus = params.statuses[params.unitId];
    params.statuses[params.unitId] = params.toStatus;
    params.transitions.push(
      Object.freeze({
        unitId: params.unitId,
        fromStatus,
        toStatus: params.toStatus,
        message: params.message,
        provenance: cloneProvenance(params.provenance),
        diagnostics: cloneDiagnostics(params.diagnostics),
        occurredAt: new Date().toISOString(),
      })
    );
  }

  private derivePlanStatus(
    statuses: Readonly<Record<string, ExecutionStatus>>,
    cancellationRequested: boolean,
  ): ExecutionStatus {
    if (Object.values(statuses).some((status) => status === ExecutionStatuses.failed)) {
      return ExecutionStatuses.failed;
    }
    if (
      cancellationRequested
      || Object.values(statuses).some((status) => status === ExecutionStatuses.cancelled)
    ) {
      return ExecutionStatuses.cancelled;
    }
    if (Object.values(statuses).every((status) => status === ExecutionStatuses.completed || status === ExecutionStatuses.skipped)) {
      return ExecutionStatuses.completed;
    }
    if (Object.values(statuses).some((status) => status === ExecutionStatuses.running)) {
      return ExecutionStatuses.running;
    }
    if (Object.values(statuses).some((status) => status === ExecutionStatuses.ready)) {
      return ExecutionStatuses.ready;
    }
    return ExecutionStatuses.pending;
  }

  private resolveTerminalSummary(
    finalStatus: ExecutionStatus,
    unitResults: Readonly<Record<string, IExecutionUnitExecutionResult>>,
  ): IExecutionRunSummary | undefined {
    const results = Object.values(unitResults);
    const terminalResult = [...results].reverse().find((result) => result.status === finalStatus)
      ?? [...results].reverse().find((result) => result.outputSummary || result.errorMessage);

    if (finalStatus === ExecutionStatuses.failed) {
      return Object.freeze({
        headline: terminalResult?.outputSummary?.headline ?? "Execution failed",
        detail: terminalResult?.errorMessage ?? terminalResult?.outputSummary?.detail ?? "One or more execution units failed.",
      });
    }

    if (finalStatus === ExecutionStatuses.cancelled) {
      return Object.freeze({
        headline: terminalResult?.outputSummary?.headline ?? "Execution cancelled",
        detail: terminalResult?.errorMessage ?? terminalResult?.outputSummary?.detail ?? "Execution stopped before all units completed.",
      });
    }

    const completedCount = results.filter((result) => result.status === ExecutionStatuses.completed).length;
    return Object.freeze({
      headline: terminalResult?.outputSummary?.headline ?? "Execution completed",
      detail: terminalResult?.outputSummary?.detail ?? `${completedCount} execution unit${completedCount === 1 ? "" : "s"} completed successfully.`,
    });
  }

  private resolveDiagnosticsSummary(
    unitResults: Readonly<Record<string, IExecutionUnitExecutionResult>>,
  ): IExecutionRunSummary | undefined {
    const diagnostics = Object.values(unitResults).flatMap((result) => result.diagnostics ?? []);
    if (diagnostics.length === 0) {
      return undefined;
    }

    const severityOrder = { error: 3, warning: 2, info: 1 } as const;
    const topDiagnostic = [...diagnostics].sort((left, right) => severityOrder[right.severity] - severityOrder[left.severity])[0];

    const counts = diagnostics.reduce<Record<string, number>>((acc, diagnostic) => {
      acc[diagnostic.severity] = (acc[diagnostic.severity] ?? 0) + 1;
      return acc;
    }, {});

    return Object.freeze({
      headline: `${diagnostics.length} diagnostic${diagnostics.length === 1 ? "" : "s"} recorded`,
      detail: topDiagnostic ? `${topDiagnostic.severity}: ${topDiagnostic.message}` : undefined,
      metadata: Object.freeze({ ...counts }),
    });
  }

  private resolveFinalErrorMessage(
    finalStatus: ExecutionStatus,
    unitResults: Readonly<Record<string, IExecutionUnitExecutionResult>>,
  ): string | undefined {
    if (finalStatus === ExecutionStatuses.completed) {
      return undefined;
    }

    const terminalResult = Object.values(unitResults).find((result) => result.status === finalStatus)
      ?? Object.values(unitResults).find((result) => result.errorMessage);

    return terminalResult?.errorMessage;
  }

  private async persistRun(run: IExecutionRunRecord): Promise<void> {
    await this.executionRunRepository?.saveRun(run);
  }

  private toRuntimeState(event: IExecutionEngineEvent): IExecutionUnitRuntimeState | undefined {
    if (
      !event.outputMetadata
      && !event.outputSummary
      && !event.provenance
      && !event.diagnostics
      && !event.artifacts
      && !event.detail
      && !event.message
    ) {
      return undefined;
    }

    const artifacts = event.artifacts
      ? cloneArtifacts(event.artifacts)
      : event.detail
        ? Object.freeze([Object.freeze({ ...event.detail })])
        : undefined;

    return Object.freeze({
      outputMetadata: event.outputMetadata ? Object.freeze({ ...event.outputMetadata }) : undefined,
      outputSummary: cloneSummary(event.outputSummary),
      provenance: cloneProvenance(event.provenance),
      diagnostics: cloneDiagnostics(event.diagnostics),
      artifacts,
      errorMessage: event.status === ExecutionStatuses.failed || event.status === ExecutionStatuses.cancelled
        ? event.message
        : undefined,
      updatedAt: new Date().toISOString(),
    });
  }

  private createRunId(planId: string): string {
    const normalizedPlanId = planId.trim().replace(/[^a-zA-Z0-9_-]+/g, "-");
    return `${normalizedPlanId}-run-${Date.now()}`;
  }
}

