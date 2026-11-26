import type { CompatibleRecord } from '../services/core.mjs';
export function deadlineChanges(task: CompatibleRecord, deadline: number): CompatibleRecord;
export function sidebarTaskDropKind(project: CompatibleRecord): 'list' | 'deadline' | 'priority' | 'tag' | null;
