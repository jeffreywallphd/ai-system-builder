import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArtifactIngestionFeature } from "../components/ArtifactIngestionFeature";
import { useArtifactUploadFeature } from "../hooks/useArtifactUploadFeature";
import type { ApiArtifactUploadClient } from "../api/apiArtifactUploadClient";

interface HookProbeProps {
  client: ApiArtifactUploadClient;
}

interface HookProbeActions {
  onFileChange: ReturnType<typeof useArtifactUploadFeature>["onFileChange"];
  onUploadSubmit: ReturnType<typeof useArtifactUploadFeature>["onUploadSubmit"];
}

let hookProbeActions: HookProbeActions | undefined;

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void } {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function HookProbe({ client }: HookProbeProps) {
  const { selectedFile, viewState, acceptedFileTypes, onFileChange, onUploadSubmit } = useArtifactUploadFeature(client);
  hookProbeActions = { onFileChange, onUploadSubmit };

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

function createTestFile(bytes: Uint8Array, fileName: string, options: FilePropertyBag): File {
  const file = new File([bytes], fileName, options);
  Object.defineProperty(file, "arrayBuffer", {
    configurable: true,
    value: vi.fn().mockResolvedValue(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)),
  });

  return file;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function chooseFile(file: File): void {
  hookProbeActions?.onFileChange({
    currentTarget: { files: [file] },
  } as never);
}

function submitUpload(): Promise<void> | undefined {
  return hookProbeActions?.onUploadSubmit({
    preventDefault: vi.fn(),
  } as never);
}

describe("thin-client useArtifactUploadFeature", () => {
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
    window.sessionStorage.clear();
    hookProbeActions = undefined;
  });

  it("uploads the selected file without requiring a separate submit", async () => {
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
      acceptedExtensions: [".csv", ".xlsx"],
      acceptedMediaTypes: ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadArtifact, getAcceptedTypes }} />);
    });

    const file = createTestFile(new Uint8Array([1, 2, 3, 4]), "cat.png", { type: "image/png" });

    await act(async () => {
      chooseFile(file);
      await flushMicrotasks();
    });

    expect(uploadArtifact).toHaveBeenCalledOnce();
    expect(uploadArtifact).toHaveBeenCalledWith({
      fileName: "cat.png",
      mediaType: "image/png",
      bytes: new Uint8Array([1, 2, 3, 4]),
    });
    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("success");
    expect(container.querySelector("[data-testid='stored-key']")?.textContent).toBe("uploads/cat.png");
    expect(container.querySelector("[data-testid='accepted-file-types']")?.textContent).toBe(
      ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("shows an error when submit is attempted before selecting a file", async () => {
    const uploadArtifact = vi.fn();
    const getAcceptedTypes = vi.fn().mockResolvedValue({
      acceptedExtensions: [".txt"],
      acceptedMediaTypes: ["text/plain"],
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadArtifact, getAcceptedTypes }} />);
    });

    await act(async () => {
      await submitUpload();
    });

    expect(uploadArtifact).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("error");
    expect(container.querySelector("[data-testid='message']")?.textContent).toBe(
      "Select one artifact file before uploading.",
    );
  });

  it("renders server validation feedback when upload fails", async () => {
    const uploadArtifact = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "validation",
        message: "Artifact type is not accepted: application/pdf.",
      },
    });
    const getAcceptedTypes = vi.fn().mockResolvedValue({
      acceptedExtensions: [".png"],
      acceptedMediaTypes: ["image/png"],
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadArtifact, getAcceptedTypes }} />);
    });

    const file = createTestFile(new Uint8Array([1, 2, 3, 4]), "cat.png", { type: "image/png" });

    await act(async () => {
      chooseFile(file);
      await flushMicrotasks();
    });

    expect(uploadArtifact).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("error");
    expect(container.querySelector("[data-testid='message']")?.textContent).toBe(
      "Artifact type is not accepted: application/pdf.",
    );
  });

  it("ignores manual submit while automatic upload is already in progress", async () => {
    const uploadResult = createDeferred<Awaited<ReturnType<ApiArtifactUploadClient["uploadArtifact"]>>>();
    const uploadArtifact = vi.fn().mockReturnValue(uploadResult.promise);
    const getAcceptedTypes = vi.fn().mockResolvedValue({
      acceptedExtensions: [".png"],
      acceptedMediaTypes: ["image/png"],
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadArtifact, getAcceptedTypes }} />);
    });

    const file = createTestFile(new Uint8Array([1, 2, 3, 4]), "cat.png", { type: "image/png" });

    await act(async () => {
      chooseFile(file);
      await flushMicrotasks();
    });

    await act(async () => {
      await submitUpload();
    });

    expect(uploadArtifact).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("uploading");

    await act(async () => {
      uploadResult.resolve({
        ok: true,
        value: {
          descriptor: {
            key: "uploads/cat.png",
            mediaType: "image/png",
            sizeBytes: 4,
          },
        },
      });
    });

    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("success");
  });

  it("persists expanded ingestion panels through unmount and remount", async () => {
    const uploadArtifact = vi.fn();
    const getAcceptedTypes = vi.fn().mockResolvedValue({
      acceptedExtensions: [".png"],
      acceptedMediaTypes: ["image/png"],
    });
    const ingestionClient = { registerArtifactFromRepo: vi.fn() } as never;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<ArtifactIngestionFeature client={{ uploadArtifact, getAcceptedTypes }} ingestionClient={ingestionClient} />);
    });

    const uploadToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Upload data")) as HTMLButtonElement;
    await act(async () => {
      uploadToggle.click();
    });

    expect(uploadToggle.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      root.unmount();
    });
    mountedRoot = undefined;

    const nextRoot = createRoot(container);
    mountedRoot = nextRoot;
    await act(async () => {
      nextRoot.render(<ArtifactIngestionFeature client={{ uploadArtifact, getAcceptedTypes }} ingestionClient={ingestionClient} />);
    });

    const remountedUploadToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Upload data")) as HTMLButtonElement;
    expect(remountedUploadToggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("initializes ingestion panel expansion from session storage", async () => {
    window.sessionStorage.setItem("thin-client.artifact-ingestion.expanded-panels", JSON.stringify({
      uploadData: true,
      scrapeWebData: false,
      importFromHuggingFace: false,
    }));
    const uploadArtifact = vi.fn();
    const getAcceptedTypes = vi.fn().mockResolvedValue({
      acceptedExtensions: [".png"],
      acceptedMediaTypes: ["image/png"],
    });
    const ingestionClient = { registerArtifactFromRepo: vi.fn() } as never;

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<ArtifactIngestionFeature client={{ uploadArtifact, getAcceptedTypes }} ingestionClient={ingestionClient} />);
    });

    const uploadToggle = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Upload data")) as HTMLButtonElement;
    expect(uploadToggle.getAttribute("aria-expanded")).toBe("true");
  });

});
