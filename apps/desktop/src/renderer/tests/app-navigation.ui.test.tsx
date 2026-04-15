import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

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
    mountedRoot = undefined;
    mountedContainer = undefined;
  });

  it("renders Home page by default and switches to System page via app shell navigation", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<App uploadApi={{ uploadImage: async () => { throw new Error("unused"); } }} />);
    });

    expect(container.textContent).toContain("Home");
    expect(container.textContent).toContain("Desktop image upload starter flow.");

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
