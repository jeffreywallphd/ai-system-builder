import type { IAgentToolOrchestrator, AgentToolOrchestrationRequest } from "../../application/ports/interfaces/IAgentToolOrchestrator";
import type { IToolCapabilityExecutor } from "../../application/ports/interfaces/IToolCapabilityExecutor";
import type { AgentExecutionResult } from "../../application/agents/models/AgentExecutionResult";
import type { AgentStepResult } from "../../application/agents/models/AgentStepResult";
import type { ToolCapabilityDescriptor } from "../../application/tools/models/ToolCapabilityDescriptor";

const KEYWORDS = ["search", "find", "lookup", "retrieve", "sum", "echo", "tool"] as const;

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function splitTaskIntoSteps(task: string, maxSteps: number): string[] {
  const normalized = task.trim();
  if (!normalized) {
    return [];
  }

  return normalized
    .split(/\b(?:and then|then|after that|next)\b|[;\n]+/i)
    .map((part) => part.trim().replace(/^[,\s]+|[,\s]+$/g, ""))
    .filter(Boolean)
    .slice(0, maxSteps);
}

function pickToolForTask(task: string, tools: ReadonlyArray<ToolCapabilityDescriptor>): ToolCapabilityDescriptor | undefined {
  if (tools.length === 0) {
    return undefined;
  }

  const normalizedTask = task.toLowerCase();
  const directMatch = tools.find((tool) => {
    const names = [tool.routingName, tool.displayName, tool.id, tool.source.toolName]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.toLowerCase());

    return names.some((name) => normalizedTask.includes(name));
  });
  if (directMatch) {
    return directMatch;
  }

  const keywordTriggered = tools.find((tool) => {
    const description = (tool.description ?? "").toLowerCase();
    return KEYWORDS.some((keyword) => normalizedTask.includes(keyword) && description.includes(keyword));
  });

  return keywordTriggered ?? tools[0];
}

function resultTextFromContent(result: AgentStepResult["result"]): string | undefined {
  if (!result) {
    return undefined;
  }

  const text = result.content
    .map((item) => (typeof item.text === "string" ? item.text : undefined))
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n")
    .trim();

  if (text) {
    return text;
  }

  if (result.structuredContent && Object.keys(result.structuredContent).length > 0) {
    return JSON.stringify(result.structuredContent);
  }

  return result.errorMessage;
}

export class DeterministicToolCapabilityAgentOrchestrator implements IAgentToolOrchestrator {
  constructor(private readonly executor: IToolCapabilityExecutor) {}

  public async execute(request: AgentToolOrchestrationRequest): Promise<AgentExecutionResult> {
    const taskSegments = splitTaskIntoSteps(request.input, request.maxIterations);
    const steps: AgentStepResult[] = [];
    const observedOutputs: string[] = [];
    let stoppedReason: AgentExecutionResult["stoppedReason"] = "completed";
    let status: AgentExecutionResult["status"] = "completed";

    for (const [index, taskSegment] of taskSegments.entries()) {
      const tool = pickToolForTask(taskSegment, request.selectedTools);
      if (!tool) {
        stoppedReason = "no-tool-selected";
        break;
      }

      const invocationArguments = Object.freeze({ input: taskSegment });
      const result = await this.executor.invoke({
        capabilityId: tool.id,
        provider: tool.provider,
        source: tool.source,
        context: request.context,
        arguments: invocationArguments,
        executionId: `${request.executionId ?? "agent"}-step-${index + 1}`,
        metadata: {
          ...(request.metadata ?? {}),
          origin: "application.agent",
          agentExecutionId: request.executionId ?? "agent",
          stepIndex: index + 1,
          contextInstructions: request.context?.toolUsePolicy?.instructions,
        },
      });

      const resultText = resultTextFromContent(result);
      if (resultText) {
        observedOutputs.push(resultText);
      }

      steps.push(Object.freeze({
        stepIndex: index + 1,
        taskInput: taskSegment,
        capabilityId: tool.id,
        displayName: tool.displayName,
        provider: tool.provider,
        source: tool.source,
        status: result.status,
        reasoning: `Selected '${tool.displayName}' for task segment ${index + 1}.`,
        invocationArguments,
        result,
        resultText,
        errorMessage: result.errorMessage,
      }));

      if (result.status !== "completed") {
        stoppedReason = "tool-failed";
        status = result.status === "cancelled" ? "cancelled" : "failed";
        break;
      }
    }

    if (status === "completed" && taskSegments.length > 0 && steps.length === request.maxIterations) {
      stoppedReason = "max-iterations-reached";
    } else if (status === "completed" && steps.length === 0) {
      stoppedReason = request.selectedTools.length > 0 ? "no-tool-selected" : "completed";
    }

    return Object.freeze({
      executionId: request.executionId ?? "agent-execution",
      status,
      input: request.input,
      maxIterations: request.maxIterations,
      iterationCount: steps.length,
      stoppedReason,
      availableTools: Object.freeze([...request.availableTools]),
      selectedTools: Object.freeze([...request.selectedTools]),
      steps: Object.freeze(steps),
      finalOutput:
        observedOutputs.length > 0
          ? `Observed ${observedOutputs.length} tool step(s): ${observedOutputs.join("; ")}`
          : request.input,
      metadata: request.metadata ? Object.freeze({ ...request.metadata }) : undefined,
      errorMessage: status === "failed" ? steps.at(-1)?.errorMessage : undefined,
    });
  }
}
