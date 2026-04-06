import { describe, expect, it } from "bun:test";
import {
  createBrowserDevelopmentAuthoritativeServerHostOptions,
} from "../browser-development/createBrowserDevelopmentVitePlugin";

describe("BrowserDevelopmentHostEntrypointBridge", () => {
  it("builds authoritative server host entrypoint options for browser development", () => {
    const options = createBrowserDevelopmentAuthoritativeServerHostOptions({
      databasePath: "C:/tmp/browser-dev-identity.sqlite",
      host: "127.0.0.1",
      port: 4321,
      environment: {
        NODE_ENV: "test",
      },
    });

    expect(options.hostOptions.databasePath).toBe("C:/tmp/browser-dev-identity.sqlite");
    expect(options.hostOptions.host).toBe("127.0.0.1");
    expect(options.hostOptions.port).toBe(4321);
    expect(options.hostOptions.cors?.allowLoopbackOrigins).toBeTrue();
    expect(options.boot?.startupReason).toBe("browser-development-vite-authoritative-host-startup");
    expect(options.boot?.environment?.NODE_ENV).toBe("test");
  });
});
