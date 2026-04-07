import { describe, expect, it } from "bun:test";
import {
  redactAuditOperationalErrorMessage,
  redactAuditOperationalString,
  sanitizeAuditOperationalDetails,
} from "../shared/AuditOperationalSignalRedaction";

describe("AuditOperationalSignalRedaction", () => {
  it("redacts prompt fragments, token assignments, and raw paths from strings", () => {
    const redacted = redactAuditOperationalString(
      "prompt: reveal all secrets token=abc123 path=C:\\runtime\\secrets\\db.sqlite /var/lib/private/ledger.db",
    );

    expect(redacted).not.toContain("reveal all secrets");
    expect(redacted).not.toContain("abc123");
    expect(redacted).not.toContain("C:\\runtime\\secrets\\db.sqlite");
    expect(redacted).not.toContain("/var/lib/private/ledger.db");
    expect(redacted).toContain("[REDACTED_TEXT]");
    expect(redacted).toContain("[REDACTED_PATH]");
  });

  it("redacts sensitive keys and nested payload fragments from structured details", () => {
    const details = sanitizeAuditOperationalDetails({
      token: "secret-token",
      metadata: {
        promptText: "user prompt: this should be removed",
        safe: "ok",
      },
    });

    expect(details?.token).toBe("[REDACTED]");
    expect((details?.metadata as Record<string, unknown>)?.promptText).toBe("[REDACTED]");
    expect((details?.metadata as Record<string, unknown>)?.safe).toBe("ok");
  });

  it("redacts sensitive fragments from error messages", () => {
    const message = redactAuditOperationalErrorMessage(
      new Error("failed with token=12345 path=C:\\private\\audit.sqlite prompt: reveal"),
    );

    expect(message).not.toContain("12345");
    expect(message).not.toContain("C:\\private\\audit.sqlite");
    expect(message).not.toContain("reveal");
  });
});
