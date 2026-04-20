import {
  getDesktopApi,
  type DesktopPrepareTemplatedDatasetInput,
  type DesktopPreparedTemplatedDatasetResult,
} from "../../../lib/desktopApi";

interface PreloadResponseEnvelope {
  ok: boolean;
  value?: unknown;
  error?: {
    code?: string;
    message?: string;
  };
}

function isPreloadResponseEnvelope(value: unknown): value is PreloadResponseEnvelope {
  return typeof value === "object" && value !== null && "ok" in value;
}

export type DesktopDatasetPreparationResult =
  | { ok: true; value: DesktopPreparedTemplatedDatasetResult }
  | { ok: false; error: { code: string; message: string } };

export interface DesktopDatasetPreparationClient {
  prepareTemplatedDatasetFromArtifacts: (
    input: DesktopPrepareTemplatedDatasetInput,
  ) => Promise<DesktopDatasetPreparationResult>;
}

export function createDesktopDatasetPreparationClient(): DesktopDatasetPreparationClient {
  const desktopApi = getDesktopApi();

  return {
    async prepareTemplatedDatasetFromArtifacts(input: DesktopPrepareTemplatedDatasetInput): Promise<DesktopDatasetPreparationResult> {
      if (!desktopApi.prepareTemplatedDatasetFromArtifacts) {
        return {
          ok: false,
          error: {
            code: "unavailable",
            message: "Dataset preparation is unavailable.",
          },
        };
      }

      const response = await desktopApi.prepareTemplatedDatasetFromArtifacts(input);
      if (!isPreloadResponseEnvelope(response)) {
        return {
          ok: false,
          error: {
            code: "internal",
            message: "Dataset preparation failed.",
          },
        };
      }

      if (!response.ok) {
        return {
          ok: false,
          error: {
            code: response.error?.code ?? "internal",
            message: response.error?.message ?? "Dataset preparation failed.",
          },
        };
      }

      const result = (response.value as { result?: DesktopPreparedTemplatedDatasetResult } | undefined)?.result;
      if (!result) {
        return {
          ok: false,
          error: {
            code: "internal",
            message: "Dataset preparation response missing result payload.",
          },
        };
      }

      return {
        ok: true,
        value: result,
      };
    },
  };
}
