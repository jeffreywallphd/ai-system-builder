import { describe, expect, it } from "bun:test";
import { WorkflowExecutionPresenter } from "../WorkflowExecutionPresenter";

describe("WorkflowExecutionPresenter", () => {
  it("builds a UI-friendly status summary from execution state and provenance", () => {
    const presenter = new WorkflowExecutionPresenter();
    const viewModel = presenter.present({
      isExecuting: false,
      outputAssets: [{ id: "asset-1" } as never],
      lastExecutionEvent: {
        executionId: "exec-1",
        kind: "workflow-completed",
        status: "completed",
        message: "Workflow execution completed successfully.",
        provenance: {
          classification: "scaffolded",
          runtime: "langchain",
          strategyId: "infra-scaffold-langchain",
          detail: "Workflow executed by the scaffold interpreter fallback.",
          selectionReason: "Delegated runtime was unavailable.",
          fallback: {
            kind: "scaffold-interpreter",
            isActive: true,
            reason: "Fallback path handled execution.",
          },
          nodeCounts: {
            real: 0,
            delegated: 0,
            hybrid: 0,
            scaffolded: 2,
            unavailable: 0,
          },
        },
      },
    });

    expect(viewModel.statusLabel).toBe("Completed");
    expect(viewModel.statusTone).toBe("success");
    expect(viewModel.executionPathLabel).toBe("Scaffolded");
    expect(viewModel.selectionReason).toContain("Delegated runtime was unavailable");
    expect(viewModel.outputSummary).toBe("1 output asset captured.");
  });
});
