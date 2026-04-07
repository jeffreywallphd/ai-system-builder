import type { ToolSection } from "./ToolSection";

export interface ToolDefinition {
  readonly id: string;
  readonly workflowId: string;
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  readonly category?: string;
  readonly sections: ReadonlyArray<ToolSection>;
}
