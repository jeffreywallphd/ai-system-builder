export const WizardStageStatuses = Object.freeze({
  current: "current",
  completed: "completed",
  skipped: "skipped",
  pending: "pending",
  disabled: "disabled",
} as const);

export type WizardStageStatus =
  typeof WizardStageStatuses[keyof typeof WizardStageStatuses];

export interface WizardStageProgressStep {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly status: WizardStageStatus;
  readonly isDisabled: boolean;
}

