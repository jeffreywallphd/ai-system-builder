import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { registerModelManagementApiRoutes, type ModelManagementExpressRoutePort } from "../model/registerModelManagementApiRoutes";

function response(){const json=testDouble.fn();const status=testDouble.fn();const res:any={status:status.mockImplementation(()=>res),json};return{res,status,json};}

describe("registerModelManagementApiRoutes",()=>{
  it("registers model management routes and calls use cases", async()=>{
    const handlers=new Map<string,any>(); const app:ModelManagementExpressRoutePort={post:testDouble.fn((p,h)=>handlers.set(p,h))};
    const deps:any={browseModelsUseCase:{execute:testDouble.fn(async(x)=>x)},getModelDetailsUseCase:{execute:testDouble.fn(async(x)=>x)},listModelsUseCase:{execute:testDouble.fn(async(x)=>x)},saveModelReferenceUseCase:{execute:testDouble.fn(async(x)=>x)},downloadModelUseCase:{execute:testDouble.fn(async(x)=>x)},updateModelRecordUseCase:{execute:testDouble.fn(async(x)=>x)},deleteModelRecordUseCase:{execute:testDouble.fn(async(x)=>x)}};
    registerModelManagementApiRoutes({app,...deps});
    expect([...handlers.keys()]).toEqual(["/api/model/browse","/api/model/details","/api/model/list","/api/model/reference/save","/api/model/download","/api/model/record/update","/api/model/record/delete"]);
    await handlers.get('/api/model/details')({body:{provider:'huggingface',modelId:'a/b'},headers:{}},response().res);
    expect(deps.getModelDetailsUseCase.execute).toHaveBeenCalledWith({provider:'huggingface',modelId:'a/b'});
  });

  it("returns validation and mapped failure statuses", async()=>{
    const handlers=new Map<string,any>(); const app:ModelManagementExpressRoutePort={post:testDouble.fn((p,h)=>handlers.set(p,h))};
    const deps:any={browseModelsUseCase:{execute:testDouble.fn(async()=>{throw {code:'unavailable',message:'down'};})},getModelDetailsUseCase:{execute:testDouble.fn()},listModelsUseCase:{execute:testDouble.fn()},saveModelReferenceUseCase:{execute:testDouble.fn()},downloadModelUseCase:{execute:testDouble.fn(async()=>{throw {code:'not-found',message:'n'};})},updateModelRecordUseCase:{execute:testDouble.fn()},deleteModelRecordUseCase:{execute:testDouble.fn()}};
    registerModelManagementApiRoutes({app,...deps});
    const a=response(); await handlers.get('/api/model/list')({body:null,headers:{}},a.res); expect(a.status).toHaveBeenCalledWith(400);
    const b=response(); await handlers.get('/api/model/browse')({body:{provider:'huggingface'},headers:{}},b.res); expect(b.status).toHaveBeenCalledWith(503);
    const c=response(); await handlers.get('/api/model/download')({body:{provider:'huggingface',modelId:'x'},headers:{}},c.res); expect(c.status).toHaveBeenCalledWith(404);
  });

  it("logs browse request lifecycle", async()=>{
    const handlers=new Map<string,any>(); const app:ModelManagementExpressRoutePort={post:testDouble.fn((p,h)=>handlers.set(p,h))};
    const logger={info:testDouble.fn(),warn:testDouble.fn()};
    registerModelManagementApiRoutes({
      app,logger,
      browseModelsUseCase:{execute:testDouble.fn(async()=>({models:[{id:'a'},{id:'b'}]}))},
      getModelDetailsUseCase:{execute:testDouble.fn(async()=>({}))},listModelsUseCase:{execute:testDouble.fn(async()=>({models:[]}))},saveModelReferenceUseCase:{execute:testDouble.fn(async()=>({}))},downloadModelUseCase:{execute:testDouble.fn(async()=>({}))},updateModelRecordUseCase:{execute:testDouble.fn(async()=>({}))},deleteModelRecordUseCase:{execute:testDouble.fn(async()=>({}))},
    });
    await handlers.get('/api/model/browse')({body:{provider:'huggingface',query:'flux',modelId:'z'},headers:{'x-request-id':'r1','x-correlation-id':'c1'}},response().res);
    const infoCalls = logger.info.mock.calls;
    expect(infoCalls.some((call:any[]) => call[0]==='api.model.request.received' && call[1]?.operation==='model.browse' && call[1]?.provider==='huggingface' && call[1]?.query==='flux' && call[1]?.requestId==='r1' && call[1]?.correlationId==='c1')).toBe(true);
    expect(infoCalls.some((call:any[]) => call[0]==='api.model.request.succeeded' && call[1]?.operation==='model.browse' && call[1]?.resultCount===2 && call[1]?.requestId==='r1' && call[1]?.correlationId==='c1')).toBe(true);
  });

  it("logs download result details from the nested download payload", async()=>{
    const handlers=new Map<string,any>(); const app:ModelManagementExpressRoutePort={post:testDouble.fn((p,h)=>handlers.set(p,h))};
    const logger={info:testDouble.fn(),warn:testDouble.fn()};
    registerModelManagementApiRoutes({
      app,logger,
      browseModelsUseCase:{execute:testDouble.fn(async()=>({models:[]}))},
      getModelDetailsUseCase:{execute:testDouble.fn(async()=>({}))},
      listModelsUseCase:{execute:testDouble.fn(async()=>({models:[]}))},
      saveModelReferenceUseCase:{execute:testDouble.fn(async()=>({}))},
      downloadModelUseCase:{execute:testDouble.fn(async()=>({model:{modelRecordId:"downloaded-stable-diffusion"},download:{provider:"transformers",modelId:"stabilityai/stable-diffusion-xl-base-1.0",downloaded:true,fromCache:false,localPath:"/models/sdxl"}}))},
      updateModelRecordUseCase:{execute:testDouble.fn(async()=>({}))},
      deleteModelRecordUseCase:{execute:testDouble.fn(async()=>({}))},
    });
    await handlers.get('/api/model/download')({body:{provider:'huggingface',modelId:'stabilityai/stable-diffusion-xl-base-1.0'},headers:{}},response().res);
    const infoCalls = logger.info.mock.calls;
    expect(infoCalls.some((call:any[]) => call[0]==='api.model.request.succeeded' && call[1]?.operation==='model.download' && call[1]?.modelId==='stabilityai/stable-diffusion-xl-base-1.0' && call[1]?.modelRecordId==='downloaded-stable-diffusion' && call[1]?.downloaded===true && call[1]?.fromCache===false && typeof call[1]?.elapsedMs==="number")).toBe(true);
  });

  it("logs browse failure with mapped code", async()=>{
    const handlers=new Map<string,any>(); const app:ModelManagementExpressRoutePort={post:testDouble.fn((p,h)=>handlers.set(p,h))};
    const logger={info:testDouble.fn(),warn:testDouble.fn()};
    registerModelManagementApiRoutes({app,logger,browseModelsUseCase:{execute:testDouble.fn(async()=>{throw {code:'unavailable',message:'hf down'};})},getModelDetailsUseCase:{execute:testDouble.fn(async()=>({}))},listModelsUseCase:{execute:testDouble.fn(async()=>({models:[]}))},saveModelReferenceUseCase:{execute:testDouble.fn(async()=>({}))},downloadModelUseCase:{execute:testDouble.fn(async()=>({}))},updateModelRecordUseCase:{execute:testDouble.fn(async()=>({}))},deleteModelRecordUseCase:{execute:testDouble.fn(async()=>({}))}});
    await handlers.get('/api/model/browse')({body:{provider:'huggingface',query:'flux'},headers:{}},response().res);
    const warnCalls = logger.warn.mock.calls;
    expect(warnCalls.some((call:any[]) => call[0]==='api.model.request.failed' && call[1]?.operation==='model.browse' && call[1]?.code==='unavailable' && call[1]?.message==='Required runtime capability is not ready.')).toBe(true);
  });

  it("sanitizes internal model API failures", async()=>{
    const handlers=new Map<string,any>(); const app:ModelManagementExpressRoutePort={post:testDouble.fn((p,h)=>handlers.set(p,h))};
    registerModelManagementApiRoutes({app,browseModelsUseCase:{execute:testDouble.fn(async()=>{throw new Error('raw model failure at /tmp/secret\nstack trace');})},getModelDetailsUseCase:{execute:testDouble.fn(async()=>({}))},listModelsUseCase:{execute:testDouble.fn(async()=>({models:[]}))},saveModelReferenceUseCase:{execute:testDouble.fn(async()=>({}))},downloadModelUseCase:{execute:testDouble.fn(async()=>({}))},updateModelRecordUseCase:{execute:testDouble.fn(async()=>({}))},deleteModelRecordUseCase:{execute:testDouble.fn(async()=>({}))}});
    const out=response(); await handlers.get('/api/model/browse')({body:{provider:'huggingface',query:'flux'},headers:{}},out.res);
    expect(out.status).toHaveBeenCalledWith(500);
    expect(out.json.mock.calls[0]?.[0]).toMatchObject({ok:false,error:{code:'internal',message:'Model management request failed.'}});
    expect(JSON.stringify(out.json.mock.calls[0]?.[0])).not.toContain('/tmp/secret');
    expect(JSON.stringify(out.json.mock.calls[0]?.[0])).not.toContain('stack trace');
  });
});
