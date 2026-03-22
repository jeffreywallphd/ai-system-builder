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


export interface IPythonRuntimeFineTuningJobRequest {
  readonly job_id: string;
  readonly job_name: string;
  readonly backend: "python-runtime-manifest";
  readonly base_model_id: string;
  readonly base_model_name: string;
  readonly dataset_id: string;
  readonly dataset_name: string;
  readonly dataset_version_id: string;
  readonly dataset_version_number: number;
  readonly created_by: string;
  readonly configuration: {
    readonly epochs: number;
    readonly learning_rate: number;
    readonly batch_size: number;
    readonly notes?: string;
  };
}

export interface IPythonRuntimeFineTuningJobResponse {
  readonly job_id: string;
  readonly job_name: string;
  readonly backend: "python-runtime-manifest";
  readonly base_model_id: string;
  readonly dataset_id: string;
  readonly dataset_version_id: string;
  readonly created_by: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly submitted_at: string;
  readonly started_at?: string;
  readonly completed_at?: string;
  readonly status: "queued" | "running" | "completed" | "failed" | "unsupported";
  readonly configuration: {
    readonly epochs: number;
    readonly learning_rate: number;
    readonly batch_size: number;
    readonly notes?: string;
  };
  readonly diagnostics: ReadonlyArray<{
    readonly code: string;
    readonly level: "info" | "warning" | "error";
    readonly message: string;
    readonly detail?: string;
  }>;
  readonly artifacts: ReadonlyArray<{
    readonly id: string;
    readonly kind: "training-manifest" | "adapter-bundle" | "checkpoint" | "log";
    readonly label: string;
    readonly location?: string;
    readonly content_type?: string;
    readonly created_at: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  }>;
  readonly checkpoints: ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly epoch: number;
    readonly metric_name?: string;
    readonly metric_value?: number;
    readonly created_at: string;
    readonly artifact_id?: string;
  }>;
  readonly output_model_name?: string;
  readonly summary?: string;
}

export interface IPythonRuntimeDatasetGenerationRequest {
  readonly dataset_id: string;
  readonly version_id: string;
  readonly task_type: string;
  readonly created_by: string;
  readonly source_documents: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly content: string;
    readonly segments: ReadonlyArray<{
      readonly id: string;
      readonly index: number;
      readonly kind: string;
      readonly text: string;
    }>;
  }>;
  readonly existing_examples: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly configuration?: {
    readonly strategy: string;
    readonly max_examples_per_source?: number;
    readonly max_segments_per_source?: number;
  };
}

export interface IPythonRuntimeDatasetGenerationResponse {
  readonly batch_id: string;
  readonly generated_at: string;
  readonly generated_count: number;
  readonly skipped_count: number;
  readonly examples: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly provenance: {
    readonly provider: string;
    readonly generator_id: string;
    readonly generator_version: string;
    readonly batch_id: string;
    readonly mode: "provider-backed" | "heuristic-fallback";
    readonly detail?: string;
    readonly parameters: Readonly<Record<string, unknown>>;
    readonly executed_at: string;
    readonly diagnostics: ReadonlyArray<{
      readonly code: string;
      readonly level: "info" | "warning" | "error";
      readonly message: string;
    }>;
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
  submitFineTuningJob(
    request: IPythonRuntimeFineTuningJobRequest
  ): Promise<IPythonRuntimeFineTuningJobResponse>;
  generateDatasetExamples(
    request: IPythonRuntimeDatasetGenerationRequest
  ): Promise<IPythonRuntimeDatasetGenerationResponse>;
}
