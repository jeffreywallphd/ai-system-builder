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
    private readonly orchestrator: IAgentToolOrchestrator
  ) {}

  public async execute(request: AgentExecutionRequest): Promise<AgentExecutionResult> {
    const input = request.input.trim();
    if (!input) {
      throw new Error("Agent execution requires a non-empty input.");
    }

    const availableTools = Object.freeze([
      ...(await this.catalog.listCapabilities()),
    ]);
    const selectedTools = Object.freeze(this.selectTools(availableTools, request));
    const maxIterations = this.normalizeMaxIterations(request.maxIterations);

    const metadata = {
      ...(request.metadata ? { ...request.metadata } : {}),
      ...(request.context
        ? {
            workflowContext: Object.freeze({
              promptText: request.context.promptText,
              selectedPackageIds: request.context.selectedPackageIds
                ? Object.freeze([...request.context.selectedPackageIds])
                : undefined,
              packageLabels: request.context.packageLabels
                ? Object.freeze({ ...request.context.packageLabels })
                : undefined,
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
      metadata: Object.keys(metadata).length > 0 ? Object.freeze(metadata) : undefined,
    });

    return Object.freeze({
      ...result,
      input,
      maxIterations,
      availableTools,
      selectedTools,
      steps: Object.freeze([...result.steps]),
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
