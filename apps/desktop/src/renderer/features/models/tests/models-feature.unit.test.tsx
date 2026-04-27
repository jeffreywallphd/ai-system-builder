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
    trainModel: vi.fn().mockResolvedValue({
      runId: "run-1",
      status: "succeeded",
      outputModel: {
        modelRecordId: "generated-1",
        displayName: "My LoRA Adapter",
        source: "generated",
        lifecycleStatus: "generated",
        artifactForm: "adapter",
        provider: "unknown",
        createdAt: "2026-04-27T00:05:00.000Z",
      },
    }),
    validateModel: vi.fn().mockResolvedValue({ modelRecordId: "generated-1", status: "valid", reportPath: "/tmp/report.md" }),
    publishModel: vi.fn().mockResolvedValue({ modelRecordId: "generated-1", published: true, provider: "huggingface", repository: "owner/repo" }),
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

  it("renders train form and submits model training through dedicated training flow", async () => {
    const client = createClientDouble();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<ModelsFeature client={client as never} />);
    });

    const trainTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Train Model");
    await act(async () => {
      trainTab?.dispatchEvent(new Event("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Current backend support: LoRA, QLoRA, and full fine-tuning");
    expect(container.textContent).toContain("Dataset artifact IDs");

    const datasetInput = container.querySelector("input[placeholder='artifact-1,artifact-2']") as HTMLInputElement;
    await act(async () => {
      datasetInput.value = "dataset-1";
      datasetInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const baseModelSelect = container.querySelector("select.ui-input") as HTMLSelectElement;
    if (baseModelSelect?.options?.length > 1) {
      await act(async () => {
        baseModelSelect.value = baseModelSelect.options[1]?.value ?? "";
        baseModelSelect.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    const submitButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Start Training") as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);

    await act(async () => {
      submitButton.dispatchEvent(new Event("click", { bubbles: true }));
    });

    expect(client.trainModel).toHaveBeenCalled();
    expect(container.textContent).toContain("Generated model record: generated-1");
    expect(container.textContent).not.toContain("planning shell");
  });

  it("shows validate and disabled publish actions in manage models tab", async () => {
    const client = createClientDouble();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<ModelsFeature client={client as never} />);
    });

    const manageTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Manage Models");
    await act(async () => {
      manageTab?.dispatchEvent(new Event("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Validate");
    const publishButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Publish") as HTMLButtonElement;
    expect(publishButton.disabled).toBe(true);
  });
});
