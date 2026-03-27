import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { Agent } from "../../domain/agents/Agent";
import {
  createAssetContractDescriptor,
  AssetContractShapeKinds,
  type AssetContractDescriptor,
  type AssetContractParameterDescriptor,
} from "../../domain/contracts/AssetContract";
import type { ToolCapabilityDescriptor } from "../tools/models/ToolCapabilityDescriptor";
import type { ContextPackage } from "../context/models/ContextPackage";
import type { ContextRecipe } from "../context/models/ContextRecipe";
import type { CanonicalEntityType } from "../ports/interfaces/ICanonicalAssetIdentityRepository";
import type { IWorkflowRepository } from "../ports/interfaces/IWorkflowRepository";
import type { IAgentRepository } from "../ports/interfaces/IAgentRepository";
import type { IToolCapabilityCatalog } from "../ports/interfaces/IToolCapabilityCatalog";
import type { IContextPackageRepository } from "../ports/interfaces/IContextPackageRepository";
import type { IContextRecipeRepository } from "../ports/interfaces/IContextRecipeRepository";
import type { IInstalledModelCatalog } from "../ports/interfaces/IInstalledModelCatalog";
import type { IRemoteModelCatalog } from "../ports/interfaces/IRemoteModelCatalog";
import type { IExecutionRunRepository } from "../ports/interfaces/IExecutionRunRepository";
import type { IModel } from "../../domain/models/interfaces/IModel";
import type { IExecutionRunRecord } from "../../domain/execution/ExecutionRun";
import {
  TaxonomyBehaviorKinds,
  TaxonomySemanticRoles,
  type CompositionTaxonomyDescriptor,
  type TaxonomyBehaviorKind,
  type TaxonomySemanticRole,
} from "../../domain/taxonomy/CompositionTaxonomy";

export interface IAssetContractResolver {
  resolveCanonicalEntityContract(entityType: CanonicalEntityType, entityId: string): Promise<AssetContractDescriptor | undefined>;
  resolveContractForTaxonomy(descriptor: CompositionTaxonomyDescriptor): AssetContractDescriptor | undefined;
  resolveWorkflowContract(workflow: IWorkflow): AssetContractDescriptor;
  resolveAgentContract(agent: Agent): AssetContractDescriptor;
  resolveToolCapabilityContract(capability: ToolCapabilityDescriptor): AssetContractDescriptor;
  resolveContextPackageContract(contextPackage: ContextPackage): AssetContractDescriptor;
  resolveContextRecipeContract(contextRecipe: ContextRecipe): AssetContractDescriptor;
}

function parameter(id: string, required: boolean, description: string, valueType?: string, defaultValue?: unknown): AssetContractParameterDescriptor {
  return Object.freeze({ id, required, description, valueType, defaultValue });
}


function specializedCompositeDescription(role: Extract<TaxonomySemanticRole, "workflow" | "agent" | "context-bundle">): string {
  if (role === TaxonomySemanticRoles.workflow) {
    return "Specialized composite orchestrator coordinating bounded execution across reusable units.";
  }

  if (role === TaxonomySemanticRoles.agent) {
    return "Specialized composite decision unit balancing planning, tool use, and adaptive execution choices.";
  }

  return "Specialized composite input preparer assembling and shaping reusable context for downstream execution.";
}

function getDefaultInvocationModeForCompositeBehavior(behaviorKind: TaxonomyBehaviorKind): "async" | "deferred" {
  return behaviorKind === TaxonomyBehaviorKinds.iterative ? "async" : "deferred";
}

