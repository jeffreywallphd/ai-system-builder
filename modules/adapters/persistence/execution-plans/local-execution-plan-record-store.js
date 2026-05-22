"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalExecutionPlanRecordStore = exports.LocalExecutionPlanRecordStoreError = exports.EXECUTION_PLAN_LOCAL_SCHEMA_VERSION = exports.EXECUTION_PLAN_LOCAL_STORE_KIND = void 0;
exports.cloneJson = cloneJson;
var node_crypto_1 = require("node:crypto");
var promises_1 = require("node:fs/promises");
var node_path_1 = require("node:path");
var promises_2 = require("node:fs/promises");
exports.EXECUTION_PLAN_LOCAL_STORE_KIND = "execution-plan-local-store";
exports.EXECUTION_PLAN_LOCAL_SCHEMA_VERSION = 1;
var LocalExecutionPlanRecordStoreError = /** @class */ (function (_super) {
    __extends(LocalExecutionPlanRecordStoreError, _super);
    function LocalExecutionPlanRecordStoreError(message, options) {
        var _this = _super.call(this, message) || this;
        _this.name = "LocalExecutionPlanRecordStoreError";
        if (options && "cause" in options)
            _this.cause = options.cause;
        _this.stack = undefined;
        return _this;
    }
    return LocalExecutionPlanRecordStoreError;
}(Error));
exports.LocalExecutionPlanRecordStoreError = LocalExecutionPlanRecordStoreError;
var LocalExecutionPlanRecordStore = /** @class */ (function () {
    function LocalExecutionPlanRecordStore(options) {
        var _a;
        this.writeQueue = Promise.resolve();
        this.storeDir = (0, node_path_1.join)(options.rootDir, "execution-plans");
        this.now = (_a = options.now) !== null && _a !== void 0 ? _a : (function () { return new Date().toISOString(); });
    }
    LocalExecutionPlanRecordStore.prototype.readManifest = function () {
        return __awaiter(this, void 0, void 0, function () { var _a; return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, this.ensureStoreFiles()];
                case 1:
                    _b.sent();
                    _a = validateManifest;
                    return [4 /*yield*/, this.readJsonFile("manifest.json", this.createManifest())];
                case 2: return [2 /*return*/, _a.apply(void 0, [_b.sent()])];
            }
        }); });
    };
    LocalExecutionPlanRecordStore.prototype.readPlans = function () {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, this.ensureStoreFiles()];
                case 1:
                    _a.sent();
                    return [2 /*return*/, this.readJsonFile("execution-plans.json", [])];
            }
        }); });
    };
    LocalExecutionPlanRecordStore.prototype.writePlans = function (records) {
        return __awaiter(this, void 0, void 0, function () {
            var op;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        op = this.writeQueue.then(function () { return _this.writePlansNow(records); }, function () { return _this.writePlansNow(records); });
                        this.writeQueue = op.catch(function () { return undefined; });
                        return [4 /*yield*/, op];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    LocalExecutionPlanRecordStore.prototype.writePlansNow = function (records) {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, this.ensureStoreFiles()];
                case 1:
                    _a.sent();
                    assertJsonCompatible(records);
                    return [4 /*yield*/, this.writeJsonFile("execution-plans.json", cloneJson(records))];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, this.writeJsonFile("manifest.json", this.createManifest())];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        }); });
    };
    LocalExecutionPlanRecordStore.prototype.ensureStoreFiles = function () {
        return __awaiter(this, void 0, void 0, function () { return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, promises_1.mkdir)(this.storeDir, { recursive: true })];
                case 1:
                    _a.sent();
                    return [4 /*yield*/, this.ensureJsonFile("manifest.json", this.createManifest())];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, this.ensureJsonFile("execution-plans.json", [])];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        }); });
    };
    LocalExecutionPlanRecordStore.prototype.ensureJsonFile = function (file, fallback) {
        return __awaiter(this, void 0, void 0, function () { var value, e_1; return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, this.readJsonFile(file, fallback)];
                case 1:
                    value = _a.sent();
                    if (file === "manifest.json")
                        validateManifest(value);
                    else if (!Array.isArray(value))
                        throw new LocalExecutionPlanRecordStoreError("Execution plan local store collection is invalid.");
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 6]);
                    return [4 /*yield*/, (0, promises_2.readFile)(this.path(file), "utf8")];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 4:
                    e_1 = _a.sent();
                    if (e_1.code !== "ENOENT")
                        throw e_1;
                    return [4 /*yield*/, this.writeJsonFile(file, fallback)];
                case 5:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        }); });
    };
    LocalExecutionPlanRecordStore.prototype.readJsonFile = function (file, fallback) {
        return __awaiter(this, void 0, void 0, function () { var _a, _b, _c, e_2; return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    _d.trys.push([0, 2, , 3]);
                    _a = cloneJson;
                    _c = (_b = JSON).parse;
                    return [4 /*yield*/, (0, promises_2.readFile)(this.path(file), "utf8")];
                case 1: return [2 /*return*/, _a.apply(void 0, [_c.apply(_b, [_d.sent()])])];
                case 2:
                    e_2 = _d.sent();
                    if (e_2.code === "ENOENT")
                        return [2 /*return*/, cloneJson(fallback)];
                    if (e_2 instanceof SyntaxError)
                        throw new LocalExecutionPlanRecordStoreError("Execution plan local store contains malformed JSON.", { cause: e_2 });
                    throw new LocalExecutionPlanRecordStoreError("Execution plan local store could not be read.", { cause: e_2 });
                case 3: return [2 /*return*/];
            }
        }); });
    };
    LocalExecutionPlanRecordStore.prototype.writeJsonFile = function (file, value) {
        return __awaiter(this, void 0, void 0, function () { var path, tmp, e_3; return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    path = this.path(file);
                    tmp = "".concat(path, ".").concat(process.pid, ".").concat((0, node_crypto_1.randomUUID)(), ".tmp");
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 6]);
                    return [4 /*yield*/, (0, promises_2.writeFile)(tmp, "".concat(JSON.stringify(value, null, 2), "\n"), "utf8")];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, (0, promises_2.rename)(tmp, path)];
                case 3:
                    _a.sent();
                    return [3 /*break*/, 6];
                case 4:
                    e_3 = _a.sent();
                    return [4 /*yield*/, (0, promises_2.unlink)(tmp).catch(function () { return undefined; })];
                case 5:
                    _a.sent();
                    throw new LocalExecutionPlanRecordStoreError("Execution plan local store could not be written.", { cause: e_3 });
                case 6: return [2 /*return*/];
            }
        }); });
    };
    LocalExecutionPlanRecordStore.prototype.createManifest = function () { return { schemaVersion: exports.EXECUTION_PLAN_LOCAL_SCHEMA_VERSION, storeKind: exports.EXECUTION_PLAN_LOCAL_STORE_KIND, updatedAt: this.now() }; };
    LocalExecutionPlanRecordStore.prototype.path = function (file) { return (0, node_path_1.join)(this.storeDir, file); };
    return LocalExecutionPlanRecordStore;
}());
exports.LocalExecutionPlanRecordStore = LocalExecutionPlanRecordStore;
function validateManifest(value) { if (!value || typeof value !== "object")
    throw new LocalExecutionPlanRecordStoreError("Execution plan local store manifest is invalid."); var m = value; if (m.schemaVersion !== exports.EXECUTION_PLAN_LOCAL_SCHEMA_VERSION || m.storeKind !== exports.EXECUTION_PLAN_LOCAL_STORE_KIND || typeof m.updatedAt !== "string")
    throw new LocalExecutionPlanRecordStoreError("Execution plan local store manifest is invalid."); return m; }
function cloneJson(value) { return JSON.parse(JSON.stringify(value)); }
function assertJsonCompatible(v) { try {
    var s = JSON.stringify(v);
    if (typeof s !== "string")
        throw new Error();
}
catch (_a) {
    throw new LocalExecutionPlanRecordStoreError("Execution plan local store accepts JSON-compatible records only.");
} }
