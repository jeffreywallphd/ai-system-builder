"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSET_PORT_DIRECTIONS = void 0;
exports.isAssetPortDirection = isAssetPortDirection;
exports.normalizeAssetPortDirection = normalizeAssetPortDirection;
exports.ASSET_PORT_DIRECTIONS = [
    "input",
    "output",
    "event",
    "control",
];
function isAssetPortDirection(value) {
    return exports.ASSET_PORT_DIRECTIONS.includes(value);
}
function normalizeAssetPortDirection(value) {
    var normalized = value.trim().toLowerCase();
    if (!isAssetPortDirection(normalized)) {
        throw new Error("Asset port direction must be one of ".concat(exports.ASSET_PORT_DIRECTIONS.join(", "), ". Received \"").concat(value, "\"."));
    }
    return normalized;
}
