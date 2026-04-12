import {
  createWorkflowTemplatePreview,
  type WorkflowTemplatePreview,
} from "@domain/workflow-template-studio/WorkflowTemplatePreviewDomain";
import type { WorkflowTemplateAssetService } from "./WorkflowTemplateAssetService";

export class WorkflowTemplatePreviewService {
  constructor(private readonly templateAssets: WorkflowTemplateAssetService) {}

  public async buildPreview(templateId: string, versionId?: string): Promise<WorkflowTemplatePreview | undefined> {
    const template = await this.templateAssets.resolveTemplate(templateId, versionId);
    if (!template) {
      return undefined;
    }

    const resolved = await this.templateAssets.resolveTemplateComposition(template.templateId, template.versionId);
    if (!resolved) {
      return undefined;
    }

    return createWorkflowTemplatePreview({
      templateId: template.templateId,
      versionId: template.versionId,
      name: template.name,
      description: template.summary,
      category: template.category,
      supportedIntent: template.supportedIntent,
      expectedInputs: Object.freeze(template.inputRequirements.map((entry) => Object.freeze({
        inputId: entry.inputId,
        type: entry.valueType,
        required: entry.required,
        description: entry.description,
      }))),
      outputs: Object.freeze(template.outputExpectations.map((entry) => {
        const outputBinding = resolved.composition.outputBindings.find((binding) => binding.templateOutputId === entry.outputId);
        return Object.freeze({
          outputId: entry.outputId,
          type: entry.valueType,
          description: entry.description,
          targetDatasetAssetId: outputBinding?.targetDatasetAssetId,
          targetDatasetInstanceRef: outputBinding?.targetDatasetInstanceRef,
          targetStorageInstanceRef: outputBinding?.targetStorageInstanceRef,
          targetStorageBindingId: outputBinding?.targetStorageBindingId,
        });
      })),
      parameters: Object.freeze((template.parameters ?? []).map((entry) => Object.freeze({
        parameterId: entry.parameterId,
        name: entry.name,
        type: entry.type,
        required: entry.required,
        defaultValue: entry.defaultValue,
      }))),
      referencedWorkflowAssets: Object.freeze(resolved.composition.workflowInterfaces.map((entry) => Object.freeze({
        workflowAssetId: entry.workflowAssetId,
        workflowAssetVersionId: entry.workflowAssetVersionId,
      }))),
      executionMetadata: template.executionMetadata
        ? Object.freeze({
          runtimeProfile: template.executionMetadata.runtime.runtimeProfile,
          backendId: template.executionMetadata.runtime.backendId,
          requiredCapabilities: template.executionMetadata.runtime.requiredCapabilities,
          requiredDependencies: template.executionMetadata.runtime.requiredDependencies,
          workflowMode: template.executionMetadata.capability.workflowMode,
          supportsFaceId: template.executionMetadata.capability.supportsFaceId,
          supportsBatchExecution: template.executionMetadata.capability.supportsBatchExecution,
        })
        : undefined,
    });
  }
}

