import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("DatasetStudioPage contracts", () => {
  it("binds Dataset Studio route surface to the shared Studio Shell page with atomic registration", () => {
    const pageSource = readSource("ui/pages/DatasetStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/DatasetStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("datasetStudioRegistration");
    expect(pageSource).toContain("studioRegistration={datasetStudioRegistration}");

    expect(registrationSource).toContain("studioType: DatasetStudioIdentity.studioType");
    expect(registrationSource).toContain('role: "dataset"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain('slot: "metadata"');
    expect(registrationSource).toContain("createDatasetStudioTaxonomy()");
  });
});
