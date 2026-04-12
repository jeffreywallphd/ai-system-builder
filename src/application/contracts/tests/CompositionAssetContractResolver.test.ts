import { describe, expect, it } from "bun:test";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type { Agent } from "@domain/agents/Agent";
import { ContextPackage } from "../../context/models/ContextPackage";
import { ContextRecipe } from "../../context/models/ContextRecipe";
import { CompositionTaxonomyClassifier } from "../../taxonomy/CompositionTaxonomyClassifier";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles } from "@domain/taxonomy/CompositionTaxonomy";
import { CompositionAssetContractResolver } from "../CompositionAssetContractResolver";
import {
  createSystemAsset,
  SystemBindingEndpointScopes,
  SystemComponentKinds,
} from "@domain/system-studio/SystemAssetDomain";

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
    const toolContract = resolver.resolveContractForTaxonomy({
      structuralKind: "atomic",
      semanticRole: TaxonomySemanticRoles.tool,
      behaviorKind: TaxonomyBehaviorKinds.conditional,
    });
    const datasetContract = resolver.resolveContractForTaxonomy({
      structuralKind: "atomic",
      semanticRole: TaxonomySemanticRoles.dataset,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const schemaContract = resolver.resolveContractForTaxonomy({
      structuralKind: "atomic",
      semanticRole: TaxonomySemanticRoles.schema,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const configContract = resolver.resolveContractForTaxonomy({
      structuralKind: "atomic",
      semanticRole: TaxonomySemanticRoles.configProfile,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const promptTemplateContract = resolver.resolveContractForTaxonomy({
      structuralKind: "atomic",
      semanticRole: TaxonomySemanticRoles.promptTemplate,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const embeddingIndexContract = resolver.resolveContractForTaxonomy({
      structuralKind: "atomic",
      semanticRole: TaxonomySemanticRoles.embeddingIndex,
      behaviorKind: TaxonomyBehaviorKinds.none,
    });
    const datasetPipelineContract = resolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.datasetPipeline,
      behaviorKind: TaxonomyBehaviorKinds.iterative,
    });
    const workflowContract = resolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.conditional,
    });
    const contextBundleContract = resolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.contextBundle,
      behaviorKind: TaxonomyBehaviorKinds.none,
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
    const systemContract = resolver.resolveContractForTaxonomy({
      structuralKind: "system",
      semanticRole: TaxonomySemanticRoles.system,
      behaviorKind: TaxonomyBehaviorKinds.autonomous,
    });

    expect(modelContract?.execution?.invocationMode).toBe("async");
    expect(toolContract?.parameters.find((parameter) => parameter.id === "providerKind")?.defaultValue).toBe("mcp-or-api");
    expect(datasetContract?.parameters.find((parameter) => parameter.id === "datasetFormat")?.defaultValue).toBe("jsonl");
    expect(schemaContract?.parameters.find((parameter) => parameter.id === "schemaDialect")?.defaultValue).toBe("relational");
    expect(promptTemplateContract?.parameters.find((parameter) => parameter.id === "templateFormat")?.defaultValue).toBe("mustache");
    expect(embeddingIndexContract?.parameters.find((parameter) => parameter.id === "indexAlgorithm")?.defaultValue).toBe("hnsw");
    expect(configContract?.parameters.find((parameter) => parameter.id === "profileScope")?.defaultValue).toBe("runtime");
    expect(workflowContract?.parameters.find((parameter) => parameter.id === "workflowMode")?.defaultValue).toBe("conditional");
    expect(contextBundleContract?.parameters.find((parameter) => parameter.id === "bundleMode")?.defaultValue).toBe("package");
    expect(datasetPipelineContract?.output?.description).toContain("dataset-version");
    expect(datasetPipelineContract?.parameters.find((parameter) => parameter.id === "pipelineMode")?.defaultValue).toBe("iterative");
    expect(trainingRecipeContract?.execution?.sideEffects).toBe("external");
    expect(toolChainContract?.parameters.find((parameter) => parameter.id === "executionOrdering")?.required).toBeTrue();
    expect(appTemplateContract?.parameters.find((parameter) => parameter.id === "targetRuntime")?.defaultValue).toBe("container");
    expect(systemContract?.parameters.find((parameter) => parameter.id === "allowsNestedSystems")?.defaultValue).toBeTrue();
    expect(systemContract?.parameters.find((parameter) => parameter.id === "systemMode")?.defaultValue).toBe("autonomous");
    expect(systemContract?.execution?.invocationMode).toBe("async");
  });

  it("keeps contract projection bounded for unsupported taxonomy combinations", () => {
    const invalidTrainingRecipe = resolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.trainingRecipe,
      behaviorKind: TaxonomyBehaviorKinds.iterative,
    });
    const invalidToolChain = resolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.toolChain,
      behaviorKind: TaxonomyBehaviorKinds.conditional,
    });
    const invalidWorkflowShape = resolver.resolveContractForTaxonomy({
      structuralKind: "atomic",
      semanticRole: TaxonomySemanticRoles.workflow,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    });
    const invalidSystemShape = resolver.resolveContractForTaxonomy({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.system,
      behaviorKind: TaxonomyBehaviorKinds.iterative,
    });

    expect(invalidTrainingRecipe).toBeUndefined();
    expect(invalidToolChain).toBeUndefined();
    expect(invalidWorkflowShape).toBeUndefined();
    expect(invalidSystemShape).toBeUndefined();
  });

  it("projects recursive system contracts from explicit inputs/outputs/parameters/bindings", async () => {
    const childSystem = createSystemAsset({
      assetId: "system:child",
      versionId: "system:child:v1",
      components: [{
        componentKind: SystemComponentKinds.atomic,
        assetId: "asset:model",
        versionId: "asset:model:v1",
        alias: "model",
        taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
      }],
      inputs: [{ inputId: "childPrompt", valueType: "string", required: true }],
      outputs: [{ outputId: "childAnswer", valueType: "string" }],
      parameters: [{ parameterId: "childTemperature", valueType: "number", defaultValue: 0.2 }],
      bindings: [{
        bindingId: "child-bind",
        source: { scope: SystemBindingEndpointScopes.systemInput, endpointId: "childPrompt" },
        target: { scope: SystemBindingEndpointScopes.componentInput, componentAlias: "model", endpointId: "prompt" },
      }],
    });
    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v1",
      components: [
        {
          componentKind: SystemComponentKinds.atomic,
          assetId: "asset:model",
          versionId: "asset:model:v2",
          alias: "root-model",
          taxonomy: { structuralKind: "atomic", semanticRole: "model", behaviorKind: "none" },
        },
        {
          componentKind: SystemComponentKinds.system,
          assetId: "system:child",
          versionId: "system:child:v1",
          alias: "child",
          taxonomy: { structuralKind: "system", semanticRole: "system", behaviorKind: "deterministic" },
        },
      ],
      inputs: [{ inputId: "prompt", valueType: "string", required: true }],
      outputs: [{ outputId: "answer", valueType: "string" }],
      parameters: [{ parameterId: "temperature", valueType: "number", defaultValue: 0.1 }],
      bindings: [{
        bindingId: "root-bind",
        source: { scope: SystemBindingEndpointScopes.systemInput, endpointId: "prompt" },
        target: { scope: SystemBindingEndpointScopes.componentInput, componentAlias: "child", endpointId: "childPrompt" },
      }],
    });

    const contract = await resolver.resolveSystemContract({
      root,
      resolveSystem: async (reference) => (reference.assetId === childSystem.assetId ? childSystem : undefined),
      resolveChildContract: async (component) => component.taxonomy
        ? resolver.resolveContractForTaxonomy(component.taxonomy)
        : undefined,
      maxDepth: 4,
    });

    expect(contract.input?.schema).toEqual({
      type: "object",
      properties: {
        prompt: { type: "string", description: undefined },
      },
      required: ["prompt"],
    });
    expect(contract.parameters.find((entry) => entry.id === "systemParameter:temperature")?.defaultValue).toBe(0.1);
    expect(contract.parameters.find((entry) => entry.id === "nestedSystemCount")?.defaultValue).toBe(1);
    expect(contract.parameters.find((entry) => entry.id === "recursiveTraversalStatus")?.defaultValue).toBe("complete");
  });

  it("keeps recursive system contract projection deterministic and cycle-safe", async () => {
    const root = createSystemAsset({
      assetId: "system:root",
      versionId: "system:root:v1",
      nestedSystems: [{ assetId: "system:child", versionId: "system:child:v1", alias: "child" }],
      inputs: [{ inputId: "prompt", valueType: "string" }],
      outputs: [{ outputId: "answer", valueType: "string" }],
    });
    const child = createSystemAsset({
      assetId: "system:child",
      versionId: "system:child:v1",
      nestedSystems: [{ assetId: "system:root", versionId: "system:root:v1", alias: "root" }],
      inputs: [{ inputId: "childPrompt", valueType: "string" }],
      outputs: [{ outputId: "childAnswer", valueType: "string" }],
    });

    const resolveSystem = async (reference: { assetId: string }) => (
      reference.assetId === "system:child" ? child : reference.assetId === "system:root" ? root : undefined
    );

    const first = await resolver.resolveSystemContract({
      root,
      resolveSystem,
      maxDepth: 4,
    });
    const second = await resolver.resolveSystemContract({
      root,
      resolveSystem,
      maxDepth: 4,
    });

    expect(first).toEqual(second);
    expect(first.parameters.find((entry) => entry.id === "recursiveTraversalStatus")?.defaultValue).toBe("cycle-detected");
    expect(first.parameters.find((entry) => entry.id === "recursiveTraversalCycleSafe")?.defaultValue).toBeFalse();
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

