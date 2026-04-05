import { describe, expect, it } from "bun:test";
import { redactSensitiveAuthPayload, redactSensitiveText } from "../IdentityAuthRedaction";

describe("IdentityAuthRedaction", () => {
  it("redacts sensitive keys recursively", () => {
    const payload = {
      username: "alice",
      nested: {
        credential: {
          candidate: "StrongPass!2026",
        },
        verification: {
          currentCredential: "CurrentSecret!2026",
        },
        newCredential: {
          candidate: "NewSecret!2027",
        },
        metadata: [
          { trustMarker: "marker:alpha" },
          { providerSubject: "alice" },
        ],
      },
    };

    const redacted = redactSensitiveAuthPayload(payload);
    const serialized = JSON.stringify(redacted);
    expect(serialized.includes("alice")).toBeFalse();
    expect(serialized.includes("StrongPass!2026")).toBeFalse();
    expect(serialized.includes("CurrentSecret!2026")).toBeFalse();
    expect(serialized.includes("NewSecret!2027")).toBeFalse();
    expect(serialized.includes("marker:alpha")).toBeFalse();
    expect(serialized.includes("[REDACTED]")).toBeTrue();
  });

  it("redacts bearer-like tokens in freeform error text", () => {
    const redacted = redactSensitiveText("Authorization failed for Bearer loom_sess_secret-token");
    expect(redacted.includes("loom_sess_secret-token")).toBeFalse();
    expect(redacted.includes("[REDACTED]")).toBeTrue();
  });
});
