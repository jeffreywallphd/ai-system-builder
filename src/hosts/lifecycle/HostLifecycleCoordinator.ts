import {
  HostCompositionContractError,
  HostLifecycleEventTypes,
  HostLifecyclePhases,
  transitionHostLifecyclePhase,
  type HostBootConfiguration,
  type HostLifecycleEvent,
  type HostLifecyclePhase,
  type HostLifecycleReadinessMarker,
  type HostLifecycleTransition,
} from "@application/common/HostCompositionContracts";

export type HostLifecycleCleanupHook = (context: {
  readonly hostId: string;
  readonly phase: HostLifecyclePhase;
  readonly signal: AbortSignal;
  readonly reason: string;
  readonly hookId: string;
}) => void | Promise<void>;

export interface HostLifecycleCoordinatorOptions {
  readonly boot: HostBootConfiguration;
  readonly onEvent?: (event: HostLifecycleEvent) => void | Promise<void>;
}

export interface HostLifecycleShutdownOptions {
  readonly shutdownRequestedReason: string;
  readonly shutdownCompletedReason: string;
  readonly shutdownFailureReason: string;
  readonly cleanupHooks?: ReadonlyArray<{
    readonly hookId: string;
    readonly run: HostLifecycleCleanupHook;
  }>;
}

export interface HostLifecycleStartupFailureCleanupOptions {
  readonly cleanupReason: string;
  readonly cleanupFailureReason: string;
  readonly cleanupHooks?: ReadonlyArray<{
    readonly hookId: string;
    readonly run: HostLifecycleCleanupHook;
  }>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new HostCompositionContractError(`${field} is required.`);
  }
  return normalized;
}

function resolveIsoNow(): string {
  return new Date().toISOString();
}

export class HostLifecycleCoordinator {
  private phaseValue: HostLifecyclePhase = HostLifecyclePhases.configured;
  private readonly transitionHistoryValue: HostLifecycleTransition[] = [];
  private readonly lifecycleEventsValue: HostLifecycleEvent[] = [];
  private readinessValue: HostLifecycleReadinessMarker | undefined;
  private readonly shutdownController = new AbortController();

  constructor(private readonly options: HostLifecycleCoordinatorOptions) {}

  get hostId(): string {
    return this.options.boot.host.hostId;
  }

  get phase(): HostLifecyclePhase {
    return this.phaseValue;
  }

  get transitionHistory(): ReadonlyArray<HostLifecycleTransition> {
    return Object.freeze([...this.transitionHistoryValue]);
  }

  get lifecycleEvents(): ReadonlyArray<HostLifecycleEvent> {
    return Object.freeze([...this.lifecycleEventsValue]);
  }

  get readiness(): HostLifecycleReadinessMarker | undefined {
    return this.readinessValue;
  }

  get shutdownSignal(): AbortSignal {
    return this.shutdownController.signal;
  }

  async markComposing(reason: string): Promise<void> {
    await this.recordTransition(HostLifecyclePhases.composing, reason);
  }

  async markStarting(reason: string): Promise<void> {
    if (this.phaseValue === HostLifecyclePhases.composing) {
      await this.recordTransition(HostLifecyclePhases.starting, reason);
    }
  }

  async markStartupCompleted(input: {
    readonly transitionReason: string;
    readonly completionReason: string;
    readonly readinessMarker: string;
    readonly metadata?: Readonly<Record<string, string>>;
  }): Promise<void> {
    if (this.phaseValue !== HostLifecyclePhases.starting) {
      throw new HostCompositionContractError(
        `Host '${this.hostId}' cannot mark startup completion while phase is '${this.phaseValue}'.`,
      );
    }

    await this.recordTransition(HostLifecyclePhases.ready, input.transitionReason);
    const readiness: HostLifecycleReadinessMarker = Object.freeze({
      marker: normalizeRequired(input.readinessMarker, "Host lifecycle readiness marker"),
      markedAt: resolveIsoNow(),
    });
    this.readinessValue = readiness;

    await this.emitEvent({
      type: HostLifecycleEventTypes.startupCompleted,
      reason: input.completionReason,
      readiness,
      metadata: input.metadata,
    });
    await this.emitEvent({
      type: HostLifecycleEventTypes.readinessMarked,
      reason: input.transitionReason,
      readiness,
      metadata: input.metadata,
    });
  }

  async markStartupFailed(reason: string, error: unknown): Promise<void> {
    if (this.phaseValue !== HostLifecyclePhases.failed && this.phaseValue !== HostLifecyclePhases.stopped) {
      await this.recordTransition(HostLifecyclePhases.failed, reason);
    }
    await this.emitEvent({
      type: HostLifecycleEventTypes.startupFailed,
      reason,
      error,
    });
  }

