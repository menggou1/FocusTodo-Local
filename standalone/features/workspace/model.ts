import { orderedTasks } from '../../domain/task-order.mjs';
import type { Entity, CompatibleRecord } from '../../services/core.mjs';
import type { WorkspaceText } from '../../shared/workspace';
import { presetKeys } from '../../shared/workspace';
export const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : 0;
export const string = (value: unknown) => typeof value === 'string' ? value : '';
export const ordered = <T extends Entity>(rows: readonly T[]): T[] => orderedTasks(rows);
export const projectName = (row: Entity, text: WorkspaceText) => presetKeys[number(row.type)] ? text[presetKeys[number(row.type)]] : string(row.name);
export const expected = (row: CompatibleRecord, keys: string[]) => Object.fromEntries(keys.map(key => [key, row[key]]));
export function dateInput(value: unknown, time = false) {
  if (!number(value)) return '';
  const date = new Date(number(value)), pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` + (time ? `T${pad(date.getHours())}:${pad(date.getMinutes())}` : '');
}
export function timestamp(value: string, endOfDay = false) {
  if (!value) return 0;
  const date = new Date(value + (endOfDay ? 'T23:59:59.999' : ''));
  return date.getTime();
}
