import { describe, expect, it } from "bun:test";
import { WorkflowBrowserPresenter } from "../WorkflowBrowserPresenter";

function workflow(id: string, name: string, description?: string) {
  return {
    id,
    metadata: { name, description },
    status: "draft",
    isEnabled: true,
    executionPolicy: "acyclic-only",
    nodes: [],
    connections: [],
    toGraph: () => ({ hasCycles: () => false }),
    isExecutable: () => true,
  } as any;
}

describe("WorkflowBrowserPresenter", () => {
  it("filters workflows by name, description, and id", () => {
    const presenter = new WorkflowBrowserPresenter();
    const workflows = [
      workflow("alpha", "Image Pipeline", "Generate image assets"),
      workflow("beta", "Text Pipeline", "Generate summaries"),
    ];

    const byName = presenter.present(workflows, "text");
    const byDescription = presenter.present(workflows, "image assets");
    const byId = presenter.present(workflows, "alpha");

    expect(byName.results[0]?.id).toBe("beta");
    expect(byDescription.results[0]?.id).toBe("alpha");
    expect(byId.results[0]?.id).toBe("alpha");
  });
});
