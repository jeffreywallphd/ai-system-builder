import type { RuntimeTaskStatus } from "../runtime/runtime-task-status";

export interface ImageGenerationOutput {
  artifactId: string;
  assetId?: string;
}

export interface ImageGenerationResult {
  requestId: string;
  status: RuntimeTaskStatus;
  outputs?: ImageGenerationOutput[];
  warnings?: string[];
  errors?: string[];
}
