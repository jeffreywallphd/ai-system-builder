import { describe, expect, it, testDouble } from "../../../../testing/node-test";
import { DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL, DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL, createDesktopPrepareTrainingDatasetStartRequest, createDesktopPrepareTrainingDatasetTaskReadRequest } from "../../../../contracts/ipc";
import { createDesktopPrepareTrainingDatasetStartIpcHandler, createDesktopPrepareTrainingDatasetTaskReadIpcHandler, registerDatasetPreparationIpc } from "../dataset-preparation/registerDatasetPreparationIpc";

describe("registerDatasetPreparationIpc",()=>{
 it("start handler calls start use-case", async()=>{
  const startPrepareTrainingDataset=testDouble.fn().mockResolvedValue({ok:true,value:{requestId:"r1",taskType:"prepare-training-dataset",accepted:true,status:"queued"}});
  const readPrepareTrainingDataset=testDouble.fn();
  const handler=createDesktopPrepareTrainingDatasetStartIpcHandler({startPrepareTrainingDataset,readPrepareTrainingDataset});
  const response=await handler({},createDesktopPrepareTrainingDatasetStartRequest({command:{sourceArtifactIds:["a1"],recipe:{normalization:{targetFormat:"markdown"},chunking:{strategy:"character",chunkSize:1,chunkOverlap:0},generation:{mode:"qa",model:{provider:"transformers",modelId:"m"}}},split:{trainRatio:0.8,testRatio:0.2},output:{format:"jsonl"}},boundary:{host:"desktop",source:"x"}}));
  expect(startPrepareTrainingDataset).toHaveBeenCalledTimes(1); expect(response.ok).toBe(true);
 });
 it("read handler calls read use-case", async()=>{
  const readPrepareTrainingDataset=testDouble.fn().mockResolvedValue({ok:true,value:{requestId:"r1",taskType:"prepare-training-dataset",status:"running"}});
  const handler=createDesktopPrepareTrainingDatasetTaskReadIpcHandler({startPrepareTrainingDataset:testDouble.fn(),readPrepareTrainingDataset});
  const response=await handler({},createDesktopPrepareTrainingDatasetTaskReadRequest({requestId:"r1",boundary:{host:"desktop",source:"x"}}));
  expect(readPrepareTrainingDataset).toHaveBeenCalledWith("r1", expect.any(Object)); expect(response.ok).toBe(true);
 });
 it("registers start/read channels",()=>{
  const channels:string[]=[]; registerDatasetPreparationIpc({ipcMain:{handle:testDouble.fn((c:string)=>channels.push(c))},prepareTrainingDatasetFromArtifactsUseCase:{startPrepareTrainingDataset:testDouble.fn(),readPrepareTrainingDataset:testDouble.fn()}});
  expect(channels).toEqual([DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL.value,DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL.value]);
 });
});
