import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

const architectureDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-node-based-execution-posture.md",
);
const architectureAiDocPath = path.join(
  repoRoot,
  "docs",
  "architecture",
  "image-manipulation-node-based-execution-posture.ai.md",
);
const architectureReadmePath = path.join(repoRoot, "docs", "architecture", "README.md");
const architectureReadmeAiPath = path.join(repoRoot, "docs", "architecture", "README.ai.md");

describe("image manipulation node-based execution posture documentation", () => {
  it("keeps human and AI companion posture docs checked in", () => {
    expect(existsSync(architectureDocPath)).toBeTrue();
    expect(existsSync(architectureAiDocPath)).toBeTrue();
  });

  it("documents authoritative node-based execution posture and boundaries", () => {
    const doc = readFileSync(architectureDocPath, "utf8");

    expect(doc).toContain("Story 5.1.5");
    expect(doc).toContain("implicit local-sidecar assumptions");
    expect(doc).toContain("Layer ownership boundaries");
    expect(doc).toContain("ComfyUI posture in this model");
    expect(doc).toContain("Prohibited shortcuts");
    expect(doc).toContain("Direct studio-to-ComfyUI execution");
  });

  it("anchors posture docs to canonical node management and readiness seams", () => {
    const requiredSeams = [
      "src/domain/nodes/ExecutionNodeDomain.ts",
      "src/application/nodes/ports/ExecutionNodeManagementPorts.ts",
      "src/application/image-workflows/GetImageManipulationExecutionReadinessUseCase.ts",
      "src/application/image-workflows/ImageRunSubmissionReadinessValidationService.ts",
      "src/shared/contracts/nodes/ExecutionNodeManagementApiContracts.ts",
      "src/shared/schemas/nodes/ExecutionNodeManagementApiSchemaContracts.ts",
      "src/infrastructure/api/runs/AuthoritativeRunQueryBackendApi.ts",
      "src/hosts/server/IdentityServerHost.ts",
    ];

    for (const seamPath of requiredSeams) {
      expect(existsSync(path.join(repoRoot, seamPath))).toBeTrue();
    }
  });

  it("keeps architecture indexes aligned with the posture doc", () => {
    const readme = readFileSync(architectureReadmePath, "utf8");
    const readmeAi = readFileSync(architectureReadmeAiPath, "utf8");

    expect(readme).toContain("image-manipulation-node-based-execution-posture.md");
    expect(readmeAi).toContain("docs/architecture/image-manipulation-node-based-execution-posture.md");
  });

  it("keeps AI companion posture doc aligned to the canonical posture note", () => {
    const aiDoc = readFileSync(architectureAiDocPath, "utf8");

    expect(aiDoc).toContain("docs/architecture/image-manipulation-node-based-execution-posture.md");
    expect(aiDoc).toContain("ExecutionNodeManagementPorts.ts");
    expect(aiDoc).toContain("GetImageManipulationExecutionReadinessUseCase.ts");
    expect(aiDoc).toContain("implicit local sidecar assumptions");
  });
});
