import type { Entity } from '../../services/core.mjs';
import type { WorkspaceText } from '../../shared/workspace';
import { dateInput, number, ordered, projectName, string } from './model';

const weekdayZh = ['日', '一', '二', '三', '四', '五', '六'];

export function formatMinutesDuration(minutes: number, locale: string) {
  const zh = locale.startsWith('zh'), total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60), rest = Math.round(total % 60);
  if (hours > 0 && rest > 0) return zh ? `${hours}小时${rest}分钟` : `${hours}h ${rest}m`;
  if (hours > 0) return zh ? `${hours}小时` : `${hours}h`;
  return zh ? `${rest}分钟` : `${rest}m`;
}

/** Legacy LocalDate: cross-year YMD, other past/future MD, then Today/Tomorrow. */
export function formatTaskDate(value: number, locale: string, now = new Date()) {
  const zh = locale.startsWith('zh'), date = new Date(value), start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const day = new Date(date); day.setHours(0, 0, 0, 0);
  const tomorrow = new Date(start); tomorrow.setDate(tomorrow.getDate() + 1);
  if (day.getTime() === start.getTime()) return zh ? '今天' : 'Today';
  if (day.getTime() === tomorrow.getTime()) return zh ? '明天' : 'Tomorrow';
  const sameYear = date.getFullYear() === now.getFullYear();
  if (zh) return sameYear ? `${date.getMonth() + 1}月${date.getDate()}日` : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  return sameYear ? `${date.getDate()} ${month}` : `${date.getDate()} ${month} ${date.getFullYear()}`;
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
  const groups = new Map<string, { id: string; title: string; order: number; rows: Entity[] }>();
  for (const row of ordered(rows)) {
    const parent = projects.find(item => item.id === row.projectId);
    const date = dateInput(row.deadline);
    const id = rule === 0 ? string(row.projectId) : rule === 1 ? date : String(number(row.priority));
    const title = rule === 0 ? parent ? projectName(parent, text) : text.none : rule === 1 ? formatTaskDateGroup(number(row.deadline), locale, text, now) : priorityLabel(number(row.priority), locale);
    const order = rule === 0 ? number(parent?.order) : rule === 1 ? number(row.deadline) || Number.MAX_SAFE_INTEGER : -number(row.priority);
    if (!groups.has(id)) groups.set(id, { id, title, order, rows: [] });
    groups.get(id)!.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => rule === 1 && [4000, 4006].includes(number(project?.type)) ? (b.order === Number.MAX_SAFE_INTEGER ? -1 : a.order === Number.MAX_SAFE_INTEGER ? 1 : b.order - a.order) : a.order - b.order);
}
