import { JSDOM } from "jsdom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { afterEach, describe, expect, it, testDouble } from "../../../../../modules/testing/node-test";
import { AssetLibraryPage } from "../AssetLibraryPage";
import { thinClientPageDefinitions } from "../../routes/thinClientPages";

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
(globalThis as any).localStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

function response(status: number, body: unknown) {
  return {
    status,
    json: testDouble.fn().mockResolvedValue(body),
  };
}

describe("thin-client AssetLibraryPage", () => {
  let mountedRoot: Root | undefined;
  let mountedContainer: HTMLDivElement | undefined;

  afterEach(async () => {
    if (mountedRoot) {
      await act(async () => mountedRoot?.unmount());
    }
    mountedContainer?.remove();
    mountedRoot = undefined;
    mountedContainer = undefined;
    delete (globalThis as { fetch?: unknown }).fetch;
  });

  it("renders title and subtitle using the thin-client API client", async () => {
    const fetchMock = testDouble.fn().mockResolvedValue(response(200, { ok: true, value: { items: [] } }));
    (globalThis as { fetch?: unknown }).fetch = fetchMock;

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
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/assets/definitions?limit=50");
    expect((init as RequestInit).method).toBe("GET");
    expect(((init as RequestInit).headers as Headers).get("x-client-source")).toBe("thin-client");
  });

  it("registers the Assets navigation item and path", () => {
    expect(thinClientPageDefinitions.some((page) => page.key === "assets" && page.label === "Assets" && page.path === "/assets")).toBe(true);
  });
});
