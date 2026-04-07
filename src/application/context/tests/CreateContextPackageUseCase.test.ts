import { describe, expect, it } from "bun:test";
import { CreateContextPackageUseCase } from "../CreateContextPackageUseCase";
import { InMemoryContextPackageRepository } from "@infrastructure/mocks/repositories/InMemoryContextPackageRepository";

describe("CreateContextPackageUseCase", () => {
  it("preserves stable context package identity across saves", async () => {
    const repository = new InMemoryContextPackageRepository();
    const useCase = new CreateContextPackageUseCase({
      contextPackageRepository: repository,
      createId: () => "ctx-foundation",
    });

    const firstResult = await useCase.execute({
      name: "Foundation Prompt Context",
      fragments: [
        { id: "instruction", kind: "instructions", content: "Be concise.", order: 2 },
        { id: "persona", kind: "persona", content: "You are a careful assistant.", order: 1 },
      ],
    });

    const secondResult = await useCase.execute({
      id: " ctx-foundation ",
      name: "Foundation Prompt Context",
      fragments: [{ id: "format", kind: "formatting-constraints", content: "Return markdown.", order: 0 }],
    });

    expect(firstResult.contextPackage.id).toBe("ctx-foundation");
    expect(firstResult.created).toBe(true);
    expect(secondResult.contextPackage.id).toBe("ctx-foundation");
    expect(secondResult.created).toBe(false);
  });

  it("orders fragments deterministically for reuse across orchestration paths", async () => {
    const repository = new InMemoryContextPackageRepository();
    const useCase = new CreateContextPackageUseCase({
      contextPackageRepository: repository,
      createId: () => "ctx-ordered",
    });

    const result = await useCase.execute({
      name: "Ordered Package",
      fragments: [
        { id: "z-last", kind: "examples", content: "Example 2", order: 10 },
        { id: "a-first", kind: "instructions", content: "Instruction", order: 0 },
        { id: "m-middle", kind: "retrieved-context", content: "Retrieved chunk", order: 10 },
      ],
    });

    expect(result.contextPackage.fragments.map((fragment) => fragment.id)).toEqual([
      "a-first",
      "m-middle",
      "z-last",
    ]);
  });
});

