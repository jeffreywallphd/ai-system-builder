export const expectedBaseRevisionMatches = (expectedBaseRevision: string | undefined, actualBaseRevision: string | undefined): boolean => {
  if (!expectedBaseRevision) return true;
  if (!actualBaseRevision) return false;
  return expectedBaseRevision === actualBaseRevision;
};
