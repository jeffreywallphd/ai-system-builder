import { describe, expect, it } from "bun:test";
import { DynamicContextSource } from "../models/DynamicContextSource";
import { RetrievedContextSource } from "../models/RetrievedContextSource";
import { MemoryContextSource } from "../models/MemoryContextSource";
import { ExampleContextSource } from "../models/ExampleContextSource";
import { CapabilityGuidanceContextSource } from "../models/CapabilityGuidanceContextSource";

describe("dynamic context source models", () => {
  it("normalizes runtime fragments with deterministic source metadata", () => {
    const source = new DynamicContextSource({
      id: " runtime ",
      sourceType: "runtime",
      label: " Runtime Output ",
      precedence: 3,
      visibility: "advanced",
      fragments: [
        {
          id: " frag-1 ",
          kind: "domain-notes",
          content: " Produced by workflow. ",
        },
      ],
    });

    expect(source.id).toBe("runtime");
    expect(source.fragments[0]).toMatchObject({
      id: "frag-1",
      metadata: {
        sourceType: "dynamic",
        dynamicSourceId: "runtime",
        dynamicSourceType: "runtime",
        dynamicSourceLabel: "Runtime Output",
        dynamicSourcePrecedence: 3,
        visibility: "advanced",
      },
    });
  });

  it("maps retrieval documents into retrieved-context fragments", () => {
    const source = new RetrievedContextSource({
      id: "retrieval",
      label: "Retriever",
      documents: [
        { id: "doc-a", text: "Alpha", title: "Doc A", score: 0.91, uri: "memory://doc-a", source: "kb" },
      ],
    });

    expect(source.fragments).toHaveLength(1);
    expect(source.fragments[0]).toMatchObject({
      id: "doc-a",
      kind: "retrieved-context",
      title: "Doc A",
      content: "Alpha",
      metadata: expect.objectContaining({
        score: 0.91,
        uri: "memory://doc-a",
        source: "kb",
        dynamicSourceType: "retrieved",
      }),
    });
  });

  it("maps memory messages into ordered memory snippets", () => {
    const source = new MemoryContextSource({
      id: "memory",
      conversationId: "conv-1",
      sessionId: "session-1",
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    });

    expect(source.fragments.map((fragment) => fragment.content)).toEqual([
      "User: Hello",
      "Assistant: Hi there",
    ]);
    expect(source.fragments[0]?.metadata).toEqual(
      expect.objectContaining({
        role: "user",
        conversationId: "conv-1",
        sessionId: "session-1",
        dynamicSourceType: "memory",
      })
    );
  });

  it("renders examples from input/output pairs", () => {
    const source = new ExampleContextSource({
      id: "few-shot",
      examples: [{ input: "Question", output: "Answer" }],
    });

    expect(source.fragments[0]).toMatchObject({
      kind: "examples",
      title: "Example 1",
      content: "Input:\nQuestion\n\nOutput:\nAnswer",
    });
  });

  it("projects capability guidance into instruction fragments with tool policy metadata", () => {
    const source = new CapabilityGuidanceContextSource({
      id: "cap-guidance",
      guidance: [
        {
          title: "MCP Guardrails",
          content: "Use the search_docs tool when you need workspace facts.",
          providerKind: "mcp",
          serverId: "local",
          toolNames: ["search_docs"],
        },
      ],
    });

    expect(source.fragments[0]).toMatchObject({
      kind: "instructions",
      title: "MCP Guardrails",
      metadata: expect.objectContaining({
        toolInstructions: "Use the search_docs tool when you need workspace facts.",
        toolUsePolicy: expect.objectContaining({
          allowedProviderKinds: ["mcp"],
          mcp: expect.objectContaining({
            allowedServerIds: ["local"],
            allowedToolNames: ["search_docs"],
          }),
        }),
      }),
    });
  });
});
