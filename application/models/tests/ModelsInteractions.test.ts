import { describe, expect, it } from "bun:test";
import { InstallModelUseCase } from "../InstallModelUseCase";
import { ListInstalledModelsUseCase } from "../ListInstalledModelsUseCase";
import { RemoveModelUseCase } from "../RemoveModelUseCase";
import { makeModel } from "../../../domain/services/tests/testUtils";
import { makeInstalledModelCatalog, makeModelInstaller } from "./testUtils";

describe("application/models interactions", () => {
  it("install -> list -> remove sequence updates in-memory catalog", async () => {
    const store = new Map<string, ReturnType<typeof makeModel>>();
    const catalog = makeInstalledModelCatalog({
      saveInstalled: async (model) => (store.set(model.id, model as ReturnType<typeof makeModel>), model),
      listInstalled: async () => [...store.values()],
      removeInstalled: async (id) => store.delete(id),
      getInstalledById: async (id) => store.get(id),
    });

    const install = new InstallModelUseCase({ modelInstaller: makeModelInstaller(), installedModelCatalog: catalog });
    await install.execute({ model: makeModel("flow-model"), destination: "/models/flow-model" });

    const listed = await new ListInstalledModelsUseCase(catalog).execute();
    const removed = await new RemoveModelUseCase({ installedModelCatalog: catalog, modelInstaller: makeModelInstaller() }).execute({ modelId: "flow-model" });

    expect(listed.models).toHaveLength(1);
    expect(removed.removed).toBeTrue();
  });
});
