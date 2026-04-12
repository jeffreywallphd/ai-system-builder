import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const identityTransportRoot = resolve(
  process.cwd(),
  "src/infrastructure/transport/http-server/identity",
);
const identityHttpServerPath = resolve(
  identityTransportRoot,
  "IdentityHttpServer.ts",
);
const moduleOwnershipRoots = Object.freeze([
  "composition",
  "middleware",
  "primitives",
  "dto",
  "route-families",
]);
const moduleOwnershipFiles = Object.freeze([
  "composition/IdentityHttpTransportComposition.ts",
  "composition/RouteModuleRegistry.ts",
  "middleware/request-metadata.ts",
  "middleware/session-authentication.ts",
  "middleware/workspace-context.ts",
  "route-families/AuthoritativeIdentityRouteFamilyModules.ts",
  "route-families/AuditRouteFamilyHandler.ts",
  "route-families/ExecutionNodeManagementRouteFamilyHandler.ts",
  "route-families/RunRouteFamilyHandlers.ts",
  "dto/AuditRouteDtoMapper.ts",
  "dto/ExecutionNodeManagementRouteDtoMapper.ts",
  "dto/RunRouteDtoMapper.ts",
]);

function countLines(filePath: string): number {
  return readFileSync(filePath, "utf8").split(/\r?\n/).length;
}

describe("HTTP transport modularization maintainability guardrails", () => {
  it("keeps explicit modular ownership directories and key modules checked in", () => {
    for (const root of moduleOwnershipRoots) {
      expect(existsSync(resolve(identityTransportRoot, root))).toBeTrue();
    }

    for (const filePath of moduleOwnershipFiles) {
      expect(existsSync(resolve(identityTransportRoot, filePath))).toBeTrue();
    }
  });

  it("keeps the monolithic server file bounded while module families carry meaningful ownership", () => {
    const monolithLines = countLines(identityHttpServerPath);
    const extractedModuleLines = moduleOwnershipFiles
      .map((relativePath) => countLines(resolve(identityTransportRoot, relativePath)))
      .reduce((sum, value) => sum + value, 0);
    const monolithToModuleRatio = monolithLines / extractedModuleLines;

    expect(monolithLines).toBeLessThanOrEqual(12_000);
    expect(extractedModuleLines).toBeGreaterThanOrEqual(2_000);
    expect(monolithToModuleRatio).toBeLessThan(6);
  });

  it("keeps route-family module ownership explicit in the canonical module registry file", () => {
    const source = readFileSync(
      resolve(identityTransportRoot, "route-families/AuthoritativeIdentityRouteFamilyModules.ts"),
      "utf8",
    );

    const requiredOwnershipTokens = Object.freeze([
      "IdentityAuthRouteFamilyModule",
      "WorkspaceInvitationRouteFamilyModule",
      "WorkspaceAdministrationRouteFamilyModule",
      "AuthorizationManagementRouteFamilyModule",
      "DeploymentPolicyReadRouteFamilyModule",
      "DeploymentPolicyWriteRouteFamilyModule",
      "AuditLedgerRouteFamilyModule",
      "NodeTrustRouteFamilyModule",
      "ExecutionNodeManagementRouteFamilyModule",
      "SecurityCertificateOperationsRouteFamilyModule",
      "SecuritySecretMetadataRouteFamilyModule",
      "StorageManagementRouteFamilyModule",
      "AssetManagementRouteFamilyModule",
      "ImageAssetManagementRouteFamilyModule",
      "RunSubmissionRouteFamilyModule",
      "RunReadRouteFamilyModule",
      "RunMutationRouteFamilyModule",
      "ImageRunRouteFamilyModule",
      "RunExecutionUpdateRouteFamilyModule",
      "RuntimeRouteFamilyModule",
      "DefaultIdentityHttpRouteFamilyModules",
    ]);

    for (const token of requiredOwnershipTokens) {
      expect(source).toContain(token);
    }
  });
});
