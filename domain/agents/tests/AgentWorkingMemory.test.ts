import { describe, expect, it } from "bun:test";
import { AssetId } from "../../assets/AssetId";
import { createAgentWorkingMemory, updateAgentWorkingMemory } from "../AgentWorkingMemory";

describe("AgentWorkingMemory", () => {
  it("creates bounded session memory from asset-backed references", () => {
    const memory = createAgentWorkingMemory({
      sessionId: "session-1",
      agentId: "agent-1",
      planId: "plan-1",
      maxEntries: 2,
      retrievedMemory: [
        { assetId: new AssetId("asset:m:1"), memoryType: "semantic" },
        { assetId: new AssetId("asset:m:2"), memoryType: "working" },
        { assetId: new AssetId("asset:m:3"), memoryType: "episodic" },
      ],
      executionOutputs: [
        { stepId: "s1", status: "completed", summary: "ok" },
        { stepId: "s2", status: "failed", summary: "bad" },
        { stepId: "s3", status: "cancelled", summary: "stopped" },
      ],
      planAssetReferences: [new AssetId("asset:seed:1"), new AssetId("asset:seed:2"), new AssetId("asset:seed:3")],
    });

    expect(memory.retrievedMemory).toHaveLength(2);
    expect(memory.executionOutputs).toHaveLength(2);
    expect(memory.planAssetReferences).toHaveLength(2);
  });

  it("supports bounded append updates", () => {
    const initial = createAgentWorkingMemory({
      sessionId: "session-1",
      agentId: "agent-1",
      maxEntries: 2,
      retrievedMemory: [{ assetId: new AssetId("asset:m:1"), memoryType: "semantic" }],
    });

    const updated = updateAgentWorkingMemory(initial, {
      appendRetrievedMemory: [
        { assetId: new AssetId("asset:m:2"), memoryType: "semantic" },
        { assetId: new AssetId("asset:m:3"), memoryType: "semantic" },
      ],
      appendExecutionOutputs: [
        { stepId: "s1", status: "completed" },
        { stepId: "s2", status: "completed" },
      ],
    });

    expect(updated.retrievedMemory).toHaveLength(2);
    expect(updated.executionOutputs).toHaveLength(2);
  });
});
