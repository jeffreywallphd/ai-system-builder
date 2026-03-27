import { describe, expect, it } from "bun:test";
import { AtomicStudioRegistry, StudioShellExtensionRegistry, StudioShellExtensionSlots } from "../StudioShellExtensions";
import { modelStudioRegistration } from "../registrations/ModelStudioRegistration";
import { datasetStudioRegistration } from "../registrations/DatasetStudioRegistration";
import { toolStudioRegistration } from "../registrations/ToolStudioRegistration";
import { promptTemplateStudioRegistration } from "../registrations/PromptTemplateStudioRegistration";
import { embeddingIndexStudioRegistration } from "../registrations/EmbeddingIndexStudioRegistration";
import { configProfileStudioRegistration } from "../registrations/ConfigProfileStudioRegistration";

describe("StudioShellExtensionRegistry", () => {
  it("registers contributions by slot and sorts by order then id", () => {
    const registry = new StudioShellExtensionRegistry();
    registry.registerMany([
      {
        id: "metadata-z",
        slot: StudioShellExtensionSlots.metadata,
        title: "Metadata Z",
        order: 20,
        render: () => null,
      },
      {
        id: "metadata-a",
        slot: StudioShellExtensionSlots.metadata,
        title: "Metadata A",
        order: 5,
        render: () => null,
      },
      {
        id: "metadata-b",
        slot: StudioShellExtensionSlots.metadata,
        title: "Metadata B",
        render: () => null,
      },
    ]);

    expect(registry.listBySlot(StudioShellExtensionSlots.metadata).map((entry) => entry.id)).toEqual([
      "metadata-a",
      "metadata-z",
      "metadata-b",
    ]);
  });

  it("rejects empty or duplicate extension ids", () => {
    const registry = new StudioShellExtensionRegistry();
    expect(() => registry.register({
      id: "   ",
      slot: StudioShellExtensionSlots.lifecycle,
      title: "Invalid",
      render: () => null,
    })).toThrow("id is required");

    registry.register({
      id: "lifecycle-extra",
      slot: StudioShellExtensionSlots.lifecycle,
      title: "Lifecycle Extra",
      render: () => null,
    });

    expect(() => registry.register({
      id: "lifecycle-extra",
      slot: StudioShellExtensionSlots.lifecycle,
      title: "Duplicate",
      render: () => null,
    })).toThrow("already registered");
  });
});

describe("AtomicStudioRegistry", () => {
  it("registers atomic studios with deterministic lookup and extension slot composition", () => {
    const registry = new AtomicStudioRegistry();
    registry.register({
      ...modelStudioRegistration,
      extensions: [
        {
          id: "model-lifecycle-panel",
          slot: StudioShellExtensionSlots.lifecycle,
          title: "Model Lifecycle",
          render: () => null,
        },
      ],
    });

    expect(registry.get("model-studio")?.role).toBe("model");
    registry.register(datasetStudioRegistration);
    registry.register(toolStudioRegistration);
    registry.register(promptTemplateStudioRegistration);
    registry.register(embeddingIndexStudioRegistration);
    registry.register(configProfileStudioRegistration);

    expect(registry.list().map((entry) => entry.studioType)).toEqual([
      "config-profile-studio",
      "dataset-studio",
      "embedding-index-studio",
      "model-studio",
      "prompt-template-studio",
      "tool-studio",
    ]);
    expect(registry.listExtensionsBySlot("model-studio", StudioShellExtensionSlots.lifecycle).map((entry) => entry.id)).toEqual([
      "model-lifecycle-panel",
    ]);
  });

  it("rejects unsupported roles and duplicate studio types", () => {
    const registry = new AtomicStudioRegistry();
    registry.register(modelStudioRegistration);

    expect(() => registry.register(modelStudioRegistration)).toThrow("already registered");
    expect(() => registry.register({
      ...modelStudioRegistration,
      studioType: "invalid-role",
      studioId: "studio-invalid",
      role: "workflow" as "model",
    })).toThrow("not supported");
  });
});
