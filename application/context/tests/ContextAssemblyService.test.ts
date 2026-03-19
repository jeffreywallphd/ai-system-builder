import { describe, expect, it } from "bun:test";
import { ContextAssemblyService } from "../ContextAssemblyService";
import { ContextPackage } from "../models/ContextPackage";

describe("ContextAssemblyService", () => {
  it("orders assembled fragments deterministically across packages and direct fragments", () => {
    const service = new ContextAssemblyService();

    const result = service.assemble({
      packages: [
        {
          order: 20,
          contextPackage: new ContextPackage({
            id: "ctx-kb",
            name: "Knowledge",
            fragments: [
              { id: "kb-b", kind: "retrieved-context", content: "Retrieved B", order: 10 },
              { id: "kb-a", kind: "retrieved-context", content: "Retrieved A", order: 5 },
            ],
          }),
        },
      ],
      fragments: [
        { id: "fmt", kind: "formatting-constraints", content: "Use bullets.", order: 1 },
        { id: "sys", kind: "instructions", content: "Be accurate.", order: 2 },
        { id: "persona", kind: "persona", content: "You are methodical.", order: 1 },
      ],
    });

    expect(result.assembledContext.fragments.map((fragment) => fragment.id)).toEqual([
      "sys",
      "persona",
      "kb-a",
      "kb-b",
      "fmt",
    ]);

    expect(result.assembledContext.sections.map((section) => section.kind)).toEqual([
      "instructions",
      "persona",
      "retrieved-context",
      "formatting-constraints",
    ]);
  });

  it("resolves precedence deterministically when fragments share an assembly key", () => {
    const service = new ContextAssemblyService();

    const result = service.assemble({
      packages: [
        {
          order: 0,
          contextPackage: new ContextPackage({
            id: "ctx-base",
            name: "Base Persona",
            fragments: [
              {
                id: "persona-base",
                kind: "persona",
                content: "You are friendly.",
                order: 1,
                metadata: { assemblyKey: "persona.core", precedence: 1 },
              },
            ],
          }),
        },
      ],
      fragments: [
        {
          id: "persona-override",
          kind: "persona",
          content: "You are exacting and concise.",
          order: 1,
          metadata: { assemblyKey: "persona.core", precedence: 5 },
        },
      ],
    });

    expect(result.assembledContext.fragments.map((fragment) => fragment.id)).toEqual([
      "persona-override",
    ]);
    expect(result.excludedFragments).toContainEqual(
      expect.objectContaining({ id: "persona-base", reason: "shadowed-by-precedence" })
    );
    expect(result.assembledContext.fragments[0]?.provenance).toEqual([
      expect.objectContaining({ sourceType: "direct", fragmentId: "persona-override" }),
      expect.objectContaining({ sourceType: "package", packageId: "ctx-base", fragmentId: "persona-base" }),
    ]);
  });

  it("supports inclusion and exclusion filters without leaking logic into the UI layer", () => {
    const service = new ContextAssemblyService();

    const result = service.assemble({
      packages: [
        {
          contextPackage: new ContextPackage({
            id: "ctx-mixed",
            name: "Mixed",
            fragments: [
              { id: "memory-1", kind: "memory-snippets", content: "User likes short replies.", order: 1 },
              { id: "example-1", kind: "examples", content: "Example response", order: 2 },
            ],
          }),
          includeFragmentIds: ["memory-1"],
        },
      ],
      fragments: [
        { id: "sys", kind: "instructions", content: "Stay factual.", order: 1 },
        { id: "fmt", kind: "formatting-constraints", content: "Return JSON.", order: 2 },
      ],
      excludeKinds: ["formatting-constraints"],
    });

    expect(result.assembledContext.fragments.map((fragment) => fragment.id)).toEqual([
      "sys",
      "memory-1",
    ]);
    expect(result.excludedFragments).toContainEqual(
      expect.objectContaining({ id: "example-1", reason: "excluded-by-package-filter" })
    );
    expect(result.excludedFragments).toContainEqual(
      expect.objectContaining({ id: "fmt", reason: "excluded-by-kind" })
    );
  });

  it("retains package provenance for prompt-builder and agent/tool assembly paths", () => {
    const service = new ContextAssemblyService();

    const result = service.assemble({
      packages: [
        {
          alias: "memory-bank",
          contextPackage: new ContextPackage({
            id: "ctx-memory",
            name: "Memory Bank",
            fragments: [
              { id: "mem-1", kind: "memory-snippets", title: "Preference", content: "Prefers tables.", order: 3 },
            ],
          }),
        },
      ],
      fragments: [{ id: "sys", kind: "instructions", content: "Answer clearly.", order: 1 }],
    });

    expect(result.assembledContext.promptText).toContain("System Instructions:\nAnswer clearly.");
    expect(result.assembledContext.promptText).toContain("Memory & History:\nPrefers tables.");
    expect(result.assembledContext.fragments[1]?.provenance).toEqual([
      expect.objectContaining({
        sourceType: "package",
        packageId: "ctx-memory",
        packageAlias: "memory-bank",
        packageName: "Memory Bank",
        fragmentId: "mem-1",
        fragmentTitle: "Preference",
      }),
    ]);
  });

  it("normalizes dynamic sources alongside packages and direct fragments with preserved provenance", () => {
    const service = new ContextAssemblyService();

    const result = service.assemble({
      packages: [
        {
          order: 30,
          contextPackage: new ContextPackage({
            id: "ctx-style",
            name: "Style",
            fragments: [{ id: "style", kind: "persona", content: "Be calm.", order: 0 }],
          }),
        },
      ],
      fragments: [{ id: "sys", kind: "instructions", content: "Stay accurate.", order: 0 }],
      dynamicSources: [
        {
          sourceType: "retrieved",
          id: "retrieval",
          order: 10,
          documents: [
            { id: "doc-2", text: "Second chunk", score: 0.4 },
            { id: "doc-1", text: "First chunk", score: 0.9 },
          ],
        },
        {
          sourceType: "memory",
          id: "memory",
          order: 20,
          messages: [{ role: "user", content: "Use short answers." }],
        },
      ],
    });

    expect(result.assembledContext.fragments.map((fragment) => fragment.id)).toEqual([
      "sys",
      "style",
      "doc-2",
      "doc-1",
      "memory:message:1",
    ]);
    expect(result.assembledContext.fragments[2]?.provenance).toEqual([
      expect.objectContaining({
        sourceType: "dynamic",
        dynamicSourceId: "retrieval",
        dynamicSourceType: "retrieved",
        fragmentId: "doc-2",
      }),
    ]);
    expect(result.assembledContext.fragments[4]?.metadata).toEqual(
      expect.objectContaining({
        dynamicSourceType: "memory",
        dynamicSourceId: "memory",
      })
    );
  });

  it("keeps deterministic precedence when static and dynamic sources share an assembly key", () => {
    const service = new ContextAssemblyService();

    const result = service.assemble({
      packages: [
        {
          contextPackage: new ContextPackage({
            id: "pkg",
            name: "Pkg",
            fragments: [
              {
                id: "pkg-guidance",
                kind: "instructions",
                content: "Base guidance.",
                order: 0,
                metadata: { assemblyKey: "guidance.core", precedence: 1 },
              },
            ],
          }),
        },
      ],
      dynamicSources: [
        {
          sourceType: "capability-guidance",
          id: "capability",
          precedence: 4,
          guidance: [
            {
              id: "dynamic-guidance",
              content: "Use MCP tools only when allowed.",
              toolUsePolicy: { allowedProviderKinds: ["mcp"] },
              metadata: { assemblyKey: "guidance.core" },
            },
          ],
        },
      ],
      fragments: [
        {
          id: "direct-guidance",
          kind: "instructions",
          content: "Direct guidance wins ties.",
          order: 0,
          metadata: { assemblyKey: "guidance.core", precedence: 4 },
        },
      ],
    });

    expect(result.assembledContext.fragments.map((fragment) => fragment.id)).toEqual(["direct-guidance"]);
    expect(result.excludedFragments).toContainEqual(
      expect.objectContaining({ id: "dynamic-guidance", reason: "shadowed-by-precedence" })
    );
    expect(result.excludedFragments).toContainEqual(
      expect.objectContaining({ id: "pkg-guidance", reason: "shadowed-by-precedence" })
    );
  });

});
