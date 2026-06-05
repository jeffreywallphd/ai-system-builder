import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArtifactIngestionFeature } from "../components/ArtifactIngestionFeature";

describe("ArtifactIngestionFeature", () => {
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

  it("renders Hugging Face ingestion controls in the upload card", async () => {
    const uploadClient = {
      uploadArtifact: vi.fn(),
      getAcceptedTypes: vi.fn().mockResolvedValue({ acceptedExtensions: [".md"], acceptedMediaTypes: ["text/markdown"] }),
    };
    const ingestionClient = {
      getHuggingFaceTokenStatus: vi.fn().mockResolvedValue({ configured: false }),
      setHuggingFaceToken: vi.fn(),
      clearHuggingFaceToken: vi.fn(),
      browseArtifacts: vi.fn(),
      readArtifactDetail: vi.fn(),
      readArtifactContent: vi.fn(),
      createArtifactMediaViewUrl: vi.fn(),
      readArtifactMedia: vi.fn(),
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
      root.render(<ArtifactIngestionFeature client={uploadClient} ingestionClient={ingestionClient} />);
    });

    expect(container.textContent).toContain("Data Artifact Ingester");
    expect(container.textContent).toContain("Scrape web data");
    expect(container.textContent).toContain("Import from Hugging Face");

    const scrapeToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Scrape web data")) as HTMLButtonElement;
    await act(async () => {
      scrapeToggle.click();
    });
    expect(container.textContent).toContain("Ingest page");
    expect(container.textContent).toContain("Ingest batch");

    const huggingFaceToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Import from Hugging Face")) as HTMLButtonElement;
    await act(async () => {
      huggingFaceToggle.click();
    });
    expect(container.textContent).toContain("Hugging Face settings");
    expect(container.textContent).toContain("Namespace (user/org)");
    expect(container.textContent).not.toContain("Register from Hugging Face");
  });
});
