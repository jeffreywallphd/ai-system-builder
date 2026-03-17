import { describe, expect, it } from "bun:test";
import { readSource } from "../../../ui/tests/testUtils";

describe("projection contracts", () => {
  it("defines projection service contracts", () => {
    const source = readSource("application/projection/WorkflowProjectionService.ts");
    expect(source).toContain("projectToForm");
    expect(source).toContain("applyFormInput");
  });
});
