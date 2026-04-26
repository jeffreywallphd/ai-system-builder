import { afterEach, describe, expect, it, vi } from "vitest";

import { createApplicationSettingsApi } from "./applicationSettingsApi";

describe("applicationSettingsApi", () => {
  afterEach(() => {
    delete window.desktopApi;
  });

  it("calls preload application settings methods and returns masked secret values", async () => {
    window.desktopApi = {
      listApplicationSettingDefinitions: vi.fn().mockResolvedValue({ ok: true, value: { definitions: [] } }),
      readApplicationSettings: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          values: [
            {
              key: "huggingface.token",
              configured: true,
              masked: true,
              maskedValue: "********",
            },
          ],
        },
      }),
      updateApplicationSetting: vi.fn().mockResolvedValue({ ok: true, value: { value: { key: "huggingface.token", configured: true, masked: true, maskedValue: "********" } } }),
      clearApplicationSetting: vi.fn().mockResolvedValue({ ok: true, value: { value: { key: "huggingface.token", configured: false } } }),
      resolveApplicationModelDefault: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          resolved: {
            provider: "transformers",
            modelId: "m",
            inferenceMode: "text2text",
            source: "task",
            settingKey: "models.tasks.qaGeneration.default",
          },
        },
      }),
    } as never;

    const api = createApplicationSettingsApi();
    await api.listDefinitions();
    const read = await api.readSettings();
    const update = await api.updateSetting({ key: "huggingface.token", value: "hf_secret" });
    await api.clearSetting({ key: "huggingface.token" });
    const resolved = await api.resolveModelDefault({ taskKey: "qaGeneration" });

    expect(window.desktopApi.listApplicationSettingDefinitions).toHaveBeenCalledOnce();
    expect(window.desktopApi.readApplicationSettings).toHaveBeenCalledOnce();
    expect(window.desktopApi.updateApplicationSetting).toHaveBeenCalledWith({ key: "huggingface.token", value: "hf_secret" });
    expect(read.values[0]).not.toHaveProperty("value");
    expect(update.value.maskedValue).toBe("********");
    expect(resolved.resolved).toEqual(expect.objectContaining({
      provider: "transformers",
      modelId: "m",
      inferenceMode: "text2text",
      source: "task",
      settingKey: "models.tasks.qaGeneration.default",
    }));
  });

  it("falls back to legacy resolveModelDefault preload bridge", async () => {
    window.desktopApi = {
      listApplicationSettingDefinitions: vi.fn().mockResolvedValue({ ok: true, value: { definitions: [] } }),
      readApplicationSettings: vi.fn().mockResolvedValue({ ok: true, value: { values: [] } }),
      updateApplicationSetting: vi.fn().mockResolvedValue({ ok: true, value: { value: { key: "k", configured: true } } }),
      clearApplicationSetting: vi.fn().mockResolvedValue({ ok: true, value: { value: { key: "k", configured: false } } }),
      resolveModelDefault: vi.fn().mockResolvedValue({ ok: true, value: { resolved: { provider: "transformers", modelId: "x", inferenceMode: "chat", source: "builtin" } } }),
    } as never;

    const api = createApplicationSettingsApi();
    const resolved = await api.resolveModelDefault({ taskKey: "qaGeneration" });

    expect(window.desktopApi.resolveModelDefault).toHaveBeenCalledOnce();
    expect(resolved.resolved.inferenceMode).toBe("chat");
  });
});
