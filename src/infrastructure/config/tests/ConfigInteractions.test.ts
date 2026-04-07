import { describe, expect, it } from "bun:test";
import { EnvironmentConfig } from "../EnvironmentConfig";
import { EnvironmentConfigProvider } from "../EnvironmentConfigProvider";

describe("config interactions", () => {
  it("provider reflects transformed config snapshots", async () => {
    const base = new EnvironmentConfig({ feature: "off" });
    const mutated = base.withValue("feature", "on");

    const baseProvider = new EnvironmentConfigProvider(base);
    const nextProvider = new EnvironmentConfigProvider(mutated);

    expect(await baseProvider.getString("feature")).toBe("off");
    expect(await nextProvider.getString("feature")).toBe("on");
  });
});
