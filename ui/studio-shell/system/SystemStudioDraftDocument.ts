import type { SystemAsset } from "../../../domain/system-studio/SystemAssetDomain";
import {
  normalizeSystemStudioPageModel,
  toSerializableSystemStudioPageModel,
  type SystemStudioPageModel,
} from "./SystemPageModel";
import {
  normalizeSystemSettingsModel,
  toSerializableSystemSettingsModel,
  type SystemSettingsModel,
} from "./SystemSettingsModel";
import type {
  CanvasSurfaceDesignFrameModel,
  CanvasSurfaceDesignFrameRatio,
} from "../experience-assets/ConfigurableCanvasSurfaceContracts";
import type {
  PanelAssetContract,
  PanelAssetContent,
  PanelAssetLayoutBounds,
} from "../experience-assets/PanelAssetContracts";

const defaultDesignFrameRatio: CanvasSurfaceDesignFrameRatio = Object.freeze({
  width: 16,
  height: 9,
});

const defaultPanelBounds: PanelAssetLayoutBounds = Object.freeze({
  x: 0,
  y: 0,
  width: 0.22,
  height: 0.18,
});

export interface SystemStudioCanvasAuthoringConfiguration {
  readonly designFrame: CanvasSurfaceDesignFrameModel;
  readonly pageLayouts: ReadonlyArray<SystemStudioCanvasPageLayout>;
}

export interface SystemStudioCanvasPageLayout {
  readonly pageId: string;
  readonly panels: ReadonlyArray<PanelAssetContract>;
}

export type SystemStudioPageDefinition = SystemStudioPageModel;

export interface SystemStudioDraftDocument {
  readonly systemSpec: {
    readonly components: NonNullable<SystemAsset["components"]>;
    readonly nestedSystems: NonNullable<SystemAsset["nestedSystems"]>;
    readonly dependencies: ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }>;
    readonly bindings: NonNullable<SystemAsset["bindings"]>;
    readonly inputs: NonNullable<SystemAsset["inputs"]>;
    readonly outputs: NonNullable<SystemAsset["outputs"]>;
    readonly parameters: NonNullable<SystemAsset["parameters"]>;
    readonly settings: SystemSettingsModel;
    readonly pages: ReadonlyArray<SystemStudioPageDefinition>;
    readonly embeddedStudios?: {
      readonly dataset?: {
        readonly draftContent?: string;
      };
      readonly workflow?: {
        readonly draftContent?: string;
      };
    };
    readonly sharedDocument?: {
      readonly datasetDraftContent?: string;
      readonly workflowDraftContent?: string;
      readonly synchronization?: {
        readonly pageDefinitions?: "systemSpec.pages";
        readonly panelLayouts?: "systemSpec.canvasAuthoring.pageLayouts";
        readonly datasetDefinitions?: "systemSpec.sharedDocument.datasetDraftContent";
        readonly workflowDefinitions?: "systemSpec.sharedDocument.workflowDraftContent";
        readonly settingsMetadata?: "systemSpec.parameters";
        readonly systemSettings?: "systemSpec.settings";
      };
    };
  };
  readonly canvasAuthoring: SystemStudioCanvasAuthoringConfiguration;
}

const defaultSystemPage: SystemStudioPageDefinition = Object.freeze({
  pageId: "page-1",
  title: "Main page",
  description: "Start here and arrange the sections for this page.",
  layout: Object.freeze({
    layoutKind: "workspace",
    defaultRegionId: "workspace",
    regionIds: Object.freeze(["workspace"]),
  }),
  navigation: Object.freeze({
    route: "/",
    title: "Main page",
    supportsDeepLinking: false,
    requiresRuntimeSession: false,
  }),
});

