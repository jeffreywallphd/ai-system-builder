import type { FieldVisibility } from "./FormField";

export interface ToolField {
  readonly id: string;
  readonly nodeId: string;
  readonly propertyId: string;
  readonly label: string;
  readonly description?: string;
  readonly type: string;
  readonly required: boolean;
  readonly order: number;
  readonly defaultValue?: unknown;
  readonly value?: unknown;
  readonly options?: ReadonlyArray<{ readonly label: string; readonly value: unknown }>;
  readonly visibility: FieldVisibility;
}
