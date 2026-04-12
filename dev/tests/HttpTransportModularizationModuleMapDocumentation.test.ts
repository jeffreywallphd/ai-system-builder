import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const moduleMapDocPath = resolve(
  process.cwd(),
  "docs/architecture/domains/api-and-transport-surfaces/references/http-transport-modularization-module-map.md",
);
const moduleMapAiDocPath = resolve(
  process.cwd(),
  "docs/architecture/domains/api-and-transport-surfaces/references/http-transport-modularization-module-map.ai.md",
);
const referencesReadmePath = resolve(
  process.cwd(),
  "docs/architecture/domains/api-and-transport-surfaces/references/README.md",
);
const referencesReadmeAiPath = resolve(
  process.cwd(),
  "docs/architecture/domains/api-and-transport-surfaces/references/README.ai.md",
);

describe("HTTP transport modularization module map documentation guardrails", () => {
  it("keeps human and AI module-map docs checked in", () => {
    expect(existsSync(moduleMapDocPath)).toBeTrue();
    expect(existsSync(moduleMapAiDocPath)).toBeTrue();
  });

  it("keeps the module map aligned with story scope requirements", () => {
    const doc = readFileSync(moduleMapDocPath, "utf8");

    const requiredSections = [
      "Current Transport Audit (Dev Branch)",
      "Shared Middleware Concerns To Extract",
      "Target Module Map",
      "Registration and Composition Seams",
      "DTO Mapping Seams",
      "Execution-Ordered Migration Plan",
      "Known Migration Risks",
    ] as const;
    for (const section of requiredSections) {
      expect(doc).toContain(section);
    }

    const requiredRouteFamilyTokens = [
      "`identity-auth`",
      "`workspace-administration`",
      "`authorization-management`",
      "`run-submission`",
      "`run-read`",
      "`run-mutation`",
      "`run-execution-update`",
      "`system-runtime`",
    ] as const;
    for (const token of requiredRouteFamilyTokens) {
      expect(doc).toContain(token);
    }

    const requiredSpecialCaseTokens = [
      "trusted-session enforcement",
      "workspace context derivation",
      "node-authenticated transport",
      "stream/file response",
      "websocket upgrade",
    ] as const;
    for (const token of requiredSpecialCaseTokens) {
      expect(doc).toContain(token);
    }
  });

  it("keeps the module map discoverable from API/transport references indexes", () => {
    const readme = readFileSync(referencesReadmePath, "utf8");
    const readmeAi = readFileSync(referencesReadmeAiPath, "utf8");

    expect(readme).toContain("http-transport-modularization-module-map.md");
    expect(readmeAi).toContain("http-transport-modularization-module-map.md");
  });
});
