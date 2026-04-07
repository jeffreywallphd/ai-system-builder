import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type {
  IWorkflowRecordSummary,
  IWorkflowRepository,
} from "./interfaces/IWorkflowRepository";

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function updatedAtValue(summary: IWorkflowRecordSummary): number {
  return summary.updatedAt ? summary.updatedAt.getTime() : 0;
}

export class WorkflowRepository implements IWorkflowRepository {
  private readonly repositories: ReadonlyArray<IWorkflowRepository>;

  constructor(repositories: ReadonlyArray<IWorkflowRepository> = []) {
    this.repositories = Object.freeze([...repositories]);
  }

  public async save(workflow: IWorkflow): Promise<IWorkflow> {
    const repository = this.resolvePrimaryRepository();
    return repository.save(workflow);
  }

  public async load(id: string): Promise<IWorkflow | undefined> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("WorkflowRepository.load requires a non-empty workflow id.");
    }

    for (const repository of this.repositories) {
      const workflow = await repository.load(normalizedId);

      if (workflow) {
        return workflow;
      }
    }

    return undefined;
  }

  public async delete(id: string): Promise<void> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("WorkflowRepository.delete requires a non-empty workflow id.");
    }

    for (const repository of this.repositories) {
      if (await repository.exists(normalizedId)) {
        await repository.delete(normalizedId);
      }
    }
  }

  public async exists(id: string): Promise<boolean> {
    const normalizedId = id.trim();

    if (!normalizedId) {
      throw new Error("WorkflowRepository.exists requires a non-empty workflow id.");
    }

    for (const repository of this.repositories) {
      if (await repository.exists(normalizedId)) {
        return true;
      }
    }

    return false;
  }

  public async list(): Promise<ReadonlyArray<IWorkflowRecordSummary>> {
    const results = await Promise.all(
      this.repositories.map((repository) => repository.list())
    );

    const deduped = new Map<string, IWorkflowRecordSummary>();

    for (const summary of results.flat()) {
      const key = normalize(summary.id);
      const existing = deduped.get(key);

      if (!existing || updatedAtValue(summary) > updatedAtValue(existing)) {
        deduped.set(key, summary);
      }
    }

    return Object.freeze(
      [...deduped.values()].sort(
        (left, right) => updatedAtValue(right) - updatedAtValue(left)
      )
    );
  }

  private resolvePrimaryRepository(): IWorkflowRepository {
    const repository = this.repositories[0];

    if (!repository) {
      throw new Error("No workflow repository is configured.");
    }

    return repository;
  }
}
