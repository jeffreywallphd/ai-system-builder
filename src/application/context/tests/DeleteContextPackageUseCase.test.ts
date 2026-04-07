import { describe, expect, it } from "bun:test";
import { DeleteContextPackageUseCase } from "../DeleteContextPackageUseCase";
import { ContextPackage } from "../models/ContextPackage";
import { InMemoryContextPackageRepository } from "@infrastructure/mocks/repositories/InMemoryContextPackageRepository";

describe("DeleteContextPackageUseCase", () => {
  it("deletes an existing context package", async () => {
    const repository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "ctx-delete",
        name: "Delete Me",
        fragments: [{ id: "instructions", kind: "instructions", content: "Remove", order: 0 }],
      }),
    ]);

    const result = await new DeleteContextPackageUseCase(repository).execute({
      contextPackageId: " ctx-delete ",
    });

    expect(result.deleted).toBe(true);
    expect(await repository.exists("ctx-delete")).toBe(false);
  });

  it("returns deleted=false when throwIfNotFound is false", async () => {
    const result = await new DeleteContextPackageUseCase(
      new InMemoryContextPackageRepository(),
    ).execute({
      contextPackageId: "missing",
      throwIfNotFound: false,
    });

    expect(result.deleted).toBe(false);
  });
});

