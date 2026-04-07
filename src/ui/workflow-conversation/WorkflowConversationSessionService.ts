import { WorkflowDraftOutputDestinationTypes } from "@domain/workflow-studio/WorkflowStudioDomain";
import type { IWorkflowExecutionEvent } from "@application/ports/interfaces/IWorkflowExecutor";
import type { IExecuteWorkflowRequest, IExecuteWorkflowResult } from "@application/workflows/ExecuteWorkflowUseCase";
import type { IWorkflow } from "@domain/workflows/interfaces/IWorkflow";
import type { WorkflowService } from "../services/WorkflowService";
import {
  evaluateWorkflowConversationEligibility,
  type WorkflowConversationOutputConfiguration,
} from "./WorkflowConversationEligibility";
import {
  WorkflowConversationMessageRoles,
  WorkflowConversationSessionStatuses,
  type WorkflowConversationMessage,
  type WorkflowConversationPersistencePayload,
  type WorkflowConversationPromptBinding,
  type WorkflowConversationSession,
} from "./WorkflowConversationContracts";

const conversationStorageKey = "ai-loom-studio.workflow-conversations";

export interface WorkflowConversationSessionStorage {
  load(): WorkflowConversationPersistencePayload | undefined;
  save(payload: WorkflowConversationPersistencePayload): void;
}

export class LocalStorageWorkflowConversationSessionStorage implements WorkflowConversationSessionStorage {
  private readonly key: string;
  private readonly storage?: Pick<Storage, "getItem" | "setItem">;

  constructor(
    key = conversationStorageKey,
    storage = typeof window !== "undefined" ? window.localStorage : undefined,
  ) {
    this.key = key;
    this.storage = storage;
  }

  public load(): WorkflowConversationPersistencePayload | undefined {
    const raw = this.storage?.getItem(this.key);
    if (!raw) {
      return undefined;
    }

    try {
      const parsed = JSON.parse(raw) as WorkflowConversationPersistencePayload;
      if (parsed?.schemaVersion !== "workflow-conversation.v1" || !Array.isArray(parsed.sessions)) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }

  public save(payload: WorkflowConversationPersistencePayload): void {
    this.storage?.setItem(this.key, JSON.stringify(payload));
  }
}

export interface WorkflowConversationCreateFromExecutionInput {
  readonly workflow: IWorkflow;
  readonly request?: Omit<IExecuteWorkflowRequest, "workflow">;
  readonly result: IExecuteWorkflowResult;
  readonly nodeOutputs?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

export interface WorkflowConversationContinueRequest {
  readonly sessionId: string;
  readonly message: string;
}

export interface WorkflowConversationContinueResult {
  readonly session: WorkflowConversationSession;
  readonly execution?: IExecuteWorkflowResult;
}

export class WorkflowConversationSessionService {
  private readonly storage: WorkflowConversationSessionStorage;
  private readonly workflowService: Pick<WorkflowService, "loadWorkflow" | "executeWorkflow">;
  private readonly now: () => Date;
  private readonly createId: (prefix: string) => string;

  constructor(options: {
    readonly workflowService: Pick<WorkflowService, "loadWorkflow" | "executeWorkflow">;
    readonly storage?: WorkflowConversationSessionStorage;
    readonly now?: () => Date;
    readonly createId?: (prefix: string) => string;
  }) {
    this.workflowService = options.workflowService;
    this.storage = options.storage ?? new LocalStorageWorkflowConversationSessionStorage();
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? ((prefix) => `${prefix}-${this.now().getTime()}-${Math.random().toString(36).slice(2, 8)}`);
  }