function defaultTaxonomyContract(descriptor: CompositionTaxonomyDescriptor): AssetContractDescriptor | undefined {
  const { structuralKind, semanticRole, behaviorKind } = descriptor;

  if (semanticRole === TaxonomySemanticRoles.workflow) {
    if (structuralKind !== "composite") {
      return undefined;
    }

    const workflowMode = behaviorKind === TaxonomyBehaviorKinds.iterative
      ? "iterative"
      : behaviorKind === TaxonomyBehaviorKinds.conditional
        ? "conditional"
        : "deterministic";
    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: `${specializedCompositeDescription(TaxonomySemanticRoles.workflow)} Baseline ${workflowMode} workflow orchestration request payload.`,
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Baseline workflow orchestration outcome with step outputs and execution provenance.",
      },
      parameters: [
        parameter("workflowMode", true, "Declared workflow orchestration mode.", "string", workflowMode),
      ],
      execution: {
        invocationMode: getDefaultInvocationModeForCompositeBehavior(behaviorKind),
        sideEffects: "bounded",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.model) {
    if (structuralKind !== "atomic") {
      return undefined;
    }

    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Model invocation/configuration payload for atomic model assets.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Model response envelope with generated outputs and usage metadata.",
      },
      parameters: [
        parameter("modelRuntime", false, "Preferred runtime/provider for model execution.", "string"),
      ],
      execution: {
        invocationMode: "async",
        sideEffects: "bounded",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.tool) {
    if (structuralKind !== "atomic") {
      return undefined;
    }

    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Tool definition payload for atomic tool assets (endpoint/binding and invocation schema metadata).",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Versioned tool descriptor including callable contract and runtime binding metadata.",
      },
      parameters: [
        parameter("providerKind", true, "Tool provider kind (for example mcp/local/api).", "string", "mcp-or-api"),
      ],
      execution: {
        invocationMode: "async",
        sideEffects: "external",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.dataset) {
    if (structuralKind !== "atomic") {
      return undefined;
    }

    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Dataset authoring/update payload for atomic dataset assets.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Versioned dataset descriptor with schema/profile and lineage-ready metadata.",
      },
      parameters: [
        parameter("datasetFormat", false, "Declared canonical dataset format.", "string", "jsonl"),
      ],
      execution: {
        invocationMode: "deferred",
        sideEffects: "none",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.promptTemplate) {
    if (structuralKind !== "atomic") {
      return undefined;
    }

    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Prompt-template authoring/update payload for atomic prompt-template assets.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Versioned prompt-template descriptor with template text and variable metadata.",
      },
      parameters: [
        parameter("templateFormat", false, "Declared prompt template format.", "string", "mustache"),
      ],
      execution: {
        invocationMode: "deferred",
        sideEffects: "none",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.embeddingIndex) {
    if (structuralKind !== "atomic") {
      return undefined;
    }

    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Embedding-index authoring/update payload for atomic embedding-index assets.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Versioned embedding-index descriptor with index strategy and retrieval metadata.",
      },
      parameters: [
        parameter("indexAlgorithm", false, "Declared embedding-index algorithm.", "string", "hnsw"),
        parameter("distanceMetric", false, "Declared vector distance metric.", "string", "cosine"),
      ],
      execution: {
        invocationMode: "deferred",
        sideEffects: "none",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.configProfile) {
    if (structuralKind !== "atomic") {
      return undefined;
    }

    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Config profile patch/update payload for versioned runtime or policy settings.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Resolved configuration object consumable by dependent assets.",
      },
      parameters: [
        parameter("profileScope", true, "Configuration scope targeted by the profile.", "string", "runtime"),
      ],
      execution: {
        invocationMode: "deferred",
        sideEffects: "none",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.datasetPipeline) {
    if (structuralKind !== "composite") {
      return undefined;
    }

    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Dataset pipeline request including source datasets and transformation stage controls.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Dataset pipeline execution outcome with promoted dataset-version references.",
      },
      parameters: [
        parameter("stageCount", false, "Declared dataset pipeline stage count.", "number"),
        parameter("pipelineMode", true, "Declared dataset pipeline behavior mode.", "string", behaviorKind),
      ],
      execution: {
        invocationMode: getDefaultInvocationModeForCompositeBehavior(behaviorKind),
        sideEffects: "bounded",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.trainingRecipe) {
    if (structuralKind !== "composite" || behaviorKind !== TaxonomyBehaviorKinds.deterministic) {
      return undefined;
    }

    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Training recipe request including base model, dataset version, and training configuration.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Training job specification and resulting artifact references.",
      },
      parameters: [
        parameter("executionTarget", false, "Preferred training execution target.", "string"),
      ],
      execution: {
        invocationMode: "async",
        sideEffects: "external",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.toolChain) {
    if (structuralKind !== "composite" || behaviorKind !== TaxonomyBehaviorKinds.deterministic) {
      return undefined;
    }

    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Tool-chain invocation payload with ordered tool-call arguments.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Aggregated tool-chain response envelope with per-step outputs.",
      },
      parameters: [
        parameter("executionOrdering", true, "Tool invocation ordering strategy.", "string", "sequential"),
      ],
      execution: {
        invocationMode: "async",
        sideEffects: "external",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.appTemplate) {
    if (structuralKind !== "system") {
      return undefined;
    }

    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "App-template deployment-unit inputs, including environment and integration bindings.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Versioned deployment manifest and runtime provisioning guidance.",
      },
      parameters: [
        parameter("targetRuntime", true, "Deployment runtime target.", "string", "container"),
      ],
      execution: {
        invocationMode: "deferred",
        sideEffects: "bounded",
      },
    });
  }

  if (semanticRole === TaxonomySemanticRoles.contextBundle) {
    if (structuralKind !== "composite") {
      return undefined;
    }

    if (behaviorKind === TaxonomyBehaviorKinds.none) {
      return createAssetContractDescriptor({
        version: "1.0.0",
        output: {
          kind: AssetContractShapeKinds.text,
          description: `${specializedCompositeDescription(TaxonomySemanticRoles.contextBundle)} Prepared context fragments exposed as prompt-ready text blocks.`,
        },
        parameters: [
          parameter("bundleMode", true, "Context-bundle mode.", "string", "package"),
        ],
        execution: {
          invocationMode: "deferred",
          sideEffects: "none",
        },
      });
    }

    if (behaviorKind === TaxonomyBehaviorKinds.deterministic) {
      return createAssetContractDescriptor({
        version: "1.0.0",
        input: {
          kind: AssetContractShapeKinds.jsonSchema,
          description: "Context-bundle assembly controls and source selection settings.",
        },
        output: {
          kind: AssetContractShapeKinds.text,
          description: `${specializedCompositeDescription(TaxonomySemanticRoles.contextBundle)} Recipe-guided assembly output for downstream consumers.`,
        },
        parameters: [
          parameter("bundleMode", true, "Context-bundle mode.", "string", "recipe"),
        ],
        execution: {
          invocationMode: "deferred",
          sideEffects: "none",
        },
      });
    }

    return undefined;
  }

  return undefined;
}

