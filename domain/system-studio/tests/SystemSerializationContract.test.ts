import { describe, expect, it } from "bun:test";
import {
  parseSystemSerializationDocument,
  serializeSystemSerializationDocument,
} from "../SystemSerializationContract";

describe("SystemSerializationContract", () => {
  it("parses legacy systemSpec payloads and backfills a canonical serialization contract", () => {
    const content = JSON.stringify({
      systemSpec: {
        components: [{ componentKind: "composite", assetId: "workflow:image-edit", versionId: "workflow:image-edit:v2", alias: "primary" }],
        nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
        inputs: [{ inputId: "prompt", valueType: "string", required: true }],
        outputs: [{ outputId: "result", valueType: "image" }],
        parameters: [{ parameterId: "strength", valueType: "number", defaultValue: 0.6 }],
        bindings: [],
      },
    });

    const parsed = parseSystemSerializationDocument({
      content,
      dependencies: [{ assetId: "dataset:input-store", versionId: "dataset:input-store:v1" }],
    });

    expect(parsed.schemaVersion).toBe("1.0.0");
    expect(parsed.contract?.assetReferences.datasets[0]).toEqual({
      kind: "dataset",
      assetId: "dataset:input-store",
      versionId: "dataset:input-store:v1",
    });
    expect(parsed.contract?.assetReferences.workflows[0]).toEqual({
      kind: "workflow",
      assetId: "workflow:image-edit",
      versionId: "workflow:image-edit:v2",
      alias: "primary",
    });
  });

  it("rejects unsupported serialized schema versions", () => {
    const content = JSON.stringify({
      systemSpec: {
        serialization: {
          contractKind: "ai-loom.system-serialization",
          schemaVersion: "2.0.0",
          compatibility: {
            minimumReaderVersion: "1.0.0",
            legacySystemSpecSupported: true,
          },
          definition: {
            components: [],
            nestedSystems: [],
            dependencies: [],
            inputs: [],
            outputs: [],
            parameters: [],
            bindings: [],
          },
          assetReferences: { datasets: [], workflows: [] },
          runtime: { datasetInstances: [] },
          ui: {},
        },
      },
    });

    expect(() => parseSystemSerializationDocument({ content })).toThrow("unsupported-system-serialization-version:2.0.0");
  });

  it("serializes canonical contract metadata alongside systemSpec content", () => {
    const serialized = serializeSystemSerializationDocument({
      existingContent: JSON.stringify({ systemSpec: { referenceImageRuntimeContext: { foo: "bar" } } }),
      dependencies: [{ assetId: "dataset:io", versionId: "dataset:io:v3" }],
      systemSpec: {
        components: [{ componentKind: "atomic", assetId: "asset:model", versionId: "asset:model:v1", alias: "model" }],
        nestedSystems: [],
        inputs: [{ inputId: "prompt", required: true, valueType: "string" }],
        outputs: [{ outputId: "result", valueType: "image" }],
        parameters: [],
        bindings: [],
      },
    });
    const parsed = JSON.parse(serialized) as { readonly systemSpec?: { readonly serialization?: { readonly schemaVersion?: string } } };
    expect(parsed.systemSpec?.serialization?.schemaVersion).toBe("1.0.0");
  });
});
