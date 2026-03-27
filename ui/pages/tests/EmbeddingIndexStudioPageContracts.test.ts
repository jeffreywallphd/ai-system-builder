import { describe, expect, it } from "bun:test";
import { readSource } from "../../tests/testUtils";

describe("EmbeddingIndexStudioPage contracts", () => {
  it("binds Embedding Index Studio route surface to the shared Studio Shell page with atomic registration", () => {
    const pageSource = readSource("ui/pages/EmbeddingIndexStudioPage.tsx");
    const registrationSource = readSource("ui/studio-shell/registrations/EmbeddingIndexStudioRegistration.ts");

    expect(pageSource).toContain("StudioShellPage");
    expect(pageSource).toContain("embeddingIndexStudioRegistration");
    expect(pageSource).toContain("atomicStudio={embeddingIndexStudioRegistration}");

    expect(registrationSource).toContain("studioType: EmbeddingIndexStudioIdentity.studioType");
    expect(registrationSource).toContain('role: "embedding-index"');
    expect(registrationSource).toContain('slot: "draft-authoring"');
    expect(registrationSource).toContain('slot: "metadata"');
    expect(registrationSource).toContain("createEmbeddingIndexStudioTaxonomy()");
  });
});
