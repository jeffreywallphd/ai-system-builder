import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import { WorkflowDraftOutputDestinationTypes } from "@domain/workflow-studio/WorkflowStudioDomain";
import type { IExecuteWorkflowRequest, IExecuteWorkflowResult } from "@application/workflows/ExecuteWorkflowUseCase";
import type { WorkflowConversationPromptBinding } from "./WorkflowConversationContracts";

export interface WorkflowConversationOutputConfiguration {
  readonly destinationType?: string;
  readonly title?: string;
  readonly promptInputId?: string;
  readonly responseField?: string;
  readonly conversationScope?: string;
}

export interface WorkflowConversationEligibilityInput {
  readonly workflow: IWorkflow;
  readonly request?: Omit<IExecuteWorkflowRequest, "workflow">;
  readonly result: IExecuteWorkflowResult;
  readonly nodeOutputs?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

export interface WorkflowConversationSeed {
  readonly promptText: string;
  readonly responseText: string;
  readonly responseField?: string;
  readonly outputConfiguration?: WorkflowConversationOutputConfiguration;
  readonly promptBinding: WorkflowConversationPromptBinding;
}

export interface WorkflowConversationEligibilityResult {
  readonly eligible: boolean;
  readonly reason: string;
  readonly seed?: WorkflowConversationSeed;
}

const promptLikePropertyIds = [
  "prompt",
  "input",
  "query",
  "question",
  "message",
  "userInput",
  "user-input",
] as const;

const responseLikeFieldIds = [
  "assistant-response",
  "assistantResponse",
  "response",
  "resultText",
  "result",
  "output",
  "text",
  "answer",
] as const;

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function normalizeOptionalContent(value: unknown): string | undefined {
  if (typeof value === "string") {
    return normalizeOptionalString(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function readOutputConfiguration(request?: Omit<IExecuteWorkflowRequest, "workflow">): WorkflowConversationOutputConfiguration | undefined {
  const options = request?.parameters?.workflowConversationOutput;
  if (!options || typeof options !== "object") {
    return undefined;
  }

  const config = options as Record<string, unknown>;
  return Object.freeze({
    destinationType: normalizeOptionalString(config.destinationType),
    title: normalizeOptionalString(config.title),
    promptInputId: normalizeOptionalString(config.promptInputId),
    responseField: normalizeOptionalString(config.responseField),
    conversationScope: normalizeOptionalString(config.conversationScope),
  });
}

function resolvePromptBindingAndValue(workflow: IWorkflow): { binding?: WorkflowConversationPromptBinding; promptText?: string } {
  for (const node of workflow.nodes) {
    for (const property of node.properties) {
      const propertyId = property.id.trim();
      if (!propertyId) {
        continue;
      }

      const isPromptLike = promptLikePropertyIds.some((candidate) => candidate.toLowerCase() === propertyId.toLowerCase());
      if (!isPromptLike) {
        continue;
      }

      const content = normalizeOptionalContent(property.value);
      if (!content) {
        continue;
      }

      return Object.freeze({
        binding: Object.freeze({
          nodeId: node.id,
          propertyId,
        }),
        promptText: content,
      });
    }
  }

  return Object.freeze({});
}

function resolveResponseText(
  nodeOutputs: Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined,
  preferredField?: string,
): string | undefined {
  if (!nodeOutputs) {
    return undefined;
  }

  const entries = Object.entries(nodeOutputs);
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const output = entries[index]?.[1];
    if (!output) {
      continue;
    }

    if (preferredField) {
      const preferred = normalizeOptionalContent(output[preferredField]);
      if (preferred) {
        return preferred;
      }
    }

    for (const key of responseLikeFieldIds) {
      const value = normalizeOptionalContent(output[key]);
      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

function isChatCapableOutputConfiguration(config?: WorkflowConversationOutputConfiguration): boolean {
  return config?.destinationType === WorkflowDraftOutputDestinationTypes.promptResponseChat;
}

function isLegacyChatCapableWorkflow(workflow: IWorkflow): boolean {
  return workflow.nodes.some((node) => node.definition.id === "langchain.llm_chat");
}

export function evaluateWorkflowConversationEligibility(
  input: WorkflowConversationEligibilityInput,
): WorkflowConversationEligibilityResult {
  if (input.result.result.status !== "completed") {
    return Object.freeze({
      eligible: false,
      reason: "workflow execution did not complete successfully",
    });
  }

  const outputConfiguration = readOutputConfiguration(input.request);
  const prompt = resolvePromptBindingAndValue(input.workflow);
  const responseField = outputConfiguration?.responseField;
  const responseText = resolveResponseText(input.nodeOutputs, responseField);

  const hasPromptLikeInput = !!prompt.binding && !!prompt.promptText;
  const hasChatCapableOutput = isChatCapableOutputConfiguration(outputConfiguration)
    || isLegacyChatCapableWorkflow(input.workflow);

  if (!hasPromptLikeInput || !hasChatCapableOutput || !responseText) {
    const detail = !hasPromptLikeInput
      ? "missing prompt-like workflow input"
      : !hasChatCapableOutput
        ? "missing chat-capable output semantics"
        : "missing assistant response from execution outputs";

    return Object.freeze({
      eligible: false,
      reason: detail,
    });
  }

  return Object.freeze({
    eligible: true,
    reason: "workflow run is prompt-response conversational",
    seed: Object.freeze({
      promptText: prompt.promptText as string,
      responseText,
      responseField,
      outputConfiguration,
      promptBinding: prompt.binding as WorkflowConversationPromptBinding,
    }),
  });
}

