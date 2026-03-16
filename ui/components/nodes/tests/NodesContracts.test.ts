import { describe, expect, it } from "bun:test";
import { importModule } from "../../../tests/testUtils";

describe("ui/components/nodes contract adherence", () => {
  it("placeholder modules expose no runtime exports yet", async () => {
    expect(Object.keys(await importModule("ui/components/nodes/NodeComponent.tsx"))).toEqual([]);
    expect(Object.keys(await importModule("ui/components/nodes/NodePortView.tsx"))).toEqual([]);
    expect(Object.keys(await importModule("ui/components/nodes/NodePropertyEditor.tsx"))).toEqual([]);
  });
});
