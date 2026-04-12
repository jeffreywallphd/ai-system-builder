import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const contributorGuidePath = resolve(process.cwd(), "docs/unified-api-contributor-guide.md");
const contributorGuideAiPath = resolve(process.cwd(), "docs/unified-api-contributor-guide.ai.md");

describe("unified API contributor guide transport workflow documentation guardrails", () => {
  it("keeps human and AI contributor guides checked in", () => {
    expect(existsSync(contributorGuidePath)).toBeTrue();
    expect(existsSync(contributorGuideAiPath)).toBeTrue();
  });

  it("documents the HTTP route-family workflow and boundary rules", () => {
    const doc = readFileSync(contributorGuidePath, "utf8");

    const requiredTokens = [
      "HTTP transport route-family workflow",
      "authoritative-route-families/*",
      "AuthoritativeApiRouteRegistrationCatalog.ts",
      "AuthoritativeIdentityRouteFamilyModules.ts",
      "defaultRouteFamilyHandlers",
      "metadata -> CORS -> secure transport -> auth/trust -> parse/map -> backend -> status translation -> response envelope",
      "IdentityHttpServerErrorTranslation.ts",
      "AuthoritativeServerApiRouteComposition.ts",
      "Transport boundary rules (must hold)",
      "Do not move transport parsing, protocol, or middleware concerns into `src/application` or `src/domain`.",
      "docs/architecture/domains/api-and-transport-surfaces/references/http-transport-modularization-module-map.md",
    ] as const;

    for (const token of requiredTokens) {
      expect(doc).toContain(token);
    }
  });
});
