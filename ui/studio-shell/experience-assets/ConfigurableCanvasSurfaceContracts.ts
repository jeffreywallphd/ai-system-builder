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

export interface CanvasExperienceAssetDefinition<TContext> {
  readonly identity: CanvasSurfaceIdentity;
  readonly resolveGraphSummary: (context: TContext) => CanvasSurfaceGraphSummary;
  readonly resolveFocusedTarget?: (context: TContext) => CanvasSurfaceFocusedTarget | undefined;
  readonly resolvePalette?: (context: TContext) => CanvasSurfacePaletteModel | undefined;
  readonly resolveIssues?: (context: TContext) => ReadonlyArray<ExperienceIssueSummary>;
  readonly resolveToolbarActions?: (context: TContext) => ReadonlyArray<CanvasSurfaceToolbarActionModel>;
  readonly renderGraphInteractionShell: (input: {
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
