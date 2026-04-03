import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ComfyImageManipulationPropertySchema,
  createComfyImageManipulationDefaultConfig,
} from "../../../../application/system-studio/ComfyImageManipulationPropertySchema";
import { ComfyImageManipulationPropertyEditor } from "../image-system/ComfyImageManipulationPropertyEditor";

describe("ComfyImageManipulationPropertyEditor", () => {
  it("keeps advanced controls in collapsed, labeled sections", () => {
    const html = renderToStaticMarkup(React.createElement(ComfyImageManipulationPropertyEditor, {
      value: createComfyImageManipulationDefaultConfig(),
      presetId: ComfyImageManipulationPropertySchema.defaultPresetId,
      onChange: () => undefined,
      onPresetIdChange: () => undefined,
    }));

    expect(html).toContain("Advanced controls (optional)");
    expect(html).toContain("Model choices");
    expect(html).toContain("Generation tuning");
    expect(html).toContain("Identity timing and model controls");
    expect(html).toContain("Main editing instructions");
    expect(html).toContain("Image and result settings");
  });
});
