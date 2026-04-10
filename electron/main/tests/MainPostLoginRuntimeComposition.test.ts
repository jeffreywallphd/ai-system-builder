import { describe, expect, it } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const mainSource = fs.readFileSync(path.resolve(process.cwd(), "electron/main/main.ts"), "utf8");

describe("electron main post-login runtime composition", () => {
  it("separates post-login shared warmup from on-demand feature composition", () => {
    expect(mainSource).toContain("async function composePostLoginRuntime(");
    expect(mainSource).toContain("function createOnDemandFeatureCompositionPaths(");
    expect(mainSource).toContain("const runtimeComposition = await composePostLoginRuntime(");
    expect(mainSource).toContain("const onDemand = createOnDemandFeatureCompositionPaths(");
    expect(mainSource).toContain("const pythonRuntime = resolveDesktopPythonRuntime(");
    expect(mainSource).toContain("serviceSupervisor = new DesktopServiceSupervisor(");
    expect(mainSource).toContain("await serviceSupervisor.start()");
  });

  it("keeps legacy eager bootstrap entrypoint removed", () => {
    expect(mainSource).not.toContain("bootstrapDesktopRuntime(");
  });
});
