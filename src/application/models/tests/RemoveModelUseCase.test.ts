import { describe, expect, it } from "bun:test";
import { RemoveModelUseCase } from "../RemoveModelUseCase";
import { makeModel } from "../../../domain/services/tests/testUtils";
import { makeInstalledModelCatalog, makeModelInstaller } from "./testUtils";

describe("RemoveModelUseCase", () => {
  it("uninstalls and unregisters a model", async () => {
    let uninstalled = false;
    const result = await new RemoveModelUseCase({
      installedModelCatalog: makeInstalledModelCatalog({ removeInstalled: async () => true }),
      modelInstaller: makeModelInstaller({ uninstall: async () => void (uninstalled = true) }),
    }).execute({ model: makeModel("rm"), removeArtifacts: true });

    expect(uninstalled).toBeTrue();
    expect(result.removed).toBeTrue();
  });

  it("throws if installer cannot uninstall", async () => {
    const useCase = new RemoveModelUseCase({
      installedModelCatalog: makeInstalledModelCatalog(),
      modelInstaller: makeModelInstaller({ canUninstall: () => false }),
    });

    await expect(useCase.execute({ model: makeModel("bad") })).rejects.toThrow("cannot be uninstalled");
  });
});
