import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  isUnsafeAssetMetadataKey,
  isUnsafeAssetMetadataString,
  sanitizeAssetJsonValue,
  sanitizeAssetMetadata,
  sanitizeAssetStringValue,
} from "../asset-safe-metadata";

test("central Asset Kernel sanitizer removes required unsafe keys and string values", () => {
  for (const key of [
    "token",
    "secret",
    "password",
    "credential",
    "authorization",
    "auth",
    "localPath",
    "filesystemPath",
    "filePath",
    "path",
    "cache",
    "bytes",
    "blob",
    "contentBase64",
    "base64",
    "raw",
    "payload",
    "command",
    "stack",
    "env",
  ]) {
    assert.equal(isUnsafeAssetMetadataKey(key), true, key);
  }

  for (const value of [
    "/tmp/private/file.txt",
    "/etc/passwd",
    "~/private/file.txt",
    "../relative-secret.txt",
    "C:/Users/name/secret.bin",
    "C:\\Users\\name\\secret.bin",
    "Bearer abcdef._~+/=-",
    "apiKey=hidden",
    "api key: hidden",
    "token=hidden",
    "password: hidden",
    "secret=hidden",
    "authorization: hidden",
    "data:application/octet-stream;base64,AAAA",
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ=",
  ]) {
    assert.equal(isUnsafeAssetMetadataString(value), true, value);
    assert.equal(sanitizeAssetStringValue(value), undefined, value);
  }
});

test("central Asset Kernel sanitizer preserves safe JSON-compatible metadata and removes nested unsafe entries", () => {
  const cyclic: Record<string, unknown> = { safe: "visible" };
  cyclic.self = cyclic;

  const sanitized = sanitizeAssetMetadata({
    safe: "visible",
    count: 2,
    nested: { label: "kept", token: "token=hidden", location: "/tmp/private" },
    values: ["ok", "Bearer hidden", { note: "kept", command: "run" }],
    cyclic,
  });
  const json = JSON.stringify(sanitized).toLowerCase();

  assert.equal(sanitized?.safe, "visible");
  assert.equal(json.includes("kept"), true);
  for (const unsafe of ["token=hidden", "/tmp/private", "bearer", "command", "self"]) {
    assert.equal(json.includes(unsafe), false, unsafe);
  }
});

test("central Asset Kernel sanitizer stays application-owned and free of outer-layer imports", () => {
  const source = readFileSync("modules/application/services/asset/asset-safe-metadata.ts", "utf8");
  for (const forbidden of ["modules/adapters", "modules/hosts", "contracts/api", "contracts/ipc", "electron", "express", "node:fs", "node:path", "fetch(", "runtime/"]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.equal(typeof sanitizeAssetJsonValue({ safe: true }), "object");
});
