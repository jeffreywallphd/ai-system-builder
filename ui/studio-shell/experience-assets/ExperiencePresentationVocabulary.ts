export type ExperienceDocumentId = string;
export type ExperienceIssueId = string;
export type ExperiencePageId = string;
export type ExperienceModeId = string;
export type ExperienceActionId = string;

export type ExperiencePresentationStatus = "ready" | "needs-input" | "has-issues";

export interface ExperienceIssueSummary {
  readonly id: ExperienceIssueId;
  readonly message: string;
  readonly status?: ExperiencePresentationStatus;
  readonly pageId?: ExperiencePageId;
}

export interface ExperienceProgressSummary {
  readonly totalCount: number;
  readonly completeCount: number;
  readonly readyCount?: number;
}

export interface ExperienceActionModel<TContext = void> {
  readonly id: ExperienceActionId;
  readonly label: string;
  readonly description?: string;
  readonly tone?: "default" | "primary" | "ghost";
  readonly disabled?: boolean;
  readonly run?: (context: TContext) => void | Promise<void>;
}
