import { describe, expect, it } from "bun:test";
import {
  isIsoUtcTimestamp,
  resolvePersistenceTimestamp,
} from "../PersistenceTimestamps";

describe("PersistenceTimestamps", () => {
  it("uses provided canonical timestamps or falls back to clock", () => {
    const fixedClock = {
      now: () => "2026-04-06T12:00:00.000Z",
    };

    expect(resolvePersistenceTimestamp("2026-04-06T12:01:00.000Z", fixedClock)).toBe("2026-04-06T12:01:00.000Z");
    expect(resolvePersistenceTimestamp(undefined, fixedClock)).toBe("2026-04-06T12:00:00.000Z");
  });

  it("validates canonical utc timestamp shape", () => {
    expect(isIsoUtcTimestamp("2026-04-06T12:00:00.000Z")).toBeTrue();
    expect(isIsoUtcTimestamp("2026-04-06T12:00:00Z")).toBeTrue();
    expect(resolvePersistenceTimestamp("2026-04-06T07:00:00-05:00")).toBe("2026-04-06T12:00:00.000Z");
    expect(() => resolvePersistenceTimestamp("not-a-date")).toThrow("ISO-8601 UTC");
  });
});
