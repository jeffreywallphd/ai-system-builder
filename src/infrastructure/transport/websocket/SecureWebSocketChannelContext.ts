import { randomUUID } from "node:crypto";

export const WebSocketChannelPurposes = Object.freeze({
  status: "status",
  queueMonitoring: "queue-monitoring",
  runMonitoring: "run-monitoring",
  streamControl: "stream-control",
});

export type WebSocketChannelPurpose =
  typeof WebSocketChannelPurposes[keyof typeof WebSocketChannelPurposes];

export const WebSocketChannelCapabilities = Object.freeze({
  statusRead: "status:read",
  queueRead: "queue:read",
  runRead: "run:read",
  runLogsRead: "run-logs:read",
  streamRead: "stream:read",
  streamControl: "stream:control",
});

export type WebSocketChannelCapability =
  typeof WebSocketChannelCapabilities[keyof typeof WebSocketChannelCapabilities];

const DefaultPurposeCapabilities: Readonly<Record<WebSocketChannelPurpose, ReadonlyArray<WebSocketChannelCapability>>> = Object.freeze({
  [WebSocketChannelPurposes.status]: Object.freeze([
    WebSocketChannelCapabilities.statusRead,
  ]),
  [WebSocketChannelPurposes.queueMonitoring]: Object.freeze([
    WebSocketChannelCapabilities.statusRead,
    WebSocketChannelCapabilities.queueRead,
  ]),
  [WebSocketChannelPurposes.runMonitoring]: Object.freeze([
    WebSocketChannelCapabilities.statusRead,
    WebSocketChannelCapabilities.runRead,
    WebSocketChannelCapabilities.runLogsRead,
  ]),
  [WebSocketChannelPurposes.streamControl]: Object.freeze([
    WebSocketChannelCapabilities.statusRead,
    WebSocketChannelCapabilities.streamRead,
    WebSocketChannelCapabilities.streamControl,
  ]),
});

export interface WebSocketAuthenticatedActorContext {
  readonly userIdentityId: string;
  readonly username: string;
  readonly sessionId: string;
  readonly accessChannel: "desktop" | "thin-client";
  readonly trustedDeviceId?: string;
  readonly sessionAssuranceLevel: "authenticated-untrusted" | "authenticated-restricted" | "authenticated-trusted";
}

export interface WebSocketChannelContext {
  readonly channelId: string;
  readonly connectionId: string;
  readonly establishedAt: string;
  readonly purpose: WebSocketChannelPurpose;
  readonly capabilities: ReadonlyArray<WebSocketChannelCapability>;
  readonly actor: WebSocketAuthenticatedActorContext;
  readonly workspaceScope: {
    readonly workspaceId?: string;
  };
  readonly transport: {
    readonly trustValidationEnforced: boolean;
    readonly scenario: string;
    readonly actorType: string;
    readonly remotePeerType: string;
  };
}

export interface BuildWebSocketChannelContextInput {
  readonly connectionId: string;
  readonly purpose: WebSocketChannelPurpose;
  readonly userIdentityId: string;
  readonly username: string;
  readonly sessionId: string;
  readonly accessChannel: "desktop" | "thin-client";
  readonly trustedDeviceId?: string;
  readonly sessionAssuranceLevel: "authenticated-untrusted" | "authenticated-restricted" | "authenticated-trusted";
  readonly workspaceId?: string;
  readonly transport: {
    readonly trustValidationEnforced: boolean;
    readonly scenario: string;
    readonly actorType: string;
    readonly remotePeerType: string;
  };
}

export function buildWebSocketChannelContext(input: BuildWebSocketChannelContextInput): WebSocketChannelContext {
  return Object.freeze({
    channelId: `ws-channel:${randomUUID()}`,
    connectionId: input.connectionId,
    establishedAt: new Date().toISOString(),
    purpose: input.purpose,
    capabilities: resolveWebSocketChannelCapabilities(input.purpose),
    actor: Object.freeze({
      userIdentityId: input.userIdentityId,
      username: input.username,
      sessionId: input.sessionId,
      accessChannel: input.accessChannel,
      trustedDeviceId: normalizeOptional(input.trustedDeviceId),
      sessionAssuranceLevel: input.sessionAssuranceLevel,
    }),
    workspaceScope: Object.freeze({
      workspaceId: normalizeOptional(input.workspaceId),
    }),
    transport: Object.freeze({
      trustValidationEnforced: input.transport.trustValidationEnforced,
      scenario: input.transport.scenario,
      actorType: input.transport.actorType,
      remotePeerType: input.transport.remotePeerType,
    }),
  });
}

