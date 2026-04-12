import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("DatasetPipelineStudioPage contracts", () => {
  it("binds Dataset Pipeline Studio route surface to the shared Studio Shell page with composite registration", () => {
    const pageSource = readSource("ui/pages/DatasetPipelineStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/DatasetPipelineStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("datasetPipelineStudioRegistration");
    expect(pageSource).toContain("studioRegistration={datasetPipelineStudioRegistration}");

    expect(registrationSource).toContain("studioType: DatasetPipelineStudioIdentity.studioType");
    expect(registrationSource).toContain('kind: "composite"');
    expect(registrationSource).toContain('role: "dataset-pipeline"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain('createDatasetPipelineStudioTaxonomy("deterministic")');
  });
});
