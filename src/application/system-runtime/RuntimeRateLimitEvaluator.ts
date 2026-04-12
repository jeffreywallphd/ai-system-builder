import type { ExecutionAccessContext } from "./RuntimeAccessControlService";

export interface RuntimeRateLimitPolicy {
  readonly maxRequestsPerCallerPerWindow: number;
  readonly maxRequestsPerTenantPerWindow: number;
  readonly maxRequestsPerSourceOperationPerWindow: number;
  readonly windowMs: number;
}

export interface RuntimeRateLimitEvaluationRequest {
  readonly callerContext?: ExecutionAccessContext;
  readonly tenantId?: string;
  readonly requestSource?: string;
  readonly operation: string;
  readonly now?: Date;
}

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly reasonCode?: "caller-window-exceeded" | "tenant-window-exceeded" | "source-operation-window-exceeded";
  readonly message?: string;
  readonly snapshot: {
    readonly callerKey: string;
    readonly tenantKey: string;
    readonly sourceOperationKey: string;
    readonly callerCount: number;
    readonly tenantCount: number;
    readonly sourceOperationCount: number;
    readonly windowMs: number;
  };
}

interface SlidingWindowCounter {
  readonly timestampsMs: number[];
}

const DEFAULT_RUNTIME_RATE_LIMIT_POLICY: RuntimeRateLimitPolicy = Object.freeze({
  maxRequestsPerCallerPerWindow: 120,
  maxRequestsPerTenantPerWindow: 240,
  maxRequestsPerSourceOperationPerWindow: 240,
  windowMs: 60_000,
});

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function callerKey(caller?: ExecutionAccessContext): string {
  const kind = caller?.callerKind?.trim() || "anonymous";
  const id = caller?.callerId?.trim() || "unknown";
  return `${kind}:${id}`;
}

function tenantKey(tenantId?: string): string {
  return normalizeOptional(tenantId) ?? "no-tenant";
}

function sourceOperationKey(source: string | undefined, operation: string): string {
  return `${normalizeOptional(source) ?? "unknown"}:${operation.trim() || "unknown"}`;
}

export class RuntimeRateLimitEvaluator {
  private readonly callerCounters = new Map<string, SlidingWindowCounter>();
  private readonly tenantCounters = new Map<string, SlidingWindowCounter>();
  private readonly sourceOperationCounters = new Map<string, SlidingWindowCounter>();

  public constructor(private readonly policy: RuntimeRateLimitPolicy = DEFAULT_RUNTIME_RATE_LIMIT_POLICY) {}

  public evaluate(input: RuntimeRateLimitEvaluationRequest): RateLimitDecision {
    const nowMs = (input.now ?? new Date()).getTime();
    const cKey = callerKey(input.callerContext);
    const tKey = tenantKey(input.tenantId);
    const sKey = sourceOperationKey(input.requestSource, input.operation);

    const callerCounter = this.ensureCounter(this.callerCounters, cKey, nowMs);
    const tenantCounter = this.ensureCounter(this.tenantCounters, tKey, nowMs);
    const sourceCounter = this.ensureCounter(this.sourceOperationCounters, sKey, nowMs);

    if (callerCounter.timestampsMs.length >= this.policy.maxRequestsPerCallerPerWindow) {
      return this.denied("caller-window-exceeded", `Rate limit exceeded for caller over ${this.policy.windowMs}ms window.`, cKey, tKey, sKey, callerCounter, tenantCounter, sourceCounter);
    }
    if (tenantCounter.timestampsMs.length >= this.policy.maxRequestsPerTenantPerWindow) {
      return this.denied("tenant-window-exceeded", `Rate limit exceeded for tenant over ${this.policy.windowMs}ms window.`, cKey, tKey, sKey, callerCounter, tenantCounter, sourceCounter);
    }
    if (sourceCounter.timestampsMs.length >= this.policy.maxRequestsPerSourceOperationPerWindow) {
      return this.denied("source-operation-window-exceeded", `Rate limit exceeded for source/operation over ${this.policy.windowMs}ms window.`, cKey, tKey, sKey, callerCounter, tenantCounter, sourceCounter);
    }

    callerCounter.timestampsMs.push(nowMs);
    tenantCounter.timestampsMs.push(nowMs);
    sourceCounter.timestampsMs.push(nowMs);

    return Object.freeze({
      allowed: true,
      snapshot: this.snapshot(cKey, tKey, sKey, callerCounter, tenantCounter, sourceCounter),
    });
  }

  private ensureCounter(
    map: Map<string, SlidingWindowCounter>,
    key: string,
    nowMs: number,
  ): SlidingWindowCounter {
    const existing = map.get(key);
    if (existing) {
      this.prune(existing, nowMs);
      return existing;
    }
    const created: SlidingWindowCounter = { timestampsMs: [] };
    map.set(key, created);
    return created;
  }

  private prune(counter: SlidingWindowCounter, nowMs: number): void {
    const threshold = nowMs - this.policy.windowMs;
    const retained = counter.timestampsMs.filter((value) => value >= threshold);
    counter.timestampsMs.splice(0, counter.timestampsMs.length, ...retained);
  }

  private denied(
    reasonCode: NonNullable<RateLimitDecision["reasonCode"]>,
    message: string,
    cKey: string,
    tKey: string,
    sKey: string,
    callerCounter: SlidingWindowCounter,
    tenantCounter: SlidingWindowCounter,
    sourceCounter: SlidingWindowCounter,
  ): RateLimitDecision {
    return Object.freeze({
      allowed: false,
      reasonCode,
      message,
      snapshot: this.snapshot(cKey, tKey, sKey, callerCounter, tenantCounter, sourceCounter),
    });
  }

  private snapshot(
    cKey: string,
    tKey: string,
    sKey: string,
    callerCounter: SlidingWindowCounter,
    tenantCounter: SlidingWindowCounter,
    sourceCounter: SlidingWindowCounter,
  ): RateLimitDecision["snapshot"] {
    return Object.freeze({
      callerKey: cKey,
      tenantKey: tKey,
      sourceOperationKey: sKey,
      callerCount: callerCounter.timestampsMs.length,
      tenantCount: tenantCounter.timestampsMs.length,
      sourceOperationCount: sourceCounter.timestampsMs.length,
      windowMs: this.policy.windowMs,
    });
  }
}
