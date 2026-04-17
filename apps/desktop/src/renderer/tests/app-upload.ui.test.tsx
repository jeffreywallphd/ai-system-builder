import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";

function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  });

  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("desktop renderer artifact workflow page", () => {
  let mountedRoot: Root | undefined;
  let mountedContainer: HTMLDivElement | undefined;

  function mountApp(): { root: Root; container: HTMLDivElement } {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;
    return { root, container };
  }

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

  it("uploads and refreshes artifact listing on the dedicated Artifacts page", async () => {
    const uploadImage = vi.fn().mockResolvedValue({
      operation: "image.upload",
      channel: "ipc.image.upload.response",
      ok: true,
      value: {
        descriptor: {
          storage: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 4,
          },
        },
      },
    });

    const browseArtifacts = vi
      .fn()
      .mockResolvedValueOnce({ operation: "artifact.browse", channel: "ipc.artifact.browse.response", ok: true, value: { items: [] } })
      .mockResolvedValueOnce({
        operation: "artifact.browse",
        channel: "ipc.artifact.browse.response",
        ok: true,
        value: {
          items: [{ storageKey: "uploads/cat.png", artifactKind: "image", originalName: "cat.png" }],
        },
      });

    window.desktopApi = {
      uploadImage,
      browseArtifacts,
      readArtifactDetail: vi.fn().mockResolvedValue({
        operation: "artifact.read",
        channel: "ipc.artifact.read.response",
        ok: true,
        value: { artifact: { locator: { storageKey: "uploads/cat.png" }, artifactKind: "image" } },
      }),
      readArtifactContentDescriptor: vi.fn().mockResolvedValue({
        operation: "artifact.content.read",
        channel: "ipc.artifact.content.read.response",
        ok: true,
        value: { content: { locator: { storageKey: "uploads/cat.png" }, availability: "available", retrieval: "deferred" } },
      }),
      readArtifactViewerMedia: vi.fn().mockResolvedValue({
        operation: "artifact.media.view",
        channel: "ipc.artifact.media.view.response",
        ok: true,
        value: { storageKey: "uploads/cat.png", mediaType: "image/png", bytes: new Uint8Array([1, 2]) },
      }),
    };

    const { root, container } = mountApp();

    await act(async () => {
      root.render(<App />);
    });

    const artifactsButton = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Artifacts");
    await act(async () => {
      artifactsButton?.dispatchEvent(new Event("click", { bubbles: true }));
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement | null;
    const form = container.querySelector("form") as HTMLFormElement | null;
    expect(input).not.toBeNull();
    expect(form).not.toBeNull();

    const file = new File([new Uint8Array([137, 80, 78, 71])], "cat.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new Uint8Array([137, 80, 78, 71]).buffer,
    });

    await act(async () => {
      setInputFiles(input as HTMLInputElement, [file]);
    });

    await act(async () => {
      (form as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(browseArtifacts).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("cat.png");
  });
});
