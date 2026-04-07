import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContextPreviewPanel from "../ContextPreviewPanel";
import { ContextInspectionResult } from "@application/context/models/ContextInspectionResult";
import { ContextAssemblyResult } from "@application/context/models/ContextAssemblyResult";
import { AssembledContext } from "@application/context/models/AssembledContext";
import { ExecutionContextEnvelope } from "@application/context/models/ExecutionContextEnvelope";

const inspection = new ContextInspectionResult({
  assembly: new ContextAssemblyResult({
    assembledContext: new AssembledContext({ fragments: [], sections: [], promptText: "Assembled prompt" }),
    includedFragments: [],
    excludedFragments: [],
  }),
  trimming: { fragments: [], promptText: "Trimmed prompt", decisions: [] },
  budgeting: { fragments: [], promptText: "Final prompt", totalCharacterCount: 10, includedCharacterCount: 8, totalTokenCount: 4, includedTokenCount: 3, wasTrimmed: true, decisions: [] },
  finalFragments: [],
  assembledPromptText: "Assembled prompt",
  finalPromptText: "Final prompt",
  entries: [],
});

describe("ContextPreviewPanel", () => {
  it("renders final execution preview and delivery surfaces", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContextPreviewPanel, {
        preview: {
          target: { kind: "tool", id: "tool-1", label: "Customer Tool", workflowId: "wf-1", workflowLabel: "Workflow" },
          inspection,
          executionContext: new ExecutionContextEnvelope({ assembledContext: inspection.assembly.assembledContext }),
          selectedRecipeIds: ["recipe-default"],
          selectedPackageIds: ["pkg-policy"],
          recipeLabels: { "recipe-default": "Default Recipe" },
          packageLabels: { "pkg-policy": "Policy" },
          deliveryTargets: [
            { channel: "tool-execution", label: "Tool Run Metadata", summary: "Tool path summary.", content: "Final prompt" },
          ],
        },
      })
    );

    expect(html).toContain("Execution Preview");
    expect(html).toContain("Customer Tool");
    expect(html).toContain("Tool Run Metadata");
    expect(html).toContain("Assembled prompt");
    expect(html).toContain("Final prompt");
  });
});

