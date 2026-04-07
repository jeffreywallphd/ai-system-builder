import { describe, expect, it } from "bun:test";
import type { IModelInstaller } from "../../ports/interfaces/IModelInstaller";
import type { IInstalledModelCatalog } from "../../ports/interfaces/IInstalledModelCatalog";
import { makeModel } from "../../../domain/services/tests/testUtils";
import { makeInstalledModelCatalog, makeModelInstaller } from "./testUtils";

describe("application/models interface contracts", () => {
  it("doubles satisfy model installer and catalog contracts", async () => {
    const installer: IModelInstaller = makeModelInstaller();
    const catalog: IInstalledModelCatalog = makeInstalledModelCatalog();

    expect(installer.canInstall({ model: makeModel("x"), destination: "/tmp" })).toBeTrue();
    expect(await catalog.listInstalled()).toEqual([]);
  });
});
