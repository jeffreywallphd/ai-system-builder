import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cloneJson } from "../user-library/local-user-library-record-store";

export const RUNTIME_READINESS_LOCAL_STORE_KIND = "runtime-readiness-local-store" as const;
interface Manifest { readonly schemaVersion: 1; readonly storeKind: typeof RUNTIME_READINESS_LOCAL_STORE_KIND; readonly updatedAt: string }
export class LocalRuntimeReadinessRecordStoreError extends Error { constructor(m:string){ super(m); this.name="LocalRuntimeReadinessRecordStoreError"; this.stack=undefined; } }
export class LocalRuntimeReadinessRecordStore {
  private readonly dir:string; private readonly now:()=>string;
  constructor(o:{rootDir:string; now?:()=>string}){ this.dir=join(o.rootDir,"runtime-readiness"); this.now=o.now??(()=>new Date().toISOString()); }
  async readBindings<T>():Promise<readonly T[]>{ await this.ensure(); const v=await this.readJson("runtime-readiness-bindings.json",[] as T[]); if(!Array.isArray(v)) throw new LocalRuntimeReadinessRecordStoreError("Runtime readiness binding collection is invalid."); return cloneJson(v as T[]); }
  async writeBindings<T>(records:readonly T[]):Promise<void>{ await this.writeJson("runtime-readiness-bindings.json", cloneJson(records)); await this.writeJson("runtime-readiness-manifest.json", this.manifest()); }
  async readInventory<T>():Promise<readonly T[]>{ await this.ensure(); const v=await this.readJson("runtime-inventory.json",[] as T[]); if(!Array.isArray(v)) throw new LocalRuntimeReadinessRecordStoreError("Runtime inventory collection is invalid."); return cloneJson(v as T[]); }
  async writeInventory<T>(records:readonly T[]):Promise<void>{ await this.writeJson("runtime-inventory.json", cloneJson(records)); await this.writeJson("runtime-readiness-manifest.json", this.manifest()); }
  private manifest():Manifest{ return { schemaVersion:1, storeKind:RUNTIME_READINESS_LOCAL_STORE_KIND, updatedAt:this.now()}; }
  private async ensure(){ await mkdir(this.dir,{recursive:true}); const m=await this.readJson("runtime-readiness-manifest.json", this.manifest()); const x=m as Partial<Manifest>; if(x.schemaVersion!==1) throw new LocalRuntimeReadinessRecordStoreError("Runtime readiness local store manifest schema version is unsupported."); if(x.storeKind!==RUNTIME_READINESS_LOCAL_STORE_KIND) throw new LocalRuntimeReadinessRecordStoreError("Runtime readiness local store manifest kind is unsupported."); }
  private async readJson<T>(f:string,fallback:T):Promise<T>{ try{return JSON.parse(await readFile(join(this.dir,f),"utf8")) as T;}catch(e){ if((e as NodeJS.ErrnoException).code==="ENOENT") return cloneJson(fallback); if(e instanceof SyntaxError) throw new LocalRuntimeReadinessRecordStoreError("Runtime readiness local store contains malformed JSON."); throw e; }}
  private async writeJson(f:string,v:unknown){ const p=join(this.dir,f); const t=`${p}.${process.pid}.${randomUUID()}.tmp`; await writeFile(t,`${JSON.stringify(v,null,2)}\n`,`utf8`); await rename(t,p).catch(async(e)=>{ await unlink(t).catch(()=>undefined); throw e;}); }
}
