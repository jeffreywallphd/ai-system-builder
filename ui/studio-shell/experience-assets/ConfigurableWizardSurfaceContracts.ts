import type { JSX } from "react";
import type {
  ExperienceActionModel,
  ExperienceIssueSummary,
  ExperiencePageId,
  ExperiencePresentationStatus,
  ExperienceProgressSummary,
} from "./ExperiencePresentationVocabulary";

export interface WizardSurfacePageModel {
  readonly id: ExperiencePageId;
  readonly title: string;
  readonly status?: ExperiencePresentationStatus;
}

export interface WizardSurfaceProgressSummary extends ExperienceProgressSummary {
  readonly focusLabel: string;
}

export interface WizardSurfaceReadinessSummary {
  readonly title: string;
  readonly description: string;
  readonly issues: ReadonlyArray<ExperienceIssueSummary>;
}

export interface WizardSurfaceTerminalActionContext {
  readonly activePageId: ExperiencePageId;
}

export interface WizardSurfaceTerminalActionModel extends ExperienceActionModel<WizardSurfaceTerminalActionContext> {}

export interface WizardSurfaceNavigationPolicy {
  readonly sequentialNavigation?: "enabled" | "disabled";
}

export interface WizardExperiencePageDefinition<TContext> {
  readonly id: ExperiencePageId;
  readonly title: string;
  readonly summary?: string;
  readonly status?: ExperiencePresentationStatus;
  readonly resolveStatus?: (context: TContext) => ExperiencePresentationStatus;
  readonly render: (context: TContext) => JSX.Element;
}

export interface WizardExperienceTerminalActionContext<TContext> extends WizardSurfaceTerminalActionContext {
  readonly context: TContext;
}

export interface WizardExperienceTerminalActionDefinition<TContext>
  extends ExperienceActionModel<WizardExperienceTerminalActionContext<TContext>> {}

export interface WizardExperienceAssetDefinition<TContext> {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly pages: ReadonlyArray<WizardExperiencePageDefinition<TContext>>;
  readonly resolveProgress: (input: {
    readonly context: TContext;
    readonly activePageId: ExperiencePageId;
  }) => WizardSurfaceProgressSummary;
  readonly resolveReadiness: (context: TContext) => WizardSurfaceReadinessSummary;
  readonly terminalActions?: ReadonlyArray<WizardExperienceTerminalActionDefinition<TContext>>;
  readonly renderTerminalArea?: (input: {
    readonly context: TContext;
    readonly activePageId: ExperiencePageId;
  }) => JSX.Element | null;
  readonly navigationPolicy?: WizardSurfaceNavigationPolicy;
}
