import { describe, expect, it } from "bun:test";
import { resolveIdentityAccessChannel, resolveIdentityClientContext } from "../IdentityAuthEnvironment";

describe("IdentityAuthEnvironment", () => {
  it("resolves desktop access channel when desktop bridge is available", () => {
    (globalThis as typeof globalThis & { window?: Window }).window = {
      aiLoomDesktop: {} as Window["aiLoomDesktop"],
    } as Window;

    expect(resolveIdentityAccessChannel()).toBe("desktop");
  });

  it("resolves thin-client access channel when desktop bridge is unavailable", () => {
    (globalThis as typeof globalThis & { window?: Window }).window = {} as Window;

    expect(resolveIdentityAccessChannel()).toBe("thin-client");
  });

  it("returns user agent client context when navigator is available", () => {
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { userAgent: "bun-test-agent" } satisfies Pick<Navigator, "userAgent">,
    });

    expect(resolveIdentityClientContext()).toEqual({ userAgent: "bun-test-agent" });
  });
});
