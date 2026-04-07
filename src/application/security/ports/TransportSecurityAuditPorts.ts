import type {
  AuthenticatedTrustState,
  TransportChannelType,
  TransportConnectionActorType,
  TransportPeerType,
  TransportSecurityScenario,
} from "@domain/security/TransportSecurityDomain";

export const TransportSecurityAuditEventTypes = Object.freeze({
  transportConnectionAccepted: "transport-connection-accepted",
  transportConnectionRejected: "transport-connection-rejected",
  deviceBoundSessionChannelEstablished: "transport-device-bound-session-channel-established",
  untrustedDeviceRejected: "transport-untrusted-device-rejected",
  revokedNodeRejected: "transport-revoked-node-rejected",
  certificateMismatchRejected: "transport-certificate-mismatch-rejected",
  websocketUpgradeDenied: "transport-websocket-upgrade-denied",
  policyPeerRejected: "transport-policy-peer-rejected",
});

export type TransportSecurityAuditEventType =
  typeof TransportSecurityAuditEventTypes[keyof typeof TransportSecurityAuditEventTypes];

export interface TransportSecurityResolvedTrustSnapshot {
  readonly userSessionAuthenticated?: boolean;
  readonly trustedDevice?: {
    readonly trustedDeviceId?: string;
    readonly trustState?: AuthenticatedTrustState;
  };
  readonly trustedNode?: {
    readonly nodeId?: string;
    readonly trustState?: AuthenticatedTrustState;
  };
  readonly peerCertificate?: {
    readonly certificatePresented: boolean;
    readonly trustState?: AuthenticatedTrustState;
  };
}

export interface TransportSecurityAuditEvent {
  readonly type: TransportSecurityAuditEventType;
  readonly outcome: "accepted" | "rejected";
  readonly occurredAt: string;
  readonly connectionId: string;
  readonly scenario?: TransportSecurityScenario;
  readonly channelType?: TransportChannelType;
  readonly actorType?: TransportConnectionActorType;
  readonly localPeerType?: TransportPeerType;
  readonly remotePeerType?: TransportPeerType;
  readonly rejectionReasons?: ReadonlyArray<string>;
  readonly trustSnapshot?: TransportSecurityResolvedTrustSnapshot;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface TransportSecurityAuditSink {
  recordTransportSecurityAuditEvent(event: TransportSecurityAuditEvent): Promise<void>;
}

export interface TransportSecurityLogEvent {
  readonly event: string;
  readonly level: "info" | "warn" | "error";
  readonly details: TransportSecurityAuditEvent;
}

export interface TransportSecurityLogger {
  info(event: TransportSecurityLogEvent): void;
  warn(event: TransportSecurityLogEvent): void;
  error(event: TransportSecurityLogEvent): void;
}

export interface TransportSecurityEventReporter {
  recordTransportSecurityEvent(event: TransportSecurityAuditEvent): Promise<void>;
}

export async function publishTransportSecurityAuditEventBestEffort(
  auditSink: TransportSecurityAuditSink | undefined,
  event: TransportSecurityAuditEvent,
): Promise<void> {
  if (!auditSink) {
    return;
  }

  try {
    await auditSink.recordTransportSecurityAuditEvent(sanitizeTransportSecurityAuditEvent(event));
  } catch {
    // Intentionally best-effort while audit delivery remains non-blocking.
  }
}

const SensitiveTransportDetailKeyPattern =
  /(secret|token|password|credential|private[-_]?key|authorization|cookie|session|prompt|certificate|pem|csr|chain|raw|path|file|directory|body|payload)/i;
const WindowsPathPattern = /[a-zA-Z]:\\[^\s"'`]+/g;
const UnixPathPattern = /(?:^|[\s"'`])\/(?:[^/\s"'`]+\/)+[^/\s"'`]*/g;
const PemBlockPattern = /-----BEGIN[\s\S]*?-----END [^-]+-----/g;
const BearerTokenPattern = /bearer\s+[A-Za-z0-9\-._~+/]+=*/gi;
const SecretAssignmentPattern = /(token|secret|password|credential|api[-_]?key)\s*[:=]\s*([^\s,;]+)/gi;

export function sanitizeTransportSecurityAuditEvent(
  event: TransportSecurityAuditEvent,
): TransportSecurityAuditEvent {
  return Object.freeze({
    ...event,
    type: event.type,
    outcome: event.outcome,
    occurredAt: normalizeAuditValue(event.occurredAt),
    connectionId: normalizeAuditValue(event.connectionId),
    rejectionReasons: event.rejectionReasons ? Object.freeze(event.rejectionReasons.map((reason) => normalizeAuditValue(reason))) : undefined,
    trustSnapshot: sanitizeTrustSnapshot(event.trustSnapshot),
    details: sanitizeAuditDetails(event.details),
  });
}

function sanitizeTrustSnapshot(
  snapshot: TransportSecurityResolvedTrustSnapshot | undefined,
): TransportSecurityResolvedTrustSnapshot | undefined {
  if (!snapshot) {
    return undefined;
  }

  return Object.freeze({
    userSessionAuthenticated: snapshot.userSessionAuthenticated,
    trustedDevice: snapshot.trustedDevice
      ? Object.freeze({
          trustedDeviceId: normalizeOptional(snapshot.trustedDevice.trustedDeviceId),
          trustState: snapshot.trustedDevice.trustState,
        })
      : undefined,
    trustedNode: snapshot.trustedNode
      ? Object.freeze({
          nodeId: normalizeOptional(snapshot.trustedNode.nodeId),
          trustState: snapshot.trustedNode.trustState,
        })
      : undefined,
    peerCertificate: snapshot.peerCertificate
      ? Object.freeze({
          certificatePresented: snapshot.peerCertificate.certificatePresented,
          trustState: snapshot.peerCertificate.trustState,
        })
      : undefined,
  });
}

function sanitizeAuditDetails(
  details: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (!details) {
    return undefined;
  }

  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (SensitiveTransportDetailKeyPattern.test(key)) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = sanitizeAuditUnknown(value);
  }
  return Object.freeze(output);
}

function sanitizeAuditUnknown(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return redactSensitiveTransportString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.slice(0, 25).map((entry) => sanitizeAuditUnknown(entry)));
  }
  if (typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (SensitiveTransportDetailKeyPattern.test(key)) {
        output[key] = "[REDACTED]";
      } else {
        output[key] = sanitizeAuditUnknown(nestedValue);
      }
    }
    return Object.freeze(output);
  }
  return String(value);
}

function redactSensitiveTransportString(value: string): string {
  let output = value;
  output = output.replace(PemBlockPattern, "[REDACTED_CERTIFICATE]");
  output = output.replace(BearerTokenPattern, "Bearer [REDACTED]");
  output = output.replace(SecretAssignmentPattern, "$1=[REDACTED]");
  output = output.replace(WindowsPathPattern, "[REDACTED_PATH]");
  output = output.replace(UnixPathPattern, " [REDACTED_PATH]");
  return output.length > 256 ? `${output.slice(0, 256)}...` : output;
}

function normalizeAuditValue(value: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : "unknown";
}

function normalizeOptional(value?: string): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

