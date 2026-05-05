import { readFile } from "node:fs/promises";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("../hooks/useImageGenerationFeature",()=>({useImageGenerationFeature:()=>({form:{prompt:"",negativePrompt:"",seed:"",width:"512",height:"512",steps:"20",sampler:"euler",scheduler:"normal",model:"",numImages:"1"},setForm:vi.fn(),runtimeMode:"cpu",setRuntimeMode:vi.fn(),status:"failed",error:"boom",requestId:"r1",results:[{assetId:"a1",artifactId:"art1",storageKey:"key/1",mediaType:"image/png",source:"generated"}],start:vi.fn(),cancel:vi.fn(),unloadModel:vi.fn(),unloadModelState:{status:"idle"},qualityNote:undefined,validationError:undefined,isGenerateDisabled:false,isCancelDisabled:true,isUnloadModelDisabled:false,createPreviewUrl:(k:string)=>`/api/artifact/media/view?storageKey=${encodeURIComponent(k)}`,selectedModelRecordId:"",setSelectedModelRecordId:vi.fn(),refreshModelInventory:vi.fn(),modelInventoryLoading:false,modelInventoryError:undefined,downloadedImageGenerationModels:[{modelRecordId:"d1",displayName:"D1",modelId:"org/d1",provider:"hf",lifecycleStatus:"downloaded",artifactForm:"checkpoint",inferenceMode:"text-to-image"}],referenceOnlyImageGenerationModels:[{modelRecordId:"r1",displayName:"R1",modelId:"org/r1",provider:"hf",lifecycleStatus:"registered",artifactForm:"checkpoint",inferenceMode:"text-to-image"}],selectedModelRecord:undefined})}));
import { ImageGenerationFeature } from "../components/ImageGenerationFeature";
describe("ImageGenerationFeature",()=>{it("shows grouped model options and artifact-backed preview",async()=>{const c=document.createElement("div"); const root=createRoot(c); await act(async()=>{root.render(<ImageGenerationFeature onNavigateToArtifacts={() => {}} />);}); expect(c.textContent).toContain("Downloaded image models"); expect(c.textContent).toContain("Saved references / download required"); expect(c.textContent).toContain("reference only"); const img=c.querySelector("img") as HTMLImageElement; expect(img.src).toContain("/api/artifact/media/view?storageKey=key%2F1");});

it("does not import desktop/preload/ipc modules", async () => {
  const source = await readFile("apps/thin-client/src/features/image-generation/components/ImageGenerationFeature.tsx", "utf-8");
  for (const fragment of ["desktop", "preload", "ipc", "electron"]) expect(source.includes(fragment)).toBe(false);
});

it("keeps thin-client image-generation sources free of duplicate implementation fragments", async () => {
  const [apiClient, hook, component, page, routes] = await Promise.all([
    readFile("apps/thin-client/src/features/image-generation/api/apiImageGenerationClient.ts", "utf-8"),
    readFile("apps/thin-client/src/features/image-generation/hooks/useImageGenerationFeature.ts", "utf-8"),
    readFile("apps/thin-client/src/features/image-generation/components/ImageGenerationFeature.tsx", "utf-8"),
    readFile("apps/thin-client/src/pages/ImageGenerationPage.tsx", "utf-8"),
    readFile("apps/thin-client/src/routes/thinClientPages.ts", "utf-8"),
  ]);

  expect(apiClient.match(/export function createApiImageGenerationClient/g)).toHaveLength(1);
  expect(apiClient).not.toContain("export class ImageGenerationApiError");
  expect(hook.match(/export function useImageGenerationFeature/g)).toHaveLength(1);
  expect(hook).not.toContain("createApiArtifactBrowserClient");
  expect(component.match(/export function ImageGenerationFeature/g)).toHaveLength(1);
  expect(page.match(/export function ImageGenerationPage/g)).toHaveLength(1);
  expect(routes.match(/export type ThinClientPageKey/g)).toHaveLength(1);
});});
