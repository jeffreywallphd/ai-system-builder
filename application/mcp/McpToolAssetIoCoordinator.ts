import { Asset } from "../../domain/assets/Asset";
import { AssetLocation, AssetSourceInfo } from "../../domain/assets/AssetMetadata";
import type { IAsset } from "../../domain/assets/interfaces/IAsset";
import type { InstalledMcpToolRecord } from "../../domain/mcp/InstalledMcpTool";
import type { McpToolAssetInputContract, McpToolAssetOutputContract } from "../../domain/mcp/McpToolCapability";
import { McpToolRegistryError } from "./registry/McpToolRegistryErrors";
import { RegisterAssetUseCase } from "../assets-system/RegisterAssetUseCase";
import { CreateAssetVersionUseCase } from "../assets-system/CreateAssetVersionUseCase";
import { RecordAssetTransformationUseCase } from "../assets-system/RecordAssetTransformationUseCase";
import type { IAssetRecordRepository } from "../ports/interfaces/IAssetRecordRepository";
import type { IAssetVersionRepository } from "../ports/interfaces/IAssetVersionRepository";

export interface McpToolAssetIoPreparation {
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly inputVersionIds: ReadonlyArray<string>;
  readonly consumedAssets: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

export interface McpToolAssetIoFinalization {
  readonly resultMetadata?: Readonly<Record<string, unknown>>;
}

interface ResolvedAssetInput {
  readonly contract: McpToolAssetInputContract;
  readonly asset: IAsset;
  readonly versionId?: string;
}

export class McpToolAssetIoCoordinator {
  private readonly registerAssetUseCase: RegisterAssetUseCase;
  private readonly createAssetVersionUseCase: CreateAssetVersionUseCase;

  constructor(
    private readonly assetRepository: IAssetRecordRepository,
    private readonly versionRepository: IAssetVersionRepository,
    private readonly recordTransformationUseCase: RecordAssetTransformationUseCase,
  ) {
    this.registerAssetUseCase = new RegisterAssetUseCase(assetRepository);
    this.createAssetVersionUseCase = new CreateAssetVersionUseCase(versionRepository);
  }

  public async prepareInput(
    installedTool: InstalledMcpToolRecord,
    argumentsValue: Readonly<Record<string, unknown>>,
  ): Promise<McpToolAssetIoPreparation> {
    const contracts = installedTool.definition.assetIo?.inputs ?? [];
    if (contracts.length === 0) {
      return Object.freeze({ arguments: argumentsValue, inputVersionIds: Object.freeze([]), consumedAssets: Object.freeze([]) });
    }
    this.assertRawInputPolicy(contracts, installedTool, argumentsValue);

    const nextArguments = deepClone(argumentsValue);
    const resolvedInputs: ResolvedAssetInput[] = [];

    for (const contract of [...contracts].sort((left, right) => left.path.localeCompare(right.path))) {
      const rawValue = readAtPath(nextArguments, contract.path);
      if (rawValue === undefined) {
        if (contract.required === false) {
          continue;
        }
        throw new McpToolRegistryError("invalid-input-contract", `Asset input '${contract.path}' is required by MCP tool asset I/O contract.`, {
          toolId: installedTool.toolId,
          path: contract.path,
        });
      }

      const resolved = await this.resolveAssetInput(contract, rawValue);
      resolvedInputs.push(resolved);
      writeAtPath(nextArguments, contract.path, this.renderResolvedInput(contract, resolved));
    }

    return Object.freeze({
      arguments: Object.freeze(nextArguments),
      inputVersionIds: Object.freeze(
        [...new Set(resolvedInputs.map((entry) => entry.versionId).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right)),
      ),
      consumedAssets: Object.freeze(
        resolvedInputs.map((entry) => Object.freeze({
          path: entry.contract.path,
          assetId: entry.asset.id,
          versionId: entry.versionId,
          kind: entry.asset.kind,
          resolution: entry.contract.resolution,
          valueKind: entry.contract.valueKind,
        })),
      ),
    });
  }

