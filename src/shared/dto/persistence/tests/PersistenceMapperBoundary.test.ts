import { describe, expect, it } from "bun:test";
import {
  createPersistenceMapperBoundary,
  parsePersistenceReplaySnapshot,
  type PersistenceMapperBoundary,
} from "../PersistenceMapperBoundary";

interface ExampleRow {
  readonly id: string;
  readonly value: string;
}

interface ExampleDomain {
  readonly id: string;
  readonly value: string;
}

describe("PersistenceMapperBoundary", () => {
  it("supports creating reusable mapper boundaries", () => {
    const mapper: PersistenceMapperBoundary<ExampleRow, ExampleDomain> = {
      toDomain(row) {
        return Object.freeze({ id: row.id, value: row.value });
      },
      toPersistence(domain) {
        return Object.freeze([domain.id, domain.value]);
      },
      parseReplaySnapshot(snapshotJson) {
        return parsePersistenceReplaySnapshot(snapshotJson, (payload) => payload as ExampleDomain);
      },
    };

    const boundary = createPersistenceMapperBoundary(mapper);
    expect(boundary.toDomain({ id: "a", value: "v" })).toEqual({ id: "a", value: "v" });
    expect(boundary.toPersistence({ id: "a", value: "v" })).toEqual(["a", "v"]);
  });

  it("raises clear errors for malformed replay payloads", () => {
    expect(() => parsePersistenceReplaySnapshot("{bad-json", (payload) => payload as ExampleDomain))
      .toThrow("Persistence replay snapshot is invalid");
  });
});
