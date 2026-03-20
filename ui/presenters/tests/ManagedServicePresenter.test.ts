import { describe, expect, it } from "bun:test";
import { ManagedServicePresenter } from "../ManagedServicePresenter";

describe("ManagedServicePresenter", () => {
  it("formats state, ownership, endpoints, and checked times for the services UI", () => {
    const presenter = new ManagedServicePresenter();
    const service = {
      state: "unhealthy",
      ownership: "external",
      endpointSummary: "http://127.0.0.1:8000/health",
      lastCheckedAt: "2026-03-20T10:15:00.000Z",
      lastErrorDetail: "Health probe failed.",
      detail: "Health probe failed.",
      isAvailable: false,
    } as any;

    expect(presenter.presentState(service)).toBe("Unhealthy");
    expect(presenter.presentOwnership(service)).toBe("External");
    expect(presenter.presentEndpointSummary(service)).toBe("http://127.0.0.1:8000/health");
    expect(presenter.presentLastChecked(service)).toBe("2026-03-20T10:15:00Z");
    expect(presenter.presentErrorDetail(service)).toBe("Health probe failed.");
    expect(presenter.presentAvailability(service)).toBe("Not available");
  });
});
