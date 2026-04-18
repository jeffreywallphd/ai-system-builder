import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArtifactBrowserFeature } from "../components/ArtifactBrowserFeature";

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("Desktop ArtifactBrowserFeature publish flow", () => {
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

  it("publishes a selected artifact and shows published backing details", async () => {
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
        metadata: {
          publishedBacking: {
            target: {
              provider: "huggingface",
              repository: "openai/demo",
              path: "images/cat.png",
              revision: "main",
              locator: "openai/demo/images/cat.png",
            },
            verification: {
              exists: false,
            },
          },
        },
      }),
      readArtifactContent: vi.fn().mockResolvedValue({
        locator: { storageKey: "uploads/cat.png" },
        mediaType: "image/png",
        sizeBytes: 4,
        availability: "available" as const,
        retrieval: "deferred" as const,
      }),
      createArtifactMediaViewUrl: vi.fn().mockResolvedValue("blob:desktop-preview"),
      publishArtifactToHuggingFace: vi.fn().mockResolvedValue({
        target: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/cat.png",
          revision: "main",
          locator: "openai/demo/images/cat.png",
        },
        verification: {
          exists: true,
          verifiedAt: "2026-04-17T00:00:00.000Z",
        },
      }),
      verifyPublishedArtifactBacking: vi.fn().mockResolvedValue({
        target: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/cat.png",
          revision: "main",
          locator: "openai/demo/images/cat.png",
        },
        verification: {
          exists: true,
          verifiedAt: "2026-04-17T00:00:00.000Z",
        },
      }),
      registerArtifactFromRepo: vi.fn(),
      localizeArtifactFromRepo: vi.fn(),
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<ArtifactBrowserFeature client={client} />);
    });

    const artifactButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("uploads/cat.png")) as HTMLButtonElement;
    await act(async () => {
      artifactButton.click();
    });

    const publishToggleButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Publish to Hugging Face") as HTMLButtonElement;
    await act(async () => {
      publishToggleButton.click();
    });

    const inputs = Array.from(container.querySelectorAll("input"));
    setInputValue(inputs[0] as HTMLInputElement, "openai/demo");
    setInputValue(inputs[1] as HTMLInputElement, "images/cat.png");

    const publishButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Publish") as HTMLButtonElement;
    await act(async () => {
      publishButton.click();
    });

    expect(client.publishArtifactToHuggingFace).toHaveBeenCalledWith({
      artifactId: "uploads/cat.png",
      repository: "openai/demo",
      path: "images/cat.png",
      revision: "main",
      mediaType: undefined,
    });
    expect(container.textContent).toContain("Published Backing");
    expect(container.textContent).toContain("openai/demo");
    expect(container.textContent).toContain("Remote backing verified");
  });

  it("shows publish failure message", async () => {
    const client = {
      browseImageArtifacts: vi.fn().mockResolvedValue([
        {
          storageKey: "uploads/cat.png",
          artifactKind: "image" as const,
        },
      ]),
      readArtifactDetail: vi.fn().mockResolvedValue({
        locator: { storageKey: "uploads/cat.png" },
        artifactKind: "image" as const,
      }),
      readArtifactContent: vi.fn().mockResolvedValue({
        locator: { storageKey: "uploads/cat.png" },
        availability: "available" as const,
        retrieval: "deferred" as const,
      }),
      createArtifactMediaViewUrl: vi.fn().mockResolvedValue("blob:desktop-preview"),
      publishArtifactToHuggingFace: vi.fn().mockRejectedValue(new Error("Missing Hugging Face token.")),
      verifyPublishedArtifactBacking: vi.fn(),
      registerArtifactFromRepo: vi.fn(),
      localizeArtifactFromRepo: vi.fn(),
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<ArtifactBrowserFeature client={client} />);
    });

    const artifactButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("uploads/cat.png")) as HTMLButtonElement;
    await act(async () => {
      artifactButton.click();
    });
    const publishToggleButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Publish to Hugging Face") as HTMLButtonElement;
    await act(async () => {
      publishToggleButton.click();
    });

    const inputs = Array.from(container.querySelectorAll("input"));
    setInputValue(inputs[0] as HTMLInputElement, "openai/demo");
    setInputValue(inputs[1] as HTMLInputElement, "images/cat.png");

    const publishButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Publish") as HTMLButtonElement;
    await act(async () => {
      publishButton.click();
    });

    expect(container.textContent).toContain("Missing Hugging Face token.");
  });

  it("re-checks published backing existence from the artifact detail panel", async () => {
    const client = {
      browseImageArtifacts: vi.fn().mockResolvedValue([
        { storageKey: "uploads/cat.png", artifactKind: "image" as const },
      ]),
      readArtifactDetail: vi.fn().mockResolvedValue({
        locator: { storageKey: "uploads/cat.png" },
        artifactKind: "image" as const,
        metadata: {
          publishedBacking: {
            target: {
              provider: "huggingface",
              repository: "openai/demo",
              path: "images/cat.png",
              locator: "openai/demo/images/cat.png",
            },
            verification: { exists: false },
          },
        },
      }),
      readArtifactContent: vi.fn().mockResolvedValue({
        locator: { storageKey: "uploads/cat.png" },
        availability: "available" as const,
        retrieval: "deferred" as const,
      }),
      createArtifactMediaViewUrl: vi.fn().mockResolvedValue("blob:desktop-preview"),
      publishArtifactToHuggingFace: vi.fn(),
      verifyPublishedArtifactBacking: vi.fn().mockResolvedValue({
        target: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/cat.png",
          locator: "openai/demo/images/cat.png",
        },
        verification: {
          exists: true,
          verifiedAt: "2026-04-18T00:00:00.000Z",
        },
      }),
      registerArtifactFromRepo: vi.fn(),
      localizeArtifactFromRepo: vi.fn(),
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<ArtifactBrowserFeature client={client} />);
    });

    const artifactButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("uploads/cat.png")) as HTMLButtonElement;
    await act(async () => {
      artifactButton.click();
    });

    const recheckButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Re-check published backing") as HTMLButtonElement;
    await act(async () => {
      recheckButton.click();
    });

    expect(client.verifyPublishedArtifactBacking).toHaveBeenCalledWith({ artifactId: "uploads/cat.png" });
    expect(container.textContent).toContain("Last checked:");
  });

  it("registers an artifact from Hugging Face and selects it", async () => {
    const client = {
      browseImageArtifacts: vi.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { storageKey: "imports/huggingface/openai/demo/main/images/cat.png", artifactKind: "image" as const },
        ]),
      readArtifactDetail: vi.fn().mockResolvedValue({
        locator: { storageKey: "imports/huggingface/openai/demo/main/images/cat.png" },
        artifactKind: "image" as const,
      }),
      readArtifactContent: vi.fn().mockRejectedValue(new Error("missing local bytes")),
      createArtifactMediaViewUrl: vi.fn().mockRejectedValue(new Error("missing local bytes")),
      publishArtifactToHuggingFace: vi.fn(),
      verifyPublishedArtifactBacking: vi.fn(),
      registerArtifactFromRepo: vi.fn().mockResolvedValue({
        artifactId: "imports/huggingface/openai/demo/main/images/cat.png",
        backing: {
          role: "imported-source" as const,
          target: {
            provider: "huggingface",
            repository: "openai/demo",
            path: "images/cat.png",
            revision: "main",
            locator: "openai/demo/images/cat.png",
          },
          verification: {
            exists: true as const,
            verifiedAt: "2026-04-18T00:00:00.000Z",
          },
        },
      }),
      localizeArtifactFromRepo: vi.fn(),
    };

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<ArtifactBrowserFeature client={client} />);
    });

    const registerToggle = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Register from Hugging Face") as HTMLButtonElement;
    await act(async () => {
      registerToggle.click();
    });

    const inputs = Array.from(container.querySelectorAll("input"));
    setInputValue(inputs[0] as HTMLInputElement, "openai/demo");
    setInputValue(inputs[1] as HTMLInputElement, "images/cat.png");

    const registerButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Register") as HTMLButtonElement;
    await act(async () => {
      registerButton.click();
    });

    expect(client.registerArtifactFromRepo).toHaveBeenCalledWith({
      repository: "openai/demo",
      path: "images/cat.png",
      revision: "main",
      mediaType: undefined,
    });
    expect(container.textContent).toContain("Registered imports/huggingface/openai/demo/main/images/cat.png from Hugging Face.");
  });

  it("localizes imported artifact bytes from the artifact panel", async () => {
    const client = {
      browseImageArtifacts: vi.fn().mockResolvedValue([
        { storageKey: "artifacts/20260418000000-local01", artifactKind: "image" as const },
      ]),
      readArtifactDetail: vi.fn().mockResolvedValue({
        locator: { storageKey: "artifacts/20260418000000-local01" },
        artifactKind: "image" as const,
        metadata: {
          importedSourceBacking: {
            target: {
              provider: "huggingface",
              repository: "openai/demo",
              path: "images/cat.png",
              revision: "main",
            },
            verification: { exists: true },
          },
        },
      }),
      readArtifactContent: vi.fn()
        .mockResolvedValueOnce({
          locator: { storageKey: "artifacts/20260418000000-local01" },
          availability: "unavailable" as const,
          retrieval: "deferred" as const,
        })
        .mockResolvedValueOnce({
          locator: { storageKey: "artifacts/20260418000000-local01" },
          availability: "available" as const,
          retrieval: "deferred" as const,
        }),
      createArtifactMediaViewUrl: vi.fn().mockResolvedValue("blob:desktop-preview"),
      publishArtifactToHuggingFace: vi.fn(),
      verifyPublishedArtifactBacking: vi.fn(),
      registerArtifactFromRepo: vi.fn(),
      localizeArtifactFromRepo: vi.fn().mockResolvedValue({
        artifactId: "artifacts/20260418000000-local01",
        localObject: {
          key: "artifacts/20260418000000-local01",
          mediaType: "image/png",
          sizeBytes: 3,
        },
        source: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/cat.png",
          locator: "openai/demo/images/cat.png",
        },
        localizedAt: "2026-04-18T00:00:00.000Z",
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

    const artifactButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("artifacts/20260418000000-local01")) as HTMLButtonElement;
    await act(async () => {
      artifactButton.click();
    });

    const localizeButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Localize/download artifact") as HTMLButtonElement;
    await act(async () => {
      localizeButton.click();
    });

    expect(client.localizeArtifactFromRepo).toHaveBeenCalledWith({
      artifactId: "artifacts/20260418000000-local01",
    });
    expect(container.textContent).toContain("Localized artifacts/20260418000000-local01 to local object storage.");
  });
});
