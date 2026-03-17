import { describe, expect, it } from "bun:test";
import { PythonRuntimeState } from "../PythonRuntimeState";

describe("PythonRuntimeState", () => {
  it("maps healthy state as available", () => {
    const state = new PythonRuntimeState({ status: "healthy", owner: "external" });
    expect(state.isAvailable).toBeTrue();
    expect(state.owner).toBe("external");
  });

  it("creates updated copies", () => {
    const state = new PythonRuntimeState({ status: "starting" });
    const next = state.with({ status: "failed", detail: "boom" });
    expect(next.status).toBe("failed");
    expect(next.detail).toBe("boom");
  });
});
