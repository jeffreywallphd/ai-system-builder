import { describe, expect, it } from "bun:test";
import {
  WorkflowSerializationResult,
  WorkflowSerializer,
} from "../WorkflowSerializer";
import type { IWorkflowSerializer } from "../interfaces/IWorkflowSerializer";
import { makeWorkflow } from "./testUtils";

describe("WorkflowSerializer", () => {
  it("validates serialization result", () => {
    const result = new WorkflowSerializationResult({ content: "{}", format: "json", contentType: " Application/Json " });
    expect(result.contentType).toBe("application/json");
    expect(() => new WorkflowSerializationResult({ content: "   ", format: "json" })).toThrow();
  });

  it("delegates serialize/deserialize and availability checks", async () => {
    const wf = makeWorkflow();
    const provider: IWorkflowSerializer = {
      canSerialize: (target) => target.format === "json",
      canDeserialize: (source) => source.format === "json",
      serialize: async () => ({ content: '{"id":"wf-1"}', format: "json", contentType: "application/json" }),
      deserialize: async () => wf,
    };

    const serializer = new WorkflowSerializer([provider]);
    const serialized = await serializer.serialize({ workflow: wf, target: { format: "json" } });
    const deserialized = await serializer.deserialize({ content: serialized.content, source: { format: "json" } });

    expect(serialized.format).toBe("json");
    expect(deserialized.id).toBe("wf-1");
    expect(serializer.canSerialize({ format: "json" })).toBeTrue();
    expect(serializer.canDeserialize({ format: "json" })).toBeTrue();
  });

  it("throws clear errors when unsupported", async () => {
    const serializer = new WorkflowSerializer([]);

    expect(serializer.serialize({ workflow: makeWorkflow(), target: { format: "yaml", runtime: "custom" } })).rejects.toThrow("No workflow serializer is available for format 'yaml' and runtime 'custom'.");
    expect(serializer.deserialize({ content: "x", source: { format: "yaml", runtime: "custom" } })).rejects.toThrow("No workflow serializer is available for source format 'yaml' and runtime 'custom'.");
  });
});
