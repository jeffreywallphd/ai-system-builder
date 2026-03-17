import { describe, expect, it } from "bun:test";
import { readSource } from "../../../tests/testUtils";

describe("execution ui contracts", () => {
  it("defines WorkflowExecutionStatusPanel component", () => {
    const source = readSource("ui/components/execution/WorkflowExecutionStatusPanel.tsx");
    expect(source).toContain("export default function WorkflowExecutionStatusPanel");
    expect(source).toContain("Workflow Execution");
  });
});