const emptyDocument: SystemStudioDraftDocument = Object.freeze({
  systemSpec: Object.freeze({
    components: Object.freeze([]),
    nestedSystems: Object.freeze([]),
    dependencies: Object.freeze([]),
    bindings: Object.freeze([]),
    inputs: Object.freeze([]),
    outputs: Object.freeze([]),
    parameters: Object.freeze([]),
    settings: normalizeSystemSettingsModel(undefined, {
      pages: Object.freeze([defaultSystemPage]),
    }),
    pages: Object.freeze([defaultSystemPage]),
    embeddedStudios: Object.freeze({
      dataset: Object.freeze({
        draftContent: "",
      }),
      workflow: Object.freeze({
        draftContent: "",
      }),
    }),
    sharedDocument: Object.freeze({
      datasetDraftContent: "",
      workflowDraftContent: "",
      synchronization: Object.freeze({
        pageDefinitions: "systemSpec.pages",
        panelLayouts: "systemSpec.canvasAuthoring.pageLayouts",
        datasetDefinitions: "systemSpec.sharedDocument.datasetDraftContent",
        workflowDefinitions: "systemSpec.sharedDocument.workflowDraftContent",
        settingsMetadata: "systemSpec.parameters",
        systemSettings: "systemSpec.settings",
      }),
    }),
  }),
  canvasAuthoring: Object.freeze({
    designFrame: Object.freeze({
      mode: "bounded-frame",
      ratio: defaultDesignFrameRatio,
      dimensions: Object.freeze({ width: 1600, height: 900 }),
      boundedArea: Object.freeze({ padding: 20 }),
    }),
    pageLayouts: Object.freeze([
      Object.freeze({
        pageId: defaultSystemPage.pageId,
        panels: Object.freeze([]),
      }),
    ]),
  }),
});

function normalizePageDefinition(entry: Record<string, unknown>, index: number): SystemStudioPageDefinition {
  return normalizeSystemStudioPageModel(entry, index);
}

export function normalizePanelLayoutBounds(input: unknown): PanelAssetLayoutBounds {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return defaultPanelBounds;
  }
  const record = input as Partial<PanelAssetLayoutBounds>;
  const x = Number.isFinite(record.x) ? Number(record.x) : defaultPanelBounds.x;
  const y = Number.isFinite(record.y) ? Number(record.y) : defaultPanelBounds.y;
  const width = Number.isFinite(record.width) ? Number(record.width) : defaultPanelBounds.width;
  const height = Number.isFinite(record.height) ? Number(record.height) : defaultPanelBounds.height;
  const boundedWidth = Math.max(0.05, Math.min(1, width));
  const boundedHeight = Math.max(0.05, Math.min(1, height));
  const boundedX = Math.max(0, Math.min(1, x));
  const boundedY = Math.max(0, Math.min(1, y));
  return Object.freeze({
    x: Math.min(boundedX, 1 - boundedWidth),
    y: Math.min(boundedY, 1 - boundedHeight),
    width: boundedWidth,
    height: boundedHeight,
  });
}

