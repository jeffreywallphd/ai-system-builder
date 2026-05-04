import { beforeEach, describe, expect, it, vi } from "vitest";

const { secureFetchMock } = vi.hoisted(() => ({ secureFetchMock: vi.fn() }));
vi.mock("../secureFetch", () => ({ secureFetch: secureFetchMock }));

import { createSecurityApiClient } from "../securityApiClient";

describe("securityApiClient", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uses public fetch for unauthenticated status", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 200, json: async () => ({ ok: true, value: { mode: "disabled-dev" } }) });
    vi.stubGlobal("fetch", fetchMock);
    await createSecurityApiClient().getSecurityStatus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(secureFetchMock).not.toHaveBeenCalled();
  });

  it("uses secureFetch for authenticated status", async () => {
    vi.stubGlobal("fetch", vi.fn());
    secureFetchMock.mockResolvedValue({ status: 200, json: async () => ({ ok: true, value: { mode: "lan-https-token", currentPrincipal: { deviceId: "d1" } } }) });
    await createSecurityApiClient().getSecurityStatus({ includeAuth: true });
    expect(secureFetchMock).toHaveBeenCalledTimes(1);
  });
});
