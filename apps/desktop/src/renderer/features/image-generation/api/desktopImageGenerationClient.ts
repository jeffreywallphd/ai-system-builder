import { getDesktopApi } from "../../../lib/desktopApi";

export function createDesktopImageGenerationClient() {
  const api = getDesktopApi();
  return {
    startImageGeneration: (input: Record<string, unknown>, context?: { requestId?: string; correlationId?: string }) => api.startImageGeneration?.(input, context),
    readImageGeneration: (input: { requestId: string }, context?: { requestId?: string; correlationId?: string }) => api.readImageGeneration?.(input, context),
    cancelImageGeneration: (input: { requestId: string }, context?: { requestId?: string; correlationId?: string }) => api.cancelImageGeneration?.(input, context),
    finalizeImageGenerationIfCompleted: (input: { requestId: string }, context?: { requestId?: string; correlationId?: string }) => api.finalizeImageGenerationIfCompleted?.(input, context),
  };
}
