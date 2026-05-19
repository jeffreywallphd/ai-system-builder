import type { AssetMetadata } from "../asset";
export const SAFE_ASSET_EDITABLE_FIELDS=["display-name","summary","description","tags","classification","safe-metadata"] as const;
export type SafeAssetEditableField=(typeof SAFE_ASSET_EDITABLE_FIELDS)[number];
export type SafeAssetEditableValue = string | readonly string[] | AssetMetadata;
export type SafeAssetEditableFieldPatch = Partial<Record<SafeAssetEditableField, SafeAssetEditableValue>>;
export const isSafeAssetEditableField=(v:unknown):v is SafeAssetEditableField=> typeof v==="string" && SAFE_ASSET_EDITABLE_FIELDS.includes(v as SafeAssetEditableField);
export function normalizeSafeAssetEditableField(v:string):SafeAssetEditableField{ if(!isSafeAssetEditableField(v)){const e=new Error("Editable field is unsupported."); e.stack=undefined; throw e;} return v; }
export function assertSafeAssetEditableField(v:string): asserts v is SafeAssetEditableField { normalizeSafeAssetEditableField(v); }
export function normalizeSafeAssetEditableFieldPatch(patch:SafeAssetEditableFieldPatch):SafeAssetEditableFieldPatch{ const out:SafeAssetEditableFieldPatch={};
  for (const [k,val] of Object.entries(patch)) { const field=normalizeSafeAssetEditableField(k); if (typeof val === "string") { const n=val.trim(); if(!n||n!==val){throw new Error("Editable string value is invalid.");} out[field]=n; continue;} if(Array.isArray(val)){ if(!val.every((x)=>typeof x==="string"&&x.trim().length>0&&x===x.trim())) throw new Error("Editable string-list value is invalid."); out[field]=val; continue;} if(val && typeof val==="object"){ out[field]=val as AssetMetadata; continue;} throw new Error("Editable value is invalid."); }
  return out;
}
