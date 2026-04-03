import { describe, expect, it } from "bun:test";
import {
  ComfyImageManipulationBaseGraph,
  ComfyImageManipulationBaseGraphAssetId,
  ComfyImageManipulationBaseGraphVersionId,
  createComfyImageManipulationBaseGraph,
  deserializeComfyImageManipulationBaseGraph,
  serializeComfyImageManipulationBaseGraph,
} from "../ComfyImageManipulationBaseGraph";

describe("ComfyImageManipulationBaseGraph", () => {
  it("defines a parseable img2img base graph with positive and negative conditioning", () => {
    const graph = createComfyImageManipulationBaseGraph(ComfyImageManipulationBaseGraph);

    expect(graph.assetId).toBe(ComfyImageManipulationBaseGraphAssetId);
    expect(graph.versionId).toBe(ComfyImageManipulationBaseGraphVersionId);
    expect(graph.nodes.some((node) => node.classType === "CLIPTextEncode" && node.nodeId === "4")).toBeTrue();
    expect(graph.nodes.some((node) => node.classType === "CLIPTextEncode" && node.nodeId === "5")).toBeTrue();
    expect(graph.nodes.some((node) => node.classType === "KSampler")).toBeTrue();
    expect(graph.outputNodeIds).toEqual(["8"]);
  });

  it("round-trips serialization while preserving FaceID extension anchors", () => {
    const serialized = serializeComfyImageManipulationBaseGraph(ComfyImageManipulationBaseGraph);
    const parsed = deserializeComfyImageManipulationBaseGraph(serialized);

    expect(parsed.extensionAnchors[0]?.anchorId).toBe("faceid-conditioning");
    expect(parsed.extensionAnchors[0]?.injectionPoints.samplerNodeId).toBe("6");
  });

  it("rejects invalid output node references", () => {
    expect(() => createComfyImageManipulationBaseGraph({
      ...ComfyImageManipulationBaseGraph,
      outputNodeIds: ["does-not-exist"],
    })).toThrow();
  });
});
