import {
  getDesktopApi,
  type DesktopApplicationSettingsDefinitionsResult,
  type DesktopApplicationSettingsReadResult,
  type DesktopApplicationSettingUpdateResult,
  type DesktopResolvedModelDefaultResult,
} from "./desktopApi";

function ensureSuccess<T>(
  response: unknown,
  pick: (value: unknown) => T,
  fallback: string,
): T {
  if (typeof response !== "object" || response === null || !('ok' in response)) {
    throw new Error(fallback);
  }

  const envelope = response as { ok: boolean; value?: unknown; error?: { message?: string } };
  if (!envelope.ok) {
    throw new Error(envelope.error?.message ?? fallback);
  }

  return pick(envelope.value);
}

export interface ApplicationSettingsApi {
  listDefinitions: (input?: { category?: string; keys?: string[] }) => Promise<DesktopApplicationSettingsDefinitionsResult>;
  readSettings: (input?: { category?: string; keys?: string[] }) => Promise<DesktopApplicationSettingsReadResult>;
  updateSetting: (input: { key: string; value: unknown }) => Promise<DesktopApplicationSettingUpdateResult>;
  clearSetting: (input: { key: string }) => Promise<DesktopApplicationSettingUpdateResult>;
  resolveModelDefault: (input: { taskKey: string; featureKey?: string }) => Promise<DesktopResolvedModelDefaultResult>;
}

export function createApplicationSettingsApi(): ApplicationSettingsApi {
  const desktopApi = getDesktopApi();

  return {
    async listDefinitions(input = {}) {
      if (!desktopApi.listApplicationSettingDefinitions) {
        throw new Error("Desktop preload application settings list-definitions bridge is unavailable.");
      }
      return ensureSuccess(
        await desktopApi.listApplicationSettingDefinitions(input),
        (value) => value as DesktopApplicationSettingsDefinitionsResult,
        "Failed to list application setting definitions.",
      );
    },

    async readSettings(input = {}) {
      if (!desktopApi.readApplicationSettings) {
        throw new Error("Desktop preload application settings read bridge is unavailable.");
      }
      return ensureSuccess(
        await desktopApi.readApplicationSettings(input),
        (value) => value as DesktopApplicationSettingsReadResult,
        "Failed to read application settings.",
      );
    },

    async updateSetting(input) {
      if (!desktopApi.updateApplicationSetting) {
        throw new Error("Desktop preload application settings update bridge is unavailable.");
      }
      return ensureSuccess(
        await desktopApi.updateApplicationSetting(input),
        (value) => value as DesktopApplicationSettingUpdateResult,
        "Failed to update application setting.",
      );
    },

    async clearSetting(input) {
      if (!desktopApi.clearApplicationSetting) {
        throw new Error("Desktop preload application settings clear bridge is unavailable.");
      }
      return ensureSuccess(
        await desktopApi.clearApplicationSetting(input),
        (value) => value as DesktopApplicationSettingUpdateResult,
        "Failed to clear application setting.",
      );
    },

    async resolveModelDefault(input) {
      if (!desktopApi.resolveModelDefault) {
        throw new Error("Desktop preload model default resolver bridge is unavailable.");
      }
      return ensureSuccess(
        await desktopApi.resolveModelDefault(input),
        (value) => value as DesktopResolvedModelDefaultResult,
        "Failed to resolve model default.",
      );
    },
  };
}
