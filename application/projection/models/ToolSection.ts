import type { ToolField } from "./ToolField";

export interface ToolSection {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly order: number;
  readonly fields: ReadonlyArray<ToolField>;
}
