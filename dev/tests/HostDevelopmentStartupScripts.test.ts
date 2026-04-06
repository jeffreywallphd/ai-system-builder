import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type PackageJson = {
  readonly scripts?: Readonly<Record<string, string>>;
};

function readPackageScripts(): Readonly<Record<string, string>> {
  const packageJson = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  ) as PackageJson;

  return packageJson.scripts ?? {};
}

describe("host development startup scripts", () => {
  it("keeps the default dev workflow on desktop host startup", () => {
    const scripts = readPackageScripts();
    expect(scripts.dev).toBe("npm run dev:desktop");
  });

  it("routes individual host startup scripts through host entrypoint assemblies", () => {
    const scripts = readPackageScripts();

    expect(scripts["start:authoritative-server"]).toBe(
      "bun run src/hosts/server/AuthoritativeServerHostEntrypoint.ts",
    );
    expect(scripts["start:hybrid-host"]).toBe(
      "bun run src/hosts/hybrid/HybridHostEntrypoint.ts",
    );
    expect(scripts["start:web-host"]).toBe(
      "bun run src/hosts/web/WebHostEntrypoint.ts",
    );
    expect(scripts["start:worker-host"]).toBe(
      "bun run src/hosts/worker/WorkerHostEntrypoint.ts",
    );
  });

  it("provides host-based local development aliases and combined control-plane plus worker mode", () => {
    const scripts = readPackageScripts();

    expect(scripts["dev:host:authoritative-server"]).toBe("npm run start:authoritative-server");
    expect(scripts["dev:host:hybrid"]).toBe("npm run start:hybrid-host");
    expect(scripts["dev:host:web"]).toBe("npm run start:web-host");
    expect(scripts["dev:host:worker"]).toBe("npm run start:worker-host");
    expect(scripts["dev:host:control-plane-worker"]).toBe(
      "concurrently -k -n authoritative,worker \"npm run dev:host:authoritative-server\" \"npm run dev:host:worker\"",
    );
  });

  it("does not expose legacy direct identity server startup as a package script", () => {
    const scripts = readPackageScripts();
    const scriptValues = Object.values(scripts);
    const legacyHostReference = scriptValues.find((value) => value.includes("bun run hosts/server/IdentityServerHost.ts"));
    expect(legacyHostReference).toBeUndefined();
  });
});
