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
          runtime: { datasetInstances: [], workflowBindings: [] },
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

  it("supports persisted dataset-instance runtime state and explicit workflow version bindings", () => {
    const content = JSON.stringify({
      systemSpec: {
        components: [{ componentKind: "composite", assetId: "workflow:image-edit", versionId: "workflow:image-edit:v2", alias: "primary" }],
        serialization: {
          contractKind: "ai-loom.system-serialization",
          schemaVersion: "1.0.0",
          compatibility: {
            minimumReaderVersion: "1.0.0",
            legacySystemSpecSupported: true,
          },
          definition: {
            components: [{ componentKind: "composite", assetId: "workflow:image-edit", versionId: "workflow:image-edit:v2", alias: "primary" }],
            nestedSystems: [],
            dependencies: [],
            inputs: [],
            outputs: [],
            parameters: [],
            bindings: [],
          },
          assetReferences: {
            datasets: [],
            workflows: [{ kind: "workflow", assetId: "workflow:image-edit", versionId: "workflow:image-edit:v2", alias: "primary" }],
          },
          runtime: {
            datasetInstances: [{
              instanceId: "dataset-instance:output",
              datasetAssetId: "dataset:image-output",
              datasetVersionId: "dataset:image-output:v1",
              role: "output-store",
              persistedState: {
                instance: {
                  instanceId: "dataset-instance:output",
                  systemId: "system:image",
                  datasetAssetId: "dataset:image-output",
                  role: "output-store",
                  lifecycleStatus: "ready",
                  runtimeStatus: "idle",
                  createdAt: "2026-04-01T00:00:00.000Z",
                  updatedAt: "2026-04-01T00:00:00.000Z",
                },
                imageRecords: [],
              },
            }],
            workflowBindings: [{
              bindingId: "component:primary",
              componentAlias: "primary",
              workflowAssetId: "workflow:image-edit",
              workflowVersionId: "workflow:image-edit:v2",
              pinMode: "version",
            }],
          },
          ui: {},
        },
      },
    });

    const parsed = parseSystemSerializationDocument({ content });
    expect(parsed.contract?.runtime.datasetInstances[0]?.persistedState?.instance).toBeDefined();
    expect(parsed.contract?.runtime.workflowBindings[0]?.workflowVersionId).toBe("workflow:image-edit:v2");
  });
});
