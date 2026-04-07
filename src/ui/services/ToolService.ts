import type { CapabilitySearchQuery } from "../../application/research/models/CapabilitySearchQuery";
import { SearchCapabilitiesUseCase } from "../../application/research/SearchCapabilitiesUseCase";
import type { ToolSearchCriteria } from "../../application/dto/ToolSearchCriteria";
import type { ToolRunRequest } from "../../application/projection/models/ToolRunRequest";
import { ListToolCapabilitiesUseCase } from "../../application/tools/ListToolCapabilitiesUseCase";
import { LoadToolDefinitionUseCase } from "../../application/tools/LoadToolDefinitionUseCase";
import { InvokeToolCapabilityUseCase } from "../../application/tools/InvokeToolCapabilityUseCase";
import { ListPublishedToolsUseCase } from "../../application/tools/ListPublishedToolsUseCase";
import { RunToolUseCase } from "../../application/tools/RunToolUseCase";
import type { ToolCapabilityInvocationRequest } from "../../application/tools/models/ToolCapabilityInvocationRequest";

export class ToolService {
  constructor(
    private readonly listPublishedToolsUseCase: ListPublishedToolsUseCase,
    private readonly loadToolDefinitionUseCase: LoadToolDefinitionUseCase,
    private readonly runToolUseCase: RunToolUseCase,
    private readonly listToolCapabilitiesUseCase: ListToolCapabilitiesUseCase,
    private readonly invokeToolCapabilityUseCase: InvokeToolCapabilityUseCase,
    private readonly searchCapabilitiesUseCase: SearchCapabilitiesUseCase
  ) {}

  public async listPublishedTools(criteria?: ToolSearchCriteria) {
    return this.listPublishedToolsUseCase.execute(criteria);
  }

  public async listToolCapabilities() {
    return this.listToolCapabilitiesUseCase.execute();
  }

  public async searchCapabilities(query: CapabilitySearchQuery) {
    return this.searchCapabilitiesUseCase.execute(query);
  }

  public async loadToolDefinition(toolId: string) {
    return this.loadToolDefinitionUseCase.execute(toolId);
  }

  public async runTool(request: ToolRunRequest) {
    return this.runToolUseCase.execute(request);
  }

  public async invokeToolCapability(request: ToolCapabilityInvocationRequest) {
    return this.invokeToolCapabilityUseCase.execute(request);
  }
}
