import {
  getDesktopApi,
  type DesktopPrepareTrainingDatasetInput,
  type DesktopPreparedTrainingDatasetResult,
  type DesktopArtifactBrowseItem,
} from "../../../lib/desktopApi";
import { normalizeDatasetPreparationTransportError } from "../hooks/datasetPreparationTransport";

interface PreloadResponseEnvelope {
  ok: boolean;
  value?: unknown;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

function isPreloadResponseEnvelope(value: unknown): value is PreloadResponseEnvelope {
  return typeof value === "object" && value !== null && "ok" in value;
}

export type DesktopDatasetPreparationResult =
  | { ok: true; value: DesktopPreparedTrainingDatasetResult }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> } };

export interface DesktopDatasetPreparationRequestContext {
  requestId?: string;
  correlationId?: string;
}

export interface DesktopDatasetPreparationClient {
  browseSourceArtifacts: () => Promise<Array<{ artifactId: string; label: string; storageKey: string }>>;
  startPrepareTrainingDataset: (
    input: DesktopPrepareTrainingDatasetInput,
    context?: DesktopDatasetPreparationRequestContext,
  ) => Promise<{ requestId: string } | { error: { code: string; message: string; details?: Record<string, unknown> } }>;
  readPrepareTrainingDatasetTask: (
    requestId: string,
  ) => Promise<DesktopDatasetPreparationResult | { ok: true; pending: true; progress?: { message?: string; processed?: number; total?: number } }>;
}

function ensureSuccessEnvelope(response: unknown, fallbackMessage: string): { value?: unknown } {
  if (!isPreloadResponseEnvelope(response)) {
    throw new Error(fallbackMessage);
  }

  if (!response.ok) {
    throw new Error(response.error?.message ?? fallbackMessage);
  }

  return { value: response.value };
}

function toBrowseItems(value: unknown): DesktopArtifactBrowseItem[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  const items = (value as { items?: DesktopArtifactBrowseItem[] }).items;
  return Array.isArray(items) ? items : [];
}

export function createDesktopDatasetPreparationClient(): DesktopDatasetPreparationClient {
  const desktopApi = getDesktopApi();

  return {
    async browseSourceArtifacts() {
      const payload = ensureSuccessEnvelope(
        await desktopApi.browseArtifacts(),
        "Failed to browse source artifacts.",
      );

      return toBrowseItems(payload.value).map((artifact) => {
        if (typeof artifact.artifactId !== "string" || artifact.artifactId.trim().length === 0) {
          throw new Error("Artifact browse item is missing artifactId.");
        }
        if (typeof artifact.storageKey !== "string" || artifact.storageKey.trim().length === 0) {
          throw new Error("Artifact browse item is missing storageKey.");
        }

        return {
          artifactId: artifact.artifactId,
          label: artifact.originalName ?? artifact.storageKey,
          storageKey: artifact.storageKey,
        };
      });
    },

    async startPrepareTrainingDataset(
      input: DesktopPrepareTrainingDatasetInput,
      context?: DesktopDatasetPreparationRequestContext,
    ) {
      if (!desktopApi.startPrepareTrainingDataset) {
        return {
          error: {
            code: "unavailable",
            message: "Dataset preparation is unavailable.",
          },
        };
      }

      try {
        const response = await desktopApi.startPrepareTrainingDataset(input, context);
        const payload = ensureSuccessEnvelope(response, "Dataset preparation failed to start.");
        const requestId = (payload.value as { requestId?: string } | undefined)?.requestId;
        if (typeof requestId !== "string" || requestId.trim().length === 0) {
          return {
            error: { code: "internal", message: "Dataset preparation start response missing requestId." },
          };
        }
        return { requestId };
      } catch (error) {
        throw normalizeDatasetPreparationTransportError(error);
      }
    },

    async readPrepareTrainingDatasetTask(requestId: string) {
      if (!desktopApi.readPrepareTrainingDatasetTask) {
        return { ok: false, error: { code: "unavailable", message: "Dataset preparation is unavailable." } };
      }

      try {
        const response = await desktopApi.readPrepareTrainingDatasetTask({ requestId });
        if (!isPreloadResponseEnvelope(response)) {
          return { ok: false, error: { code: "internal", message: "Dataset preparation task read failed." } };
        }
        if (!response.ok) {
          return { ok: false, error: { code: response.error?.code ?? "internal", message: response.error?.message ?? "Dataset preparation failed.", details: response.error?.details } };
        }
        const value = response.value as { status?: string; progress?: { message?: string; processed?: number; total?: number }; result?: DesktopPreparedTrainingDatasetResult; error?: { message?: string } } | undefined;
        if (value?.status === "succeeded" && value.result) {
          return { ok: true, value: value.result };
        }
        if (value?.status === "failed") {
          return { ok: false, error: { code: "failed", message: value.error?.message ?? "Dataset preparation failed." } };
        }
        return { ok: true, pending: true as const, progress: value?.progress };
      } catch (error) {
        throw normalizeDatasetPreparationTransportError(error);
      }
    },
  };
}
