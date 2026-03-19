import { ExecutionContextToolPolicyService } from "../context/ExecutionContextToolPolicyService";
import type { IAgentToolOrchestrator } from "../ports/interfaces/IAgentToolOrchestrator";
import type { IToolCapabilityCatalog } from "../ports/interfaces/IToolCapabilityCatalog";
import type {
  ToolCapabilityDescriptor,
  ToolCapabilityProviderKind,
  ToolCapabilitySourceDescriptor,
} from "../tools/models/ToolCapabilityDescriptor";
import type { AgentExecutionRequest } from "./models/AgentExecutionRequest";
import type { AgentExecutionResult } from "./models/AgentExecutionResult";

const DEFAULT_MAX_ITERATIONS = 3;
const MAX_ALLOWED_ITERATIONS = 10;

export class ExecuteAgentToolsUseCase {
  constructor(
    private readonly catalog: IToolCapabilityCatalog,
    private readonly orchestrator: IAgentToolOrchestrator,
    private readonly policyService: ExecutionContextToolPolicyService = new ExecutionContextToolPolicyService()
  ) {}

  public async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const input = request.input.trim();
    if (!input) {
      throw new Error("Agent execution requires a non-empty input.");
    }

    const availableTools = Object.freeze([
      ...(await this.catalog.listCapabilities()),
    ]);
    const selectedTools = Object.freeze(this.filterToolsByContextPolicy(this.selectTools(availableTools, request), request));
    const maxIterations = this.normalizeMaxIterations(request.maxIterations);

    const metadata = {
      ...(request.metadata ? { ...request.metadata } : {}),
      ...(request.context
        ? {
            workflowContext: Object.freeze({
              packageReferences: request.context.packageReferences,
              assembledContext: request.context.assembledContext,
              trimmingPolicy: request.context.trimmingPolicy,
              budget: request.context.budget,
              inspection: request.context.inspection,
              toolUsePolicy: request.context.toolUsePolicy,
            }),
          }
        : {}),
    };

    const result = await this.orchestrator.execute({
      input,
      executionId: request.executionId?.trim() || undefined,
      maxIterations,
      availableTools,
      selectedTools,
      context: request.context,
      metadata: Object.keys(metadata).length > 0 ? Object.freeze(metadata) : undefined,
    });

    return Object.freeze({
      ...result,
      input,
      maxIterations,
      iterationCount: Math.min(maxIterations, Math.max(0, Math.trunc(result.iterationCount ?? result.steps.length))),
      availableTools,
      selectedTools,
      steps: Object.freeze(result.steps.map((step) => Object.freeze({ ...step }))),
      metadata: result.metadata ? Object.freeze({ ...result.metadata }) : result.metadata,
    });
  }

  private selectTools(
    availableTools: ReadonlyArray<ToolCapabilityDescriptor>,
    request: AgentExecutionRequest
  ): ReadonlyArray<ToolCapabilityDescriptor> {
    const selection = request.toolSelection;
    if (!selection) {
      return [...availableTools];
    }

    const capabilityIds = this.normalizeStringList(selection.capabilityIds);
    const providerKinds = new Set<ToolCapabilityProviderKind>(selection.providerKinds ?? []);
    const source = selection.source;

    this.validateSelection(selection.mode, capabilityIds, providerKinds, source);

    if (selection.mode === "all") {
      return [...availableTools];
    }

    if (capabilityIds.length > 0) {
      const selectedById = capabilityIds.map((capabilityId) => {
        const match = availableTools.find((tool) => tool.id === capabilityId);
        if (!match) {
          throw new Error(`Unknown agent tool capability '${capabilityId}'.`);
        }
        return match;
      });

      return this.filterByProviderAndSource(selectedById, providerKinds, source);
    }

    return this.filterByProviderAndSource(availableTools, providerKinds, source);
  }

  private filterToolsByContextPolicy(
    tools: ReadonlyArray<ToolCapabilityDescriptor>,
    request: AgentExecutionRequest
  ): ReadonlyArray<ToolCapabilityDescriptor> {
    if (!request.context) {
      return [...tools];
    }

    return tools.filter((tool) => this.policyService.isSourceAllowed(tool.provider.kind, tool.source, request.context));
  }

  private validateSelection(
    mode: AgentExecutionRequest["toolSelection"] extends infer T
      ? T extends { mode: infer M }
        ? M
        : never
      : never,
    capabilityIds: ReadonlyArray<string>,
    providerKinds: ReadonlySet<ToolCapabilityProviderKind>,
    source?: ToolCapabilitySourceDescriptor
  ): void {
    if (mode === "capabilityIds" && capabilityIds.length === 0) {
      throw new Error("Agent tool selection mode 'capabilityIds' requires at least one capability id.");
    }

    if (mode === "providerKinds" && providerKinds.size === 0) {
      throw new Error("Agent tool selection mode 'providerKinds' requires at least one provider kind.");
    }

    if (mode === "source" && !source) {
      throw new Error("Agent tool selection mode 'source' requires a source filter.");
    }

    if (mode === "mixed" && capabilityIds.length === 0 && providerKinds.size === 0 && !source) {
      throw new Error("Agent tool selection mode 'mixed' requires at least one filter.");
    }
  }

  private filterByProviderAndSource(
    tools: ReadonlyArray<ToolCapabilityDescriptor>,
    providerKinds: ReadonlySet<ToolCapabilityProviderKind>,
    source?: ToolCapabilitySourceDescriptor
  ): ReadonlyArray<ToolCapabilityDescriptor> {
    return tools.filter((tool) => {
      if (providerKinds.size > 0 && !providerKinds.has(tool.provider.kind)) {
        return false;
      }

      if (!source) {
        return true;
      }

      return this.matchesSource(tool.source, source);
    });
  }

  private matchesSource(
    candidate: ToolCapabilitySourceDescriptor,
    expected: ToolCapabilitySourceDescriptor
  ): boolean {
    const keys = Object.keys(expected) as Array<keyof ToolCapabilitySourceDescriptor>;
    return keys.every((key) => {
      const value = expected[key];
      return value === undefined || candidate[key] === value;
    });
  }

  private normalizeMaxIterations(value?: number): number {
    if (value === undefined) {
      return DEFAULT_MAX_ITERATIONS;
    }

    if (!Number.isFinite(value)) {
      throw new Error("Agent execution maxIterations must be a finite number.");
    }

    return Math.min(MAX_ALLOWED_ITERATIONS, Math.max(1, Math.trunc(value)));
  }

  private normalizeStringList(values?: ReadonlyArray<string>): ReadonlyArray<string> {
    if (!values) {
      return [];
    }

    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const value of values) {
      const trimmed = value.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      normalized.push(trimmed);
    }
    return normalized;
  }
}
