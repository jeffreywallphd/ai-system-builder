import { describe, expect, it } from "bun:test";
import { InstallModelUseCase } from "../InstallModelUseCase";
import { makeModel } from "../../../domain/services/tests/testUtils";
import { makeInstalledModelCatalog, makeModelInstaller, makeRemoteModelCatalog } from "./testUtils";

describe("InstallModelUseCase", () => {
  it("installs provided model and registers it", async () => {
    const saved: string[] = [];
    const useCase = new InstallModelUseCase({
      modelInstaller: makeModelInstaller(),
      installedModelCatalog: makeInstalledModelCatalog({ saveInstalled: async (m) => (saved.push(m.id), m) }),
    });

    const result = await useCase.execute({ model: makeModel("m1"), destination: "/models/m1" });
    expect(result.installResult.status).toBe("completed");
    expect(saved).toEqual(["m1"]);
    expect(result.model.status).toBe("installed");
  });

  it("resolves and installs model by remote id", async () => {
    const useCase = new InstallModelUseCase({
      modelInstaller: makeModelInstaller(),
      installedModelCatalog: makeInstalledModelCatalog(),
      remoteModelCatalog: makeRemoteModelCatalog({ getById: async () => ({ provider: "hf", model: makeModel("remote") }) }),
    });

    const result = await useCase.execute({ remoteId: "remote", destination: "/models/remote" });
    expect(result.model.id).toBe("remote");
  });

  it("throws when remote id is requested without remote catalog", async () => {
    const useCase = new InstallModelUseCase({
      modelInstaller: makeModelInstaller(),
      installedModelCatalog: makeInstalledModelCatalog(),
    });

    await expect(useCase.execute({ remoteId: "x", destination: "/tmp" })).rejects.toThrow("remote model catalog");
  });
});
