import type { AssetDraftDependencyReference, AssetMetadataPatch } from "@domain/studio-shell/StudioShellDomain";
import { serializeSystemSerializationDocument } from "@domain/system-studio/SystemSerializationContract";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles } from "@domain/taxonomy/CompositionTaxonomy";
import { ImageManipulationSystemTemplate } from "./ImageManipulationSystemTemplate";
import { createComfyImageManipulationDefaultConfig } from "./ComfyImageManipulationPropertySchema";
import {
  assertImageManipulationTemplateRunnableDefaults,
  type ImageManipulationTemplateCompletenessValidationResult,
} from "./ImageManipulationSystemCompletenessValidationService";

export interface SystemBuildTemplateDraftSeed {
  readonly assetId: string;
  readonly title: string;
  readonly tags: ReadonlyArray<string>;
  readonly metadataPatch: AssetMetadataPatch;
  readonly dependencies: ReadonlyArray<AssetDraftDependencyReference>;
  readonly contentTemplate: string;
}

export interface SystemBuildTemplateEntry {
  readonly templateId: string;
  readonly card: {
    readonly id: string;
    readonly title: string;
    readonly description: string;
    readonly difficulty: "Beginner" | "Intermediate" | "Advanced";
    readonly actionLabel?: string;
  };
  readonly draftSeed: SystemBuildTemplateDraftSeed;
  readonly completenessValidation: ImageManipulationTemplateCompletenessValidationResult;
}

