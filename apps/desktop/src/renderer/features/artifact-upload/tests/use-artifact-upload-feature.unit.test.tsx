import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useArtifactUploadFeature } from "../hooks/useArtifactUploadFeature";
import type { ArtifactUploadClient } from "../api/desktopArtifactUploadClient";

interface HookProbeProps {
  client: ArtifactUploadClient;
}

function HookProbe({ client }: HookProbeProps) {
  const { selectedFile, viewState, acceptedFileTypes, onFileChange, onUploadSubmit } = useArtifactUploadFeature(client);

  return (
    <form onSubmit={(event) => void onUploadSubmit(event)}>
      <input type="file" onChange={onFileChange} />
      <button type="submit">Upload</button>
      <p data-testid="selected-file">{selectedFile ? selectedFile.name : "none"}</p>
      <p data-testid="status">{viewState.status}</p>
      <p data-testid="message">{viewState.message ?? ""}</p>
      <p data-testid="stored-key">{viewState.key ?? ""}</p>
      <p data-testid="accepted-file-types">{acceptedFileTypes}</p>
    </form>
  );
}

function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  });

  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("useArtifactUploadFeature", () => {
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

  it("tracks selected file and reports success state after upload", async () => {
    const uploadArtifact = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 4,
        },
      },
    });
    const getAcceptedTypes = vi.fn().mockResolvedValue({
      acceptedExtensions: [".png", ".md"],
      acceptedMediaTypes: ["image/png", "text/markdown"],
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadArtifact, getAcceptedTypes }} />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    const file = new File([new Uint8Array([1, 2, 3, 4])], "cat.png", { type: "image/png" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    });

    await act(async () => {
      setInputFiles(input, [file]);
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector("[data-testid='selected-file']")?.textContent).toBe("cat.png");
    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("success");
    expect(container.querySelector("[data-testid='stored-key']")?.textContent).toBe("uploads/cat.png");
    expect(container.querySelector("[data-testid='accepted-file-types']")?.textContent).toBe(
      ".png,.md,image/png,text/markdown",
    );
  });

  it("reports validation error when submit is attempted without selecting a file", async () => {
    const uploadArtifact = vi.fn();
    const getAcceptedTypes = vi.fn().mockResolvedValue({
      acceptedExtensions: [".pdf"],
      acceptedMediaTypes: ["application/pdf"],
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadArtifact, getAcceptedTypes }} />);
    });

    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(uploadArtifact).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("error");
    expect(container.querySelector("[data-testid='message']")?.textContent).toBe(
      "Select one artifact file before uploading.",
    );
  });

  it("falls back to text/markdown when browser file type metadata is empty", async () => {
    const uploadArtifact = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/doc.md",
          mediaType: "text/markdown",
          sizeBytes: 4,
        },
      },
    });
    const getAcceptedTypes = vi.fn().mockResolvedValue({
      acceptedExtensions: [".md"],
      acceptedMediaTypes: ["text/markdown"],
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadArtifact, getAcceptedTypes }} />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;
    const file = new File([new Uint8Array([35, 32, 84, 101])], "doc.md", { type: "" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new Uint8Array([35, 32, 84, 101]).buffer,
    });

    await act(async () => {
      setInputFiles(input, [file]);
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("success");
  });

  it("falls back to application/json when browser file type metadata is empty", async () => {
    const uploadArtifact = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/schema.json",
          mediaType: "application/json",
          sizeBytes: 2,
        },
      },
    });
    const getAcceptedTypes = vi.fn().mockResolvedValue({
      acceptedExtensions: [".json"],
      acceptedMediaTypes: ["application/json"],
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadArtifact, getAcceptedTypes }} />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;
    const file = new File([new Uint8Array([123, 125])], "schema.json", { type: "" });
    Object.defineProperty(file, "arrayBuffer", {
      value: async () => new Uint8Array([123, 125]).buffer,
    });

    await act(async () => {
      setInputFiles(input, [file]);
    });
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("success");
  });
});
