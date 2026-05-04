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

  const renderWithStatus = async (status: any) => {
    useThinClientSecurityMock.mockReturnValue({ uiState: "disabled-dev", status, guidance: undefined, error: undefined, completePairing: vi.fn(), clearLocalPairing: vi.fn(), setDevSecurityEnforcementMode: vi.fn(), devSecurityModeUpdateSuccess: undefined, devSecurityModeUpdateError: undefined });
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => { root?.render(<SecurityStatusPanel />); });
  };

  it("renders HTTP-only disabled-dev transport state and examples", async () => {
    await renderWithStatus({ mode: "disabled-dev", httpsEnabled: false, httpsRequired: false, requiresRestartToChangeTransportSecurity: true });
    expect(container?.textContent).toContain("Current listener: HTTP only");
    expect(container?.textContent).toContain("Default dev is HTTP/no-auth");
    expect(container?.textContent).toContain("AI_SYSTEM_BUILDER_SECURITY_MODE=disabled-dev npm run dev:server");
  });

  it("renders HTTPS enabled disabled-dev state", async () => {
    await renderWithStatus({ mode: "disabled-dev", httpsEnabled: true, httpsRequired: false, requiresRestartToChangeTransportSecurity: true });
    expect(container?.textContent).toContain("HTTPS is enabled for this dev server");
    expect(container?.textContent).toContain("requires restarting dev:server");
  });

  it("renders lan-https-token required state with tls fields", async () => {
    await renderWithStatus({ mode: "lan-https-token", httpsEnabled: true, httpsRequired: true, tls: { mode: "manual", source: "reused", hosts: ["localhost", "127.0.0.1"], expiresAt: "2030-01-01T00:00:00.000Z" } });
    expect(container?.textContent).toContain("LAN HTTPS token mode is active");
    expect(container?.textContent).toContain("TLS cert mode: manual");
    expect(container?.textContent).toContain("Certificate source: reused");
    expect(container?.textContent).toContain("Hosts/SANs: localhost, 127.0.0.1");
    expect(container?.textContent).toContain("Certificate expiration: 2030-01-01T00:00:00.000Z");
  });

  it("shows auto-self-signed warning and examples", async () => {
    await renderWithStatus({ mode: "disabled-dev", httpsEnabled: true, httpsRequired: false, tls: { mode: "auto-self-signed", source: "generated" } });
    expect(container?.textContent).toContain("TLS cert mode: auto-self-signed");
    expect(container?.textContent).toContain("Certificate source: generated");
    expect(container?.textContent).toContain("may still show a trust warning");
    expect(container?.textContent).toContain("AI_SYSTEM_BUILDER_TLS_CERT_MODE=auto-self-signed");
    expect(container?.textContent).toContain("SERVER_TOKEN_HASH_SECRET=<strong-random-secret>");
    expect(container?.textContent).toContain("randomBytes(32)");
    expect(container?.textContent).not.toContain("BEGIN PRIVATE KEY");
  });

  it("renders dropdown only when enabled", async () => {
    await renderWithStatus({ mode: "disabled-dev", httpsEnabled: true, httpsRequired: false, devSecurityToggleEnabled: true, devSecurityEnforcementMode: "disabled-dev" });
    expect(container?.textContent).toContain("Dev security enforcement");
    expect(container?.textContent).toContain("does not switch HTTP/HTTPS");
  });

  it("hides dropdown when toggle disabled", async () => {
    await renderWithStatus({ mode: "disabled-dev", httpsEnabled: false, httpsRequired: false, devSecurityToggleEnabled: false });
    expect(container?.textContent).not.toContain("Dev security enforcement");
  });
});
