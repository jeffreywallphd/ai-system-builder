import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, testDouble } from "../../../testing/node-test";
import { PrepareTrainingDatasetFromArtifactsUseCase } from "../prepare-training-dataset-from-artifacts.use-case";

async function exists(path: string) { try { await access(path); return true; } catch { return false; } }

const command = { sourceArtifactIds:["a1"], recipe:{ normalization:{targetFormat:"markdown" as const}, chunking:{strategy:"character" as const, chunkSize:1, chunkOverlap:0}, generation:{mode:"qa" as const, model:{provider:"transformers" as const, modelId:"m"}}}, split:{trainRatio:0.8,testRatio:0.2}, output:{format:"jsonl" as const}};

describe("PrepareTrainingDatasetFromArtifactsUseCase async start cleanup", () => {
  it("cleans staged dir when runtime start throws", async () => {
    let stagedDir = "";
    const start = testDouble.fn(async (request:any) => {
      stagedDir = request.runtime.runtimeWorkingDirectory;
      throw new Error("failed");
    });
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({ datasetPreparation:{ startPrepareTrainingDataset:start, readPrepareTrainingDatasetStatus:testDouble.fn() }, storageBindings:{ readArtifactStorageBindings:testDouble.fn(async()=>({ok:true,value:{bindings:[]}})), upsertArtifactStorageBinding:testDouble.fn(), deleteArtifactStorageBindings:testDouble.fn() }, storage:{ retrieveArtifact:testDouble.fn(async()=>({ok:true,value:{descriptor:{key:"a1",mediaType:"text/markdown",metadata:{}},content:new TextEncoder().encode("hi")}})), storeArtifact:testDouble.fn(), hasArtifact:testDouble.fn(), deleteArtifact:testDouble.fn() } });
    const result = await useCase.startPrepareTrainingDataset(command);
    expect(result.ok).toBe(false);
    expect(await exists(stagedDir)).toBe(false);
  });

  it("cleans staged dir when runtime start succeeds without request id", async () => {
    let stagedDir = "";
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({ datasetPreparation:{ startPrepareTrainingDataset:testDouble.fn(async(req:any)=>{ stagedDir = req.runtime.runtimeWorkingDirectory; return {requestId:"",taskType:"prepare-training-dataset",accepted:true,status:"queued"}; }), readPrepareTrainingDatasetStatus:testDouble.fn() }, storageBindings:{ readArtifactStorageBindings:testDouble.fn(async()=>({ok:true,value:{bindings:[]}})), upsertArtifactStorageBinding:testDouble.fn(), deleteArtifactStorageBindings:testDouble.fn() }, storage:{ retrieveArtifact:testDouble.fn(async()=>({ok:true,value:{descriptor:{key:"a1",mediaType:"text/markdown",metadata:{}},content:new TextEncoder().encode("hi")}})), storeArtifact:testDouble.fn(), hasArtifact:testDouble.fn(), deleteArtifact:testDouble.fn() } });
    const result = await useCase.startPrepareTrainingDataset(command);
    expect(result.ok).toBe(false);
    expect(await exists(stagedDir)).toBe(false);
  });

  it("keeps staged dir until terminal read then cleans", async () => {
    let stagedDir = "";
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({ datasetPreparation:{ startPrepareTrainingDataset:testDouble.fn(async(req:any)=>{ stagedDir=req.runtime.runtimeWorkingDirectory; return {requestId:"r1",taskType:"prepare-training-dataset",accepted:true,status:"queued"}; }), readPrepareTrainingDatasetStatus:testDouble.fn(async()=>({requestId:"r1",taskType:"prepare-training-dataset",status:"succeeded",data:{outputs:[{name:"d",role:"dataset",tempPath:join(await mkdtemp(join(tmpdir(),"tmp-")),"d.jsonl"),mediaType:"application/x-ndjson"}],summary:{sourceDocumentCount:1,normalizedDocumentCount:1,skippedDocumentCount:0,chunkCount:1,generatedExampleCount:1,datasetRowCount:1,trainRowCount:1,testRowCount:0}}})) }, storageBindings:{ readArtifactStorageBindings:testDouble.fn(async()=>({ok:true,value:{bindings:[]}})), upsertArtifactStorageBinding:testDouble.fn(), deleteArtifactStorageBindings:testDouble.fn() }, storage:{ retrieveArtifact:testDouble.fn(async()=>({ok:true,value:{descriptor:{key:"a1",mediaType:"text/markdown",metadata:{}},content:new TextEncoder().encode("hi")}})), storeArtifact:testDouble.fn(), hasArtifact:testDouble.fn(), deleteArtifact:testDouble.fn() } });
    const started=await useCase.startPrepareTrainingDataset(command);
    expect(started.ok).toBe(true);
    expect(await exists(stagedDir)).toBe(true);
    await useCase.readPrepareTrainingDataset("r1");
    expect(await exists(stagedDir)).toBe(false);
  });

  it("stores materialized dataset with descriptor content contract shape", async () => {
    const storeArtifact = testDouble.fn(async (request: any) => ({ ok: true, value: { descriptor: request.descriptor } }));
    const outputDir = await mkdtemp(join(tmpdir(), "tmp-"));
    const outputPath = join(outputDir, "d.jsonl");
    const bytes = new TextEncoder().encode(`{"x":1}\n`);
    await writeFile(outputPath, bytes);

    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({
      datasetPreparation: {
        startPrepareTrainingDataset: testDouble.fn(async () => ({ requestId: "r1", taskType: "prepare-training-dataset", accepted: true, status: "queued" })),
        readPrepareTrainingDatasetStatus: testDouble.fn(async () => ({ requestId: "r1", taskType: "prepare-training-dataset", status: "succeeded", data: { outputs: [{ name: "d", role: "dataset", tempPath: outputPath, mediaType: "application/x-ndjson" }], summary: { sourceDocumentCount: 1, normalizedDocumentCount: 1, skippedDocumentCount: 0, chunkCount: 1, generatedExampleCount: 1, datasetRowCount: 1, trainRowCount: 1, testRowCount: 0 } } })),
      },
      storageBindings: { readArtifactStorageBindings: testDouble.fn(async () => ({ ok: true, value: { bindings: [] } })), upsertArtifactStorageBinding: testDouble.fn(), deleteArtifactStorageBindings: testDouble.fn() },
      storage: { retrieveArtifact: testDouble.fn(async () => ({ ok: true, value: { descriptor: { key: "a1", mediaType: "text/markdown", metadata: {} }, content: new TextEncoder().encode("hi") } })), storeArtifact, hasArtifact: testDouble.fn(), deleteArtifact: testDouble.fn() },
    });

    await useCase.startPrepareTrainingDataset(command);
    await useCase.readPrepareTrainingDataset("r1");

    const request = storeArtifact.mock.calls[0][0];
    expect(Array.from(request.content)).toEqual(Array.from(bytes));
    expect(request.descriptor.key).toContain("generated/");
    expect(request.descriptor.mediaType).toBe("application/x-ndjson");
    expect(request.descriptor.metadata.originalFileName).toBe("d.jsonl");
    expect(request.descriptor.metadata.runtimeRole).toBe("dataset");
  });

});