function normalizeCanvasAuthoringConfig(input: unknown): SystemStudioCanvasAuthoringConfiguration {
  const record = (!input || typeof input !== "object" || Array.isArray(input))
    ? {}
    : (input as {
      readonly designFrame?: CanvasSurfaceDesignFrameModel;
      readonly pageLayouts?: ReadonlyArray<{
        readonly pageId?: string;
        readonly panels?: ReadonlyArray<Partial<PanelAssetContract>>;
      }>;
      readonly panels?: ReadonlyArray<Partial<PanelAssetContract>>;
    });

  const ratio = record.designFrame?.ratio;
  const dimensions = record.designFrame?.dimensions;
  const designFrame: CanvasSurfaceDesignFrameModel = Object.freeze({
    mode: "bounded-frame",
    ratio: Object.freeze({
      width: Number.isFinite(ratio?.width) && (ratio?.width ?? 0) > 0 ? ratio!.width : defaultDesignFrameRatio.width,
      height: Number.isFinite(ratio?.height) && (ratio?.height ?? 0) > 0 ? ratio!.height : defaultDesignFrameRatio.height,
    }),
    dimensions: Object.freeze({
      width: Number.isFinite(dimensions?.width) && (dimensions?.width ?? 0) > 0 ? dimensions!.width : 1600,
      height: Number.isFinite(dimensions?.height) && (dimensions?.height ?? 0) > 0 ? dimensions!.height : 900,
    }),
    boundedArea: Object.freeze({
      padding: Number.isFinite(record.designFrame?.boundedArea?.padding)
        ? Math.max(0, Number(record.designFrame?.boundedArea?.padding))
        : 20,
    }),
  });

  const normalizePanels = (panelsInput: ReadonlyArray<Partial<PanelAssetContract>>): ReadonlyArray<PanelAssetContract> => Object.freeze(panelsInput
    .filter((entry): entry is Partial<PanelAssetContract> => Boolean(entry))
    .map((entry, index) => {
      const panelId = entry.panelId?.trim() || `panel-${index + 1}`;
      return Object.freeze({
        panelId,
        pageId: entry.pageId?.trim() || "default",
        regionId: entry.regionId?.trim() || undefined,
        title: entry.title?.trim() || `Panel ${index + 1}`,
        description: entry.description?.trim() || undefined,
        layoutBounds: normalizePanelLayoutBounds(entry.layoutBounds),
        contentSlots: Object.freeze((entry.contentSlots ?? []).map((slot, slotIndex) => Object.freeze({
          slotId: slot.slotId?.trim() || `${panelId}-slot-${slotIndex + 1}`,
          label: slot.label?.trim() || undefined,
        }))),
        content: normalizePanelContent(entry.content),
        sourceLayoutNodeId: entry.sourceLayoutNodeId?.trim() || undefined,
      } satisfies PanelAssetContract);
    }));

  const legacyPanels = normalizePanels(record.panels ?? []);
  const pageLayouts = Object.freeze((record.pageLayouts ?? [])
    .filter((entry): entry is NonNullable<typeof record.pageLayouts>[number] => Boolean(entry))
    .map((entry, layoutIndex) => Object.freeze({
      pageId: entry.pageId?.trim() || `page-${layoutIndex + 1}`,
      panels: normalizePanels(entry.panels ?? []),
    })));

  const resolvedPageLayouts = pageLayouts.length > 0
    ? pageLayouts
    : Object.freeze([
      Object.freeze({
        pageId: defaultSystemPage.pageId,
        panels: legacyPanels.map((panel) => Object.freeze({
          ...panel,
          pageId: defaultSystemPage.pageId,
        })),
      }),
    ]);

  return Object.freeze({
    designFrame,
    pageLayouts: resolvedPageLayouts,
  });
}

function normalizePanelContent(input: unknown): PanelAssetContent | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }
  const record = input as Partial<PanelAssetContent>;
  if (record.kind !== "embedded-studio") {
    return undefined;
  }
  if (!record.studioAssetId?.trim()) {
    return undefined;
  }
  return Object.freeze({
    kind: "embedded-studio",
    studioAssetId: record.studioAssetId.trim(),
    draftContent: typeof record.draftContent === "string" ? record.draftContent : undefined,
    experienceAssetIds: Array.isArray(record.experienceAssetIds)
      ? Object.freeze(record.experienceAssetIds.map((value) => String(value).trim()).filter((value) => value.length > 0))
      : undefined,
    embeddedVariant: typeof record.embeddedVariant === "string" ? record.embeddedVariant.trim() || undefined : undefined,
  });
}

function normalizePageLayouts(input: {
  readonly pages: ReadonlyArray<SystemStudioPageDefinition>;
  readonly canvasAuthoring: SystemStudioCanvasAuthoringConfiguration;
}): ReadonlyArray<SystemStudioCanvasPageLayout> {
  const layoutsByPageId = new Map(
    input.canvasAuthoring.pageLayouts.map((layout) => [layout.pageId, layout] as const),
  );
  return Object.freeze(input.pages.map((page) => {
    const existing = layoutsByPageId.get(page.pageId);
    return Object.freeze({
      pageId: page.pageId,
      panels: existing?.panels ?? Object.freeze([]),
    });
  }));
}

