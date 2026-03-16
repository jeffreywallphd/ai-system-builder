import { describe, expect, it } from "bun:test";
import { ConnectionValidationService } from "../services/ConnectionValidationService";
import { WorkflowValidator } from "../services/WorkflowValidator";
import { Asset } from "../assets/Asset";
import { AssetLocation, AssetSourceInfo } from "../assets/AssetMetadata";
import { makeConnection, makeNode, makeNodePort, makeWorkflow } from "../services/tests/testUtils";

describe("Domain cross-subfolder interactions", () => {
  it("keeps connection and workflow validation aligned for runtime-incompatible nodes", () => {
    const source = makeNode({
      id: "source",
      outputPorts: [
        makeNodePort({
          id: "out",
          direction: "output",
          valueTypes: ["image"],
          runtimes: ["comfyui"],
        }),
      ],
      runtimes: ["comfyui"],
      executionRuntime: "comfyui",
    });

    const target = makeNode({
      id: "target",
      inputPorts: [
        makeNodePort({
          id: "in",
          direction: "input",
          valueTypes: ["image"],
          runtimes: ["vllm"],
        }),
      ],
      runtimes: ["vllm"],
      executionRuntime: "vllm",
    });

    const connection = makeConnection("source-target", "source", "target");
    const workflow = makeWorkflow({ nodes: [source, target], connections: [connection] });

    const connectionResult = new ConnectionValidationService().validateConnection(connection, {
      workflow,
      graph: workflow.toGraph(),
      runtime: "comfyui",
    });

    const workflowResult = new WorkflowValidator().validateWorkflow(workflow, {
      runtime: "comfyui",
      validateDependencies: true,
      validateModelCompatibility: true,
    });

    expect(connectionResult.isValid).toBeFalse();
    expect(connectionResult.hasCode("runtime-incompatible")).toBeTrue();
    expect(workflowResult.isValid).toBeFalse();
    expect(workflowResult.hasMessage("node-runtime-incompatible")).toBeTrue();
    expect(workflowResult.invalidConnectionIds).toContain("source-target");
  });

  it("preserves model runtime metadata while linking assets to workflow and node references", () => {
    const source = new AssetSourceInfo({
      type: "workflow-output",
      workflowId: "wf-asset",
      nodeId: "node-render",
      runtime: "comfyui",
    });

    const asset = new Asset({
      id: "asset-image",
      name: "Image",
      kind: "image",
      source,
      location: new AssetLocation({
        accessMethod: "local-file",
        location: "outputs/image.png",
        format: "PNG",
      }),
    });

    expect(asset.source.runtime).toBe("comfyui");
    expect(asset.source.belongsToWorkflow("wf-asset")).toBeTrue();
    expect(asset.source.belongsToNode("node-render")).toBeTrue();
    expect(asset.location.hasFormat("png")).toBeTrue();
  });
});
