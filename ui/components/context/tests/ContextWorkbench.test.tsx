import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { makeWorkflow } from "../../../../src/domain/services/tests/testUtils";
import { WorkflowMetadata } from "../../../../src/domain/workflows/WorkflowMetadata";
import { ContextInspectionResult } from "../../../../application/context/models/ContextInspectionResult";
import { ContextAssemblyResult } from "../../../../application/context/models/ContextAssemblyResult";
import { AssembledContext } from "../../../../application/context/models/AssembledContext";
import { ExecutionContextEnvelope } from "../../../../application/context/models/ExecutionContextEnvelope";
import ContextWorkbench from "../ContextWorkbench";
import type { ContextPreviewResult } from "../../../../application/context/models/ContextPreview";

function makePreview(overrides: Partial<ContextPreviewResult> = {}): ContextPreviewResult {
  const inspection = new ContextInspectionResult({
    assembly: new ContextAssemblyResult({
      assembledContext: new AssembledContext({
        fragments: [
          { id: "sys", kind: "instructions", content: "Stay factual.", order: 0, assemblyKey: "instructions:sys", precedence: 0, provenance: [] },
        ],
        sections: [
          { kind: "instructions", title: "System Instructions", content: "Stay factual.", fragments: [
            { id: "sys", kind: "instructions", content: "Stay factual.", order: 0, assemblyKey: "instructions:sys", precedence: 0, provenance: [] },
          ] },
        ],
        promptText: "System Instructions:\nStay factual.",
      }),
      includedFragments: [],
      excludedFragments: [],
    }),
    trimming: { fragments: [], promptText: "Stay factual.", decisions: [] },
    budgeting: {
      fragments: [],
      promptText: "Stay factual.",
      totalCharacterCount: 14,
      includedCharacterCount: 14,
      totalTokenCount: 4,
      includedTokenCount: 4,
      wasTrimmed: false,
      decisions: [],
    },
    finalFragments: [],
    assembledPromptText: "System Instructions:\nStay factual.",
    finalPromptText: "Stay factual.",
    entries: [
      {
        fragmentId: "sys",
        kind: "instructions",
        assemblyKey: "instructions:sys",
        order: 0,
        precedence: 0,
        status: "included",
        stage: "budget",
        reason: "included",
        visibility: "basic",
        matchedSources: ["package"],
        provenance: [{ sourceType: "package", packageAlias: "Policy", fragmentId: "sys", fragmentTitle: "System" }],
        originalContent: "Stay factual.",
        finalContent: "Stay factual.",
        originalCharacterCount: 14,
        finalCharacterCount: 14,
        title: "System",
      },
    ],
  });

  return {
    target: { kind: "workflow", id: "wf-1", label: "Workflow" },
    inspection,
    executionContext: new ExecutionContextEnvelope({
      assembledContext: inspection.assembly.assembledContext,
      inspection: { assembledPromptText: inspection.assembledPromptText, finalPromptText: inspection.finalPromptText, finalFragmentIds: [], entries: inspection.entries },
    }),
    selectedRecipeIds: ["recipe-default"],
    selectedPackageIds: ["pkg-policy"],
    recipeLabels: { "recipe-default": "Default Recipe" },
    packageLabels: { "pkg-policy": "Policy" },
    deliveryTargets: [
      { channel: "prompt", label: "Prompt Context", summary: "Prompt-ready context.", content: "Stay factual." },
    ],
    ...overrides,
  };
}

describe("ContextWorkbench", () => {
  it("renders author-facing workflow, tool, and agent debugging controls", () => {
    const workflow = makeWorkflow({ id: "wf-1" }).withMetadata(
      new WorkflowMetadata({
        name: "Workflow",
        isPublishedAsTool: true,
        contextConfiguration: {
          recipeSelections: [{ recipeId: "recipe-default", alias: "Default Recipe", surfaceInTool: true }],
          packageReferences: [{ packageId: "pkg-policy", alias: "Policy" }],
        },
      })
    );

    const html = renderToStaticMarkup(
      React.createElement(ContextWorkbench, {
        workflow,
        mode: "agent",
        preview: makePreview({
          target: { kind: "agent", id: "wf-1", label: "Workflow agent path", workflowId: "wf-1", workflowLabel: "Workflow" },
          capabilityDecisions: [
            {
              capabilityId: "mcp:local:search_docs",
              displayName: "Search Docs",
              providerKind: "mcp",
              providerLabel: "MCP Tools",
              source: { kind: "mcp", serverId: "local", toolName: "search_docs" },
              status: "allowed",
              reason: "Available to the agent under the current context policy.",
            },
          ],
        }),
        visibilityMode: "advanced",
        maxCharacters: 120,
        maxTokens: 60,
        trimPartialFragments: true,
        selectedRecipeIds: ["recipe-default"],
        selectedPackageIds: ["pkg-policy"],
      })
    );

    expect(html).toContain("Context Workbench");
    expect(html).toContain("Workflow path");
    expect(html).toContain("Tool path");
    expect(html).toContain("Agent path");
    expect(html).toContain("Budget &amp; Trim Controls");
    expect(html).toContain("Search Docs");
    expect(html).toContain("Provenance &amp; Ordering");
  });
});
