import { describe, expect, it } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import McpLocalServerComposer from "../McpLocalServerComposer";

describe("McpLocalServerComposer", () => {
  it("renders code editor and coding agent authoring controls", () => {
    const html = renderToStaticMarkup(
      React.createElement(McpLocalServerComposer, {
        draft: {
          serverId: "workspace-helper",
          serverName: "Workspace Helper",
          toolName: "summarize_notes",
          toolTitle: "Summarize Notes",
          toolDescription: "Summarize release notes.",
          inputSchema: { type: "object" },
          outputSchema: { type: "object" },
          code: 'return {"summary": payload.get("input", "")}',
        },
        agentPrompt: "summarize release notes",
      })
    );

    expect(html).toContain("AI coding agent");
    expect(html).toContain("Tool logic editor");
    expect(html).toContain("Create local server");
  });
});
