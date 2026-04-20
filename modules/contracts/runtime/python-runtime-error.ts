export interface PythonRuntimeError {
  code: string;
  errorCode?: string;
  stage?: "normalization" | "chunking" | "generation" | "split";
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}
