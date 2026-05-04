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

  it("shows transport section with HTTP-only guidance", async () => {
    useThinClientSecurityMock.mockReturnValue({ uiState: "disabled-dev", status: { mode: "disabled-dev", httpsEnabled: false, httpsRequired: false, requiresRestartToChangeTransportSecurity: true }, guidance: undefined, error: undefined, completePairing: vi.fn(), clearLocalPairing: vi.fn(), setDevSecurityEnforcementMode: vi.fn(), devSecurityModeUpdateSuccess: undefined, devSecurityModeUpdateError: undefined });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root?.render(<SecurityStatusPanel />); });
    expect(container.textContent).toContain("Transport security");
    expect(container.textContent).toContain("Current listener: HTTP only");
    expect(container.textContent).toContain("restart dev:server");
  });

  it("shows HTTPS-enabled dev message", async () => {
    useThinClientSecurityMock.mockReturnValue({ uiState: "disabled-dev", status: { mode: "disabled-dev", httpsEnabled: true, httpsRequired: false, requiresRestartToChangeTransportSecurity: true }, guidance: undefined, error: undefined, completePairing: vi.fn(), clearLocalPairing: vi.fn(), setDevSecurityEnforcementMode: vi.fn(), devSecurityModeUpdateSuccess: undefined, devSecurityModeUpdateError: undefined });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root?.render(<SecurityStatusPanel />); });
    expect(container.textContent).toContain("HTTPS is enabled for this dev server");
  });

  it("renders dropdown only when dev toggle enabled", async () => {
    useThinClientSecurityMock.mockReturnValue({ uiState: "disabled-dev", status: { mode: "disabled-dev", httpsEnabled: true, httpsRequired: false, devSecurityToggleEnabled: true, devSecurityEnforcementMode: "disabled-dev" }, guidance: undefined, error: undefined, completePairing: vi.fn(), clearLocalPairing: vi.fn(), setDevSecurityEnforcementMode: vi.fn(), devSecurityModeUpdateSuccess: undefined, devSecurityModeUpdateError: undefined });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root?.render(<SecurityStatusPanel />); });
    expect(container.textContent).toContain("Dev security enforcement");
  });

  it("does not render dropdown when dev toggle disabled", async () => {
    useThinClientSecurityMock.mockReturnValue({ uiState: "disabled-dev", status: { mode: "disabled-dev", httpsEnabled: false, httpsRequired: false, devSecurityToggleEnabled: false }, guidance: undefined, error: undefined, completePairing: vi.fn(), clearLocalPairing: vi.fn(), setDevSecurityEnforcementMode: vi.fn(), devSecurityModeUpdateSuccess: undefined, devSecurityModeUpdateError: undefined });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root?.render(<SecurityStatusPanel />); });
    expect(container.textContent).not.toContain("Dev security enforcement");
  });
  it("calls setter when dropdown changes", async () => {
    const setDevSecurityEnforcementMode = vi.fn().mockResolvedValue(undefined);
    useThinClientSecurityMock.mockReturnValue({ uiState: "disabled-dev", status: { mode: "disabled-dev", httpsEnabled: true, httpsRequired: false, devSecurityToggleEnabled: true, devSecurityEnforcementMode: "disabled-dev" }, guidance: undefined, error: undefined, completePairing: vi.fn(), clearLocalPairing: vi.fn(), setDevSecurityEnforcementMode, devSecurityModeUpdateSuccess: undefined, devSecurityModeUpdateError: undefined });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root?.render(<SecurityStatusPanel />); });
    const select = container.querySelector("select") as HTMLSelectElement;
    await act(async () => { select.value = "lan-token-enforced"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(setDevSecurityEnforcementMode).toHaveBeenCalledWith("lan-token-enforced");
  });

});
