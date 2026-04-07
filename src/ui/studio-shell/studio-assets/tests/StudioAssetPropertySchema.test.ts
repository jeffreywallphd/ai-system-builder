import { describe, expect, it } from "bun:test";
import { StudioAssetPropertyFieldKinds, type StudioAssetPropertySchema } from "../StudioAssetContracts";
import {
  applyStudioAssetPropertySchemaDefaults,
  listVisibleStudioAssetPropertySections,
  updateStudioAssetConfigByField,
  validateStudioAssetPropertySchema,
} from "../StudioAssetPropertySchema";

const schema: StudioAssetPropertySchema = Object.freeze({
  schemaId: "test.schema",
  schemaVersion: "1.0.0",
  sections: Object.freeze([
    Object.freeze({
      id: "general",
      label: "General",
      fields: Object.freeze([
        Object.freeze({
          id: "name",
          path: "name",
          label: "Name",
          kind: StudioAssetPropertyFieldKinds.text,
          required: true,
          defaultValue: "Untitled",
        }),
        Object.freeze({
          id: "advancedEnabled",
          path: "advanced.enabled",
          label: "Advanced enabled",
          kind: StudioAssetPropertyFieldKinds.boolean,
          defaultValue: false,
        }),
        Object.freeze({
          id: "advancedNotes",
          path: "advanced.notes",
          label: "Advanced notes",
          kind: StudioAssetPropertyFieldKinds.textarea,
          visibilityRule: Object.freeze({ field: "advanced.enabled", equals: true }),
        }),
      ]),
    }),
  ]),
});

describe("StudioAssetPropertySchema", () => {
  it("applies defaults and supports nested path updates", () => {
    const withDefaults = applyStudioAssetPropertySchemaDefaults({ schema, config: Object.freeze({}) });
    expect(withDefaults.name).toBe("Untitled");
    expect((withDefaults.advanced as Record<string, unknown>).enabled).toBe(false);

    const updated = updateStudioAssetConfigByField({
      config: withDefaults,
      fieldPath: "advanced.enabled",
      value: true,
    });
    expect((updated.advanced as Record<string, unknown>).enabled).toBe(true);
  });

  it("filters visible fields and reports required issues", () => {
    const withDefaults = applyStudioAssetPropertySchemaDefaults({ schema, config: Object.freeze({ name: "" }) });
    const sections = listVisibleStudioAssetPropertySections({
      schema,
      config: withDefaults,
    });
    expect(sections[0]?.fields.map((field) => field.id)).toEqual(["name", "advancedEnabled"]);

    const issues = validateStudioAssetPropertySchema({ schema, config: withDefaults });
    expect(issues.map((issue) => issue.path)).toEqual(["name"]);
  });
});
