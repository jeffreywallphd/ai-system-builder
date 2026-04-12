import { describe, expect, it } from "bun:test";
import {
  runInTransactionBoundary,
  type IPlatformTransactionManager,
} from "../ports/PlatformTransactionPorts";

describe("platform transaction ports", () => {
  it("runs operations directly when no transaction manager is configured", async () => {
    const steps: string[] = [];

    const value = await runInTransactionBoundary(undefined, async () => {
      steps.push("operation");
      return "ok";
    });

    expect(value).toBe("ok");
    expect(steps).toEqual(["operation"]);
  });

  it("routes operations through the configured transaction manager", async () => {
    const steps: string[] = [];
    const manager: IPlatformTransactionManager = {
      runInTransaction: async (operation) => {
        steps.push("begin");
        try {
          const value = await operation();
          steps.push("commit");
          return value;
        } catch (error) {
          steps.push("rollback");
          throw error;
        }
      },
    };

    const value = await runInTransactionBoundary(manager, async () => {
      steps.push("operation");
      return "wrapped";
    });

    expect(value).toBe("wrapped");
    expect(steps).toEqual(["begin", "operation", "commit"]);
  });
});

