import type { Entity } from '../services/core.mjs';
export function completionStacks(tasks: readonly Entity[], projects: readonly Entity[], ranges: readonly { start: number; end: number }[]):
    { id: string; value: number; kind: 'tasks' | 'project' }[][];
