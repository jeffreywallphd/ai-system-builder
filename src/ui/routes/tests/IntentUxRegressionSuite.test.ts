import { describe, expect, it } from "bun:test";
import { IntentUxRegressionSuite } from "../IntentUxRegressionSuite";

describe("IntentUxRegressionSuite", () => {
  it("covers representative Build/Explore/Run and shell-adjacent UX journeys", () => {
    const result = new IntentUxRegressionSuite().run();

    expect(result.passed).toBeTrue();
    expect(result.scenarios).toHaveLength(4);
    expect(result.scenarios.every((scenario) => scenario.passed)).toBeTrue();
  });
});
