import {
  DatasetInstanceRoles,
  type DatasetInstanceRole,
} from "./DatasetInstanceDomain";
import {
  WorkflowOutputTargetTypes,
  suggestIntentForTargetType,
  suggestWriteModeForTargetType,
  type WorkflowOutputBindingIntent,
  type WorkflowOutputBindingWriteMode,
  type WorkflowOutputTargetType,
} from "../workflow-studio/WorkflowOutputBindingDomain";
export { WorkflowOutputTargetTypes } from "../workflow-studio/WorkflowOutputBindingDomain";

export const WorkflowOutputTargetContractVersion = "1.0.0";

export interface WorkflowOutputTargetDefinition {
  readonly targetType: WorkflowOutputTargetType;
  readonly label: string;
  readonly description: string;
  readonly datasetInstanceRole: DatasetInstanceRole;
  readonly defaultPurpose: string;
  readonly defaultIntent: WorkflowOutputBindingIntent;
  readonly defaultWriteMode: WorkflowOutputBindingWriteMode;
  readonly comparisonGrouping: "none" | "required";
}

const WorkflowOutputTargetDefinitions: ReadonlyArray<WorkflowOutputTargetDefinition> = Object.freeze([
  Object.freeze({
    targetType: WorkflowOutputTargetTypes.outputDataset,
    label: "Output dataset",
    description: "Current/published workflow results.",
    datasetInstanceRole: DatasetInstanceRoles.outputStore,
    defaultPurpose: "workflow-output-images",
    defaultIntent: suggestIntentForTargetType(WorkflowOutputTargetTypes.outputDataset),
    defaultWriteMode: suggestWriteModeForTargetType(WorkflowOutputTargetTypes.outputDataset),
    comparisonGrouping: "none",
  }),
  Object.freeze({
    targetType: WorkflowOutputTargetTypes.historyDataset,
    label: "History dataset",
    description: "Append-oriented run history for durable audit/replay.",
    datasetInstanceRole: DatasetInstanceRoles.outputStore,
    defaultPurpose: "workflow-output-history-images",
    defaultIntent: suggestIntentForTargetType(WorkflowOutputTargetTypes.historyDataset),
    defaultWriteMode: suggestWriteModeForTargetType(WorkflowOutputTargetTypes.historyDataset),
    comparisonGrouping: "none",
  }),
  Object.freeze({
    targetType: WorkflowOutputTargetTypes.comparisonDataset,
    label: "Comparison dataset",
    description: "Grouped comparable outputs for inspection and side-by-side analysis.",
    datasetInstanceRole: DatasetInstanceRoles.outputStore,
    defaultPurpose: "workflow-output-comparison-images",
    defaultIntent: suggestIntentForTargetType(WorkflowOutputTargetTypes.comparisonDataset),
    defaultWriteMode: suggestWriteModeForTargetType(WorkflowOutputTargetTypes.comparisonDataset),
    comparisonGrouping: "required",
  }),
]);

export function listWorkflowOutputTargetDefinitions(): ReadonlyArray<WorkflowOutputTargetDefinition> {
  return WorkflowOutputTargetDefinitions;
}

export function getWorkflowOutputTargetDefinition(
  targetType: WorkflowOutputTargetType,
): WorkflowOutputTargetDefinition | undefined {
  const normalized = targetType.trim();
  return WorkflowOutputTargetDefinitions.find((entry) => entry.targetType === normalized);
}

export function resolveWorkflowOutputTargetPurpose(input: {
  readonly targetType: WorkflowOutputTargetType;
  readonly purpose?: string;
}): string {
  const explicitPurpose = input.purpose?.trim();
  if (explicitPurpose) {
    return explicitPurpose;
  }
  const definition = getWorkflowOutputTargetDefinition(input.targetType);
  if (!definition) {
    throw new Error(`Workflow output target type '${input.targetType}' is not supported.`);
  }
  return definition.defaultPurpose;
}
