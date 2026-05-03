import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { registerImageGenerationApiRoutes, type ExpressRoutePort } from "../image-generation/registerImageGenerationApiRoutes";

function response() { const json = testDouble.fn(); const status = testDouble.fn(); const res:any={status:status.mockImplementation(()=>res),json}; return {res,json,status}; }

describe("registerImageGenerationApiRoutes", () => {
  it("validates start/read/cancel/finalize request bodies", async () => {
    const handlers = new Map<string, any>();
    const app: ExpressRoutePort = { post: testDouble.fn((p,h)=>handlers.set(p,h)) };
    const generateImageUseCase = { startImageGeneration: testDouble.fn(), readImageGeneration: testDouble.fn(), cancelImageGeneration: testDouble.fn() } as any;
    registerImageGenerationApiRoutes({ app, generateImageUseCase });

    for (const path of ["/api/image-generation/start","/api/image-generation/read","/api/image-generation/cancel","/api/image-generation/finalize"]) {
      const { res, status, json } = response();
      await handlers.get(path)({ body: {}, headers: {} }, res);
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: false, error: expect.objectContaining({ code: "validation" }) }));
    }
  });

  it("maps domain failure codes to HTTP status codes", async () => {
    const handlers = new Map<string, any>();
    const app: ExpressRoutePort = { post: testDouble.fn((p,h)=>handlers.set(p,h)) };
    const generateImageUseCase = {
      startImageGeneration: testDouble.fn(async ()=>{ throw { code: "unavailable", message: "down" }; }),
      readImageGeneration: testDouble.fn(async ()=>{ throw { code: "not-found", message: "missing" }; }),
      cancelImageGeneration: testDouble.fn(async ()=>{ throw { code: "validation", message: "bad" }; }),
    } as any;
    registerImageGenerationApiRoutes({ app, generateImageUseCase });

    const a=response(); await handlers.get("/api/image-generation/start")({ body: { prompt: "x" }, headers: {} }, a.res); expect(a.status).toHaveBeenCalledWith(503);
    const b=response(); await handlers.get("/api/image-generation/read")({ body: { requestId: "r1" }, headers: {} }, b.res); expect(b.status).toHaveBeenCalledWith(404);
    const c=response(); await handlers.get("/api/image-generation/cancel")({ body: { requestId: "r1" }, headers: {} }, c.res); expect(c.status).toHaveBeenCalledWith(400);
  });

  it("returns unavailable finalize response when orchestrator is absent", async () => {
    const handlers = new Map<string, any>();
    const app: ExpressRoutePort = { post: testDouble.fn((p,h)=>handlers.set(p,h)) };
    registerImageGenerationApiRoutes({ app, generateImageUseCase: { startImageGeneration: testDouble.fn(), readImageGeneration: testDouble.fn(), cancelImageGeneration: testDouble.fn() } as any });
    const { res, status, json } = response();
    await handlers.get('/api/image-generation/finalize')({ body: { requestId: 'r1' }, headers: {} }, res);
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, value: { finalized: false, reason: 'image generation finalization is unavailable' } }));
  });
});
