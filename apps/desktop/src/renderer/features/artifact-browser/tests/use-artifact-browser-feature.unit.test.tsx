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
      browseArtifacts: vi.fn().mockResolvedValue([
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
      getHuggingFaceTokenStatus: vi.fn().mockResolvedValue({ configured: false }),
      setHuggingFaceToken: vi.fn().mockResolvedValue({ configured: true, maskedToken: "••••1234" }),
      clearHuggingFaceToken: vi.fn().mockResolvedValue({ configured: false }),
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
      mediaType: "",
    });
    expect(container.textContent).toContain("Published Backing");
    expect(container.textContent).toContain("openai/demo");
    expect(container.textContent).toContain("Not yet verified");
  });

  it("shows publish failure message", async () => {
    const client = {
      browseArtifacts: vi.fn().mockResolvedValue([
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
      getHuggingFaceTokenStatus: vi.fn().mockResolvedValue({ configured: false }),
      setHuggingFaceToken: vi.fn().mockResolvedValue({ configured: true, maskedToken: "••••1234" }),
      clearHuggingFaceToken: vi.fn().mockResolvedValue({ configured: false }),
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
    expect(container.textContent).toContain("This Hugging Face repository may require an access token.");
  });

  it("keeps browser card focused on browsing and excludes ingestion controls", async () => {
    const client = {
      browseArtifacts: vi.fn().mockResolvedValue([]),
      readArtifactDetail: vi.fn(),
      readArtifactContent: vi.fn(),
      createArtifactMediaViewUrl: vi.fn().mockResolvedValue("blob:desktop-preview"),
      getHuggingFaceTokenStatus: vi.fn().mockResolvedValue({ configured: false }),
      setHuggingFaceToken: vi.fn(),
      clearHuggingFaceToken: vi.fn(),
      publishArtifactToHuggingFace: vi.fn(),
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

    expect(container.textContent).toContain("Data Artifact Browser");
    expect(container.textContent).not.toContain("Hugging Face token");
    expect(container.textContent).not.toContain("Register from Hugging Face");
  });

  it("lists non-image artifacts and only renders image preview for image media types", async () => {
    const client = {
      browseArtifacts: vi.fn().mockResolvedValue([
        { storageKey: "uploads/cat.png", artifactKind: "image" as const, mediaType: "image/png" },
        { storageKey: "uploads/train.parquet", artifactKind: "data" as const, mediaType: "application/x-parquet" },
      ]),
      readArtifactDetail: vi.fn().mockResolvedValue({
        locator: { storageKey: "uploads/train.parquet" },
        artifactKind: "data" as const,
        mediaType: "application/x-parquet",
        sourceKind: "upload",
      }),
      readArtifactContent: vi.fn().mockResolvedValue({
        locator: { storageKey: "uploads/train.parquet" },
        mediaType: "application/x-parquet",
        availability: "available" as const,
        retrieval: "deferred" as const,
      }),
      createArtifactMediaViewUrl: vi.fn().mockResolvedValue("blob:desktop-preview"),
      getHuggingFaceTokenStatus: vi.fn().mockResolvedValue({ configured: false }),
      setHuggingFaceToken: vi.fn(),
      clearHuggingFaceToken: vi.fn(),
      publishArtifactToHuggingFace: vi.fn(),
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

    expect(container.textContent).toContain("uploads/train.parquet");
    const parquetButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("uploads/train.parquet")) as HTMLButtonElement;

    await act(async () => {
      parquetButton.click();
    });

    expect(client.createArtifactMediaViewUrl).not.toHaveBeenCalled();
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("application/x-parquet");
    expect(container.textContent).toContain("data");
    expect(container.textContent).toContain("upload");
  });

  it("renders Unregistered Artifacts section and wires Register/Delete actions", async () => {
    const client = {
      browseArtifacts: vi.fn().mockResolvedValue([]),
      browseUnregisteredArtifacts: vi.fn().mockResolvedValue([
        {
          storageKey: "uploads/orphan/report.pdf",
          relativePath: "orphan/report.pdf",
          fileName: "report.pdf",
          mediaType: "application/pdf",
        },
      ]),
      registerUnregisteredArtifact: vi.fn().mockResolvedValue({ storageKey: "uploads/orphan/report.pdf" }),
      deleteUnregisteredArtifact: vi.fn().mockResolvedValue({ storageKey: "uploads/orphan/report.pdf" }),
      readArtifactDetail: vi.fn(),
      readArtifactContent: vi.fn(),
      createArtifactMediaViewUrl: vi.fn(),
      getHuggingFaceTokenStatus: vi.fn().mockResolvedValue({ configured: false }),
      setHuggingFaceToken: vi.fn(),
      clearHuggingFaceToken: vi.fn(),
      publishArtifactToHuggingFace: vi.fn(),
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

    expect(container.textContent).toContain("Unregistered Artifacts");
    expect(container.textContent).toContain("orphan/report.pdf");

    const registerButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Register") as HTMLButtonElement;
    const deleteButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Delete") as HTMLButtonElement;

    await act(async () => {
      registerButton.click();
    });
    await act(async () => {
      deleteButton.click();
    });

    expect(client.registerUnregisteredArtifact).toHaveBeenCalledWith({ storageKey: "uploads/orphan/report.pdf" });
    expect(client.deleteUnregisteredArtifact).toHaveBeenCalledWith({ storageKey: "uploads/orphan/report.pdf" });
  });


  it("re-checks published backing existence from the artifact detail panel", async () => {
    const client = {
      browseArtifacts: vi.fn().mockResolvedValue([
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
      getHuggingFaceTokenStatus: vi.fn().mockResolvedValue({ configured: false }),
      setHuggingFaceToken: vi.fn().mockResolvedValue({ configured: true, maskedToken: "••••1234" }),
      clearHuggingFaceToken: vi.fn().mockResolvedValue({ configured: false }),
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


  it("localizes imported artifact bytes from the artifact panel", async () => {
    const client = {
      browseArtifacts: vi.fn().mockResolvedValue([
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
      getHuggingFaceTokenStatus: vi.fn().mockResolvedValue({ configured: false }),
      setHuggingFaceToken: vi.fn().mockResolvedValue({ configured: true, maskedToken: "••••1234" }),
      clearHuggingFaceToken: vi.fn().mockResolvedValue({ configured: false }),
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
      .find((button) => button.textContent === "Localize artifact") as HTMLButtonElement;
    await act(async () => {
      localizeButton.click();
    });

    expect(client.localizeArtifactFromRepo).toHaveBeenCalledWith({
      artifactId: "artifacts/20260418000000-local01",
    });
    expect(container.textContent).toContain("Localized artifacts/20260418000000-local01 to local object storage.");
  });

  it("shows source verification and remote-only/localized state cues based on backing state", async () => {
    const client = {
      browseArtifacts: vi.fn().mockResolvedValue([
        {
          storageKey: "artifacts/20260418000000-local01",
          artifactKind: "image" as const,
          metadata: {
            backingState: {
              hasImportedSourceBacking: true,
              hasPublishedBacking: true,
              hasLocalObjectAvailable: false,
              isLocalized: false,
              isRemoteOnly: true,
            },
          },
        },
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
            verification: { exists: true, verifiedAt: "2026-04-18T00:00:00.000Z" },
          },
          publishedBacking: {
            target: {
              provider: "huggingface",
              repository: "openai/demo-public",
              path: "images/cat.png",
              revision: "main",
            },
            verification: { exists: true, verifiedAt: "2026-04-18T00:00:00.000Z" },
          },
        },
      }),
      readArtifactContent: vi.fn().mockResolvedValue({
        locator: { storageKey: "artifacts/20260418000000-local01" },
        availability: "unavailable" as const,
        retrieval: "deferred" as const,
      }),
      createArtifactMediaViewUrl: vi.fn().mockResolvedValue(""),
      getHuggingFaceTokenStatus: vi.fn().mockResolvedValue({ configured: false }),
      setHuggingFaceToken: vi.fn().mockResolvedValue({ configured: true, maskedToken: "••••1234" }),
      clearHuggingFaceToken: vi.fn().mockResolvedValue({ configured: false }),
      publishArtifactToHuggingFace: vi.fn(),
      verifyPublishedArtifactBacking: vi.fn(),
      verifyImportedSourceBacking: vi.fn().mockResolvedValue({
        target: {
          provider: "huggingface",
          repository: "openai/demo",
          path: "images/cat.png",
          revision: "main",
        },
        verification: { exists: true, verifiedAt: "2026-04-19T00:00:00.000Z" },
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

    expect(container.textContent).toContain("Remote only");
    expect(container.textContent).toContain("Published");

    const artifactButton = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("artifacts/20260418000000-local01")) as HTMLButtonElement;
    await act(async () => {
      artifactButton.click();
    });

    expect(container.textContent).toContain("Remote-only artifact. Local preview is unavailable until localization.");
    expect(container.textContent).toContain("Re-check source backing");
    expect(container.textContent).toContain("Localize artifact");
  });
});
