import {
  AssetValidationLayers,
  AssetValidationSeverities,
  AssetValidationStatuses,
  createAssetValidationResult,
  type AssetValidationIssue,
  type AssetValidationResult,
} from "../../domain/contracts/AssetValidation";
import {
  createWorkflowTemplateDefinition,
  type WorkflowTemplateDefinition,
} from "../../domain/workflow-template-studio/WorkflowTemplateDomain";
import type { AssetContractDescriptor } from "../../domain/contracts/AssetContract";
import type { IAssetCatalog } from "../ports/interfaces/IAssetCatalog";
import type { WorkflowTemplateWorkflowContractResolver } from "./WorkflowTemplateCompositionResolver";
import { ValidatedAssetTypes, type AssetValidator, type ValidatedAssetRef } from "../asset-validation/AssetValidationTypes";

function getContractPropertyType(contract: AssetContractDescriptor | undefined, shape: "input" | "output", id: string): string | undefined {
  const schema = shape === "input" ? contract?.input?.schema : contract?.output?.schema;
  const properties = schema && typeof schema === "object" && "properties" in schema
    ? (schema as { readonly properties?: Record<string, { readonly type?: string }> }).properties
    : undefined;
  return properties?.[id]?.type;
}

function mapTemplateInputToContractType(inputType: WorkflowTemplateDefinition["inputRequirements"][number]["valueType"]): string {
  switch (inputType) {
    case "text": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "json": return "object";
    case "image":
    case "mask":
      return "string";
    default:
      return "string";
  }
}

function mapTemplateOutputToContractType(outputType: WorkflowTemplateDefinition["outputExpectations"][number]["valueType"]): string {
  switch (outputType) {
    case "image": return "string";
    case "images": return "array";
    case "json": return "object";
    default: return "object";
  }
}

export class WorkflowTemplateValidator implements AssetValidator {
  public readonly assetType = ValidatedAssetTypes.template;

  public constructor(
    private readonly assetCatalog: Pick<IAssetCatalog, "getById">,
    private readonly workflowContractResolver?: WorkflowTemplateWorkflowContractResolver,
  ) {}

