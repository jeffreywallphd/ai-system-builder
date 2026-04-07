import { describe, expect, it } from "bun:test";
import { CompositionTaxonomyClassifier } from "../CompositionTaxonomyClassifier";
import { Asset } from "@domain/assets/Asset";
import { AssetLocation, AssetSourceInfo } from "@domain/assets/AssetMetadata";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type { Agent } from "@domain/agents/Agent";

describe("CompositionTaxonomyClassifier", () => {
  const classifier = new CompositionTaxonomyClassifier();

  it("maps canonical entity types to shared taxonomy descriptors", () => {
    expect(classifier.classifyCanonicalEntity("workflow-definition")).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "deterministic",
    });
    expect(classifier.classifyCanonicalEntity("installed-model")).toEqual({
      structuralKind: "atomic",
      semanticRole: "model",
      behaviorKind: "none",
    });
    expect(classifier.classifyCanonicalEntity("dataset-version")).toEqual({
      structuralKind: "atomic",
      semanticRole: "dataset",
      behaviorKind: "none",
    });
  });

  it("classifies workflow and agent as composite with role-specific behavior", () => {
    const workflow = { id: "wf-1" } as IWorkflow;
    const agent = { id: "agent-1" } as Agent;

    expect(classifier.classifyWorkflow(workflow, "conditional")).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow",
      behaviorKind: "conditional",
    });
    expect(classifier.classifyAgent(agent)).toEqual({
      structuralKind: "composite",
      semanticRole: "agent",
      behaviorKind: "autonomous",
    });
  });

  it("maps canonical asset ids via stable prefix seam", () => {
    const modelAsset = new Asset({
      id: "installed-model:model-a",
      name: "Model A",
      kind: "model-output",
      source: new AssetSourceInfo({ type: "system" }),
      location: new AssetLocation({ accessMethod: "virtual", location: "model://a" }),
      status: "available",
    });

    const genericAsset = new Asset({
      id: "asset:generic:a",
      name: "Generic",
      kind: "json",
      source: new AssetSourceInfo({ type: "uploaded" }),
      location: new AssetLocation({ accessMethod: "virtual", location: "memory://a" }),
      status: "available",
    });

    expect(classifier.classifyAsset(modelAsset)?.semanticRole).toBe("model");
    expect(classifier.classifyAsset(genericAsset)).toBeUndefined();
  });

  it("maps prompt, workflow-template, and embedding assets to additional semantic roles", () => {
    const promptAsset = new Asset({
      id: "asset:prompt:p1",
      name: "Prompt",
      kind: "prompt",
      source: new AssetSourceInfo({ type: "uploaded" }),
      location: new AssetLocation({ accessMethod: "virtual", location: "memory://prompt" }),
      status: "available",
    });
    const workflowTemplateAsset = new Asset({
      id: "asset:workflow-template:t1",
      name: "Workflow Template",
      kind: "workflow-template",
      source: new AssetSourceInfo({ type: "generated" }),
      location: new AssetLocation({ accessMethod: "virtual", location: "memory://template" }),
      status: "available",
    });
    const embeddingAsset = new Asset({
      id: "asset:embedding:e1",
      name: "Embedding Index",
      kind: "embedding",
      source: new AssetSourceInfo({ type: "generated" }),
      location: new AssetLocation({ accessMethod: "virtual", location: "memory://embeddings" }),
      status: "available",
    });

    expect(classifier.classifyAsset(promptAsset)).toEqual({
      structuralKind: "atomic",
      semanticRole: "prompt-template",
      behaviorKind: "none",
    });
    expect(classifier.classifyAsset(workflowTemplateAsset)).toEqual({
      structuralKind: "composite",
      semanticRole: "workflow-template",
      behaviorKind: "deterministic",
    });
    expect(classifier.classifyAsset(embeddingAsset)).toEqual({
      structuralKind: "atomic",
      semanticRole: "embedding-index",
      behaviorKind: "none",
    });
  });

  it("maps tool capabilities to tool/tool-chain roles", () => {
    expect(classifier.classifyToolCapability({
      id: "mcp:local:search",
      identity: { stableId: "mcp:local:search", providerScopedId: "local:search" },
      routingName: "search",
      displayName: "Search",
      provider: { kind: "mcp", id: "mcp", label: "MCP" },
      source: { kind: "mcp", serverId: "local", toolName: "search" },
      publication: { isPublished: true },
    })).toEqual({
      structuralKind: "atomic",
      semanticRole: "tool",
      behaviorKind: "conditional",
    });
    expect(classifier.classifyToolCapability({
      id: "workflow:docs",
      identity: { stableId: "workflow:docs", providerScopedId: "docs" },
      routingName: "docs",
      displayName: "Docs Workflow",
      provider: { kind: "workflow", id: "workflow", label: "Workflow" },
      source: { kind: "workflow", workflowId: "wf-1" },
      publication: { isPublished: true },
    })).toEqual({
      structuralKind: "composite",
      semanticRole: "tool-chain",
      behaviorKind: "deterministic",
    });
  });

  it("classifies context package/recipe as context-bundle with bounded behavior semantics", () => {
    expect(classifier.classifyContextPackage({ id: "cp-1" } as any)).toEqual({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "none",
    });
    expect(classifier.classifyContextRecipe({ id: "cr-1" } as any)).toEqual({
      structuralKind: "composite",
      semanticRole: "context-bundle",
      behaviorKind: "deterministic",
    });
  });

  it("treats specialized composite roles as first-class composite assets", () => {
    const descriptors = [
      classifier.classifyWorkflow({ id: "wf-special" } as IWorkflow),
      classifier.classifyAgent({ id: "agent-special" } as Agent),
      classifier.classifyContextPackage({ id: "cp-special" } as any),
    ];

    expect(descriptors.map((entry) => entry.structuralKind)).toEqual(["composite", "composite", "composite"]);
    expect(descriptors.map((entry) => entry.semanticRole)).toEqual(["workflow", "agent", "context-bundle"]);
  });


  it("maps execution artifacts to system-level iterative taxonomy", () => {
    expect(classifier.classifyCanonicalEntity("execution-artifact")).toEqual({
      structuralKind: "system",
      semanticRole: "system",
      behaviorKind: "iterative",
    });
  });

  it("classifies first-class system assets without collapsing them into composite roles", () => {
    expect(classifier.classifySystemAsset("system", "autonomous")).toEqual({
      structuralKind: "system",
      semanticRole: "system",
      behaviorKind: "autonomous",
    });
    expect(classifier.classifySystemAsset("app-template", "conditional")).toEqual({
      structuralKind: "system",
      semanticRole: "app-template",
      behaviorKind: "conditional",
    });
  });
});

