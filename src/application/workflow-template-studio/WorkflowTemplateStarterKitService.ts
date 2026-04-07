import type { Asset } from "@domain/assets/Asset";
import type { WorkflowTemplateDefinition } from "@domain/workflow-template-studio/WorkflowTemplateDomain";
import { CoreImageStarterWorkflowTemplates } from "./CoreImageStarterWorkflowTemplates";
import type { WorkflowTemplateAssetService } from "./WorkflowTemplateAssetService";

export class WorkflowTemplateStarterKitService {
  public constructor(private readonly templateAssets: Pick<WorkflowTemplateAssetService, "saveTemplate" | "resolveTemplateComposition">) {}

  public async provisionCoreImageStarterTemplates(
    templates: ReadonlyArray<WorkflowTemplateDefinition> = CoreImageStarterWorkflowTemplates,
  ): Promise<ReadonlyArray<Asset>> {
    const saved: Asset[] = [];
    for (const template of templates) {
      const asset = await this.templateAssets.saveTemplate({ definition: template });
      await this.templateAssets.resolveTemplateComposition(template.templateId, template.versionId);
      saved.push(asset);
    }

    return Object.freeze(saved);
  }
}

