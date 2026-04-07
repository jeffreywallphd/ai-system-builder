import {
  createWorkflowTemplateInstance,
  type WorkflowTemplateInstance,
} from "@domain/workflow-template-studio/WorkflowTemplateInstanceDomain";
import type { WorkflowTemplateDefinition } from "@domain/workflow-template-studio/WorkflowTemplateDomain";
import type { WorkflowTemplateAssetService } from "./WorkflowTemplateAssetService";
import { AssetValidationStatuses } from "@domain/contracts/AssetValidation";

export interface InstantiateWorkflowTemplateCommand {
  readonly templateId: string;
  readonly versionId?: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly parameterOverrides?: Readonly<Record<string, unknown>>;
  readonly systemContext?: Readonly<Record<string, unknown>>;
  readonly createdAt?: Date;
}

function normalizeTemplate(template: WorkflowTemplateDefinition): WorkflowTemplateDefinition {
  return Object.freeze(JSON.parse(JSON.stringify(template)) as WorkflowTemplateDefinition);
}

export class WorkflowTemplateInstantiationService {
  constructor(private readonly templateAssets: WorkflowTemplateAssetService) {}

  public async instantiate(command: InstantiateWorkflowTemplateCommand): Promise<WorkflowTemplateInstance> {
    const readiness = await this.templateAssets.validateTemplateReadiness(command.templateId, command.versionId);
    if (readiness.status === AssetValidationStatuses.invalid) {
      throw new Error(`Workflow template '${command.templateId}' failed readiness validation: ${readiness.errors[0]?.message ?? "unknown error"}.`);
    }

    const integrity = await this.templateAssets.validateTemplateAssetGraph(command.templateId, command.versionId);
    if (integrity.status === AssetValidationStatuses.invalid) {
      const firstFailure = Object.values(integrity.errorsByAsset).find((entry) => entry.length > 0)?.[0];
      throw new Error(`Workflow template '${command.templateId}' failed cross-asset validation: ${firstFailure?.message ?? "unknown error"}.`);
    }

    const template = await this.templateAssets.resolveTemplate(command.templateId, command.versionId);
    if (!template) {
      throw new Error(`Workflow template '${command.templateId}' was not found.`);
    }

    const templateSnapshot = normalizeTemplate(template);
    const resolvedComposition = await this.templateAssets.resolveTemplateComposition(templateSnapshot.templateId, templateSnapshot.versionId);
    if (!resolvedComposition) {
      throw new Error(`Workflow template '${command.templateId}' composition could not be resolved.`);
    }

    const inputMap = { ...(command.inputs ?? {}) };
    for (const requirement of templateSnapshot.inputRequirements) {
      if (requirement.required && inputMap[requirement.inputId] === undefined) {
        throw new Error(`Missing required workflow template input '${requirement.inputId}'.`);
      }
    }

    const parameterOverrides = Object.freeze({ ...(command.parameterOverrides ?? {}) });
    const resolvedParameters = this.templateAssets.applyParameterDefaults({
      template: templateSnapshot,
      overrides: parameterOverrides,
    });

    const datasetById = new Set(resolvedComposition.datasetAssets.map((asset) => asset.id));
    const boundOutputs = templateSnapshot.outputExpectations.map((expectation) => {
      const bindings = resolvedComposition.composition.outputBindings
        .filter((binding) => binding.templateOutputId === expectation.outputId)
        .map((binding) => {
          if (binding.targetDatasetAssetId && !datasetById.has(binding.targetDatasetAssetId)) {
            throw new Error(`Output binding '${binding.bindingId}' dataset target '${binding.targetDatasetAssetId}' is not resolvable.`);
          }
          return Object.freeze({ ...binding });
        });

      return Object.freeze({
        templateOutputId: expectation.outputId,
        valueType: expectation.valueType,
        bindings: Object.freeze(bindings),
      });
    });

    const createdAt = command.createdAt ?? new Date();
    return createWorkflowTemplateInstance({
      instanceId: `${templateSnapshot.templateId}:${templateSnapshot.versionId}:${createdAt.toISOString()}`,
      createdAt: createdAt.toISOString(),
      template: Object.freeze({
        templateId: templateSnapshot.templateId,
        versionId: templateSnapshot.versionId,
      }),
      resolvedWorkflowReferences: Object.freeze(resolvedComposition.composition.workflowInterfaces.map((entry) => Object.freeze({
        workflowAssetId: entry.workflowAssetId,
        workflowAssetVersionId: entry.workflowAssetVersionId,
      }))),
      boundInputs: Object.freeze(templateSnapshot.inputRequirements.map((requirement) => Object.freeze({
        templateInputId: requirement.inputId,
        valueType: requirement.valueType,
        required: requirement.required,
        value: inputMap[requirement.inputId],
      }))),
      boundOutputs: Object.freeze(boundOutputs),
      resolvedParameters: Object.freeze({ ...resolvedParameters }),
      parameterOverrides,
      workflowParameterBindings: Object.freeze(resolvedComposition.composition.parameterMappings.map((mapping) => Object.freeze({
        parameterId: mapping.parameterId,
        workflowAssetId: mapping.workflowAssetId,
        workflowParameterId: mapping.workflowParameterId,
        value: resolvedParameters[mapping.parameterId],
      }))),
      systemContextBindings: Object.freeze(resolvedComposition.composition.systemContextMappings.map((mapping) => Object.freeze({
        mappingId: mapping.mappingId,
        contextKey: mapping.contextKey,
        workflowAssetId: mapping.workflowAssetId,
        targetKind: mapping.targetKind,
        targetId: mapping.targetId,
        value: command.systemContext?.[mapping.contextKey],
      }))),
    });
  }
}

