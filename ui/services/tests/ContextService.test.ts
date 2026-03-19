import { describe, expect, it } from "bun:test";
import { ContextService } from "../ContextService";
import { CreateContextPackageUseCase } from "../../../application/context/CreateContextPackageUseCase";
import { UpdateContextPackageUseCase } from "../../../application/context/UpdateContextPackageUseCase";
import { DeleteContextPackageUseCase } from "../../../application/context/DeleteContextPackageUseCase";
import { ListContextPackagesUseCase } from "../../../application/context/ListContextPackagesUseCase";
import { LoadContextPackageUseCase } from "../../../application/context/LoadContextPackageUseCase";
import { SearchContextPackagesUseCase } from "../../../application/context/SearchContextPackagesUseCase";
import { InMemoryContextPackageRepository } from "../../../infrastructure/mocks/repositories/InMemoryContextPackageRepository";

describe("ContextService", () => {
  it("wraps create, update, delete, load, list, and search context use cases", async () => {
    const repository = new InMemoryContextPackageRepository();
    const service = new ContextService({
      createContextPackageUseCase: new CreateContextPackageUseCase({
        contextPackageRepository: repository,
        createId: () => "ctx-service",
      }),
      updateContextPackageUseCase: new UpdateContextPackageUseCase({
        contextPackageRepository: repository,
        now: () => new Date("2026-03-19T00:00:00.000Z"),
      }),
      deleteContextPackageUseCase: new DeleteContextPackageUseCase(repository),
      listContextPackagesUseCase: new ListContextPackagesUseCase(repository),
      loadContextPackageUseCase: new LoadContextPackageUseCase(repository),
      searchContextPackagesUseCase: new SearchContextPackagesUseCase(repository),
    });

    const created = await service.createContextPackage({
      name: "Service Package",
      description: "For authors",
      tags: ["authoring"],
      fragments: [{ id: "instructions", kind: "instructions", content: "Alpha", order: 1 }],
    });
    const updated = await service.updateContextPackage({
      contextPackageId: created.contextPackage.id,
      name: "Service Package v2",
      description: "Updated for authors",
      tags: ["authoring", "shared"],
      fragments: [{ id: "instructions", kind: "instructions", content: "Beta", order: 0 }],
    });
    const searched = await service.searchContextPackages({ query: "updated" });
    const loaded = await service.loadContextPackage(updated.contextPackage.id);
    const listed = await service.listContextPackages();
    const deleted = await service.deleteContextPackage(updated.contextPackage.id);

    expect(searched.contextPackages[0]?.id).toBe("ctx-service");
    expect(loaded.contextPackage?.name).toBe("Service Package v2");
    expect(listed.contextPackages).toHaveLength(1);
    expect(deleted.deleted).toBe(true);
  });
});
