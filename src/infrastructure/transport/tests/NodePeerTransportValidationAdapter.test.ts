import { describe, expect, it } from "bun:test";
import { NodePeerTransportValidationAdapter } from "../NodePeerTransportValidationAdapter";

describe("NodePeerTransportValidationAdapter", () => {
  it("maps rejected peer decisions to forbidden transport response", async () => {
    const adapter = new NodePeerTransportValidationAdapter({
      async execute() {
        return {
          ok: true as const,
          value: Object.freeze({
            accepted: false,
            connectionId: "conn:peer:1",
            localNodeId: "node:local:1",
            remoteNodeId: "node:remote:1",
            operationClass: "runtime-trust-material-replication" as const,
            exposedCapabilities: Object.freeze([]),
            rejectionReasons: Object.freeze(["peer-channels-disabled-by-policy"]),
            evaluatedAt: "2026-04-05T12:00:00.000Z",
            policy: Object.freeze({
              policyId: "node-peer-policy:default-deny:v1",
              source: "baseline" as const,
              peerChannelsEnabled: false,
            }),
          }),
        };
      },
    });

    const result = await adapter.validate({
      connectionId: "conn:peer:1",
      direction: "outbound",
      localNodeId: "node:local:1",
      remoteNodeId: "node:remote:1",
      operationClass: "runtime-trust-material-replication",
      channelType: "tls",
      encryptedTransportEstablished: true,
      mutualTlsEstablished: true,
      lanTrustAssumed: false,
      certificateSerialNumber: "AA11",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.statusCode).toBe(403);
      expect(result.error.code).toBe("forbidden");
    }
  });
});
