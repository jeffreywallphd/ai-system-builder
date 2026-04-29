import type { PrepareTrainingDatasetRequest, PythonRuntimeTaskStatusResult } from "../runtime";
import { createTransportOperation } from "../transport";
import { createIpcChannel, type IpcChannel, type IpcChannelValue } from "./ipc-channel";
import { createIpcRequest, type IpcRequest } from "./ipc-request";
import { createIpcSuccessResponse, type IpcResponse } from "./ipc-response";

export const DESKTOP_DATASET_PREPARE_TRAINING_START_OPERATION = createTransportOperation("artifact","prepare-training-dataset.start");
export const DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_OPERATION = createTransportOperation("artifact","prepare-training-dataset.read-task");
export const DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_OPERATION = createTransportOperation("artifact","prepare-training-dataset.cancel-task");

export const DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL = createIpcChannel(DESKTOP_DATASET_PREPARE_TRAINING_START_OPERATION,"request");
export const DESKTOP_DATASET_PREPARE_TRAINING_START_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_DATASET_PREPARE_TRAINING_START_OPERATION,"response");
export const DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL = createIpcChannel(DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_OPERATION,"request");
export const DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_OPERATION,"response");
export const DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_REQUEST_CHANNEL = createIpcChannel(DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_OPERATION,"request");
export const DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_RESPONSE_CHANNEL = createIpcChannel(DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_OPERATION,"response");

export interface DesktopDatasetPreparationBoundaryContext { host:"desktop"; source:string; }
export interface DesktopPrepareTrainingDatasetStartRequestPayload { command:{ sourceArtifactIds:string[]; recipe:PrepareTrainingDatasetRequest["recipe"]; split:PrepareTrainingDatasetRequest["split"]; output:PrepareTrainingDatasetRequest["output"]; }; boundary:DesktopDatasetPreparationBoundaryContext; }
export interface DesktopPrepareTrainingDatasetTaskReadRequestPayload { requestId:string; boundary:DesktopDatasetPreparationBoundaryContext; }
export interface DesktopPrepareTrainingDatasetTaskCancelRequestPayload { requestId:string; boundary:DesktopDatasetPreparationBoundaryContext; }
export interface DesktopPrepareTrainingDatasetStartSuccessValue { requestId:string; taskType:string; accepted:true; status:"queued"|"running"; }
export type DesktopPrepareTrainingDatasetTaskReadSuccessValue = PythonRuntimeTaskStatusResult;
export interface DesktopPrepareTrainingDatasetTaskCancelSuccessValue { requestId:string; cancelled:boolean; status:"cancelled"|"running"|"unknown"; }

export type DesktopPrepareTrainingDatasetStartRequest = IpcRequest<DesktopPrepareTrainingDatasetStartRequestPayload,typeof DESKTOP_DATASET_PREPARE_TRAINING_START_OPERATION,Record<string, never>,typeof DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL.value>;
export type DesktopPrepareTrainingDatasetStartResponse = IpcResponse<DesktopPrepareTrainingDatasetStartSuccessValue,Record<string, unknown>,typeof DESKTOP_DATASET_PREPARE_TRAINING_START_OPERATION,Record<string, never>,typeof DESKTOP_DATASET_PREPARE_TRAINING_START_RESPONSE_CHANNEL.value>;
export type DesktopPrepareTrainingDatasetTaskReadRequest = IpcRequest<DesktopPrepareTrainingDatasetTaskReadRequestPayload,typeof DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_OPERATION,Record<string, never>,typeof DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL.value>;
export type DesktopPrepareTrainingDatasetTaskReadResponse = IpcResponse<DesktopPrepareTrainingDatasetTaskReadSuccessValue,Record<string, unknown>,typeof DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_OPERATION,Record<string, never>,typeof DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_RESPONSE_CHANNEL.value>;
export type DesktopPrepareTrainingDatasetTaskCancelRequest = IpcRequest<DesktopPrepareTrainingDatasetTaskCancelRequestPayload,typeof DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_OPERATION,Record<string, never>,typeof DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_REQUEST_CHANNEL.value>;
export type DesktopPrepareTrainingDatasetTaskCancelResponse = IpcResponse<DesktopPrepareTrainingDatasetTaskCancelSuccessValue,Record<string, unknown>,typeof DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_OPERATION,Record<string, never>,typeof DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_RESPONSE_CHANNEL.value>;

