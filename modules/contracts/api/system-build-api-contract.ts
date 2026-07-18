import { createTransportOperation } from "../transport";
export const API_SYSTEM_BUILD_OPERATIONS = {
  request: createTransportOperation("system-build", "request"),
  cancel: createTransportOperation("system-build", "cancel"),
  read: createTransportOperation("system-build", "read"),
  list: createTransportOperation("system-build", "list"),
  approve: createTransportOperation("system-build", "approve-release"),
  readRelease: createTransportOperation("system-build", "read-release"),
  listReleases: createTransportOperation("system-build", "list-releases"),
  compareReleases: createTransportOperation("system-build", "compare-releases"),
} as const;
