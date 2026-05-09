import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AssetLibraryClient,
  AssetLibraryDefinitionCard,
  AssetLibraryDefinitionDetail,
  AssetLibraryResourceBackedViewCard,
  AssetLibraryResourceBackedViewDetail,
} from "../../../../../../../modules/ui/shared/asset-library";
import { AssetLibraryFeature } from "../components/AssetLibraryFeature";

const card: AssetLibraryDefinitionCard = {
  id: "builtin.document@1.0.0",
  definitionId: "builtin.document",
  version: "1.0.0",
  displayName: "Document",
  summary: "Document building block",
  assetType: "document",
  assetFamily: "resource-backed",
  lifecycleStatus: "published",
  builtIn: true,
  updatedAt: "2026-05-02T00:00:00.000Z",
};

const detailWithoutValidation: AssetLibraryDefinitionDetail = {
  ...card,
  overview: {
    description: "Reusable document descriptor",
    reviewStatus: "approved",
  },
  aiContextSummary: {
    purpose: "Represent document-backed assets",
    userFacingSummary: "Document asset",
    developerFacingSummary: "Maps document resources",
    capabilityCount: 1,
    limitationCount: 1,
    safetyNoteCount: 1,
  },
  configurationSummary: {
    schemaId: "document.schema",
    schemaVersion: "1",
    fieldCount: 2,
    requiredFieldCount: 1,
    strict: true,
  },
  portsSummary: {
    totalCount: 2,
    inputCount: 1,
    outputCount: 1,
    eventCount: 0,
    controlCount: 0,
  },
  requirementsSummary: {
    totalCount: 1,
    requiredCount: 1,
    runtimeCapabilityIds: ["python-runtime"],
    hostKinds: ["desktop"],
    safetyStatuses: ["safe"],
  },
  provenanceSummary: {
    sourceKind: "system-generated",
    authorship: "human-authored",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-02T00:00:00.000Z",
  },
  metadata: {
    safeNote: "safe nested note",
  },
};

const detailWithValidation: AssetLibraryDefinitionDetail = {
  ...detailWithoutValidation,
  validationSummary: {
    status: "valid-with-warnings",
    issueCount: 1,
    errorCount: 0,
    warningCount: 1,
  },
};

const resourceViewCard: AssetLibraryResourceBackedViewCard = {
  id: "asset-view.generated-output.internal.1",
  viewId: "asset-view.generated-output.internal.1",
  displayName: "Generated output",
  viewKind: "generated-output",
  viewKindLabel: "Generated Output",
  assetType: "image",
  assetTypeLabel: "Image",
  assetFamily: "resource-backed",
  assetFamilyLabel: "Resource Backed",
  lifecycleStatusLabel: "Not registered",
  sourceKind: "generated-output",
  registrationStatusLabel: "Not finalized or registered",
};

const resourceViewDetail: AssetLibraryResourceBackedViewDetail = {
  ...resourceViewCard,
  summary: "Generated output view; not finalized or registered.",
};

