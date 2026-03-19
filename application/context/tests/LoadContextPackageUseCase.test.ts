import { describe, expect, it } from "bun:test";
import { LoadContextPackageUseCase } from "../LoadContextPackageUseCase";
import { ContextPackage } from "../models/ContextPackage";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";

describe("LoadContextPackageUseCase", () => {
  it("loads a reusable context package with ordered fragments intact", async () => {
    const repository = new InMemoryContextPackageRepository([
      new ContextPackage({
        id: "ctx-shared",
        name: "Shared Context",
        fragments: [
          { id: "b", kind: "examples", content: "Example", order: 20 },
          { id: "a", kind: "instructions", content: "Instruction", order: 10 },
        ],
      }),
    ]);

    const result = await new LoadContextPackageUseCase(repository).execute({
      contextPackageId: " ctx-shared ",
    });

    expect(result.contextPackage?.id).toBe("ctx-shared");
    expect(result.contextPackage?.fragments.map((fragment) => fragment.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("returns undefined when not found and throwIfNotFound is false", async () => {
    const result = await new LoadContextPackageUseCase(
      new InMemoryContextPackageRepository()
    ).execute({
      contextPackageId: "missing",
      throwIfNotFound: false,
    });

    expect(result.contextPackage).toBeUndefined();
  });
});
