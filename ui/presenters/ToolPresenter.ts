import type { ToolDefinition } from "../../application/projection/models/ToolDefinition";

export class ToolPresenter {
  public presentTitle(tool: ToolDefinition): string {
    return tool.title;
  }
}