  public async validate(asset: ValidatedAssetRef): Promise<AssetValidationResult> {
    const errors: AssetValidationIssue[] = [];
    const warnings: AssetValidationIssue[] = [];

    let template: WorkflowTemplateDefinition;
    try {
      template = createWorkflowTemplateDefinition(asset.payload as WorkflowTemplateDefinition);
    } catch (error) {
      errors.push({
        code: "template.invalid-structure",
        message: error instanceof Error ? error.message : "Template payload is invalid.",
        severity: AssetValidationSeverities.error,
        layer: AssetValidationLayers.structural,
        assetId: asset.assetId,
        assetType: this.assetType,
      });
      return createAssetValidationResult({ errors, warnings });
    }

    if (!template.composition) {
      errors.push({
        code: "template.composition.missing",
        message: `Template '${template.templateId}' is missing composition.`,
        severity: AssetValidationSeverities.error,
        layer: AssetValidationLayers.structural,
        assetId: template.templateId,
        assetType: this.assetType,
      });
      return createAssetValidationResult({ errors, warnings });
    }

    const workflowInterfaces = new Map(template.composition.workflowInterfaces.map((entry) => [entry.workflowAssetId, entry] as const));
    const workflowContracts = new Map<string, AssetContractDescriptor | undefined>();

    for (const workflowInterface of template.composition.workflowInterfaces) {
      const workflowAsset = await this.assetCatalog.getById(workflowInterface.workflowAssetId);
      if (!workflowAsset || workflowAsset.kind !== "workflow-definition") {
        errors.push({
          code: "template.workflow-reference.missing",
          message: `Workflow reference '${workflowInterface.workflowAssetId}' could not be resolved.`,
          severity: AssetValidationSeverities.error,
          layer: AssetValidationLayers.referential,
          assetId: template.templateId,
          assetType: this.assetType,
          path: `composition.workflowInterfaces.${workflowInterface.workflowAssetId}`,
        });
        return createAssetValidationResult({ errors, warnings });
      }

      if (workflowInterface.workflowAssetVersionId && workflowAsset.version && workflowAsset.version !== workflowInterface.workflowAssetVersionId) {
        errors.push({
          code: "template.workflow-reference.version-mismatch",
          message: `Workflow '${workflowInterface.workflowAssetId}' resolved version '${workflowAsset.version}' does not match '${workflowInterface.workflowAssetVersionId}'.`,
          severity: AssetValidationSeverities.error,
          layer: AssetValidationLayers.referential,
          assetId: template.templateId,
          assetType: this.assetType,
        });
        return createAssetValidationResult({ errors, warnings });
      }

      if (this.workflowContractResolver) {
        const contract = await this.workflowContractResolver.resolveWorkflowContract({
          workflowAssetId: workflowInterface.workflowAssetId,
          workflowAssetVersionId: workflowInterface.workflowAssetVersionId,
        });
        workflowContracts.set(workflowInterface.workflowAssetId, contract);
        if (!contract) {
          warnings.push({
            code: "template.workflow-contract.unavailable",
            message: `Workflow '${workflowInterface.workflowAssetId}' has no resolvable contract; compatibility checks are partial.`,
            severity: AssetValidationSeverities.warning,
            layer: AssetValidationLayers.compatibility,
            assetId: template.templateId,
            assetType: this.assetType,
          });
        }
      }
    }

    for (const input of template.inputRequirements) {
      if (input.required && !template.composition.inputBindings.some((binding) => binding.templateInputId === input.inputId)) {
        errors.push({
          code: "template.input-binding.missing-required",
          message: `Required template input '${input.inputId}' has no binding.`,
          severity: AssetValidationSeverities.error,
          layer: AssetValidationLayers.structural,
          assetId: template.templateId,
          assetType: this.assetType,
          path: `inputRequirements.${input.inputId}`,
        });
        return createAssetValidationResult({ errors, warnings });
      }
    }

    for (const binding of template.composition.inputBindings) {
      const workflowInterface = workflowInterfaces.get(binding.workflowAssetId);
      const templateInput = template.inputRequirements.find((entry) => entry.inputId === binding.templateInputId);
      if (!workflowInterface || !templateInput || !workflowInterface.inputIds.includes(binding.workflowInputId)) {
        errors.push({
          code: "template.input-binding.invalid",
          message: `Input binding '${binding.bindingId}' is invalid or references missing dependencies.`,
          severity: AssetValidationSeverities.error,
          layer: AssetValidationLayers.referential,
          assetId: template.templateId,
          assetType: this.assetType,
          path: `composition.inputBindings.${binding.bindingId}`,
        });
        return createAssetValidationResult({ errors, warnings });
      }

      const contractType = getContractPropertyType(workflowContracts.get(binding.workflowAssetId), "input", binding.workflowInputId);
      if (contractType) {
        const expectedType = mapTemplateInputToContractType(templateInput.valueType);
        if (contractType !== expectedType) {
          errors.push({
            code: "template.input-binding.type-mismatch",
            message: `Input binding '${binding.bindingId}' type mismatch: template '${templateInput.valueType}' vs workflow '${contractType}'.`,
            severity: AssetValidationSeverities.error,
            layer: AssetValidationLayers.compatibility,
            assetId: template.templateId,
            assetType: this.assetType,
          });
          return createAssetValidationResult({ errors, warnings });
        }
      }
    }

    for (const binding of template.composition.outputBindings) {
      const workflowInterface = workflowInterfaces.get(binding.workflowAssetId);
      const templateOutput = template.outputExpectations.find((entry) => entry.outputId === binding.templateOutputId);
      if (!workflowInterface || !templateOutput || !workflowInterface.outputIds.includes(binding.workflowOutputId)) {
        errors.push({
          code: "template.output-binding.invalid",
          message: `Output binding '${binding.bindingId}' is invalid or references missing dependencies.`,
          severity: AssetValidationSeverities.error,
          layer: AssetValidationLayers.referential,
          assetId: template.templateId,
          assetType: this.assetType,
          path: `composition.outputBindings.${binding.bindingId}`,
        });
        return createAssetValidationResult({ errors, warnings });
      }

      if (binding.targetDatasetAssetId) {
        const datasetAsset = await this.assetCatalog.getById(binding.targetDatasetAssetId);
        if (!datasetAsset || datasetAsset.kind !== "dataset") {
          errors.push({
            code: "template.output-binding.dataset-invalid",
            message: `Output binding '${binding.bindingId}' target dataset '${binding.targetDatasetAssetId}' is invalid.`,
            severity: AssetValidationSeverities.error,
            layer: AssetValidationLayers.referential,
            assetId: template.templateId,
            assetType: this.assetType,
          });
          return createAssetValidationResult({ errors, warnings });
        }
      }

      const contractType = getContractPropertyType(workflowContracts.get(binding.workflowAssetId), "output", binding.workflowOutputId);
      if (contractType) {
        const expectedType = mapTemplateOutputToContractType(templateOutput.valueType);
        if (expectedType !== contractType) {
          errors.push({
            code: "template.output-binding.type-mismatch",
            message: `Output binding '${binding.bindingId}' type mismatch: template '${templateOutput.valueType}' vs workflow '${contractType}'.`,
            severity: AssetValidationSeverities.error,
            layer: AssetValidationLayers.compatibility,
            assetId: template.templateId,
            assetType: this.assetType,
          });
          return createAssetValidationResult({ errors, warnings });
        }
      }
    }

    for (const parameter of template.parameters ?? []) {
      const mapped = template.composition.parameterMappings.filter((entry) => entry.parameterId === parameter.parameterId);
      if (parameter.required && mapped.length === 0) {
        errors.push({
          code: "template.parameter.missing-mapping",
          message: `Required parameter '${parameter.parameterId}' is not mapped to any workflow parameter.`,
          severity: AssetValidationSeverities.error,
          layer: AssetValidationLayers.structural,
          assetId: template.templateId,
          assetType: this.assetType,
        });
        return createAssetValidationResult({ errors, warnings });
      }

      const hasDefault = parameter.defaultValue !== undefined || template.parameterDefaults.some((entry) => entry.parameterId === parameter.parameterId);
      if (parameter.required && !hasDefault) {
        warnings.push({
          code: "template.parameter.required-no-default",
          message: `Required parameter '${parameter.parameterId}' has no default and must be provided at instantiation.`,
          severity: AssetValidationSeverities.warning,
          layer: AssetValidationLayers.compatibility,
          assetId: template.templateId,
          assetType: this.assetType,
        });
      }
    }

    const unresolvedSystemMappings = template.composition.systemContextMappings.filter((mapping) => {
      const workflowInterface = workflowInterfaces.get(mapping.workflowAssetId);
      if (!workflowInterface) return true;
      if (mapping.targetKind === "workflow-input") {
        return !workflowInterface.inputIds.includes(mapping.targetId);
      }
      return false;
    });

    if (unresolvedSystemMappings.length > 0) {
      warnings.push({
        code: "template.composition.system-context-unresolved",
        message: `Template has ${unresolvedSystemMappings.length} unresolved system context mapping(s).`,
        severity: AssetValidationSeverities.warning,
        layer: AssetValidationLayers.compatibility,
        assetId: template.templateId,
        assetType: this.assetType,
      });
    }

    const final = createAssetValidationResult({
      errors,
      warnings,
      metadata: {
        validatedTemplateId: template.templateId,
        validatedVersionId: template.versionId,
        workflowReferenceCount: template.composition.workflowInterfaces.length,
      },
    });

    return final.status === AssetValidationStatuses.invalid
      ? final
      : createAssetValidationResult({
        errors,
        warnings,
        metadata: {
          ...final.metadata,
          readiness: "ready",
        },
      });
  }
}
