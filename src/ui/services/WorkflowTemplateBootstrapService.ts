import { serializeWorkflowTemplateDefinition, createWorkflowTemplateAssetMetadata, WorkflowTemplateStudioIdentity } from "@domain/workflow-template-studio/WorkflowTemplateDomain";
import { AssetDraftLifecycleStatuses } from "@domain/studio-shell/StudioShellDomain";
import { CoreImageStarterWorkflowTemplates } from "@application/workflow-template-studio/CoreImageStarterWorkflowTemplates";
import { createWorkflowTemplateContractProjection } from "@application/workflow-template-studio/WorkflowTemplateContractProjection";
import type { RegistryService } from "./RegistryService";
import type { StudioShellService } from "./StudioShellService";

export class WorkflowTemplateBootstrapService {
  public constructor(
    private readonly studioShellService: Pick<StudioShellService, "initializeStudio" | "createDraft" | "transitionLifecycle" | "publishVersion">,
    private readonly registryService: Pick<RegistryService, "filterAssets">,
  ) {}

  public async ensureCoreTemplatesSeeded(): Promise<void> {
    const existing = await this.registryService.filterAssets({ semanticRoles: ["workflow-template"], limit: 200 });
    const existingIds = new Set((existing.ok ? (existing.data ?? []) : []).map((entry) => entry.assetId));
    const missing = CoreImageStarterWorkflowTemplates.filter((entry) => !existingIds.has(entry.templateId));
    if (missing.length === 0) {
      return;
    }

    const initialized = await this.studioShellService.initializeStudio(
      WorkflowTemplateStudioIdentity.defaultStudioId,
      WorkflowTemplateStudioIdentity.defaultStudioName,
    );
    if (!initialized.ok || !initialized.data?.activeSessionId) {
      return;
    }

    for (const template of missing) {
      const created = await this.studioShellService.createDraft({
        studioId: WorkflowTemplateStudioIdentity.defaultStudioId,
        sessionId: initialized.data.activeSessionId,
        assetId: template.templateId,
        content: serializeWorkflowTemplateDefinition(template),
        metadata: createWorkflowTemplateAssetMetadata({
          title: template.name,
          summary: template.summary,
          tags: template.tags,
          behaviorKind: "deterministic",
          contract: createWorkflowTemplateContractProjection(template),
        }),
        dependencies: template.workflowAssets.map((entry) => Object.freeze({
          assetId: entry.assetId,
          versionId: entry.versionId,
        })),
      });

      const draftId = created.data?.draft?.draftId;
      if (!created.ok || !draftId) {
        continue;
      }

      await this.studioShellService.transitionLifecycle({
        studioId: WorkflowTemplateStudioIdentity.defaultStudioId,
        sessionId: initialized.data.activeSessionId,
        draftId,
        targetStatus: AssetDraftLifecycleStatuses.ready,
      });

      await this.studioShellService.publishVersion({
        studioId: WorkflowTemplateStudioIdentity.defaultStudioId,
        sessionId: initialized.data.activeSessionId,
        draftId,
        versionId: template.versionId,
      });
    }
  }
}

