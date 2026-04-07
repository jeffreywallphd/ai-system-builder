import { describe, expect, it } from "bun:test";
import { createDefaultStudioAssetRegistry } from "../StudioAssetRegistry";
import { createStudioAssetPreviewModel } from "../StudioAssetPreview";

describe("StudioAssetPreview", () => {
  it("creates atomic preview models with schema defaults", () => {
    const registry = createDefaultStudioAssetRegistry();
    const registration = registry.getById("ui-primitive:text-input");
    expect(registration).toBeDefined();

    const preview = createStudioAssetPreviewModel({ registration: registration! });
    expect(preview.kind).toBe("atomic-control");
    expect(preview.config.label).toBe("Text Input");
  });

  it("falls back to summary previews for non-atomic assets", () => {
    const registry = createDefaultStudioAssetRegistry();
    const registration = registry.getById("workflow-studio");
    expect(registration).toBeDefined();

    const preview = createStudioAssetPreviewModel({ registration: registration! });
    expect(preview.kind).toBe("summary");
  });
});