  public async finalizeOutput(params: {
    readonly installedTool: InstalledMcpToolRecord;
    readonly executionId: string;
    readonly requestArguments: Readonly<Record<string, unknown>>;
    readonly inputVersionIds: ReadonlyArray<string>;
    readonly structuredContent?: Readonly<Record<string, unknown>>;
    readonly fallbackOutput?: unknown;
  }): Promise<McpToolAssetIoFinalization> {
    const outputs = params.installedTool.definition.assetIo?.outputs ?? [];
    const assetOutputs = outputs.filter((entry) => entry.mode !== "raw");
    if (assetOutputs.length === 0) {
      return Object.freeze({});
    }

    const produced: Array<Readonly<Record<string, unknown>>> = [];

    for (let index = 0; index < assetOutputs.length; index += 1) {
      const contract = assetOutputs[index]!;
      const extracted = extractOutputPayload(contract, params.structuredContent, params.fallbackOutput);
      if (extracted === undefined) {
        if (params.installedTool.definition.assetIo?.allowsRawOutputs === false) {
          throw new McpToolRegistryError(
            "invalid-output-contract",
            `Asset output '${contract.path ?? "<root>"}' is missing and raw-output fallback is disabled.`,
            { toolId: params.installedTool.toolId, outputPath: contract.path ?? "<root>" },
          );
        }
        continue;
      }

      const output = await this.persistOutputAsset({
        installedTool: params.installedTool,
        executionId: params.executionId,
        requestArguments: params.requestArguments,
        inputVersionIds: params.inputVersionIds,
        outputContract: contract,
        outputIndex: index,
        payload: extracted,
      });
      produced.push(output);
    }

    if (produced.length === 0) {
      return Object.freeze({});
    }

    return Object.freeze({
      resultMetadata: Object.freeze({
        assetIo: Object.freeze({
          producedAssets: Object.freeze(produced),
        }),
      }),
    });
  }

