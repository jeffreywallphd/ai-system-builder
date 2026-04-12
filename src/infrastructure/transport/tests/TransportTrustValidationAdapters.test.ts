import { describe, expect, it } from "bun:test";
import {
  TransportConnectionRejectionReasons,
  TransportSecurityScenarios,
  resolveBaselineTransportSecurityPolicy,
} from "@domain/security/TransportSecurityDomain";
import type {
  ValidateTransportConnectionTrustOutcome,
} from "@application/security/use-cases/ValidateTransportConnectionTrustUseCase";
import {
  HttpTransportTrustValidationAdapter,
  WebSocketTransportTrustValidationAdapter,
} from "../TransportTrustValidationAdapters";
import type { TransportSecurityAuditEvent, TransportSecurityEventReporter } from "@application/security/ports/TransportSecurityAuditPorts";

class CapturingTransportSecurityEventReporter implements TransportSecurityEventReporter {
  public readonly events: TransportSecurityAuditEvent[] = [];

  public async recordTransportSecurityEvent(event: TransportSecurityAuditEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("TransportTrustValidationAdapters", () => {
  it("returns allow result for accepted trust decisions", async () => {
    const adapter = new HttpTransportTrustValidationAdapter({
      async execute() {
        return allowedOutcome();
      },
    });

    const result = await adapter.validate(createValidationRequest());
    expect(result.ok).toBeTrue();
  });

  it("maps missing authenticated session rejection to 401 and websocket 4401", async () => {
    const validator = {
      async execute() {
        return rejectedOutcome([TransportConnectionRejectionReasons.missingAuthenticatedUserSession]);
      },
    };
    const http = new HttpTransportTrustValidationAdapter(validator);
    const socket = new WebSocketTransportTrustValidationAdapter(validator);

    const httpResult = await http.validate(createValidationRequest());
    const socketResult = await socket.validate(createValidationRequest());

    expect(httpResult.ok).toBeFalse();
    if (!httpResult.ok) {
      expect(httpResult.statusCode).toBe(401);
      expect(httpResult.body.error.code).toBe("authentication-failed");
    }
    expect(socketResult.ok).toBeFalse();
    if (!socketResult.ok) {
      expect(socketResult.closeCode).toBe(4401);
      expect(socketResult.error.code).toBe("authentication-failed");
    }
  });

  it("maps policy mismatch rejection to invalid-request", async () => {
    const adapter = new HttpTransportTrustValidationAdapter({
      async execute() {
        return rejectedOutcome([TransportConnectionRejectionReasons.scenarioMismatch]);
      },
    });

    const result = await adapter.validate(createValidationRequest());
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.statusCode).toBe(400);
      expect(result.body.error.code).toBe("invalid-request");
    }
  });

  it("maps trust rejection to forbidden", async () => {
    const adapter = new HttpTransportTrustValidationAdapter({
      async execute() {
        return rejectedOutcome([TransportConnectionRejectionReasons.trustedDeviceRequired]);
      },
    });

    const result = await adapter.validate(createValidationRequest());
    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.statusCode).toBe(403);
      expect(result.body.error.code).toBe("forbidden");
    }
  });

  it("emits transport security events for HTTP and websocket denials", async () => {
    const reporter = new CapturingTransportSecurityEventReporter();
    const validator = {
      async execute() {
        const outcome = rejectedOutcome([TransportConnectionRejectionReasons.peerCertificateTrustRequired]);
        if (!outcome.ok) {
          return outcome;
        }
        return Object.freeze({
          ...outcome,
          value: Object.freeze({
            ...outcome.value,
            resolvedTrustState: Object.freeze({
              ...outcome.value.resolvedTrustState,
              peerCertificate: Object.freeze({
                certificatePresented: true,
                trustState: "revoked" as const,
                resolution: "resolved" as const,
                checkedAt: "2026-04-05T12:00:00.000Z",
              }),
            }),
          }),
        });
      },
    };

    const http = new HttpTransportTrustValidationAdapter(validator, reporter);
    const socket = new WebSocketTransportTrustValidationAdapter(validator, reporter);

    await http.validate(createValidationRequest());
    await socket.validate(createValidationRequest());

    expect(reporter.events).toHaveLength(2);
    expect(reporter.events[0]?.type).toBe("transport-certificate-mismatch-rejected");
    expect(reporter.events[0]?.outcome).toBe("rejected");
    expect(reporter.events[1]?.type).toBe("transport-websocket-upgrade-denied");
    expect(reporter.events[1]?.outcome).toBe("rejected");
  });
});

function createValidationRequest() {
  return Object.freeze({
    connectionId: "conn:1",
    direction: "inbound" as const,
    scenario: TransportSecurityScenarios.thinClientToControlPlane,
    channelType: "https" as const,
    actorType: "user-session" as const,
    localPeerType: "authoritative-server" as const,
    remotePeerType: "thin-client" as const,
    encryptedTransportEstablished: true,
    mutualTlsEstablished: false,
    lanTrustAssumed: false,
    userSessionEvidence: Object.freeze({
      userIdentityId: "user:1",
      loginAuthenticated: true,
    }),
  });
}

function allowedOutcome(): ValidateTransportConnectionTrustOutcome {
  const policy = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.thinClientToControlPlane);
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      direction: "inbound" as const,
      policy,
      source: "baseline" as const,
      trustValidation: Object.freeze({
        accepted: true,
        rejectionReasons: Object.freeze([]),
        evaluatedAt: "2026-04-05T12:00:00.000Z",
        policyId: policy.policyId,
        scenario: policy.scenario,
      }),
      failureReasons: Object.freeze([]),
      resolvedTrustState: Object.freeze({
        userSessionAuthenticated: true,
      }),
    }),
  });
}

function rejectedOutcome(
  reasons: ReadonlyArray<string>,
): ValidateTransportConnectionTrustOutcome {
  const policy = resolveBaselineTransportSecurityPolicy(TransportSecurityScenarios.thinClientToControlPlane);
  return Object.freeze({
    ok: true,
    value: Object.freeze({
      direction: "inbound" as const,
      policy,
      source: "baseline" as const,
      trustValidation: Object.freeze({
        accepted: false,
        rejectionReasons: Object.freeze([...reasons]),
        evaluatedAt: "2026-04-05T12:00:00.000Z",
        policyId: policy.policyId,
        scenario: policy.scenario,
      }),
      failureReasons: Object.freeze(reasons.map((code) => Object.freeze({
        code,
        category: "policy",
        message: code,
        safeMessage: code,
      }))),
      resolvedTrustState: Object.freeze({
        userSessionAuthenticated: false,
      }),
    }),
  });
}


