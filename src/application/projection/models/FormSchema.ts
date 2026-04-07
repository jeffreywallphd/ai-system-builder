import type { FormSection } from "./FormSection";

export interface FormSchema {
  readonly workflowId: string;
  readonly title: string;
  readonly description?: string;
  readonly sections: ReadonlyArray<FormSection>;
}
