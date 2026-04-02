import type { CanvasSurfaceLayoutNodeModel } from "./ConfigurableCanvasSurfaceContracts";

export interface PanelAssetLayoutBounds {
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

export type PanelAssetContent = PanelEmbeddedStudioContent;

export interface PanelAssetContract {
  readonly panelId: string;
  readonly pageId: string;
  readonly regionId?: string;
  readonly title: string;
  readonly description?: string;
  readonly layoutBounds: PanelAssetLayoutBounds;
  readonly contentSlots: ReadonlyArray<PanelAssetContentSlot>;
  readonly content?: PanelAssetContent;
  readonly sourceLayoutNodeId?: string;
}

export interface RuntimePanelAssetInstance {
  readonly instanceId: string;
  readonly panelId: string;
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
}): PanelAssetContract {
  return Object.freeze({
    panelId: input.panelId ?? input.node.id,
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
    contentSlots: Object.freeze(input.contentSlots ?? []),
    content: undefined,
    sourceLayoutNodeId: input.node.id,
  });
}

export function mapPanelAssetToRuntimeInstance(
  panel: PanelAssetContract,
): RuntimePanelAssetInstance {
  return Object.freeze({
    instanceId: `${panel.pageId}:${panel.panelId}`,
    panelId: panel.panelId,
    pageId: panel.pageId,
    regionId: panel.regionId,
    title: panel.title,
    description: panel.description,
    layoutBounds: panel.layoutBounds,
    contentSlots: panel.contentSlots,
    content: panel.content,
  });
}