export function parseWebSocketChannelPurpose(value: string | null | undefined): WebSocketChannelPurpose | undefined {
  const normalized = normalizeOptional(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }

  const values = Object.values(WebSocketChannelPurposes) as ReadonlyArray<string>;
  if (!values.includes(normalized)) {
    return undefined;
  }

  return normalized as WebSocketChannelPurpose;
}

export function resolveWebSocketChannelCapabilities(
  purpose: WebSocketChannelPurpose,
): ReadonlyArray<WebSocketChannelCapability> {
  return DefaultPurposeCapabilities[purpose] ?? Object.freeze([]);
}

export interface WebSocketChannelRegistry {
  register(context: WebSocketChannelContext): void;
  release(channelId: string): void;
  get(channelId: string): WebSocketChannelContext | undefined;
  list(): ReadonlyArray<WebSocketChannelContext>;
}

export class InMemoryWebSocketChannelRegistry implements WebSocketChannelRegistry {
  private readonly channels = new Map<string, WebSocketChannelContext>();

  public register(context: WebSocketChannelContext): void {
    this.channels.set(context.channelId, context);
  }

  public release(channelId: string): void {
    this.channels.delete(channelId);
  }

  public get(channelId: string): WebSocketChannelContext | undefined {
    return this.channels.get(channelId);
  }

  public list(): ReadonlyArray<WebSocketChannelContext> {
    return Object.freeze(Array.from(this.channels.values()));
  }
}

export const WebSocketChannelLifecycleStates = Object.freeze({
  establishing: "establishing",
  active: "active",
  revalidating: "revalidating",
  reconnectPending: "reconnect-pending",
  invalidated: "invalidated",
  closed: "closed",
});

export type WebSocketChannelLifecycleState =
  typeof WebSocketChannelLifecycleStates[keyof typeof WebSocketChannelLifecycleStates];

export const WebSocketChannelLifecycleInvalidationReasons = Object.freeze({
  revoked: "revoked",
  trustInvalidated: "trust-invalidated",
  certificateRotated: "certificate-rotated",
  transientRevalidationFailure: "transient-revalidation-failure",
  closedByPeer: "closed-by-peer",
});

export type WebSocketChannelLifecycleInvalidationReason =
  typeof WebSocketChannelLifecycleInvalidationReasons[keyof typeof WebSocketChannelLifecycleInvalidationReasons];

export interface WebSocketChannelReconnectPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly backoffMultiplier: number;
}

export const DefaultWebSocketChannelReconnectPolicy: WebSocketChannelReconnectPolicy = Object.freeze({
  maxAttempts: 4,
  baseDelayMs: 250,
  maxDelayMs: 15_000,
  backoffMultiplier: 2,
});

export interface WebSocketChannelReconnectDirective {
  readonly allowed: boolean;
  readonly reason: string;
  readonly attempt: number;
  readonly nextDelayMs?: number;
  readonly maxAttempts?: number;
}

export interface WebSocketChannelCertificateBinding {
  readonly serialNumber?: string;
  readonly fingerprintSha256?: string;
}

export function toWebSocketChannelCertificateBinding(input: {
  readonly serialNumber?: string;
  readonly fingerprintSha256?: string;
}): WebSocketChannelCertificateBinding | undefined {
  const serialNumber = normalizeCertificateSerialNumber(input.serialNumber);
  const fingerprintSha256 = normalizeCertificateFingerprint(input.fingerprintSha256);
  if (!serialNumber && !fingerprintSha256) {
    return undefined;
  }
  return Object.freeze({
    serialNumber,
    fingerprintSha256,
  });
}

export function hasWebSocketChannelCertificateBindingRotated(
  previous: WebSocketChannelCertificateBinding | undefined,
  next: WebSocketChannelCertificateBinding | undefined,
): boolean {
  if (!previous || !next) {
    return false;
  }
  if (previous.serialNumber && next.serialNumber && previous.serialNumber !== next.serialNumber) {
    return true;
  }
  if (previous.fingerprintSha256 && next.fingerprintSha256 && previous.fingerprintSha256 !== next.fingerprintSha256) {
    return true;
  }
  return false;
}

