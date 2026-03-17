import { ListPublishedToolsUseCase } from "../../application/tools/ListPublishedToolsUseCase";
import { LoadToolDefinitionUseCase } from "../../application/tools/LoadToolDefinitionUseCase";
import { RunToolUseCase } from "../../application/tools/RunToolUseCase";
import type { ToolRunRequest } from "../../application/projection/models/ToolRunRequest";

export class ToolService {
  constructor(
    private readonly listPublishedToolsUseCase: ListPublishedToolsUseCase,
    private readonly loadToolDefinitionUseCase: LoadToolDefinitionUseCase,
    private readonly runToolUseCase: RunToolUseCase
  ) {}

  public async listPublishedTools() {
    return this.listPublishedToolsUseCase.execute();
  }

  public async loadToolDefinition(toolId: string) {
    return this.loadToolDefinitionUseCase.execute(toolId);
  }

  public async runTool(request: ToolRunRequest) {
    return this.runToolUseCase.execute(request);
  }
}
