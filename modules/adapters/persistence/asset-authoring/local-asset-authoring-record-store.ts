import { randomUUID } from "node:crypto";import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";import { join } from "node:path";
import { cloneJson } from "../user-library/local-user-library-record-store";
export const ASSET_AUTHORING_LOCAL_STORE_KIND="asset-authoring-local-store" as const; export const ASSET_AUTHORING_LOCAL_SCHEMA_VERSION=1 as const;
export interface LocalAssetAuthoringRecordStoreOptions { readonly rootDir:string; readonly now?:()=>string; }
export class LocalAssetAuthoringRecordStoreError extends Error{constructor(m:string){super(m);this.name="LocalAssetAuthoringRecordStoreError";this.stack=undefined;}}
interface Manifest{readonly schemaVersion:1; readonly storeKind:"asset-authoring-local-store"; readonly updatedAt:string;}
export type CollectionName = "authoredAssets"|"drafts"|"revisions"|"overrides";
const files:Record<CollectionName,string>={authoredAssets:"authored-assets.json",drafts:"asset-drafts.json",revisions:"asset-revisions.json",overrides:"asset-overrides.json"};
const UNSAFE_KEY_PATTERN = /(?:raw)?path|storageRoot|storage-root|bytes?|blob|base64|providerPayload|provider-payload|prompt|workflow|token|secret|apiKey|api-key|stack|command|environment|\benv\b/i;
const UNSAFE_STRING_PATTERN = /(?:^\/|^[a-z]:\\|https?:\/\/|signed|signature=|-----BEGIN |sk-[a-zA-Z0-9]|github_pat_|gh[pousr]_|xox[baprs]-)/i;
export class LocalAssetAuthoringRecordStore{private readonly dir:string; private readonly now:()=>string; constructor(o:LocalAssetAuthoringRecordStoreOptions){this.dir=join(o.rootDir,"asset-authoring");this.now=o.now??(()=>new Date().toISOString());}
 async readCollection<T>(name:CollectionName):Promise<readonly T[]>{await this.ensure();const v=await this.readJson(files[name],[] as T[]); if(!Array.isArray(v)) throw new LocalAssetAuthoringRecordStoreError("Asset authoring collection is invalid."); return cloneJson(v as T[]);}
 async writeCollection<T>(name:CollectionName, records:readonly T[]):Promise<void>{await this.ensure(); assertSafeAssetAuthoringRecord(records); await this.writeJson(files[name], cloneJson(records)); await this.writeJson("asset-authoring-manifest.json", this.manifest());}
 private async ensure(){await mkdir(this.dir,{recursive:true}); const m = await this.readJson("asset-authoring-manifest.json", this.manifest()); this.validateManifest(m);}
 private validateManifest(v:unknown){if(!v||typeof v!=="object") throw new LocalAssetAuthoringRecordStoreError("Asset authoring manifest is invalid."); const m=v as Partial<Manifest>; if(m.schemaVersion!==1) throw new LocalAssetAuthoringRecordStoreError("Asset authoring manifest schema version is unsupported."); if(m.storeKind!==ASSET_AUTHORING_LOCAL_STORE_KIND) throw new LocalAssetAuthoringRecordStoreError("Asset authoring manifest kind is unsupported.");}
 private manifest():Manifest{return {schemaVersion:1,storeKind:ASSET_AUTHORING_LOCAL_STORE_KIND,updatedAt:this.now()};}
 private async readJson<T>(f:string, fallback:T):Promise<T>{try{return JSON.parse(await readFile(join(this.dir,f),"utf8")) as T;}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT") return cloneJson(fallback); if(e instanceof SyntaxError) throw new LocalAssetAuthoringRecordStoreError("Asset authoring local store contains malformed JSON."); throw e;}}
 private async writeJson(f:string,v:unknown){const p=join(this.dir,f); const t=`${p}.${process.pid}.${randomUUID()}.tmp`; await writeFile(t,`${JSON.stringify(v,null,2)}\n`,`utf8`); await rename(t,p).catch(async(e)=>{await unlink(t).catch(()=>undefined); throw e;});}
}

function assertSafeAssetAuthoringRecord(value: unknown): void {
  const walk=(v:unknown)=>{ if(typeof v==="string"){ if(UNSAFE_STRING_PATTERN.test(v)) throw new LocalAssetAuthoringRecordStoreError("Asset authoring local store record contains unsafe metadata."); return; }
    if(!v||typeof v!=="object") return; if(Array.isArray(v)){v.forEach(walk); return;} for(const [k,val] of Object.entries(v as Record<string,unknown>)){ if(UNSAFE_KEY_PATTERN.test(k)) throw new LocalAssetAuthoringRecordStoreError("Asset authoring local store record contains unsafe metadata."); walk(val);} };
  walk(value);
}
