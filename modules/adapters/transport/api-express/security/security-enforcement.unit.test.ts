import { describe, expect, it } from "vitest";
import { API_ROUTE_POLICIES, resolveApiRoutePolicy } from "./apiRouteSecurityPolicy";
import { createExpressSecurityMiddleware } from "./createExpressSecurityMiddleware";
import { createSecurityApplicationError } from "../../../../contracts/security";

const REGISTERED_ROUTES = [
  "GET /api/security/status","POST /api/security/pairing/complete","POST /api/security/token/revoke",
  "POST /api/model/browse","POST /api/model/details","POST /api/model/list","POST /api/model/reference/save","POST /api/model/download","POST /api/model/record/update","POST /api/model/record/delete",
  "POST /api/image-generation/start","POST /api/image-generation/read","POST /api/image-generation/cancel","POST /api/image-generation/finalize",
  "GET /api/config/huggingface-token","POST /api/config/huggingface-token","DELETE /api/config/huggingface-token",
  "POST /api/artifact-repo/has","POST /api/huggingface/namespace/datasets","POST /api/huggingface/dataset/parquet-files","POST /api/artifact-repo/store","POST /api/artifact/publish","POST /api/artifact/publish/verify","POST /api/artifact/source/verify","POST /api/artifact/register-from-repo","POST /api/artifact/localize-from-repo",
  "POST /api/artifact/browse","POST /api/artifact/read","POST /api/artifact/content/read","GET /api/artifact/media/view","GET /api/artifact/upload/policy","POST /api/artifact/upload",
];

describe("api route security policy coverage", () => {
  it("covers all registered API routes", () => {
    expect([...API_ROUTE_POLICIES.keys()].sort()).toEqual([...REGISTERED_ROUTES].sort());
  });

  it("denies unknown api routes", () => {
    expect(resolveApiRoutePolicy("GET", "/api/unknown")).toMatchObject({ deny: true, securityCode: "security.route-policy-missing" });
  });
});

function makeRes(){ const state:any={statusCode:200, body:undefined}; return {state, status:(c:number)=>{state.statusCode=c; return res;}, json:(b:unknown)=>{state.body=b; return res;}} as any; var res:any; }

describe("security middleware", () => {
  it("disabled-dev allows missing token", async () => {
    const middleware = createExpressSecurityMiddleware({ httpsRequired: false, authRequired: false, verifyToken: async () => ({ principal: { id: "p", scopes: ["model:read"] }, auth: { method: "bearer-token" } } as any) });
    const req:any = { method: "POST", path: "/api/model/browse", protocol: "http", headers: {} };
    const res:any = { statusCode: 200, body: undefined, status(code:number){this.statusCode=code;return this;}, json(body:unknown){this.body=body;return this;} };
    let nextCalled=false; await middleware(req,res,()=>{nextCalled=true;}); expect(nextCalled).toBe(true);
  });

  it("maps auth failures", async () => {
    const check = async (errorCode: string, expected: string) => {
      const middleware = createExpressSecurityMiddleware({ httpsRequired: true, authRequired: true, verifyToken: async () => { throw createSecurityApplicationError(errorCode as any, "x"); } });
      const req:any = { method: "POST", path: "/api/model/browse", protocol: "https", headers: { authorization: "Bearer bad" } };
      const res:any = { statusCode: 200, body: undefined, status(code:number){this.statusCode=code;return this;}, json(body:unknown){this.body=body;return this;} };
      await middleware(req,res,()=>{});
      expect(res.body.error.details.securityCode).toBe(expected);
    };
    await check("security.invalid-token","security.invalid-token");
    await check("security.expired-token","security.expired-token");
    await check("security.revoked-token","security.revoked-token");
  });
});
