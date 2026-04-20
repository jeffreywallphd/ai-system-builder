export interface PythonRuntimeTaskResult {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: {
    message: string;
    code?: string;
  };
  metadata?: Record<string, unknown>;
}
