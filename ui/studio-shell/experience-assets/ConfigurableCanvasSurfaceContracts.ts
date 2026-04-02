import type { JSX } from "react";
import type {
  ExperienceActionModel,
  ExperienceIssueSummary,
} from "./ExperiencePresentationVocabulary";

export interface CanvasSurfaceIdentity {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
}

export interface CanvasSurfaceGraphSummary {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly issueCount?: number;
}

export interface CanvasSurfacePaletteModel {
  readonly title: string;
  readonly description?: string;
}

export interface CanvasSurfaceFocusedTarget {
  readonly kind: "node" | "edge" | "none";
  readonly id?: string;
  readonly label?: string;
}

export interface CanvasSurfaceGraphInteractionContext {
  readonly focusedTarget?: CanvasSurfaceFocusedTarget;
}

export interface CanvasSurfaceToolbarActionContext {
  readonly focusedTarget?: CanvasSurfaceFocusedTarget;
}

export interface CanvasSurfaceToolbarActionModel
  extends ExperienceActionModel<CanvasSurfaceToolbarActionContext> {}

export interface CanvasSurfaceInspectorContext {
  readonly focusedTarget?: CanvasSurfaceFocusedTarget;
}

export interface CanvasSurfaceLayoutNodeModel {
  readonly id: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly minWidth?: number;
  readonly minHeight?: number;
  readonly selectable?: boolean;
  readonly movable?: boolean;
  readonly resizable?: boolean;
}

export interface CanvasSurfaceDesignFrameRatio {
  readonly width: number;
  readonly height: number;
}

export interface CanvasSurfaceDesignFrameDimensions {
  readonly width: number;
  readonly height: number;
}

export interface CanvasSurfaceBoundedEditingArea {
  readonly padding?: number;
}

export interface CanvasSurfaceNormalizedCoordinateSpace {
  readonly mode: "normalized";
  readonly referenceDimensions: CanvasSurfaceDesignFrameDimensions;
}

export interface CanvasSurfaceAbsoluteCoordinateSpace {
  readonly mode: "absolute";
}

export type CanvasSurfaceCoordinateSpace =
  | CanvasSurfaceNormalizedCoordinateSpace
  | CanvasSurfaceAbsoluteCoordinateSpace;

export interface CanvasSurfaceDesignFrameModel {
  readonly mode: "bounded-frame";
  readonly ratio?: CanvasSurfaceDesignFrameRatio;
  readonly dimensions?: CanvasSurfaceDesignFrameDimensions;
  readonly boundedArea?: CanvasSurfaceBoundedEditingArea;
}

export interface CanvasSurfaceViewportModel {
  readonly center: {
    readonly x: number;
    readonly y: number;
  };
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
}

export interface CanvasSurfaceCommandModel {
  readonly id: string;
  readonly label: string;
  readonly tone?: "primary" | "secondary" | "ghost";
  readonly disabled?: boolean;
}

export interface CanvasSurfaceSnapDivisionModel {
  readonly x: number;
  readonly y: number;
}

export interface CanvasSurfaceSnapTimingModel {
  readonly duringDrag?: boolean;
  readonly onRelease?: boolean;
}

export interface CanvasSurfaceSnapTargetModel {
  readonly position?: boolean;
  readonly size?: boolean;
}

export interface CanvasSurfaceSnapModel {
  readonly enabled: boolean;
  readonly divisions: CanvasSurfaceSnapDivisionModel;
  readonly timing?: CanvasSurfaceSnapTimingModel;
  readonly targets?: CanvasSurfaceSnapTargetModel;
}

export interface CanvasSurfaceEditingModel {
  readonly nodes: ReadonlyArray<CanvasSurfaceLayoutNodeModel>;
  readonly selectedNodeId?: string;
  readonly commands?: ReadonlyArray<CanvasSurfaceCommandModel>;
  readonly createNodeLabel?: string;
  readonly createNodeDescription?: string;
  readonly designFrame?: CanvasSurfaceDesignFrameModel;
  readonly coordinateSpace?: CanvasSurfaceCoordinateSpace;
  readonly snap?: CanvasSurfaceSnapModel;
}

export type CanvasSurfaceEditingEvent =
  | {
    readonly type: "selection.change";
    readonly nodeId?: string;
  }
  | {
    readonly type: "node.create.request";
    readonly position: {
      readonly x: number;
      readonly y: number;
    };
  }
  | {
    readonly type: "node.position.change";
    readonly nodeId: string;
    readonly position: {
      readonly x: number;
      readonly y: number;
    };
  }
  | {
    readonly type: "node.resize.change";
    readonly nodeId: string;
    readonly frame: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
  }
  | {
    readonly type: "canvas.command";
    readonly commandId: string;
    readonly viewport?: CanvasSurfaceViewportModel;
  };

export interface CanvasExperienceAssetDefinition<TContext> {
  readonly identity: CanvasSurfaceIdentity;
  readonly resolveGraphSummary: (context: TContext) => CanvasSurfaceGraphSummary;
  readonly resolveFocusedTarget?: (context: TContext) => CanvasSurfaceFocusedTarget | undefined;
  readonly resolvePalette?: (context: TContext) => CanvasSurfacePaletteModel | undefined;
  readonly resolveIssues?: (context: TContext) => ReadonlyArray<ExperienceIssueSummary>;
  readonly resolveToolbarActions?: (context: TContext) => ReadonlyArray<CanvasSurfaceToolbarActionModel>;
  readonly resolveEditingModel?: (context: TContext) => CanvasSurfaceEditingModel | undefined;
  readonly onEditingEvent?: (input: {
    readonly context: TContext;
    readonly event: CanvasSurfaceEditingEvent;
  }) => void;
  readonly renderGraphInteractionShell?: (input: {
    readonly context: TContext;
    readonly interaction: CanvasSurfaceGraphInteractionContext;
  }) => JSX.Element;
  readonly renderPaletteRegion?: (context: TContext) => JSX.Element | null;
  readonly renderInspectorRegion?: (input: {
    readonly context: TContext;
    readonly inspector: CanvasSurfaceInspectorContext;
  }) => JSX.Element | null;
  readonly renderSupplementaryPanels?: (context: TContext) => JSX.Element | null;
  readonly resolveInteractionMessage?: (context: TContext) => string | undefined;
  readonly emptyState?: {
    readonly when: (context: TContext) => boolean;
    readonly render: (context: TContext) => JSX.Element;
  };
}
