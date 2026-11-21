export function orderedTasks<T extends { id: string; order?: unknown }>(rows: readonly T[]): T[];
export function taskMoveOrders(rows: readonly { id: string; order?: unknown }[], from: string, to: string, after: boolean): { id: string; order: number }[];
