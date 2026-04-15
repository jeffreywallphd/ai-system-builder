import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import type { DesktopImageUploadApi } from "../lib/desktopApi";

function setInputFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, "files", {
    configurable: true,
    value: files,
  });

  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("desktop renderer image upload component", () => {
  let mountedRoot: Root | undefined;
  let mountedContainer: HTMLDivElement | undefined;

  function mountApp(): {
    root: Root;
    container: HTMLDivElement;
  } {
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
    mountedRoot = undefined;
    mountedContainer = undefined;
  });

  it("shows selected file information after one image file is chosen", async () => {
    const uploadImage = vi.fn<DesktopImageUploadApi["uploadImage"]>().mockResolvedValue({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/example.png",
          mediaType: "image/png",
          sizeBytes: 5,
        },
      },
    });

    const { root, container } = mountApp();

    await act(async () => {
      root.render(<App uploadApi={{ uploadImage }} />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement | null;
    expect(input).not.toBeNull();

    const file = new File([new Uint8Array([1, 2, 3, 4, 5])], "cat.png", {
      type: "image/png",
    });

    await act(async () => {
      setInputFiles(input as HTMLInputElement, [file]);
    });

    expect(container.textContent).toContain("Selected file: cat.png (image/png)");
    expect(container.textContent).toContain("Selected cat.png.");
  });

  it("uploads selected image bytes through the preload bridge dependency and renders success details", async () => {
    const uploadImage = vi.fn<DesktopImageUploadApi["uploadImage"]>().mockResolvedValue({
      ok: true,
      value: {
        descriptor: {
          key: "uploads/cat.png",
          mediaType: "image/png",
          sizeBytes: 4,
        },
      },
    });

    const { root, container } = mountApp();

    await act(async () => {
      root.render(<App uploadApi={{ uploadImage }} />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement | null;
    const form = container.querySelector("form") as HTMLFormElement | null;
    expect(input).not.toBeNull();
    expect(form).not.toBeNull();

    const file = new File([new Uint8Array([137, 80, 78, 71])], "cat.png", {
      type: "image/png",
    });

    await act(async () => {
      setInputFiles(input as HTMLInputElement, [file]);
    });

    await act(async () => {
      (form as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(uploadImage).toHaveBeenCalledTimes(1);
    const payload = uploadImage.mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload?.fileName).toBe("cat.png");
    expect(payload?.mediaType).toBe("image/png");
    expect(Array.from(payload?.bytes ?? [])).toEqual([137, 80, 78, 71]);
    expect(container.textContent).toContain("Stored cat.png.");
    expect(container.textContent).toContain("uploads/cat.png");
  });

  it("renders failure feedback when upload response returns a contract failure", async () => {
    const uploadImage = vi.fn<DesktopImageUploadApi["uploadImage"]>().mockResolvedValue({
      ok: false,
      error: {
        code: "validation",
        message: "mediaType must be an image media type.",
      },
    });

    const { root, container } = mountApp();

    await act(async () => {
      root.render(<App uploadApi={{ uploadImage }} />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement | null;
    const form = container.querySelector("form") as HTMLFormElement | null;
    expect(input).not.toBeNull();
    expect(form).not.toBeNull();

    const file = new File([new Uint8Array([1, 2, 3, 4])], "doc.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      setInputFiles(input as HTMLInputElement, [file]);
    });

    await act(async () => {
      (form as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain("mediaType must be an image media type.");
    const alertNode = container.querySelector("[role='alert']");
    expect(alertNode?.textContent).toContain("mediaType must be an image media type.");
  });
});
