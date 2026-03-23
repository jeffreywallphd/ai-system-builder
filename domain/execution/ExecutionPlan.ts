export const ExecutionUnitKinds = Object.freeze({
  workflow: "workflow",
});

export type ExecutionUnitKind = typeof ExecutionUnitKinds[keyof typeof ExecutionUnitKinds];

export const ExecutionStatuses = Object.freeze({
  pending: "pending",
  ready: "ready",
  running: "running",
  completed: "completed",
  failed: "failed",
  skipped: "skipped",
});

export type ExecutionStatus = typeof ExecutionStatuses[keyof typeof ExecutionStatuses];

export interface IExecutionUnitDefinition {
  readonly id: string;
  readonly kind: ExecutionUnitKind;
  readonly label?: string;
  readonly dependsOn?: ReadonlyArray<string>;
}

export interface IExecutionUnitResultMetadata {
  readonly unitId: string;
  readonly status: Extract<ExecutionStatus, "completed" | "failed" | "skipped">;
  readonly outputMetadata?: Readonly<Record<string, unknown>>;
  readonly errorMessage?: string;
}

function normalizeRequired(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${fieldName} cannot be empty.`);
  }

  return normalized;
}

function freezeDependsOn(dependsOn?: ReadonlyArray<string>): ReadonlyArray<string> {
  return Object.freeze(
    [...new Set((dependsOn ?? []).map((dependencyId) => normalizeRequired(dependencyId, "ExecutionUnitDefinition.dependsOn")))]
  );
}

export class ExecutionUnitDefinition implements IExecutionUnitDefinition {
  public readonly id: string;
  public readonly kind: ExecutionUnitKind;
  public readonly label?: string;
  public readonly dependsOn: ReadonlyArray<string>;

  constructor(params: IExecutionUnitDefinition) {
    this.id = normalizeRequired(params.id, "ExecutionUnitDefinition.id");
    this.kind = params.kind;
    this.label = params.label?.trim() || undefined;
    this.dependsOn = freezeDependsOn(params.dependsOn);
  }
}

export class ExecutionUnitResultMetadata implements IExecutionUnitResultMetadata {
  public readonly unitId: string;
  public readonly status: IExecutionUnitResultMetadata["status"];
  public readonly outputMetadata?: Readonly<Record<string, unknown>>;
  public readonly errorMessage?: string;

  constructor(params: IExecutionUnitResultMetadata) {
    this.unitId = normalizeRequired(params.unitId, "ExecutionUnitResultMetadata.unitId");
    this.status = params.status;
    this.outputMetadata = params.outputMetadata ? Object.freeze({ ...params.outputMetadata }) : undefined;
    this.errorMessage = params.errorMessage?.trim() || undefined;
  }
}

export class ExecutionPlan {
  public readonly id: string;
  public readonly units: ReadonlyArray<ExecutionUnitDefinition>;

  private readonly unitsById: ReadonlyMap<string, ExecutionUnitDefinition>;

  constructor(params: { readonly id: string; readonly units: ReadonlyArray<IExecutionUnitDefinition>; }) {
    this.id = normalizeRequired(params.id, "ExecutionPlan.id");
    this.units = Object.freeze(params.units.map((unit) => new ExecutionUnitDefinition(unit)));
    this.unitsById = new Map(this.units.map((unit) => [unit.id, unit]));

    if (this.units.length === 0) {
      throw new Error("ExecutionPlan.units cannot be empty.");
    }

    if (this.unitsById.size !== this.units.length) {
      throw new Error("ExecutionPlan.units cannot contain duplicate ids.");
    }

    for (const unit of this.units) {
      for (const dependencyId of unit.dependsOn) {
        if (!this.unitsById.has(dependencyId)) {
          throw new Error(
            `ExecutionPlan unit '${unit.id}' depends on unknown unit '${dependencyId}'.`
          );
        }
      }
    }

    this.assertAcyclic();
  }

  public getUnit(unitId: string): ExecutionUnitDefinition | undefined {
    return this.unitsById.get(unitId.trim());
  }

  public getReadyUnits(statuses: Readonly<Record<string, ExecutionStatus>>): ReadonlyArray<ExecutionUnitDefinition> {
    return Object.freeze(
      this.units.filter((unit) => {
        const unitStatus = statuses[unit.id] ?? ExecutionStatuses.pending;

        if (!(unitStatus === ExecutionStatuses.pending || unitStatus === ExecutionStatuses.ready)) {
          return false;
        }

        return unit.dependsOn.every((dependencyId) => statuses[dependencyId] === ExecutionStatuses.completed);
      })
    );
  }

  private assertAcyclic(): void {
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (unitId: string) => {
      if (visited.has(unitId)) {
        return;
      }

      if (visiting.has(unitId)) {
        throw new Error(`ExecutionPlan '${this.id}' contains a dependency cycle at '${unitId}'.`);
      }

      visiting.add(unitId);
      const unit = this.unitsById.get(unitId);
      for (const dependencyId of unit?.dependsOn ?? []) {
        visit(dependencyId);
      }
      visiting.delete(unitId);
      visited.add(unitId);
    };

    for (const unit of this.units) {
      visit(unit.id);
    }
  }
}