export class CompositionAssetContractResolver implements IAssetContractResolver {
  constructor(
    private readonly dependencies: {
      readonly workflowRepository?: IWorkflowRepository;
      readonly agentRepository?: IAgentRepository;
      readonly toolCapabilityCatalog?: IToolCapabilityCatalog;
      readonly contextPackageRepository?: IContextPackageRepository;
      readonly contextRecipeRepository?: IContextRecipeRepository;
      readonly installedModelCatalog?: IInstalledModelCatalog;
      readonly remoteModelCatalog?: IRemoteModelCatalog;
      readonly executionRunRepository?: IExecutionRunRepository;
    } = {},
  ) {}

  public async resolveCanonicalEntityContract(entityType: CanonicalEntityType, entityId: string): Promise<AssetContractDescriptor | undefined> {
    const normalizedEntityId = entityId.trim();
    if (!normalizedEntityId) {
      return undefined;
    }

    if (entityType === "workflow-definition" && this.dependencies.workflowRepository) {
      const workflow = await this.dependencies.workflowRepository.load(normalizedEntityId);
      return workflow ? this.resolveWorkflowContract(workflow) : undefined;
    }

    if (entityType === "installed-model" && this.dependencies.installedModelCatalog) {
      const model = await this.dependencies.installedModelCatalog.getInstalledById(normalizedEntityId);
      return model ? this.resolveModelContract(model, "installed-model") : undefined;
    }

    if (entityType === "base-model" && this.dependencies.remoteModelCatalog) {
      const modelItem = await this.dependencies.remoteModelCatalog.getById(normalizedEntityId);
      return modelItem ? this.resolveModelContract(modelItem.model, "base-model") : undefined;
    }

    if (entityType === "execution-artifact" && this.dependencies.executionRunRepository) {
      const run = await this.dependencies.executionRunRepository.getRunById(normalizedEntityId);
      return run ? this.resolveExecutionArtifactContract(run) : undefined;
    }

    return undefined;
  }

