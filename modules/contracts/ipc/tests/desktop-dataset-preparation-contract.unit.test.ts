import { describe, expect, it } from "../../../testing/node-test";
import { DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL, DESKTOP_DATASET_PREPARE_TRAINING_START_RESPONSE_CHANNEL, DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL, DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_RESPONSE_CHANNEL, createDesktopPrepareTrainingDatasetStartRequest, createDesktopPrepareTrainingDatasetStartSuccessResponse, createDesktopPrepareTrainingDatasetTaskReadRequest, createDesktopPrepareTrainingDatasetTaskReadSuccessResponse } from "..";

describe("desktop dataset preparation ipc contract",()=>{
 it("defines async operation channels",()=>{
  expect(DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL.value).toContain("prepare-training-dataset.start");
  expect(DESKTOP_DATASET_PREPARE_TRAINING_START_RESPONSE_CHANNEL.value).toContain("prepare-training-dataset.start");
  expect(DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL.value).toContain("prepare-training-dataset.read-task");
  expect(DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_RESPONSE_CHANNEL.value).toContain("prepare-training-dataset.read-task");
 });
 it("creates start/read envelopes",()=>{
  const start=createDesktopPrepareTrainingDatasetStartRequest({command:{sourceArtifactIds:["a1"],recipe:{normalization:{targetFormat:"markdown"},chunking:{strategy:"character",chunkSize:1,chunkOverlap:0},generation:{mode:"qa",model:{provider:"transformers",modelId:"m"}}},split:{trainRatio:0.8,testRatio:0.2},output:{format:"jsonl"}},boundary:{host:"desktop",source:" test "}});
  expect(start.payload.boundary.source).toBe("test");
  const started=createDesktopPrepareTrainingDatasetStartSuccessResponse({requestId:"r1",taskType:"prepare-training-dataset",accepted:true,status:"queued"});
  expect(started.ok).toBe(true);
  const read=createDesktopPrepareTrainingDatasetTaskReadRequest({requestId:" r1 ",boundary:{host:"desktop",source:"x"}});
  expect(read.payload.requestId).toBe("r1");
  const status=createDesktopPrepareTrainingDatasetTaskReadSuccessResponse({requestId:"r1",taskType:"prepare-training-dataset",status:"running"});
  expect(status.ok).toBe(true);
 });
});
