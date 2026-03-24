import type { IModelExecutor } from "../../../application/ports/interfaces/IModelExecutor";
import type { INodeExecutor, INodeExecutionResult } from "../../../application/ports/interfaces/INodeExecutor";
import type { INodeExecutionContext } from "../../../application/ports/interfaces/INodeExecutionContextResolver";
import type { IMcpRuntimeClient } from "../../../application/ports/interfaces/IMcpRuntimeClient";
import type { IMcpServerCatalog } from "../../../application/ports/interfaces/IMcpServerCatalog";
import type { IPythonRuntimeClient } from "../../../application/ports/interfaces/IPythonRuntimeClient";
import { InspectContextAssemblyUseCase } from "../../../application/context/InspectContextAssemblyUseCase";
import type { IAssembledContextFragment } from "../../../application/context/models/AssembledContext";
import type { ContextFragmentKind } from "../../../application/context/models/ContextFragment";
import type { IContextBudget } from "../../../application/context/models/ContextBudget";
import type { IContextTrimmingPolicy } from "../../../application/context/models/ContextTrimmingPolicy";
import { deriveMcpExecutionProvenance } from "../../../application/execution/ExecutionTruth";
import { ExecuteMcpToolUseCase } from "../../../application/mcp/ExecuteMcpToolUseCase";
import {
  McpToolCallNodeConfigurationService,
  MCP_TOOL_CALL_TOOL_ID_PROPERTY,
} from "../../../application/mcp/McpToolCallNodeConfigurationService";
import { McpToolRegistryError } from "../../../application/mcp/registry/McpToolRegistryErrors";
import type { McpToolPermissionScope } from "../../../domain/mcp/McpToolTrust";
import type { INode } from "../../../domain/nodes/interfaces/INode";
import type {
  ChatMessage,
  Document,
  ToolCall,
  ToolDefinition,
} from "../../../domain/nodes/WorkflowDataTypes";

interface UploadedDocument {
  readonly name?: string;
  readonly text?: string;
  readonly type?: string;
  readonly size?: number;
  readonly error?: string;
}

interface ChunkRecord {
  readonly index?: number;
  readonly text: string;
  readonly score?: number;
}

interface ToolRuntimeDefinition extends ToolDefinition {
  readonly strictSchema?: boolean;
  readonly handler?: unknown;
}

const messageHistoryStore = new Map<string, ChatMessage[]>();
const inspectContextAssemblyUseCase = new InspectContextAssemblyUseCase();
const mcpToolCallNodeConfigurationService = new McpToolCallNodeConfigurationService();

interface ContextControlSettings {
  readonly trimmingPolicy: IContextTrimmingPolicy;
  readonly budget: IContextBudget;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean))];
}

function resolveContextControlSettings(properties: Record<string, unknown>): ContextControlSettings {
  return {
    trimmingPolicy: {
      visibilityMode: properties.visibilityMode === "basic" ? "basic" : "advanced",
      includeKinds: toStringArray(properties.includeFragmentKinds) as ContextFragmentKind[],
      excludeKinds: toStringArray(properties.excludeFragmentKinds) as ContextFragmentKind[],
      includeSources: toStringArray(properties.includeSources),
      excludeSources: toStringArray(properties.excludeSources),
    },
    budget: {
      maxCharacters:
        properties.maxLength !== undefined && Number.isFinite(Number(properties.maxLength))
          ? Math.max(0, Number(properties.maxLength))
          : undefined,
      maxTokens:
        properties.maxTokens !== undefined && Number.isFinite(Number(properties.maxTokens)) && Number(properties.maxTokens) > 0
          ? Math.max(0, Number(properties.maxTokens))
          : undefined,
      approximateCharactersPerToken:
        properties.approximateCharactersPerToken !== undefined &&
        Number.isFinite(Number(properties.approximateCharactersPerToken))
          ? Math.max(1, Number(properties.approximateCharactersPerToken))
          : undefined,
      trimPartialFragments: properties.trimPartialFragments !== false,
      separator: "\n\n",
    },
  };
}

function createContextFragmentsFromDocuments(
  documents: ReadonlyArray<Document>,
  template: string
): ReadonlyArray<{
  readonly id: string;
  readonly kind: "retrieved-context";
  readonly title?: string;
  readonly content: string;
  readonly order: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}> {
  return Object.freeze(
    documents.map((document, index) => ({
      id: document.id || `doc-${index + 1}`,
      kind: "retrieved-context" as const,
      title: typeof document.metadata?.title === "string" ? document.metadata.title : undefined,
      content: template
        .replace(/\{index\}/g, String(index + 1))
        .replace(/\{content\}/g, document.text)
        .replace(/\{text\}/g, document.text)
        .replace(/\{metadata\}/g, document.metadata ? stringifyValue(document.metadata) : "{}"),
      order: index,
      metadata: document.metadata ? Object.freeze({ ...document.metadata }) : undefined,
    }))
  );
}

function readProperty(node: INode, propertyId: string): unknown {
  return node.properties.find((property) => property.id === propertyId)?.value;
}

function resolveWorkflowContextRecord(
  executionMetadata?: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> | undefined {
  const workflowContext = executionMetadata?.workflowContext;
  return workflowContext && typeof workflowContext === "object"
    ? (workflowContext as Record<string, unknown>)
    : undefined;
}

function resolveWorkflowContextText(
  executionMetadata?: Readonly<Record<string, unknown>>
): string {
  const workflowContext = resolveWorkflowContextRecord(executionMetadata);
  const inspection =
    workflowContext?.inspection && typeof workflowContext.inspection === "object"
      ? (workflowContext.inspection as Record<string, unknown>)
      : undefined;
  if (typeof inspection?.finalPromptText === "string" && inspection.finalPromptText.trim()) {
    return inspection.finalPromptText.trim();
  }

  if (typeof workflowContext?.promptText === "string" && workflowContext.promptText.trim()) {
    return workflowContext.promptText.trim();
  }

  const assembledContext =
    workflowContext?.assembledContext && typeof workflowContext.assembledContext === "object"
      ? (workflowContext.assembledContext as Record<string, unknown>)
      : undefined;
  return typeof assembledContext?.promptText === "string" ? assembledContext.promptText.trim() : "";
}

function normalizeText(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (value && typeof value === "object" && "text" in (value as Record<string, unknown>)) {
    const text = (value as Record<string, unknown>).text;
    return typeof text === "string" ? text : JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).join("\n\n");
  }

  if (value === undefined || value === null) {
    return "";
  }

  return String(value);
}

function toChunkRecords(value: unknown): ChunkRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const chunks: ChunkRecord[] = [];

  value.forEach((item, index) => {
    if (typeof item === "string") {
      if (item.trim().length > 0) {
        chunks.push({ index, text: item });
      }
      return;
    }

    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const directText = record.text;
      const nestedMetadata = record.metadata as Record<string, unknown> | undefined;
      const nestedText = nestedMetadata?.text;
      const text = typeof directText === "string" ? directText : nestedText;
      if (typeof text === "string" && text.trim().length > 0) {
        chunks.push({
          index: typeof record.index === "number" ? (record.index as number) : index,
          text,
          score: typeof record.score === "number" ? record.score : undefined,
        });
      }
    }
  });

  return chunks;
}

function toDocuments(value: unknown): Document[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    if (typeof item === "string") {
      return item.trim().length > 0
        ? [{ id: `doc-${index + 1}`, text: item, metadata: {} } satisfies Document]
        : [];
    }

    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const nestedDocument =
      record.document && typeof record.document === "object"
        ? (record.document as Record<string, unknown>)
        : undefined;
    const text =
      typeof record.text === "string"
        ? record.text
        : typeof record.content === "string"
          ? record.content
        : typeof nestedDocument?.text === "string"
          ? (nestedDocument.text as string)
          : normalizeText(record);
    if (!text.trim()) {
      return [];
    }

    const metadata =
      record.metadata && typeof record.metadata === "object"
        ? (record.metadata as Record<string, unknown>)
        : nestedDocument?.metadata && typeof nestedDocument.metadata === "object"
          ? (nestedDocument.metadata as Record<string, unknown>)
        : undefined;

    return [
      {
        id:
          typeof record.id === "string"
            ? record.id
            : typeof nestedDocument?.id === "string"
              ? (nestedDocument.id as string)
              : `doc-${index + 1}`,
        text,
        metadata,
      } satisfies Document,
    ];
  });
}

function toChatMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const role = record.role;
    const content = record.content;
    if (
      (role === "system" || role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim().length > 0
    ) {
      return [{ role, content } satisfies ChatMessage];
    }

    return [];
  });
}

