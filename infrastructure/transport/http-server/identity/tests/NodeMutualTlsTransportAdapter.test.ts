import { describe, expect, it } from "bun:test";
import { TransportChannelTypes } from "../../../../../src/domain/security/TransportSecurityDomain";
import { validateNodeMutualTlsTransport } from "../NodeMutualTlsTransportAdapter";

describe("NodeMutualTlsTransportAdapter", () => {
  it("accepts approved node mTLS connections when trust and certificate identity checks pass", async () => {
    const result = await validateNodeMutualTlsTransport({
      requestId: "node-tls-allow",
      nodeId: "node:trusted:adapter-1",
      transportState: Object.freeze({
        channelType: TransportChannelTypes.https,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: true,
        peerCertificatePresented: true,
        peerCertificateSerialNumber: "AA11",
        peerCertificateFingerprintSha256: "AABBCCDD",
      }),
      ports: Object.freeze({
        trustValidator: {
          validate: async () => Object.freeze({
            ok: true,
            decision: {} as never,
          }),
        },
        nodeIdentityResolver: {
          resolveNodeMutualTlsTransportIdentity: async () => Object.freeze({
            ok: true,
            data: Object.freeze({
              nodeId: "node:trusted:adapter-1",
              certificateRef: "AA11",
              certificateThumbprint: "AABBCCDD",
            }),
          }),
        },
      }),
    });

    expect(result.ok).toBeTrue();
    if (!result.ok) {
      throw new Error("Expected approved node transport to be accepted.");
    }
    expect(result.node.nodeId).toBe("node:trusted:adapter-1");
    expect(result.trust.actorType).toBe("node-identity");
    expect(result.lifecycle.reconnect.allowed).toBeTrue();
  });

  it("rejects revoked node transport identities returned by node resolver", async () => {
    const result = await validateNodeMutualTlsTransport({
      requestId: "node-tls-revoked",
      nodeId: "node:revoked:adapter-1",
      transportState: Object.freeze({
        channelType: TransportChannelTypes.https,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: true,
        peerCertificatePresented: true,
        peerCertificateSerialNumber: "BB22",
      }),
      ports: Object.freeze({
        trustValidator: {
          validate: async () => Object.freeze({
            ok: true,
            decision: {} as never,
          }),
        },
        nodeIdentityResolver: {
          resolveNodeMutualTlsTransportIdentity: async () => Object.freeze({
            ok: false,
            error: Object.freeze({
              code: "conflict",
              message: "Node 'node:revoked:adapter-1' is revoked.",
            }),
          }),
        },
      }),
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.statusCode).toBe(409);
      expect(result.body.error?.code).toBe("conflict");
      expect(result.lifecycle.reconnect.allowed).toBeFalse();
    }
  });

  it("rejects untrusted certificate transport when trust validator denies mTLS request", async () => {
    const result = await validateNodeMutualTlsTransport({
      requestId: "node-tls-untrusted",
      nodeId: "node:trusted:adapter-2",
      transportState: Object.freeze({
        channelType: TransportChannelTypes.https,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: false,
        peerCertificatePresented: true,
        peerCertificateSerialNumber: "CC33",
      }),
      ports: Object.freeze({
        trustValidator: {
          validate: async () => Object.freeze({
            ok: false,
            statusCode: 403,
            body: Object.freeze({
              ok: false,
              error: Object.freeze({
                code: "forbidden",
                message: "Transport trust validation rejected this connection.",
              }),
            }),
          }),
        },
        nodeIdentityResolver: {
          resolveNodeMutualTlsTransportIdentity: async () => {
            throw new Error("nodeIdentityResolver should not be called when transport trust fails.");
          },
        },
      }),
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.statusCode).toBe(403);
      expect(result.body.error?.code).toBe("forbidden");
      expect(result.lifecycle.reconnect.allowed).toBeFalse();
    }
  });

  it("flags certificate rotation and returns retry guidance for transient failures", async () => {
    const result = await validateNodeMutualTlsTransport({
      requestId: "node-tls-rotation-retry",
      nodeId: "node:trusted:adapter-3",
      reconnectAttempt: 2,
      previousPeerCertificateSerialNumber: "AA11",
      previousPeerCertificateFingerprintSha256: "AABB",
      transportState: Object.freeze({
        channelType: TransportChannelTypes.https,
        encryptedTransportEstablished: true,
        mutualTlsEstablished: true,
        peerCertificatePresented: true,
        peerCertificateSerialNumber: "BB22",
        peerCertificateFingerprintSha256: "CCDD",
      }),
      ports: Object.freeze({
        trustValidator: {
          validate: async () => Object.freeze({
            ok: false,
            statusCode: 500,
            body: Object.freeze({
              ok: false,
              error: Object.freeze({
                code: "internal",
                message: "unexpected",
              }),
            }),
          }),
        },
        nodeIdentityResolver: {
          resolveNodeMutualTlsTransportIdentity: async () => {
            throw new Error("nodeIdentityResolver should not be called when transport trust fails.");
          },
        },
      }),
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.lifecycle.certificateRotated).toBeTrue();
      expect(result.lifecycle.reconnect.allowed).toBeTrue();
      expect(result.lifecycle.reconnect.nextDelayMs).toBe(1000);
    }
  });
});
