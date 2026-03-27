import { describe, expect, it } from "bun:test";
import {
  AtomicStudioRegistry,
  StudioRegistrationRegistry,
  StudioRegistrationKinds,
  StudioShellExtensionRegistry,
  StudioShellExtensionSlots,
} from "../StudioShellExtensions";
import { modelStudioRegistration } from "../registrations/ModelStudioRegistration";
import { datasetStudioRegistration } from "../registrations/DatasetStudioRegistration";
import { toolStudioRegistration } from "../registrations/ToolStudioRegistration";
import { promptTemplateStudioRegistration } from "../registrations/PromptTemplateStudioRegistration";
import { embeddingIndexStudioRegistration } from "../registrations/EmbeddingIndexStudioRegistration";
import { configProfileStudioRegistration } from "../registrations/ConfigProfileStudioRegistration";
import { workflowStudioRegistration } from "../registrations/WorkflowStudioRegistration";
import { contextBundleStudioRegistration } from "../registrations/ContextBundleStudioRegistration";
import { datasetPipelineStudioRegistration } from "../registrations/DatasetPipelineStudioRegistration";
import { trainingRecipeStudioRegistration } from "../registrations/TrainingRecipeStudioRegistration";
import { toolChainStudioRegistration } from "../registrations/ToolChainStudioRegistration";

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

describe("StudioRegistrationRegistry", () => {
  it("registers mixed atomic and composite studios with deterministic lookup/kind filtering", () => {
    const registry = new StudioRegistrationRegistry();
    registry.register(modelStudioRegistration);
    registry.register(datasetStudioRegistration);
    registry.register(workflowStudioRegistration);
    registry.register(contextBundleStudioRegistration);
    registry.register(datasetPipelineStudioRegistration);
    registry.register(trainingRecipeStudioRegistration);
    registry.register(toolChainStudioRegistration);

    expect(registry.get("workflow-studio")?.kind).toBe("composite");
    expect(registry.get("workflow-studio")?.role).toBe("workflow");
    expect(registry.get("workflow-studio")?.allowedBehaviorKinds).toEqual(["deterministic", "conditional", "iterative"]);
    expect(registry.listByKind(StudioRegistrationKinds.atomic).map((entry) => entry.studioType)).toEqual([
      "dataset-studio",
      "model-studio",
    ]);
    expect(registry.listByKind(StudioRegistrationKinds.composite).map((entry) => entry.studioType)).toEqual([
      "context-bundle-studio",
      "dataset-pipeline-studio",
      "tool-chain-studio",
      "training-recipe-studio",
      "workflow-studio",
    ]);
    for (const entry of registry.listByKind(StudioRegistrationKinds.composite)) {
      expect(entry.defaults.metadataPatch?.contract).toBeDefined();
    }
  });

  it("rejects unsupported composite roles and duplicate studio types", () => {
    const registry = new StudioRegistrationRegistry();
    registry.register(workflowStudioRegistration);
    expect(() => registry.register(workflowStudioRegistration)).toThrow("already registered");
    expect(() => registry.register({
      ...workflowStudioRegistration,
      studioType: "bad-composite-role",
      role: "agent",
    })).toThrow("not supported");
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
