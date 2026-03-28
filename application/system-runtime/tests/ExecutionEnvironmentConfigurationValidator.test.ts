import { describe, expect, it } from "bun:test";
import { ExecutionEnvironmentConfigurationValidator } from "../ExecutionEnvironmentConfigurationValidator";

describe("ExecutionEnvironmentConfigurationValidator", () => {
  it("normalizes bounded supported environment configuration", () => {
    const validator = new ExecutionEnvironmentConfigurationValidator();
    const validated = validator.validate({
      environmentId: " runtime:local-default ",
      option: "local",
      configuration: {
        requireNestedSystems: true,
        requireMcpMediatedExecution: false,
      },
    });

    expect(validated.requestedEnvironmentId).toBe("runtime:local-default");
    expect(validated.requestedEnvironmentKind).toBe("local");
    expect(validated.requireNestedSystems).toBeTrue();
    expect(validated.requireMcpMediatedExecution).toBeFalse();
  });

  it("rejects unsupported environment options and malformed config values", () => {
    const validator = new ExecutionEnvironmentConfigurationValidator();
    expect(() => validator.validate({ option: "unsupported" as never })).toThrow("Unsupported execution environment option");
    expect(() => validator.validate({
      option: "local",
      configuration: { requireNestedSystems: "yes" as never },
    })).toThrow("requireNestedSystems");
  });
});

