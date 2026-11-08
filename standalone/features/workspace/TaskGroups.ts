import type { Entity } from '../../services/core.mjs';
import type { WorkspaceText } from '../../shared/workspace';
import { dateInput, number, ordered, projectName, string } from './model';

/** Legacy ordering rules: 0 project, 1 deadline, 2 priority, 3 custom. */
export function taskGroups(rows: readonly Entity[], project: Entity | undefined, projects: readonly Entity[], text: WorkspaceText) {
  const rule = project ? number(project.orderingRule) : 3;
  if (rule === 3) return [{ id: 'tasks', title: '', rows: ordered(rows) }];
  const groups = new Map<string, { id: string; title: string; order: number; rows: Entity[] }>();
  for (const row of ordered(rows)) {
    const parent = projects.find(item => item.id === row.projectId);
    const date = dateInput(row.deadline);
    const id = rule === 0 ? string(row.projectId) : rule === 1 ? date : String(number(row.priority));
    const title = rule === 0 ? parent ? projectName(parent, text) : text.none : rule === 1 ? date || text.noDeadline : [text.normal, text.low, text.medium, text.high][number(row.priority)] || text.normal;
    const order = rule === 0 ? number(parent?.order) : rule === 1 ? number(row.deadline) || Number.MAX_SAFE_INTEGER : -number(row.priority);
    if (!groups.has(id)) groups.set(id, { id, title, order, rows: [] });
    groups.get(id)!.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => rule === 1 && [4000, 4006].includes(number(project?.type)) ? (b.order === Number.MAX_SAFE_INTEGER ? -1 : a.order === Number.MAX_SAFE_INTEGER ? 1 : b.order - a.order) : a.order - b.order);
}
