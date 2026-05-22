"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_PORT_CONTRACT_KINDS = void 0;
exports.isAssetPortContractKind = isAssetPortContractKind;
exports.normalizeAssetPortContractKind = normalizeAssetPortContractKind;
exports.ASSET_PORT_CONTRACT_KINDS = [
    "asset",
    "asset-instance",
    "asset-definition",
    "resource",
    "artifact",
    "external-repository-object",
    "configuration",
    "runtime-capability",
    "event",
    "control",
    "json",
    "text",
    "binary-reference",
    "custom",
];
function isAssetPortContractKind(value) {
    return exports.ASSET_PORT_CONTRACT_KINDS.includes(value);
}
function normalizeAssetPortContractKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetPortContractKind(normalized)) {
        throw new Error("Asset port contract kind must be one of ".concat(exports.ASSET_PORT_CONTRACT_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
