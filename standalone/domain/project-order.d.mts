export function orderedProjects<T extends {type?: unknown; order?: unknown}>(rows: readonly T[]): T[];
export function folderProjects<T extends {type?: unknown; state?: unknown; parentId?: unknown}>(rows: readonly T[], folderId: string): T[];
