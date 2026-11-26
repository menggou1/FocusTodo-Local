import { formatTaskDate } from '../../domain/display.mjs';
export { formatMinutesDuration, formatTaskDate } from '../../domain/display.mjs';
import type { Entity } from '../../services/core.mjs';
import type { WorkspaceText } from '../../shared/workspace';
import { dateInput, number, ordered, projectName, string } from './model';

const weekdayZh = ['日', '一', '二', '三', '四', '五', '六'];

/** Finished lists use the completion day, independent of the task's due date. */
export function completedTaskGroups(rows: readonly Entity[], locale: string) {
  const groups = new Map<string, { id: string; title: string; rows: Entity[] }>();
  for (const row of [...rows].sort((a,b)=>number(b.finishedDate)-number(a.finishedDate))) {
    const value=number(row.finishedDate), id=dateInput(value);
    if (!groups.has(id)) groups.set(id,{id,title:formatTaskDate(value,locale),rows:[]});
    groups.get(id)!.rows.push(row);
  }
  return [...groups.values()].map(group=>({...group,rows:group.rows.sort((a,b)=>number(a.finishedDate)-number(b.finishedDate))}));
}

/** Group heading used by legacy TaskGroup: relative/absolute date + weekday, or 待定. */
export function formatTaskDateGroup(value: number, locale: string, text: WorkspaceText, now = new Date()) {
  if (!value) return text.someday;
  const zh = locale.startsWith('zh'), date = new Date(value);
  const label = formatTaskDate(value, locale, now);
  if (label === (zh ? '今天' : 'Today') || label === (zh ? '明天' : 'Tomorrow')) return label;
  if (zh) return `${label} 周${weekdayZh[date.getDay()]}`;
  return `${date.toLocaleDateString('en-US', { weekday: 'short' })}, ${label}`;
}

function priorityLabel(priority: number, locale: string) {
  const zh = locale.startsWith('zh');
  return priority === 3 ? (zh ? '高优先级' : 'High Priority') : priority === 2 ? (zh ? '中优先级' : 'Medium Priority') : priority === 1 ? (zh ? '低优先级' : 'Low Priority') : (zh ? '无优先级' : 'No Priority');
}

/** Legacy ordering rules: 0 project, 1 deadline, 2 priority, 3 custom. */
export function taskGroups(rows: readonly Entity[], project: Entity | undefined, projects: readonly Entity[], text: WorkspaceText, locale = 'zh-CN', now = new Date()) {
  const rule = project ? number(project.orderingRule) : 3;
  if (rule === 3) return [{ id: 'tasks', title: '', rows: ordered(rows) }];
  const lists = rule === 0 ? new Map(projects.map((row, position) => [row.id, { row, position }])) : undefined;
  const groups = new Map<string, { id: string; title: string; order: number; rows: Entity[] }>();
  for (const row of ordered(rows)) {
    const parent = lists?.get(string(row.projectId));
    const id = rule === 0 ? string(row.projectId) : rule === 1 ? dateInput(row.deadline) : String(number(row.priority));
    // The business snapshot owns project order, including preset precedence.
    let group = groups.get(id);
    if (!group) {
      const title = rule === 0 ? parent ? projectName(parent.row, text) : text.none : rule === 1 ? formatTaskDateGroup(number(row.deadline), locale, text, now) : priorityLabel(number(row.priority), locale);
      const order = rule === 0 ? parent?.position ?? Number.MAX_SAFE_INTEGER : rule === 1 ? number(row.deadline) || Number.MAX_SAFE_INTEGER : -number(row.priority);
      group = { id, title, order, rows: [] };
      groups.set(id, group);
    }
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => rule === 1 && [4000, 4006].includes(number(project?.type)) ? (b.order === Number.MAX_SAFE_INTEGER ? -1 : a.order === Number.MAX_SAFE_INTEGER ? 1 : b.order - a.order) : a.order - b.order);
}
