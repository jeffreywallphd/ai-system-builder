import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("DatasetStudioPage contracts", () => {
  it("binds Dataset Studio route surface to the shared Studio Shell page with atomic registration", () => {
    const pageSource = readSource("ui/pages/DatasetStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/DatasetStudioRegistration.ts");
    const previewPanelSource = readSource("ui/components/assets/DatasetStudioDraftPreviewPanel.tsx");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("datasetStudioRegistration");
    expect(pageSource).toContain("studioRegistration={datasetStudioRegistration}");

    expect(registrationSource).toContain("studioType: DatasetStudioIdentity.studioType");
    expect(registrationSource).toContain('role: "dataset"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain('slot: "metadata"');
    expect(registrationSource).toContain("createDatasetStudioTaxonomy()");
    expect(registrationSource).toContain("experienceAssets");
    expect(registrationSource).toContain("ExperienceSurfaceAssetIds.loomWizard");
    expect(registrationSource).toContain("ExperienceSurfaceAssetIds.loomCanvas");
    expect(registrationSource).toContain('kind: "save-draft"');
    expect(registrationSource).toContain('kind: "run-validation"');
    expect(registrationSource).toContain('kind: "refresh-snapshot"');
    expect(registrationSource).toContain("DatasetStudioDraftPreviewPanel");
    expect(registrationSource).toContain('id: "dataset-studio-data-preview-panel"');
    expect(previewPanelSource).toContain("AssetConfigurationPanel");
    expect(previewPanelSource).toContain("getDataStudioAssetRegistry");
    expect(previewPanelSource).toContain("Source Input");
    expect(previewPanelSource).toContain("UnifiedIngestionAssetId");
    expect(previewPanelSource).toContain("Inspect low-level ingestors");
  });
});
