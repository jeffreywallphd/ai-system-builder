import type { INode } from "../../domain/nodes/interfaces/INode";
import type { McpServerStatus } from "../mcp/models/McpServerStatus";
import type { McpToolDescriptor } from "../mcp/models/McpToolDescriptor";
import type {
  ExecutionFallbackKind,
  ExecutionProvenanceKind,
  IMcpExecutionProvenance,
  INodeExecutionProvenance,
  IWorkflowExecutionProvenance,
} from "../ports/interfaces/IWorkflowExecutor";

export interface NodeTruthProfile {
  readonly nodeType: string;
  readonly classification: ExecutionProvenanceKind;
  readonly runtime: string;
  readonly executorId: string;
  readonly detail: string;
  readonly fallbackKind?: ExecutionFallbackKind;
}

const DELEGATED_NODE_TYPES = new Set([
  "langchain.vector_store_upsert",
  "langchain.similarity_search",
  "langchain.context_formatter",
  "langchain.summarization",
  "langchain.combine_summaries",
  "mcp.server_select",
  "mcp.tool_catalog",
  "mcp.tool_call",
]);

const SCAFFOLDED_NODE_TYPES = new Set([
  "shared.document-uploader",
  "langchain.document_loader",
  "langchain.document_to_chunks",
  "langchain.document-to-chunks",
  "langchain.text_splitter",
  "langchain.text-splitter",
  "langchain.context_formatter",
  "langchain.prompt_template",
  "langchain.prompt-template",
  "langchain.chat_prompt",
  "langchain.chat-prompt",
  "langchain.llm_chat",
  "langchain.context-merger",
  "langchain.output_parser",
  "langchain.output-parser",
  "langchain.embeddings",
  "langchain.embedding-generator",
  "langchain.vector_store_upsert",
  "langchain.vector-store-upsert",
  "langchain.similarity_search",
  "langchain.retriever",
  "langchain.retrieval-query",
  "langchain.knowledge_base_retriever",
  "langchain.reranker",
  "langchain.message_history",
  "langchain.memory",
  "langchain.tool_definition",
  "langchain.tool_execution",
  "langchain.tool_call_executor",
  "langchain.simple_agent",
  "langchain.agent",
  "langchain.summarization",
  "langchain.combine_summaries",
  "langchain.answer-synthesizer",
  "langchain.retrieval_qa",
  "langchain.chat_prompt_builder",
]);

function normalizeNodeType(nodeType: string): string {
  return nodeType.trim().toLowerCase();
}

export function classifyNodeTruth(nodeType: string, options: { readonly delegatedRuntimeAvailable?: boolean } = {}): NodeTruthProfile {
  const normalized = normalizeNodeType(nodeType);
  const delegated = options.delegatedRuntimeAvailable === true;

  if (DELEGATED_NODE_TYPES.has(normalized) && delegated) {
    return Object.freeze({
      nodeType: normalized,
      classification: normalized.startsWith("mcp.") ? "delegated" : "hybrid",
      runtime: normalized.startsWith("mcp.") ? "python" : "langchain",
      executorId: normalized.startsWith("mcp.") ? "mcp-runtime-bridge" : "langchain-node-executor",
      detail: normalized.startsWith("mcp.")
        ? "Node depends on the MCP runtime bridge and reports delegated execution truthfully."
        : "Node can combine scaffold logic with delegated runtime-backed execution.",
      fallbackKind: normalized.startsWith("mcp.") ? undefined : "scaffold-interpreter",
    });
  }

  if (SCAFFOLDED_NODE_TYPES.has(normalized)) {
    return Object.freeze({
      nodeType: normalized,
      classification: "scaffolded",
      runtime: normalized.startsWith("mcp.") ? "python" : "langchain",
      executorId: "langchain-node-executor",
      detail: "Node is currently implemented by the deterministic scaffold interpreter.",
      fallbackKind: "scaffold-interpreter",
    });
  }

  if (normalized.startsWith("mcp.")) {
    return Object.freeze({
      nodeType: normalized,
      classification: "unavailable",
      runtime: "python",
      executorId: "mcp-runtime-bridge",
      detail: "Node requires MCP runtime support that is not available in this environment.",
    });
  }

  return Object.freeze({
    nodeType: normalized,
    classification: "unavailable",
    runtime: "langchain",
    executorId: "langchain-node-executor",
    detail: "Node does not have a truthful implementation in the current execution environment.",
  });
}

