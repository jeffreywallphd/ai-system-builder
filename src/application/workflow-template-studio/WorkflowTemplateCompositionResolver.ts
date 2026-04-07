import type { AssetContractDescriptor } from "@domain/contracts/AssetContract";
import type { IAsset } from "@domain/assets/interfaces/IAsset";
import type { WorkflowTemplateComposition } from "@domain/workflow-template-studio/WorkflowTemplateCompositionDomain";
import type { WorkflowTemplateDefinition } from "@domain/workflow-template-studio/WorkflowTemplateDomain";
import type { IAssetCatalog } from "../ports/interfaces/IAssetCatalog";

export interface WorkflowTemplateWorkflowContractResolver {
  resolveWorkflowContract(input: {
    readonly workflowAssetId: string;
    readonly workflowAssetVersionId?: string;
  }): Promise<AssetContractDescriptor | undefined>;
}

export interface ResolvedWorkflowTemplateComposition {
  readonly templateId: string;
  readonly versionId: string;
  readonly composition: WorkflowTemplateComposition;
  readonly workflowAssets: ReadonlyArray<IAsset>;
  readonly datasetAssets: ReadonlyArray<IAsset>;
}

function getContractPropertyIds(contract: AssetContractDescriptor | undefined, shape: "input" | "output"): ReadonlySet<string> {
  const schema = shape === "input" ? contract?.input?.schema : contract?.output?.schema;
  const properties = schema && typeof schema === "object" && "properties" in schema
    ? (schema as { readonly properties?: Record<string, unknown> }).properties
    : undefined;
  return new Set(Object.keys(properties ?? {}));
}

export class WorkflowTemplateCompositionResolver {
  constructor(
    private readonly assetCatalog: IAssetCatalog,
    private readonly workflowContractResolver?: WorkflowTemplateWorkflowContractResolver,
  ) {}

  public async resolve(template: WorkflowTemplateDefinition): Promise<ResolvedWorkflowTemplateComposition> {
    if (!template.composition) {
      throw new Error(`Template '${template.templateId}' is missing composition.`);
    }

    const workflowById = new Map<string, IAsset>();
    const workflowContracts = new Map<string, AssetContractDescriptor | undefined>();
    for (const workflowRef of template.composition.workflowInterfaces) {
      const asset = await this.assetCatalog.getById(workflowRef.workflowAssetId);
      if (!asset || asset.kind !== "workflow-definition") {
        throw new Error(`Workflow reference '${workflowRef.workflowAssetId}' does not resolve to a workflow-definition asset.`);
      }
      workflowById.set(workflowRef.workflowAssetId, asset);

      if (this.workflowContractResolver) {
        const contract = await this.workflowContractResolver.resolveWorkflowContract({
          workflowAssetId: workflowRef.workflowAssetId,
          workflowAssetVersionId: workflowRef.workflowAssetVersionId,
        });
        workflowContracts.set(workflowRef.workflowAssetId, contract);
      }
    }

    const datasetById = new Map<string, IAsset>();
    for (const binding of template.composition.outputBindings) {
      if (!binding.targetDatasetAssetId) continue;
      const dataset = await this.assetCatalog.getById(binding.targetDatasetAssetId);
      if (!dataset || dataset.kind !== "dataset") {
        throw new Error(`Output binding '${binding.bindingId}' targets missing or invalid dataset asset '${binding.targetDatasetAssetId}'.`);
      }
      datasetById.set(binding.targetDatasetAssetId, dataset);
    }

    const templateInputIds = new Set(template.inputRequirements.map((entry) => entry.inputId));
    const templateOutputIds = new Set(template.outputExpectations.map((entry) => entry.outputId));
    const templateParameterIds = new Set((template.parameters ?? []).map((entry) => entry.parameterId));
    const interfacesByWorkflow = new Map(template.composition.workflowInterfaces.map((entry) => [entry.workflowAssetId, entry]));

    for (const [workflowAssetId, workflowInterface] of interfacesByWorkflow.entries()) {
      const contract = workflowContracts.get(workflowAssetId);
      if (!contract) {
        continue;
      }

      const contractInputIds = getContractPropertyIds(contract, "input");
      const contractOutputIds = getContractPropertyIds(contract, "output");
      const contractParameterIds = new Set(contract.parameters.map((entry) => entry.id));

      for (const inputId of workflowInterface.inputIds) {
        if (contractInputIds.size > 0 && !contractInputIds.has(inputId)) {
          throw new Error(`Workflow interface '${workflowAssetId}' references input '${inputId}' not present in workflow contract.`);
        }
      }
      for (const outputId of workflowInterface.outputIds) {
        if (contractOutputIds.size > 0 && !contractOutputIds.has(outputId)) {
          throw new Error(`Workflow interface '${workflowAssetId}' references output '${outputId}' not present in workflow contract.`);
        }
      }
      for (const parameterId of workflowInterface.parameterIds) {
        if (!contractParameterIds.has(parameterId)) {
          throw new Error(`Workflow interface '${workflowAssetId}' references parameter '${parameterId}' not present in workflow contract.`);
        }
      }
    }

    for (const binding of template.composition.inputBindings) {
      const workflowInterface = interfacesByWorkflow.get(binding.workflowAssetId);
      if (!workflowInterface) throw new Error(`Input binding '${binding.bindingId}' references unknown workflow asset '${binding.workflowAssetId}'.`);
      if (!templateInputIds.has(binding.templateInputId)) throw new Error(`Input binding '${binding.bindingId}' references unknown template input '${binding.templateInputId}'.`);
      if (!workflowInterface.inputIds.includes(binding.workflowInputId)) {
        throw new Error(`Input binding '${binding.bindingId}' references unknown workflow input '${binding.workflowInputId}'.`);
      }
    }

    for (const binding of template.composition.outputBindings) {
      const workflowInterface = interfacesByWorkflow.get(binding.workflowAssetId);
      if (!workflowInterface) throw new Error(`Output binding '${binding.bindingId}' references unknown workflow asset '${binding.workflowAssetId}'.`);
      if (!templateOutputIds.has(binding.templateOutputId)) throw new Error(`Output binding '${binding.bindingId}' references unknown template output '${binding.templateOutputId}'.`);
      if (!workflowInterface.outputIds.includes(binding.workflowOutputId)) {
        throw new Error(`Output binding '${binding.bindingId}' references unknown workflow output '${binding.workflowOutputId}'.`);
      }
    }

    for (const mapping of template.composition.parameterMappings) {
      const workflowInterface = interfacesByWorkflow.get(mapping.workflowAssetId);
      if (!workflowInterface) throw new Error(`Parameter mapping '${mapping.parameterId}' references unknown workflow asset '${mapping.workflowAssetId}'.`);
      if (!templateParameterIds.has(mapping.parameterId)) throw new Error(`Template parameter '${mapping.parameterId}' is not defined.`);
      if (!workflowInterface.parameterIds.includes(mapping.workflowParameterId)) {
        throw new Error(`Parameter mapping '${mapping.parameterId}' references unknown workflow parameter '${mapping.workflowParameterId}'.`);
      }
    }

    return Object.freeze({
      templateId: template.templateId,
      versionId: template.versionId,
      composition: template.composition,
      workflowAssets: Object.freeze([...workflowById.values()]),
      datasetAssets: Object.freeze([...datasetById.values()]),
    });
  }
}