export function parseSystemStudioDraftDocument(content: string): SystemStudioDraftDocument {
  if (!content.trim()) {
    return emptyDocument;
  }

  try {
    const parsed = JSON.parse(content) as {
      readonly systemSpec?: Partial<SystemStudioDraftDocument["systemSpec"]> & {
        readonly canvasAuthoring?: unknown;
      };
    };
    const pages = Object.freeze((parsed.systemSpec?.pages ?? [defaultSystemPage]).map((entry, index) => normalizePageDefinition(
      (entry ?? {}) as Record<string, unknown>,
      index,
    )));
    const canvasAuthoring = normalizeCanvasAuthoringConfig(parsed.systemSpec?.canvasAuthoring);
    const sharedDatasetDraftContent = typeof parsed.systemSpec?.sharedDocument?.datasetDraftContent === "string"
      ? parsed.systemSpec.sharedDocument.datasetDraftContent
      : typeof parsed.systemSpec?.embeddedStudios?.dataset?.draftContent === "string"
        ? parsed.systemSpec.embeddedStudios.dataset.draftContent
        : "";
    const sharedWorkflowDraftContent = typeof parsed.systemSpec?.sharedDocument?.workflowDraftContent === "string"
      ? parsed.systemSpec.sharedDocument.workflowDraftContent
      : typeof parsed.systemSpec?.embeddedStudios?.workflow?.draftContent === "string"
        ? parsed.systemSpec.embeddedStudios.workflow.draftContent
        : "";

    return Object.freeze({
      systemSpec: Object.freeze({
        components: Object.freeze(parsed.systemSpec?.components ?? []),
        nestedSystems: Object.freeze(parsed.systemSpec?.nestedSystems ?? []),
        dependencies: Object.freeze(parsed.systemSpec?.dependencies ?? []),
        bindings: Object.freeze(parsed.systemSpec?.bindings ?? []),
        inputs: Object.freeze(parsed.systemSpec?.inputs ?? []),
        outputs: Object.freeze(parsed.systemSpec?.outputs ?? []),
        parameters: Object.freeze(parsed.systemSpec?.parameters ?? []),
        settings: normalizeSystemSettingsModel(parsed.systemSpec?.settings, {
          pages,
        }),
        pages,
        embeddedStudios: Object.freeze({
          dataset: Object.freeze({
            draftContent: sharedDatasetDraftContent,
          }),
          workflow: Object.freeze({
            draftContent: sharedWorkflowDraftContent,
          }),
        }),
        sharedDocument: Object.freeze({
          datasetDraftContent: sharedDatasetDraftContent,
          workflowDraftContent: sharedWorkflowDraftContent,
          synchronization: Object.freeze({
            pageDefinitions: "systemSpec.pages",
            panelLayouts: "systemSpec.canvasAuthoring.pageLayouts",
            datasetDefinitions: "systemSpec.sharedDocument.datasetDraftContent",
            workflowDefinitions: "systemSpec.sharedDocument.workflowDraftContent",
            settingsMetadata: "systemSpec.parameters",
            systemSettings: "systemSpec.settings",
          }),
        }),
      }),
      canvasAuthoring: Object.freeze({
        ...canvasAuthoring,
        pageLayouts: normalizePageLayouts({
          pages,
          canvasAuthoring,
        }),
      }),
    });
  } catch {
    return emptyDocument;
  }
}

export function serializeSystemStudioCanvasAuthoringConfiguration(input: {
  readonly existingContent: string;
  readonly canvasAuthoring: SystemStudioCanvasAuthoringConfiguration;
}): string {
  const root = input.existingContent.trim()
    ? (JSON.parse(input.existingContent) as Record<string, unknown>)
    : {};
  const existingSystemSpec = (root.systemSpec && typeof root.systemSpec === "object" && !Array.isArray(root.systemSpec))
    ? { ...(root.systemSpec as Record<string, unknown>) }
    : {};

  root.systemSpec = {
    ...existingSystemSpec,
    canvasAuthoring: input.canvasAuthoring,
  };

  return JSON.stringify(root, null, 2);
}

export function serializeSystemStudioPageDefinitions(input: {
  readonly existingContent: string;
  readonly pages: ReadonlyArray<SystemStudioPageDefinition>;
}): string {
  const root = input.existingContent.trim()
    ? (JSON.parse(input.existingContent) as Record<string, unknown>)
    : {};
  const existingSystemSpec = (root.systemSpec && typeof root.systemSpec === "object" && !Array.isArray(root.systemSpec))
    ? { ...(root.systemSpec as Record<string, unknown>) }
    : {};

  root.systemSpec = {
    ...existingSystemSpec,
    pages: input.pages.map((page) => toSerializableSystemStudioPageModel(page)),
  };

  return JSON.stringify(root, null, 2);
}