  async shutdown(options: HostLifecycleShutdownOptions): Promise<void> {
    if (this.phaseValue === HostLifecyclePhases.stopped || this.phaseValue === HostLifecyclePhases.failed) {
      return;
    }

    this.shutdownController.abort(new Error(options.shutdownRequestedReason));
    await this.emitEvent({
      type: HostLifecycleEventTypes.shutdownRequested,
      reason: options.shutdownRequestedReason,
    });
    await this.recordTransition(HostLifecyclePhases.stopping, options.shutdownRequestedReason);

    const cleanupErrors = await this.executeCleanupHooks(
      options.shutdownRequestedReason,
      options.shutdownFailureReason,
      options.cleanupHooks ?? [],
      this.shutdownController.signal,
    );

    if (cleanupErrors.length > 0) {
      await this.recordTransition(HostLifecyclePhases.failed, options.shutdownFailureReason);
      if (cleanupErrors.length === 1) {
        throw cleanupErrors[0];
      }
      throw new AggregateError(cleanupErrors, `Host '${this.hostId}' shutdown cleanup encountered failures.`);
    }

    await this.recordTransition(HostLifecyclePhases.stopped, options.shutdownCompletedReason);
    await this.emitEvent({
      type: HostLifecycleEventTypes.shutdownCompleted,
      reason: options.shutdownCompletedReason,
      readiness: this.readinessValue,
    });
  }

  async runStartupFailureCleanup(options: HostLifecycleStartupFailureCleanupOptions): Promise<void> {
    const cleanupErrors = await this.executeCleanupHooks(
      options.cleanupReason,
      options.cleanupFailureReason,
      options.cleanupHooks ?? [],
      this.shutdownController.signal,
    );
    if (cleanupErrors.length < 1) {
      return;
    }
    if (cleanupErrors.length === 1) {
      throw cleanupErrors[0];
    }
    throw new AggregateError(cleanupErrors, `Host '${this.hostId}' startup failure cleanup encountered failures.`);
  }

  private async recordTransition(to: HostLifecyclePhase, reason: string): Promise<void> {
    const transition = transitionHostLifecyclePhase({
      hostId: this.hostId,
      from: this.phaseValue,
      to,
      occurredAt: resolveIsoNow(),
      reason,
    });
    this.transitionHistoryValue.push(transition);
    this.phaseValue = to;
    await this.emitEvent({
      type: HostLifecycleEventTypes.transitionRecorded,
      reason,
      transition,
    });
  }

  private async emitEvent(input: {
    readonly type: HostLifecycleEvent["type"];
    readonly reason: string;
    readonly transition?: HostLifecycleTransition;
    readonly readiness?: HostLifecycleReadinessMarker;
    readonly error?: unknown;
    readonly metadata?: Readonly<Record<string, string>>;
  }): Promise<void> {
    const event: HostLifecycleEvent = Object.freeze({
      hostId: this.hostId,
      phase: this.phaseValue,
      type: input.type,
      occurredAt: resolveIsoNow(),
      reason: normalizeRequired(input.reason, "Host lifecycle event reason"),
      transition: input.transition,
      readiness: input.readiness,
      error: input.error,
      metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
    });
    this.lifecycleEventsValue.push(event);
    try {
      await this.options.onEvent?.(event);
    } catch {
      // Host lifecycle observers are best-effort and must not break runtime transitions.
    }
  }

  private async executeCleanupHooks(
    cleanupReason: string,
    cleanupFailureReason: string,
    cleanupHooks: ReadonlyArray<{ readonly hookId: string; readonly run: HostLifecycleCleanupHook }>,
    signal: AbortSignal,
  ): Promise<ReadonlyArray<unknown>> {
    const cleanupErrors: unknown[] = [];
    for (const hook of cleanupHooks) {
      try {
        await hook.run({
          hostId: this.hostId,
          phase: this.phaseValue,
          signal,
          reason: cleanupReason,
          hookId: hook.hookId,
        });
        await this.emitEvent({
          type: HostLifecycleEventTypes.cleanupCompleted,
          reason: `${cleanupReason}:${hook.hookId}`,
        });
      } catch (error) {
        cleanupErrors.push(error);
        await this.emitEvent({
          type: HostLifecycleEventTypes.cleanupFailed,
          reason: `${cleanupFailureReason}:${hook.hookId}`,
          error,
        });
      }
    }
    return cleanupErrors;
  }
}

export function createHostLifecycleCoordinator(options: HostLifecycleCoordinatorOptions): HostLifecycleCoordinator {
  return new HostLifecycleCoordinator(options);
}

