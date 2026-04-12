export const DeploymentPolicyGovernanceEventChannels = Object.freeze({
  audit: "audit",
  operational: "operational",
});

export type DeploymentPolicyGovernanceEventChannel =
  typeof DeploymentPolicyGovernanceEventChannels[keyof typeof DeploymentPolicyGovernanceEventChannels];

export const DeploymentPolicyGovernanceEventTypes = Object.freeze({
  activeProfileChanged: "deployment-policy-active-profile-changed",
  overridesMutated: "deployment-policy-overrides-mutated",
});

export type DeploymentPolicyGovernanceEventType =
  typeof DeploymentPolicyGovernanceEventTypes[keyof typeof DeploymentPolicyGovernanceEventTypes];

export const DeploymentPolicyGovernanceEventOutcomes = Object.freeze({
  succeeded: "succeeded",
  rejected: "rejected",
  failed: "failed",
});

export type DeploymentPolicyGovernanceEventOutcome =
  typeof DeploymentPolicyGovernanceEventOutcomes[keyof typeof DeploymentPolicyGovernanceEventOutcomes];

export interface DeploymentPolicyGovernanceEvent {
  readonly channel: DeploymentPolicyGovernanceEventChannel;
  readonly type: DeploymentPolicyGovernanceEventType;
  readonly occurredAt: string;
  readonly outcome: DeploymentPolicyGovernanceEventOutcome;
  readonly actorUserIdentityId?: string;
  readonly actorServiceId?: string;
  readonly scopeKind: "workspace" | "system";
  readonly scopeId: string;
  readonly policyFamilyIds?: ReadonlyArray<string>;
  readonly profileId?: string;
  readonly correlationId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IDeploymentPolicyGovernanceEventSink {
  recordDeploymentPolicyGovernanceEvent(event: DeploymentPolicyGovernanceEvent): Promise<void>;
}

const SensitiveDeploymentPolicyDetailKeyPattern =
  /(value|secret|token|credential|password|payload|prompt|content|body|bytes|path|file|directory|internal|raw)/i;
const SensitiveDeploymentPolicyStringPattern =
  /(Bearer\s+[A-Za-z0-9\-._~+/]+=*|[a-zA-Z]:\\|\/(?:Users|home|var|tmp|etc)\/|api[-_]?key|access[-_]?token|prompt\s*:)/i;
const RedactedMarker = "[REDACTED]";
const MaxDeploymentPolicyStringLength = 256;
const MaxDeploymentPolicyArrayLength = 20;
const MaxDeploymentPolicyObjectEntries = 24;

export async function publishDeploymentPolicyGovernanceEventBestEffort(
  sink: IDeploymentPolicyGovernanceEventSink | undefined,
  event: DeploymentPolicyGovernanceEvent,
): Promise<void> {
  if (!sink) {
    return;
  }

  try {
    await sink.recordDeploymentPolicyGovernanceEvent(sanitizeDeploymentPolicyGovernanceEvent(event));
  } catch {
    // Governance publication is best-effort and must not alter policy mutation flow.
  }
}

function sanitizeDeploymentPolicyGovernanceEvent(event: DeploymentPolicyGovernanceEvent): DeploymentPolicyGovernanceEvent {
  return Object.freeze({
    channel: event.channel,
    type: event.type,
    occurredAt: normalizeRequired(event.occurredAt, "occurredAt"),
    outcome: event.outcome,
    actorUserIdentityId: normalizeOptional(event.actorUserIdentityId),
    actorServiceId: normalizeOptional(event.actorServiceId),
    scopeKind: event.scopeKind,
    scopeId: normalizeRequired(event.scopeId, "scopeId"),
    policyFamilyIds: sanitizePolicyFamilyIds(event.policyFamilyIds),
    profileId: normalizeOptional(event.profileId),
    correlationId: normalizeOptional(event.correlationId),
    details: sanitizeDeploymentPolicyDetails(event.details),
  });
}

function sanitizePolicyFamilyIds(value: ReadonlyArray<string> | undefined): ReadonlyArray<string> | undefined {
  if (!value || value.length < 1) {
    return undefined;
  }

  const normalized = [...new Set(value.map((entry) => normalizeOptional(entry)).filter((entry): entry is string => Boolean(entry)))];
  if (normalized.length < 1) {
    return undefined;
  }

  return Object.freeze(normalized.slice(0, MaxDeploymentPolicyArrayLength));
}

function sanitizeDeploymentPolicyDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details).slice(0, MaxDeploymentPolicyObjectEntries)) {
    if (SensitiveDeploymentPolicyDetailKeyPattern.test(key)) {
      output[key] = RedactedMarker;
      continue;
    }
    output[key] = sanitizeUnknown(value);
  }
  return Object.freeze(output);
}

function sanitizeUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return sanitizeString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, MaxDeploymentPolicyArrayLength).map((entry) => sanitizeUnknown(entry)));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>).slice(0, MaxDeploymentPolicyObjectEntries)) {
      if (SensitiveDeploymentPolicyDetailKeyPattern.test(key)) {
        output[key] = RedactedMarker;
        continue;
      }
      output[key] = sanitizeUnknown(nestedValue);
    }
    return Object.freeze(output);
  }

  return String(value);
}

function sanitizeString(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return normalized;
  }
  if (SensitiveDeploymentPolicyStringPattern.test(normalized)) {
    return RedactedMarker;
  }
  return normalized.length > MaxDeploymentPolicyStringLength
    ? `${normalized.slice(0, MaxDeploymentPolicyStringLength)}...`
    : normalized;
}

function normalizeRequired(value: string | undefined, field: string): string {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    throw new Error(`Deployment policy governance event requires non-empty ${field}.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
