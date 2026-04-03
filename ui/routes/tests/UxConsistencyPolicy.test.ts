import { describe, expect, it } from "bun:test";
import { UxConsistencyPolicy, UxConsistencyRecentStateProbe } from "../UxConsistencyPolicy";

describe("UxConsistencyPolicy", () => {
  it("passes representative intent UX consistency audit checks", () => {
    const result = new UxConsistencyPolicy().evaluate();

    expect(result.passed).toBeTrue();
    expect(result.evaluatedRuleCount).toBeGreaterThanOrEqual(5);
    expect(result.issues).toHaveLength(0);
  });

  it("keeps recent/favorites labels aligned to Build intent vocabulary", () => {
    const state = new UxConsistencyRecentStateProbe().recordRepresentativeState();
    const buildFlowRecent = state.recents.find((entry) => entry.id.startsWith("build-flow:create-ai-assistant"));

    expect(buildFlowRecent?.title).toBe("Create an AI assistant");
  });
});

