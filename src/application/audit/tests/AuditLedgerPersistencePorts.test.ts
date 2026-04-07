import { describe, expect, it } from "bun:test";
import { normalizeAuditLedgerOperationKey } from "../ports/AuditLedgerPersistencePorts";

describe("AuditLedgerPersistencePorts", () => {
  it("normalizes operation keys for replay-safe append semantics", () => {
    expect(normalizeAuditLedgerOperationKey(" Audit:Runs:Append:1 ")).toBe("audit:runs:append:1");
    expect(() => normalizeAuditLedgerOperationKey("   ")).toThrow("operationKey is required");
  });
});
