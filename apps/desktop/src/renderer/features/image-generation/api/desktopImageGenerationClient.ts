import type { ImageGenerationRequest } from "../../../../../../../modules/contracts/image-generation";
import type { RuntimeTaskRecord } from "../../../../../../../modules/contracts/runtime";
import type { DesktopImageGenerationFinalizeResult } from "../../../../../../../modules/contracts/ipc/desktop-image-generation-contract";
import { getDesktopApi } from "../../../lib/desktopApi";

interface PreloadResponseEnvelope {
  ok: boolean;
  value?: unknown;
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
}

function isPreloadResponseEnvelope(value: unknown): value is PreloadResponseEnvelope {
  return typeof value === "object" && value !== null && "ok" in value;
}

function unavailable() {
  return { ok: false as const, error: { code: "unavailable", message: "Desktop image generation API is unavailable." } };
}

export type ImageGenerationStartResult =
  | { ok: true; value: { requestId: string } }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

export type ImageGenerationReadResult =
  | { ok: true; value: RuntimeTaskRecord }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

export type ImageGenerationCancelResult =
  | { ok: true; value: { cancelled: boolean; message?: string } }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

export type ImageGenerationFinalizeResult =
  | { ok: true; value: DesktopImageGenerationFinalizeResult }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

export function createDesktopImageGenerationClient() {
  const api = getDesktopApi();

  return {
    async startImageGeneration(input: ImageGenerationRequest, context?: { requestId?: string; correlationId?: string }): Promise<ImageGenerationStartResult> {
      if (!api.startImageGeneration) {
        return unavailable();
      }
      const response = await api.startImageGeneration(input, context);
      if (!isPreloadResponseEnvelope(response)) {
        return { ok: false, error: { code: "internal", message: "Failed to start image generation." } };
      }
      if (!response.ok) {
        return { ok: false, error: { code: response.error?.code ?? "internal", message: response.error?.message ?? "Failed to start image generation.", details: response.error?.details } };
      }
      const requestId = (response.value as { requestId?: string } | undefined)?.requestId;
      if (typeof requestId !== "string" || requestId.trim().length === 0) {
        return { ok: false, error: { code: "internal", message: "Image generation start response missing requestId." } };
      }
      return { ok: true, value: { requestId } };
    },

    async readImageGeneration(input: { requestId: string }, context?: { requestId?: string; correlationId?: string }): Promise<ImageGenerationReadResult> {
      if (!api.readImageGeneration) {
        return unavailable();
      }
      const response = await api.readImageGeneration(input, context);
      if (!isPreloadResponseEnvelope(response)) {
        return { ok: false, error: { code: "internal", message: "Failed to read image generation status." } };
      }
      if (!response.ok) {
        return { ok: false, error: { code: response.error?.code ?? "internal", message: response.error?.message ?? "Failed to read image generation status.", details: response.error?.details } };
      }
      return { ok: true, value: response.value as RuntimeTaskRecord };
    },

    async cancelImageGeneration(input: { requestId: string }, context?: { requestId?: string; correlationId?: string }): Promise<ImageGenerationCancelResult> {
      if (!api.cancelImageGeneration) {
        return unavailable();
      }
      const response = await api.cancelImageGeneration(input, context);
      if (!isPreloadResponseEnvelope(response)) {
        return { ok: false, error: { code: "internal", message: "Failed to cancel image generation task." } };
      }
      if (!response.ok) {
        return { ok: false, error: { code: response.error?.code ?? "internal", message: response.error?.message ?? "Failed to cancel image generation task.", details: response.error?.details } };
      }
      return { ok: true, value: response.value as { cancelled: boolean; message?: string } };
    },

    async finalizeImageGenerationIfCompleted(input: { requestId: string }, context?: { requestId?: string; correlationId?: string }): Promise<ImageGenerationFinalizeResult> {
      if (!api.finalizeImageGenerationIfCompleted) {
        return unavailable();
      }
      const response = await api.finalizeImageGenerationIfCompleted(input, context);
      if (!isPreloadResponseEnvelope(response)) {
        return { ok: false, error: { code: "internal", message: "Failed to finalize image generation task." } };
      }
      if (!response.ok) {
        return { ok: false, error: { code: response.error?.code ?? "internal", message: response.error?.message ?? "Failed to finalize image generation task.", details: response.error?.details } };
      }
      return { ok: true, value: response.value as DesktopImageGenerationFinalizeResult };
    },
  };
}
