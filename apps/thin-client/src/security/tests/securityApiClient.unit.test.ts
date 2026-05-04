import { describe, expect, it, vi } from "vitest";
import { createSecurityApiClient } from "../securityApiClient";

describe("securityApiClient", () => {
  it("calls status and pairing endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, value: { mode: "disabled-dev" } }) })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ ok: true, value: { bearerToken: "token" } }) });
    vi.stubGlobal("fetch", fetchMock);
    const client = createSecurityApiClient();
    await client.getSecurityStatus();
    await client.completePairing({ pairingCode: "abc", deviceName: "dev" });
    expect(fetchMock.mock.calls[1][0]).toContain('/api/security/pairing/complete');
    expect(fetchMock.mock.calls[1][1].body).toContain('pairingCode');
    expect(fetchMock.mock.calls[1][0]).not.toContain('pairingCode');
  });
});
