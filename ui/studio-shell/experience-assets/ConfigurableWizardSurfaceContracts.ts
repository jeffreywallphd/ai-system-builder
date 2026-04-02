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
