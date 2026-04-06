import { describe, expect, it } from "bun:test";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  HostStartupDependencyBoundaryLayers,
  HostRuntimeKinds,
} from "../../src/domain/hosts/HostRuntimeDomain";
import { HostRuntimeCatalog } from "../../src/hosts/HostRuntimeCatalog";

const projectRoot = process.cwd();
const srcRoot = path.resolve(projectRoot, "src");
const hostsRoot = path.resolve(srcRoot, "hosts");

type HostSourceExpectations = {
  readonly kind: keyof typeof HostRuntimeCatalog;
  readonly hostFolder: string;
  readonly compositionRootFile: string;
  readonly entrypointFile: string;
  readonly serviceCoverageToken: string;
};

const hostSourceExpectations: ReadonlyArray<HostSourceExpectations> = [
  {
    kind: HostRuntimeKinds.server,
    hostFolder: "server",
    compositionRootFile: "AuthoritativeServerCompositionRoot.ts",
    entrypointFile: "AuthoritativeServerHostEntrypoint.ts",
    serviceCoverageToken: "assertAuthoritativeControlPlaneServiceCoverage",
  },
  {
    kind: HostRuntimeKinds.desktop,
    hostFolder: "desktop",
    compositionRootFile: "DesktopHostCompositionRoot.ts",
    entrypointFile: "DesktopHostEntrypoint.ts",
    serviceCoverageToken: "assertDesktopHostServiceCoverage",
  },
  {
    kind: HostRuntimeKinds.hybrid,
    hostFolder: "hybrid",
    compositionRootFile: "HybridHostCompositionRoot.ts",
    entrypointFile: "HybridHostEntrypoint.ts",
    serviceCoverageToken: "assertHybridHostServiceCoverage",
  },
  {
    kind: HostRuntimeKinds.web,
    hostFolder: "web",
    compositionRootFile: "WebHostCompositionRoot.ts",
    entrypointFile: "WebHostEntrypoint.ts",
    serviceCoverageToken: "assertWebHostServiceCoverage",
  },
  {
    kind: HostRuntimeKinds.worker,
    hostFolder: "worker",
    compositionRootFile: "WorkerHostCompositionRoot.ts",
    entrypointFile: "WorkerHostEntrypoint.ts",
    serviceCoverageToken: "assertWorkerHostServiceCoverage",
  },
] as const;

async function listFilesRecursively(root: string): Promise<ReadonlyArray<string>> {
  const found: string[] = [];
  const queue = [root];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const resolved = path.resolve(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(resolved);
        continue;
      }
      found.push(resolved);
    }
  }

  return Object.freeze(found);
}

function toProjectRelative(filePath: string): string {
  return path.relative(projectRoot, filePath).replaceAll("\\", "/");
}

describe("Host composition architecture guardrails", () => {
  it("keeps canonical composition roots and entrypoints colocated under src/hosts", async () => {
    for (const entry of hostSourceExpectations) {
      const runtime = HostRuntimeCatalog[entry.kind];
      const hostFolder = path.resolve(hostsRoot, entry.hostFolder);
      const compositionRootPath = path.resolve(hostFolder, entry.compositionRootFile);
      const entrypointPath = path.resolve(hostFolder, entry.entrypointFile);

      await expect(readFile(compositionRootPath, "utf8")).resolves.toContain(
        `composition-root:host:${runtime.kind}`,
      );
      await expect(readFile(entrypointPath, "utf8")).resolves.toContain(
        "createHostBootConfiguration",
      );
    }
  });

  it("prevents host composition root implementation from drifting outside src/hosts", async () => {
    const sourceFiles = (await listFilesRecursively(srcRoot)).filter((filePath) => filePath.endsWith(".ts"));
    const hostCompositionRootFiles = sourceFiles.filter((filePath) => {
      const relativePath = toProjectRelative(filePath);
      if (relativePath.includes("/tests/")) {
        return false;
      }
      return relativePath.endsWith("CompositionRoot.ts");
    });

    const violations: string[] = [];
    for (const filePath of hostCompositionRootFiles) {
      const content = await readFile(filePath, "utf8");
      if (!content.includes("composition-root:host:")) {
        continue;
      }
      const relativePath = toProjectRelative(filePath);
      if (!relativePath.startsWith("src/hosts/")) {
        violations.push(relativePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps host composition roots on shared bootstrap and service-registration contracts", async () => {
    const violations: string[] = [];

    for (const entry of hostSourceExpectations) {
      const compositionRootPath = path.resolve(hostsRoot, entry.hostFolder, entry.compositionRootFile);
      const compositionRootSource = await readFile(compositionRootPath, "utf8");
      const relativePath = toProjectRelative(compositionRootPath);
      const requiredTokens = [
        "assertExecutableHostBoundarySatisfiesBootConfiguration",
        "createHostStartupContext",
        "composeHostBootstrapPipeline",
        "executeHostBootstrapPipeline",
        "composeHostServiceRegistrationPlan",
        entry.serviceCoverageToken,
      ] as const;

      for (const token of requiredTokens) {
        if (!compositionRootSource.includes(token)) {
          violations.push(`${relativePath} is missing required token '${token}'.`);
        }
      }

      if (compositionRootSource.includes("../../ui/") || compositionRootSource.includes("../ui/")) {
        violations.push(`${relativePath} must not import from ui/; compose UI through application/infrastructure contracts.`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps host entrypoints defaulting required dependencies to host runtime startup dependencies", async () => {
    const violations: string[] = [];

    for (const entry of hostSourceExpectations) {
      const entrypointPath = path.resolve(hostsRoot, entry.hostFolder, entry.entrypointFile);
      const entrypointSource = await readFile(entrypointPath, "utf8");
      const relativePath = toProjectRelative(entrypointPath);

      const requiredTokens = [
        ".startupDependencies.map((dependency) => dependency.dependencyId)",
        "requiredDependencyIds: options?.requiredDependencyIds ?? resolveDefaultRequiredDependencyIds()",
      ] as const;

      for (const token of requiredTokens) {
        if (!entrypointSource.includes(token)) {
          violations.push(`${relativePath} is missing required token '${token}'.`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps host startup dependency boundaries explicit by shared/application/host layer coverage", () => {
    const violations: string[] = [];

    for (const runtime of Object.values(HostRuntimeCatalog)) {
      const layers = new Set(runtime.startupDependencies.map((dependency) => dependency.boundaryLayer));
      if (!layers.has(HostStartupDependencyBoundaryLayers.sharedContracts)) {
        violations.push(`${runtime.hostId} is missing shared-contracts startup dependency boundary.`);
      }
      if (!layers.has(HostStartupDependencyBoundaryLayers.application)) {
        violations.push(`${runtime.hostId} is missing application startup dependency boundary.`);
      }
      if (!layers.has(HostStartupDependencyBoundaryLayers.host)) {
        violations.push(`${runtime.hostId} is missing host startup dependency boundary.`);
      }

      for (const dependency of runtime.startupDependencies) {
        const expectedPrefix = `dep:${dependency.boundaryLayer.split("-")[0]}:`;
        if (!dependency.dependencyId.startsWith(expectedPrefix)) {
          violations.push(
            `${runtime.hostId} dependency '${dependency.dependencyId}' should use '${expectedPrefix}*' prefix for '${dependency.boundaryLayer}' layer.`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
