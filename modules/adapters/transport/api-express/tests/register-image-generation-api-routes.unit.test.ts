import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { registerImageGenerationApiRoutes, type ExpressRoutePort } from "../image-generation/registerImageGenerationApiRoutes";

function response() { const json = testDouble.fn(); const res:any={status:testDouble.fn(()=>res),json}; return {res,json}; }

describe("registerImageGenerationApiRoutes", () => {
  it("routes start/read/cancel/finalize and delegates to use case and orchestrator", async () => {
    const handlers = new Map<string, any>();
    const app: ExpressRoutePort = { post: testDouble.fn((p,h)=>handlers.set(p,h)) };
    const generateImageUseCase = {
      startImageGeneration: testDouble.fn(async ()=>({ requestId:"r1", status:"running" })),
      readImageGeneration: testDouble.fn(async ()=>({ requestId:"r1", status:"running", taskType:"image-generation", concurrencyClass:"image" })),
      cancelImageGeneration: testDouble.fn(async ()=>({ requestId:"r1", cancelled:true, status:"cancelled" })),
    } as any;
    const orchestrator = { finalizeIfCompleted: testDouble.fn(async ()=>({ finalized:true })) };
    registerImageGenerationApiRoutes({ app, generateImageUseCase, imageGenerationFinalizationOrchestrator: orchestrator });

    await handlers.get('/api/image-generation/start')({ body: { prompt: 'cat' }, headers: {} }, response().res);
    expect(generateImageUseCase.startImageGeneration).toHaveBeenCalledOnce();
    await handlers.get('/api/image-generation/read')({ body: { requestId: 'r1' }, headers: {} }, response().res);
    expect(generateImageUseCase.readImageGeneration).toHaveBeenCalledWith('r1', { requestId: undefined, correlationId: undefined });
    await handlers.get('/api/image-generation/cancel')({ body: { requestId: 'r1' }, headers: {} }, response().res);
    expect(generateImageUseCase.cancelImageGeneration).toHaveBeenCalledWith('r1', { requestId: undefined, correlationId: undefined });
    await handlers.get('/api/image-generation/finalize')({ body: { requestId: 'r1' }, headers: {} }, response().res);
    expect(orchestrator.finalizeIfCompleted).toHaveBeenCalledWith('r1');
  });

  it("returns unavailable finalize response when orchestrator is absent", async () => {
    const handlers = new Map<string, any>();
    const app: ExpressRoutePort = { post: testDouble.fn((p,h)=>handlers.set(p,h)) };
    registerImageGenerationApiRoutes({ app, generateImageUseCase: { startImageGeneration: testDouble.fn(), readImageGeneration: testDouble.fn(), cancelImageGeneration: testDouble.fn() } as any });
    const { res, json } = response();
    await handlers.get('/api/image-generation/finalize')({ body: { requestId: 'r1' }, headers: {} }, res);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, value: { finalized: false, reason: 'image generation finalization is unavailable' } }));
  });
});
