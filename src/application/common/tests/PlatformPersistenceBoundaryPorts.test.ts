import { describe, expect, it } from "bun:test";
import {
  PlatformAuditEventKinds,
  PlatformRunKinds,
  PlatformRunStatuses,
  normalizePlatformPersistenceOperationKey,
} from "../ports/PlatformPersistenceBoundaryPorts";

describe("platform persistence boundary ports", () => {
  it("normalizes mutation operation keys for idempotent repository semantics", () => {
    expect(normalizePlatformPersistenceOperationKey("  OP-Run-123  ")).toBe("op-run-123");
  });

  it("defines stable run and audit vocabularies for cross-domain persistence contracts", () => {
    expect(Object.values(PlatformRunKinds)).toEqual(["workflow", "agent", "system"]);
    expect(Object.values(PlatformRunStatuses)).toEqual([
      "pending",
      "running",
      "completed",
      "failed",
      "cancelled",
      "blocked",
    ]);
    expect(Object.values(PlatformAuditEventKinds)).toContain("security");
    expect(Object.values(PlatformAuditEventKinds)).toContain("runs");
  });
});

