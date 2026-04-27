import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModelsFeature } from "../components/ModelsFeature";

function createClientDouble() {
  return {
    browseModels: vi.fn().mockResolvedValue({
      models: [{
        provider: "huggingface",
        modelId: "org/demo-model",
        displayName: "Demo Model",
        authorOrOrg: "org",
        taskTags: ["text-generation"],
        downloads: 100,
        likes: 10,
        license: "apache-2.0",
        inferenceMode: "causal",
      }],
    }),
    getModelDetails: vi.fn().mockResolvedValue({
      provider: "huggingface",
      modelId: "org/demo-model",
      displayName: "Demo Model",
      description: "Demo description",
      tags: ["text-generation"],
      siblings: ["model.safetensors", "tokenizer.json"],
      tokenizerAvailable: true,
      safetensorsAvailable: true,
      adapterAvailable: false,
      recommendedInferenceMode: "causal",
      warnings: ["gated model"],
    }),
    listModels: vi.fn().mockResolvedValue([
      {
        modelRecordId: "saved-1",
        displayName: "Saved Ref",
        source: "huggingface",
        lifecycleStatus: "saved-reference",
        artifactForm: "full-model",
        provider: "huggingface",
        modelId: "org/demo-model",
        createdAt: "2026-04-27T00:00:00.000Z",
      },
      {
        modelRecordId: "generated-1",
        displayName: "Generated Adapter",
        source: "generated",
        lifecycleStatus: "generated",
        artifactForm: "adapter",
        provider: "unknown",
        localPath: "/models/generated",
        createdAt: "2026-04-27T00:01:00.000Z",
      },
      {
        modelRecordId: "downloaded-1",
        displayName: "Downloaded Local",
        source: "local",
        lifecycleStatus: "downloaded",
        artifactForm: "full-model",
        provider: "huggingface",
        localPath: "/models/downloaded",
        createdAt: "2026-04-27T00:02:00.000Z",
      },
    ]),
    saveModelReference: vi.fn().mockResolvedValue({
      modelRecordId: "saved-2",
      displayName: "Demo Model",
      source: "huggingface",
      lifecycleStatus: "saved-reference",
      artifactForm: "full-model",
      provider: "huggingface",
      modelId: "org/demo-model",
      createdAt: "2026-04-27T00:03:00.000Z",
    }),
    updateModelRecord: vi.fn(),
    deleteModelRecord: vi.fn().mockResolvedValue({
      deletedModelRecordId: "saved-1",
      deletedRegistryRecord: true,
      deletedLocalFiles: false,
      deletedBackingArtifactIds: [],
    }),
  };
}

describe("ModelsFeature", () => {
  let mountedRoot: Root | undefined;
  let mountedContainer: HTMLDivElement | undefined;

  afterEach(async () => {
    if (mountedRoot) {
      await act(async () => {
        mountedRoot?.unmount();
      });
    }
    mountedContainer?.remove();
    mountedRoot = undefined;
    mountedContainer = undefined;
  });

  it("renders tabs, supports browse/details/save, and manage/delete flows", async () => {
    const client = createClientDouble();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<ModelsFeature client={client as never} />);
    });

    expect(container.textContent).toContain("Browse Models");
    expect(container.textContent).toContain("Manage Models");
    expect(container.textContent).toContain("Train Model");

    const searchButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Search Models");
    await act(async () => {
      searchButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(client.browseModels).toHaveBeenCalled();

    const viewDetails = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "View Details");
    await act(async () => {
      viewDetails?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(client.getModelDetails).toHaveBeenCalledWith({ provider: "huggingface", modelId: "org/demo-model" });
    expect(container.textContent).toContain("Demo description");

    const saveButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Save Model Reference");
    await act(async () => {
      saveButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(client.saveModelReference).toHaveBeenCalled();

    const manageTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Manage Models");
    await act(async () => {
      manageTab?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Saved: 1 · Generated: 1 · Downloaded: 1");

    const deleteButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Delete Record");
    await act(async () => {
      deleteButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    const confirmDeleteButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Confirm Registry Delete") as HTMLButtonElement | undefined;
    expect(confirmDeleteButton?.disabled).toBe(true);
    const confirmInput = container.querySelector("input[placeholder='Delete']") as HTMLInputElement;
    await act(async () => {
      confirmInput.value = "Delete";
      confirmInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(confirmDeleteButton?.disabled).toBe(false);
    await act(async () => {
      confirmDeleteButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(client.deleteModelRecord).toHaveBeenCalledWith({ modelRecordId: "saved-1", deleteBackingArtifacts: false, deleteLocalFiles: false });

    const trainTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Train Model");
    await act(async () => {
      trainTab?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Base model");
    expect(container.textContent).not.toContain("Run Training");
    expect(container.textContent).not.toContain("Artifact Browser");
  });
});
