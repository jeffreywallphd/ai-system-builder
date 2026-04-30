export interface RuntimeInstallGitSource {
  type: "git";
  repositoryUrl: string;
  ref?: string;
}

export interface RuntimeInstallUnknownSource {
  type: string;
  [key: string]: unknown;
}

export type RuntimeInstallSource = RuntimeInstallGitSource | RuntimeInstallUnknownSource;
