export function orderedProjects<T extends {type?: unknown; order?: unknown}>(rows: readonly T[]): T[];