export function serializeSystemStudioEmbeddedDatasetDraftContent(input: {
  readonly existingContent: string;
  readonly draftContent: string;
}): string {
  const root = input.existingContent.trim()
    ? (JSON.parse(input.existingContent) as Record<string, unknown>)
    : {};
  const existingSystemSpec = (root.systemSpec && typeof root.systemSpec === "object" && !Array.isArray(root.systemSpec))
    ? { ...(root.systemSpec as Record<string, unknown>) }
    : {};
  const existingEmbeddedStudios = (
    existingSystemSpec.embeddedStudios
    && typeof existingSystemSpec.embeddedStudios === "object"
    && !Array.isArray(existingSystemSpec.embeddedStudios)
  )
    ? { ...(existingSystemSpec.embeddedStudios as Record<string, unknown>) }
    : {};
  const existingDataset = (
    existingEmbeddedStudios.dataset
    && typeof existingEmbeddedStudios.dataset === "object"
    && !Array.isArray(existingEmbeddedStudios.dataset)
  )
    ? { ...(existingEmbeddedStudios.dataset as Record<string, unknown>) }
    : {};
  const existingSharedDocument = (
    existingSystemSpec.sharedDocument
    && typeof existingSystemSpec.sharedDocument === "object"
    && !Array.isArray(existingSystemSpec.sharedDocument)
  )
    ? { ...(existingSystemSpec.sharedDocument as Record<string, unknown>) }
    : {};

  root.systemSpec = {
    ...existingSystemSpec,
    embeddedStudios: {
      ...existingEmbeddedStudios,
      dataset: {
        ...existingDataset,
        draftContent: input.draftContent,
      },
    },
    sharedDocument: {
      ...existingSharedDocument,
      datasetDraftContent: input.draftContent,
    },
  };

  return JSON.stringify(root, null, 2);
}

export function serializeSystemStudioEmbeddedWorkflowDraftContent(input: {
  readonly existingContent: string;
  readonly draftContent: string;
}): string {
  const root = input.existingContent.trim()
    ? (JSON.parse(input.existingContent) as Record<string, unknown>)
    : {};
  const existingSystemSpec = (root.systemSpec && typeof root.systemSpec === "object" && !Array.isArray(root.systemSpec))
    ? { ...(root.systemSpec as Record<string, unknown>) }
    : {};
  const existingEmbeddedStudios = (
    existingSystemSpec.embeddedStudios
    && typeof existingSystemSpec.embeddedStudios === "object"
    && !Array.isArray(existingSystemSpec.embeddedStudios)
  )
    ? { ...(existingSystemSpec.embeddedStudios as Record<string, unknown>) }
    : {};
  const existingWorkflow = (
    existingEmbeddedStudios.workflow
    && typeof existingEmbeddedStudios.workflow === "object"
    && !Array.isArray(existingEmbeddedStudios.workflow)
  )
    ? { ...(existingEmbeddedStudios.workflow as Record<string, unknown>) }
    : {};
  const existingSharedDocument = (
    existingSystemSpec.sharedDocument
    && typeof existingSystemSpec.sharedDocument === "object"
    && !Array.isArray(existingSystemSpec.sharedDocument)
  )
    ? { ...(existingSystemSpec.sharedDocument as Record<string, unknown>) }
    : {};

  root.systemSpec = {
    ...existingSystemSpec,
    embeddedStudios: {
      ...existingEmbeddedStudios,
      workflow: {
        ...existingWorkflow,
        draftContent: input.draftContent,
      },
    },
    sharedDocument: {
      ...existingSharedDocument,
      workflowDraftContent: input.draftContent,
    },
  };

  return JSON.stringify(root, null, 2);
}

export function serializeSystemStudioSettings(input: {
  readonly existingContent: string;
  readonly settings: SystemSettingsModel;
}): string {
  const root = input.existingContent.trim()
    ? (JSON.parse(input.existingContent) as Record<string, unknown>)
    : {};
  const existingSystemSpec = (root.systemSpec && typeof root.systemSpec === "object" && !Array.isArray(root.systemSpec))
    ? { ...(root.systemSpec as Record<string, unknown>) }
    : {};

  root.systemSpec = {
    ...existingSystemSpec,
    settings: toSerializableSystemSettingsModel(input.settings),
  };

  return JSON.stringify(root, null, 2);
}
