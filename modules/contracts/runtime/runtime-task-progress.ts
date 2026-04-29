export interface RuntimeTaskProgress {
  message?: string;
  current?: number;
  total?: number;
  unit?: string;
  percent?: number;
  details?: Record<string, unknown>;
}
