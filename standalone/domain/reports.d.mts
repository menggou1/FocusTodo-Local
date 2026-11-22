import type { Entity } from '../services/core.mjs';
export function focusStacks(tasks: readonly Entity[], projects: readonly Entity[], reports: readonly { byTask: Readonly<Record<string, number>>; byProject: Readonly<Record<string, number>> }[]):
    { id: string; seconds: number; kind: 'tasks' | 'project' }[][];
export function completionStacks(tasks: readonly Entity[], projects: readonly Entity[], ranges: readonly { start: number; end: number }[]):
    { id: string; value: number; kind: 'tasks' | 'project' }[][];
