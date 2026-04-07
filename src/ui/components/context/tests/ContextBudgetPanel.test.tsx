import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ContextBudgetPanel from "../ContextBudgetPanel";
import { ContextInspectionResult } from "../../../../application/context/models/ContextInspectionResult";
import { ContextAssemblyResult } from "../../../../application/context/models/ContextAssemblyResult";
import { AssembledContext } from "../../../../application/context/models/AssembledContext";

describe("ContextBudgetPanel", () => {
  it("renders budgeting summaries and author controls", () => {
    const inspection = new ContextInspectionResult({
      assembly: new ContextAssemblyResult({ assembledContext: new AssembledContext({ fragments: [], sections: [], promptText: "Assembled" }), includedFragments: [], excludedFragments: [] }),
      trimming: { fragments: [], promptText: "Final", decisions: [] },
      budgeting: { fragments: [], promptText: "", totalCharacterCount: 120, includedCharacterCount: 80, totalTokenCount: 30, includedTokenCount: 22, wasTrimmed: true, decisions: [] },
      finalFragments: [],
      assembledPromptText: "Assembled",
      finalPromptText: "Final",
      entries: [],
    });

    const html = renderToStaticMarkup(
      React.createElement(ContextBudgetPanel, {
        inspection,
        visibilityMode: "advanced",
        maxCharacters: 80,
        maxTokens: 22,
        trimPartialFragments: true,
      })
    );

    expect(html).toContain("Budget &amp; Trim Controls");
    expect(html).toContain("Included chars");
    expect(html).toContain("Character budget");
    expect(html).toContain("Allow partial fragment trim");
  });
});