function deduplicateDependencies(
  entries: ReadonlyArray<AssetDraftDependencyReference>,
): ReadonlyArray<AssetDraftDependencyReference> {
  const seen = new Set<string>();
  const resolved: AssetDraftDependencyReference[] = [];
  for (const entry of entries) {
    const key = `${entry.assetId}:${entry.versionId ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    resolved.push(Object.freeze({ assetId: entry.assetId, versionId: entry.versionId }));
  }
  return Object.freeze(resolved);
}

function buildImageManipulationSystemContentTemplate(): string {
  const defaultConfig = createComfyImageManipulationDefaultConfig();
  const rootEnvelope = {
    systemSpec: {
      semanticRole: TaxonomySemanticRoles.system,
      components: ImageManipulationSystemTemplate.systemAsset.components,
      nestedSystems: ImageManipulationSystemTemplate.systemAsset.nestedSystems ?? [],
      dependencies: [],
      bindings: ImageManipulationSystemTemplate.systemAsset.bindings,
      inputs: ImageManipulationSystemTemplate.systemAsset.inputs,
      outputs: ImageManipulationSystemTemplate.systemAsset.outputs,
      parameters: ImageManipulationSystemTemplate.systemAsset.parameters,
      executionMetadata: ImageManipulationSystemTemplate.systemAsset.executionMetadata,
      settings: {
        systemName: "Image Manipulation System",
        systemDescription: "Edit a source image with natural-language instructions and save generated image outputs.",
        defaultLandingPageId: "page-1",
        navigation: { mode: "top" },
        theme: {},
        runtimeBehavior: {
          confirmBeforeExit: false,
          showHelpTips: true,
          rememberLastPage: true,
        },
      },
      pages: [
        {
          pageId: "page-1",
          title: "Image edit workspace",
          description: "Select a source image, describe changes, and review generated results.",
          layout: {
            layoutKind: "workspace",
            defaultRegionId: "workspace",
            regionIds: ["workspace"],
          },
          navigation: {
            route: "/",
            title: "Image workspace",
            supportsDeepLinking: false,
            requiresRuntimeSession: false,
          },
        },
      ],
      canvasAuthoring: {
        designFrame: {
          mode: "bounded-frame",
          ratio: { width: 16, height: 9 },
          dimensions: { width: 1600, height: 900 },
          boundedArea: { padding: 20 },
        },
        pageLayouts: [{
          pageId: "page-1",
          panels: [{
            panelId: "image-editor-page",
            assetId: "ui-composed:panel",
            panelType: "composed-panel",
            pageId: "page-1",
            regionId: "workspace",
            title: "Image editor",
            description: "Adjust settings, preview results, and browse recent image versions.",
            layoutBounds: { x: 0.02, y: 0.02, width: 0.96, height: 0.96 },
            contentSlots: [{ slotId: "panel-content", label: "Editor content" }],
            content: {
              kind: "embedded-studio",
              studioAssetId: ImageManipulationSystemTemplate.compositionBindings.pageBindingId,
            },
            sourceLayoutNodeId: "image-editor-page",
          }],
        }],
      },
      notes: "This template composes reusable datasets, workflow execution, and a ready-to-run image editor page.",
    },
  };

  return serializeSystemSerializationDocument({
    existingContent: JSON.stringify(rootEnvelope, null, 2),
    dependencies: imageManipulationSeedDependencies,
    systemSpec: {
      components: ImageManipulationSystemTemplate.systemAsset.components,
      nestedSystems: ImageManipulationSystemTemplate.systemAsset.nestedSystems ?? [],
      inputs: ImageManipulationSystemTemplate.systemAsset.inputs,
      outputs: ImageManipulationSystemTemplate.systemAsset.outputs,
      parameters: ImageManipulationSystemTemplate.systemAsset.parameters,
      bindings: ImageManipulationSystemTemplate.systemAsset.bindings,
      executionMetadata: ImageManipulationSystemTemplate.systemAsset.executionMetadata,
    },
    runtimeDatasetInstances: ImageManipulationSystemTemplate.datasetInstances.map((entry) => Object.freeze({
      instanceId: entry.instanceId,
      datasetAssetId: entry.datasetAssetId,
      datasetVersionId: entry.datasetAssetVersionId,
      role: entry.role,
    })),
    runtimeWorkflowBindings: Object.freeze([
      Object.freeze({
        bindingId: ImageManipulationSystemTemplate.primaryWorkflowAsset.bindingId,
        componentAlias: ImageManipulationSystemTemplate.primaryWorkflowAsset.componentAlias,
        workflowAssetId: ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
        workflowVersionId: ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
        pinMode: "version" as const,
      }),
    ]),
    runtimeState: Object.freeze({
      templateId: ImageManipulationSystemTemplate.templateId,
      runtimeBindingId: ImageManipulationSystemTemplate.compositionBindings.runtimeBindingId,
      runtimeInstallationBindingId: ImageManipulationSystemTemplate.compositionBindings.runtimeInstallationBindingId,
      propertySchemaBindingId: ImageManipulationSystemTemplate.compositionBindings.propertySchemaBindingId,
      propertyMappingBindingId: ImageManipulationSystemTemplate.compositionBindings.propertyMappingBindingId,
      inputDatasetWorkflowBindingId: ImageManipulationSystemTemplate.compositionBindings.inputDatasetWorkflowBindingId,
      outputDatasetBindingId: ImageManipulationSystemTemplate.compositionBindings.outputDatasetBindingId,
      inputDatasetBindingId: ImageManipulationSystemTemplate.compositionBindings.inputDatasetBindingId,
      referenceDatasetBindingId: ImageManipulationSystemTemplate.compositionBindings.optionalReferenceDatasetBindingId,
      workflowTemplateBindingId: ImageManipulationSystemTemplate.compositionBindings.workflowTemplateBindingId,
      workflowTemplateAssetId: ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateAssetId,
      workflowTemplateVersionId: ImageManipulationSystemTemplate.primaryWorkflowAsset.workflowTemplateVersionId,
      defaultGenerationSettings: Object.freeze({
        steps: defaultConfig.generation.steps,
        cfg: defaultConfig.generation.cfg,
        denoiseStrength: defaultConfig.generation.denoiseStrength,
        sampler: defaultConfig.generation.sampler,
        scheduler: defaultConfig.generation.scheduler,
        seed: defaultConfig.generation.seed,
        resultCount: defaultConfig.output.resultCount,
      }),
      defaultPrompts: Object.freeze({
        positivePrompt: defaultConfig.prompts.positivePrompt,
        negativePrompt: defaultConfig.prompts.negativePrompt,
      }),
      defaultModelRefs: Object.freeze({
        checkpointModel: defaultConfig.models.checkpointModel,
        vaeModel: defaultConfig.models.vaeModel,
        faceIdModel: defaultConfig.models.faceIdModel,
      }),
      defaultConfig,
    }),
  });
}

const imageManipulationSeedDependencies = deduplicateDependencies([
  ...ImageManipulationSystemTemplate.systemAsset.components.map((component) =>
    Object.freeze({ assetId: component.assetId, versionId: component.versionId })),
]);

const imageManipulationSeedContentTemplate = buildImageManipulationSystemContentTemplate();
const imageManipulationCompletenessValidation = assertImageManipulationTemplateRunnableDefaults({
  template: ImageManipulationSystemTemplate,
  buildTemplateContent: imageManipulationSeedContentTemplate,
});

const imageManipulationSeed: SystemBuildTemplateDraftSeed = Object.freeze({
  assetId: ImageManipulationSystemTemplate.systemAsset.assetId,
  title: "Image Manipulation System",
  tags: Object.freeze(["system", "image", "image-manipulation", "starter-template"]),
  metadataPatch: Object.freeze({
    title: "Image Manipulation System",
    summary: "Edit images with instructions while preserving reusable dataset/workflow composition.",
    tags: Object.freeze(["system", "image", "image-manipulation", "starter-template"]),
    taxonomy: Object.freeze({
      structuralKind: "system",
      semanticRole: TaxonomySemanticRoles.system,
      behaviorKind: TaxonomyBehaviorKinds.deterministic,
    }),
    provenance: Object.freeze({ sourceLabel: "build-template:image-manipulation" }),
  }),
  dependencies: imageManipulationSeedDependencies,
  contentTemplate: imageManipulationSeedContentTemplate,
});

export const SystemBuildTemplateCatalog: ReadonlyArray<SystemBuildTemplateEntry> = Object.freeze([
  Object.freeze({
    templateId: ImageManipulationSystemTemplate.templateId,
    card: Object.freeze({
      id: ImageManipulationSystemTemplate.templateId,
      title: "Image Manipulation System",
      description: "Turn a source image into new versions using natural-language instructions.",
      difficulty: "Intermediate",
      actionLabel: "Open in System Studio",
    }),
    draftSeed: imageManipulationSeed,
    completenessValidation: imageManipulationCompletenessValidation,
  }),
]);

export function resolveSystemBuildTemplate(templateId: string | undefined): SystemBuildTemplateEntry | undefined {
  const normalized = templateId?.trim();
  if (!normalized) {
    return undefined;
  }
  return SystemBuildTemplateCatalog.find((entry) => entry.templateId === normalized);
}

