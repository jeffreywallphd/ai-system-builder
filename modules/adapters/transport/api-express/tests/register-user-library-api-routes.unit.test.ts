import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { registerUserLibraryApiRoutes } from "../user-library/registerUserLibraryApiRoutes";

describe("registerUserLibraryApiRoutes", () => {
  it("registers user-library route family", () => {
    const app = { get: testDouble.fn(), post: testDouble.fn() };
    registerUserLibraryApiRoutes({ app: app as any });
    expect(app.post.mock.calls.map((c:any)=>c[0])).toEqual([
      '/api/user-library/assets/promote','/api/user-library/workspace-links','/api/workspaces/:workspaceId/user-library/copies','/api/workspaces/:targetWorkspaceId/imports/workspace-asset',
    ]);
  });

  it("calls link use case with explicit target workspace id", async () => {
    let handler:any; const app={get:testDouble.fn(), post:testDouble.fn((p:string,h:any)=>{ if(p==='/api/user-library/workspace-links') handler=h; })};
    const execute = testDouble.fn(async ()=>({ok:true,status:'linked'}));
    registerUserLibraryApiRoutes({ app: app as any, linkUseCase: { execute } as any });
    const response:any={ code:0, body:undefined, status(c:number){this.code=c; return this;}, json(v:unknown){this.body=v;} };
    await handler({ body: { targetWorkspaceId:' workspace.a ', userLibraryAssetReference:{assetId:'id',version:'1.0.0'}, versionSelection:{kind:'latest-active'}, propagationPolicy:'manual-only' } }, response);
    expect(execute.mock.calls[0][0].targetWorkspaceId).toBe('workspace.a');
    expect(response.code).toBe(200);
  });

  it("returns unavailable when dependency missing", async () => {
    let handler:any; const app={get:testDouble.fn(), post:testDouble.fn((p:string,h:any)=>{ if(p==='/api/user-library/assets/promote') handler=h; })};
    registerUserLibraryApiRoutes({ app: app as any });
    const response:any={ code:0, body:undefined, status(c:number){this.code=c; return this;}, json(v:unknown){this.body=v;} };
    await handler({ body: {} }, response);
    expect(response.code).toBe(503);
  });
});
