import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useImageUploadFeature } from "../hooks/useImageUploadFeature";
import type { ApiImageUploadClient } from "../api/apiImageUploadClient";

interface HookProbeProps {
  client: ApiImageUploadClient;
}

function HookProbe({ client }: HookProbeProps) {
  const { selectedFile, viewState, onFileChange, onUploadSubmit } = useImageUploadFeature(client);

  return (
    <form onSubmit={(event) => void onUploadSubmit(event)}>
      <input type="file" onChange={onFileChange} />
      <button type="submit">Upload</button>
      <p data-testid="selected-file">{selectedFile ? selectedFile.name : "none"}</p>
      <p data-testid="status">{viewState.status}</p>
      <p data-testid="message">{viewState.message ?? ""}</p>
      <p data-testid="stored-key">{viewState.key ?? ""}</p>
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

describe("thin-client useImageUploadFeature", () => {
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

  it("tracks selected file and reports success after upload", async () => {
    const uploadImage = vi.fn().mockResolvedValue({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 4,
        },
      },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadImage }} />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;

    const file = new File([new Uint8Array([1, 2, 3, 4])], "cat.png", { type: "image/png" });

    await act(async () => {
      setInputFiles(input, [file]);
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("success");
    expect(container.querySelector("[data-testid='stored-key']")?.textContent).toBe("uploads/cat.png");
  });

  it("shows an error when submit is attempted before selecting a file", async () => {
    const uploadImage = vi.fn();

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadImage }} />);
    });

    const form = container.querySelector("form") as HTMLFormElement;

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(uploadImage).not.toHaveBeenCalled();
    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("error");
    expect(container.querySelector("[data-testid='message']")?.textContent).toBe(
      "Select one image file before uploading.",
    );
  });

  it("renders server validation feedback when upload fails", async () => {
    const uploadImage = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "validation",
        message: "mediaType must be an image media type.",
      },
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoot = root;
    mountedContainer = container;

    await act(async () => {
      root.render(<HookProbe client={{ uploadImage }} />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const form = container.querySelector("form") as HTMLFormElement;
    const file = new File([new Uint8Array([1, 2, 3, 4])], "cat.png", { type: "image/png" });

    await act(async () => {
      setInputFiles(input, [file]);
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(uploadImage).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-testid='status']")?.textContent).toBe("error");
    expect(container.querySelector("[data-testid='message']")?.textContent).toBe(
      "mediaType must be an image media type.",
    );
  });
});