export function ensureNodeExecutionProvenance(
  node: INode,
  provenance: INodeExecutionProvenance | undefined,
  options: { readonly delegatedRuntimeAvailable?: boolean } = {},
): INodeExecutionProvenance {
  const base = classifyNodeTruth(node.definition.type, options);
  return Object.freeze({
    classification: provenance?.classification ?? base.classification,
    runtime: provenance?.runtime ?? base.runtime,
    executorId: provenance?.executorId ?? base.executorId,
    detail: provenance?.detail ?? base.detail,
    nodeType: provenance?.nodeType ?? base.nodeType,
    fallback: provenance?.fallback ?? (base.fallbackKind
      ? Object.freeze({ kind: base.fallbackKind, isActive: true, reason: base.detail })
      : undefined),
    mcp: provenance?.mcp,
    modelLibrary: provenance?.modelLibrary,
  });
}

export function aggregateWorkflowProvenance(params: {
  readonly strategyId: string;
  readonly runtime: string;
  readonly detail: string;
  readonly selectionReason?: string;
  readonly nodeProvenance: Readonly<Record<string, INodeExecutionProvenance>>;
  readonly fallback?: IWorkflowExecutionProvenance["fallback"];
}): IWorkflowExecutionProvenance {
  const entries = Object.values(params.nodeProvenance);
  const counts = entries.reduce<Record<ExecutionProvenanceKind, number>>((acc, entry) => {
    acc[entry.classification] += 1;
    return acc;
  }, {
    real: 0,
    delegated: 0,
    hybrid: 0,
    scaffolded: 0,
    unavailable: 0,
  });

  let classification: ExecutionProvenanceKind = "scaffolded";
  if (counts.unavailable > 0 && counts.real + counts.delegated + counts.hybrid + counts.scaffolded === 0) {
    classification = "unavailable";
  } else if (counts.hybrid > 0 || ((counts.delegated > 0 || counts.real > 0) && counts.scaffolded > 0)) {
    classification = "hybrid";
  } else if (counts.delegated > 0 && counts.real === 0 && counts.scaffolded === 0) {
    classification = "delegated";
  } else if (counts.real > 0 && counts.delegated === 0 && counts.scaffolded === 0) {
    classification = "real";
  } else if (counts.unavailable > 0 && counts.delegated === 0 && counts.real === 0 && counts.hybrid === 0) {
    classification = "unavailable";
  }

  return Object.freeze({
    classification,
    runtime: params.runtime,
    strategyId: params.strategyId,
    detail: params.detail,
    selectionReason: params.selectionReason,
    fallback: params.fallback,
    nodeCounts: Object.freeze(counts),
    nodeProvenance: Object.freeze({ ...params.nodeProvenance }),
  });
}

export function deriveMcpExecutionProvenance(params: {
  readonly serverStatus?: McpServerStatus;
  readonly toolDescriptor?: McpToolDescriptor;
  readonly serverId?: string;
  readonly toolName?: string;
  readonly detail?: string;
}): IMcpExecutionProvenance {
  const status = params.serverStatus;
  let state: IMcpExecutionProvenance["status"] = "unavailable";

  if (status?.sessionState === "stale") {
    state = "stale";
  } else if (status?.connected || status?.state === "connected" || params.toolDescriptor?.live) {
    state = "live";
  } else if (status?.state === "disconnected" || status?.sessionState === "disconnected") {
    state = "disconnected";
  } else if (params.toolDescriptor?.stale) {
    state = "stale";
  }

  return Object.freeze({
    status: state,
    serverId: params.serverId ?? status?.serverId,
    toolName: params.toolName ?? params.toolDescriptor?.name,
    detail: params.detail ?? status?.errorMessage,
    checkedAt: status?.checkedAt,
  });
}
