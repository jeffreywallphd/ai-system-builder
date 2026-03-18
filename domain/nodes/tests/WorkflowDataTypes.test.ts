import { describe, expect, it } from "bun:test";
import type { ChatMessage, Document } from "../WorkflowDataTypes";

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
});
