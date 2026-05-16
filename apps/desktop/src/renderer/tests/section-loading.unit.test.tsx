// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SectionErrorState } from "../components/ui/SectionErrorState";
import { SectionLoadingState } from "../components/ui/SectionLoadingState";
import { useAsyncSection } from "../hooks/useAsyncSection";

function DeferredSection({ loader }: { loader: () => Promise<string> }) {
  const section = useAsyncSection({
    pageKey: "test-page",
    sectionKey: "test.expensive-section",
    initialTrigger: "initial",
    loadOnMount: false,
    loader,
  });
  return (
    <section>
      <h1>Fast page shell</h1>
      <p>Local section is visible.</p>
      {section.status === "idle" ? <button type="button" onClick={() => { void section.load("expanded"); }}>Open expensive section</button> : null}
      {section.status === "loading" ? <SectionLoadingState message="Loading expensive section..." /> : null}
      {section.status === "error" ? <SectionErrorState message={section.error ?? "Failed"} onRetry={() => { void section.retry(); }} /> : null}
      {section.status === "success" ? <p>{section.data}</p> : null}
    </section>
  );
}

describe("section loading boundaries", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    container?.remove();
    root = undefined;
    container = undefined;
    delete window.desktopApi;
  });

  function mount(loader: () => Promise<string>) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => { root?.render(<DeferredSection loader={loader} />); });
    return container;
  }

  it("renders the page shell without invoking deferred section data", () => {
    const loader = vi.fn().mockResolvedValue("loaded");
    const c = mount(loader);
    expect(c.textContent).toContain("Fast page shell");
    expect(c.textContent).toContain("Local section is visible.");
    expect(loader).not.toHaveBeenCalled();
  });

  it("shows localized loading while the page shell remains visible", async () => {
    const loader = vi.fn(() => new Promise<string>(() => undefined));
    const c = mount(loader);
    const button = c.querySelector("button") as HTMLButtonElement;
    await act(async () => { button.click(); await Promise.resolve(); });
    expect(c.textContent).toContain("Fast page shell");
    expect(c.textContent).toContain("Loading expensive section...");
  });

  it("shows a localized retry error and retries only the failed section", async () => {
    const loader = vi.fn()
      .mockRejectedValueOnce(new Error("Nope"))
      .mockResolvedValueOnce("Loaded after retry");
    const c = mount(loader);
    await act(async () => { (c.querySelector("button") as HTMLButtonElement).click(); await Promise.resolve(); });
    expect(c.textContent).toContain("Nope");
    expect(c.textContent).toContain("Fast page shell");
    await act(async () => {
      (Array.from(c.querySelectorAll("button")).find((button) => button.textContent === "Retry") as HTMLButtonElement).click();
      await Promise.resolve();
    });
    expect(loader).toHaveBeenCalledTimes(2);
    expect(c.textContent).toContain("Loaded after retry");
  });

  it("emits section diagnostics only when enabled", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    window.desktopApi = { memoryDiagnosticsEnabled: true } as never;
    const c = mount(vi.fn().mockResolvedValue("loaded"));
    await act(async () => { (c.querySelector("button") as HTMLButtonElement).click(); await Promise.resolve(); });
    expect(log.mock.calls.map(([line]) => String(line)).join("\n")).toContain("renderer.section.load.start");
    expect(log.mock.calls.map(([line]) => String(line)).join("\n")).toContain("renderer.section.load.resolved");
    log.mockClear();
    await act(async () => root?.unmount());
    c.remove();
    root = undefined;
    container = undefined;
    window.desktopApi = { memoryDiagnosticsEnabled: false } as never;
    const c2 = mount(vi.fn().mockResolvedValue("loaded"));
    await act(async () => { (c2.querySelector("button") as HTMLButtonElement).click(); await Promise.resolve(); });
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