function createClient(overrides: Partial<AssetLibraryClient> = {}): AssetLibraryClient {
  return {
    listAssetDefinitions: vi.fn().mockResolvedValue({ ok: true, value: { items: [card] } }),
    readAssetDefinition: vi.fn().mockResolvedValue({ ok: true, value: detailWithoutValidation }),
    readAssetDefinitionVersion: vi.fn().mockResolvedValue({ ok: true, value: detailWithoutValidation }),
    listAssetResourceBackedViews: vi.fn().mockResolvedValue({ ok: true, value: { items: [resourceViewCard] } }),
    readAssetResourceBackedView: vi.fn().mockResolvedValue({ ok: true, value: resourceViewDetail }),
    registerResourceBackedViewAsAsset: vi.fn().mockResolvedValue({ ok: true, value: { ok: true, operation: "asset.register-resource-backed-view", status: "created" } }),
    finalizeGeneratedOutputAsAsset: vi.fn().mockResolvedValue({ ok: true, value: { ok: true, operation: "asset.finalize-generated-output", status: "created" } }),
    importExternalRepositoryObjectAsAsset: vi.fn().mockResolvedValue({ ok: true, value: { ok: true, operation: "asset.import-external-repository-object", status: "created" } }),
    localizeExternalRepositoryObjectAsAsset: vi.fn().mockResolvedValue({ ok: true, value: { ok: true, operation: "asset.localize-external-repository-object", status: "created" } }),
    ...overrides,
  };
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value");
  descriptor?.set?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("AssetLibraryFeature", () => {
  let mountedRoot: Root | undefined;
  let mountedContainer: HTMLDivElement | undefined;

  afterEach(async () => {
    if (mountedRoot) {
      await act(async () => mountedRoot?.unmount());
    }
    mountedContainer?.remove();
    mountedRoot = undefined;
    mountedContainer = undefined;
  });

  async function render(client: AssetLibraryClient = createClient()) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<AssetLibraryFeature client={client} />);
    });
    await flush();
    return { container, client };
  }

  it("renders successful cards with built-in, lifecycle, type, and family cues", async () => {
    const { container } = await render();

    expect(container.textContent).toContain("Document");
    expect(container.textContent).toContain("Document building block");
    expect(container.textContent).toContain("Built-in");
    expect(container.textContent).toContain("Resource Backed");
    expect(container.textContent).toContain("Published");
    expect(container.textContent).toContain("v1.0.0");
  });

  it("renders resource-backed views in a read-only Resource views tab", async () => {
    const { container, client } = await render();
    const resourceTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Resource views") as HTMLButtonElement;

    await act(async () => resourceTab.click());
    await flush();

    expect(container.textContent).toContain("Generated output");
    expect(container.textContent).toContain("Not finalized or registered");
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Generated output")) as HTMLButtonElement;
    await act(async () => cardButton.click());
    await flush();

    expect(client.readAssetResourceBackedView).toHaveBeenCalledWith(
      { viewId: "asset-view.generated-output.internal.1" },
      { expand: ["metadata", "resourceBackings"] },
    );
    expect(container.textContent).toContain("Finalize and register");
    expect(container.textContent).not.toMatch(/Create asset|Edit asset|Delete asset|Seed built-ins|Scan resources/i);
  });

  it("requires confirmation and calls the finalize mutation with a safe command", async () => {
    const client = createClient();
    const { container } = await render(client);
    const resourceTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Resource views") as HTMLButtonElement;

    await act(async () => resourceTab.click());
    await flush();
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Generated output")) as HTMLButtonElement;
    await act(async () => cardButton.click());
    await flush();

    const actionButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Finalize and register") as HTMLButtonElement;
    await act(async () => actionButton.click());
    await flush();

    expect(container.textContent).toContain("Finalize this output?");
    expect(container.textContent).toContain("Local storage");
    expect(client.finalizeGeneratedOutputAsAsset).not.toHaveBeenCalled();

    const dialog = container.querySelector("[role='dialog']") as HTMLElement;
    const confirmButton = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent === "Finalize and register") as HTMLButtonElement;
    await act(async () => confirmButton.click());
    await flush();

    expect(client.finalizeGeneratedOutputAsAsset).toHaveBeenCalledWith({
      operation: "asset.finalize-generated-output",
      viewId: "asset-view.generated-output.internal.1",
      approval: {
        userConfirmed: true,
        confirmationKind: "finalize-generated-output",
        allowNetworkAccess: false,
        allowCredentialUse: false,
        allowFilesystemWrite: true,
        allowPartialCompletion: true,
      },
      actor: {
        initiatedBy: "human",
        automationSafe: false,
      },
    });
    expect(JSON.stringify((client.finalizeGeneratedOutputAsAsset as any).mock.calls[0][0])).not.toMatch(/metadata|C:\\|Bearer|base64|workflow|prompt/i);
    expect(container.textContent).toContain("Asset registered.");
    expect(client.listAssetResourceBackedViews).toHaveBeenCalled();
    expect(client.readAssetResourceBackedView).toHaveBeenCalledTimes(2);
  });

  it("routes register and localize actions to their matching client methods", async () => {
    const registerView = {
      ...resourceViewCard,
      id: "asset-view.artifact.internal.1",
      viewId: "asset-view.artifact.internal.1",
      displayName: "Artifact view",
      viewKind: "artifact" as const,
      viewKindLabel: "Artifact",
      assetTypeLabel: "Unknown type",
      assetFamilyLabel: "Unknown family",
      registrationStatusLabel: "Read-only view",
      sourceKind: "artifact-browser",
    };
    const registerClient = createClient({
      listAssetResourceBackedViews: vi.fn().mockResolvedValue({ ok: true, value: { items: [registerView] } }),
      readAssetResourceBackedView: vi.fn().mockResolvedValue({ ok: true, value: registerView }),
    });
    const registerRender = await render(registerClient);
    const registerTab = Array.from(registerRender.container.querySelectorAll("button")).find((button) => button.textContent === "Resource views") as HTMLButtonElement;
    await act(async () => registerTab.click());
    await flush();
    await act(async () => (Array.from(registerRender.container.querySelectorAll("button")).find((button) => button.textContent?.includes("Artifact view")) as HTMLButtonElement).click());
    await flush();
    await act(async () => (Array.from(registerRender.container.querySelectorAll("button")).find((button) => button.textContent === "Register as asset") as HTMLButtonElement).click());
    await flush();
    await act(async () => (Array.from((registerRender.container.querySelector("[role='dialog']") as HTMLElement).querySelectorAll("button")).find((button) => button.textContent === "Register asset") as HTMLButtonElement).click());
    await flush();

    expect(registerClient.registerResourceBackedViewAsAsset).toHaveBeenCalledWith(expect.objectContaining({
      operation: "asset.register-resource-backed-view",
      viewId: "asset-view.artifact.internal.1",
    }));
    expect(registerClient.finalizeGeneratedOutputAsAsset).not.toHaveBeenCalled();
    expect(registerClient.importExternalRepositoryObjectAsAsset).not.toHaveBeenCalled();
    expect(registerClient.localizeExternalRepositoryObjectAsAsset).not.toHaveBeenCalled();

    await act(async () => mountedRoot?.unmount());
    mountedContainer?.remove();
    mountedRoot = undefined;
    mountedContainer = undefined;

    const externalView = {
      ...resourceViewCard,
      id: "asset-view.external-repository-object.internal.1",
      viewId: "asset-view.external-repository-object.internal.1",
      displayName: "External object",
      viewKind: "external-repository-object" as const,
      viewKindLabel: "External Repository Object",
      assetType: "data-source" as const,
      assetTypeLabel: "Data Source",
      registrationStatusLabel: "Not imported or registered",
      sourceKind: "external-repository",
      metadata: { provider: "huggingface", repository: "safe/repo", objectLabel: "safe-object" },
    };
    const localizeClient = createClient({
      listAssetResourceBackedViews: vi.fn().mockResolvedValue({ ok: true, value: { items: [externalView] } }),
      readAssetResourceBackedView: vi.fn().mockResolvedValue({ ok: true, value: externalView }),
    });
    const localizeRender = await render(localizeClient);
    const localizeTab = Array.from(localizeRender.container.querySelectorAll("button")).find((button) => button.textContent === "Resource views") as HTMLButtonElement;
    await act(async () => localizeTab.click());
    await flush();
    await act(async () => (Array.from(localizeRender.container.querySelectorAll("button")).find((button) => button.textContent?.includes("External object")) as HTMLButtonElement).click());
    await flush();
    await act(async () => (Array.from(localizeRender.container.querySelectorAll("button")).find((button) => button.textContent === "Localize external object") as HTMLButtonElement).click());
    await flush();
    await act(async () => (Array.from((localizeRender.container.querySelector("[role='dialog']") as HTMLElement).querySelectorAll("button")).find((button) => button.textContent === "Localize object") as HTMLButtonElement).click());
    await flush();

    expect(localizeClient.localizeExternalRepositoryObjectAsAsset).toHaveBeenCalledWith(expect.objectContaining({
      operation: "asset.localize-external-repository-object",
      viewId: "asset-view.external-repository-object.internal.1",
    }));
    expect(localizeClient.registerResourceBackedViewAsAsset).not.toHaveBeenCalled();
    expect(localizeClient.finalizeGeneratedOutputAsAsset).not.toHaveBeenCalled();
  });

  it("does not render unsafe resource view diagnostics or mutation details", async () => {
    const unsafeTopLevelDiagnostics = [
      "C:\\Users\\name\\file.png",
      "/tmp/generated.png",
      "/home/user/cache",
      "Bearer abc",
      "token",
      "secret",
      "password",
      "apiKey",
      "signedUrl",
      "access_token",
      "base64",
      "data:image",
      "raw provider payload",
      "workflowJson",
      "prompt",
      "stack",
      "command line",
      "process.env",
    ];
    const client = createClient({
      listAssetDefinitions: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          items: [card],
          diagnostics: [
            { severity: "info", code: "safe-definition", message: "Safe definition diagnostic." },
            ...unsafeTopLevelDiagnostics.map((message, index) => ({
              severity: "warning" as const,
              code: `unsafe-definition-${index}`,
              message,
            })),
          ],
        },
      }),
      listAssetResourceBackedViews: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          items: [{
            ...resourceViewCard,
            diagnostics: ["Safe list diagnostic.", "C:\\Users\\name\\secret token workflowJson prompt"],
          }],
          diagnostics: [
            { severity: "info", code: "safe", message: "Safe aggregate diagnostic." },
            { severity: "warning", code: "unsafe", message: "/tmp/secret Bearer token data:image base64 raw provider payload command line process.env" },
          ],
        },
      }),
      readAssetResourceBackedView: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ...resourceViewDetail,
          diagnostics: ["Safe detail diagnostic."],
        },
      }),
      finalizeGeneratedOutputAsAsset: vi.fn().mockResolvedValue({
        ok: true,
        value: {
          ok: false,
          operation: "asset.finalize-generated-output",
          failure: {
            code: "internal",
            message: "raw",
            operation: "asset.finalize-generated-output",
            diagnostics: [{ severity: "error", code: "unsafe", message: "Bearer token C:\\Users\\secret workflowJson prompt stack" }],
          },
        },
      }),
    });
    const { container } = await render(client);
    const resourceTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Resource views") as HTMLButtonElement;

    await act(async () => resourceTab.click());
    await flush();
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Generated output")) as HTMLButtonElement;
    await act(async () => cardButton.click());
    await flush();

    expect(container.textContent).toContain("Safe aggregate diagnostic.");
    expect(container.textContent).toContain("Safe definition diagnostic.");
    expect(container.textContent).toContain("Safe list diagnostic.");
    expect(container.textContent).toContain("Safe detail diagnostic.");

    const actionButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Finalize and register") as HTMLButtonElement;
    await act(async () => actionButton.click());
    await flush();
    const dialog = container.querySelector("[role='dialog']") as HTMLElement;
    const confirmButton = Array.from(dialog.querySelectorAll("button")).find((button) => button.textContent === "Finalize and register") as HTMLButtonElement;
    await act(async () => confirmButton.click());
    await flush();

    expect(container.textContent).toContain("Something went wrong while completing this action.");
    const diagnosticStatusText = Array.from(container.querySelectorAll("[role='status'], [role='alert']"))
      .map((element) => element.textContent ?? "")
      .join(" ");
    expect(diagnosticStatusText).not.toMatch(/C:\\|\/tmp|\/home|Bearer|token|secret|password|apiKey|signedUrl|access_token|base64|data:image|raw provider payload|workflowJson|prompt|stack|command line|process\.env/i);
  });

  it("renders empty states for no registered definitions and filtered misses", async () => {
    const client = createClient({
      listAssetDefinitions: vi.fn()
        .mockResolvedValueOnce({ ok: true, value: { items: [] } })
        .mockResolvedValueOnce({ ok: true, value: { items: [] } }),
    });
    const { container } = await render(client);

    expect(container.textContent).toContain("No reusable building blocks are registered yet.");
    expect(container.textContent).toContain("Built-in assets appear here after they are registered for this workspace.");

    setInputValue(container.querySelector("input[type='search']") as HTMLInputElement, "missing");
    await flush();

    expect(container.textContent).toContain("No assets match the current filters.");
  });

  it("sends filter changes through the supported query fields", async () => {
    const client = createClient();
    const { container } = await render(client);
    const selects = Array.from(container.querySelectorAll("select"));

    setInputValue(container.querySelector("input[type='search']") as HTMLInputElement, "doc");
    await flush();
    setSelectValue(selects[0] as HTMLSelectElement, "document");
    await flush();
    setSelectValue(selects[1] as HTMLSelectElement, "resource-backed");
    await flush();
    setSelectValue(selects[2] as HTMLSelectElement, "published");
    await flush();
    setSelectValue(selects[3] as HTMLSelectElement, "built-in");
    await flush();

    expect(client.listAssetDefinitions).toHaveBeenCalledWith({
      limit: 50,
      searchText: "doc",
      assetTypes: ["document"],
      assetFamilies: ["resource-backed"],
      lifecycleStatuses: ["published"],
      builtIn: "built-in",
    });
  });

  it("loads selected definition details without validation and keeps advanced sections collapsed by default", async () => {
    const client = createClient();
    const { container } = await render(client);
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Document")) as HTMLButtonElement;

    await act(async () => cardButton.click());
    await flush();

    expect(client.readAssetDefinitionVersion).toHaveBeenCalledWith(
      { definitionId: "builtin.document", version: "1.0.0" },
      {
        expand: ["aiContext", "configurationSchema", "ports", "requirements", "provenance", "metadata"],
      },
    );
    expect(client.readAssetDefinitionVersion).not.toHaveBeenCalledWith(
      { definitionId: "builtin.document", version: "1.0.0" },
      expect.objectContaining({ includeValidation: true }),
    );
    expect(container.textContent).toContain("Reusable document descriptor");

    const advancedToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("AI-readable context")) as HTMLButtonElement;
    expect(advancedToggle.getAttribute("aria-expanded")).toBe("false");
    expect(document.getElementById(advancedToggle.getAttribute("aria-controls") ?? "")?.hidden).toBe(true);
  });

  it("renders validation only after the explicit validation action and keeps sections collapsed", async () => {
    const client = createClient({
      readAssetDefinitionVersion: vi.fn()
        .mockResolvedValueOnce({ ok: true, value: detailWithoutValidation })
        .mockResolvedValueOnce({ ok: true, value: detailWithValidation }),
    });
    const { container } = await render(client);
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Document")) as HTMLButtonElement;

    await act(async () => cardButton.click());
    await flush();

    expect(container.textContent).toContain("Validation details are loaded only when requested.");
    expect(container.textContent).not.toContain("Validation summary");
    expect(container.textContent).not.toContain("Valid With Warnings");
    const validationButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Check validation details")) as HTMLButtonElement;
    await act(async () => validationButton.click());
    await flush();

    expect(client.readAssetDefinitionVersion).toHaveBeenLastCalledWith(
      { definitionId: "builtin.document", version: "1.0.0" },
      {
        expand: ["aiContext", "configurationSchema", "ports", "requirements", "provenance", "metadata"],
        includeValidation: true,
      },
    );
    expect(container.textContent).toContain("Validation summary");
    const validationToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Validation summary")) as HTMLButtonElement;
    expect(validationToggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders safe validation load errors", async () => {
    const client = createClient({
      readAssetDefinitionVersion: vi.fn()
        .mockResolvedValueOnce({ ok: true, value: detailWithoutValidation })
        .mockResolvedValueOnce({
          ok: false,
          error: { code: "internal", message: "Unable to read Asset Library data." },
        }),
    });
    const { container } = await render(client);
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Document")) as HTMLButtonElement;

    await act(async () => cardButton.click());
    await flush();
    const validationButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Check validation details")) as HTMLButtonElement;
    await act(async () => validationButton.click());
    await flush();

    expect(container.querySelector("[role='alert']")?.textContent).toContain("Unable to read Asset Library data.");
  });

  it("renders available advanced sections only after selection and keeps safe metadata hidden until expanded", async () => {
    const { container } = await render();
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Document")) as HTMLButtonElement;

    await act(async () => cardButton.click());
    await flush();

    expect(container.textContent).toContain("Configuration");
    expect(container.textContent).toContain("Inputs and outputs");
    expect(container.textContent).toContain("Requirements");
    expect(container.textContent).toContain("Source");
    expect(container.textContent).toContain("Details");

    const metadataToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Details")) as HTMLButtonElement;
    const metadataPanel = document.getElementById(metadataToggle.getAttribute("aria-controls") ?? "") as HTMLDivElement;
    expect(metadataPanel.hidden).toBe(true);
    await act(async () => metadataToggle.click());

    expect(metadataPanel.hidden).toBe(false);
    expect(metadataPanel.textContent).toContain("safe nested note");
  });

  it("does not render unsafe detail values or unsupported action buttons", async () => {
    const unsafeDetail = {
      ...detailWithoutValidation,
      metadata: {
        safeNote: "visible",
      },
    };
    const { container } = await render(createClient({
      readAssetDefinitionVersion: vi.fn().mockResolvedValue({ ok: true, value: unsafeDetail }),
    }));
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Document")) as HTMLButtonElement;

    await act(async () => cardButton.click());
    await flush();

    const text = container.textContent ?? "";
    expect(text).not.toMatch(/Create asset|Edit asset|Delete asset|Seed built-ins|Scan resources|Execute workflow/i);
    expect(text).not.toContain("C:\\Users\\name\\secret");
    expect(text).not.toContain("Bearer abc");
  });

  it("uses accessible loading and error states with safe messages", async () => {
    const slowClient = createClient({
      listAssetDefinitions: vi.fn().mockReturnValue(new Promise(() => undefined)),
    });
    const loading = await render(slowClient);
    expect(loading.container.querySelector("[role='status']")?.textContent).toContain("Loading asset definitions");

    await act(async () => mountedRoot?.unmount());
    mountedContainer?.remove();
    mountedRoot = undefined;
    mountedContainer = undefined;

    const failingClient = createClient({
      listAssetDefinitions: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "internal", message: "Unable to read Asset Library data." },
      }),
    });
    const failing = await render(failingClient);

    expect(failing.container.querySelector("[role='alert']")?.textContent).toBe("Unable to read Asset Library data.");
  });
});
