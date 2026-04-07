import type { ExecutionAccessContext } from "./RuntimeAccessControlService";

export interface ExecutionQuotaPolicy {
  readonly maxConcurrentExecutionsPerCaller: number;
  readonly maxExecutionsPerWindow: number;
  readonly windowMs: number;
}

export interface ExecutionQuotaEvaluationRequest {
  readonly callerContext?: ExecutionAccessContext;
  readonly now?: Date;
}

export interface ExecutionQuotaDecision {
  readonly allowed: boolean;
  readonly reasonCode?: "quota-concurrent-executions-exceeded" | "quota-window-executions-exceeded";
  readonly message?: string;
  readonly snapshot: {
    readonly callerKey: string;
    readonly activeCount: number;
    readonly recentExecutionsInWindow: number;
    readonly maxConcurrentExecutionsPerCaller: number;
    readonly maxExecutionsPerWindow: number;
    readonly windowMs: number;
  };
}

export interface ExecutionQuotaReservation {
  readonly callerKey: string;
  release(): void;
}

interface QuotaStateEntry {
  readonly starts: string[];
  activeCount: number;
}

const DEFAULT_POLICY: ExecutionQuotaPolicy = Object.freeze({
  maxConcurrentExecutionsPerCaller: 3,
  maxExecutionsPerWindow: 20,
  windowMs: 60_000,
});

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function createCallerKey(context?: ExecutionAccessContext): string {
  const callerKind = context?.callerKind ?? "anonymous";
  const callerId = normalizeOptional(context?.callerId) ?? "unknown";
  const sessionId = normalizeOptional(context?.sessionId) ?? "none";
  return `${callerKind}:${callerId}:${sessionId}`;
}

export class ExecutionQuotaEvaluator {
  private readonly stateByCaller = new Map<string, QuotaStateEntry>();

  public constructor(private readonly policy: ExecutionQuotaPolicy = DEFAULT_POLICY) {}

  public evaluate(request: ExecutionQuotaEvaluationRequest): ExecutionQuotaDecision {
    const now = request.now ?? new Date();
    const nowMs = now.getTime();
    const callerKey = createCallerKey(request.callerContext);
    const state = this.ensureState(callerKey);
    this.pruneStarts(state, nowMs);

    if (state.activeCount >= this.policy.maxConcurrentExecutionsPerCaller) {
      return this.denied(
        "quota-concurrent-executions-exceeded",
        `Execution quota exceeded: at most ${this.policy.maxConcurrentExecutionsPerCaller} concurrent execution(s) are allowed for this caller.`,
        callerKey,
        state,
      );
    }

    if (state.starts.length >= this.policy.maxExecutionsPerWindow) {
      return this.denied(
        "quota-window-executions-exceeded",
        `Execution quota exceeded: at most ${this.policy.maxExecutionsPerWindow} execution(s) are allowed every ${this.policy.windowMs}ms for this caller.`,
        callerKey,
        state,
      );
    }

    return Object.freeze({
      allowed: true,
      snapshot: this.snapshot(callerKey, state),
    });
  }

  public reserveExecution(request: ExecutionQuotaEvaluationRequest): {
    readonly decision: ExecutionQuotaDecision;
    readonly reservation?: ExecutionQuotaReservation;
  } {
    const now = request.now ?? new Date();
    const decision = this.evaluate({ ...request, now });
    if (!decision.allowed) {
      return Object.freeze({ decision });
    }

    const callerKey = decision.snapshot.callerKey;
    const state = this.ensureState(callerKey);
    state.activeCount += 1;
    state.starts.push(now.toISOString());
    return Object.freeze({
      decision: Object.freeze({
        ...decision,
        snapshot: this.snapshot(callerKey, state),
      }),
      reservation: Object.freeze({
        callerKey,
        release: () => {
          const current = this.stateByCaller.get(callerKey);
          if (!current) {
            return;
          }
          current.activeCount = Math.max(0, current.activeCount - 1);
        },
      }),
    });
  }

  private ensureState(callerKey: string): QuotaStateEntry {
    const existing = this.stateByCaller.get(callerKey);
    if (existing) {
      return existing;
    }
    const created: QuotaStateEntry = { starts: [], activeCount: 0 };
    this.stateByCaller.set(callerKey, created);
    return created;
  }

  private pruneStarts(state: QuotaStateEntry, nowMs: number): void {
    const threshold = nowMs - this.policy.windowMs;
    const kept = state.starts.filter((entry) => Date.parse(entry) >= threshold);
    state.starts.splice(0, state.starts.length, ...kept);
  }

  private denied(
    reasonCode: NonNullable<ExecutionQuotaDecision["reasonCode"]>,
    message: string,
    callerKey: string,
    state: QuotaStateEntry,
  ): ExecutionQuotaDecision {
    return Object.freeze({
      allowed: false,
      reasonCode,
      message,
      snapshot: this.snapshot(callerKey, state),
    });
  }

  private snapshot(callerKey: string, state: QuotaStateEntry): ExecutionQuotaDecision["snapshot"] {
    return Object.freeze({
      callerKey,
      activeCount: state.activeCount,
      recentExecutionsInWindow: state.starts.length,
      maxConcurrentExecutionsPerCaller: this.policy.maxConcurrentExecutionsPerCaller,
      maxExecutionsPerWindow: this.policy.maxExecutionsPerWindow,
      windowMs: this.policy.windowMs,
    });
  }
}
