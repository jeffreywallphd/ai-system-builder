import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { afterEach, describe, expect, it, testDouble } from "../../../../../../modules/testing/node-test";
import type {
  AssetLibraryClient,
  AssetLibraryDefinitionCard,
  AssetLibraryDefinitionDetail,
} from "../../../../../../modules/ui/shared/asset-library";
import { AssetLibraryFeature } from "../components/AssetLibraryFeature";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).Event = dom.window.Event;
(globalThis as any).HTMLInputElement = dom.window.HTMLInputElement;
(globalThis as any).HTMLSelectElement = dom.window.HTMLSelectElement;

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
    hostKinds: ["server"],
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

function createClient(overrides: Partial<AssetLibraryClient> = {}): AssetLibraryClient {
  return {
    listAssetDefinitions: testDouble.fn().mockResolvedValue({ ok: true, value: { items: [card] } }),
    readAssetDefinition: testDouble.fn().mockResolvedValue({ ok: true, value: detailWithoutValidation }),
    readAssetDefinitionVersion: testDouble.fn().mockResolvedValue({ ok: true, value: detailWithoutValidation }),
    ...overrides,
  };
}

function queuedListResults(results: readonly unknown[]) {
  const queue = [...results];
  return testDouble.fn().mockImplementation(() => Promise.resolve(queue.shift()) as any);
}

function queuedDetailResults(results: readonly unknown[]) {
  const queue = [...results];
  return testDouble.fn().mockImplementation(() => Promise.resolve(queue.shift()) as any);
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

describe("thin-client AssetLibraryFeature", () => {
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

  it("renders cards with built-in, lifecycle, type, and family cues", async () => {
    const { container } = await render();

    expect(container.textContent).toContain("Document");
    expect(container.textContent).toContain("Document building block");
    expect(container.textContent).toContain("Built-in");
    expect(container.textContent).toContain("Resource Backed");
    expect(container.textContent).toContain("Published");
    expect(container.textContent).toContain("v1.0.0");
  });

  it("renders empty states for no registered definitions and filtered misses", async () => {
    const client = createClient({
      listAssetDefinitions: queuedListResults([
        { ok: true, value: { items: [] } },
        { ok: true, value: { items: [] } },
      ]),
    });
    const { container } = await render(client);

    expect(container.textContent).toContain("No asset definitions are registered yet.");
    expect(container.textContent).toContain("Built-in assets appear here after they are registered for this workspace.");

    setInputValue(container.querySelector("input[type='search']") as HTMLInputElement, "missing");
    await flush();

    expect(container.textContent).toContain("No assets match the current filters.");
  });

  it("sends filter changes through supported query fields", async () => {
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

  it("loads selected detail without validation and keeps advanced sections collapsed by default", async () => {
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
    expect((client.readAssetDefinitionVersion as ReturnType<typeof testDouble.fn>).mock.calls
      .some((call) => call[1]?.includeValidation === true)).toBe(false);
    expect(container.textContent).toContain("Reusable document descriptor");

    const advancedToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("AI-readable context")) as HTMLButtonElement;
    expect(advancedToggle.getAttribute("aria-expanded")).toBe("false");
    const controlledPanel = document.getElementById(advancedToggle.getAttribute("aria-controls") ?? "") as HTMLDivElement;
    expect(controlledPanel.hidden).toBe(true);
  });

  it("renders validation only after the explicit validation action and keeps sections collapsed", async () => {
    const client = createClient({
      readAssetDefinitionVersion: queuedDetailResults([
        { ok: true, value: detailWithoutValidation },
        { ok: true, value: detailWithValidation },
      ]),
    });
    const { container } = await render(client);
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Document")) as HTMLButtonElement;

    await act(async () => cardButton.click());
    await flush();

    expect(container.textContent).not.toContain("Validation");
    const validationButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Check validation")) as HTMLButtonElement;
    await act(async () => validationButton.click());
    await flush();

    const calls = (client.readAssetDefinitionVersion as ReturnType<typeof testDouble.fn>).mock.calls;
    expect(calls[calls.length - 1]).toEqual([
      { definitionId: "builtin.document", version: "1.0.0" },
      {
        expand: ["aiContext", "configurationSchema", "ports", "requirements", "provenance", "metadata"],
        includeValidation: true,
      },
    ]);
    expect(container.textContent).toContain("Validation");
    const validationToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Validation")) as HTMLButtonElement;
    expect(validationToggle.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders safe validation load errors", async () => {
    const client = createClient({
      readAssetDefinitionVersion: queuedDetailResults([
        { ok: true, value: detailWithoutValidation },
        {
          ok: false,
          error: { code: "internal", message: "Unable to read Asset Library data." },
        },
      ]),
    });
    const { container } = await render(client);
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Document")) as HTMLButtonElement;

    await act(async () => cardButton.click());
    await flush();
    const validationButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Check validation")) as HTMLButtonElement;
    await act(async () => validationButton.click());
    await flush();

    expect(container.querySelector("[role='alert']")?.textContent).toContain("Unable to read Asset Library data.");
  });

  it("renders available advanced sections only and hides safe metadata until expanded", async () => {
    const { container } = await render();
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Document")) as HTMLButtonElement;

    await act(async () => cardButton.click());
    await flush();

    for (const label of ["Configuration", "Ports", "Requirements", "Provenance", "Safe metadata"]) {
      expect(container.textContent).toContain(label);
    }

    const metadataToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Safe metadata")) as HTMLButtonElement;
    const metadataPanel = document.getElementById(metadataToggle.getAttribute("aria-controls") ?? "") as HTMLDivElement;
    expect(metadataPanel.hidden).toBe(true);
    await act(async () => metadataToggle.click());

    expect(metadataPanel.hidden).toBe(false);
    expect(metadataPanel.textContent).toContain("safe nested note");
  });

  it("does not render unsafe detail values or unsupported action buttons", async () => {
    const { container } = await render(createClient({
      readAssetDefinitionVersion: testDouble.fn().mockResolvedValue({ ok: true, value: detailWithoutValidation }),
    }));
    const cardButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Document")) as HTMLButtonElement;

    await act(async () => cardButton.click());
    await flush();

    const text = container.textContent ?? "";
    assert.doesNotMatch(text, /Create asset|Edit asset|Delete asset|Register asset|Seed built-ins|Import asset|Finalize asset|Scan resources|Execute workflow/i);
    expect(text).not.toContain("C:\\Users\\name\\secret");
    expect(text).not.toContain("Bearer abc");
  });

  it("uses accessible loading and error states with safe messages", async () => {
    const slowClient = createClient({
      listAssetDefinitions: testDouble.fn().mockImplementation(() => new Promise(() => undefined) as any),
    });
    const loading = await render(slowClient);
    expect(loading.container.querySelector("[role='status']")?.textContent).toContain("Loading asset definitions");

    await act(async () => mountedRoot?.unmount());
    mountedContainer?.remove();
    mountedRoot = undefined;
    mountedContainer = undefined;

    const failingClient = createClient({
      listAssetDefinitions: testDouble.fn().mockResolvedValue({
        ok: false,
        error: { code: "internal", message: "Unable to read Asset Library data." },
      }),
    });
    const failing = await render(failingClient);

    expect(failing.container.querySelector("[role='alert']")?.textContent).toBe("Unable to read Asset Library data.");
  });
});
