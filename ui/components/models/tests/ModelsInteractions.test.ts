import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/models interactions", () => {
  it("wires model browser composition and page integration", () => {
    const browser = readSource("ui/components/models/ModelBrowser.tsx");
    const page = readSource("ui/pages/ModelsPage.tsx");

    expect(browser).toContain("<ModelSearchBar");
    expect(browser).toContain("<ModelCompatibilityPanel");
    expect(browser).toContain("onInstallRemoteFiles");
    expect(browser).toContain("<div className=\"ui-panel__title\">Installed Models</div>");
    expect(browser).toContain("<div className=\"ui-panel__title\">Remote Catalog</div>");
    expect(browser.indexOf("Installed Models")).toBeLessThan(browser.indexOf("Remote Catalog"));
    expect(page).toContain("import ModelBrowser");
    expect(page).toContain("onSearch={(value) => {");
    expect(page).toContain("settingsStore.subscribe");
    expect(page).toContain("settingsState.settings.models.installDirectory");
    expect(page).toContain("createInstallationModel(remoteModel.model, installTargets)");
    expect(page).toContain("state.remoteModels");
    expect(page).toContain("destination: `${installBaseDirectory}/");
  });
});