export function resolveWebSocketChannelReconnectDirective(input: {
  readonly attempt: number;
  readonly reason: WebSocketChannelLifecycleInvalidationReason;
  readonly policy?: WebSocketChannelReconnectPolicy;
}): WebSocketChannelReconnectDirective {
  const policy = normalizeReconnectPolicy(input.policy);
  const attempt = normalizeReconnectAttempt(input.attempt);

  if (input.reason === WebSocketChannelLifecycleInvalidationReasons.revoked) {
    return Object.freeze({
      allowed: false,
      attempt,
      reason: "Transport trust was revoked; reconnect is denied until trust is restored.",
    });
  }
  if (input.reason === WebSocketChannelLifecycleInvalidationReasons.trustInvalidated) {
    return Object.freeze({
      allowed: false,
      attempt,
      reason: "Transport trust is no longer valid for this channel.",
    });
  }

  if (attempt > policy.maxAttempts) {
    return Object.freeze({
      allowed: false,
      attempt,
      maxAttempts: policy.maxAttempts,
      reason: "Reconnect attempt budget exhausted.",
    });
  }

  return Object.freeze({
    allowed: true,
    attempt,
    maxAttempts: policy.maxAttempts,
    nextDelayMs: resolveReconnectDelayMs(attempt, policy),
    reason: input.reason === WebSocketChannelLifecycleInvalidationReasons.certificateRotated
      ? "Certificate binding changed; reconnect with refreshed trust material."
      : "Transient lifecycle validation failure.",
  });
}

export function canTransitionWebSocketChannelLifecycleState(
  current: WebSocketChannelLifecycleState,
  next: WebSocketChannelLifecycleState,
): boolean {
  if (current === next) {
    return true;
  }
  switch (current) {
    case WebSocketChannelLifecycleStates.establishing:
      return next === WebSocketChannelLifecycleStates.active || next === WebSocketChannelLifecycleStates.invalidated;
    case WebSocketChannelLifecycleStates.active:
      return (
        next === WebSocketChannelLifecycleStates.revalidating
        || next === WebSocketChannelLifecycleStates.invalidated
        || next === WebSocketChannelLifecycleStates.closed
      );
    case WebSocketChannelLifecycleStates.revalidating:
      return (
        next === WebSocketChannelLifecycleStates.active
        || next === WebSocketChannelLifecycleStates.reconnectPending
        || next === WebSocketChannelLifecycleStates.invalidated
      );
    case WebSocketChannelLifecycleStates.reconnectPending:
      return next === WebSocketChannelLifecycleStates.revalidating || next === WebSocketChannelLifecycleStates.invalidated;
    case WebSocketChannelLifecycleStates.invalidated:
      return next === WebSocketChannelLifecycleStates.closed;
    case WebSocketChannelLifecycleStates.closed:
      return false;
    default:
      return false;
  }
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeCertificateSerialNumber(value?: string): string | undefined {
  const normalized = normalizeOptional(value);
  return normalized ? normalized.toUpperCase() : undefined;
}

function normalizeCertificateFingerprint(value?: string): string | undefined {
  const normalized = normalizeOptional(value);
  return normalized ? normalized.replace(/[^a-fA-F0-9]/g, "").toUpperCase() : undefined;
}

function normalizeReconnectAttempt(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.floor(value));
}

function normalizeReconnectPolicy(
  policy: WebSocketChannelReconnectPolicy | undefined,
): WebSocketChannelReconnectPolicy {
  if (!policy) {
    return DefaultWebSocketChannelReconnectPolicy;
  }
  return Object.freeze({
    maxAttempts: Math.max(1, Math.floor(policy.maxAttempts)),
    baseDelayMs: Math.max(1, Math.floor(policy.baseDelayMs)),
    maxDelayMs: Math.max(1, Math.floor(policy.maxDelayMs)),
    backoffMultiplier: Math.max(1, policy.backoffMultiplier),
  });
}

function resolveReconnectDelayMs(
  attempt: number,
  policy: WebSocketChannelReconnectPolicy,
): number {
  const exponent = Math.max(0, attempt - 1);
  const delay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, exponent);
  return Math.min(policy.maxDelayMs, Math.floor(delay));
}
