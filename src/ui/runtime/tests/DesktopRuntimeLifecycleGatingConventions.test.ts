import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

describe("Desktop runtime lifecycle gating conventions", () => {
  it("routes runtime operations and realtime subscriptions through the shared lifecycle gate", () => {
    const runtimeOperationsServicePath = path.join(repoRoot, "src", "ui", "services", "RuntimeOperationsService.ts");
    const runtimeRealtimeSubscriptionServicePath = path.join(repoRoot, "src", "ui", "shared", "runtime", "RuntimeRealtimeSubscriptionService.ts");

    const runtimeOperationsServiceSource = readFileSync(runtimeOperationsServicePath, "utf8");
    const runtimeRealtimeSubscriptionServiceSource = readFileSync(runtimeRealtimeSubscriptionServicePath, "utf8");

    expect(runtimeOperationsServiceSource).toContain("resolveDesktopRendererRuntimeLifecycleGate");
    expect(runtimeRealtimeSubscriptionServiceSource).toContain("resolveDesktopRendererRuntimeLifecycleGate");
  });
});