function toToolDefinitions(value: unknown): ToolRuntimeDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }

    const record = item as Record<string, unknown>;
    const name = record.name;
    const description = record.description;

    if (typeof name !== "string" || typeof description !== "string") {
      return [];
    }

    return [
      {
        name,
        description,
        inputSchema:
          record.inputSchema && typeof record.inputSchema === "object"
            ? (record.inputSchema as Record<string, unknown>)
            : undefined,
        strictSchema:
          typeof record.strictSchema === "boolean" ? record.strictSchema : undefined,
        handler: record.handler,
      } satisfies ToolRuntimeDefinition,
    ];
  });
}

function ensureObjectRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function trimCodeFence(value: string): string {
  const trimmed = value.trim();
  const codeFenceMatch = trimmed.match(/^```(?:[a-z0-9_-]+)?\s*([\s\S]*?)\s*```$/i);
  return codeFenceMatch ? codeFenceMatch[1].trim() : trimmed;
}

function coerceScalarValue(value: string): string | number | boolean {
  const normalized = value.trim();

  if (/^-?\d+(?:\.\d+)?$/.test(normalized)) {
    return Number(normalized);
  }

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return normalized;
}

function parseKeyValueText(
  value: string,
  coerceNumbers: boolean
): Record<string, unknown> {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .reduce<Record<string, unknown>>((record, line) => {
      const separatorIndex = line.indexOf(":");
      if (separatorIndex < 0) {
        return record;
      }

      const key = line.slice(0, separatorIndex).trim();
      const rawValue = line.slice(separatorIndex + 1).trim();
      if (!key) {
        return record;
      }

      record[key] = coerceNumbers ? coerceScalarValue(rawValue) : rawValue;
      return record;
    }, {});
}

function mergeObjectRecords(
  baseValue: unknown,
  overrideValue: unknown
): Record<string, unknown> {
  return {
    ...ensureObjectRecord(baseValue),
    ...ensureObjectRecord(overrideValue),
  };
}

function dedupeConsecutiveMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.reduce<ChatMessage[]>((accumulator, message) => {
    const previous = accumulator.at(-1);
    if (
      previous &&
      previous.role === message.role &&
      previous.content === message.content
    ) {
      return accumulator;
    }

    accumulator.push(message);
    return accumulator;
  }, []);
}

function getRequiredToolArgumentNames(tool: ToolRuntimeDefinition): string[] {
  const schema = ensureObjectRecord(tool.inputSchema);
  const required = schema.required;
  if (!Array.isArray(required)) {
    return [];
  }

  return required.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function toToolCall(value: unknown): ToolCall | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  if (!name) {
    return undefined;
  }

  const argumentsValue = record.arguments ?? record.args;
  return {
    name,
    arguments: ensureObjectRecord(argumentsValue),
  } satisfies ToolCall;
}

function pickToolForTask(task: string, tools: readonly ToolRuntimeDefinition[]): ToolRuntimeDefinition | undefined {
  if (tools.length === 0) {
    return undefined;
  }

  const normalizedTask = task.toLowerCase();
  const exact = tools.find((tool) => normalizedTask.includes(tool.name.toLowerCase()));
  if (exact) {
    return exact;
  }

  const keywordTriggered = tools.find((tool) => {
    const description = tool.description.toLowerCase();
    return ["search", "find", "lookup", "retrieve", "tool"].some(
      (keyword) => normalizedTask.includes(keyword) && description.includes(keyword)
    );
  });

  return keywordTriggered ?? tools[0];
}

