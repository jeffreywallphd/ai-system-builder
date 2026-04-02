import type { SystemAsset } from "../../../domain/system-studio/SystemAssetDomain";
import type {
  CanvasSurfaceDesignFrameModel,
  CanvasSurfaceDesignFrameRatio,
} from "../experience-assets/ConfigurableCanvasSurfaceContracts";
import type { PanelAssetContract, PanelAssetLayoutBounds } from "../experience-assets/PanelAssetContracts";

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
  readonly panels: ReadonlyArray<PanelAssetContract>;
}

export interface SystemStudioDraftDocument {
  readonly systemSpec: {
    readonly components: NonNullable<SystemAsset["components"]>;
    readonly nestedSystems: NonNullable<SystemAsset["nestedSystems"]>;
    readonly dependencies: ReadonlyArray<{ readonly assetId: string; readonly versionId?: string }>;
    readonly bindings: NonNullable<SystemAsset["bindings"]>;
    readonly inputs: NonNullable<SystemAsset["inputs"]>;
    readonly outputs: NonNullable<SystemAsset["outputs"]>;
    readonly parameters: NonNullable<SystemAsset["parameters"]>;
  };
  readonly canvasAuthoring: SystemStudioCanvasAuthoringConfiguration;
}

const emptyDocument: SystemStudioDraftDocument = Object.freeze({
  systemSpec: Object.freeze({
    components: Object.freeze([]),
    nestedSystems: Object.freeze([]),
    dependencies: Object.freeze([]),
    bindings: Object.freeze([]),
    inputs: Object.freeze([]),
    outputs: Object.freeze([]),
    parameters: Object.freeze([]),
  }),
  canvasAuthoring: Object.freeze({
    designFrame: Object.freeze({
      mode: "bounded-frame",
      ratio: defaultDesignFrameRatio,
      dimensions: Object.freeze({ width: 1600, height: 900 }),
      boundedArea: Object.freeze({ padding: 20 }),
    }),
    panels: Object.freeze([]),
  }),
});

function normalizeLayoutBounds(input: unknown): PanelAssetLayoutBounds {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return defaultPanelBounds;
  }
  const record = input as Partial<PanelAssetLayoutBounds>;
  const x = Number.isFinite(record.x) ? Number(record.x) : defaultPanelBounds.x;
  const y = Number.isFinite(record.y) ? Number(record.y) : defaultPanelBounds.y;
  const width = Number.isFinite(record.width) ? Number(record.width) : defaultPanelBounds.width;
  const height = Number.isFinite(record.height) ? Number(record.height) : defaultPanelBounds.height;
  return Object.freeze({
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    width: Math.max(0.05, Math.min(1, width)),
    height: Math.max(0.05, Math.min(1, height)),
  });
}

function normalizeCanvasAuthoringConfig(input: unknown): SystemStudioCanvasAuthoringConfiguration {
  const record = (!input || typeof input !== "object" || Array.isArray(input))
    ? {}
    : (input as {
      readonly designFrame?: CanvasSurfaceDesignFrameModel;
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

  const panels = Object.freeze((record.panels ?? [])
    .filter((entry): entry is Partial<PanelAssetContract> => Boolean(entry))
    .map((entry, index) => {
      const panelId = entry.panelId?.trim() || `panel-${index + 1}`;
      return Object.freeze({
        panelId,
        pageId: entry.pageId?.trim() || "default",
        title: entry.title?.trim() || `Panel ${index + 1}`,
        description: entry.description?.trim() || undefined,
        layoutBounds: normalizeLayoutBounds(entry.layoutBounds),
        contentSlots: Object.freeze((entry.contentSlots ?? []).map((slot, slotIndex) => Object.freeze({
          slotId: slot.slotId?.trim() || `${panelId}-slot-${slotIndex + 1}`,
          label: slot.label?.trim() || undefined,
        }))),
        sourceLayoutNodeId: entry.sourceLayoutNodeId?.trim() || undefined,
      } satisfies PanelAssetContract);
    }));

  return Object.freeze({
    designFrame,
    panels,
  });
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
    return Object.freeze({
      systemSpec: Object.freeze({
        components: Object.freeze(parsed.systemSpec?.components ?? []),
        nestedSystems: Object.freeze(parsed.systemSpec?.nestedSystems ?? []),
        dependencies: Object.freeze(parsed.systemSpec?.dependencies ?? []),
        bindings: Object.freeze(parsed.systemSpec?.bindings ?? []),
        inputs: Object.freeze(parsed.systemSpec?.inputs ?? []),
        outputs: Object.freeze(parsed.systemSpec?.outputs ?? []),
        parameters: Object.freeze(parsed.systemSpec?.parameters ?? []),
      }),
      canvasAuthoring: normalizeCanvasAuthoringConfig(parsed.systemSpec?.canvasAuthoring),
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
