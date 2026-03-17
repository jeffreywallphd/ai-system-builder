import { describe, expect, it } from "bun:test";
import { isWorkflowViewMode } from "../WorkflowViewMode";

describe("WorkflowViewMode", () => {
  it("supports canvas and form", () => {
    expect(isWorkflowViewMode("canvas")).toBeTrue();
    expect(isWorkflowViewMode("form")).toBeTrue();
  });
});
