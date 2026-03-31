import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AssetConfigurationPanel from "../AssetConfigurationPanel";
import { DataAssetConfigFieldKinds, createDataAssetConfigSchema } from "../../../../application/dataset-studio/DataAssetConfiguration";

describe("AssetConfigurationPanel", () => {
  it("renders empty state when config schema is missing", () => {
    const html = renderToStaticMarkup(React.createElement(AssetConfigurationPanel, {}));
    expect(html).toContain("No configuration schema");
  });

  it("renders schema-driven fields and issue badges", () => {
    const schema = createDataAssetConfigSchema({
      schemaId: "dataset-preview.schema",
      fields: [
        {
          key: "formatHint",
          label: "Input format",
          kind: DataAssetConfigFieldKinds.select,
          defaultValue: "json",
          options: [
            { value: "json", label: "JSON" },
            { value: "csv", label: "CSV" },
          ],
        },
        {
          key: "hasHeaderRow",
          label: "Header row",
          kind: DataAssetConfigFieldKinds.boolean,
          defaultValue: true,
        },
      ],
    });

    const html = renderToStaticMarkup(React.createElement(AssetConfigurationPanel, {
      schema,
      issues: [{
        code: "data-asset-config-select-option-invalid",
        section: "data-asset-config",
        severity: "error",
        message: "Input format must match one of the allowed options.",
        path: "config.values.formatHint",
      }],
    }));

    expect(html).toContain("Asset Configuration");
    expect(html).toContain("dataset-preview.schema");
    expect(html).toContain("Input format");
    expect(html).toContain("Header row");
    expect(html).toContain("1 errors");
  });
});
