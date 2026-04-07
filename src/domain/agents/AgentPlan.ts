import { AssetId } from "../assets/AssetId";
import { normalizeAgentToolId } from "./AgentToolIdentity";

export const AgentPlanStepInputKinds = Object.freeze({
  asset: "asset",
  stepOutput: "step-output",
});

export type AgentPlanStepInputKind = typeof AgentPlanStepInputKinds[keyof typeof AgentPlanStepInputKinds];

export interface AgentPlanAssetInputReference {
  readonly kind: "asset";
  readonly assetId: AssetId;
}

export interface AgentPlanStepOutputInputReference {
  readonly kind: "step-output";
  readonly stepId: string;
  readonly outputKey: string;
}

export type AgentPlanStepInputReference = AgentPlanAssetInputReference | AgentPlanStepOutputInputReference;

export interface AgentPlanStepIntent {
  readonly action: string;
  readonly inputReferences: ReadonlyArray<AgentPlanStepInputReference>;
  readonly expectedOutputKey?: string;
  readonly toolInvocation?: AgentPlanToolInvocation;
}

export interface AgentPlanMcpToolInvocation {
  readonly kind: "mcp";
  readonly toolId: string;
  readonly structuredInput?: Readonly<Record<string, unknown>>;
  readonly expectedOutputSchema?: Readonly<Record<string, unknown>>;
  readonly authContextRef?: string;
}

export type AgentPlanToolInvocation = AgentPlanMcpToolInvocation;

