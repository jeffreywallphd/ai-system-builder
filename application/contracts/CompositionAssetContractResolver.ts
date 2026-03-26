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

export interface IAssetContractResolver {
  resolveCanonicalEntityContract(entityType: CanonicalEntityType, entityId: string): Promise<AssetContractDescriptor | undefined>;
  resolveWorkflowContract(workflow: IWorkflow): AssetContractDescriptor;
  resolveAgentContract(agent: Agent): AssetContractDescriptor;
  resolveToolCapabilityContract(capability: ToolCapabilityDescriptor): AssetContractDescriptor;
  resolveContextPackageContract(contextPackage: ContextPackage): AssetContractDescriptor;
  resolveContextRecipeContract(contextRecipe: ContextRecipe): AssetContractDescriptor;
}

function parameter(id: string, required: boolean, description: string, valueType?: string, defaultValue?: unknown): AssetContractParameterDescriptor {
  return Object.freeze({ id, required, description, valueType, defaultValue });
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

  public resolveWorkflowContract(workflow: IWorkflow): AssetContractDescriptor {
    const contextConfiguration = workflow.metadata.contextConfiguration;
    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Workflow execution request payload and optional context overrides.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Workflow execution result envelope with node outputs and execution provenance.",
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
        description: "Agent invocation request with objective and optional runtime context.",
      },
      output: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Agent execution session outcome, step results, and terminal summary.",
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
    return createAssetContractDescriptor({
      version: "1.0.0",
      output: {
        kind: AssetContractShapeKinds.text,
        description: "Prepared context fragments assembled into prompt-ready text blocks.",
      },
      parameters: [
        parameter("fragmentCount", true, "Number of fragments exposed by the package.", "number", contextPackage.fragments.length),
        parameter("version", false, "Context package version.", "string", contextPackage.version),
      ],
      execution: {
        invocationMode: "deferred",
        sideEffects: "none",
      },
    });
  }

  public resolveContextRecipeContract(contextRecipe: ContextRecipe): AssetContractDescriptor {
    return createAssetContractDescriptor({
      version: "1.0.0",
      input: {
        kind: AssetContractShapeKinds.jsonSchema,
        description: "Context assembly options and source toggles used when preparing context.",
      },
      output: {
        kind: AssetContractShapeKinds.text,
        description: "Assembled context envelope emitted by recipe-guided preparation.",
      },
      parameters: [
        parameter("maxCharacters", false, "Default maximum character budget.", "number", contextRecipe.budgetingDefaults?.maxCharacters),
        parameter("maxTokens", false, "Default maximum token budget.", "number", contextRecipe.budgetingDefaults?.maxTokens),
        parameter("toolUseMode", false, "Tool-use guidance mode.", "string", contextRecipe.toolUseGuidance?.mode),
      ],
      execution: {
        invocationMode: "deferred",
        sideEffects: "none",
      },
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
