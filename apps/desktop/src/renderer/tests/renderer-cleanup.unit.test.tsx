// @vitest-environment jsdom
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAsyncSection } from "../hooks/useAsyncSection";
import { useArtifactSelectionContent } from "../features/artifact-browser/hooks/useArtifactSelectionContent";

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function SectionHarness({ loader }: { loader: () => Promise<string> }) {
  const section = useAsyncSection({ pageKey: "cleanup", sectionKey: "cleanup.section", loadOnMount: true, loader });
  return <p>{section.status}:{section.data ?? ""}</p>;
}

function ArtifactPreviewHarness({ client }: { client: any }) {
  const feature = useArtifactSelectionContent(client, vi.fn(), "workspace.cleanup" as never);
  return <button type="button" onClick={() => { void feature.selectArtifact("artifact.cleanup"); }}>Preview</button>;
}

describe("renderer cleanup policies", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.restoreAllMocks();
    delete window.desktopApi;
  });

  function mount(element: ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root?.render(element); });
    return container;
  }

  it("does not apply in-flight section state updates after unmount and records gated cleanup diagnostics", async () => {
    window.desktopApi = { memoryDiagnosticsEnabled: true } as never;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const pending = deferred<string>();
    const c = mount(<SectionHarness loader={() => pending.promise} />);
    expect(c.textContent).toContain("loading");

    await act(async () => root?.unmount());
    root = undefined;
    await act(async () => { pending.resolve("late data"); await pending.promise; });

    expect(c.textContent).toBe("");
    const lines = log.mock.calls.map(([line]) => String(line)).join("\n");
    expect(lines).toContain("renderer.section.cleanup.started");
    expect(lines).toContain("renderer.section.request.aborted");
    expect(lines).toContain("renderer.section.cleanup.completed");
  });


  it("keeps renderer cleanup diagnostics gated when memory diagnostics are disabled", async () => {
    window.desktopApi = { memoryDiagnosticsEnabled: false } as never;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const pending = deferred<string>();
    mount(<SectionHarness loader={() => pending.promise} />);

    await act(async () => root?.unmount());
    root = undefined;
    await act(async () => { pending.resolve("late data"); await pending.promise; });

    expect(log).not.toHaveBeenCalled();
  });

  it("keeps section retry functional after a failed load", async () => {
    let loadCount = 0;
    function RetryHarness() {
      const section = useAsyncSection({
        pageKey: "cleanup",
        sectionKey: "retry.section",
        loadOnMount: false,
        loader: async () => {
          loadCount += 1;
          if (loadCount === 1) throw new Error("first failure");
          return "retry ok";
        },
      });
      return <><button type="button" onClick={() => { void section.load("open"); }}>Load</button><button type="button" onClick={() => { void section.retry(); }}>Retry</button><p>{section.status}:{section.data ?? section.error}</p></>;
    }
    const c = mount(<RetryHarness />);
    await act(async () => { c.querySelectorAll("button")[0].click(); await flushAsync(); });
    expect(c.textContent).toContain("error:first failure");
    await act(async () => { c.querySelectorAll("button")[1].click(); await flushAsync(); });
    expect(c.textContent).toContain("success:retry ok");
  });

  it("revokes artifact preview object URLs on unmount", async () => {
    window.desktopApi = { memoryDiagnosticsEnabled: true } as never;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const client = {
      readArtifactDetail: vi.fn().mockResolvedValue({ storageKey: "artifact.cleanup", artifactId: "artifact.cleanup" }),
      readArtifactContent: vi.fn().mockResolvedValue({ mediaType: "image/png", availability: "available" }),
      createArtifactMediaViewUrl: vi.fn().mockResolvedValue("blob:artifact-cleanup"),
    };
    const c = mount(<ArtifactPreviewHarness client={client} />);

    await act(async () => { c.querySelector("button")?.click(); await flushAsync(); });
    await act(async () => root?.unmount());
    root = undefined;

    expect(revoke).toHaveBeenCalledWith("blob:artifact-cleanup");
    expect(log.mock.calls.map(([line]) => String(line)).join("\n")).toContain("renderer.preview.object-url.revoked");
  });
});
