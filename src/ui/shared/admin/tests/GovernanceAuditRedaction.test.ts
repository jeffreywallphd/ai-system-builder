import { describe, expect, it } from "bun:test";
import {
  redactGovernanceAuditDetails,
  redactGovernanceAuditValue,
} from "../GovernanceAuditRedaction";

describe("GovernanceAuditRedaction", () => {
  it("redacts sensitive identifier-like keys", () => {
    expect(redactGovernanceAuditValue("actorId", "user-identity:alpha-1234567890")).toBe("user-i...7890");
    expect(redactGovernanceAuditValue("targetRef", "run:execution:abcdef123456")).toBe("run:ex...3456");
    expect(redactGovernanceAuditValue("sessionToken", "token-abcdef1234567890")).toBe("token-...7890");
    expect(redactGovernanceAuditValue("deviceId", "short")).toBe("[REDACTED]");
  });

  it("trims long non-sensitive strings", () => {
    const value = "x".repeat(205);
    const redacted = redactGovernanceAuditValue("summary", value);

    expect(typeof redacted).toBe("string");
    expect((redacted as string).length).toBe(203);
    expect(redacted).toBe(`${"x".repeat(200)}...`);
  });

  it("redacts nested detail payloads", () => {
    const redacted = redactGovernanceAuditDetails(Object.freeze({
      actorId: "user-identity:alpha-1234567890",
      nested: Object.freeze({
        sessionId: "identity-session:abcdef123456",
        trace: "safe-value",
      }),
      items: Object.freeze([
        Object.freeze({ trustedDeviceId: "trusted-device:abcdef123456" }),
      ]),
    }));

    expect(redacted?.actorId).toBe("user-i...7890");
    expect((redacted?.nested as { readonly sessionId: string }).sessionId).toBe("identi...3456");
    expect((redacted?.nested as { readonly trace: string }).trace).toBe("safe-value");
    expect(
      (redacted?.items as ReadonlyArray<{ readonly trustedDeviceId: string }>)[0].trustedDeviceId,
    ).toBe("truste...3456");
  });
});
