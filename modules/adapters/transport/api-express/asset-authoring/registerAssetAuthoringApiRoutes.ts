import { registerUserLibraryApiRoutes } from "../user-library/registerUserLibraryApiRoutes";
export { registerUserLibraryApiRoutes as registerAssetAuthoringApiRoutes };
export type RegisterAssetAuthoringApiRoutesDependencies = Parameters<typeof registerUserLibraryApiRoutes>[0];
