import { describe, expect, it } from "bun:test";
import type { IWorkflow } from "../../../domain/workflows/interfaces/IWorkflow";
import type { Agent } from "../../../domain/agents/Agent";
import { ContextPackage } from "../../context/models/ContextPackage";
import { ContextRecipe } from "../../context/models/ContextRecipe";
import { CompositionTaxonomyClassifier } from "../../taxonomy/CompositionTaxonomyClassifier";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles } from "../../../domain/taxonomy/CompositionTaxonomy";
import { CompositionAssetContractResolver } from "../CompositionAssetContractResolver";

describe("CompositionAssetContractResolver", () => {
  const resolver = new CompositionAssetContractResolver();
  const classifier = new CompositionTaxonomyClassifier();

  it("resolves workflow contracts and keeps taxonomy/contract concerns aligned", () => {
    const workflow = {
      id: "wf-1",
      executionPolicy: "acyclic-only",
      runtimeProfile: { preferredRuntime: "python" },
      metadata: {
        name: "WF",
        contextConfiguration: {
          maxCharacters: 1000,
          maxTokens: 200,
        },
      },
    } as unknown as IWorkflow;

    const taxonomy = classifier.classifyWorkflow(workflow);
    const contract = resolver.resolveWorkflowContract(workflow);

    expect(taxonomy.semanticRole).toBe("workflow");
    expect(contract.input?.kind).toBe("json-schema");
    expect(contract.parameters.find((parameter) => parameter.id === "executionPolicy")?.defaultValue).toBe("acyclic-only");
  });

  it("resolves agent/tool/context contracts through the same shared model", () => {
    const agent = {
      id: "agent-1",
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      execution: { requireTrustedTools: true, maxExecutionUnits: 10, maxRunDurationMs: 5000 },
    } as Agent;

    const toolContract = resolver.resolveToolCapabilityContract({
      id: "mcp:search",
      identity: { stableId: "mcp:search", providerScopedId: "search" },
      routingName: "search",
      displayName: "Search",
      provider: { kind: "mcp", id: "server", label: "Server" },
      source: { kind: "mcp", serverId: "server", toolName: "search" },
      publication: { isPublished: true },
      inputSchema: { type: "object", properties: { query: { type: "string" } } },
      outputSchema: { type: "object", properties: { results: { type: "array" } } },
    });

    const contextPackage = new ContextPackage({
      id: "cp-1",
      name: "Package",
      fragments: [{ id: "f-1", content: "alpha", order: 1, kind: "instructions" }],
      references: [],
    });
    const contextRecipe = new ContextRecipe({
      id: "cr-1",
      name: "Recipe",
      packageReferences: [],
      tags: [],
      budgetingDefaults: { maxCharacters: 700 },
      toolUseGuidance: { mode: "guided" },
    });

    const agentContract = resolver.resolveAgentContract(agent);
    const contextPackageContract = resolver.resolveContextPackageContract(contextPackage);
    const contextRecipeContract = resolver.resolveContextRecipeContract(contextRecipe);

    expect(classifier.classifyAgent(agent).semanticRole).toBe("agent");
    expect(agentContract.parameters.some((parameter) => parameter.id === "planningStrategy")).toBeTrue();
    expect(toolContract.output?.schema).toEqual({ type: "object", properties: { results: { type: "array" } } });
    expect(contextPackageContract.output?.kind).toBe("text");
    expect(contextRecipeContract.parameters.find((parameter) => parameter.id === "toolUseMode")?.defaultValue).toBe("guided");
  });


  it("provides bounded taxonomy-driven contract projections for revised asset roles", () => {
    const modelContract = resolver.resolveContractForTaxonomy({
      structuralKind: "atomic",
      semanticRole: TaxonomySemanticRoles.model,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const configContract = resolver.resolveContractForTaxonomy({
      structuralKind: "atomic",
      semanticRole: TaxonomySemanticRoles.configProfile,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const datasetPipelineContract = resolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.datasetPipeline,
      behaviorKind: TaxonomyBehaviorKinds.iterative,
    });
    const trainingRecipeContract = resolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.trainingRecipe,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });
    const toolChainContract = resolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.toolChain,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });
    const appTemplateContract = resolver.resolveContractForTaxonomy({
      structuralKind: "system",
      semanticRole: TaxonomySemanticRoles.appTemplate,
      behaviorKind: TaxonomyBehaviorKinds.conditional,
    });

    expect(modelContract?.execution?.invocationMode).toBe("async");
    expect(configContract?.parameters.find((parameter) => parameter.id === "profileScope")?.defaultValue).toBe("runtime");
    expect(datasetPipelineContract?.output?.description).toContain("dataset-version");
    expect(trainingRecipeContract?.execution?.sideEffects).toBe("external");
    expect(toolChainContract?.parameters.find((parameter) => parameter.id === "executionOrdering")?.required).toBeTrue();
    expect(appTemplateContract?.parameters.find((parameter) => parameter.id === "targetRuntime")?.defaultValue).toBe("container");
  });

  it("keeps specialized composite semantics explicit for workflow, agent, and context-bundle contracts", () => {
    const workflow = {
      id: "wf-specialized",
      executionPolicy: "acyclic-only",
      metadata: { name: "WF", contextConfiguration: {} },
    } as unknown as IWorkflow;
    const agent = {
      id: "agent-specialized",
      planningStrategy: { strategyId: "deterministic", mode: "deterministic-linear" },
      execution: { requireTrustedTools: true },
    } as Agent;

    const contextPackage = new ContextPackage({
      id: "cp-specialized",
      name: "Package",
      fragments: [{ id: "f-1", content: "alpha", order: 1, kind: "instructions" }],
      references: [],
    });

    const workflowContract = resolver.resolveWorkflowContract(workflow);
    const agentContract = resolver.resolveAgentContract(agent);
    const contextBundleContract = resolver.resolveContextPackageContract(contextPackage);

    expect(workflowContract.input?.description).toContain("orchestrator");
    expect(agentContract.input?.description).toContain("decision unit");
    expect(contextBundleContract.output?.description).toContain("input preparer");
  });


  it("resolves canonical installed-model/base-model/execution-artifact contracts when backing catalogs exist", async () => {
    const model = {
      id: "model-1",
      name: "Model One",
      kind: "chat-model",
      isRunnable: true,
      status: "installed",
      artifact: { accessMethod: "local-file" },
    } as any;

    const resolverWithDependencies = new CompositionAssetContractResolver({
      installedModelCatalog: {
        getInstalledById: async (id: string) => (id === "model-1" ? model : undefined),
      } as any,
      remoteModelCatalog: {
        getById: async (id: string) => (id === "base-1" ? { model } : undefined),
      } as any,
      executionRunRepository: {
        getRunById: async (id: string) => (id === "run-1"
          ? {
            runId: "run-1",
            status: "completed",
            unitIds: ["u1", "u2"],
            cancellationSupported: true,
          }
          : undefined),
      } as any,
    });

    const installedContract = await resolverWithDependencies.resolveCanonicalEntityContract("installed-model", "model-1");
    const baseContract = await resolverWithDependencies.resolveCanonicalEntityContract("base-model", "base-1");
    const executionContract = await resolverWithDependencies.resolveCanonicalEntityContract("execution-artifact", "run-1");

    expect(installedContract?.parameters.find((parameter) => parameter.id === "modelKind")?.defaultValue).toBe("chat-model");
    expect(baseContract?.parameters.find((parameter) => parameter.id === "status")?.defaultValue).toBe("installed");
    expect(executionContract?.parameters.find((parameter) => parameter.id === "unitCount")?.defaultValue).toBe(2);
  });
  it("returns explicit undefined for unsupported canonical entity contract resolution", async () => {
    await expect(resolver.resolveCanonicalEntityContract("installed-model", "model-1")).resolves.toBeUndefined();
  });
});
