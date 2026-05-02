import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { useImageGenerationFeature } from "../hooks/useImageGenerationFeature";

function model(modelRecordId: string, lifecycleStatus: string, inferenceMode = "text-to-image") {
  return { modelRecordId, displayName: modelRecordId, modelId: `id/${modelRecordId}`, provider: "hf", source: "huggingface", artifactForm: "checkpoint", lifecycleStatus, inferenceMode, taskTags: inferenceMode === "text-to-image" ? ["image-generation"] : ["chat"] };
}

function Harness({ client, modelClient }: { client: any; modelClient: any }) {
  const f = useImageGenerationFeature(client, undefined, modelClient);
  return <div><button id="start" onClick={() => void f.start()}>start</button><button id="selectB" onClick={() => f.setSelectedModelRecordId("b")}>b</button><button id="refresh" onClick={() => void f.refreshModelInventory()}>r</button><input id="prompt" value={f.form.prompt} onInput={(e)=>f.setForm((x)=>({...x,prompt:(e.target as HTMLInputElement).value}))}/><span id="validation">{f.validationError ?? ""}</span><span id="downloaded">{f.downloadedImageGenerationModels.map((m)=>m.modelRecordId).join(",")}</span><span id="selected">{f.selectedModelRecordId}</span></div>;
}

describe("useImageGenerationFeature", () => {
  it("sends latest selected model record id and selection does not reload inventory", async () => {
    const client = { createArtifactMediaViewUrl: vi.fn(), startImageGeneration: vi.fn().mockResolvedValue({ requestId: "r1" }), readImageGeneration: vi.fn().mockResolvedValue({ requestId: "r1", status: "failed" }), finalizeImageGenerationIfCompleted: vi.fn(), cancelImageGeneration: vi.fn() };
    const modelClient = { listModels: vi.fn().mockResolvedValue({ models: [model("a", "downloaded"), model("b", "downloaded")] }) };
    const c = document.createElement("div"); const root = createRoot(c);
    await act(async () => { root.render(<Harness client={client} modelClient={modelClient} />); });
    expect(modelClient.listModels).toHaveBeenCalledTimes(1);
    await act(async () => { (c.querySelector("#selectB") as HTMLButtonElement).click(); });
    expect(modelClient.listModels).toHaveBeenCalledTimes(1);
    await act(async () => { (c.querySelector("#prompt") as HTMLInputElement).value = "cat"; (c.querySelector("#prompt") as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true })); (c.querySelector("#start") as HTMLButtonElement).click(); });
    expect(client.startImageGeneration).toHaveBeenCalledWith(expect.objectContaining({ model: "b" }));
  });

  it("manual model fallback applies only when no selected record", async () => {
    const client = { createArtifactMediaViewUrl: vi.fn(), startImageGeneration: vi.fn().mockResolvedValue({ requestId: "r1" }), readImageGeneration: vi.fn().mockResolvedValue({ requestId: "r1", status: "failed" }), finalizeImageGenerationIfCompleted: vi.fn(), cancelImageGeneration: vi.fn() };
    const modelClient = { listModels: vi.fn().mockResolvedValue({ models: [] }) };
    function H() { const f = useImageGenerationFeature(client, undefined, modelClient); return <div><button id="start" onClick={()=>void f.start()}>s</button><button id="manual" onClick={()=>f.setForm((x)=>({...x,prompt:"cat",model:"manual.ckpt"}))}>m</button></div>; }
    const c = document.createElement("div"); const root = createRoot(c);
    await act(async()=>{root.render(<H/>);});
    await act(async()=>{(c.querySelector("#manual") as HTMLButtonElement).click(); (c.querySelector("#start") as HTMLButtonElement).click();});
    expect(client.startImageGeneration).toHaveBeenCalledWith(expect.objectContaining({ model: "manual.ckpt" }));
  });

  it("auto-selects downloaded image model, not downloaded non-image; reference image can be selected", async () => {
    const client = { createArtifactMediaViewUrl: vi.fn(), startImageGeneration: vi.fn(), readImageGeneration: vi.fn(), finalizeImageGenerationIfCompleted: vi.fn(), cancelImageGeneration: vi.fn() };
    const modelClient1 = { listModels: vi.fn().mockResolvedValue({ models: [model("txt", "downloaded", "chat"), model("img", "downloaded", "text-to-image")] }) };
    const c = document.createElement("div"); const root = createRoot(c);
    await act(async()=>{root.render(<Harness client={client} modelClient={modelClient1} />);});
    expect((c.querySelector("#selected") as HTMLElement).textContent).toBe("img");

    const modelClient2 = { listModels: vi.fn().mockResolvedValue({ models: [model("txt", "downloaded", "chat"), model("ref", "registered", "text-to-image")] }) };
    await act(async()=>{root.render(<Harness client={client} modelClient={modelClient2} />);});
    expect((c.querySelector("#selected") as HTMLElement).textContent).toBe("ref");
    expect((c.querySelector("#downloaded") as HTMLElement).textContent).toBe("");
  });

  it("does not show prompt validation until generate attempt", async () => {
    const client = { createArtifactMediaViewUrl: vi.fn(), startImageGeneration: vi.fn(), readImageGeneration: vi.fn(), finalizeImageGenerationIfCompleted: vi.fn(), cancelImageGeneration: vi.fn() };
    const modelClient = { listModels: vi.fn().mockResolvedValue({ models: [] }) };
    const c = document.createElement("div"); const root = createRoot(c);
    await act(async()=>{root.render(<Harness client={client} modelClient={modelClient} />);});
    expect((c.querySelector("#validation") as HTMLElement).textContent).toBe("");
    await act(async()=>{(c.querySelector("#start") as HTMLButtonElement).click();});
    expect((c.querySelector("#validation") as HTMLElement).textContent).toContain("Prompt is required");
  });

  it('loads model inventory without invalid list source metadata', async () => {
    const client = { createArtifactMediaViewUrl: vi.fn(), startImageGeneration: vi.fn(), readImageGeneration: vi.fn(), finalizeImageGenerationIfCompleted: vi.fn(), cancelImageGeneration: vi.fn() };
    const listModels = vi.fn().mockResolvedValue({ models: [model('img', 'downloaded', 'text-to-image')] });
    const c = document.createElement('div'); const root = createRoot(c);
    await act(async()=>{root.render(<Harness client={client} modelClient={{ listModels }} />);});
    expect(listModels).toHaveBeenCalledWith();
    expect((c.querySelector('#selected') as HTMLElement).textContent).toBe('img');
  });

  it("strict mode still loads model inventory", async () => {
    const client = { createArtifactMediaViewUrl: vi.fn(), startImageGeneration: vi.fn(), readImageGeneration: vi.fn(), finalizeImageGenerationIfCompleted: vi.fn(), cancelImageGeneration: vi.fn() };
    const listModels = vi.fn().mockResolvedValue({ models: [model("img", "downloaded", "text-to-image")] });
    const c = document.createElement("div"); const root = createRoot(c);
    await act(async()=>{root.render(<React.StrictMode><Harness client={client} modelClient={{ listModels }} /></React.StrictMode>);});
    expect(listModels).toHaveBeenCalled();
    expect((c.querySelector('#selected') as HTMLElement).textContent).toBe('img');
  });
});
