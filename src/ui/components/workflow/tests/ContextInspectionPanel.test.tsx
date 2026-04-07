import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContextInspectionResult } from "@application/context/models/ContextInspectionResult";
import { ContextAssemblyResult } from "@application/context/models/ContextAssemblyResult";
import { AssembledContext } from "@application/context/models/AssembledContext";
import ContextInspectionPanel from "../ContextInspectionPanel";

const inspection = new ContextInspectionResult({
  assembly: new ContextAssemblyResult({
    assembledContext: new AssembledContext({
      fragments: [],
      sections: [
        {
          kind: "instructions",
          title: "System Instructions",
          content: "Alpha",
          fragments: [],
        },
      ],
      promptText: "System Instructions:\nAlpha",
    }),
    includedFragments: [],
    excludedFragments: [],
  }),
  trimming: {
    fragments: [],
    promptText: "Alpha",
    decisions: [],
  },
  budgeting: {
    fragments: [],
    promptText: "Alpha",
    totalCharacterCount: 5,
    includedCharacterCount: 5,
    totalTokenCount: 2,
    includedTokenCount: 2,
    wasTrimmed: false,
    decisions: [],
  },
  finalFragments: [],
  assembledPromptText: "System Instructions:\nAlpha",
  finalPromptText: "Alpha",
  entries: [
    {
      fragmentId: "sys",
      kind: "instructions",
      assemblyKey: "instructions:sys",
      order: 1,
      precedence: 5,
      status: "included",
      stage: "budget",
      reason: "included",
      visibility: "basic",
      matchedSources: ["direct"],
      provenance: [{ sourceType: "direct", fragmentId: "sys", fragmentTitle: "System" }],
      originalContent: "Alpha",
      finalContent: "Alpha",
      originalCharacterCount: 5,
      finalCharacterCount: 5,
      title: "System",
    },
    {
      fragmentId: "mem-1",
      kind: "memory-snippets",
      assemblyKey: "memory-snippets:mem-1",
      order: 2,
      precedence: 1,
      status: "trimmed",
      stage: "budget",
      reason: "trimmed-to-fit",
      visibility: "advanced",
      matchedSources: ["memory-bank", "package"],
      provenance: [{ sourceType: "package", packageAlias: "memory-bank", fragmentId: "mem-1" }],
      originalContent: "Long memory",
      finalContent: "Longâ€¦",
      originalCharacterCount: 11,
      finalCharacterCount: 5,
      title: "Memory",
    },
    {
      fragmentId: "fmt",
      kind: "formatting-constraints",
      assemblyKey: "formatting-constraints:fmt",
      order: 3,
      precedence: 0,
      status: "excluded",
      stage: "trimming",
      reason: "excluded-by-kind",
      visibility: "basic",
      matchedSources: ["direct"],
      provenance: [{ sourceType: "direct", fragmentId: "fmt" }],
      originalContent: "Use bullets",
      finalContent: "",
      originalCharacterCount: 11,
      finalCharacterCount: 0,
      title: "Formatting",
    },
  ],
});

describe("ContextInspectionPanel", () => {
  it("renders provenance visibility, trimming, and final context for authors", () => {
    const html = renderToStaticMarkup(
      React.createElement(ContextInspectionPanel, {
        inspection,
      })
    );

    expect(html).toContain("Context Inspection");
    expect(html).toContain("Author-only trace");
    expect(html).toContain("Trimmed to fit budget");
    expect(html).toContain("memory-bank");
    expect(html).toContain("Alpha");
    expect(html).toContain("Filtered by kind");
  });
});

