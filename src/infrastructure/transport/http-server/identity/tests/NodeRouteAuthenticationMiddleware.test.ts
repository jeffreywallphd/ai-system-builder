import { describe, expect, it } from "bun:test";
import { TransportChannelTypes } from "@domain/security/TransportSecurityDomain";
import {
  authorizeSessionNodeRoutePrincipal,
  buildSessionNodeRouteTransportContext,
  resolveMutualTlsNodeRouteTransportContext,
  resolveRequiredNodeRouteNodeId,
} from "../middleware/node-route-authentication";

describe("node-route-authentication middleware utilities", () => {
  it("resolves required node id from route scope", () => {
    const resolved = resolveRequiredNodeRouteNodeId({
      nodeId: "node:trusted:middleware-1",
      buildInvalidResponse: (message) => Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "invalid-request",
          message,
        }),
      }),
    });

    expect(resolved.ok).toBeTrue();
    if (!resolved.ok) {
      throw new Error("Expected nodeId to resolve from route scope.");
    }
    expect(resolved.nodeId).toBe("node:trusted:middleware-1");
  });

  it("returns invalid-request when node id is missing", () => {
    const resolved = resolveRequiredNodeRouteNodeId({
      nodeId: "   ",
      buildInvalidResponse: (message) => Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "invalid-request",
          message,
        }),
      }),
    });

    expect(resolved.ok).toBeFalse();
    if (resolved.ok) {
      throw new Error("Expected missing nodeId to fail.");
    }
    expect(resolved.statusCode).toBe(400);
    expect(resolved.body).toEqual({
      ok: false,
      error: {
        code: "invalid-request",
        message: "nodeId is required.",
      },
    });
  });

  it("authorizes session principal when node identity matches principal or provider subject", () => {
    const context = Object.freeze({
      principal: Object.freeze({
        userIdentityId: "node:trusted:middleware-2",
        username: "node.runtime.middleware-2",
      }),
      session: Object.freeze({
        providerSubject: "node.runtime.middleware-2",
      }),
      transport: Object.freeze({
        connection: Object.freeze({
          encryptedTransportEstablished: false,
        }),
        trustValidation: Object.freeze({
          enforced: false,
        }),
      }),
    });

    const authorization = authorizeSessionNodeRoutePrincipal({
      nodeId: "node:trusted:middleware-2",
      context,
      buildForbiddenResponse: (message) => Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "forbidden",
          message,
        }),
      }),
    });

    expect(authorization.ok).toBeTrue();
    if (!authorization.ok) {
      throw new Error("Expected matching node session principal to be authorized.");
    }

    const normalized = buildSessionNodeRouteTransportContext({
      nodeId: "node:trusted:middleware-2",
      context,
    });
    expect(normalized.nodeId).toBe("node:trusted:middleware-2");
    expect(normalized.transport.connection.encryptedTransportEstablished).toBeFalse();
  });

  it("rejects session principal when node identity does not match authenticated context", () => {
    const authorization = authorizeSessionNodeRoutePrincipal({
      nodeId: "node:trusted:middleware-3",
      context: Object.freeze({
        principal: Object.freeze({
          userIdentityId: "user:admin",
          username: "admin.user",
        }),
        session: Object.freeze({
          providerSubject: "admin.user",
        }),
        transport: Object.freeze({
          connection: Object.freeze({
            encryptedTransportEstablished: false,
          }),
          trustValidation: Object.freeze({
            enforced: false,
          }),
        }),
      }),
      buildForbiddenResponse: (message) => Object.freeze({
        ok: false,
        error: Object.freeze({
          code: "forbidden",
          message,
        }),
      }),
    });

    expect(authorization.ok).toBeFalse();
    if (authorization.ok) {
      throw new Error("Expected mismatched principal to be rejected.");
    }
    expect(authorization.statusCode).toBe(403);
    expect(authorization.body).toEqual({
      ok: false,
      error: {
        code: "forbidden",
        message: "Authenticated session is not authorized to establish node transport for 'node:trusted:middleware-3'.",
      },
    });
    expect(authorization.requestLogPayload).toEqual({
      nodeId: "node:trusted:middleware-3",
      principalUserIdentityId: "user:admin",
      principalUsername: "admin.user",
      sessionProviderSubject: "admin.user",
    });
  });

  it("maps mTLS validation failures into route-safe denial context", () => {
    const resolution = resolveMutualTlsNodeRouteTransportContext({
      nodeId: "node:trusted:middleware-4",
      transportState: Object.freeze({
        channelType: TransportChannelTypes.https,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: false,
        peerCertificatePresented: true,
        peerCertificateSerialNumber: "ABCD",
      }),
      validation: Object.freeze({
        ok: false,
        statusCode: 403,
        body: Object.freeze({
          ok: false,
          error: Object.freeze({
            code: "forbidden",
            message: "Transport trust validation rejected this connection.",
          }),
        }),
        lifecycle: Object.freeze({
          certificateRotated: false,
          reconnect: Object.freeze({
            allowed: false,
            attempt: 1,
            reason: "forbidden",
          }),
        }),
      }),
    });

    expect(resolution.ok).toBeFalse();
    if (resolution.ok) {
      throw new Error("Expected mTLS trust denial to be propagated.");
    }
    expect(resolution.statusCode).toBe(403);
    expect(resolution.body.error?.code).toBe("forbidden");
    expect(resolution.requestLogPayload).toEqual({
      nodeId: "node:trusted:middleware-4",
      transport: {
        channelType: "https",
        encryptedTransportEstablished: true,
        mutualTlsEstablished: false,
        peerCertificatePresented: true,
        peerCertificateSerialNumber: "ABCD",
      },
    });
  });

  it("builds normalized node-authenticated context from successful mTLS validation", () => {
    const resolution = resolveMutualTlsNodeRouteTransportContext({
      nodeId: "node:trusted:middleware-5",
      transportState: Object.freeze({
        channelType: TransportChannelTypes.https,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: true,
        peerCertificatePresented: true,
        peerCertificateSerialNumber: "A1B2",
      }),
      validation: Object.freeze({
        ok: true,
        node: Object.freeze({
          nodeId: "node:trusted:middleware-5",
          certificateRef: "cert:middleware-5",
          certificateThumbprint: "thumbprint-5",
        }),
        trust: Object.freeze({
          enforced: true as const,
          scenario: "node-to-control-plane" as const,
          actorType: "node-identity" as const,
          remotePeerType: "node-runtime" as const,
        }),
        lifecycle: Object.freeze({
          certificateRotated: false,
          reconnect: Object.freeze({
            allowed: true,
            attempt: 1,
          }),
        }),
      }),
    });

    expect(resolution.ok).toBeTrue();
    if (!resolution.ok) {
      throw new Error("Expected approved mTLS node context.");
    }
    expect(resolution.context.nodeId).toBe("node:trusted:middleware-5");
    expect(resolution.context.transport.connection.mutualTlsEstablished).toBeTrue();
    expect(resolution.context.transport.trustValidation.actorType).toBe("node-identity");
  });
});
