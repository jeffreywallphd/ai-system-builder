export const WorkflowStudioModeIds = Object.freeze({
  wizard: "wizard",
  canvas: "canvas",
});

export type WorkflowStudioModeId = typeof WorkflowStudioModeIds[keyof typeof WorkflowStudioModeIds];
export const DEFAULT_WORKFLOW_STUDIO_MODE_ID: WorkflowStudioModeId = WorkflowStudioModeIds.wizard;

export interface WorkflowStudioModeDefinition {
  readonly id: WorkflowStudioModeId;
  readonly title: string;
  readonly summary: string;
  readonly intent: "guided-authoring" | "graph-authoring";
}

function normalizeModeDefinition(mode: WorkflowStudioModeDefinition): WorkflowStudioModeDefinition {
  const id = mode.id.trim() as WorkflowStudioModeId;
  if (!id) {
    throw new Error("Workflow studio mode id is required.");
  }

  const title = mode.title.trim();
  if (!title) {
    throw new Error(`Workflow studio mode '${id}' title is required.`);
  }

  const summary = mode.summary.trim();
  if (!summary) {
    throw new Error(`Workflow studio mode '${id}' summary is required.`);
  }

  return Object.freeze({
    ...mode,
    id,
    title,
    summary,
  });
}

export class WorkflowStudioModeRegistry {
  private readonly byId = new Map<WorkflowStudioModeId, WorkflowStudioModeDefinition>();

  public register(mode: WorkflowStudioModeDefinition): void {
    const normalized = normalizeModeDefinition(mode);
    if (this.byId.has(normalized.id)) {
      throw new Error(`Workflow studio mode '${normalized.id}' is already registered.`);
    }

    this.byId.set(normalized.id, normalized);
  }

  public registerMany(modes: ReadonlyArray<WorkflowStudioModeDefinition>): void {
    for (const mode of modes) {
      this.register(mode);
    }
  }

  public get(modeId: WorkflowStudioModeId): WorkflowStudioModeDefinition | undefined {
    return this.byId.get(modeId);
  }

  public list(): ReadonlyArray<WorkflowStudioModeDefinition> {
    return Object.freeze(
      [...this.byId.values()].sort((left, right) => left.title.localeCompare(right.title)),
    );
  }
}

export const defaultWorkflowStudioModes: ReadonlyArray<WorkflowStudioModeDefinition> = Object.freeze([
  Object.freeze({
    id: WorkflowStudioModeIds.canvas,
    title: "Canvas",
    summary: "Graph-oriented authoring surface for node/connection workflow design.",
    intent: "graph-authoring",
  }),
  Object.freeze({
    id: WorkflowStudioModeIds.wizard,
    title: "Wizard",
    summary: "Guided step-by-step authoring flow over the same canonical workflow draft.",
    intent: "guided-authoring",
  }),
]);

export function createDefaultWorkflowStudioModeRegistry(): WorkflowStudioModeRegistry {
  const registry = new WorkflowStudioModeRegistry();
  registry.registerMany(defaultWorkflowStudioModes);
  return registry;
}

export function isWorkflowStudioModeId(value: string): value is WorkflowStudioModeId {
  return value === WorkflowStudioModeIds.wizard || value === WorkflowStudioModeIds.canvas;
}
