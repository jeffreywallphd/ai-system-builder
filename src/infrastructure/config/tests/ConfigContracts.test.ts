import { describe, expect, it } from "bun:test";
import type { IEnvironmentConfigProvider } from "@application/ports/interfaces/IEnvironmentConfigProvider";
import { EnvironmentConfig } from "../EnvironmentConfig";
import { EnvironmentConfigProvider } from "../EnvironmentConfigProvider";

describe("config contracts", () => {
  it("EnvironmentConfigProvider adheres to IEnvironmentConfigProvider behavior", async () => {
    const provider: IEnvironmentConfigProvider = new EnvironmentConfigProvider(
      new EnvironmentConfig({ key: "value", n: "1", b: "false" })
    );

    expect(await provider.get("key")).toBe("value");
    expect(await provider.getNumber("n")).toBe(1);
    expect(await provider.getBoolean("b")).toBe(false);
    expect(await provider.has("key")).toBe(true);
  });
});

