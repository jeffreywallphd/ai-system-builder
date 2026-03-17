import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import { WorkflowPresenter, type WorkflowListItemViewModel } from "./WorkflowPresenter";

export interface WorkflowBrowserViewModel {
  readonly query: string;
  readonly results: ReadonlyArray<WorkflowListItemViewModel>;
  readonly totalCount: number;
}

export class WorkflowBrowserPresenter {
  private readonly workflowPresenter: WorkflowPresenter;

  constructor(workflowPresenter?: WorkflowPresenter) {
    this.workflowPresenter = workflowPresenter ?? new WorkflowPresenter();
  }

  public present(
    workflows: ReadonlyArray<IWorkflow>,
    query: string | undefined
  ): WorkflowBrowserViewModel {
    const normalizedQuery = query?.trim().toLowerCase() ?? "";
    const listItems = this.workflowPresenter.presentList(workflows);

    const results = normalizedQuery
      ? listItems.filter((workflow) =>
          [workflow.id, workflow.title, workflow.description]
            .filter((value): value is string => Boolean(value?.trim()))
            .some((value) => value.toLowerCase().includes(normalizedQuery))
        )
      : listItems;

    return Object.freeze({
      query: query ?? "",
      results: Object.freeze(results),
      totalCount: listItems.length,
    });
  }
}
