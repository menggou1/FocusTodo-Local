import { useEffect, useRef, useState } from 'react';
import type { Entity } from '../../services/core.mjs';
import { useWorkspace } from './Context';

type Completion = {
  row: Entity;
  scope: string;
  section: string;
  next: string[];
  phase: 'spin' | 'toggled';
  repeatId?: string;
  elapsed: boolean;
  saved: boolean;
  timers: ReturnType<typeof setTimeout>[];
};

/** Retain the initiating view's row while the committed snapshot updates all
 * other views. The timers only govern the visual lifetime of that row.
 */
export function useTaskCompletion(beforeRelease?: (scope: string) => void) {
  const { services, queue, blocked } = useWorkspace();
  const live = useRef(new Map<string, Completion>());
  const writing = useRef(new Set<string>());
  const [motions, setMotions] = useState(new Map<string, Completion>());
  const mounted = useRef(false);
  const release = useRef(beforeRelease);
  release.current = beforeRelease;
  const publish = () => { if (mounted.current) setMotions(new Map(live.current)); };
  function end(entry: Completion) {
    if (live.current.get(entry.row.id) !== entry) return;
    if (mounted.current) release.current?.(entry.scope);
    entry.timers.forEach(clearTimeout);
    live.current.delete(entry.row.id);
    publish();
  }
  useEffect(() => {
    mounted.current = true;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (media.matches) for (const entry of live.current.values()) end(entry); };
    media.addEventListener('change', reduce);
    return () => {
      mounted.current = false;
      media.removeEventListener('change', reduce);
      for (const entry of live.current.values()) entry.timers.forEach(clearTimeout);
      live.current.clear();
    };
  }, []);

  function toggle(row: Entity, scope: string, section: string, rows: readonly Entity[], subtask = false) {
    if (blocked || writing.current.has(row.id)) return;
    const previous = live.current.get(row.id);
    if (previous) {
      if (!previous.saved) return;
      const current = services.business.getSnapshot()[subtask ? 'subtasks' : 'tasks'].find(item => item.id === row.id && item.state === 0);
      if (!current) return;
      end(previous);
      row = current;
    }
    const repeating = !subtask && !row.isFinished && Number(row.rCycle) > 0;
    const entry: Completion = { row, scope, section, next: rows.slice(rows.findIndex(item => item.id === row.id) + 1).map(item => item.id),
      phase: repeating ? 'spin' : 'toggled', elapsed: false, saved: false, timers: [] };
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      live.current.set(row.id, entry);
      if (repeating) entry.timers.push(setTimeout(() => { entry.phase = 'toggled'; publish(); }, 250));
      entry.timers.push(setTimeout(() => {
        entry.elapsed = true;
        if (entry.saved) end(entry);
      }, repeating ? 500 : 250));
      publish();
    }
    const type = subtask ? 'toggleSubtask' : row.isFinished ? 'uncompleteTask' : 'completeTask';
    writing.current.add(row.id);
    void queue(() => services.business.command({ type, id: row.id, expected: row }, result => {
      if (!Array.isArray(result) && result.newTask && typeof result.newTask === 'object' && 'id' in result.newTask) {
        entry.repeatId = String(result.newTask.id);
        if (live.current.get(row.id) === entry) publish();
      }
    })).then(saved => {
      writing.current.delete(row.id);
      entry.saved = saved;
      if (!saved || entry.elapsed) end(entry);
      else publish();
    });
  }

  function retain(rows: readonly Entity[], scope: string, section: string) {
    const entries = [...motions.values()].filter(entry => entry.scope === scope);
    if (!entries.length) return rows;
    const hidden = new Set(entries.flatMap(entry => entry.repeatId ? [entry.row.id, entry.repeatId] : [entry.row.id]));
    const result = rows.filter(row => !hidden.has(row.id));
    for (const entry of entries.filter(entry => entry.section === section).reverse()) {
      const next = entry.next.find(id => result.some(row => row.id === id));
      const at = next ? result.findIndex(row => row.id === next) : result.length;
      result.splice(at, 0, entry.row);
    }
    return result;
  }

  function visual(row: Entity, scope: string) {
    const entry = motions.get(row.id);
    const active = entry?.scope === scope ? entry : undefined;
    return { finished: active?.phase === 'toggled' ? !active.row.isFinished : !!row.isFinished,
      spinning: active?.phase === 'spin', pending: writing.current.has(row.id) };
  }

  return { toggle, retain, visual };
}
