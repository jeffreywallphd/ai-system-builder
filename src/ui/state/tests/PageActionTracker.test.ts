import { describe, expect, it } from "bun:test";
import { PageActionTracker } from "../PageActionTracker";

describe("PageActionTracker", () => {
  it("tracks page-local actions and exposes undo-ready state", () => {
    const tracker = new PageActionTracker({
      pageId: "workflow-editor",
      capacity: 2,
    });

    tracker.record({
      type: "node-added",
      description: "Added a node.",
      metadata: { nodeId: "n-1" },
    });
    tracker.record({
      type: "node-moved",
      description: "Moved a node.",
      metadata: { nodeId: "n-1" },
    });
    tracker.record({
      type: "node-removed",
      description: "Removed a node.",
      metadata: { nodeId: "n-1" },
    });

    const state = tracker.getState();

    expect(state.entries).toHaveLength(2);
    expect(state.entries[0]?.type).toBe("node-moved");
    expect(state.entries[1]?.pageId).toBe("workflow-editor");
    expect(state.canUndo).toBeTrue();
    expect(state.canRedo).toBeFalse();
  });
});
