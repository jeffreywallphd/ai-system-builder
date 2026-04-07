import path from "node:path";
import { Asset } from "@domain/assets/Asset";
import { AssetAuditInfo, AssetLocation, AssetSemanticMetadata, AssetSourceInfo } from "@domain/assets/AssetMetadata";
import {
  createWorkflowTemplateDefinition,
  deserializeWorkflowTemplateDefinition,
  serializeWorkflowTemplateDefinition,
  type WorkflowTemplateDefinition,
} from "@domain/workflow-template-studio/WorkflowTemplateDomain";
import type { IAssetCatalog } from "../ports/interfaces/IAssetCatalog";
import type { IFileStorage } from "../ports/interfaces/IFileStorage";
import {
  WorkflowTemplateCompositionResolver,
  type ResolvedWorkflowTemplateComposition,
  type WorkflowTemplateWorkflowContractResolver,
} from "./WorkflowTemplateCompositionResolver";
import { applyWorkflowTemplateParameterDefaults } from "./WorkflowTemplateParameterizationService";
import { WorkflowTemplateInstantiationService, type InstantiateWorkflowTemplateCommand } from "./WorkflowTemplateInstantiationService";
import { WorkflowTemplatePreviewService } from "./WorkflowTemplatePreviewService";
import type { WorkflowTemplateInstance } from "@domain/workflow-template-studio/WorkflowTemplateInstanceDomain";
import type { WorkflowTemplatePreview } from "@domain/workflow-template-studio/WorkflowTemplatePreviewDomain";
import { WorkflowTemplateValidator } from "./WorkflowTemplateValidator";
import { AssetValidationOrchestrator, type AggregatedAssetValidationResult } from "../asset-validation/AssetValidationOrchestrator";
import { DatasetAssetValidator } from "../asset-validation/DatasetAssetValidator";
import { WorkflowAssetValidator } from "../asset-validation/WorkflowAssetValidator";
import { ValidatedAssetTypes } from "../asset-validation/AssetValidationTypes";
import type { AssetValidator } from "../asset-validation/AssetValidationTypes";
import type { AssetValidationResult } from "@domain/contracts/AssetValidation";

export interface SaveWorkflowTemplateCommand {
  readonly definition: WorkflowTemplateDefinition;
  readonly destinationPath?: string;
}

function toTemplatePath(assetId: string): string {
  return `${assetId.replace(/[^a-z0-9-:_]/gi, "-")}.template.json`;
}

export class WorkflowTemplateAssetService {
  private readonly templateValidator: WorkflowTemplateValidator;
  private readonly validationOrchestrator: AssetValidationOrchestrator;

  constructor(
    private readonly assetCatalog: IAssetCatalog,
    private readonly fileStorage: IFileStorage,
    private readonly rootDirectory: string,
    private readonly workflowContractResolver?: WorkflowTemplateWorkflowContractResolver,
    validators?: ReadonlyArray<AssetValidator>,
  ) {
    this.templateValidator = new WorkflowTemplateValidator(this.assetCatalog, this.workflowContractResolver);
    this.validationOrchestrator = new AssetValidationOrchestrator(validators ?? [
      this.templateValidator,
      new WorkflowAssetValidator(this.assetCatalog),
      new DatasetAssetValidator(this.assetCatalog),
    ]);
  }

