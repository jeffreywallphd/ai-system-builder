import { afterEach, describe, expect, it, vi } from "vitest";

import { createApplicationSettingsApi } from "./applicationSettingsApi";

describe("applicationSettingsApi", () => {
  afterEach(() => {
    delete window.desktopApi;
  });

  it("calls preload settings methods", async () => {
    window.desktopApi = {
      listApplicationSettingDefinitions: vi.fn().mockResolvedValue({ ok: true, value: { definitions: [] } }),
      readApplicationSettings: vi.fn().mockResolvedValue({ ok: true, value: { values: [] } }),
      updateApplicationSetting: vi.fn().mockResolvedValue({ ok: true, value: { value: { key: "huggingface.token", configured: true, masked: true, maskedValue: "********" } } }),
      clearApplicationSetting: vi.fn().mockResolvedValue({ ok: true, value: { value: { key: "huggingface.token", configured: false } } }),
      resolveModelDefault: vi.fn().mockResolvedValue({ ok: true, value: { resolved: { provider: "transformers", modelId: "m", inferenceMode: "text2text", source: "builtin" } } }),
    } as never;

    const api = createApplicationSettingsApi();
    await api.listDefinitions();
    await api.readSettings();
    const update = await api.updateSetting({ key: "huggingface.token", value: "hf_secret" });
    await api.clearSetting({ key: "huggingface.token" });
    const resolved = await api.resolveModelDefault({ taskKey: "qaGeneration" });

    expect(window.desktopApi.listApplicationSettingDefinitions).toHaveBeenCalledOnce();
    expect(window.desktopApi.readApplicationSettings).toHaveBeenCalledOnce();
    expect(window.desktopApi.updateApplicationSetting).toHaveBeenCalledWith({ key: "huggingface.token", value: "hf_secret" });
    expect(update.value.maskedValue).toBe("********");
    expect(resolved.resolved.inferenceMode).toBe("text2text");
  });
});
