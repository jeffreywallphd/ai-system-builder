import { describe, expect, it } from "bun:test";
import {
  assertExpectedPersistenceRevision,
  nextPersistenceRevision,
  PersistenceOptimisticConcurrencyError,
} from "../PersistenceVersioning";

describe("PersistenceVersioning", () => {
  it("increments revisions from persisted state", () => {
    expect(nextPersistenceRevision(undefined)).toBe(1);
    expect(nextPersistenceRevision(0)).toBe(1);
    expect(nextPersistenceRevision(5)).toBe(6);
  });

  it("enforces expected revision checks", () => {
    expect(() => assertExpectedPersistenceRevision(2, 1, "Node")).toThrow(PersistenceOptimisticConcurrencyError);
    expect(() => assertExpectedPersistenceRevision(1, 1, "Node")).not.toThrow();
    expect(() => assertExpectedPersistenceRevision(undefined, 1, "Node")).not.toThrow();
  });
});
