import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContextProvenanceTable from "../ContextProvenanceTable";
import { ContextInspectionResult } from "../../../../application/context/models/ContextInspectionResult";
import { ContextAssemblyResult } from "../../../../application/context/models/ContextAssemblyResult";
import { AssembledContext } from "../../../../application/context/models/AssembledContext";
import { ExecutionContextEnvelope } from "../../../../application/context/models/ExecutionContextEnvelope";

describe("ContextProvenanceTable", () => {
  it("keeps trimmed and excluded provenance visible to authors", () => {
    const inspection = new ContextInspectionResult({
      assembly: new ContextAssemblyResult({ assembledContext: new AssembledContext({ fragments: [], sections: [], promptText: "Assembled" }), includedFragments: [], excludedFragments: [] }),
      trimming: { fragments: [], promptText: "Final", decisions: [] },
      budgeting: { fragments: [], promptText: "", totalCharacterCount: 20, includedCharacterCount: 8, totalTokenCount: 4, includedTokenCount: 2, wasTrimmed: true, decisions: [] },
      finalFragments: [],
      assembledPromptText: "Assembled",
      finalPromptText: "Final",
      entries: [
        {
          fragmentId: "policy",
          kind: "instructions",
          assemblyKey: "instructions:policy",
          order: 0,
          precedence: 0,
          status: "trimmed",
          stage: "budget",
          reason: "trimmed-to-fit",
          visibility: "basic",
          matchedSources: ["policy"],
          provenance: [{ sourceType: "package", packageAlias: "Policy", fragmentId: "policy", fragmentTitle: "Policy" }],
          originalContent: "Long policy",
          finalContent: "Long",
          originalCharacterCount: 11,
          finalCharacterCount: 4,
          title: "Policy",
        },
        {
          fragmentId: "persona",
          kind: "persona",
          assemblyKey: "persona:persona",
          order: 1,
          precedence: 0,
          status: "excluded",
          stage: "trimming",
          reason: "excluded-by-visibility",
          visibility: "advanced",
          matchedSources: ["author"],
          provenance: [{ sourceType: "direct", fragmentId: "persona", fragmentTitle: "Persona" }],
          originalContent: "Secret persona",
          finalContent: "",
          originalCharacterCount: 14,
          finalCharacterCount: 0,
          title: "Persona",
        },
      ],
    });

    const html = renderToStaticMarkup(
      React.createElement(ContextProvenanceTable, {
        preview: {
          target: { kind: "workflow", id: "wf-1", label: "Workflow" },
          inspection,
          executionContext: new ExecutionContextEnvelope({ assembledContext: inspection.assembly.assembledContext }),
          selectedRecipeIds: [],
          selectedPackageIds: [],
          recipeLabels: {},
          packageLabels: {},
          deliveryTargets: [],
        },
      })
    );

    expect(html).toContain("trimmed-to-fit");
    expect(html).toContain("excluded-by-visibility");
    expect(html).toContain("Policy");
    expect(html).toContain("Persona");
  });
});
