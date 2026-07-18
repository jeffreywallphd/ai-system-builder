import { describe, expect, it, testDouble } from "../../../../../testing/node-test";
import { DESKTOP_ASSET_STUDIO_CHANNELS } from "../../../../../contracts/ipc";
import { registerAssetStudioIpc } from "../../../ipc-electron/asset-studio/registerAssetStudioIpc";
import { registerAssetStudioApiRoutes } from "../registerAssetStudioApiRoutes";

const services = () => ({ start: { execute: testDouble.fn(async (value: any) => ({ ok: true, value })) }, propose: { execute: testDouble.fn(async (value: any) => ({ ok: true, value })) }, review: { execute: testDouble.fn(async (value: any) => ({ ok: true, value })) }, read: { execute: testDouble.fn(async () => ({ ok: false, error: { code: "studio.workflow.not-found", message: "Not found" } })) }, list: { execute: testDouble.fn(async () => []) } }) as any;

describe("Asset Studio transport parity", () => {
  it("registers start/propose/review/read/list over API and IPC and assigns the authenticated actor", async () => {
    const routes = { get: new Map<string, any>(), post: new Map<string, any>() }; const api = services();
    registerAssetStudioApiRoutes({ app: { get: (path, handler) => routes.get.set(path, handler), post: (path, handler) => routes.post.set(path, handler) }, ...api });
    expect([...routes.get.keys(), ...routes.post.keys()].sort()).toEqual(["/api/asset-studio/proposal", "/api/asset-studio/propose", "/api/asset-studio/review", "/api/asset-studio/start", "/api/asset-studio/workflows"].sort());
    const json = testDouble.fn(); const response: any = { status: testDouble.fn(() => response), json };
    await routes.post.get("/api/asset-studio/start")({ body: { workspaceId: "workspace-a", displayName: "View", definitionRef: { id: "view", version: "1" } }, securityContext: { principal: { id: "person-1" } } }, response);
    expect(api.start.execute.mock.calls[0][0]).toMatchObject({ workspaceId: "workspace-a", actorId: "person-1" });

    const handlers = new Map<string, any>(); const ipc = services();
    registerAssetStudioIpc({ ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) }, ...ipc });
    expect([...handlers.keys()].sort()).toEqual(Object.values(DESKTOP_ASSET_STUDIO_CHANNELS).map((entry) => entry.request.value).sort());
    await handlers.get(DESKTOP_ASSET_STUDIO_CHANNELS.start.request.value)({}, { payload: { workspaceId: "workspace-a", displayName: "View", definitionRef: { id: "view", version: "1" } } });
    expect(ipc.start.execute.mock.calls[0][0]).toMatchObject({ workspaceId: "workspace-a", actorId: "local-user" });
  });
});
