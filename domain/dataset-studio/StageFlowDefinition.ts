import type { CanonicalDataShapeKind, CanonicalRecordValue } from "./CanonicalDataShapes";
import type { DatasetPipelineStageDefinition } from "./StagePipelineDomain";

export interface StageFlowConditionalTransition {
  readonly id: string;
  readonly fromStageId: string;
  readonly toStageId: string;
  readonly conditionId: string;
  readonly priority?: number;
}

export interface StageFlowDefinition {
  readonly flowId: string;
  readonly name: string;
  readonly description?: string;
  readonly stages: ReadonlyArray<DatasetPipelineStageDefinition>;
  readonly conditionalTransitions: ReadonlyArray<StageFlowConditionalTransition>;
}

export interface StageFlowMutableDefinition {
  readonly flowId: string;
  readonly name: string;
  readonly description?: string;
  readonly stages: ReadonlyArray<DatasetPipelineStageDefinition>;
  readonly conditionalTransitions?: ReadonlyArray<StageFlowConditionalTransition>;
}

export interface StageFlowRuntimeState {
  readonly currentStageId: string;
  readonly completedStageIds: ReadonlyArray<string>;
  readonly skippedStageIds: ReadonlyArray<string>;
  readonly stageConfiguration: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
  readonly stageOutputs: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
}

export interface StageFlowConditionContext {
  readonly currentStageId: string;
  readonly completedStageIds: ReadonlyArray<string>;
  readonly skippedStageIds: ReadonlyArray<string>;
  readonly stageConfiguration: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
  readonly stageOutputs: Readonly<Record<string, Readonly<Record<string, CanonicalRecordValue>>>>;
}

