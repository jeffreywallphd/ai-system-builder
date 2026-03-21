export interface IPythonRuntimeHealthResponse {
  readonly status: "ok" | "degraded" | "unavailable";
  readonly runtime: "python";
  readonly version?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface IPythonRuntimeExecuteNodeRequest {
  readonly executionId?: string;
  readonly workflowId?: string;
  readonly nodeId: string;
  readonly nodeType: string;
  readonly inputs?: Readonly<Record<string, unknown>>;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly context?: Readonly<Record<string, unknown>>;
}

export interface IPythonRuntimeExecuteNodeResponse {
  readonly executionId: string;
  readonly nodeId: string;
  readonly status: "completed" | "failed";
  readonly outputs: Readonly<Record<string, unknown>>;
  readonly messages?: ReadonlyArray<string>;
  readonly errorMessage?: string;
}

export interface IPythonRuntimeWorkflowNode {
  readonly id: string;
  readonly nodeType: string;
  readonly properties?: Readonly<Record<string, unknown>>;
}

export interface IPythonRuntimeWorkflowConnection {
  readonly sourceNodeId: string;
  readonly sourcePortId: string;
  readonly targetNodeId: string;
  readonly targetPortId: string;
}

export interface IPythonRuntimeExecuteWorkflowRequest {
  readonly executionId?: string;
  readonly workflowId: string;
  readonly nodes: ReadonlyArray<IPythonRuntimeWorkflowNode>;
  readonly connections: ReadonlyArray<IPythonRuntimeWorkflowConnection>;
  readonly workflowInputs?: Readonly<Record<string, unknown>>;
  readonly executionContext?: Readonly<Record<string, unknown>>;
}

export interface IPythonRuntimeExecuteWorkflowResponse {
  readonly executionId: string;
  readonly workflowId: string;
  readonly status: "completed" | "failed";
  readonly nodeResults: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly messages?: ReadonlyArray<string>;
  readonly errorMessage?: string;
}

export interface IPythonRuntimeDocumentConversionRequest {
  readonly filename: string;
  readonly contentType?: string;
  readonly outputFormat: "markdown";
  readonly content: Uint8Array;
}

export interface IPythonRuntimeDocumentConversionResponse {
  readonly success: boolean;
  readonly filename: string;
  readonly contentType?: string;
  readonly extension?: string;
  readonly sourceFormat: string;
  readonly outputFormat: "markdown";
  readonly markdownContent: string;
  readonly converter: {
    readonly id: string;
    readonly version?: string;
  };
  readonly warnings: ReadonlyArray<{
    readonly code: string;
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  }>;
  readonly metadata: {
    readonly strategy: "pass_through" | "converted";
    readonly durationMs?: number;
    readonly detectedContentType?: string;
    readonly declaredContentType?: string;
  };
}

export interface IPythonRuntimeClient {
  health(): Promise<IPythonRuntimeHealthResponse>;
  executeNode(
    request: IPythonRuntimeExecuteNodeRequest
  ): Promise<IPythonRuntimeExecuteNodeResponse>;
  executeWorkflow(
    request: IPythonRuntimeExecuteWorkflowRequest
  ): Promise<IPythonRuntimeExecuteWorkflowResponse>;
  convertDocumentToMarkdown(
    request: IPythonRuntimeDocumentConversionRequest
  ): Promise<IPythonRuntimeDocumentConversionResponse>;
}