  public async saveTemplate(command: SaveWorkflowTemplateCommand): Promise<Asset> {
    const definition = createWorkflowTemplateDefinition(command.definition);
    const assetId = definition.templateId;
    const destinationPath = command.destinationPath?.trim() || path.join(this.rootDirectory, toTemplatePath(assetId));
    const existing = await this.assetCatalog.getById(assetId);

    await this.fileStorage.write({
      path: destinationPath,
      content: serializeWorkflowTemplateDefinition(definition),
      createDirectories: true,
      overwrite: true,
    });

    const now = new Date();
    const asset = new Asset({
      id: definition.templateId,
      name: definition.name,
      version: definition.versionId,
      kind: "workflow-template",
      status: "available",
      source: new AssetSourceInfo({ type: "generated", provider: "workflow-template-studio" }),
      location: new AssetLocation({ accessMethod: "local-file", location: destinationPath, format: "json", contentType: "application/json" }),
      semanticMetadata: new AssetSemanticMetadata({
        description: definition.summary,
        tags: ["workflow-template", definition.category, definition.supportedIntent, ...definition.tags],
        attributes: {
          category: definition.category,
          supportedIntent: definition.supportedIntent,
          workflowAssetCount: definition.workflowAssets.length,
          inputCount: definition.inputRequirements.length,
          outputCount: definition.outputExpectations.length,
        },
      }),
      relationships: definition.workflowAssets.map((reference) => ({ assetId: reference.assetId, kind: `template-${reference.role}` })),
      audit: new AssetAuditInfo({ createdAt: existing?.audit?.createdAt ?? now, updatedAt: now }),
    });

    await this.assetCatalog.save(asset);
    return asset;
  }

  public async loadTemplate(templateId: string): Promise<WorkflowTemplateDefinition | undefined> {
    const asset = await this.assetCatalog.getById(templateId.trim());
    if (!asset || asset.kind !== "workflow-template" || !asset.location.location) {
      return undefined;
    }

    const serialized = await this.fileStorage.readText(asset.location.location, "utf-8");
    return deserializeWorkflowTemplateDefinition(serialized);
  }

  public async listTemplates(): Promise<ReadonlyArray<WorkflowTemplateDefinition>> {
    const assets = await this.assetCatalog.list({ kinds: ["workflow-template"] });
    const loaded = await Promise.all(assets.map(async (asset) => this.loadTemplate(asset.id)));
    return Object.freeze(loaded.filter((entry): entry is WorkflowTemplateDefinition => !!entry));
  }

  public async resolveTemplate(templateId: string, versionId?: string): Promise<WorkflowTemplateDefinition | undefined> {
    const template = await this.loadTemplate(templateId);
    if (!template) {
      return undefined;
    }

    if (versionId && template.versionId !== versionId.trim()) {
      return undefined;
    }

    return template;
  }

  public async resolveTemplateComposition(templateId: string, versionId?: string): Promise<ResolvedWorkflowTemplateComposition | undefined> {
    const template = await this.resolveTemplate(templateId, versionId);
    if (!template) {
      return undefined;
    }

    return new WorkflowTemplateCompositionResolver(this.assetCatalog, this.workflowContractResolver).resolve(template);
  }



  public async instantiateTemplate(command: InstantiateWorkflowTemplateCommand): Promise<WorkflowTemplateInstance> {
    return new WorkflowTemplateInstantiationService(this).instantiate(command);
  }

  public async previewTemplate(templateId: string, versionId?: string): Promise<WorkflowTemplatePreview | undefined> {
    return new WorkflowTemplatePreviewService(this).buildPreview(templateId, versionId);
  }
  public applyParameterDefaults(input: {
    readonly template: WorkflowTemplateDefinition;
    readonly overrides?: Readonly<Record<string, unknown>>;
  }): Readonly<Record<string, unknown>> {
    return applyWorkflowTemplateParameterDefaults({
      definitions: input.template.parameters ?? [],
      overrides: input.overrides,
    }).values;
  }

  public async validateTemplateReadiness(templateId: string, versionId?: string): Promise<AssetValidationResult> {
    const template = await this.resolveTemplate(templateId, versionId);
    if (!template) {
      throw new Error(`Workflow template '${templateId}' was not found.`);
    }
    return this.templateValidator.validate({
      assetType: ValidatedAssetTypes.template,
      assetId: template.templateId,
      versionId: template.versionId,
      payload: template,
    });
  }

  public async validateTemplateAssetGraph(templateId: string, versionId?: string): Promise<AggregatedAssetValidationResult> {
    const template = await this.resolveTemplate(templateId, versionId);
    if (!template) {
      throw new Error(`Workflow template '${templateId}' was not found.`);
    }
    return this.validationOrchestrator.validate({
      assetType: ValidatedAssetTypes.template,
      assetId: template.templateId,
      versionId: template.versionId,
      payload: template,
    });
  }
}