function normalizeRequired(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} cannot be empty.`);
  }
  return normalized;
}

function normalizeOptional(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function dedupeOrdered(values: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze([...new Set(values)]);
}

function assertStageContractCompatibility(
  fromStage: DatasetPipelineStageDefinition,
  toStage: DatasetPipelineStageDefinition,
): void {
  const compatibleKinds = fromStage.dataContract.producedOutputShapeKinds
    .filter((kind) => toStage.dataContract.acceptedInputShapeKinds.includes(kind));
  if (compatibleKinds.length === 0) {
    throw new Error(
      `Invalid transition '${fromStage.id}' -> '${toStage.id}': produced output kinds do not satisfy accepted input kinds.`,
    );
  }
}

function normalizeTransition(
  transition: StageFlowConditionalTransition,
): StageFlowConditionalTransition {
  return Object.freeze({
    id: normalizeRequired(transition.id, "StageFlowConditionalTransition.id"),
    fromStageId: normalizeRequired(transition.fromStageId, "StageFlowConditionalTransition.fromStageId"),
    toStageId: normalizeRequired(transition.toStageId, "StageFlowConditionalTransition.toStageId"),
    conditionId: normalizeRequired(transition.conditionId, "StageFlowConditionalTransition.conditionId"),
    priority: transition.priority,
  });
}

function freezeRecord(
  value: Readonly<Record<string, CanonicalRecordValue>>,
): Readonly<Record<string, CanonicalRecordValue>> {
  return Object.freeze({ ...value });
}

export function createStageFlowDefinition(
  input: StageFlowMutableDefinition,
): StageFlowDefinition {
  const flowId = normalizeRequired(input.flowId, "StageFlowDefinition.flowId");
  const name = normalizeRequired(input.name, "StageFlowDefinition.name");
  const description = normalizeOptional(input.description);
  if (input.stages.length === 0) {
    throw new Error(`Stage flow '${flowId}' must include at least one stage.`);
  }

  const stages = Object.freeze(input.stages
    .map((stage) => Object.freeze({ ...stage }))
    .sort((left, right) => left.order - right.order));

  const stageIds = new Set<string>();
  for (const stage of stages) {
    if (stageIds.has(stage.id)) {
      throw new Error(`Stage flow '${flowId}' includes duplicate stage id '${stage.id}'.`);
    }
    stageIds.add(stage.id);
  }

  const transitions = Object.freeze((input.conditionalTransitions ?? [])
    .map((transition) => normalizeTransition(transition))
    .sort((left, right) => (left.priority ?? 1000) - (right.priority ?? 1000)));

  const transitionIds = new Set<string>();
  for (const transition of transitions) {
    if (transitionIds.has(transition.id)) {
      throw new Error(`Stage flow '${flowId}' includes duplicate transition id '${transition.id}'.`);
    }
    transitionIds.add(transition.id);

    const fromStage = stages.find((stage) => stage.id === transition.fromStageId);
    const toStage = stages.find((stage) => stage.id === transition.toStageId);
    if (!fromStage || !toStage) {
      throw new Error(`Stage flow '${flowId}' transition '${transition.id}' references unknown stages.`);
    }
    assertStageContractCompatibility(fromStage, toStage);
  }

  for (let index = 0; index < stages.length - 1; index += 1) {
    const current = stages[index];
    const next = stages[index + 1];
    if (!current || !next) {
      continue;
    }
    assertStageContractCompatibility(current, next);
  }

  return Object.freeze({
    flowId,
    name,
    description,
    stages,
    conditionalTransitions: transitions,
  });
}

export function insertStageInFlow(
  flow: StageFlowDefinition,
  stage: DatasetPipelineStageDefinition,
  order: number,
): StageFlowDefinition {
  if (!Number.isInteger(order) || order < 1) {
    throw new Error(`insertStageInFlow requires a positive integer order. Received '${order}'.`);
  }
  if (order > flow.stages.length + 1) {
    throw new Error(
      `insertStageInFlow order '${order}' exceeds stage count '${flow.stages.length + 1}'.`,
    );
  }

  const existingIds = new Set(flow.stages.map((existing) => existing.id));
  if (existingIds.has(stage.id)) {
    throw new Error(`Stage flow '${flow.flowId}' already contains stage id '${stage.id}'.`);
  }

  const reordered = flow.stages.map((existing) => ({ ...existing }));
  reordered.splice(order - 1, 0, { ...stage });

  const normalizedStages = Object.freeze(reordered.map((existing, index) => Object.freeze({
    ...existing,
    order: index + 1,
  })));

  return createStageFlowDefinition({
    flowId: flow.flowId,
    name: flow.name,
    description: flow.description,
    stages: normalizedStages,
    conditionalTransitions: flow.conditionalTransitions,
  });
}

export function removeStageFromFlow(
  flow: StageFlowDefinition,
  stageId: string,
): StageFlowDefinition {
  const normalizedStageId = normalizeRequired(stageId, "removeStageFromFlow.stageId");
  if (flow.stages.length <= 1) {
    throw new Error(`Stage flow '${flow.flowId}' cannot remove its last stage.`);
  }

  const remainingStages = flow.stages.filter((stage) => stage.id !== normalizedStageId);
  if (remainingStages.length === flow.stages.length) {
    throw new Error(`Stage flow '${flow.flowId}' does not include stage '${normalizedStageId}'.`);
  }

  return createStageFlowDefinition({
    flowId: flow.flowId,
    name: flow.name,
    description: flow.description,
    stages: Object.freeze(remainingStages.map((stage, index) => Object.freeze({
      ...stage,
      order: index + 1,
    }))),
    conditionalTransitions: flow.conditionalTransitions.filter((transition) => (
      transition.fromStageId !== normalizedStageId
      && transition.toStageId !== normalizedStageId
    )),
  });
}

export function reorderFlowStages(
  flow: StageFlowDefinition,
  orderedStageIds: ReadonlyArray<string>,
): StageFlowDefinition {
  if (orderedStageIds.length !== flow.stages.length) {
    throw new Error(
      `Stage flow '${flow.flowId}' reorder list must include exactly ${flow.stages.length} stage ids.`,
    );
  }

  const normalizedIds = dedupeOrdered(orderedStageIds.map((stageId) => normalizeRequired(stageId, "reorderFlowStages.stageId")));
  if (normalizedIds.length !== flow.stages.length) {
    throw new Error(`Stage flow '${flow.flowId}' reorder list contains duplicate stage ids.`);
  }

  const stageMap = new Map(flow.stages.map((stage) => [stage.id, stage]));
  const reordered = normalizedIds.map((stageId, index) => {
    const stage = stageMap.get(stageId);
    if (!stage) {
      throw new Error(`Stage flow '${flow.flowId}' reorder list references unknown stage '${stageId}'.`);
    }
    return Object.freeze({
      ...stage,
      order: index + 1,
    });
  });

  return createStageFlowDefinition({
    flowId: flow.flowId,
    name: flow.name,
    description: flow.description,
    stages: Object.freeze(reordered),
    conditionalTransitions: flow.conditionalTransitions,
  });
}

export function createInitialStageFlowRuntimeState(flow: StageFlowDefinition): StageFlowRuntimeState {
  const firstStage = flow.stages[0];
  if (!firstStage) {
    throw new Error(`Stage flow '${flow.flowId}' has no stages.`);
  }
  return Object.freeze({
    currentStageId: firstStage.id,
    completedStageIds: Object.freeze([]),
    skippedStageIds: Object.freeze([]),
    stageConfiguration: Object.freeze({}),
    stageOutputs: Object.freeze({}),
  });
}

export function withStageConfiguration(
  state: StageFlowRuntimeState,
  stageId: string,
  configuration: Readonly<Record<string, CanonicalRecordValue>>,
): StageFlowRuntimeState {
  const normalizedStageId = normalizeRequired(stageId, "withStageConfiguration.stageId");
  return Object.freeze({
    ...state,
    stageConfiguration: Object.freeze({
      ...state.stageConfiguration,
      [normalizedStageId]: freezeRecord(configuration),
    }),
  });
}

export function withStageOutput(
  state: StageFlowRuntimeState,
  stageId: string,
  output: Readonly<Record<string, CanonicalRecordValue>>,
): StageFlowRuntimeState {
  const normalizedStageId = normalizeRequired(stageId, "withStageOutput.stageId");
  return Object.freeze({
    ...state,
    stageOutputs: Object.freeze({
      ...state.stageOutputs,
      [normalizedStageId]: freezeRecord(output),
    }),
  });
}

export function areStageContractsCompatible(
  fromStage: DatasetPipelineStageDefinition,
  toStage: DatasetPipelineStageDefinition,
): boolean {
  return fromStage.dataContract.producedOutputShapeKinds
    .some((shapeKind: CanonicalDataShapeKind) => toStage.dataContract.acceptedInputShapeKinds.includes(shapeKind));
}
