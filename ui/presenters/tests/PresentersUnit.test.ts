import { describe, expect, it } from "bun:test";
import { AssetPresenter } from "../AssetPresenter";
import { ModelPresenter } from "../ModelPresenter";
import { NodePresenter } from "../NodePresenter";
import { ValidationPresenter } from "../ValidationPresenter";
import { WorkflowOutputPresenter } from "../WorkflowOutputPresenter";

describe("ui/presenters unit", () => {
  it("AssetPresenter formats and derives detail fields", () => {
    const presenter = new AssetPresenter();
    const createdAt = new Date("2024-03-01T12:00:00.000Z");
    const asset = {
      id: "asset-1",
      name: "Result Image",
      version: "1",
      kind: "image",
      status: "ready",
      source: { type: "generated", workflowId: "wf", nodeId: "n1", provider: "  comfy  " },
      location: { accessMethod: "file", location: "/tmp/out.png", format: "png", contentType: "image/png" },
      technicalMetadata: { sizeBytes: 1536, width: 512, height: 512, durationMs: 2000 },
      semanticMetadata: { tags: ["preview"] },
      relationships: [],
      audit: { createdAt, updatedAt: createdAt },
      isAvailable: () => true,
      isGenerated: () => true,
      isDerived: () => false,
      toReferenceString: () => "asset:asset-1",
    };

    const view = presenter.present(asset as never);
    expect(view.statusLabel).toBe("Ready");
    expect(view.sourceLabel).toBe("comfy");
    expect(view.sizeLabel).toBe("1.5 KB");
    expect(view.durationLabel).toBe("2s");
    expect(view.dimensionsLabel).toBe("512 × 512");
  });

  it("ModelPresenter builds compatibility and list views", () => {
    const presenter = new ModelPresenter();
    const model = {
      id: "m1",
      name: "Model A",
      version: "1",
      kind: "text_generation",
      status: "installed",
      artifact: { format: "gguf", sizeBytes: 1024, name: "m", accessMethod: "file", location: "loc" },
      compatibility: { supportedTasks: ["chat"], supportedRuntimes: ["cpu"] },
      tags: ["local"],
      isRunnable: true,
      requiresAuth: false,
      architectureFamily: "llama",
      publisher: "Acme",
      source: { type: "local" },
      additionalArtifacts: [],
      dependencies: [],
      requirements: [],
      languageCodes: [],
      isAvailable: () => true,
      isSupportingAsset: () => false,
      satisfiesRequirements: () => true,
      toReferenceString: () => "model:m1",
    };

    expect(presenter.presentListItem(model as never).subtitle).toContain("GGUF");
    const compatibility = presenter.presentCompatibility({
      severity: "warning",
      isCompatible: false,
      reasons: [{ code: "R1", severity: "error", message: "bad" }],
    } as never);
    expect(compatibility.severity).toBe("Warning");
    expect(compatibility.reasons[0]?.severity).toBe("Error");
  });

  it("ValidationPresenter groups by scope and sorts by configured order", () => {
    const presenter = new ValidationPresenter();
    const summary = presenter.present({
      isValid: false,
      errors: [{ id: "1" }],
      warnings: [],
      info: [],
      messages: [
        { code: "A", severity: "error", scope: "custom", message: "z msg" },
        { code: "B", severity: "error", scope: "workflow", message: "a msg" },
      ],
    } as never);

    expect(summary.groups[0]?.scope).toBe("workflow");
    expect(summary.groups[1]?.scope).toBe("custom");
  });

  it("WorkflowOutputPresenter infers expected output types and previews text outputs", () => {
    const presenter = new WorkflowOutputPresenter();
    const workflow = {
      id: "wf-1",
      metadata: { name: "Workflow" },
      nodes: [
        {
          id: "n1",
          outputPorts: [
            {
              id: "image",
              compatibility: { valueTypes: ["image"] },
            },
          ],
        },
      ],
      connections: [],
    };
    const output = presenter.present(workflow as never, [
      {
        id: "asset-1",
        name: "Transcript",
        kind: "text",
        status: "available",
        source: { type: "generated", provider: "comfyui" },
        location: { accessMethod: "virtual", format: "txt", contentType: "text/plain" },
        semanticMetadata: { description: "Hello from the workflow." },
        relationships: [],
        isAvailable: () => true,
        isGenerated: () => true,
        isDerived: () => false,
        toReferenceString: () => "asset:asset-1",
      },
    ] as never);

    expect(output.expectedOutputTypes).toContain("Image output");
    expect(output.primaryAsset?.viewerType).toBe("text");
    expect(output.primaryAsset?.previewText).toBe("Hello from the workflow.");
  });

  it("NodePresenter sorts properties and ports by order", () => {
    const presenter = new NodePresenter();
    const node = {
      id: "n1",
      title: "",
      notes: "",
      isEnabled: true,
      isCollapsed: false,
      definition: { title: "Node Def", type: "x", category: "cat", executionKind: "sync" },
      position: { x: 1, y: 2 },
      size: { width: 3, height: 4 },
      properties: [
        { id: "p2", name: "B", type: "string", value: "", isEditable: true, isAdvanced: false, order: 2, isEmpty: () => true },
        { id: "p1", name: "A", type: "string", value: "1", isEditable: true, isAdvanced: false, order: 1, isEmpty: () => false },
      ],
      inputPorts: [
        { id: "in2", name: "in2", direction: "in", cardinality: "one", order: 2, isControlPort: false, compatibility: { valueTypes: [], isOptional: false } },
        { id: "in1", name: "in1", direction: "in", cardinality: "one", order: 1, isControlPort: false, compatibility: { valueTypes: [], isOptional: false } },
      ],
      outputPorts: [],
      isExecutable: () => true,
      isModelAware: () => false,
    };

    const view = presenter.presentNode(node as never);
    expect(view.properties[0]?.id).toBe("p1");
    expect(view.inputPorts[0]?.id).toBe("in1");
  });
});
