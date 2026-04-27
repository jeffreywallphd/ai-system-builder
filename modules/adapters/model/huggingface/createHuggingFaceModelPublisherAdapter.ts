import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import type { ModelPublisherPort } from "../../../application/ports/model";
import type { PublishModelRequest, PublishModelResult } from "../../../contracts/model";

interface HuggingFaceUploadClient {
  uploadFile(params: {
    repo: string;
    path: string;
    content: Uint8Array;
    token?: string;
    revision?: string;
    private?: boolean;
  }): Promise<void>;
}

export interface CreateHuggingFaceModelPublisherAdapterOptions {
  client: HuggingFaceUploadClient;
  tokenProvider?: () => string | undefined;
}

async function collectFiles(root: string, current: string, output: string[] = []): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(current, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(root, full, output);
      continue;
    }
    output.push(relative(root, full));
  }
  return output;
}

function validatePublishLayout(files: string[], fileContentByPath: ReadonlyMap<string, string>): void {
  const fileSet = new Set(files.map((file) => file.replace(/^\.\//, "")));
  const hasAdapterConfig = fileSet.has("adapter_config.json");
  const hasAdapterModel = fileSet.has("adapter_model.safetensors");
  const hasShardIndex = fileSet.has("model.safetensors.index.json");
  const shardFiles = files.filter((file) => /model-\d{5}-of-\d{5}\.safetensors$/.test(file));
  const hasSingleModelSafetensors = fileSet.has("model.safetensors");
  const hasConfig = fileSet.has("config.json");

  if (hasAdapterConfig || hasAdapterModel) {
    if (!hasAdapterConfig || !hasAdapterModel) {
      throw new Error("Publishing adapter outputs requires both adapter_config.json and adapter_model.safetensors.");
    }
    return;
  }

  if (shardFiles.length > 0 && !hasShardIndex) {
    throw new Error("Publishing sharded full model outputs requires model.safetensors.index.json.");
  }

  if (hasShardIndex) {
    if (!hasConfig) {
      throw new Error("Publishing full model outputs requires config.json.");
    }
    const indexFile = files.find((file) => file.replace(/^\.\//, "") === "model.safetensors.index.json");
    if (!indexFile) {
      throw new Error("Publishing sharded full model outputs requires model.safetensors.index.json.");
    }
    const indexContent = fileContentByPath.get(indexFile);
    if (!indexContent) {
      throw new Error("Publishing sharded full model outputs requires a readable model.safetensors.index.json.");
    }
    let parsed: { weight_map?: Record<string, string> };
    try {
      parsed = JSON.parse(indexContent) as { weight_map?: Record<string, string> };
    } catch {
      throw new Error("Publishing sharded full model outputs requires a valid model.safetensors.index.json.");
    }
    const referencedShards = new Set(Object.values(parsed.weight_map ?? {}));
    for (const shard of referencedShards) {
      if (!fileSet.has(shard)) {
        throw new Error(`Publishing rejected: missing shard file referenced by index: ${shard}`);
      }
    }
    return;
  }

  if (!hasSingleModelSafetensors) {
    throw new Error("Publishing full model outputs requires model.safetensors or a valid shard index.");
  }
  if (!hasConfig) {
    throw new Error("Publishing full model outputs requires config.json.");
  }
}

function mapError(error: unknown): Error {
  const value = error as { statusCode?: number; status?: number; message?: string };
  const status = value.statusCode ?? value.status;
  if (status === 401 || status === 403) {
    return new Error("Hugging Face publish failed: unauthorized.");
  }
  if (status === 404) {
    return new Error("Hugging Face publish failed: repository not found.");
  }
  if (status === 429) {
    return new Error("Hugging Face publish failed: rate limited.");
  }
  return new Error(`Hugging Face publish failed: ${value.message ?? String(error)}`);
}

export function createHuggingFaceModelPublisherAdapter(
  options: CreateHuggingFaceModelPublisherAdapterOptions,
): ModelPublisherPort {
  return {
    async publishModel(request: PublishModelRequest & { modelPath: string }): Promise<PublishModelResult> {
      const token = request.token ?? options.tokenProvider?.();
      const fileStats = await stat(request.modelPath);
      if (!fileStats.isDirectory()) {
        throw new Error("publishModel requires a model directory path.");
      }

      const files = await collectFiles(request.modelPath, request.modelPath);
      const readFile = (await import("node:fs/promises")).readFile;
      const textFiles = new Map<string, string>();
      if (files.includes("model.safetensors.index.json")) {
        textFiles.set("model.safetensors.index.json", await readFile(join(request.modelPath, "model.safetensors.index.json"), "utf8"));
      }
      validatePublishLayout(files, textFiles);

      for (const file of files) {
        const fullPath = join(request.modelPath, file);
        const content = new Uint8Array(await readFile(fullPath));
        const remotePath = `${request.pathPrefix ? `${request.pathPrefix.replace(/\/$/, "")}/` : ""}${file}`;
        try {
          await options.client.uploadFile({
            repo: request.repository,
            path: remotePath,
            content,
            token,
            revision: request.revision,
            private: request.private,
          });
        } catch (error) {
          throw mapError(error);
        }
      }

      return {
        modelRecordId: request.modelRecordId,
        published: true,
        provider: "huggingface",
        repository: request.repository,
        revision: request.revision,
        url: `https://huggingface.co/${request.repository}`,
      };
    },
  };
}
