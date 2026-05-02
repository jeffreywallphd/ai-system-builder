import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
vi.mock("../hooks/useImageGenerationFeature",()=>({useImageGenerationFeature:()=>({form:{prompt:"",negativePrompt:"",seed:"",width:"512",height:"512",steps:"20",sampler:"euler",scheduler:"normal",model:"",numImages:"1"},setForm:vi.fn(),status:"failed",error:"boom",requestId:"r1",results:[{assetId:"a1",artifactId:"art1",storageKey:"key/1",mediaType:"image/png",source:"generated"}],start:vi.fn(),cancel:vi.fn(),qualityNote:undefined,createPreviewUrl:(k:string)=>`/api/artifact/media/view?storageKey=${encodeURIComponent(k)}`})}));
import { ImageGenerationFeature } from "../components/ImageGenerationFeature";
describe("ImageGenerationFeature",()=>{it("shows error and artifact-backed preview",async()=>{const c=document.createElement("div"); const root=createRoot(c); await act(async()=>{root.render(<ImageGenerationFeature />);}); expect(c.textContent).toContain("failed"); expect(c.textContent).toContain("boom"); const img=c.querySelector("img") as HTMLImageElement; expect(img.src).toContain("/api/artifact/media/view?storageKey=key%2F1");});});
