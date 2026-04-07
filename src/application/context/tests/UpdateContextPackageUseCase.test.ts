import { describe, expect, it } from "bun:test";
import { UpdateContextPackageUseCase } from "../UpdateContextPackageUseCase";
import { ContextPackage } from "../models/ContextPackage";
import { InMemoryContextPackageRepository } from "@infrastructure/mocks/repositories/InMemoryContextPackageRepository";

describe("UpdateContextPackageUseCase", () => {
  it("preserves package identity, createdAt, and deterministic fragment ordering", async () => {
    const createdAt = new Date("2026-03-18T10:00:00.000Z");
    const updatedAt = new Date("2026-03-19T15:30:00.000Z");
    const repository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "ctx-authoring",
        name: "Authoring Context",
        tags: ["shared"],
        fragments: [
          { id: "persona", kind: "persona", content: "Original persona", order: 5 },
          { id: "instructions", kind: "instructions", content: "Original instructions", order: 1 },
        ],
        audit: { createdAt, updatedAt: createdAt },
      }),
    ]);

    const result = await new UpdateContextPackageUseCase({
      contextPackageRepository: repository,
      now: () => updatedAt,
    }).execute({
      contextPackageId: " ctx-authoring ",
      name: "Authoring Context v2",
      description: "Reusable guidance for authors.",
      tags: ["shared", "team"],
      fragments: [
        { id: "z-last", kind: "examples", content: "Example", order: 10 },
        { id: "a-first", kind: "instructions", content: "New instructions", order: 0 },
      ],
      references: [{ packageId: "base-persona" }],
    });

    expect(result.contextPackage.id).toBe("ctx-authoring");
    expect(result.contextPackage.audit?.createdAt?.toISOString()).toBe(createdAt.toISOString());
    expect(result.contextPackage.audit?.updatedAt?.toISOString()).toBe(updatedAt.toISOString());
    expect(result.contextPackage.fragments.map((fragment) => fragment.id)).toEqual(["a-first", "z-last"]);
    expect(result.contextPackage.references[0]?.packageId).toBe("base-persona");
  });

  it("throws when the package does not exist", async () => {
    await expect(
      new UpdateContextPackageUseCase({
        contextPackageRepository: new InMemoryContextPackageRepository(),
      }).execute({
        contextPackageId: "missing",
        name: "Missing",
      }),
    ).rejects.toThrow("Context package 'missing' was not found.");
  });
});

