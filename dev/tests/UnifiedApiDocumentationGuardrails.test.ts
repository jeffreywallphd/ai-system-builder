import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readProjectFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("unified API documentation guardrails", () => {
  it("keeps authoritative surface documentation explicit about prohibited patterns and contract homes", () => {
    const doc = readProjectFile("docs/architecture/unified-api-authoritative-surface.md");

    const requiredTokens = [
      "Direct raw storage access from clients.",
      "UI-only DTO drift away from shared server contracts.",
      "Unauthorized local bypass paths around authoritative session and authorization checks.",
      "src/shared/contracts/",
      "src/shared/schemas/",
      "src/infrastructure/api/",
      "src/infrastructure/transport/http-server/",
      "src/ui/shared/",
      "electron/preload.ts",
      "src/ui/composition/createUiDependencies.ts",
      "HttpManagedServiceSupervisorClient.ts",
      "ManagedServiceEventStream.ts",
    ] as const;

    for (const token of requiredTokens) {
      expect(doc).toContain(token);
    }
  });

  it("keeps contributor guidance aligned with authoritative extension workflow", () => {
    const guide = readProjectFile("docs/unified-api-contributor-guide.md");

    const requiredTokens = [
      "Where to add new shared contracts",
      "src/shared/contracts/<domain>/",
      "src/shared/schemas/<domain>/",
      "src/infrastructure/api/<domain>/",
      "src/infrastructure/transport/http-server/",
      "src/ui/shared/<domain>/",
      "Explicitly prohibited for new work",
      "Direct raw storage access from clients for protected operations.",
      "UI-only DTO drift from shared contract packages.",
      "Unauthorized local bypass paths that skip authoritative authentication/session/authorization checks.",
    ] as const;

    for (const token of requiredTokens) {
      expect(guide).toContain(token);
    }
  });
});
