import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetLibraryPage } from "../AssetLibraryPage";
import { desktopPageDefinitions } from "../../routes/desktopPages";

function success(value: unknown) {
  return { ok: true, value };
}

describe("AssetLibraryPage", () => {
  let mountedRoot: Root | undefined;
  let mountedContainer: HTMLDivElement | undefined;

  afterEach(async () => {
    if (mountedRoot) {
      await act(async () => mountedRoot?.unmount());
    }
    mountedContainer?.remove();
    delete (window as Window & { desktopApi?: unknown }).desktopApi;
    mountedRoot = undefined;
    mountedContainer = undefined;
  });

  it("renders title and subtitle", async () => {
    (window as Window & { desktopApi?: unknown }).desktopApi = {
      listAssetDefinitions: vi.fn().mockResolvedValue(success({ items: [] })),
      readAssetDefinition: vi.fn().mockResolvedValue(success({ definition: {} })),
      readAssetDefinitionVersion: vi.fn().mockResolvedValue(success({ definition: {} })),
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<AssetLibraryPage />);
    });

    expect(container.textContent).toContain("Asset Library");
    expect(container.textContent).toContain("Browse reusable building blocks available in this workspace.");
  });

  it("registers a top-level Assets navigation item", () => {
    expect(desktopPageDefinitions.some((page) => page.key === "assets" && page.label === "Assets")).toBe(true);
  });
});