  public resolveContractForTaxonomy(descriptor: CompositionTaxonomyDescriptor): AssetContractDescriptor | undefined {
    return defaultTaxonomyContract(descriptor);
  }

  public resolveWorkflowContract(workflow: IWorkflow): AssetContractDescriptor {
    const contextConfiguration = workflow.metadata.contextConfiguration;
    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: `${specializedCompositeDescription(TaxonomySemanticRoles.workflow)} Workflow execution request payload with optional context overrides.`,
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Workflow orchestrator result envelope with node outputs and execution provenance.",
      },
      parameters: [
        parameter("executionPolicy", true, "Workflow graph execution policy.", "string", workflow.executionPolicy),
        parameter("preferredRuntime", false, "Preferred runtime engine for execution.", "string", workflow.runtimeProfile?.preferredRuntime),
        parameter("maxCharacters", false, "Context character budgeting cap.", "number", contextConfiguration?.maxCharacters),
        parameter("maxTokens", false, "Context token budgeting cap.", "number", contextConfiguration?.maxTokens),
      ],
      execution: {
        invocationMode: "async",
        sideEffects: "bounded",
      },
    });
  }

  public resolveAgentContract(agent: Agent): AssetContractDescriptor {
    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: `${specializedCompositeDescription(TaxonomySemanticRoles.agent)} Agent invocation request with objective and runtime context.`,
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Decision-unit execution session outcome, step results, and terminal summary.",
      },
      parameters: [
        parameter("planningStrategy", true, "Planning strategy id and mode.", "string", `${agent.planningStrategy.strategyId}@${agent.planningStrategy.mode}`),
        parameter("maxExecutionUnits", false, "Maximum execution units for a run.", "number", agent.execution.maxExecutionUnits),
        parameter("maxRunDurationMs", false, "Maximum run duration in milliseconds.", "number", agent.execution.maxRunDurationMs),
        parameter("requireTrustedTools", true, "Whether tool invocations require trusted tools.", "boolean", agent.execution.requireTrustedTools),
      ],
      execution: {
        invocationMode: "async",
        sideEffects: "external",
      },
    });
  }

  public resolveToolCapabilityContract(capability: ToolCapabilityDescriptor): AssetContractDescriptor {
    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: `Callable input shape for '${capability.displayName}'.`,
        schema: capability.inputSchema,
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: `Callable output shape for '${capability.displayName}'.`,
        schema: capability.outputSchema,
      },
      parameters: [
        parameter("providerKind", true, "Tool provider kind.", "string", capability.provider.kind),
      ],
      execution: {
        invocationMode: capability.provider.kind === "local" ? "sync" : "async",
        sideEffects: capability.provider.kind === "local" ? "bounded" : "external",
      },
    });
  }

  public resolveContextPackageContract(contextPackage: ContextPackage): AssetContractDescriptor {
    const baseline = defaultTaxonomyContract({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.contextBundle,
      behaviorKind: TaxonomyBehaviorKinds.none,
    })!;

    return createAssetContractDescriptor({
      ...baseline,
      parameters: [
        ...baseline.parameters,
        parameter("fragmentCount", true, "Number of fragments exposed by the package.", "number", contextPackage.fragments.length),
        parameter("version", false, "Context package version.", "string", contextPackage.version),
      ],
    });
  }

  public resolveContextRecipeContract(contextRecipe: ContextRecipe): AssetContractDescriptor {
    const baseline = defaultTaxonomyContract({
      structuralKind: "composite",
      semanticRole: TaxonomySemanticRoles.contextBundle,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    })!;

    return createAssetContractDescriptor({
      ...baseline,
      parameters: [
        ...baseline.parameters,
        parameter("maxCharacters", false, "Default maximum character budget.", "number", contextRecipe.budgetingDefaults?.maxCharacters),
        parameter("maxTokens", false, "Default maximum token budget.", "number", contextRecipe.budgetingDefaults?.maxTokens),
        parameter("toolUseMode", false, "Tool-use guidance mode.", "string", contextRecipe.toolUseGuidance?.mode),
      ],
    });
  }

  public resolveModelContract(model: IModel, sourceKind: "installed-model" | "base-model"): AssetContractDescriptor {
    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: `${sourceKind} invocation payload compatible with model input modalities.`,
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: `Model output payload produced by '${model.name}'.`,
      },
      parameters: [
        parameter("modelKind", true, "Model kind.", "string", model.kind),
        parameter("isRunnable", true, "Whether the model is runnable in current environment.", "boolean", model.isRunnable),
        parameter("status", true, "Model lifecycle status.", "string", model.status),
      ],
      execution: {
        invocationMode: "async",
        sideEffects: model.artifact.accessMethod === "remote-api" ? "external" : "bounded",
      },
    });
  }

  public resolveExecutionArtifactContract(run: IExecutionRunRecord): AssetContractDescriptor {
    return createAssetContractDescriptor({
      version: "1.0.0",
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Execution run artifact summary, per-unit outcomes, and provenance diagnostics.",
      },
      parameters: [
        parameter("status", true, "Execution run lifecycle status.", "string", run.status),
        parameter("unitCount", true, "Number of execution units in this run.", "number", run.unitIds.length),
        parameter("cancellationSupported", true, "Whether cancellation is supported for this run.", "boolean", run.cancellationSupported),
      ],
      execution: {
        invocationMode: "deferred",
        sideEffects: "none",
      },
    });
  }

  public async resolveAgentContractById(agentId: string): Promise<AssetContractDescriptor | undefined> {
    if (!this.dependencies.agentRepository) {
      return undefined;
    }

    const agent = await this.dependencies.agentRepository.get(agentId.trim());
    return agent ? this.resolveAgentContract(agent) : undefined;
  }

  public async resolveToolCapabilityContractById(capabilityId: string): Promise<AssetContractDescriptor | undefined> {
    if (!this.dependencies.toolCapabilityCatalog) {
      return undefined;
    }

    const capabilities = await this.dependencies.toolCapabilityCatalog.listCapabilities();
    const capability = capabilities.find((entry) => entry.id === capabilityId.trim());
    return capability ? this.resolveToolCapabilityContract(capability) : undefined;
  }

  public async resolveContextPackageContractById(contextPackageId: string): Promise<AssetContractDescriptor | undefined> {
    if (!this.dependencies.contextPackageRepository) {
      return undefined;
    }

    const contextPackage = await this.dependencies.contextPackageRepository.load(contextPackageId.trim());
    return contextPackage ? this.resolveContextPackageContract(contextPackage) : undefined;
  }

  public async resolveContextRecipeContractById(contextRecipeId: string): Promise<AssetContractDescriptor | undefined> {
    if (!this.dependencies.contextRecipeRepository) {
      return undefined;
    }

    const contextRecipe = await this.dependencies.contextRecipeRepository.load(contextRecipeId.trim());
    return contextRecipe ? this.resolveContextRecipeContract(contextRecipe) : undefined;
  }
}
