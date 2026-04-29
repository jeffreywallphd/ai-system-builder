import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, testDouble } from "../../../testing/node-test";
import type { TaskPowerLifecyclePort } from "../../services/runtime";
import { PrepareTrainingDatasetFromArtifactsUseCase } from "../prepare-training-dataset-from-artifacts.use-case";

async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
const command = { sourceArtifactIds:["a1"], recipe:{ normalization:{targetFormat:"markdown" as const}, chunking:{strategy:"character" as const, chunkSize:1, chunkOverlap:0}, generation:{mode:"qa" as const, model:{provider:"transformers" as const, modelId:"m"}}}, split:{trainRatio:0.8,testRatio:0.2}, output:{format:"jsonl" as const}};

const createLifecycleFake = (): TaskPowerLifecyclePort => ({
  startTask: testDouble.fn(async () => undefined),
  completeTask: testDouble.fn(async () => undefined),
});

describe("PrepareTrainingDatasetFromArtifactsUseCase", () => {
  it("removes temp dir for binding-read failure", async () => {
    const lifecycle = createLifecycleFake();
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({ datasetPreparation:{ startPrepareTrainingDataset:testDouble.fn(), readPrepareTrainingDatasetStatus:testDouble.fn() }, storageBindings:{ readArtifactStorageBindings:testDouble.fn(async()=>({ok:false,error:{code:"internal",message:"x"}})), upsertArtifactStorageBinding:testDouble.fn(), deleteArtifactStorageBindings:testDouble.fn() }, storage:{ retrieveArtifact:testDouble.fn(), storeArtifact:testDouble.fn(), hasArtifact:testDouble.fn(), deleteArtifact:testDouble.fn() }, taskPowerLifecycle: lifecycle });
    const result = await useCase.startPrepareTrainingDataset(command);
    expect(result.ok).toBe(false);
    expect(lifecycle.startTask).not.toHaveBeenCalled();
  });


  it("removes temp dir for missing storage key", async () => {
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({ datasetPreparation:{ startPrepareTrainingDataset:testDouble.fn(), readPrepareTrainingDatasetStatus:testDouble.fn() }, storageBindings:{ readArtifactStorageBindings:testDouble.fn(async()=>({ok:true,value:{bindings:[{artifactId:"",bindingId:"b1",role:"primary",backing:{kind:"artifact-object",provider:"local",locator:"   "}}]}})), upsertArtifactStorageBinding:testDouble.fn(), deleteArtifactStorageBindings:testDouble.fn() }, storage:{ retrieveArtifact:testDouble.fn(), storeArtifact:testDouble.fn(), hasArtifact:testDouble.fn(), deleteArtifact:testDouble.fn() }, taskPowerLifecycle: createLifecycleFake() });
    const result = await useCase.startPrepareTrainingDataset({ ...command, sourceArtifactIds:[""] });
    expect(result.ok).toBe(false);
  });

  it("removes temp dir for retrieve failure", async () => {
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({ datasetPreparation:{ startPrepareTrainingDataset:testDouble.fn(), readPrepareTrainingDatasetStatus:testDouble.fn() }, storageBindings:{ readArtifactStorageBindings:testDouble.fn(async()=>({ok:true,value:{bindings:[]}})), upsertArtifactStorageBinding:testDouble.fn(), deleteArtifactStorageBindings:testDouble.fn() }, storage:{ retrieveArtifact:testDouble.fn(async()=>({ok:false,error:{code:"not-found",message:"missing"}})), storeArtifact:testDouble.fn(), hasArtifact:testDouble.fn(), deleteArtifact:testDouble.fn() }, taskPowerLifecycle: createLifecycleFake() });
    const result = await useCase.startPrepareTrainingDataset(command);
    expect(result.ok).toBe(false);
  });

  it("keeps staged dir until runtime completion", async () => {
    const lifecycle = createLifecycleFake();
    const outputDir = await mkdtemp(join(tmpdir(), "tmp-"));
    const outputPath = join(outputDir, "d.jsonl");
    await writeFile(outputPath, `{"x":1}\n`);
    let runtimeDir = "";
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({ datasetPreparation:{ startPrepareTrainingDataset:testDouble.fn(async(req:any)=>{ runtimeDir = req.runtime.runtimeWorkingDirectory; return {requestId:"r1",taskType:"prepare-training-dataset",accepted:true,status:"queued"}; }), readPrepareTrainingDatasetStatus:testDouble.fn(async()=>({requestId:"r1",taskType:"prepare-training-dataset",status:"running"})) }, storageBindings:{ readArtifactStorageBindings:testDouble.fn(async()=>({ok:true,value:{bindings:[]}})), upsertArtifactStorageBinding:testDouble.fn(), deleteArtifactStorageBindings:testDouble.fn() }, storage:{ retrieveArtifact:testDouble.fn(async()=>({ok:true,value:{descriptor:{key:"a1",mediaType:"text/markdown",metadata:{}},content:new TextEncoder().encode("hi")}})), storeArtifact:testDouble.fn(async(request:any)=>({ok:true,value:request.descriptor})), hasArtifact:testDouble.fn(), deleteArtifact:testDouble.fn() }, taskPowerLifecycle: lifecycle });
    await useCase.startPrepareTrainingDataset(command);
    expect(await exists(runtimeDir)).toBe(true);
    await rm(outputDir, { recursive: true, force: true });
  });

  it("materialization/local-store failures still complete blocker", async () => {
    const lifecycle = createLifecycleFake();
    const outputDir = await mkdtemp(join(tmpdir(), "tmp-"));
    const outputPath = join(outputDir, "d.jsonl");
    await writeFile(outputPath, `{"x":1}\n`);
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({ datasetPreparation:{ startPrepareTrainingDataset:testDouble.fn(async()=>({requestId:"r1",taskType:"prepare-training-dataset",accepted:true,status:"queued"})), readPrepareTrainingDatasetStatus:testDouble.fn(async()=>({requestId:"r1",taskType:"prepare-training-dataset",status:"succeeded",data:{outputs:[{name:"d",role:"dataset",tempPath:outputPath,mediaType:"application/x-ndjson"}],summary:{sourceDocumentCount:1,normalizedDocumentCount:1,skippedDocumentCount:0,chunkCount:1,generatedExampleCount:1,datasetRowCount:1,trainRowCount:1,testRowCount:0}}})) }, storageBindings:{ readArtifactStorageBindings:testDouble.fn(async()=>({ok:true,value:{bindings:[]}})), upsertArtifactStorageBinding:testDouble.fn(), deleteArtifactStorageBindings:testDouble.fn() }, storage:{ retrieveArtifact:testDouble.fn(async()=>({ok:true,value:{descriptor:{key:"a1",mediaType:"text/markdown",metadata:{}},content:new TextEncoder().encode("hi")}})), storeArtifact:testDouble.fn(async()=>({ok:false,error:{code:"internal",message:"store failed"}})), hasArtifact:testDouble.fn(), deleteArtifact:testDouble.fn() }, taskPowerLifecycle: lifecycle });
    await useCase.startPrepareTrainingDataset(command);
    const status = await useCase.readPrepareTrainingDataset("r1");
    expect(status.ok).toBe(false);
    expect(lifecycle.completeTask).toHaveBeenCalledWith("r1", "failed");
    await rm(outputDir, { recursive: true, force: true });
  });

  it("invalid runtime result still completes blocker", async () => {
    const lifecycle = createLifecycleFake();
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({ datasetPreparation:{ startPrepareTrainingDataset:testDouble.fn(async()=>({requestId:"r1",taskType:"prepare-training-dataset",accepted:true,status:"queued"})), readPrepareTrainingDatasetStatus:testDouble.fn(async()=>({requestId:"r1",taskType:"prepare-training-dataset",status:"succeeded",data:{outputs:[],summary:{}}})) }, storageBindings:{ readArtifactStorageBindings:testDouble.fn(async()=>({ok:true,value:{bindings:[]}})), upsertArtifactStorageBinding:testDouble.fn(), deleteArtifactStorageBindings:testDouble.fn() }, storage:{ retrieveArtifact:testDouble.fn(async()=>({ok:true,value:{descriptor:{key:"a1",mediaType:"text/markdown",metadata:{}},content:new TextEncoder().encode("hi")}})), storeArtifact:testDouble.fn(), hasArtifact:testDouble.fn(), deleteArtifact:testDouble.fn() }, taskPowerLifecycle: lifecycle });
    await useCase.startPrepareTrainingDataset(command);
    await useCase.readPrepareTrainingDataset("r1");
    expect(lifecycle.completeTask).toHaveBeenCalledWith("r1", "failed");
  });

  it("returns success when lifecycle start fails and keeps runtime dir until terminal cleanup", async () => {
    const lifecycle: TaskPowerLifecyclePort = {
      startTask: testDouble.fn(async () => { throw new Error("no blocker"); }),
      completeTask: testDouble.fn(async () => undefined),
    };
    const outputDir = await mkdtemp(join(tmpdir(), "tmp-"));
    const outputPath = join(outputDir, "d.jsonl");
    await writeFile(outputPath, `{"x":1}\n`);
    let runtimeDir = "";
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({
      datasetPreparation: {
        startPrepareTrainingDataset: testDouble.fn(async (req: any) => {
          runtimeDir = req.runtime.runtimeWorkingDirectory;
          return { requestId: "r1", taskType: "prepare-training-dataset", accepted: true, status: "queued" };
        }),
        readPrepareTrainingDatasetStatus: testDouble.fn(async () => ({
          requestId: "r1",
          taskType: "prepare-training-dataset",
          status: "failed",
          error: { code: "failed", message: "boom" },
        })),
      },
      storageBindings: { readArtifactStorageBindings: testDouble.fn(async () => ({ ok: true, value: { bindings: [] } })), upsertArtifactStorageBinding: testDouble.fn(), deleteArtifactStorageBindings: testDouble.fn() },
      storage: { retrieveArtifact: testDouble.fn(async () => ({ ok: true, value: { descriptor: { key: "a1", mediaType: "text/markdown", metadata: {} }, content: new TextEncoder().encode("hi") } })), storeArtifact: testDouble.fn(), hasArtifact: testDouble.fn(), deleteArtifact: testDouble.fn() },
      taskPowerLifecycle: lifecycle,
    });

    const started = await useCase.startPrepareTrainingDataset(command);
    expect(started.ok).toBe(true);
    expect(await exists(runtimeDir)).toBe(true);

    const status = await useCase.readPrepareTrainingDataset("r1");
    expect(status.ok).toBe(true);
    expect(await exists(runtimeDir)).toBe(false);
    await rm(outputDir, { recursive: true, force: true });
  });
});
