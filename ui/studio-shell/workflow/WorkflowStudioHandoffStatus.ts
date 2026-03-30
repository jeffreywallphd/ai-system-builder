export const WorkflowStudioHandoffFlowKinds = Object.freeze({
  datasetInput: "dataset-input",
  agentStep: "agent-step",
});

export type WorkflowStudioHandoffFlowKind =
  typeof WorkflowStudioHandoffFlowKinds[keyof typeof WorkflowStudioHandoffFlowKinds];

export const WorkflowStudioHandoffStatusKinds = Object.freeze({
  launching: "launching",
  pending: "pending",
  resumed: "resumed",
  completed: "completed",
  cancelled: "cancelled",
  recovered: "recovered",
});

export type WorkflowStudioHandoffStatusKind =
  typeof WorkflowStudioHandoffStatusKinds[keyof typeof WorkflowStudioHandoffStatusKinds];

export interface WorkflowStudioHandoffStatus {
  readonly kind: WorkflowStudioHandoffStatusKind;
  readonly flow: WorkflowStudioHandoffFlowKind;
  readonly updatedAt: number;
  readonly handoffId?: string;
  readonly selectorSessionKey?: string;
  readonly selectorTargetId?: string;
  readonly outcomeKind?: "created" | "cancelled" | "no-selection" | "abandoned" | "invalid";
  readonly assetId?: string;
  readonly assetDisplayName?: string;
  readonly detail?: string;
}

export function isWorkflowStudioHandoffFlowKind(value: string | undefined): value is WorkflowStudioHandoffFlowKind {
  return value === WorkflowStudioHandoffFlowKinds.datasetInput
    || value === WorkflowStudioHandoffFlowKinds.agentStep;
}

