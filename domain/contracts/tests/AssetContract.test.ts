import { describe, expect, it } from "bun:test";
import { createAssetContractDescriptor } from "../AssetContract";

describe("AssetContract", () => {
  it("normalizes and freezes a compact asset contract descriptor", () => {
    const descriptor = createAssetContractDescriptor({
      version: " 1.0.0 ",
      input: { kind: "json-schema", description: " input " },
      output: { kind: "text" },
      parameters: [
        { id: " maxTokens ", required: false, description: " tokens ", valueType: "number", defaultValue: 1000 },
      ],
      execution: { invocationMode: "async", sideEffects: "bounded" },
    });

    expect(descriptor.version).toBe("1.0.0");
    expect(descriptor.parameters[0]?.id).toBe("maxTokens");
    expect(Object.isFrozen(descriptor)).toBeTrue();
  });

  it("rejects empty contract versions", () => {
    expect(() => createAssetContractDescriptor({ version: " ", parameters: [] })).toThrow();
  });
});
