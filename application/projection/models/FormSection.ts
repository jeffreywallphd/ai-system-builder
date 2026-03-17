import type { FormField } from "./FormField";

export interface FormSection {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly order: number;
  readonly fields: ReadonlyArray<FormField>;
}
