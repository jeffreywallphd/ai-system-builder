// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { useThinClientSecurityMock } = vi.hoisted(() => ({ useThinClientSecurityMock: vi.fn() }));
vi.mock("../hooks/useThinClientSecurity", () => ({ useThinClientSecurity: useThinClientSecurityMock }));

import { SecurityStatusPanel } from "./SecurityStatusPanel";

describe("SecurityStatusPanel", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  afterEach(async () => {
    if (root) await act(async () => { root?.unmount(); });
    container?.remove();
    vi.resetAllMocks();
  });

  it("renders dropdown only when dev toggle enabled and shows restart copy", async () => {
    useThinClientSecurityMock.mockReturnValue({
      uiState: "disabled-dev", status: { mode: "disabled-dev", devSecurityToggleEnabled: true, devSecurityEnforcementMode: "disabled-dev" },
      guidance: undefined, error: undefined, completePairing: vi.fn(), clearLocalPairing: vi.fn(), setDevSecurityEnforcementMode: vi.fn(),
    });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root?.render(<SecurityStatusPanel />); });
    expect(container.textContent).toContain("Dev security enforcement");
    expect(container.textContent).toContain("requires restarting dev:server");
  });

  it("does not render dropdown when dev toggle disabled", async () => {
    useThinClientSecurityMock.mockReturnValue({ uiState: "disabled-dev", status: { mode: "disabled-dev", devSecurityToggleEnabled: false }, guidance: undefined, error: undefined, completePairing: vi.fn(), clearLocalPairing: vi.fn(), setDevSecurityEnforcementMode: vi.fn() });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root?.render(<SecurityStatusPanel />); });
    expect(container.textContent).not.toContain("Dev security enforcement");
  });

  it("calls setter when dropdown changes", async () => {
    const setDevSecurityEnforcementMode = vi.fn().mockResolvedValue(undefined);
    useThinClientSecurityMock.mockReturnValue({ uiState: "disabled-dev", status: { mode: "disabled-dev", devSecurityToggleEnabled: true, devSecurityEnforcementMode: "disabled-dev" }, guidance: undefined, error: undefined, completePairing: vi.fn(), clearLocalPairing: vi.fn(), setDevSecurityEnforcementMode });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root?.render(<SecurityStatusPanel />); });
    const select = container.querySelector("select") as HTMLSelectElement;
    await act(async () => { select.value = "lan-token-enforced"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(setDevSecurityEnforcementMode).toHaveBeenCalledWith("lan-token-enforced");
  });
});
