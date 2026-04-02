import type { CanvasSurfaceLayoutNodeModel } from "./ConfigurableCanvasSurfaceContracts";
import type { StudioAssetCompositionNode } from "../studio-assets/StudioAssetComposition";

export const panelComposedAssetId = "ui-composed:panel";
export const defaultPanelSlotId = "panel-content";

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
  return Object.freeze({
    nodeId: panel.panelId,
    assetId: panel.assetId ?? panelComposedAssetId,
    assetVersion: "1.0.0",
    config: Object.freeze({
      title: panel.title,
      description: panel.description ?? "",
    }),
    slots: Object.freeze([
      Object.freeze({
        placementId: panel.contentSlots[0]?.slotId ?? defaultPanelSlotId,
        children: Object.freeze([]),
      }),
    ]),
  });
}
