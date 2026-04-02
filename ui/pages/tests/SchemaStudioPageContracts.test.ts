import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("SchemaStudioPage contracts", () => {
  it("binds Schema Studio route surface to the shared Studio Shell page with schema registration", () => {
    const pageSource = readSource("ui/pages/SchemaStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/SchemaStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("schemaStudioRegistration");
    expect(pageSource).toContain("studioRegistration={schemaStudioRegistration}");

    expect(registrationSource).toContain("studioType: SchemaStudioIdentity.studioType");
    expect(registrationSource).toContain('role: "schema"');
    expect(registrationSource).toContain("createSchemaAssetMetadata");
    expect(registrationSource).toContain("serializeSchemaAssetDocument");
    expect(registrationSource).toContain('kind: "save-draft"');
    expect(registrationSource).toContain('kind: "run-validation"');
    expect(registrationSource).toContain('kind: "refresh-snapshot"');
  });
});
