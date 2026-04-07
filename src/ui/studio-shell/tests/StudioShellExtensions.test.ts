import { describe, expect, it } from "bun:test";
import {
  AtomicStudioRegistry,
  SystemStudioRegistry,
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
import { systemStudioRegistration } from "../registrations/SystemStudioRegistration";

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
    registry.register(systemStudioRegistration);

    expect(registry.get("workflow-studio")?.kind).toBe("composite");
    expect(registry.get("workflow-studio")?.role).toBe("workflow");
    expect(registry.get("workflow-studio")?.allowedBehaviorKinds).toEqual(["deterministic", "conditional", "iterative"]);
    expect(registry.get("workflow-studio")?.shell?.toolbar?.actions.map((entry) => entry.id)).toEqual([
      "workflow-studio-toolbar-mode-wizard",
      "workflow-studio-toolbar-mode-canvas",
      "workflow-studio-toolbar-save",
      "workflow-studio-toolbar-validate",
      "workflow-studio-toolbar-run-workflow",
      "workflow-studio-toolbar-refresh",
    ]);
    expect(registry.get("workflow-studio")?.shell?.drawers).toEqual({
      left: {
        label: "Nodes",
        defaultOpen: false,
      },
      right: {
        label: "Inspector",
        defaultOpen: true,
      },
    });
    expect(registry.listExtensionsBySlot("workflow-studio", StudioShellExtensionSlots.draftAuthoring).map((entry) => entry.id)).toContain(
      "workflow-studio-mode-abstraction",
    );
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
    expect(registry.listByKind(StudioRegistrationKinds.system).map((entry) => entry.studioType)).toEqual([
      "system-studio",
    ]);
    for (const entry of registry.listByKind(StudioRegistrationKinds.composite)) {
      expect(entry.defaults.metadataPatch?.contract).toBeDefined();
    }
    expect(registry.get("system-studio")?.kind).toBe("system");
    expect(registry.get("system-studio")?.role).toBe("system");
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

  it("rejects invalid or duplicate toolbar action configuration", () => {
    const registry = new StudioRegistrationRegistry();

    expect(() => registry.register({
      ...workflowStudioRegistration,
      studioType: "workflow-studio-invalid-toolbar-mode",
      studioId: "studio-workflow-invalid-toolbar-mode",
      shell: {
        ...(workflowStudioRegistration.shell ?? {}),
        toolbar: {
          actions: [
            {
              id: "invalid-mode",
              kind: "set-workflow-mode",
              modeId: "unknown" as "wizard",
              label: "Invalid",
            },
          ],
        },
      },
    })).toThrow("unsupported workflow mode");

    expect(() => registry.register({
      ...workflowStudioRegistration,
      studioType: "workflow-studio-duplicate-toolbar-actions",
      studioId: "studio-workflow-duplicate-toolbar-actions",
      shell: {
        ...(workflowStudioRegistration.shell ?? {}),
        toolbar: {
          actions: [
            {
              id: "duplicate-action",
              kind: "refresh-snapshot",
              label: "Refresh",
            },
            {
              id: "duplicate-action",
              kind: "save-draft",
              label: "Save",
            },
          ],
        },
      },
    })).toThrow("is duplicated");
  });

  it("rejects invalid drawer toggle configuration", () => {
    const registry = new StudioRegistrationRegistry();

    expect(() => registry.register({
      ...workflowStudioRegistration,
      studioType: "workflow-studio-invalid-drawers",
      studioId: "studio-workflow-invalid-drawers",
      shell: {
        ...(workflowStudioRegistration.shell ?? {}),
        drawers: {
          left: {
            label: "   ",
          },
        },
      },
    })).toThrow("drawer label is required");

    expect(() => registry.register({
      ...workflowStudioRegistration,
      studioType: "workflow-studio-empty-drawers",
      studioId: "studio-workflow-empty-drawers",
      shell: {
        ...(workflowStudioRegistration.shell ?? {}),
        drawers: {},
      },
    })).toThrow("must declare at least one side");
  });
});

describe("SystemStudioRegistry", () => {
  it("registers system studios and preserves explicit system-of-systems composition capabilities", () => {
    const registry = new SystemStudioRegistry();
    registry.register(systemStudioRegistration);

    expect(registry.get("system-studio")?.kind).toBe("system");
    expect(registry.get("system-studio")?.compositionCapabilities.supportsSystemAssets).toBeTrue();
    expect(registry.get("system-studio")?.compositionCapabilities.supportsNestedSystemAssets).toBeTrue();
    expect(registry.get("system-studio")?.defaults.metadataPatch?.taxonomy).toEqual({
      structuralKind: "system",
      semanticRole: "system",
      behaviorKind: "deterministic",
    });
    expect(registry.get("system-studio")?.defaults.metadataPatch?.contract).toBeDefined();
    expect(registry.list().map((entry) => entry.studioType)).toEqual(["system-studio"]);
    expect(registry.listExtensionsBySlot("system-studio", StudioShellExtensionSlots.dependencies)).toHaveLength(0);
  });

  it("rejects unsupported roles and duplicate system studio types", () => {
    const registry = new SystemStudioRegistry();
    registry.register(systemStudioRegistration);

    expect(() => registry.register(systemStudioRegistration)).toThrow("already registered");
    expect(() => registry.register({
      ...systemStudioRegistration,
      studioType: "invalid-system-role",
      studioId: "studio-invalid-system-role",
      role: "workflow" as "system",
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
