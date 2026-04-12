import type { CanvasSurfaceLayoutNodeModel } from "./ConfigurableCanvasSurfaceContracts";
import type { StudioAssetCompositionNode } from "../studio-assets/StudioAssetComposition";

export const panelComposedAssetId = "ui-composed:panel";
export const defaultPanelSlotId = "panel-content";
export const defaultPanelLayoutMode = "vertical-stack";

export const panelLayoutModes = Object.freeze({
  verticalStack: "vertical-stack",
  horizontalSplit: "horizontal-split",
  grid: "grid",
});

export type PanelLayoutMode = typeof panelLayoutModes[keyof typeof panelLayoutModes];

export interface PanelHeaderActionConfig {
  readonly actionId: string;
  readonly label: string;
}

export interface PanelHeaderConfig {
  readonly visible: boolean;
  readonly title: string;
  readonly subtitle?: string;
  readonly actions: ReadonlyArray<PanelHeaderActionConfig>;
}

export interface PanelLayoutConfig {
  readonly mode: PanelLayoutMode;
  readonly gap: number;
  readonly columns?: number;
}

export interface PanelContainerConfig {
  readonly layout: PanelLayoutConfig;
  readonly header: PanelHeaderConfig;
}

export interface PanelAssetLayoutBounds {
  /**
   * Normalized page-section occupancy intent in the usable viewport below the page header.
   * Values are percentages in [0,1] and are interpreted with system-standard section margins.
   */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PanelAssetContentSlot {
  readonly slotId: string;
  readonly label?: string;
}

export interface PanelEmbeddedStudioContent {
  readonly kind: "embedded-studio";
  readonly studioAssetId: string;
  readonly draftContent?: string;
  readonly experienceAssetIds?: ReadonlyArray<string>;
  readonly embeddedVariant?: string;
}

export interface PanelAssetCompositionContent {
  readonly kind: "asset-composition";
  readonly serializedDocument: string;
}

export type PanelAssetContent = PanelEmbeddedStudioContent | PanelAssetCompositionContent;

export interface PanelAssetContract {
  readonly panelId: string;
  readonly assetId?: string;
  readonly panelType?: "composed-panel";
  readonly pageId: string;
  readonly regionId?: string;
  readonly title: string;
  readonly description?: string;
  readonly layoutBounds: PanelAssetLayoutBounds;
  readonly contentSlots: ReadonlyArray<PanelAssetContentSlot>;
  readonly content?: PanelAssetContent;
  readonly sourceLayoutNodeId?: string;
}

function normalizePanelLayoutMode(value: unknown): PanelLayoutMode {
  if (value === panelLayoutModes.horizontalSplit || value === panelLayoutModes.grid || value === panelLayoutModes.verticalStack) {
    return value;
  }
  return panelLayoutModes.verticalStack;
}

function normalizePanelHeaderActions(value: unknown): ReadonlyArray<PanelHeaderActionConfig> {
  if (!Array.isArray(value)) {
    return Object.freeze([]);
  }
  return Object.freeze(value
    .filter((entry): entry is { readonly actionId?: unknown; readonly label?: unknown } => !!entry && typeof entry === "object")
    .map((entry, index) => {
      const fallbackActionId = `action-${index + 1}`;
      const actionId = typeof entry.actionId === "string" && entry.actionId.trim()
        ? entry.actionId.trim()
        : fallbackActionId;
      const label = typeof entry.label === "string" && entry.label.trim()
        ? entry.label.trim()
        : `Action ${index + 1}`;
      return Object.freeze({
        actionId,
        label,
      });
    }));
}

export function resolvePanelContainerConfig(input: {
  readonly config?: Readonly<Record<string, unknown>>;
  readonly panel: Pick<PanelAssetContract, "title" | "description">;
}): PanelContainerConfig {
  const config = input.config ?? {};
  const layoutRecord = (config.layout && typeof config.layout === "object" && !Array.isArray(config.layout))
    ? config.layout as Record<string, unknown>
    : {};
  const headerRecord = (config.header && typeof config.header === "object" && !Array.isArray(config.header))
    ? config.header as Record<string, unknown>
    : {};
  const gap = Number.isFinite(layoutRecord.gap) ? Number(layoutRecord.gap) : 12;
  const rawColumns = Number.isFinite(layoutRecord.columns) ? Number(layoutRecord.columns) : undefined;
  const columns = rawColumns ? Math.min(6, Math.max(1, Math.round(rawColumns))) : undefined;

  const hasHeaderActionArray = Array.isArray(headerRecord.actions);
  const headerActions = hasHeaderActionArray
    ? normalizePanelHeaderActions(headerRecord.actions)
    : headerRecord.showActions === true
      ? Object.freeze([Object.freeze({
        actionId: "primary",
        label: typeof headerRecord.primaryActionLabel === "string" && headerRecord.primaryActionLabel.trim()
          ? headerRecord.primaryActionLabel.trim()
          : "Action",
      })])
      : Object.freeze([]);

  return Object.freeze({
    layout: Object.freeze({
      mode: normalizePanelLayoutMode(layoutRecord.mode),
      gap: Math.min(48, Math.max(0, gap)),
      columns,
    }),
    header: Object.freeze({
      visible: headerRecord.visible !== false,
      title: typeof headerRecord.title === "string" && headerRecord.title.trim()
        ? headerRecord.title.trim()
        : input.panel.title,
      subtitle: typeof headerRecord.subtitle === "string" && headerRecord.subtitle.trim()
        ? headerRecord.subtitle.trim()
        : (input.panel.description?.trim() ? input.panel.description.trim() : undefined),
      actions: headerActions,
    }),
  });
}

export interface RuntimePanelAssetInstance {
  readonly instanceId: string;
  readonly panelId: string;
  readonly assetId?: string;
  readonly panelType?: "composed-panel";
  readonly pageId: string;
  readonly regionId?: string;
  readonly title: string;
  readonly description?: string;
  readonly layoutBounds: PanelAssetLayoutBounds;
  readonly contentSlots: ReadonlyArray<PanelAssetContentSlot>;
  readonly content?: PanelAssetContent;
}

export function mapLayoutNodeToPanelAsset(input: {
  readonly node: CanvasSurfaceLayoutNodeModel;
  readonly panelId?: string;
  readonly pageId: string;
  readonly regionId?: string;
  readonly description?: string;
  readonly contentSlots?: ReadonlyArray<PanelAssetContentSlot>;
  readonly content?: PanelAssetContent;
}): PanelAssetContract {
  return Object.freeze({
    panelId: input.panelId ?? input.node.id,
    assetId: panelComposedAssetId,
    panelType: "composed-panel",
    pageId: input.pageId,
    regionId: input.regionId,
    title: input.node.title,
    description: input.description ?? input.node.subtitle,
    layoutBounds: Object.freeze({
      x: input.node.x,
      y: input.node.y,
      width: input.node.width,
      height: input.node.height,
    }),
    contentSlots: Object.freeze(input.contentSlots ?? [Object.freeze({ slotId: defaultPanelSlotId, label: "Panel content" })]),
    content: input.content,
    sourceLayoutNodeId: input.node.id,
  });
}

export function mapPanelAssetToRuntimeInstance(
  panel: PanelAssetContract,
): RuntimePanelAssetInstance {
  return Object.freeze({
    instanceId: `${panel.pageId}:${panel.panelId}`,
    panelId: panel.panelId,
    assetId: panel.assetId,
    panelType: panel.panelType,
    pageId: panel.pageId,
    regionId: panel.regionId,
    title: panel.title,
    description: panel.description,
    layoutBounds: panel.layoutBounds,
    contentSlots: panel.contentSlots,
    content: panel.content,
  });
}

export function createDefaultPanelCompositionRoot(panel: PanelAssetContract): StudioAssetCompositionNode {
  const containerConfig = resolvePanelContainerConfig({
    panel,
    config: Object.freeze({
      title: panel.title,
      description: panel.description ?? "",
    }),
  });
  return Object.freeze({
    nodeId: panel.panelId,
    assetId: panel.assetId ?? panelComposedAssetId,
    assetVersion: "1.0.0",
    config: Object.freeze({
      title: panel.title,
      description: panel.description ?? "",
      layout: containerConfig.layout,
      header: containerConfig.header,
    }),
    slots: Object.freeze([
      Object.freeze({
        placementId: panel.contentSlots[0]?.slotId ?? defaultPanelSlotId,
        children: Object.freeze([]),
      }),
    ]),
  });
}
