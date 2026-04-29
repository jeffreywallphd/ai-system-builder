import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, testDouble } from "../../../testing/node-test";
import type { PowerSuspensionBlockerPort } from "../../ports/desktop";
import { PrepareTrainingDatasetFromArtifactsUseCase } from "../prepare-training-dataset-from-artifacts.use-case";

async function exists(path: string) { try { await access(path); return true; } catch { return false; } }
const command = { sourceArtifactIds:["a1"], recipe:{ normalization:{targetFormat:"markdown" as const}, chunking:{strategy:"character" as const, chunkSize:1, chunkOverlap:0}, generation:{mode:"qa" as const, model:{provider:"transformers" as const, modelId:"m"}}}, split:{trainRatio:0.8,testRatio:0.2}, output:{format:"jsonl" as const}};

function createPowerSuspensionMock(): PowerSuspensionBlockerPort { const active = new Map<string, { requestId?: string; taskType?: string; reason: string }>(); let sequence = 0; return { startBlocker: testDouble.fn(async (reason, context) => { sequence += 1; const blockerId = `b-${sequence}`; active.set(blockerId, { reason, requestId: context?.requestId, taskType: context?.taskType }); return { blockerId, active: true }; }), stopBlocker: testDouble.fn(async (blockerId) => { active.delete(blockerId); return { blockerId, active: false }; }), listBlockers: testDouble.fn(async () => [...active.entries()].map(([blockerId, value]) => ({ blockerId, active: true, ...value }))), }; }

describe("PrepareTrainingDatasetFromArtifactsUseCase async start cleanup", () => {
  it("starts and stops blockers across lifecycle", async () => {
    const powerSuspension = createPowerSuspensionMock();
    const outputDir = await mkdtemp(join(tmpdir(), "tmp-"));
    const outputPath = join(outputDir, "d.jsonl");
    await writeFile(outputPath, `{"x":1}\n`);
    const useCase = new PrepareTrainingDatasetFromArtifactsUseCase({ datasetPreparation:{ startPrepareTrainingDataset:testDouble.fn(async()=>({requestId:"r1",taskType:"prepare-training-dataset",accepted:true,status:"queued"})), readPrepareTrainingDatasetStatus:(() => { let count = 0; return testDouble.fn(async()=>{ count += 1; if (count === 1) { return {requestId:"r1",taskType:"prepare-training-dataset",status:"running"}; } return {requestId:"r1",taskType:"prepare-training-dataset",status:"succeeded",data:{outputs:[{name:"d",role:"dataset",tempPath:outputPath,mediaType:"application/x-ndjson"}],summary:{sourceDocumentCount:1,normalizedDocumentCount:1,skippedDocumentCount:0,chunkCount:1,generatedExampleCount:1,datasetRowCount:1,trainRowCount:1,testRowCount:0}}}; }); })() }, storageBindings:{ readArtifactStorageBindings:testDouble.fn(async()=>({ok:true,value:{bindings:[]}})), upsertArtifactStorageBinding:testDouble.fn(), deleteArtifactStorageBindings:testDouble.fn() }, storage:{ retrieveArtifact:testDouble.fn(async()=>({ok:true,value:{descriptor:{key:"a1",mediaType:"text/markdown",metadata:{}},content:new TextEncoder().encode("hi")}})), storeArtifact:testDouble.fn(async(request:any)=>({ok:true,value:request.descriptor})), hasArtifact:testDouble.fn(), deleteArtifact:testDouble.fn() }, powerSuspension });
    await useCase.startPrepareTrainingDataset(command);
    await useCase.readPrepareTrainingDataset("r1");
    expect((await powerSuspension.listBlockers()).find((entry) => entry.requestId === "r1")).toBeTruthy();
    await useCase.readPrepareTrainingDataset("r1");
    await useCase.readPrepareTrainingDataset("r1");
    expect(powerSuspension.stopBlocker).toHaveBeenCalledTimes(1);
    expect((await powerSuspension.listBlockers()).find((entry) => entry.requestId === "r1")).toBeUndefined();
    await rm(outputDir, { recursive: true, force: true });
  });
});
