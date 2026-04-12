import { describe, expect, it } from "bun:test";
import {
  PlatformAuditEventKinds,
  PlatformRunKinds,
  normalizePlatformPersistenceOperationKey,
  toPlatformAuditEventLookupKey,
} from "../PlatformPersistenceDtos";

describe("PlatformPersistenceDtos", () => {
  it("defines stable run and audit vocabularies", () => {
    expect(Object.values(PlatformRunKinds)).toEqual([
      "workflow",
      "agent",
      "system",
    ]);
    expect(Object.values(PlatformAuditEventKinds)).toContain("runs");
  });

  it("normalizes operation keys and produces audit lookup keys", () => {
    expect(normalizePlatformPersistenceOperationKey("  RUN-Create-001  ")).toBe("run-create-001");
    expect(toPlatformAuditEventLookupKey({
      eventKind: "security",
      eventId: "evt-1",
    })).toBe("security:evt-1");
  });
});
