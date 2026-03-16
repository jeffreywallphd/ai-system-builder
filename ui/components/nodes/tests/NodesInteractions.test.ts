import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("ui/components/nodes interactions", () => {
  it("keeps placeholder modules consistent for NodeComponent.tsx, NodePortView.tsx, NodePropertyEditor.tsx", () => {
    const sources = [readSource("ui/components/nodes/NodeComponent.tsx"), readSource("ui/components/nodes/NodePortView.tsx"), readSource("ui/components/nodes/NodePropertyEditor.tsx")];
    expect(sources.every((source) => source.trim() === "")).toBeTrue();
  });
});
