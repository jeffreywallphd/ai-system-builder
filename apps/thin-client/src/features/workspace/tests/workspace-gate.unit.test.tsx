import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ActiveWorkspaceProvider, WorkspaceGate } from "../index";

describe("thin-client WorkspaceGate", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    container?.remove();
    window.localStorage.clear();
    root = undefined;
    container = undefined;
  });

  it("does not render child feature content before a workspace is active", async () => {
    const childRenderer = vi.fn(() => <div>Feature client content</div>);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(<ActiveWorkspaceProvider><WorkspaceGate pageLabel="Assets">{childRenderer}</WorkspaceGate></ActiveWorkspaceProvider>);
    });

    expect(container.textContent).toContain("Create a workspace to use Assets, Artifacts, Data, Models, and Images.");
    expect(container.textContent).toContain("Create workspace");
    expect(container.textContent).toContain("Include System Foundation assets");
    expect(container.textContent).not.toContain("Feature client content");
    expect(childRenderer).not.toHaveBeenCalled();
  });
});
