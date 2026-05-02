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
});