export interface AgentPlanStep {
  readonly stepId: string;
  readonly goalId?: string;
  readonly toolId: string;
  readonly dependsOnStepIds: ReadonlyArray<string>;
  readonly intent: AgentPlanStepIntent;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AgentPlan {
  readonly planId: string;
  readonly agentId: string;
  readonly strategyId: string;
  readonly steps: ReadonlyArray<AgentPlanStep>;
  readonly createdAt: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

function normalizeRequired(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${field} is required.`);
  }
  return normalized;
}

function normalizeToolId(toolId: string): string {
  return normalizeAgentToolId(toolId, "Agent plan step toolId");
}

function normalizeInputReference(reference: AgentPlanStepInputReference): AgentPlanStepInputReference {
  if (reference.kind === AgentPlanStepInputKinds.asset) {
    const assetId = AssetId.from(reference.assetId);
    if (!assetId.toString().startsWith("asset:")) {
      throw new Error(`Agent plan input assetId '${assetId.toString()}' must use canonical asset id format.`);
    }
    return Object.freeze({ kind: AgentPlanStepInputKinds.asset, assetId });
  }

  if (reference.kind === AgentPlanStepInputKinds.stepOutput) {
    return Object.freeze({
      kind: AgentPlanStepInputKinds.stepOutput,
      stepId: normalizeRequired(reference.stepId, "Agent plan step-output reference stepId"),
      outputKey: normalizeOutputKey(reference.outputKey, "Agent plan step-output reference outputKey"),
    });
  }

  throw new Error("Agent plan input reference kind is invalid.");
}

function normalizeOutputKey(value: string, field: string): string {
  const normalized = normalizeRequired(value, field);
  if (!/^[a-zA-Z0-9_.-]+$/.test(normalized)) {
    throw new Error(`${field} '${normalized}' is malformed.`);
  }
  return normalized;
}

function normalizeStep(input: AgentPlanStep): AgentPlanStep {
  const normalizedToolId = normalizeToolId(input.toolId);
  const dependsOnStepIds = Object.freeze([...new Set((input.dependsOnStepIds ?? []).map((dependency) => normalizeRequired(dependency, "Agent plan dependency stepId")))]);
  const references = Object.freeze((input.intent.inputReferences ?? []).map((reference) => normalizeInputReference(reference)));

  return Object.freeze({
    stepId: normalizeRequired(input.stepId, "Agent plan step id"),
    goalId: input.goalId?.trim() || undefined,
    toolId: normalizedToolId,
    dependsOnStepIds,
    intent: Object.freeze({
      action: normalizeRequired(input.intent?.action ?? "", "Agent plan step action"),
      inputReferences: references,
      expectedOutputKey: input.intent.expectedOutputKey
        ? normalizeOutputKey(input.intent.expectedOutputKey, "Agent plan step expectedOutputKey")
        : undefined,
      toolInvocation: normalizeToolInvocation(normalizedToolId, input.intent.toolInvocation),
    }),
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}

function cloneSchemaRecord(value: Readonly<Record<string, unknown>> | undefined): Readonly<Record<string, unknown>> | undefined {
  if (!value) {
    return undefined;
  }
  return Object.freeze(JSON.parse(JSON.stringify(value)) as Record<string, unknown>);
}

function normalizeToolInvocation(
  stepToolId: string,
  invocation: AgentPlanToolInvocation | undefined,
): AgentPlanToolInvocation | undefined {
  if (!invocation) {
    return undefined;
  }
  if (invocation.kind !== "mcp") {
    throw new Error("Agent plan step toolInvocation kind is invalid.");
  }
  const invocationToolId = normalizeToolId(invocation.toolId);
  if (invocationToolId !== stepToolId) {
    throw new Error(`Agent plan step toolInvocation toolId '${invocationToolId}' must match step toolId '${stepToolId}'.`);
  }

  return Object.freeze({
    kind: "mcp",
    toolId: invocationToolId,
    structuredInput: cloneSchemaRecord(invocation.structuredInput),
    expectedOutputSchema: cloneSchemaRecord(invocation.expectedOutputSchema),
    authContextRef: invocation.authContextRef?.trim() || undefined,
  });
}


function validateStepOutputReferenceCompatibility(step: AgentPlanStep, referencedStep: AgentPlanStep, reference: AgentPlanStepOutputInputReference): void {
  const declaredOutputKey = referencedStep.intent.expectedOutputKey;
  if (!declaredOutputKey) {
    return;
  }
  if (declaredOutputKey !== reference.outputKey) {
    throw new Error(
      `Agent plan step '${step.stepId}' references outputKey '${reference.outputKey}' from step '${reference.stepId}', but that step declares expectedOutputKey '${declaredOutputKey}'.`,
    );
  }
}

export function normalizeAgentPlan(input: AgentPlan): AgentPlan {
  const steps = Object.freeze((input.steps ?? []).map((step) => normalizeStep(step)));
  if (steps.length === 0) {
    throw new Error("Agent plan requires at least one step.");
  }

  const stepIdSet = new Set(steps.map((step) => step.stepId));
  if (stepIdSet.size !== steps.length) {
    throw new Error("Agent plan steps must use unique step ids.");
  }

  const expectedOutputKeys = new Set<string>();
  const stepById = new Map(steps.map((step) => [step.stepId, step] as const));
  for (const step of steps) {
    if (step.dependsOnStepIds.includes(step.stepId)) {
      throw new Error(`Agent plan step '${step.stepId}' cannot depend on itself.`);
    }

    for (const dependencyId of step.dependsOnStepIds) {
      if (!stepIdSet.has(dependencyId)) {
        throw new Error(`Agent plan step '${step.stepId}' depends on unknown step '${dependencyId}'.`);
      }
    }

    for (const reference of step.intent.inputReferences) {
      if (reference.kind === AgentPlanStepInputKinds.stepOutput) {
        if (!stepIdSet.has(reference.stepId)) {
          throw new Error(`Agent plan step '${step.stepId}' references unknown step output '${reference.stepId}'.`);
        }
        if (!step.dependsOnStepIds.includes(reference.stepId)) {
          throw new Error(`Agent plan step '${step.stepId}' must depend on step '${reference.stepId}' when consuming its output.`);
        }
        const referencedStep = stepById.get(reference.stepId);
        if (!referencedStep) {
          throw new Error(`Agent plan step '${step.stepId}' references unknown step output '${reference.stepId}'.`);
        }
        validateStepOutputReferenceCompatibility(step, referencedStep, reference);
      }
    }

    if (step.intent.expectedOutputKey) {
      if (expectedOutputKeys.has(step.intent.expectedOutputKey)) {
        throw new Error(`Agent plan expectedOutputKey '${step.intent.expectedOutputKey}' must be unique across steps.`);
      }
      expectedOutputKeys.add(step.intent.expectedOutputKey);
    }
  }

  const dependencyGraph = new Map(steps.map((step) => [step.stepId, step.dependsOnStepIds] as const));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (stepId: string): void => {
    if (visited.has(stepId)) {
      return;
    }
    if (visiting.has(stepId)) {
      throw new Error(`Agent plan contains a dependency cycle at '${stepId}'.`);
    }
    visiting.add(stepId);
    for (const dependencyId of dependencyGraph.get(stepId) ?? []) {
      visit(dependencyId);
    }
    visiting.delete(stepId);
    visited.add(stepId);
  };
  for (const step of steps) {
    visit(step.stepId);
  }

  return Object.freeze({
    planId: normalizeRequired(input.planId, "Agent plan id"),
    agentId: normalizeRequired(input.agentId, "Agent plan agentId"),
    strategyId: normalizeRequired(input.strategyId, "Agent plan strategyId"),
    steps,
    createdAt: new Date(input.createdAt).toISOString(),
    metadata: input.metadata ? Object.freeze({ ...input.metadata }) : undefined,
  });
}

export function createAgentPlan(input: Omit<AgentPlan, "createdAt"> & { readonly createdAt?: Date }): AgentPlan {
  return normalizeAgentPlan({
    ...input,
    createdAt: (input.createdAt ?? new Date()).toISOString(),
  });
}
