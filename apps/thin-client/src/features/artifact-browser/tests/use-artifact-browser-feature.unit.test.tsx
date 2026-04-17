import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArtifactBrowserFeature } from "../components/ArtifactBrowserFeature";

describe("ArtifactBrowserFeature", () => {
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

  it("loads list then loads detail/content when an artifact is selected", async () => {
    const client = {
      browseImageArtifacts: vi.fn().mockResolvedValue([
        {
          storageKey: "uploads/cat.png",
          artifactKind: "image" as const,
          mediaType: "image/png",
        },
      ]),
      readArtifactDetail: vi.fn().mockResolvedValue({
        locator: { storageKey: "uploads/cat.png" },
        artifactKind: "image" as const,
        mediaType: "image/png",
        sizeBytes: 4,
      }),
      readArtifactContent: vi.fn().mockResolvedValue({
        locator: { storageKey: "uploads/cat.png" },
        mediaType: "image/png",
        sizeBytes: 4,
        availability: "available" as const,
        retrieval: "deferred" as const,
      }),
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<ArtifactBrowserFeature client={client} />);
    });

    expect(client.browseImageArtifacts).toHaveBeenCalledOnce();

    const button = container.querySelector("button") as HTMLButtonElement;
    await act(async () => {
      button.click();
    });

    expect(client.readArtifactDetail).toHaveBeenCalledWith({ storageKey: "uploads/cat.png" });
    expect(client.readArtifactContent).toHaveBeenCalledWith({ storageKey: "uploads/cat.png" });
    expect(container.textContent).toContain("Availability");
    expect(container.textContent).toContain("deferred");
  });
});
