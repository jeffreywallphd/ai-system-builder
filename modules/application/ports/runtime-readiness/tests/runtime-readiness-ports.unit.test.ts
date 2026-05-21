import { describe, expect, expectTypeOf, it } from "../../../../testing/node-test";
import type { RuntimeInventoryRepositoryPort, RuntimeReadinessBindingRepositoryPort } from "..";

describe("runtime readiness ports",()=>{
  it("exports family", async()=>{ const family = await import(".."); expect(Object.keys(family).length).toBeGreaterThan(0); });
  it("requires explicit workspace scoped methods",()=>{
    expectTypeOf<Parameters<RuntimeReadinessBindingRepositoryPort["readRuntimeReadinessBindingRecord"]>[0]>().toEqualTypeOf<string>();
    expectTypeOf<Parameters<RuntimeInventoryRepositoryPort["readRuntimeInventoryRecord"]>[0]>().toEqualTypeOf<string>();
  });
  it("keeps list query filters safe and explicit",()=>{
    expectTypeOf<Parameters<RuntimeReadinessBindingRepositoryPort["listRuntimeReadinessBindingRecords"]>[0]>().toMatchTypeOf<{targetWorkspaceId:string; text?:string; limit?:number; cursor?:string}>();
    expectTypeOf<Parameters<RuntimeInventoryRepositoryPort["listRuntimeInventoryRecords"]>[0]>().toMatchTypeOf<{targetWorkspaceId:string; limit?:number; cursor?:string}>();
  });
});
