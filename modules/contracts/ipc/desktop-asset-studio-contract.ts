import type { AssetStudioProposalView, AssetStudioWorkflowRecord, ProposeAssetStudioChangeCommand, ReviewAssetStudioProposalCommand, StartAssetStudioCommand } from "../asset-studio";
import type { AssetImplementationDraft } from "../asset-implementation";
import { createTransportOperation } from "../transport";
import { createIpcChannel } from "./ipc-channel";
import { createIpcRequest, type IpcRequest } from "./ipc-request";
import type { IpcResponse } from "./ipc-response";

export const DESKTOP_ASSET_STUDIO_OPERATIONS = {
  start: createTransportOperation("asset-studio", "start"),
  propose: createTransportOperation("asset-studio", "propose"),
  review: createTransportOperation("asset-studio", "review"),
  read: createTransportOperation("asset-studio", "read"),
  list: createTransportOperation("asset-studio", "list"),
} as const;

export const DESKTOP_ASSET_STUDIO_CHANNELS = Object.fromEntries(Object.entries(DESKTOP_ASSET_STUDIO_OPERATIONS).map(([key, operation]) => [key, { request: createIpcChannel(operation, "request"), response: createIpcChannel(operation, "response") }])) as { readonly [K in keyof typeof DESKTOP_ASSET_STUDIO_OPERATIONS]: { readonly request: ReturnType<typeof createIpcChannel>; readonly response: ReturnType<typeof createIpcChannel> } };

export type DesktopAssetStudioProposeRequest = IpcRequest<Omit<ProposeAssetStudioChangeCommand, "actorId">, (typeof DESKTOP_ASSET_STUDIO_OPERATIONS)["propose"]>;
export type DesktopAssetStudioStartRequest = IpcRequest<Omit<StartAssetStudioCommand, "actorId">, (typeof DESKTOP_ASSET_STUDIO_OPERATIONS)["start"]>;
export type DesktopAssetStudioReviewRequest = IpcRequest<Omit<ReviewAssetStudioProposalCommand, "actorId">, (typeof DESKTOP_ASSET_STUDIO_OPERATIONS)["review"]>;
export type DesktopAssetStudioReadRequest = IpcRequest<{ readonly workspaceId: string; readonly workflowId: string }, (typeof DESKTOP_ASSET_STUDIO_OPERATIONS)["read"]>;
export type DesktopAssetStudioListRequest = IpcRequest<{ readonly workspaceId: string }, (typeof DESKTOP_ASSET_STUDIO_OPERATIONS)["list"]>;
export type DesktopAssetStudioProposalResponse = IpcResponse<AssetStudioProposalView>;
export type DesktopAssetStudioDraftResponse = IpcResponse<AssetImplementationDraft>;
export type DesktopAssetStudioWorkflowResponse = IpcResponse<AssetStudioWorkflowRecord>;
export type DesktopAssetStudioListResponse = IpcResponse<readonly AssetStudioWorkflowRecord[]>;

export const createDesktopAssetStudioRequest = <T>(operation: keyof typeof DESKTOP_ASSET_STUDIO_OPERATIONS, payload: T, context?: { requestId?: string; correlationId?: string }) => createIpcRequest(DESKTOP_ASSET_STUDIO_CHANNELS[operation].request, payload, context);
