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


  it("publishes installed model canonical identity when registration succeeds", async () => {
    const published: string[] = [];
    const useCase = new InstallModelUseCase({
      modelInstaller: makeModelInstaller(),
      installedModelCatalog: makeInstalledModelCatalog(),
      canonicalPublisher: {
        publishInstalledModel: async (model) => {
          published.push(model.id);
          return { assetId: `installed-model:${model.id}`, versionId: `asset-version:${model.id}:1` } as const;
        },
      } as any,
    });

    await useCase.execute({ model: makeModel("m-publish"), destination: "/models/m-publish" });
    expect(published).toEqual(["m-publish"]);
  });

  it("throws when remote id is requested without remote catalog", async () => {
    const useCase = new InstallModelUseCase({
      modelInstaller: makeModelInstaller(),
      installedModelCatalog: makeInstalledModelCatalog(),
    });

    await expect(useCase.execute({ remoteId: "x", destination: "/tmp" })).rejects.toThrow("remote model catalog");
  });
});
