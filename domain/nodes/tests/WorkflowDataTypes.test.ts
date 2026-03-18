import { describe, expect, it } from "bun:test";
import type {
  ChatMessage,
  Document,
  ToolCall,
  ToolDefinition,
} from "../WorkflowDataTypes";

describe("WorkflowDataTypes", () => {
  it("defines chat messages with constrained roles", () => {
    const message: ChatMessage = {
      role: "assistant",
      content: "Here is the summary.",
    };

    expect(message.role).toBe("assistant");
    expect(message.content).toBeTruthy();
  });

  it("defines workflow documents with text and optional metadata", () => {
    const document: Document = {
      id: "doc-1",
      text: "Important source text.",
      metadata: { source: "knowledge-base" },
    };

    expect(document.id).toBe("doc-1");
    expect(document.text).toContain("source");
    expect(document.metadata).toEqual({ source: "knowledge-base" });
  });

  it("defines tool calls with a name and structured arguments", () => {
    const toolCall: ToolCall = {
      name: "search_knowledge_base",
      arguments: { query: "workflow registry" },
    };

    expect(toolCall.name).toBe("search_knowledge_base");
    expect(toolCall.arguments).toEqual({ query: "workflow registry" });
  });

  it("defines tool definitions with optional input schemas", () => {
    const toolDefinition: ToolDefinition = {
      name: "search_knowledge_base",
      description: "Search the saved knowledge base for matching entries.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
        },
      },
    };

    expect(toolDefinition.name).toBe("search_knowledge_base");
    expect(toolDefinition.description).toContain("knowledge base");
    expect(toolDefinition.inputSchema).toHaveProperty("type", "object");
  });
});
