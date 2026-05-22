"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_BINDING_KINDS = void 0;
exports.isAssetBindingKind = isAssetBindingKind;
exports.normalizeAssetBindingKind = normalizeAssetBindingKind;
exports.ASSET_BINDING_KINDS = [
    "input",
    "output",
    "event",
    "control",
    "resource",
    "runtime",
    "adapter",
    "dependency",
];
function isAssetBindingKind(value) {
    return exports.ASSET_BINDING_KINDS.includes(value);
}
function normalizeAssetBindingKind(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetBindingKind(normalized)) {
        throw new Error("Asset binding kind must be one of ".concat(exports.ASSET_BINDING_KINDS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
