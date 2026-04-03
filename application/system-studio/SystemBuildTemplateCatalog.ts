import type { AssetDraftDependencyReference, AssetMetadataPatch } from "../../domain/studio-shell/StudioShellDomain";
import { TaxonomyBehaviorKinds, TaxonomySemanticRoles } from "../../domain/taxonomy/CompositionTaxonomy";
import { ImageManipulationSystemTemplate } from "./ImageManipulationSystemTemplate";

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
  return JSON.stringify(
    {
      systemSpec: {
        semanticRole: TaxonomySemanticRoles.system,
        components: ImageManipulationSystemTemplate.systemAsset.components,
        nestedSystems: ImageManipulationSystemTemplate.systemAsset.nestedSystems ?? [],
        dependencies: [],
        bindings: ImageManipulationSystemTemplate.systemAsset.bindings,
        inputs: ImageManipulationSystemTemplate.systemAsset.inputs,
        outputs: ImageManipulationSystemTemplate.systemAsset.outputs,
        parameters: ImageManipulationSystemTemplate.systemAsset.parameters,
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
          pageLayouts: [{ pageId: "page-1", panels: [] }],
        },
        notes: "This template composes reusable datasets and a workflow template. Runtime execution mapping is added in downstream stories.",
      },
    },
    null,
    2,
  );
}

const imageManipulationSeedDependencies = deduplicateDependencies([
  ...ImageManipulationSystemTemplate.systemAsset.components.map((component) =>
    Object.freeze({ assetId: component.assetId, versionId: component.versionId })),
]);

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
  contentTemplate: buildImageManipulationSystemContentTemplate(),
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
  }),
]);

export function resolveSystemBuildTemplate(templateId: string | undefined): SystemBuildTemplateEntry | undefined {
  const normalized = templateId?.trim();
  if (!normalized) {
    return undefined;
  }
  return SystemBuildTemplateCatalog.find((entry) => entry.templateId === normalized);
}
