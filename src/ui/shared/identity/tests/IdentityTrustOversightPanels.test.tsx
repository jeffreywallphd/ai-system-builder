import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SessionOversightPanel,
  TrustedDeviceOversightPanel,
  redactIdentifier,
} from "../IdentityTrustOversightPanels";

describe("IdentityTrustOversightPanels", () => {
  it("redacts identifiers for trust-sensitive fields", () => {
    expect(redactIdentifier("trusted-device:alpha-1234567890")).toContain("...");
    expect(redactIdentifier("short-id")).toBe("[redacted]");
  });

  it("renders trusted-device oversight rows and actions", () => {
    const html = renderToStaticMarkup(
      React.createElement(TrustedDeviceOversightPanel, {
        title: "Trusted device oversight",
        subtitle: "Inspect devices.",
        devices: Object.freeze([
          Object.freeze({
            trustedDeviceId: "trusted-device:alpha-1234567890",
            userIdentityId: "user-identity:1",
            displayName: "Alice Laptop",
            pairingMethod: "one-time-code",
            trustStatus: "trusted",
            registeredAt: "2026-04-06T18:00:00.000Z",
            pairedAt: "2026-04-06T18:10:00.000Z",
            lastSeenAt: "2026-04-07T09:00:00.000Z",
            metadata: Object.freeze({ platform: "desktop" }),
            updatedAt: "2026-04-07T09:00:00.000Z",
          }),
        ]),
        selectedTrustedDeviceId: "trusted-device:alpha-1234567890",
        emptyMessage: "No devices.",
        onSelectTrustedDevice: () => undefined,
        onRevokeTrustedDevice: () => undefined,
      }),
    );

    expect(html).toContain("Trusted device oversight");
    expect(html).toContain("Alice Laptop");
    expect(html).toContain("Revoke");
    expect(html).not.toContain("trusted-device:alpha-1234567890");
  });

  it("renders session oversight rows with current-session marker", () => {
    const html = renderToStaticMarkup(
      React.createElement(SessionOversightPanel, {
        title: "Session oversight",
        subtitle: "Inspect sessions.",
        sessions: Object.freeze([
          Object.freeze({
            sessionId: "identity-session:alpha-1234567890",
            userIdentityId: "user-identity:1",
            providerId: "provider:local-password",
            providerSubject: "alice",
            status: "active",
            issuedAt: "2026-04-07T08:00:00.000Z",
            expiresAt: "2026-04-07T20:00:00.000Z",
            accessChannel: "desktop",
            deviceId: "device:alpha-1234567890",
            trust: Object.freeze({
              trustedDeviceId: "trusted-device:alpha-1234567890",
              sessionAssuranceLevel: "authenticated-trusted",
              trustState: "trusted",
              trustEvaluatedAt: "2026-04-07T09:00:00.000Z",
              issuedOnTrustedDevice: true,
              invalidationReasons: Object.freeze([]),
            }),
          }),
        ]),
        selectedSessionId: "identity-session:alpha-1234567890",
        currentSessionId: "identity-session:alpha-1234567890",
        emptyMessage: "No sessions.",
        onSelectSession: () => undefined,
        onRevokeSession: () => undefined,
      }),
    );

    expect(html).toContain("Session oversight");
    expect(html).toContain("Current");
    expect(html).toContain("End session");
    expect(html).toContain("authenticated-trusted");
    expect(html).not.toContain("identity-session:alpha-1234567890");
  });
});