function buildDeterministicToolResult(options: {
  readonly tool: ToolRuntimeDefinition;
  readonly argumentsRecord: Record<string, unknown>;
}): {
  readonly toolCall: ToolCall;
  readonly toolResult: Readonly<Record<string, unknown>>;
  readonly resultText: string;
  readonly missingRequiredArguments: ReadonlyArray<string>;
} {
  const { tool, argumentsRecord } = options;
  const missingRequiredArguments = getRequiredToolArgumentNames(tool).filter(
    (name) => argumentsRecord[name] === undefined || argumentsRecord[name] === null || normalizeText(argumentsRecord[name]).trim() === ""
  );
  const primaryInput = normalizeText(
    argumentsRecord.input ?? argumentsRecord.query ?? argumentsRecord.request ?? argumentsRecord.text
  ).trim();
  const toolCall = {
    name: tool.name,
    arguments: argumentsRecord,
  } satisfies ToolCall;
  const toolResult = {
    toolName: tool.name,
    arguments: argumentsRecord,
    missingRequiredArguments,
    status: missingRequiredArguments.length > 0 ? "missing-required-arguments" : "completed",
    output:
      primaryInput || Object.keys(argumentsRecord).length > 0
        ? `${tool.description} :: ${primaryInput || stringifyValue(argumentsRecord)}`
        : `${tool.description} :: no arguments provided`,
  } as const;

  return {
    toolCall,
    toolResult,
    resultText: stringifyValue(toolResult),
    missingRequiredArguments,
  };
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function scoreText(query: string, candidate: string): number {
  const queryTokens = tokenize(query);
  const candidateTokens = new Set(tokenize(candidate));

  if (queryTokens.length === 0 || candidateTokens.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of queryTokens) {
    if (candidateTokens.has(token)) {
      matches += 1;
    }
  }

  return matches / queryTokens.length;
}

function buildEmbeddingVector(text: string, dimensions: number, normalizeVectors: boolean): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  const source = text || " ";

  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    vector[index % dimensions] += (code % 97) / 100;
  }

  if (!normalizeVectors) {
    return vector;
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function splitTextIntoChunks(text: string, chunkSize: number, chunkOverlap: number): string[] {
  const safeChunkSize = Math.max(1, chunkSize);
  const safeChunkOverlap = Math.max(0, Math.min(chunkOverlap, safeChunkSize - 1));
  const step = Math.max(1, safeChunkSize - safeChunkOverlap);
  const chunks: string[] = [];

  for (let cursor = 0; cursor < text.length; cursor += step) {
    const chunk = text.slice(cursor, cursor + safeChunkSize).trim();
    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

function supportsNodeType(nodeType: string, ...types: string[]): boolean {
  return types.includes(nodeType);
}

function deriveMcpErrorCategory(code: string): "permission" | "auth" | "contract" | "asset" | "runtime" {
  switch (code) {
    case "permission-denied":
    case "approval-required":
    case "sandbox-denied":
      return "permission";
    case "missing-auth-configuration":
    case "auth-resolution-failed":
      return "auth";
    case "invalid-input-contract":
    case "invalid-output-contract":
      return "contract";
    case "asset-input-resolution-failed":
    case "asset-output-persistence-failed":
      return "asset";
    default:
      return "runtime";
  }
}

function createMcpError(options: {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  return Object.freeze({
    code: options.code,
    category: deriveMcpErrorCategory(options.code),
    message: options.message,
    details: options.details,
  });
}

function nodePropertiesToObject(node: INode): Readonly<Record<string, unknown>> {
  return Object.freeze(
    Object.fromEntries(node.properties.map((property) => [property.id, property.value]))
  );
}

function normalizePythonOutputs(
  nodeType: string,
  outputs: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  if (supportsNodeType(nodeType, "langchain.similarity_search", "langchain.vector_store_upsert")) {
    return {
      ...outputs,
      documents: outputs.documents !== undefined ? toDocuments(outputs.documents) : outputs.documents,
    };
  }

  if (supportsNodeType(nodeType, "langchain.summarization")) {
    return {
      ...outputs,
      summary: normalizeText(outputs.summary),
    };
  }

  if (supportsNodeType(nodeType, "langchain.combine_summaries")) {
    return {
      ...outputs,
      combinedSummary:
        outputs.combinedSummary !== undefined
          ? normalizeText(outputs.combinedSummary)
          : outputs.summary !== undefined
            ? normalizeText(outputs.summary)
            : "",
    };
  }

  return outputs;
}

export class LangChainNodeExecutor implements INodeExecutor {
  private readonly modelExecutor?: IModelExecutor;
  private readonly pythonRuntimeClient?: IPythonRuntimeClient;
  private readonly mcpRuntimeClient?: IMcpRuntimeClient;
  private readonly mcpServerCatalog?: IMcpServerCatalog;
  private readonly executeMcpToolUseCase?: ExecuteMcpToolUseCase;

  constructor(
    modelExecutorOrOptions?:
      | IModelExecutor
      | {
          readonly modelExecutor?: IModelExecutor;
          readonly pythonRuntimeClient?: IPythonRuntimeClient;
          readonly mcpRuntimeClient?: IMcpRuntimeClient;
          readonly mcpServerCatalog?: IMcpServerCatalog;
          readonly executeMcpToolUseCase?: ExecuteMcpToolUseCase;
        },
    pythonRuntimeClient?: IPythonRuntimeClient
  ) {
    if (
      modelExecutorOrOptions &&
      typeof modelExecutorOrOptions === "object" &&
      ("modelExecutor" in modelExecutorOrOptions ||
        "pythonRuntimeClient" in modelExecutorOrOptions ||
        "mcpRuntimeClient" in modelExecutorOrOptions ||
        "mcpServerCatalog" in modelExecutorOrOptions)
    ) {
      this.modelExecutor = modelExecutorOrOptions.modelExecutor;
      this.pythonRuntimeClient = modelExecutorOrOptions.pythonRuntimeClient;
      this.mcpRuntimeClient = modelExecutorOrOptions.mcpRuntimeClient;
      this.mcpServerCatalog = modelExecutorOrOptions.mcpServerCatalog;
      this.executeMcpToolUseCase = modelExecutorOrOptions.executeMcpToolUseCase;
      return;
    }

    this.modelExecutor = modelExecutorOrOptions as IModelExecutor | undefined;
    this.pythonRuntimeClient = pythonRuntimeClient;
  }

  public canExecuteNode(node: INode, runtime = "langchain"): boolean {
    const nodeRuntime = node.executionProfile?.runtime?.toLowerCase();
    if (nodeRuntime && nodeRuntime !== runtime.toLowerCase()) {
      return false;
    }

    return node.isEnabled;
  }

  public async executeNode(context: INodeExecutionContext): Promise<INodeExecutionResult> {
    if (!this.canExecuteNode(context.node)) {
      return {
        nodeId: context.node.id,
        status: "skipped",
        outputs: {},
        messages: [`Node '${context.node.id}' skipped due to runtime or enabled-state mismatch.`],
        provenance: {
          classification: "unavailable",
          runtime: "langchain",
          executorId: "langchain-node-executor",
          detail: "Node skipped because it could not run in the current runtime/profile.",
        },
      };
    }

    if (context.node.isModelAware() && this.modelExecutor) {
      const modelResult = await this.modelExecutor.execute({
        node: context.node,
        runtime: "langchain",
        inputs: context.resolvedInputs,
        parameters: context.workflowInputs,
      });

      return {
        nodeId: context.node.id,
        status: modelResult.status === "completed" ? "completed" : "failed",
        outputs: modelResult.outputs,
        messages: modelResult.messages,
        errorMessage: modelResult.errorMessage,
        provenance: {
          classification: modelResult.status === "completed" ? "real" : "unavailable",
          runtime: "langchain",
          executorId: "model-executor",
          detail: modelResult.status === "completed"
            ? "Node completed through the configured model executor."
            : "Configured model executor could not complete the node.",
        },
      };
    }

    const nodeType = context.node.definition.type.toLowerCase();
    const inputs = context.resolvedInputs as Record<string, unknown>;
    const properties = Object.fromEntries(
      context.node.properties.map((property) => [property.id, property.value])
    );

    if (
      this.pythonRuntimeClient &&
      supportsNodeType(
        nodeType,
        "langchain.vector_store_upsert",
        "langchain.similarity_search",
        "langchain.context_formatter",
        "langchain.summarization",
        "langchain.combine_summaries"
      )
    ) {
      const response = await this.pythonRuntimeClient.executeNode({
        workflowId: context.workflow.id,
        nodeId: context.node.id,
        nodeType: context.node.definition.type,
        inputs,
        properties: nodePropertiesToObject(context.node),
        context: {
          workflowInputs: context.workflowInputs,
          upstreamOutputs: context.upstreamOutputs,
        },
      });

      return {
        nodeId: response.nodeId,
        status: response.status,
        outputs: normalizePythonOutputs(nodeType, response.outputs),
        messages: response.messages,
        errorMessage: response.errorMessage,
        provenance: {
          classification: response.status === "completed" ? "delegated" : "unavailable",
          runtime: "python",
          executorId: "python-runtime-node-bridge",
          detail: response.status === "completed"
            ? "Node execution was delegated to the Python runtime."
            : "Python runtime could not complete delegated node execution.",
        },
      };
    }

    if (nodeType === "mcp.server_select") {
      const serverId = String(inputs.selection ?? properties["serverId"] ?? "").trim();
      if (!serverId) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {
            mcpError: createMcpError({
              code: "invalid-input-contract",
              message: "MCP server selection requires a configured server id.",
              details: Object.freeze({ nodeType: context.node.definition.type }),
            }),
          },
          messages: ["MCP server selection requires a configured server id."],
          errorMessage: "MCP server selection requires a configured server id.",
          provenance: {
            classification: "unavailable",
            runtime: "python",
            executorId: "mcp-runtime-bridge",
            detail: "MCP server selection could not resolve a configured server id.",
            nodeType: context.node.definition.type,
            mcp: deriveMcpExecutionProvenance({ serverId, detail: "No configured MCP server id was available." }),
          },
        };
      }

      const serverStatus = this.mcpServerCatalog ? await this.mcpServerCatalog.getServerStatus(serverId) : undefined;
      const mcp = deriveMcpExecutionProvenance({ serverStatus, serverId, detail: serverStatus?.errorMessage });
      return {
        nodeId: context.node.id,
        status: mcp.status === "unavailable" ? "failed" : "completed",
        outputs: {
          serverHandle: { serverId, status: serverStatus?.state ?? "unknown", sessionState: serverStatus?.sessionState ?? "disconnected" },
          connectionStatus: serverStatus ?? { serverId, state: "disconnected", connected: false, checkedAt: new Date().toISOString() },
        },
        messages: [mcp.status === "live" ? `Selected MCP server '${serverId}'.` : `Selected MCP server '${serverId}' in ${mcp.status} state.`],
        errorMessage: mcp.status === "unavailable" ? `MCP server '${serverId}' is unavailable.` : undefined,
        provenance: {
          classification: mcp.status === "live" ? "delegated" : mcp.status === "stale" ? "hybrid" : "unavailable",
          runtime: "python",
          executorId: "mcp-runtime-bridge",
          detail: mcp.status === "live" ? "MCP server selection was resolved against the live runtime session." : `MCP server selection resolved with ${mcp.status} runtime state.`,
          nodeType: context.node.definition.type,
          mcp,
        },
      };
    }

    if (nodeType === "mcp.tool_catalog") {
      const serverId = String((inputs.serverHandle as Record<string, unknown> | undefined)?.serverId ?? properties["serverId"] ?? "").trim();
      if (!serverId || !this.mcpRuntimeClient) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {
            mcpError: createMcpError({
              code: "execution-failed",
              message: "MCP tool discovery is unavailable.",
              details: Object.freeze({ serverId, hasRuntimeClient: Boolean(this.mcpRuntimeClient) }),
            }),
          },
          messages: ["MCP tool discovery requires the runtime-backed MCP client and a selected server."],
          errorMessage: "MCP tool discovery is unavailable.",
          provenance: {
            classification: "unavailable",
            runtime: "python",
            executorId: "mcp-runtime-bridge",
            detail: "MCP tool discovery could not reach the runtime-backed MCP catalog.",
            nodeType: context.node.definition.type,
            mcp: deriveMcpExecutionProvenance({ serverId, detail: "MCP runtime client is unavailable." }),
          },
        };
      }
      const status = this.mcpServerCatalog ? await this.mcpServerCatalog.getServerStatus(serverId) : undefined;
      const toolQuery = String(properties["query"] ?? "").trim() || undefined;
      const result = await this.mcpRuntimeClient.searchTools({ query: toolQuery, serverIds: [serverId], limit: 50 });
      const tools = result.tools.filter((tool) => tool.serverId === serverId);
      const mcp = deriveMcpExecutionProvenance({ serverStatus: status, serverId, detail: status?.errorMessage });
      return {
        nodeId: context.node.id,
        status: mcp.status === "unavailable" ? "failed" : "completed",
        outputs: { tools, serverId, connectionStatus: status },
        messages: [`Discovered ${tools.length} MCP tool(s) for '${serverId}'.`],
        errorMessage: mcp.status === "unavailable" ? `MCP server '${serverId}' is unavailable.` : undefined,
        provenance: {
          classification: mcp.status === "live" ? "delegated" : mcp.status === "stale" ? "hybrid" : "unavailable",
          runtime: "python",
          executorId: "mcp-runtime-bridge",
          detail: "MCP tool discovery was resolved against the runtime-backed catalog.",
          nodeType: context.node.definition.type,
          mcp,
        },
      };
    }

    if (nodeType === "mcp.tool_call") {
      const serverHandle = (inputs.serverHandle as Record<string, unknown> | undefined);
      const serverId = String(serverHandle?.serverId ?? properties["serverId"] ?? "").trim();
      const descriptorFromInput = inputs.tool && typeof inputs.tool === "object" ? inputs.tool as Record<string, unknown> : undefined;
      const toolDescriptor = descriptorFromInput?.serverId && descriptorFromInput?.name
        ? descriptorFromInput as never
        : mcpToolCallNodeConfigurationService.readStoredToolDescriptor(context.node);
      const toolName = String(toolDescriptor?.name ?? properties["toolName"] ?? "").trim();
      const configuredToolId = String(properties[MCP_TOOL_CALL_TOOL_ID_PROPERTY] ?? "").trim();
      const derivedToolId = serverId && toolName ? `mcp:${encodeURIComponent(serverId)}:${encodeURIComponent(toolName)}` : "";
      if (!serverId || !toolName || (!this.mcpRuntimeClient && !this.executeMcpToolUseCase)) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {
            mcpError: createMcpError({
              code: "execution-failed",
              message: "MCP tool execution is unavailable.",
              details: Object.freeze({
                serverId,
                toolName,
                hasRuntimeClient: Boolean(this.mcpRuntimeClient),
                hasUseCaseExecutor: Boolean(this.executeMcpToolUseCase),
              }),
            }),
          },
          messages: ["MCP tool execution requires a runtime-backed MCP client, server id, and tool name."],
          errorMessage: "MCP tool execution is unavailable.",
          provenance: {
            classification: "unavailable",
            runtime: "python",
            executorId: "mcp-runtime-bridge",
            detail: "MCP tool execution could not be prepared truthfully.",
            nodeType: context.node.definition.type,
            mcp: deriveMcpExecutionProvenance({ serverId, toolName, detail: "Missing server id, tool name, or MCP runtime client." }),
          },
        };
      }
      const serverStatus = this.mcpServerCatalog ? await this.mcpServerCatalog.getServerStatus(serverId) : undefined;
      if (configuredToolId && derivedToolId && configuredToolId !== derivedToolId) {
        return {
          nodeId: context.node.id,
          status: "failed",
            outputs: {
              mcpError: createMcpError({
                code: "tool-identity-mismatch",
                message: "Configured MCP tool identity does not match current server/tool selection.",
                details: Object.freeze({ configuredToolId, derivedToolId, serverId, toolName }),
              }),
            },
          messages: ["Configured MCP tool identity does not match selected server/tool."],
          errorMessage: "Configured MCP tool identity mismatch.",
          provenance: {
            classification: "unavailable",
            runtime: "python",
            executorId: "mcp-runtime-bridge",
            detail: "MCP tool execution was blocked by workflow-level identity mismatch validation.",
            nodeType: context.node.definition.type,
            mcp: deriveMcpExecutionProvenance({ serverStatus, toolDescriptor: toolDescriptor as never, serverId, toolName }),
          },
        };
      }
      const configuredArgs = mcpToolCallNodeConfigurationService.serializeConfiguredArguments(context.node);
      const inputArgs = inputs.arguments && typeof inputs.arguments === "object" ? inputs.arguments as Record<string, unknown> : {};
      const argumentsRecord = Object.freeze({ ...configuredArgs, ...inputArgs });
      const failOnMissingArgs = properties["failOnMissingArgs"] !== false;
      if (failOnMissingArgs) {
        const requiredArguments = (toolDescriptor?.arguments ?? []).filter((argument) => argument.required);
        const missingArguments = requiredArguments
          .filter((argument) => argumentsRecord[argument.name] === undefined)
          .map((argument) => argument.name);
        if (missingArguments.length > 0) {
          return {
            nodeId: context.node.id,
            status: "failed",
            outputs: {
              mcpError: createMcpError({
                code: "missing-required-arguments",
                message: "MCP tool arguments are missing required fields.",
                details: Object.freeze({ serverId, toolName, missingArguments }),
              }),
            },
            messages: [`MCP tool '${toolName}' is missing required arguments: ${missingArguments.join(", ")}.`],
            errorMessage: "MCP tool arguments are missing required fields.",
            provenance: {
              classification: "unavailable",
              runtime: "python",
              executorId: "mcp-runtime-bridge",
              detail: "MCP tool execution was blocked by local required-argument validation.",
              nodeType: context.node.definition.type,
              mcp: deriveMcpExecutionProvenance({ serverStatus, toolDescriptor: toolDescriptor as never, serverId, toolName }),
            },
          };
        }
      }
      const mcp = deriveMcpExecutionProvenance({ serverStatus, toolDescriptor: toolDescriptor as never, serverId, toolName });
      try {
        const execution = this.executeMcpToolUseCase
          ? await this.executeMcpToolUseCase.execute({
              toolId: configuredToolId || derivedToolId || undefined,
              serverId,
              toolName,
              arguments: argumentsRecord,
              context: context.executionMetadata?.workflowContext as never,
              runtimePermissions: Array.isArray(context.executionMetadata?.runtimePermissions)
                ? (context.executionMetadata?.runtimePermissions as ReadonlyArray<McpToolPermissionScope>)
                : undefined,
              metadata: context.executionMetadata,
            })
          : await this.mcpRuntimeClient.executeTool({ serverId, toolName, arguments: argumentsRecord, metadata: context.executionMetadata });
        const stringifyResult = properties["stringifyResult"] !== false;
        const renderedResult = stringifyResult ? JSON.stringify(execution.structuredContent ?? execution.content, null, 2) : undefined;
        const isCompleted = execution.status === "completed";
        const failedMessage = execution.errorMessage ?? `MCP tool '${toolName}' failed.`;
        return {
          nodeId: context.node.id,
          status: isCompleted ? "completed" : "failed",
          outputs: isCompleted
            ? {
                toolResult: execution,
                result: execution,
                structuredResult: execution.structuredContent ?? {},
                resultText: renderedResult,
                textResult: renderedResult,
              }
            : {
                mcpError: createMcpError({
                  code: "execution-failed",
                  message: failedMessage,
                  details: Object.freeze({ serverId, toolName, executionId: execution.executionId }),
                }),
              },
          messages: isCompleted ? [`Executed MCP tool '${toolName}'.`] : [failedMessage],
          errorMessage: isCompleted ? undefined : failedMessage,
          provenance: {
            classification: isCompleted && mcp.status === "live" ? "delegated" : isCompleted && mcp.status === "stale" ? "hybrid" : "unavailable",
            runtime: "python",
            executorId: "mcp-runtime-bridge",
            detail: isCompleted ? "MCP tool execution was delegated to the live runtime-backed MCP session." : "MCP tool execution failed in the runtime-backed MCP session.",
            nodeType: context.node.definition.type,
            mcp,
          },
        };
      } catch (error) {
        const registryError =
          error instanceof McpToolRegistryError
            ? error
            : error && typeof error === "object" && "code" in error && typeof (error as { code?: unknown }).code === "string"
              ? (error as { code: string; message?: string; details?: Readonly<Record<string, unknown>> })
              : undefined;
        const code = registryError?.code ?? "execution-failed";
        const sanitizedMessage = registryError?.message ?? "MCP tool execution failed.";
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {
            mcpError: createMcpError({
              code,
              message: sanitizedMessage,
              details: registryError?.details,
            }),
          },
          messages: [sanitizedMessage],
          errorMessage: sanitizedMessage,
          provenance: {
            classification: "unavailable",
            runtime: "python",
            executorId: "mcp-runtime-bridge",
            detail: "MCP tool execution failed with a structured MCP error.",
            nodeType: context.node.definition.type,
            mcp,
          },
        };
      }
    }

    if (nodeType === "test") {
      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: { result: normalizeText(inputs.in ?? inputs.input ?? "value") },
        messages: ["Test scaffold node completed deterministically."],
        provenance: {
          classification: "scaffolded",
          runtime: "langchain",
          executorId: "langchain-node-executor",
          detail: "Generic test node executed through the scaffold interpreter.",
          nodeType: context.node.definition.type,
          fallback: { kind: "scaffold-interpreter", isActive: true, reason: "Generic test nodes only have scaffold behavior." },
        },
      };
    }

    if (nodeType === "shared.document-uploader") {
      const document = readProperty(context.node, "document") as UploadedDocument | undefined;
      if (!document) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {},
          messages: ["No file uploaded. Select a document in node properties."],
          errorMessage: "No file uploaded.",
        };
      }

      if (document.error) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {},
          messages: [document.error],
          errorMessage: document.error,
        };
      }

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          document: {
            name: document.name ?? "document",
            text: document.text ?? "",
            mimeType: document.type ?? "text/plain",
            size: document.size ?? 0,
          },
        },
        messages: ["Document uploaded successfully."],
      };
    }

    if (supportsNodeType(nodeType, "langchain.document_loader")) {
      const source = normalizeText(inputs.source ?? properties.source);
      const sourceType = String(properties.type ?? "text");
      const encoding = String(properties.encoding ?? "utf-8");
      const document: Document = {
        id: `${sourceType}-document`,
        text: source,
        metadata: { type: sourceType, encoding },
      };

      return {
        nodeId: context.node.id,
        status: source ? "completed" : "failed",
        outputs: {
          documents: source ? [document] : [],
        },
        messages: [source ? "Document loader produced 1 document." : "Document loader received no source."],
        errorMessage: source ? undefined : "Document loader received no source.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.document_to_chunks")) {
      const documents = toDocuments(inputs.documents);
      const chunkSize = Math.max(1, Number(properties.chunkSize ?? 500));
      const chunkOverlap = Math.max(0, Number(properties.chunkOverlap ?? 50));
      const preserveMetadata = Boolean(properties.preserveMetadata ?? true);
      const chunks = documents.flatMap((document, documentIndex) =>
        splitTextIntoChunks(document.text, chunkSize, chunkOverlap).map((text, chunkIndex) => ({
          id: document.id ? `${document.id}-chunk-${chunkIndex + 1}` : `doc-${documentIndex + 1}-chunk-${chunkIndex + 1}`,
          text,
          metadata: preserveMetadata
            ? {
                ...(document.metadata ?? {}),
                sourceDocumentId: document.id,
                chunkIndex,
              }
            : {
                sourceDocumentId: document.id,
                chunkIndex,
              },
        }))
      );

      return {
        nodeId: context.node.id,
        status: chunks.length > 0 ? "completed" : "failed",
        outputs: {
          chunks,
        },
        messages: [
          chunks.length > 0
            ? `Prepared ${chunks.length} chunk document(s).`
            : "Document chunking requires at least one readable document.",
        ],
        errorMessage:
          chunks.length > 0
            ? undefined
            : "Document chunking requires at least one readable document.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.document-to-chunks")) {
      const document = inputs.document as UploadedDocument | undefined;
      if (!document || typeof document.text !== "string") {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {},
          messages: ["Chunker received no readable document input."],
          errorMessage: "Missing document input.",
        };
      }

      const chunkSize = Math.max(1, Number(properties["chunk-size"] ?? 1000));
      const chunkOverlap = Math.max(0, Number(properties["chunk-overlap"] ?? 200));
      const chunks = splitTextIntoChunks(document.text, chunkSize, chunkOverlap).map((text, index) => ({
        index,
        text,
      }));

      if (chunks.length === 0) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {},
          messages: ["Chunker produced no chunks from the provided document."],
          errorMessage: "No chunks produced.",
        };
      }

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          chunks,
        },
        messages: [`Generated ${chunks.length} chunk(s).`],
      };
    }

    if (supportsNodeType(nodeType, "langchain.text_splitter", "langchain.text-splitter")) {
      const text = normalizeText(inputs.text);
      const chunkSize = Math.max(
        1,
        Number(properties.chunkSize ?? properties["chunk-size"] ?? 500)
      );
      const chunkOverlap = Math.max(
        0,
        Number(properties.chunkOverlap ?? properties["chunk-overlap"] ?? 50)
      );
      const chunks = splitTextIntoChunks(text, chunkSize, chunkOverlap);

      return {
        nodeId: context.node.id,
        status: chunks.length > 0 ? "completed" : "failed",
        outputs: { chunks },
        messages: [chunks.length > 0 ? `Split text into ${chunks.length} chunk(s).` : "No text received for splitting."],
        errorMessage: chunks.length > 0 ? undefined : "No text received for splitting.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.context_formatter")) {
      const documents = toDocuments(inputs.documents);
      const template = String(properties.template ?? "[{index}] {content}");
      const settings = resolveContextControlSettings(properties);
      const contextFragments = createContextFragmentsFromDocuments(documents, template);
      const inspection = inspectContextAssemblyUseCase.execute({
        assembly: {
          fragments: contextFragments,
          separator: "\n\n",
        },
        trimmingPolicy: settings.trimmingPolicy,
        budget: settings.budget,
      });
      const contextText = inspection.finalPromptText;

      return {
        nodeId: context.node.id,
        status: contextText ? "completed" : "failed",
        outputs: {
          context: contextText,
          fragments: inspection.finalFragments,
          inspection,
          budget: {
            totalCharacterCount: inspection.budgeting.totalCharacterCount,
            includedCharacterCount: inspection.budgeting.includedCharacterCount,
            totalTokenCount: inspection.budgeting.totalTokenCount,
            includedTokenCount: inspection.budgeting.includedTokenCount,
            wasTrimmed: inspection.budgeting.wasTrimmed,
          },
          filtering: {
            visibilityMode: settings.trimmingPolicy.visibilityMode ?? "advanced",
            decisions: inspection.trimming.decisions,
          },
        },
        messages: [
          contextText
            ? `Formatted ${documents.length} context item(s); retained ${inspection.finalFragments.length} after filtering and budgeting.`
            : "Context formatter received no documents.",
        ],
        errorMessage: contextText ? undefined : "Context formatter received no documents.",
      };
    }

    if (nodeType === "shared.chunk-displayer") {
      const chunks = inputs.chunks;
      if (!Array.isArray(chunks) || chunks.length === 0) {
        return {
          nodeId: context.node.id,
          status: "failed",
          outputs: {
            display: "No chunks received.",
          },
          messages: ["Chunk displayer received no chunks."],
          errorMessage: "No chunks received.",
        };
      }

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          display: chunks,
          chunks,
        },
        messages: [`Displaying ${chunks.length} chunk(s).`],
      };
    }

    if (supportsNodeType(nodeType, "langchain.prompt_template", "langchain.prompt-template")) {
      const template = String(properties.template ?? "");
      const variablesInput = inputs.variables ?? inputs["template-input"] ?? {};
      const variables =
        variablesInput && typeof variablesInput === "object" && !Array.isArray(variablesInput)
          ? (variablesInput as Record<string, unknown>)
          : {};
      const workflowContextText = resolveWorkflowContextText(context.executionMetadata);
      const enrichedVariables: Record<string, unknown> = {
        ...variables,
        ...(workflowContextText
          ? {
              context: variables.context ?? workflowContextText,
              workflowContext: variables.workflowContext ?? workflowContextText,
              assembledContext: variables.assembledContext ?? workflowContextText,
              contextInstructions: variables.contextInstructions ?? workflowContextText,
            }
          : {}),
      };
      const prompt = template.replace(/\{([^}]+)\}/g, (_match, key) => {
        const value = enrichedVariables[key.trim()];
        return value === undefined || value === null ? "" : normalizeText(value);
      });

      return {
        nodeId: context.node.id,
        status: prompt ? "completed" : "failed",
        outputs: {
          prompt,
          formatted_prompt: prompt,
          context: workflowContextText || undefined,
        },
        messages: [prompt ? "Prompt template formatted successfully." : "Prompt template is empty."],
        errorMessage: prompt ? undefined : "Prompt template is empty.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.chat_prompt", "langchain.chat-prompt")) {
      const includeContext = Boolean(properties.includeContext ?? true);
      const includeHistory = Boolean(properties.includeHistory ?? properties["include-history"] ?? true);
      const history = includeHistory ? toChatMessages(inputs.history) : [];
      const system = normalizeText(inputs.system);
      const user = normalizeText(inputs.user);
      const workflowContext = resolveWorkflowContextRecord(context.executionMetadata);
      const contextText = includeContext
        ? normalizeText(inputs.context) || resolveWorkflowContextText(context.executionMetadata)
        : "";
      const messages: ChatMessage[] = [];

      if (system) {
        messages.push({ role: "system", content: system });
      }

      if (history.length > 0) {
        messages.push(...history);
      }

      if (contextText) {
        messages.push({ role: "system", content: `Context:\n${contextText}` });
      }

      if (user) {
        messages.push({ role: "user", content: user });
      }

      return {
        nodeId: context.node.id,
        status: user ? "completed" : "failed",
        outputs: {
          messages,
          context: contextText,
          inspection: workflowContext?.inspection,
        },
        messages: [user ? `Chat prompt assembled ${messages.length} message(s).` : "Chat prompt requires a user message."],
        errorMessage: user ? undefined : "Chat prompt requires a user message.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.llm_chat")) {
      const prompt = normalizeText(inputs.prompt);
      const messages = toChatMessages(inputs.messages);
      const model = String(properties.model ?? "");
      const temperature = Number(properties.temperature ?? 0.7);
      const maxTokens = properties.maxTokens !== undefined ? Number(properties.maxTokens) : undefined;
      const topP = properties.topP !== undefined ? Number(properties.topP) : undefined;
      const renderedInput = messages.length > 0
        ? messages.map((message) => `${message.role}: ${message.content}`).join("\n")
        : prompt;
      const response = renderedInput
        ? `[${model || "deterministic-model"}] ${renderedInput}`
        : "";

      return {
        nodeId: context.node.id,
        status: response ? "completed" : "failed",
        outputs: {
          response,
          raw: {
            model,
            temperature,
            maxTokens,
            topP,
            inputMode: messages.length > 0 ? "messages" : "prompt",
            messageCount: messages.length,
          },
        },
        messages: [response ? "LLM chat node generated a deterministic response." : "LLM chat requires messages or prompt input."],
        errorMessage: response ? undefined : "LLM chat requires messages or prompt input.",
      };
    }

    if (nodeType === "langchain.context-merger") {
      const primary = inputs.primary ?? inputs.context_blocks ?? properties.primary;
      const secondary = inputs.secondary ?? properties.secondary;
      const mergeStrategy = String(properties["merge-strategy"] ?? "json-merge");
      const sources = [primary, secondary].filter((value) => value !== undefined);

      if (mergeStrategy === "concat-text") {
        const mergedText = sources.map((value) => normalizeText(value)).filter(Boolean).join("\n\n");
        return {
          nodeId: context.node.id,
          status: "completed",
          outputs: {
            merged: { text: mergedText },
            merged_context: mergedText,
            block_count: sources.length,
          },
          messages: ["LangChain context merger concatenated text sources."],
        };
      }

      const merged = sources.reduce<Record<string, unknown>>((accumulator, value, index) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return { ...accumulator, ...(value as Record<string, unknown>) };
        }

        accumulator[`context_${index + 1}`] = normalizeText(value);
        return accumulator;
      }, {});

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          merged,
          merged_context: merged,
          block_count: sources.length,
        },
        messages: ["LangChain context merger executed with interpreter."],
      };
    }

    if (supportsNodeType(nodeType, "langchain.output_parser", "langchain.output-parser")) {
      const format = String(properties.format ?? "json");
      const trimFence = Boolean(properties.trimCodeFence ?? true);
      const coerceNumbers = Boolean(properties.coerceNumbers ?? true);
      const propertySchema = ensureObjectRecord(properties.schema);
      const inputSchema = ensureObjectRecord(inputs.schema);
      const effectiveSchema = Object.keys(inputSchema).length > 0
        ? mergeObjectRecords(propertySchema, inputSchema)
        : propertySchema;
      const outputValue = inputs.text ?? inputs.output ?? inputs.output_text ?? properties.output_text ?? "";
      const outputText = normalizeText(outputValue);
      const prefix = String(inputs.prefix ?? properties.prefix ?? "");
      const parsedText = prefix && outputText.startsWith(prefix)
        ? outputText.slice(prefix.length).trim()
        : outputText.trim();
      const normalizedText = trimFence ? trimCodeFence(parsedText) : parsedText;

      let parsed: unknown = parsedText;
      let usedFallback = false;

      if (format === "json" || format === "json_schema") {
        try {
          parsed = JSON.parse(normalizedText);
        } catch {
          parsed = { text: normalizedText };
          usedFallback = true;
        }
      } else if (format === "key_value") {
        parsed = parseKeyValueText(normalizedText, coerceNumbers);
      }

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          parsed,
          parsed_output: parsed,
          raw_output: outputText,
          parseReport: {
            format,
            usedFallback,
            schema: effectiveSchema,
            extractedKeys:
              parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? Object.keys(parsed as Record<string, unknown>)
                : [],
          },
        },
        messages: ["LangChain output parser executed with interpreter."],
      };
    }

    if (supportsNodeType(nodeType, "langchain.embeddings", "langchain.embedding-generator")) {
      const dimensions = Math.max(1, Number(properties.dimensions ?? 1536));
      const normalizeVectors = Boolean(properties.normalize ?? properties["normalize-vectors"] ?? true);
      const textItems = Array.isArray(inputs.texts)
        ? inputs.texts.map((item) => normalizeText(item)).filter(Boolean)
        : [];
      const legacyText = normalizeText(inputs.text);
      const legacyChunks = toChunkRecords(inputs.text).map((chunk) => chunk.text);
      const sourceItems = textItems.length > 0
        ? textItems
        : legacyChunks.length > 0
          ? legacyChunks
          : legacyText
            ? [legacyText]
            : [];
      const vectors = sourceItems.map((item) => buildEmbeddingVector(item, dimensions, normalizeVectors));

      return {
        nodeId: context.node.id,
        status: vectors.length > 0 ? "completed" : "failed",
        outputs: {
          embeddings: vectors,
          embedding: {
            dimensions,
            count: vectors.length,
            vectors,
          },
        },
        messages: [vectors.length > 0 ? `Generated ${vectors.length} embedding vector(s).` : "No text received for embedding generation."],
        errorMessage: vectors.length > 0 ? undefined : "No text received for embedding generation.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.vector_store_upsert")) {
      const documents = toDocuments(inputs.documents);
      const embeddings = Array.isArray(inputs.embeddings)
        ? inputs.embeddings.filter(Array.isArray)
        : [];
      const storeType = String(properties.storeType ?? "memory");
      const collectionName = String(
        properties.collectionName ?? properties.collection ?? "default"
      );
      const recordCount = Math.max(documents.length, embeddings.length);
      const records = Array.from({ length: recordCount }, (_unused, index) => {
        const document = documents[index];
        return {
          id: document?.id ?? `${collectionName}-${index + 1}`,
          content: document?.text ?? "",
          metadata: document?.metadata ?? {},
          embedding: embeddings[index],
        };
      });

      return {
        nodeId: context.node.id,
        status: recordCount > 0 ? "completed" : "failed",
        outputs: {
          vectorStore: {
            storeType,
            collectionName,
            records,
          },
        },
        messages: [
          recordCount > 0
            ? `Prepared ${recordCount} vector store record(s) for ${collectionName}.`
            : "Vector store upsert requires documents and embeddings.",
        ],
        errorMessage:
          recordCount > 0
            ? undefined
            : "Vector store upsert requires documents and embeddings.",
      };
    }

    if (nodeType === "langchain.vector-store-upsert") {
      const embedding = inputs.embedding as Record<string, unknown> | undefined;
      const metadata = inputs.metadata;
      const namespace = String(properties.namespace ?? "default");
      const batchSize = Math.max(1, Number(properties["batch-size"] ?? 100));
      const vectors = Array.isArray(embedding?.vectors) ? embedding.vectors : [];
      const sourceChunks = toChunkRecords(metadata);
      const records = vectors.map((vector, index) => ({
        id: `${namespace}-${index + 1}`,
        namespace,
        vector,
        metadata: sourceChunks[index] ?? metadata ?? null,
      }));

      return {
        nodeId: context.node.id,
        status: records.length > 0 ? "completed" : "failed",
        outputs: {
          dataset: {
            namespace,
            batchSize,
            recordCount: records.length,
            records,
          },
        },
        messages: [records.length > 0 ? `Prepared ${records.length} vector store record(s).` : "No embeddings were available to store."],
        errorMessage: records.length > 0 ? undefined : "No embeddings were available to store.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.similarity_search")) {
      const query = normalizeText(inputs.query);
      const topK = Math.max(1, Number(properties.k ?? properties.topK ?? 4));
      const minimumScore = Number(properties.scoreThreshold ?? 0);
      const vectorStore = inputs.vectorStore as Record<string, unknown> | unknown[] | undefined;
      const candidateDocuments = [
        ...toDocuments(
          Array.isArray((vectorStore as Record<string, unknown> | undefined)?.records)
            ? ((vectorStore as Record<string, unknown>).records as unknown[]).map((record) => {
                const item = ensureObjectRecord(record);
                return {
                  id: item.id,
                  text: item.content,
                  metadata: item.metadata,
                };
              })
            : []
        ),
        ...toDocuments(vectorStore),
      ];
      const scored = candidateDocuments
        .map((document, index) => {
          const lexicalScore = query ? scoreText(query, document.text) : 0;
          const score = Number(lexicalScore.toFixed(3));

          return {
            id: document.id ?? `doc-${index + 1}`,
            text: document.text,
            metadata: {
              ...(document.metadata ?? {}),
              score,
            },
          } satisfies Document;
        })
        .filter((document) => Number(document.metadata?.score ?? 0) >= minimumScore)
        .sort((left, right) => Number(right.metadata?.score ?? 0) - Number(left.metadata?.score ?? 0))
        .slice(0, topK);

      return {
        nodeId: context.node.id,
        status: scored.length > 0 ? "completed" : "failed",
        outputs: {
          documents: scored,
        },
        messages: [
          scored.length > 0
            ? `Found ${scored.length} similar document(s).`
            : "Similarity search requires a query and a searchable vector store.",
        ],
        errorMessage:
          scored.length > 0
            ? undefined
            : "Similarity search requires a query and a searchable vector store.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.retriever", "langchain.retrieval-query")) {
      const query = normalizeText(inputs.query);
      const topK = Math.max(1, Number(properties.topK ?? properties["top-k"] ?? 5));
      const minimumScore = Number(properties["min-score"] ?? 0);
      const dataset = (inputs.vectorStore ?? inputs.dataset) as Record<string, unknown> | unknown[] | undefined;
      const candidateDocuments = [
        ...toDocuments((dataset as Record<string, unknown> | undefined)?.records),
        ...toDocuments(dataset),
        ...toDocuments(inputs.documents),
      ];
      const candidateChunks = candidateDocuments.length > 0
        ? candidateDocuments.map((document, index) => ({
            index,
            text: document.text,
            metadata: document.metadata,
          }))
        : [
            ...toChunkRecords((dataset as Record<string, unknown> | undefined)?.records),
            ...toChunkRecords(dataset),
          ];
      const scored = candidateChunks
        .map((chunk, index) => ({
          id: `doc-${index + 1}`,
          text: chunk.text,
          metadata: {
            ...(typeof chunk === "object" && "metadata" in chunk ? (chunk as Record<string, unknown>).metadata as Record<string, unknown> : {}),
            score: Number(scoreText(query, chunk.text).toFixed(3)),
          },
        }))
        .filter((document) => Number(document.metadata?.score ?? 0) >= minimumScore)
        .sort((left, right) => Number(right.metadata?.score ?? 0) - Number(left.metadata?.score ?? 0))
        .slice(0, topK);

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          documents: scored,
          matches: scored.map((document, index) => ({ index, text: document.text, score: document.metadata?.score })),
          scores: scored.map((document, index) => ({ index, score: document.metadata?.score })),
        },
        messages: [`Retrieved ${scored.length} matching document(s).`],
      };
    }

    if (supportsNodeType(nodeType, "langchain.knowledge_base_retriever")) {
      const query = normalizeText(inputs.query);
      const topK = Math.max(1, Number(properties.topK ?? 5));
      const minimumScore = Number(properties.scoreThreshold ?? 0);
      const knowledgeBase = inputs.knowledgeBase as Record<string, unknown> | unknown[] | undefined;
      const candidateDocuments = [
        ...toDocuments((knowledgeBase as Record<string, unknown> | undefined)?.documents),
        ...toDocuments((knowledgeBase as Record<string, unknown> | undefined)?.entries),
        ...toDocuments(knowledgeBase),
      ];
      const documents = candidateDocuments
        .map((document) => ({
          ...document,
          metadata: {
            ...(document.metadata ?? {}),
            score: Number(scoreText(query, document.text).toFixed(3)),
          },
        }))
        .filter((document) => Number(document.metadata?.score ?? 0) >= minimumScore)
        .sort((left, right) => Number(right.metadata?.score ?? 0) - Number(left.metadata?.score ?? 0))
        .slice(0, topK);

      return {
        nodeId: context.node.id,
        status: documents.length > 0 ? "completed" : "failed",
        outputs: {
          documents,
        },
        messages: [
          documents.length > 0
            ? `Retrieved ${documents.length} knowledge base document(s).`
            : "Knowledge base retriever found no matching entries.",
        ],
        errorMessage:
          documents.length > 0
            ? undefined
            : "Knowledge base retriever found no matching entries.",
      };
    }

    if (nodeType === "langchain.reranker") {
      const query = normalizeText(inputs.query);
      const topK = Math.max(1, Number(properties.topK ?? properties["top-n"] ?? 3));
      const documents = toDocuments(inputs.documents);
      const candidates = documents.length > 0
        ? documents.map((document) => ({ text: document.text, metadata: document.metadata }))
        : toChunkRecords(inputs.candidates);
      const rerankedDocuments = candidates
        .map((candidate, index) => ({
          id: `doc-${index + 1}`,
          text: candidate.text,
          metadata: {
            ...(typeof candidate === "object" && "metadata" in candidate ? (candidate as Record<string, unknown>).metadata as Record<string, unknown> : {}),
            score: Number(scoreText(query, candidate.text).toFixed(3)),
          },
        }))
        .sort((left, right) => Number(right.metadata?.score ?? 0) - Number(left.metadata?.score ?? 0))
        .slice(0, topK);

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          documents: rerankedDocuments,
          reranked: rerankedDocuments.map((document, index) => ({ index, text: document.text, score: document.metadata?.score })),
          scores: rerankedDocuments.map((document, index) => ({ index, score: document.metadata?.score })),
        },
        messages: [`Reranked ${rerankedDocuments.length} candidate document(s).`],
      };
    }

    if (supportsNodeType(nodeType, "langchain.message_history", "langchain.memory")) {
      const sessionId = normalizeText(inputs.sessionId);
      const newMessages = toChatMessages(inputs.messages);
      const seedHistory = toChatMessages(inputs.seedHistory);
      const maxMessages = Math.max(1, Number(properties.maxMessages ?? 12));
      const seedStrategy = String(properties.seedStrategy ?? "on-miss");
      const dedupeConsecutive = Boolean(properties.dedupeConsecutive ?? true);
      const existingHistory = messageHistoryStore.get(sessionId) ?? [];
      const baseHistory =
        seedStrategy === "merge"
          ? [...seedHistory, ...existingHistory]
          : existingHistory.length > 0
            ? existingHistory
            : seedHistory;
      const combinedHistory = [...baseHistory, ...newMessages];
      const history = (dedupeConsecutive
        ? dedupeConsecutiveMessages(combinedHistory)
        : combinedHistory
      ).slice(-maxMessages);

      if (sessionId) {
        messageHistoryStore.set(sessionId, history);
      }

      return {
        nodeId: context.node.id,
        status: sessionId ? "completed" : "failed",
        outputs: {
          history,
          historyState: {
            sessionId,
            storedMessageCount: history.length,
            seededMessageCount: seedHistory.length,
            appendedMessageCount: newMessages.length,
          },
        },
        messages: [sessionId ? `Stored ${history.length} message(s) for session ${sessionId}.` : "Message history requires a session ID."],
        errorMessage: sessionId ? undefined : "Message history requires a session ID.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.tool_definition")) {
      const toolName = String(properties.toolName ?? "");
      const description = String(properties.description ?? "");
      const strictSchema = Boolean(properties.strictSchema ?? true);
      const displayName = String(properties.displayName ?? "");
      const schemaSource = String(properties.inputSchemaSource ?? "merge");
      const propertySchema = ensureObjectRecord(properties.inputSchema);
      const inputSchema = ensureObjectRecord(inputs.inputSchema);
      const handler = inputs.toolHandler;
      const mergedSchema =
        schemaSource === "property"
          ? propertySchema
          : schemaSource === "input"
            ? inputSchema
            : mergeObjectRecords(propertySchema, inputSchema);
      const tool = {
        name: toolName,
        displayName: displayName || undefined,
        description,
        inputSchema: Object.keys(mergedSchema).length > 0 ? mergedSchema : undefined,
        strictSchema,
        handler,
      };

      return {
        nodeId: context.node.id,
        status: toolName && description ? "completed" : "failed",
        outputs: {
          tool,
          toolManifest: {
            name: toolName,
            displayName: displayName || toolName,
            description,
            strictSchema,
            schemaSource,
            hasHandler: handler !== undefined,
            inputSchema: Object.keys(mergedSchema).length > 0 ? mergedSchema : undefined,
          },
        },
        messages: [
          toolName && description
            ? `Created tool definition '${toolName}'.`
            : "Tool definition requires both a tool name and description.",
        ],
        errorMessage:
          toolName && description
            ? undefined
            : "Tool definition requires both a tool name and description.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.tool_execution", "langchain.tool_call_executor")) {
      const toolCall = toToolCall(inputs.toolCall);
      const toolRecord = ensureObjectRecord(inputs.tool);
      const tool =
        typeof toolRecord.name === "string" && typeof toolRecord.description === "string"
          ? ({
              name: toolRecord.name,
              description: toolRecord.description,
              inputSchema: ensureObjectRecord(toolRecord.inputSchema),
              strictSchema:
                typeof toolRecord.strictSchema === "boolean" ? toolRecord.strictSchema : undefined,
              handler: toolRecord.handler,
            } satisfies ToolRuntimeDefinition)
          : undefined;
      const argumentsInput = ensureObjectRecord(inputs.arguments);
      const argumentsRecord =
        Object.keys(argumentsInput).length > 0
          ? argumentsInput
          : ensureObjectRecord(toolCall?.arguments);
      const failOnMissingArgs = Boolean(properties.failOnMissingArgs ?? true);
      const stringifyResult = Boolean(properties.stringifyResult ?? true);
      const contextInstructions = resolveWorkflowContextText(context.executionMetadata);
      const missingTool = !tool;
      const missingArguments = !missingTool && Object.keys(argumentsRecord).length === 0;
      const executed =
        tool && !missingArguments
          ? buildDeterministicToolResult({
              tool,
              argumentsRecord,
            })
          : tool
            ? buildDeterministicToolResult({
                tool,
                argumentsRecord,
              })
            : undefined;
      const blockedByValidation =
        Boolean(failOnMissingArgs) &&
        (missingArguments || (executed?.missingRequiredArguments.length ?? 0) > 0);
      const toolName = tool?.name ?? toolCall?.name ?? "unnamed-tool";
      const toolResult =
        missingTool
          ? {
              toolName,
              arguments: argumentsRecord,
              missingRequiredArguments: [],
              status: "missing-tool",
              output: "No executable tool definition was provided.",
            }
          : executed?.toolResult;

      return {
        nodeId: context.node.id,
        status: missingTool || blockedByValidation ? "failed" : "completed",
        outputs: {
          toolCall: executed?.toolCall ?? toolCall,
          toolResult,
          resultText: stringifyResult && toolResult ? stringifyValue(toolResult) : undefined,
          contextInstructions: contextInstructions || undefined,
        },
        messages: [
          missingTool
            ? "Tool execution requires a tool definition input."
            : blockedByValidation
              ? `Tool '${toolName}' was blocked because required inputs were missing.`
              : `Executed tool '${toolName}' with ${Object.keys(argumentsRecord).length} argument field(s).`,
        ],
        errorMessage:
          missingTool
            ? "Tool execution requires a tool definition input."
            : blockedByValidation
              ? `Tool '${toolName}' was blocked because required inputs were missing.`
              : undefined,
      };
    }

    if (supportsNodeType(nodeType, "langchain.simple_agent", "langchain.agent")) {
      const model = String(properties.model ?? "");
      const workflowContextText = resolveWorkflowContextText(context.executionMetadata);
      const systemPrompt = [
        normalizeText(properties.systemPrompt),
        workflowContextText ? `Context:\n${workflowContextText}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      const temperature = Number(properties.temperature ?? 0.7);
      const maxIterations = Math.max(1, Number(properties.maxIterations ?? 3));
      const useMemory = Boolean(properties.useMemory ?? true);
      const verbose = Boolean(properties.verbose ?? false);
      const history = useMemory ? toChatMessages(inputs.history) : [];
      const incomingMessages = toChatMessages(inputs.messages);
      const directInput = normalizeText(inputs.input);
      const tools = toToolDefinitions(inputs.tools);
      const assembledMessages: ChatMessage[] = [];

      if (systemPrompt) {
        assembledMessages.push({ role: "system", content: systemPrompt });
      }
      if (history.length > 0) {
        assembledMessages.push(...history);
      }
      if (incomingMessages.length > 0) {
        assembledMessages.push(...incomingMessages);
      } else if (directInput) {
        assembledMessages.push({ role: "user", content: directInput });
      }

      const latestUserInput =
        assembledMessages.filter((message) => message.role === "user").at(-1)?.content ?? directInput;
      const chosenTool = latestUserInput ? pickToolForTask(latestUserInput, tools) : undefined;
      const firstPassArguments = latestUserInput ? { input: latestUserInput } : {};
      const executedTool =
        chosenTool && latestUserInput
          ? buildDeterministicToolResult({
              tool: chosenTool,
              argumentsRecord: firstPassArguments,
            })
          : undefined;
      const iterationCount = latestUserInput ? (executedTool ? Math.min(maxIterations, 2) : 1) : 0;
      const response = latestUserInput
        ? executedTool
          ? `[${model || "assistant-model"}] ${latestUserInput}

Used tool '${chosenTool?.name}' and observed: ${normalizeText(executedTool.toolResult.output)}`
          : `[${model || "assistant-model"}] ${latestUserInput}`
        : "";

      return {
        nodeId: context.node.id,
        status: response ? "completed" : "failed",
        outputs: {
          response,
          messages: response
            ? [...assembledMessages, { role: "assistant", content: response }]
            : assembledMessages,
          toolCalls: executedTool ? [executedTool.toolCall] : [],
          toolResults: executedTool ? [executedTool.toolResult] : [],
          trace: verbose
            ? {
                temperature,
                maxIterations,
                iterationCount,
                toolCount: tools.length,
                selectedTool: chosenTool?.name,
              }
            : undefined,
        },
        messages: [
          response
            ? `AI assistant completed a bounded run in ${iterationCount} iteration(s).`
            : "AI assistant requires messages or input text.",
        ],
        errorMessage: response ? undefined : "AI assistant requires messages or input text.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.summarization")) {
      const documents = toDocuments(inputs.documents);
      const model = normalizeText(inputs.model) || String(properties.model ?? "summary-model");
      const strategy = String(properties.strategy ?? "stuff");
      const sourceText = documents.map((document) => document.text).join("\n\n");
      const clippedText = sourceText.slice(0, 300);
      const summary =
        strategy === "map_reduce"
          ? `[${model}] Map-reduce summary: ${clippedText}`
          : strategy === "refine"
            ? `[${model}] Refined summary: ${clippedText}`
            : `[${model}] Summary: ${clippedText}`;

      return {
        nodeId: context.node.id,
        status: sourceText ? "completed" : "failed",
        outputs: {
          summary,
        },
        messages: [
          sourceText
            ? "Summarization node generated a deterministic summary."
            : "Summarization requires documents and a model input.",
        ],
        errorMessage:
          sourceText && model ? undefined : "Summarization requires documents and a model input.",
      };
    }

    if (supportsNodeType(nodeType, "langchain.combine_summaries")) {
      const summaryInput = Array.isArray(inputs.summaries)
        ? inputs.summaries.map((item) => normalizeText(item)).filter(Boolean)
        : normalizeText(inputs.summaries)
          ? [normalizeText(inputs.summaries)]
          : [];
      const method = String(properties.method ?? properties.strategy ?? "concatenate");
      const summary =
        method === "reduce"
          ? summaryInput.join(" ").trim()
          : summaryInput.join("\n\n");

      return {
        nodeId: context.node.id,
        status: summaryInput.length > 0 ? "completed" : "failed",
        outputs: {
          combinedSummary: summary,
        },
        messages: [
          summaryInput.length > 0
            ? `Combined ${summaryInput.length} summary item(s).`
            : "Combine summaries requires at least one summary input.",
        ],
        errorMessage:
          summaryInput.length > 0
            ? undefined
            : "Combine summaries requires at least one summary input.",
      };
    }

    if (nodeType === "langchain.answer-synthesizer") {
      const question = normalizeText(inputs.question);
      const contextChunks = [
        ...toChunkRecords(inputs.context),
        ...toChunkRecords((inputs.context as Record<string, unknown> | undefined)?.matches),
      ];
      const contextText =
        contextChunks.length > 0
          ? contextChunks.map((chunk) => chunk.text).join("\n")
          : normalizeText(inputs.context);
      const style = String(properties["response-style"] ?? "concise");
      const maxSources = Math.max(1, Number(properties["max-sources"] ?? 4));
      const selectedSources = contextChunks.slice(0, maxSources);
      const answerPrefix =
        style === "bulleted" ? "- " : style === "detailed" ? "Detailed answer: " : "Answer: ";
      const answerBody = contextText
        ? `${question}\n\nBased on context: ${contextText.slice(0, 400)}`
        : question;

      return {
        nodeId: context.node.id,
        status: "completed",
        outputs: {
          answer: `${answerPrefix}${answerBody}`,
          citations: selectedSources.map((chunk) => ({ index: chunk.index, text: chunk.text })),
        },
        messages: [`Synthesized an answer with ${selectedSources.length} citation source(s).`],
      };
    }

    return {
      nodeId: context.node.id,
      status: "failed",
      outputs: {},
      messages: [`Node type '${context.node.definition.type}' does not have a truthful scaffold implementation.`],
      errorMessage: `Node type '${context.node.definition.type}' is unavailable in scaffold execution.`,
      provenance: {
        classification: "unavailable",
        runtime: "langchain",
        executorId: "langchain-node-executor",
        detail: "No truthful scaffold implementation exists for this node type.",
      },
    };
  }
}