  public listByWorkflowId(workflowId: string): ReadonlyArray<WorkflowConversationSession> {
    const normalized = workflowId.trim();
    if (!normalized) {
      return Object.freeze([]);
    }

    return Object.freeze(
      this.readSessions()
        .filter((session) => session.metadata.workflowId === normalized)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
  }

  public getById(sessionId: string): WorkflowConversationSession | undefined {
    const normalized = sessionId.trim();
    if (!normalized) {
      return undefined;
    }

    return this.readSessions().find((session) => session.id === normalized);
  }

  public createFromExecution(
    input: WorkflowConversationCreateFromExecutionInput,
  ): WorkflowConversationSession | undefined {
    const eligibility = evaluateWorkflowConversationEligibility({
      workflow: input.workflow,
      request: input.request,
      result: input.result,
      nodeOutputs: input.nodeOutputs,
    });

    if (!eligibility.eligible || !eligibility.seed) {
      return undefined;
    }

    const nowIso = this.now().toISOString();
    const outputConfiguration = eligibility.seed.outputConfiguration;
    const scope = outputConfiguration?.conversationScope ?? "continue-session";
    const existingSession = this.resolveSessionForScope(input.workflow.id, scope);
    const initialExecutionId = input.result.result.executionId;

    const userMessage = this.createMessage({
      role: WorkflowConversationMessageRoles.user,
      content: eligibility.seed.promptText,
      timestamp: nowIso,
      executionId: initialExecutionId,
    });

    const assistantMessage = this.createMessage({
      role: WorkflowConversationMessageRoles.assistant,
      content: eligibility.seed.responseText,
      timestamp: nowIso,
      executionId: initialExecutionId,
    });

    const session = existingSession
      ? this.appendToExistingSession(existingSession, {
          userMessage,
          assistantMessage,
          executionId: initialExecutionId,
          outputConfiguration,
        })
      : this.createSession({
          workflow: input.workflow,
          executionId: initialExecutionId,
          promptBinding: eligibility.seed.promptBinding,
          outputConfiguration,
          userMessage,
          assistantMessage,
          nowIso,
        });

    this.persistSession(session);
    return session;
  }

  public async continueSession(request: WorkflowConversationContinueRequest): Promise<WorkflowConversationContinueResult> {
    const session = this.getById(request.sessionId);
    if (!session) {
      throw new Error(`Workflow conversation session '${request.sessionId}' was not found.`);
    }

    const message = request.message.trim();
    if (!message) {
      throw new Error("Workflow conversation message is required.");
    }

    const workflow = await this.workflowService.loadWorkflow(session.metadata.workflowId);
    if (!workflow) {
      const errored = this.withError(session, `Workflow '${session.metadata.workflowId}' was not found.`);
      this.persistSession(errored);
      return Object.freeze({ session: errored });
    }

    const executionRequest = this.buildContinuationExecutionRequest(workflow, session, message);
    if (!executionRequest) {
      const errored = this.withError(session, "Conversation cannot continue because no prompt binding is configured.");
      this.persistSession(errored);
      return Object.freeze({ session: errored });
    }

    const collectedNodeOutputs: Record<string, Readonly<Record<string, unknown>>> = {};
    const nowIso = this.now().toISOString();
    const userMessage = this.createMessage({
      role: WorkflowConversationMessageRoles.user,
      content: message,
      timestamp: nowIso,
    });

    const running = this.persistSession(this.withAppendedMessage(session, userMessage));

    let execution: IExecuteWorkflowResult | undefined;
    try {
      execution = await this.workflowService.executeWorkflow(
        executionRequest,
        (event) => {
          const outputs = extractNodeOutputs(event);
          if (!outputs) {
            return;
          }
          for (const [nodeId, nodeOutput] of Object.entries(outputs)) {
            collectedNodeOutputs[nodeId] = nodeOutput;
          }
        },
      );

      const response = resolveAssistantResponse(
        collectedNodeOutputs,
        session.metadata.responseField,
      );

      const assistantMessage = this.createMessage({
        role: WorkflowConversationMessageRoles.assistant,
        content: response ?? "Workflow execution completed without a readable assistant response.",
        timestamp: this.now().toISOString(),
        executionId: execution.result.executionId,
      });

      const updated = this.withExecutionUpdate(
        this.withAppendedMessage(running, assistantMessage),
        execution.result.executionId,
      );

      return Object.freeze({
        session: this.persistSession(updated),
        execution,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown workflow continuation error.";
      const assistantErrorMessage = this.createMessage({
        role: WorkflowConversationMessageRoles.system,
        content: `Workflow continuation failed: ${detail}`,
        timestamp: this.now().toISOString(),
      });
      const errored = this.withError(this.withAppendedMessage(running, assistantErrorMessage), detail);
      return Object.freeze({ session: this.persistSession(errored) });
    }
  }

  private buildContinuationExecutionRequest(
    workflow: IWorkflow,
    session: WorkflowConversationSession,
    message: string,
  ): Omit<IExecuteWorkflowRequest, "workflow"> | undefined {
    const binding = session.metadata.promptBinding;
    if (!binding) {
      return undefined;
    }

    const node = workflow.getNode(binding.nodeId);
    const property = node?.getProperty(binding.propertyId);
    if (!node || !property) {
      return undefined;
    }

    return Object.freeze({
      propertyOverrides: Object.freeze({
        [binding.nodeId]: Object.freeze({
          [binding.propertyId]: message,
        }),
      }),
      parameters: Object.freeze({
        workflowConversationOutput: Object.freeze({
          destinationType: session.metadata.destinationType ?? WorkflowDraftOutputDestinationTypes.promptResponseChat,
          responseField: session.metadata.responseField,
          conversationScope: session.metadata.conversationScope,
          title: session.metadata.title,
        }),
      }),
    });
  }

  private resolveSessionForScope(workflowId: string, conversationScope: string): WorkflowConversationSession | undefined {
    if (conversationScope !== "continue-session") {
      return undefined;
    }

    return this.listByWorkflowId(workflowId)
      .find((session) => session.status === WorkflowConversationSessionStatuses.active);
  }

  private createSession(input: {
    readonly workflow: IWorkflow;
    readonly executionId: string;
    readonly promptBinding: WorkflowConversationPromptBinding;
    readonly outputConfiguration?: WorkflowConversationOutputConfiguration;
    readonly userMessage: WorkflowConversationMessage;
    readonly assistantMessage: WorkflowConversationMessage;
    readonly nowIso: string;
  }): WorkflowConversationSession {
    return Object.freeze({
      id: this.createId("wf-chat-session"),
      status: WorkflowConversationSessionStatuses.active,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
      messages: Object.freeze([input.userMessage, input.assistantMessage]),
      metadata: Object.freeze({
        workflowId: input.workflow.id,
        workflowName: input.workflow.metadata.name,
        title: input.outputConfiguration?.title || `${input.workflow.metadata.name} chat`,
        responseField: input.outputConfiguration?.responseField,
        conversationScope: input.outputConfiguration?.conversationScope,
        destinationType: input.outputConfiguration?.destinationType ?? WorkflowDraftOutputDestinationTypes.promptResponseChat,
        promptBinding: Object.freeze({ ...input.promptBinding }),
        latestExecutionId: input.executionId,
        executionIds: Object.freeze([input.executionId]),
      }),
      lastError: undefined,
    });
  }

  private appendToExistingSession(
    session: WorkflowConversationSession,
    input: {
      readonly userMessage: WorkflowConversationMessage;
      readonly assistantMessage: WorkflowConversationMessage;
      readonly executionId: string;
      readonly outputConfiguration?: WorkflowConversationOutputConfiguration;
    },
  ): WorkflowConversationSession {
    return Object.freeze({
      ...session,
      status: WorkflowConversationSessionStatuses.active,
      updatedAt: this.now().toISOString(),
      messages: Object.freeze([...session.messages, input.userMessage, input.assistantMessage]),
      metadata: Object.freeze({
        ...session.metadata,
        title: input.outputConfiguration?.title || session.metadata.title,
        conversationScope: input.outputConfiguration?.conversationScope || session.metadata.conversationScope,
        responseField: input.outputConfiguration?.responseField || session.metadata.responseField,
        destinationType: input.outputConfiguration?.destinationType || session.metadata.destinationType,
        latestExecutionId: input.executionId,
        executionIds: Object.freeze([...session.metadata.executionIds, input.executionId]),
      }),
      lastError: undefined,
    });
  }

  private withExecutionUpdate(session: WorkflowConversationSession, executionId: string): WorkflowConversationSession {
    return Object.freeze({
      ...session,
      status: WorkflowConversationSessionStatuses.active,
      updatedAt: this.now().toISOString(),
      metadata: Object.freeze({
        ...session.metadata,
        latestExecutionId: executionId,
        executionIds: Object.freeze([...session.metadata.executionIds, executionId]),
      }),
      lastError: undefined,
    });
  }

  private withAppendedMessage(
    session: WorkflowConversationSession,
    message: WorkflowConversationMessage,
  ): WorkflowConversationSession {
    return Object.freeze({
      ...session,
      status: WorkflowConversationSessionStatuses.active,
      updatedAt: message.timestamp,
      messages: Object.freeze([...session.messages, message]),
      lastError: undefined,
    });
  }

  private withError(session: WorkflowConversationSession, errorMessage: string): WorkflowConversationSession {
    return Object.freeze({
      ...session,
      status: WorkflowConversationSessionStatuses.errored,
      updatedAt: this.now().toISOString(),
      lastError: errorMessage,
    });
  }

  private createMessage(input: {
    readonly role: WorkflowConversationMessage["role"];
    readonly content: string;
    readonly timestamp: string;
    readonly executionId?: string;
  }): WorkflowConversationMessage {
    return Object.freeze({
      id: this.createId("wf-chat-message"),
      role: input.role,
      content: input.content.trim(),
      timestamp: input.timestamp,
      executionId: input.executionId,
    });
  }

  private readSessions(): ReadonlyArray<WorkflowConversationSession> {
    const payload = this.storage.load();
    if (!payload?.sessions?.length) {
      return Object.freeze([]);
    }

    const sessions: WorkflowConversationSession[] = [];
    for (const rawSession of payload.sessions) {
      if (!isWorkflowConversationSession(rawSession)) {
        continue;
      }

      sessions.push(Object.freeze({
        ...rawSession,
        messages: Object.freeze([...(rawSession.messages ?? [])]),
        metadata: Object.freeze({
          ...rawSession.metadata,
          executionIds: Object.freeze([...(rawSession.metadata.executionIds ?? [])]),
        }),
      }));
    }

    return Object.freeze(sessions);
  }

  private persistSession(session: WorkflowConversationSession): WorkflowConversationSession {
    const sessions = this.readSessions();
    const existingIndex = sessions.findIndex((candidate) => candidate.id === session.id);
    const nextSessions = existingIndex === -1
      ? [...sessions, session]
      : sessions.map((candidate) => (candidate.id === session.id ? session : candidate));

    const payload: WorkflowConversationPersistencePayload = Object.freeze({
      schemaVersion: "workflow-conversation.v1",
      sessions: Object.freeze(nextSessions),
    });

    this.storage.save(payload);
    return session;
  }
}

function extractNodeOutputs(event: IWorkflowExecutionEvent): Readonly<Record<string, Readonly<Record<string, unknown>>>> | undefined {
  if (!event.payload || typeof event.payload !== "object" || !("nodeOutputs" in event.payload)) {
    return undefined;
  }

  return event.payload.nodeOutputs as Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}

function isWorkflowConversationMessage(value: unknown): value is WorkflowConversationMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return typeof record.id === "string"
    && typeof record.role === "string"
    && typeof record.content === "string"
    && typeof record.timestamp === "string";
}

function isWorkflowConversationSession(value: unknown): value is WorkflowConversationSession {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || typeof record.createdAt !== "string" || typeof record.updatedAt !== "string") {
    return false;
  }
  if (!Array.isArray(record.messages) || !record.messages.every((message) => isWorkflowConversationMessage(message))) {
    return false;
  }

  const metadata = record.metadata;
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  const metadataRecord = metadata as Record<string, unknown>;
  if (
    typeof metadataRecord.workflowId !== "string"
    || typeof metadataRecord.workflowName !== "string"
    || typeof metadataRecord.title !== "string"
  ) {
    return false;
  }
  if (!Array.isArray(metadataRecord.executionIds) || !metadataRecord.executionIds.every((entry) => typeof entry === "string")) {
    return false;
  }

  return true;
}

function normalizeOptionalContent(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized || undefined;
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

function resolveAssistantResponse(
  nodeOutputs: Readonly<Record<string, Readonly<Record<string, unknown>>>>,
  responseField?: string,
): string | undefined {
  const fallbackFields = [
    "assistant-response",
    "assistantResponse",
    "response",
    "resultText",
    "output",
    "result",
    "text",
    "answer",
  ] as const;

  const entries = Object.entries(nodeOutputs);
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const output = entries[index]?.[1];
    if (!output) {
      continue;
    }

    if (responseField) {
      const preferred = normalizeOptionalContent(output[responseField]);
      if (preferred) {
        return preferred;
      }
    }

    for (const field of fallbackFields) {
      const value = normalizeOptionalContent(output[field]);
      if (value) {
        return value;
      }
    }
  }

  return undefined;
}

