import { describe, expect, it } from "bun:test";
import {
  buildWebSocketChannelContext,
  InMemoryWebSocketChannelRegistry,
  parseWebSocketChannelPurpose,
  resolveWebSocketChannelCapabilities,
  WebSocketChannelPurposes,
} from "../SecureWebSocketChannelContext";

describe("SecureWebSocketChannelContext", () => {
  it("parses channel purpose values and rejects unsupported values", () => {
    expect(parseWebSocketChannelPurpose("queue-monitoring")).toBe(WebSocketChannelPurposes.queueMonitoring);
    expect(parseWebSocketChannelPurpose("QUEUE-MONITORING")).toBe(WebSocketChannelPurposes.queueMonitoring);
    expect(parseWebSocketChannelPurpose("not-supported")).toBeUndefined();
  });

  it("resolves capabilities for queue monitoring channels", () => {
    const capabilities = resolveWebSocketChannelCapabilities(WebSocketChannelPurposes.queueMonitoring);
    expect(capabilities).toContain("status:read");
    expect(capabilities).toContain("queue:read");
  });

  it("builds immutable channel context with actor and transport metadata", () => {
    const context = buildWebSocketChannelContext({
      connectionId: "identity-ws:req-1",
      purpose: WebSocketChannelPurposes.runMonitoring,
      userIdentityId: "user:1",
      username: "alice",
      sessionId: "session:1",
      accessChannel: "desktop",
      trustedDeviceId: "device:trusted",
      sessionAssuranceLevel: "authenticated-trusted",
      workspaceId: "workspace-1",
      transport: {
        trustValidationEnforced: true,
        scenario: "desktop-client-to-control-plane",
        actorType: "user-session",
        remotePeerType: "desktop-client",
      },
    });

    expect(context.channelId.startsWith("ws-channel:")).toBeTrue();
    expect(context.actor.sessionId).toBe("session:1");
    expect(context.transport.trustValidationEnforced).toBeTrue();
    expect(context.capabilities).toContain("run:read");
    expect(context.capabilities).toContain("run-logs:read");
  });

  it("tracks and releases registered channel contexts", () => {
    const registry = new InMemoryWebSocketChannelRegistry();
    const context = buildWebSocketChannelContext({
      connectionId: "identity-ws:req-2",
      purpose: WebSocketChannelPurposes.status,
      userIdentityId: "user:2",
      username: "bob",
      sessionId: "session:2",
      accessChannel: "thin-client",
      sessionAssuranceLevel: "authenticated-untrusted",
      transport: {
        trustValidationEnforced: false,
        scenario: "thin-client-to-control-plane",
        actorType: "user-session",
        remotePeerType: "thin-client",
      },
    });

    registry.register(context);
    expect(registry.get(context.channelId)?.connectionId).toBe("identity-ws:req-2");
    expect(registry.list()).toHaveLength(1);

    registry.release(context.channelId);
    expect(registry.get(context.channelId)).toBeUndefined();
    expect(registry.list()).toHaveLength(0);
  });
});