  private async persistOutputAsset(params: {
    readonly installedTool: InstalledMcpToolRecord;
    readonly executionId: string;
    readonly requestArguments: Readonly<Record<string, unknown>>;
    readonly inputVersionIds: ReadonlyArray<string>;
    readonly outputContract: McpToolAssetOutputContract;
    readonly outputIndex: number;
    readonly payload: unknown;
  }): Promise<Readonly<Record<string, unknown>>> {
    const timestamp = new Date();
    const baseAssetId = params.outputContract.mode === "asset-transform"
      ? this.resolveTransformTargetAssetId(params.outputContract, params.requestArguments)
      : `${params.installedTool.toolId}:asset:${params.executionId}:${params.outputIndex}`;

    const existing = await this.assetRepository.getById(baseAssetId);
    const kind = params.outputContract.assetKind ?? existing?.kind ?? "json";

    if (!existing) {
      const sourceType = params.outputContract.mode === "asset-transform" ? "derived" : "generated";
      const asset = new Asset({
        id: baseAssetId,
        name: params.outputContract.name ?? `${params.installedTool.definition.displayName} output`,
        kind,
        status: "available",
        source: new AssetSourceInfo({
          type: sourceType,
          executionId: params.executionId,
          provider: "mcp-tool",
        }),
        location: new AssetLocation({
          accessMethod: "memory",
          location: `mcp://${params.installedTool.toolId}/${params.executionId}/${params.outputIndex}`,
          format: params.outputContract.format ?? "json",
          contentType: params.outputContract.contentType ?? "application/json",
        }),
        semanticMetadata: {
          tags: ["mcp", params.outputContract.mode],
        },
        audit: {
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
      await this.registerAssetUseCase.execute({ asset });
    }

    const latest = existing ? await this.getLatestVersionId(existing.id) : undefined;
    const versionId = `${baseAssetId}:version:${params.executionId}:${params.outputIndex}`;
    const persistedVersion = await this.ensureOutputVersion({
      assetId: baseAssetId,
      versionId,
      latestVersionId: latest,
      params,
      timestamp,
    });

    await this.recordTransformationUseCase.execute({
      transformationId: `${params.installedTool.toolId}:transform:${params.executionId}:${params.outputIndex}`,
      transformationType: params.outputContract.mode === "asset-transform" ? "mcp-tool-transform" : "mcp-tool-generate",
      status: "success",
      inputVersionIds: params.inputVersionIds,
      outputVersionIds: [persistedVersion.versionId],
      executionId: params.executionId,
      provider: "mcp",
      runtime: "mcp",
      metadata: {
        toolId: params.installedTool.toolId,
        serverId: params.installedTool.definition.binding?.serverId,
        toolName: params.installedTool.definition.binding?.toolName,
        mode: params.outputContract.mode,
      },
      createdAt: timestamp,
      completedAt: timestamp,
    });

    return Object.freeze({
      assetId: baseAssetId,
      versionId: persistedVersion.versionId,
      mode: params.outputContract.mode,
      assetKind: kind,
    });
  }

  private resolveTransformTargetAssetId(contract: McpToolAssetOutputContract, requestArguments: Readonly<Record<string, unknown>>): string {
    if (!contract.targetInputPath?.trim()) {
      throw new McpToolRegistryError("invalid-output-contract", "asset-transform output requires targetInputPath.");
    }
    const raw = readAtPath(requestArguments, contract.targetInputPath);
    if (typeof raw === "string" && raw.trim()) {
      return raw.trim();
    }
    if (isRecord(raw) && typeof raw.assetId === "string" && raw.assetId.trim()) {
      return raw.assetId.trim();
    }
    throw new McpToolRegistryError("invalid-output-contract", `asset-transform target '${contract.targetInputPath}' did not resolve to an asset id.`);
  }

  private async resolveAssetInput(contract: McpToolAssetInputContract, rawValue: unknown): Promise<ResolvedAssetInput> {
    const reference = normalizeInputReference(contract.valueKind, rawValue);
    let asset = reference.assetId ? await this.resolveAsset(reference.assetId) : undefined;
    let versionId = reference.versionId;
    if (!asset && versionId) {
      const version = await this.versionRepository.getByVersionId(versionId);
      if (!version) {
        throw new McpToolRegistryError("invalid-input-contract", `Asset version '${versionId}' was not found for MCP tool execution.`);
      }
      asset = await this.resolveAsset(version.assetId.value);
    }
    if (!asset) {
      throw new McpToolRegistryError("invalid-input-contract", `Asset input '${contract.path}' did not resolve to a valid asset.`);
    }

    if (contract.assetKinds && contract.assetKinds.length > 0 && !contract.assetKinds.includes(asset.kind)) {
      throw new McpToolRegistryError("invalid-input-contract", `Asset '${asset.id}' kind '${asset.kind}' is not allowed for '${contract.path}'.`, {
        path: contract.path,
        expectedKinds: contract.assetKinds,
        actualKind: asset.kind,
      });
    }

    versionId = reference.versionId ?? await this.getLatestVersionId(asset.id);
    if ((contract.valueKind === "asset-version-id" || contract.versionRequirement === "required") && !versionId) {
      throw new McpToolRegistryError("invalid-input-contract", `Asset version id is required for '${contract.path}'.`, { path: contract.path });
    }

    return Object.freeze({ contract, asset, versionId });
  }

  private async ensureOutputVersion(params: {
    readonly assetId: string;
    readonly versionId: string;
    readonly latestVersionId?: string;
    readonly params: {
      readonly installedTool: InstalledMcpToolRecord;
      readonly executionId: string;
      readonly inputVersionIds: ReadonlyArray<string>;
      readonly outputContract: McpToolAssetOutputContract;
      readonly payload: unknown;
    };
    readonly timestamp: Date;
  }): Promise<{ readonly versionId: string }> {
    if (params.params.outputContract.persistence === "ensure-execution-version") {
      const existing = await this.versionRepository.getByVersionId(params.versionId);
      if (existing) {
        return { versionId: existing.versionId };
      }
    }
    await this.createAssetVersionUseCase.execute({
      assetId: params.assetId,
      versionId: params.versionId,
      parentVersionId: params.params.outputContract.mode === "asset-transform" ? params.latestVersionId : undefined,
      createdAt: params.timestamp,
      upstreamVersionIds: params.params.inputVersionIds,
      metadata: {
        toolId: params.params.installedTool.toolId,
        executionId: params.params.executionId,
        outputPath: params.params.outputContract.path,
        outputMode: params.params.outputContract.mode,
        persistence: params.params.outputContract.persistence ?? "create-version",
        payload: params.params.payload,
      },
      reproducibilitySummary: {
        toolId: params.params.installedTool.toolId,
        version: params.params.installedTool.definition.version,
      },
    });
    return { versionId: params.versionId };
  }

  private async resolveAsset(assetId: string): Promise<IAsset> {
    const asset = await this.assetRepository.getById(assetId);
    if (!asset) {
      throw new McpToolRegistryError("invalid-input-contract", `Asset '${assetId}' was not found for MCP tool execution.`);
    }
    return asset;
  }

  private async getLatestVersionId(assetId: string): Promise<string | undefined> {
    const versions = await this.versionRepository.listVersionsByAssetId(assetId);
    const latest = [...versions].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
    return latest?.versionId;
  }

  private renderResolvedInput(contract: McpToolAssetInputContract, resolved: ResolvedAssetInput): unknown {
    switch (contract.resolution) {
      case "asset-id":
        return resolved.asset.id;
      case "version-id":
        return resolved.versionId;
      case "location":
        return resolved.asset.location.location;
      case "asset-record":
      default:
        return Object.freeze({
          assetId: resolved.asset.id,
          versionId: resolved.versionId,
          kind: resolved.asset.kind,
          location: resolved.asset.location.location,
        });
    }
  }

  private assertRawInputPolicy(
    contracts: ReadonlyArray<McpToolAssetInputContract>,
    installedTool: InstalledMcpToolRecord,
    argumentsValue: Readonly<Record<string, unknown>>,
  ): void {
    if (installedTool.definition.assetIo?.allowsRawInputs !== false) {
      return;
    }
    const allowedRootKeys = new Set(
      contracts
        .map((contract) => contract.path.split(".").map((segment) => segment.trim()).filter(Boolean)[0])
        .filter((value): value is string => !!value),
    );
    const unknownKeys = Object.keys(argumentsValue).filter((key) => !allowedRootKeys.has(key));
    if (unknownKeys.length > 0) {
      throw new McpToolRegistryError(
        "invalid-input-contract",
        "Tool asset I/O contract disallows raw inputs; only declared asset input paths are allowed.",
        { toolId: installedTool.toolId, unknownPaths: unknownKeys.sort() },
      );
    }
  }
}

function normalizeInputReference(valueKind: McpToolAssetInputContract["valueKind"], value: unknown): { assetId?: string; versionId?: string } {
  if (valueKind === "asset-id") {
    if (typeof value !== "string" || !value.trim()) {
      throw new McpToolRegistryError("invalid-input-contract", "Expected an asset id string for asset-backed MCP input.");
    }
    return { assetId: value.trim() };
  }

  if (valueKind === "asset-version-id") {
    if (typeof value !== "string" || !value.trim()) {
      throw new McpToolRegistryError("invalid-input-contract", "Expected an asset version id string for asset-backed MCP input.");
    }
    return { versionId: value.trim() };
  }

  if (!isRecord(value)) {
    throw new McpToolRegistryError("invalid-input-contract", "Expected an asset reference object for asset-backed MCP input.");
  }

  const assetId = typeof value.assetId === "string" ? value.assetId.trim() : "";
  const versionId = typeof value.versionId === "string" ? value.versionId.trim() : undefined;
  if (!assetId) {
    throw new McpToolRegistryError("invalid-input-contract", "Asset reference object must include assetId.");
  }
  return { assetId, versionId };
}

function extractOutputPayload(
  contract: McpToolAssetOutputContract,
  structuredContent: Readonly<Record<string, unknown>> | undefined,
  fallbackOutput: unknown,
): unknown {
  if (contract.path?.trim()) {
    if (structuredContent) {
      return readAtPath(structuredContent, contract.path);
    }
    if (isRecord(fallbackOutput)) {
      return readAtPath(fallbackOutput, contract.path);
    }
    return undefined;
  }
  return structuredContent ?? fallbackOutput;
}

function readAtPath(record: Readonly<Record<string, unknown>>, path: string): unknown {
  const segments = path.split(".").map((segment) => segment.trim()).filter(Boolean);
  let current: unknown = record;
  for (const segment of segments) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function writeAtPath(record: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split(".").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    return;
  }

  let current: Record<string, unknown> = record;
  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]!;
    const existing = current[segment];
    if (!isRecord(existing)) {
      current[segment] = {};
    }
    current = current[segment] as Record<string, unknown>;
  }

  current[segments[segments.length - 1]!] = value;
}

function deepClone(value: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
