import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AuthoritativeApiRouteBackendKeys } from "../AuthoritativeApiRouteRegistration";
import { composeAuthoritativeApiRouteRegistrationPlan } from "../AuthoritativeApiRouteRegistrationCatalog";
import { UnifiedApiDomainConvergenceContracts } from "@shared/contracts/hosts/UnifiedApiConvergenceContracts";

const ConvergedClientFiles = Object.freeze([
  "src/ui/shared/identity/IdentityAuthClient.ts",
  "src/ui/shared/workspaces/WorkspaceAdministrationClient.ts",
  "src/ui/shared/runtime/RuntimeControlClient.ts",
  "src/ui/shared/runtime/RuntimeRealtimeSubscriptionService.ts",
]);

describe("Unified API contract drift verification", () => {
  it("keeps converged client route usage aligned with authoritative route registration", () => {
    const backendAvailability = Object.freeze(
      Object.fromEntries(
        Object.values(AuthoritativeApiRouteBackendKeys).map((key) => [key, true]),
      ) as Record<(typeof AuthoritativeApiRouteBackendKeys)[keyof typeof AuthoritativeApiRouteBackendKeys], boolean>,
    );
    const registrationPlan = composeAuthoritativeApiRouteRegistrationPlan({ backendAvailability });

    const allowedRoutePrefixes = new Set(registrationPlan.registeredRoutePrefixes);
    const clientRoutePrefixes = extractClientRoutePrefixes();
    const requiredConvergedPrefixes = [
      "/api/v1/identity",
      "/api/v1/workspaces",
      "/api/v1/runtime",
      "/ws",
    ];

    for (const prefix of requiredConvergedPrefixes) {
      if (prefix === "/ws") {
        expect(clientRoutePrefixes.has(prefix)).toBeTrue();
        continue;
      }
      expect(allowedRoutePrefixes.has(prefix)).toBeTrue();
      expect(clientRoutePrefixes.has(prefix)).toBeTrue();
    }

    const convergenceDomains = new Set(UnifiedApiDomainConvergenceContracts.map((contract) => contract.domainId));
    expect(convergenceDomains.has("identity-session")).toBeTrue();
    expect(convergenceDomains.has("workspace-administration")).toBeTrue();
    expect(convergenceDomains.has("system-runtime-and-queue-control")).toBeTrue();
  });
});

function extractClientRoutePrefixes(): ReadonlySet<string> {
  const extracted = new Set<string>();

  for (const relativePath of ConvergedClientFiles) {
    const absolutePath = join(process.cwd(), relativePath);
    const sourceText = readFileSync(absolutePath, "utf8");
    const routeMatches = sourceText.match(/\/api\/v1\/[a-z-]+/g) ?? [];
    for (const routePrefix of routeMatches) {
      extracted.add(routePrefix);
    }

    if (sourceText.includes("\"/ws\"") || sourceText.includes("'/ws'")) {
      extracted.add("/ws");
    }
  }

  return extracted;
}
