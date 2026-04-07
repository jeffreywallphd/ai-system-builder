import type { IWorkflow } from "../../domain/workflows/interfaces/IWorkflow";
import type { FormSchema } from "./models/FormSchema";
import { WorkflowApplicationProjectionService } from "./WorkflowApplicationProjectionService";

export class WorkflowProjectionService {
  public constructor(
    private readonly applicationProjectionService: WorkflowApplicationProjectionService =
      new WorkflowApplicationProjectionService()
  ) {}

  public projectToForm(workflow: IWorkflow): FormSchema {
    return {
      workflowId: workflow.id,
      title: workflow.metadata.name,
      description: workflow.metadata.description,
      sections: this.applicationProjectionService.projectSections(workflow, "author"),
    };
  }

  public applyFormInput(
    workflow: IWorkflow,
    values: Readonly<Record<string, unknown>>
  ): IWorkflow {
    return this.applicationProjectionService.applyInput(workflow, values);
  }
}
