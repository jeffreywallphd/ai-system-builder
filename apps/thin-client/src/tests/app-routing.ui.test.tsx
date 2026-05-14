import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

describe("thin-client routing and page composition", () => {
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
    window.history.pushState({}, "", "/");
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("gates workspace pages until a workspace is selected and keeps global-safe pages accessible", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, headers: { get: () => "application/json" }, json: vi.fn().mockResolvedValue({ ok: true, value: { models: [] } }) })
      .mockResolvedValue({ status: 200, headers: { get: () => "application/json" }, json: vi.fn().mockResolvedValue({ ok: true, value: { items: [], models: [] } }) });
    vi.stubGlobal("fetch", fetchMock);

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain("Build visual AI workflows from your artifacts");

    const imageButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Image Generation");
    expect(imageButton).toBeDefined();

    await act(async () => {
      imageButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Create a workspace to use Assets, Artifacts, Data, Models, and Images.");
    expect(container.textContent).toContain("Include System Foundation assets");
    expect(container.textContent).not.toContain("Open Models");
    expect(fetchMock).not.toHaveBeenCalled();

    window.localStorage.setItem("ai-system-builder.thin-client.workspaces", JSON.stringify([{ id: "thin-workspace", displayName: "Thin Workspace", status: "active", createdAt: "2026-05-14T00:00:00.000Z" }]));
    window.localStorage.setItem("ai-system-builder.thin-client.activeWorkspaceId", "thin-workspace");
    await act(async () => {
      root.unmount();
    });
    const remountedRoot = createRoot(container);
    mountedRoot = remountedRoot;
    await act(async () => {
      remountedRoot.render(<App />);
    });
    const imageButtonAfterWorkspace = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Image Generation");
    await act(async () => {
      imageButtonAfterWorkspace?.dispatchEvent(new Event("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Active workspace: Thin Workspace");
    expect(container.textContent).toContain("Open Models");
    expect(container.textContent).not.toContain("thin-workspace");

    const openModelsButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Open Models");
    await act(async () => {
      openModelsButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(window.location.pathname).toBe("/models");
    expect(container.textContent).toContain("Browse models");

    const artifactsButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Artifacts");
    await act(async () => {
      artifactsButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Data Artifact Ingester");
    expect(container.textContent).not.toContain("Data Artifact Browser");

    const browserTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Artifact Browser");
    await act(async () => {
      browserTab?.dispatchEvent(new Event("click", { bubbles: true }));
    });
    expect(container.textContent).toContain("Data Artifact Browser");

    const securityButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Security");
    await act(async () => { securityButton?.dispatchEvent(new Event("click", { bubbles: true })); });
    expect(container.textContent).toContain("Security");
    expect(window.location.pathname).toBe("/security");
  });
});
