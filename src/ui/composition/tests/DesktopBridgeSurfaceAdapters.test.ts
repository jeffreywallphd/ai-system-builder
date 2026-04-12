import { afterEach, describe, expect, it } from "bun:test";
import { resolveDesktopWorkflowBridge } from "../DesktopWorkflowBridgeAdapter";
import { resolveDesktopStorageAdapter } from "../DesktopStorageAdapter";

describe("desktop bridge surface adapters", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("prefers namespaced deferred feature bridges over legacy root aliases", () => {
    const namespaced = {
      saveWorkflowRecord: () => undefined,
      loadWorkflowRecord: () => null,
      listWorkflowSummaries: () => [],
      deleteWorkflowRecord: () => undefined,
      workflowExists: () => false,
      getWorkflowPersistenceStatus: () => ({
        provider: "test",
        workflowsDirectory: "",
        indexDatabasePath: "",
        degraded: false,
        detail: "ok",
      }),
    };
    const legacy = {
      ...namespaced,
      getWorkflowPersistenceStatus: () => ({
        provider: "legacy",
        workflowsDirectory: "",
        indexDatabasePath: "",
        degraded: true,
        detail: "legacy",
      }),
    };

    (globalThis as { window: Window }).window = {
      aiLoomDesktop: {
        auth: {
          bootstrap: {
            runtimeConfig: {} as any,
          },
          storage: {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          },
        },
        features: {
          workflows: namespaced as any,
        },
        workflows: legacy as any,
      },
    } as unknown as Window;

    expect(resolveDesktopWorkflowBridge()).toBe(namespaced);
  });

  it("resolves storage through auth surface with legacy fallback compatibility", () => {
    const authStorage = {
      getItem: (key: string) => (key === "a" ? "b" : null),
      setItem: () => undefined,
      removeItem: () => undefined,
    };
    (globalThis as { window: Window }).window = {
      aiLoomDesktop: {
        auth: {
          bootstrap: {
            runtimeConfig: {} as any,
          },
          storage: authStorage,
        },
        features: {},
      },
    } as unknown as Window;

    const storage = resolveDesktopStorageAdapter();
    expect(storage?.getItem("a")).toBe("b");
  });
});
