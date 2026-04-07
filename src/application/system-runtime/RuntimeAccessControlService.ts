export const ExecutionCallerKinds = Object.freeze({
  user: "user",
  session: "session",
  system: "system",
  anonymous: "anonymous",
});

export type ExecutionCallerKind = typeof ExecutionCallerKinds[keyof typeof ExecutionCallerKinds];

export interface ExecutionAccessContext {
  readonly callerKind: ExecutionCallerKind;
  readonly callerId?: string;
  readonly sessionId?: string;
  readonly roles?: ReadonlyArray<string>;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface ExecutionAccessRequest {
  readonly context?: ExecutionAccessContext;
  readonly systemId?: string;
  readonly versionId?: string;
}

export interface ExecutionAccessDecision {
  readonly allowed: boolean;
  readonly reasonCode?: string;
  readonly message?: string;
  readonly policyId?: string;
}

export interface ExecutionAccessPolicy {
  readonly policyId: string;
  evaluate(request: ExecutionAccessRequest): ExecutionAccessDecision;
}

export class AllowAllExecutionAccessPolicy implements ExecutionAccessPolicy {
  public readonly policyId = "allow-all";

  public evaluate(): ExecutionAccessDecision {
    return Object.freeze({
      allowed: true,
      policyId: this.policyId,
    });
  }
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> | undefined {
  if (!values) {
    return undefined;
  }

  const normalized = [...new Set(values.map((entry) => entry.trim()).filter(Boolean))];
  return normalized.length > 0 ? Object.freeze(normalized) : undefined;
}

function normalizeContext(context?: ExecutionAccessContext): ExecutionAccessContext | undefined {
  if (!context) {
    return undefined;
  }

  return Object.freeze({
    callerKind: context.callerKind,
    callerId: normalizeOptional(context.callerId),
    sessionId: normalizeOptional(context.sessionId),
    roles: normalizeStringList(context.roles),
    metadata: context.metadata ? Object.freeze({ ...context.metadata }) : undefined,
  });
}

export class RuntimeAccessControlService {
  public constructor(
    private readonly policy: ExecutionAccessPolicy = new AllowAllExecutionAccessPolicy(),
  ) {}

  public evaluate(request: ExecutionAccessRequest): ExecutionAccessDecision {
    const normalized: ExecutionAccessRequest = Object.freeze({
      context: normalizeContext(request.context),
      systemId: normalizeOptional(request.systemId),
      versionId: normalizeOptional(request.versionId),
    });

    const decision = this.policy.evaluate(normalized);
    return Object.freeze({
      allowed: decision.allowed,
      reasonCode: normalizeOptional(decision.reasonCode),
      message: normalizeOptional(decision.message),
      policyId: normalizeOptional(decision.policyId ?? this.policy.policyId),
    });
  }
}
