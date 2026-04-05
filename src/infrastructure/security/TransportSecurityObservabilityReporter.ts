import {
  AuthenticatedTrustStates,
  TransportConnectionRejectionReasons,
} from "../../domain/security/TransportSecurityDomain";
import type { ITransportConnectionPolicyAuditPort, TransportConnectionPolicyDecisionAuditEvent } from "../../application/security/ports/TransportSecurityPorts";
import {
  publishTransportSecurityAuditEventBestEffort,
  sanitizeTransportSecurityAuditEvent,
  TransportSecurityAuditEventTypes,
  type TransportSecurityAuditEvent,
  type TransportSecurityAuditSink,
  type TransportSecurityEventReporter,
  type TransportSecurityLogEvent,
  type TransportSecurityLogger,
} from "../../application/security/ports/TransportSecurityAuditPorts";

export interface TransportSecurityObservabilityReporterOptions {
  readonly logger?: TransportSecurityLogger;
  readonly auditSink?: TransportSecurityAuditSink;
}

export class TransportSecurityObservabilityReporter implements ITransportConnectionPolicyAuditPort, TransportSecurityEventReporter {
  private readonly logger: TransportSecurityLogger;
  private readonly auditSink?: TransportSecurityAuditSink;

  public constructor(options: TransportSecurityObservabilityReporterOptions = {}) {
    this.logger = options.logger ?? new ConsoleTransportSecurityLogger();
    this.auditSink = options.auditSink;
  }

  public async recordTransportConnectionPolicyDecision(
    event: TransportConnectionPolicyDecisionAuditEvent,
  ): Promise<void> {
    const mapped: TransportSecurityAuditEvent = Object.freeze({
      type: classifyConnectionPolicyEvent(event),
      outcome: event.event === "transport-connection-accepted" ? "accepted" : "rejected",
      occurredAt: event.occurredAt,
      connectionId: event.connectionId,
      scenario: event.scenario,
      channelType: event.channelType,
      actorType: event.actorType,
      localPeerType: event.localPeerType,
      remotePeerType: event.remotePeerType,
      rejectionReasons: event.rejectionReasons,
      trustSnapshot: event.resolvedTrustState,
      details: Object.freeze({
        policyId: event.policyId,
      }),
    });
    await this.recordTransportSecurityEvent(mapped);
  }

  public async recordTransportSecurityEvent(event: TransportSecurityAuditEvent): Promise<void> {
    const sanitized = sanitizeTransportSecurityAuditEvent(event);
    const logEvent: TransportSecurityLogEvent = Object.freeze({
      event: `transport-security.${sanitized.type}`,
      level: sanitized.outcome === "accepted" ? "info" : "warn",
      details: sanitized,
    });

    if (sanitized.outcome === "accepted") {
      this.logger.info(logEvent);
    } else {
      this.logger.warn(logEvent);
    }

    await publishTransportSecurityAuditEventBestEffort(this.auditSink, sanitized);
  }
}

function classifyConnectionPolicyEvent(
  event: TransportConnectionPolicyDecisionAuditEvent,
): TransportSecurityAuditEvent["type"] {
  if (event.event === "transport-connection-accepted") {
    if (event.resolvedTrustState?.trustedDevice?.trustState === AuthenticatedTrustStates.trusted) {
      return TransportSecurityAuditEventTypes.deviceBoundSessionChannelEstablished;
    }
    return TransportSecurityAuditEventTypes.transportConnectionAccepted;
  }

  if (event.rejectionReasons.includes(TransportConnectionRejectionReasons.trustedDeviceRequired)) {
    return TransportSecurityAuditEventTypes.untrustedDeviceRejected;
  }

  if (
    event.rejectionReasons.includes(TransportConnectionRejectionReasons.trustedNodeRequired)
    && event.resolvedTrustState?.trustedNode?.trustState === AuthenticatedTrustStates.revoked
  ) {
    return TransportSecurityAuditEventTypes.revokedNodeRejected;
  }

  if (
    event.rejectionReasons.includes(TransportConnectionRejectionReasons.peerCertificateTrustRequired)
    && event.resolvedTrustState?.peerCertificate?.certificatePresented
  ) {
    return TransportSecurityAuditEventTypes.certificateMismatchRejected;
  }

  if (
    event.rejectionReasons.includes(TransportConnectionRejectionReasons.remotePeerTypeNotAllowed)
    || event.rejectionReasons.includes(TransportConnectionRejectionReasons.actorTypeMismatch)
  ) {
    return TransportSecurityAuditEventTypes.policyPeerRejected;
  }

  return TransportSecurityAuditEventTypes.transportConnectionRejected;
}

class ConsoleTransportSecurityLogger implements TransportSecurityLogger {
  public info(event: TransportSecurityLogEvent): void {
    console.info(JSON.stringify(event));
  }

  public warn(event: TransportSecurityLogEvent): void {
    console.warn(JSON.stringify(event));
  }

  public error(event: TransportSecurityLogEvent): void {
    console.error(JSON.stringify(event));
  }
}
