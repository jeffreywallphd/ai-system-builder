import { describe, expect, it } from "bun:test";
import {
  createSystemContextWorkflowMappingConfiguration,
  duplicateSystemContextWorkflowMappingConfiguration,
  serializeSystemContextWorkflowMappingConfiguration,
} from "../SystemContextWorkflowMappingConfiguration";

describe("SystemContextWorkflowMappingConfiguration", () => {
  it("creates a reusable mapping configuration with explicit source/target mapping", () => {
    const config = createSystemContextWorkflowMappingConfiguration({
      mappings: [
        {
          mappingId: "map.prompt",
          sourceRoot: "parameters",
          sourcePath: "prompt",
          targetKind: "workflow-input",
          targetPath: "prompt",
          required: true,
        },
      ],
    });

    expect(config.mappings[0]?.mappingId).toBe("map.prompt");
    expect(config.mappings[0]?.sourceRoot).toBe("parameters");
    expect(config.mappings[0]?.targetKind).toBe("workflow-input");
  });

  it("supports stable serialization + duplication for persistence/reuse", () => {
    const config = createSystemContextWorkflowMappingConfiguration({
      mappings: [
        {
          mappingId: "map.selected-image",
          sourceRoot: "selected-image",
          targetKind: "workflow-metadata",
          targetPath: "selectedImage",
          transformId: "selected-image-summary",
        },
      ],
    });

    const serialized = serializeSystemContextWorkflowMappingConfiguration(config);
    const loaded = createSystemContextWorkflowMappingConfiguration(serialized);
    const duplicate = duplicateSystemContextWorkflowMappingConfiguration(config);

    expect(loaded).toEqual(config);
    expect(duplicate).toEqual(config);
    expect(duplicate).not.toBe(config);
  });

  it("rejects duplicate mapping ids", () => {
    expect(() => createSystemContextWorkflowMappingConfiguration({
      mappings: [
        { mappingId: "duplicate", sourceRoot: "parameters", targetKind: "workflow-input", targetPath: "a" },
        { mappingId: "duplicate", sourceRoot: "runtime", targetKind: "workflow-metadata", targetPath: "b" },
      ],
    })).toThrow("must be unique");
  });
});
