import { describe, expect, it } from "bun:test";
import { AutoSaveController } from "../AutoSaveController";

describe("AutoSaveController", () => {
  it("coalesces rapid save requests into a single flush", async () => {
    const calls: string[] = [];
    const controller = new AutoSaveController({
      delayMs: 20,
      onSave: () => {
        calls.push("save");
      },
    });

    controller.schedule();
    controller.schedule();
    controller.schedule();

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(calls).toEqual(["save"]);
  });

  it("queues another save when changes arrive during an in-flight save", async () => {
    const calls: string[] = [];
    let releaseSave: (() => void) | undefined;
    const controller = new AutoSaveController({
      delayMs: 0,
      onSave: async () => {
        calls.push(`save-${calls.length + 1}`);
        await new Promise<void>((resolve) => {
          releaseSave = resolve;
        });
      },
    });

    controller.schedule();
    await new Promise((resolve) => setTimeout(resolve, 10));
    controller.schedule();
    releaseSave?.();
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(calls).toEqual(["save-1", "save-2"]);
  });
});