const norm=(v:string,f:string)=>{const n=v.trim(); if(!n) throw new Error(`${f} must be a non-empty, trimmed string.`); return n;};
const b=(boundary:DesktopDatasetPreparationBoundaryContext)=>({host:"desktop" as const,source:norm(boundary.source,"boundary.source")});

export function createDesktopPrepareTrainingDatasetStartRequest(payload:DesktopPrepareTrainingDatasetStartRequestPayload,options?:{requestId?:string;correlationId?:string}):DesktopPrepareTrainingDatasetStartRequest{ return createIpcRequest(DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL,{command:payload.command,boundary:b(payload.boundary)},options); }
export function createDesktopPrepareTrainingDatasetStartSuccessResponse(value:DesktopPrepareTrainingDatasetStartSuccessValue,options?:{requestId?:string;correlationId?:string}):DesktopPrepareTrainingDatasetStartResponse{ return createIpcSuccessResponse(DESKTOP_DATASET_PREPARE_TRAINING_START_RESPONSE_CHANNEL,value,options); }
export function createDesktopPrepareTrainingDatasetTaskReadRequest(payload:DesktopPrepareTrainingDatasetTaskReadRequestPayload,options?:{requestId?:string;correlationId?:string}):DesktopPrepareTrainingDatasetTaskReadRequest{ return createIpcRequest(DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL,{requestId:norm(payload.requestId,"requestId"),boundary:b(payload.boundary)},options); }
export function createDesktopPrepareTrainingDatasetTaskReadSuccessResponse(value:DesktopPrepareTrainingDatasetTaskReadSuccessValue,options?:{requestId?:string;correlationId?:string}):DesktopPrepareTrainingDatasetTaskReadResponse{ return createIpcSuccessResponse(DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_RESPONSE_CHANNEL,value,options); }
export function createDesktopPrepareTrainingDatasetTaskCancelRequest(payload:DesktopPrepareTrainingDatasetTaskCancelRequestPayload,options?:{requestId?:string;correlationId?:string}):DesktopPrepareTrainingDatasetTaskCancelRequest{ return createIpcRequest(DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_REQUEST_CHANNEL,{requestId:norm(payload.requestId,"requestId"),boundary:b(payload.boundary)},options); }
export function createDesktopPrepareTrainingDatasetTaskCancelSuccessResponse(value:DesktopPrepareTrainingDatasetTaskCancelSuccessValue,options?:{requestId?:string;correlationId?:string}):DesktopPrepareTrainingDatasetTaskCancelResponse{ return createIpcSuccessResponse(DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_RESPONSE_CHANNEL,value,options); }

export function getDesktopPrepareTrainingDatasetChannel(kind:"start-request"|"start-response"|"task-read-request"|"task-read-response"|"task-cancel-request"|"task-cancel-response"): IpcChannel<any,any,IpcChannelValue<any,any>>{ switch(kind){case "start-request": return DESKTOP_DATASET_PREPARE_TRAINING_START_REQUEST_CHANNEL; case "start-response": return DESKTOP_DATASET_PREPARE_TRAINING_START_RESPONSE_CHANNEL; case "task-read-request": return DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_REQUEST_CHANNEL; case "task-read-response": return DESKTOP_DATASET_PREPARE_TRAINING_TASK_READ_RESPONSE_CHANNEL; case "task-cancel-request": return DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_REQUEST_CHANNEL; default: return DESKTOP_DATASET_PREPARE_TRAINING_TASK_CANCEL_RESPONSE_CHANNEL;} }
