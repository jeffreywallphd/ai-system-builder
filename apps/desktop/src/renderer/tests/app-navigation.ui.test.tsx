import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

describe("desktop renderer page composition", () => {
  let mountedRoot: Root | undefined;
  let mountedContainer: HTMLDivElement | undefined;

  afterEach(async () => {
    if (mountedRoot) {
      await act(async () => {
        mountedRoot?.unmount();
      });
    }
    mountedContainer?.remove();
    delete window.desktopApi;
    mountedRoot = undefined;
    mountedContainer = undefined;
  });

  it("renders landing Home page by default and switches to Artifacts/System pages", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    window.desktopApi = {
      uploadImage: vi.fn().mockRejectedValue(new Error("unused")),
      browseArtifacts: vi.fn().mockResolvedValue({ ok: true, value: { items: [] } }),
      readArtifactDetail: vi.fn().mockRejectedValue(new Error("unused")),
      readArtifactContentDescriptor: vi.fn().mockRejectedValue(new Error("unused")),
      readArtifactViewerMedia: vi.fn().mockRejectedValue(new Error("unused")),
      publishArtifactToRepo: vi.fn().mockRejectedValue(new Error("unused")),
    };

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain("Build visual AI workflows from your artifacts");

    const artifactsButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Artifacts",
    );
    expect(artifactsButton).toBeDefined();

    await act(async () => {
      artifactsButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Image upload");
    expect(container.textContent).toContain("Artifact browser (images)");

    const systemButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "System",
    );
    expect(systemButton).toBeDefined();

    await act(async () => {
      systemButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("System workspace scaffolding for upcoming desktop surfaces.");
  });
});
