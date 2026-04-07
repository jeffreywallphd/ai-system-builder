import { describe, expect, it } from "bun:test";
import {
  resolvePersistenceMutationCreatedAt,
  resolvePersistenceMutationMetadata,
} from "../PersistenceMutationMetadata";

describe("PersistenceMutationMetadata", () => {
  it("resolves created and modified audit stamps for new records", () => {
    const metadata = resolvePersistenceMutationMetadata({
      createdAt: "2026-04-06T12:00:00.000Z",
      createdBy: "user:seed",
      actorId: "user:actor",
      expectedRevision: 0,
      occurredAt: "2026-04-06T12:01:00.000Z",
      entityName: "Role assignment",
    });

    expect(metadata).toEqual({
      createdAt: "2026-04-06T12:00:00.000Z",
      createdBy: "user:seed",
      lastModifiedAt: "2026-04-06T12:01:00.000Z",
      lastModifiedBy: "user:actor",
      revision: 1,
    });
  });

  it("preserves created stamp and increments revision for updates", () => {
    const metadata = resolvePersistenceMutationMetadata({
      existing: {
        createdAt: "2026-04-06T12:00:00.000Z",
        createdBy: "user:seed",
        lastModifiedAt: "2026-04-06T12:01:00.000Z",
        lastModifiedBy: "user:seed",
        revision: 4,
      },
      createdAt: "2026-04-06T12:00:00.000Z",
      createdBy: "user:seed",
      actorId: "user:actor",
      expectedRevision: 4,
      occurredAt: "2026-04-06T12:02:00.000Z",
      entityName: "Role assignment",
    });

    expect(metadata.createdAt).toBe("2026-04-06T12:00:00.000Z");
    expect(metadata.createdBy).toBe("user:seed");
    expect(metadata.revision).toBe(5);
  });

  it("resolves replay record createdAt via common timestamp helper", () => {
    const createdAt = resolvePersistenceMutationCreatedAt(undefined, {
      now: () => "2026-04-06T12:03:00.000Z",
    });

    expect(createdAt).toBe("2026-04-06T12:03:00.000Z");
  });
});
