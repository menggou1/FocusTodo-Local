import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { TimerAction } from '../../services/core.mjs';
import { Dialog } from './Dialog';
import { useWorkspace } from './Context';
import { number, string } from './model';
import { SoundSettings } from './SoundSettings';

type MiniAPI = { requestWindow(options: {width: number; height: number}): Promise<Window> };
export function formatClock(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const parts = [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60];
  return (parts[0] ? parts : parts.slice(1)).map(value => String(value).padStart(2, '0')).join(':');
}
function localTime(value: number) {
  const date = new Date(value), pad = (value: number, length = 2) => String(value).padStart(length, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/** All timer projections and mutations use the C service. UI owns only windows/confirmation drafts. */
export function Timer({ expanded, openExpanded }: { expanded: boolean; openExpanded(): void }) {
  const { services, text, run, busy, blocked } = useWorkspace();
  const session = useSyncExternalStore(services.timer.subscribe, services.timer.getSnapshot);
  const preferences = useSyncExternalStore(services.settings.subscribe, services.settings.getSnapshot);
  const business = useSyncExternalStore(services.business.subscribe, services.business.getSnapshot);
  const [confirmation, setConfirmation] = useState(false);
  const [mini, setMini] = useState<Window | null>(null), [miniError, setMiniError] = useState('');
  const opening = useRef(false), mounted = useRef(true);
  const [sound, setSound] = useState(false);
  const [recoveryCollapsed, setRecoveryCollapsed] = useState(false);
  const [cutoff, setCutoff] = useState(0), [keepRunning, setKeepRunning] = useState(false);
  const pending = session?.pendingRecovery;
  useEffect(() => { if (pending) { setCutoff(pending.to); setKeepRunning(false); setRecoveryCollapsed(false); } }, [pending?.from, pending?.to]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => () => { if (mini && !mini.closed) mini.close(); }, [mini]);
  useEffect(() => {
    if (!mini || mini.closed) return;
    mini.document.documentElement.lang = services.language.locale;
    mini.document.documentElement.dataset.theme = document.documentElement.dataset.theme;
  }, [mini, services, preferences.language, preferences.isDarkMode, session]);
  const projection = services.timer.view();
  const state = session?.state || 'initial', mode = session?.mode || (preferences.isCountdown ? 'countdown' : 'countup');
  const rest = state === 'rest' || state === 'waitingForRest' || session?.pausedFrom === 'rest';
  const elapsed = projection?.elapse || 0, interval = projection?.interval || preferences.workInterval;
  const time = formatClock(mode === 'countup' && !rest ? elapsed : interval - elapsed);
  const task = business.tasks.find(row => row.id === session?.taskId), subtask = business.subtasks.find(row => row.id === session?.subtaskId);
  const label = state === 'work' ? text.working : state === 'rest' ? text.resting : state === 'pause' ? text.paused : state === 'waitingForRest' ? text.waiting : state === 'recovery' ? text.recovery : text.idle;
  const command = (action: TimerAction) => run(() => services.timer.command({ ...action, expectedSession: session?.sessionId }));
  const start = () => command({ type: state === 'pause' ? 'resume' : 'start', mode, taskId: string(task?.id), subtaskId: string(subtask?.id), config: services.settings.timerConfig(task) });
  async function openMini() {
    if (mini && !mini.closed) { mini.focus(); return; }
    if (opening.current) return;
    const api = (window as Window & {documentPictureInPicture?: MiniAPI}).documentPictureInPicture;
    if (!api) { setMiniError(text.miniUnavailable); return; }
    opening.current = true;
    try {
      const target = await api.requestWindow({ width: task || subtask ? 320 : 260, height: 120 });
      if (!mounted.current) { target.close(); return; }
      const doc = target.document;
      doc.title = text.mini; doc.documentElement.lang = services.language.locale;
      for (const sheet of document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')) { const link = doc.createElement('link'); link.rel = 'stylesheet'; link.href = sheet.href; doc.head.appendChild(link); }
      const style = doc.createElement('style');
      style.textContent = 'body{margin:0}.workspace-mini-native{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px;font:14px system-ui;background:var(--workspace-panel,#fff);color:var(--workspace-text,#525252)}.workspace-mini-native button{font:inherit;cursor:pointer}.workspace-mini-native strong{font:24px monospace}.workspace-mini-native .workspace-timer-task{width:100%;margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.workspace-mini-native .workspace-timer-controls{display:flex;gap:4px}';
      doc.head.appendChild(style); target.addEventListener('pagehide', () => { if (mounted.current) setMini(null); }, { once: true });
      setMini(target); setMiniError('');
    } catch { setMiniError(text.miniFailed); }
    finally { opening.current = false; }
  }
  const controls = (compact = false) => <div className="workspace-timer-controls">
    {state === 'rest' ? <button disabled={busy || blocked} onClick={() => { void command({ type: 'stop' }); }}>{text.finish}</button>
      : state === 'waitingForRest' ? <button className="primary" disabled={busy || blocked} onClick={() => { void command({ type: 'rest' }); }}>{text.rest}</button>
      : state === 'work' ? <button disabled={busy || blocked} onClick={() => { void command({ type: 'pause' }); }}>{text.pause}</button>
      : state === 'recovery' ? <button onClick={() => setRecoveryCollapsed(false)}>{text.recovery}</button>
      : <button className="primary" disabled={busy || blocked} onClick={() => { void start(); }}>{state === 'pause' ? text.resume : text.start}</button>}
    {state === 'pause' && <button disabled={busy || blocked} onClick={event => { event.currentTarget.focus(); if (compact) void command({ type: 'stop' }); else setConfirmation(true); }}>{text.stop}</button>}
    {!compact && state !== 'recovery' && <>
      {session?.taskId && <button disabled={busy || blocked} onClick={() => { void command({ type: 'detach', config: services.settings.timerConfig() }); }}>{text.noTask}</button>}
    </>}
  </div>;
  const taskLabel = subtask ? `${task?.name || text.noTask} / ${subtask.name}` : task?.name || text.noTask;
  return <>
    <section className={expanded ? 'workspace-timer-expanded' : 'workspace-floating-timer'} aria-label={text.timer} data-testid={expanded ? 'timer-expanded' : 'timer-floating'} data-state={state}
      onDoubleClick={event => { if (!expanded && !(event.target as Element).closest('button')) openExpanded(); }}>
      {expanded && <header><button disabled={busy || blocked || state === 'recovery'} onClick={() => { const nextMode = mode === 'countdown' ? 'countup' : 'countdown'; void run(async () => {
        await services.timer.command({ type: 'mode', mode: nextMode, expectedSession: session?.sessionId }); await services.settings.set('isCountdown', nextMode === 'countdown');
      }); }}>{mode === 'countdown' ? text.countdown : text.countup}</button></header>}
      <p className="workspace-timer-task">{taskLabel}</p>
      {expanded && task && !task.isFinished && <button type="button" disabled={busy || blocked || state === 'recovery'} onClick={() => { void run(async () => {
        await services.business.command(subtask && !subtask.isFinished ? { type: 'toggleSubtask', id: subtask.id, expected: subtask } : { type: 'completeTask', id: task.id, expected: task });
        if (preferences.completeSoundEnabled) { try { services.audio?.effect('Complete.m4a', preferences.ringtoneVolume / 100); } catch { /* Already committed. */ } }
      }); }}>{subtask && !subtask.isFinished ? text.toggleSubtask : text.complete}</button>}
      <strong className="workspace-clock" aria-label={time}>{time}</strong>{expanded && <p role="status">{label}</p>}
      {controls(!expanded)}
      {expanded ? <button onClick={() => { void openMini(); }}>{text.mini}</button> : <button aria-label={text.expandTimer} onClick={openExpanded}>↗</button>}
      {expanded && <button type="button" onClick={event => { event.currentTarget.focus(); setSound(true); }}>{text.audio}</button>}
      {expanded && <label>{text.interval}<input type="number" min={1} max={480} step="any" disabled={!['initial', 'waitingForRest'].includes(state) || busy || blocked} value={(['initial', 'waitingForRest'].includes(state) ? number(task?.pomodoroInterval) || preferences.workInterval : interval) / 60}
        onChange={event => { const value = event.target.valueAsNumber * 60; if (value >= 60 && value <= 28800) void run(async () => {
          if (task) await services.business.command({ type: 'updateTask', id: task.id, changes: { pomodoroInterval: value }, expected: { pomodoroInterval: task.pomodoroInterval } });
          else await services.settings.set('workInterval', value);
          await services.timer.command({ type: 'configure', mode, expectedSession: session?.sessionId, config: { ...services.settings.timerConfig(task), interval: value } });
        }); }} /></label>}
      {miniError && expanded && <p role="status">{miniError}</p>}
    </section>
    {mini && !mini.closed && createPortal(<section className="workspace-mini-native" aria-label={text.mini}><p className="workspace-timer-task">{taskLabel}</p><strong>{time}</strong>{controls(true)}<button aria-label={text.closeMini} onClick={() => mini.close()}>×</button></section>, mini.document.body)}
    {confirmation && <Dialog title={text.stop} close={() => setConfirmation(false)}>
      <p>{text.stopHelp}</p><footer><button onClick={() => setConfirmation(false)}>{text.cancel}</button><button className="primary" disabled={busy || blocked} onClick={async () => {
        if (await run(async () => {
          await services.timer.command({ type: 'stop', expectedSession: session?.sessionId });
        })) setConfirmation(false);
      }}>{text.confirm}</button></footer>
    </Dialog>}
    {sound && <SoundSettings close={() => setSound(false)} />}
    {pending && !recoveryCollapsed && <Dialog title={text.recovery} close={() => setRecoveryCollapsed(true)}>
      <p>{text.recoveryHelp}</p><p>{new Date(pending.from).toLocaleString(services.language.locale)} — {new Date(pending.to).toLocaleString(services.language.locale)}</p>
      <form onSubmit={async event => { event.preventDefault(); await command({ type: 'resolve', cutoff, continue: keepRunning }); }}>
        <label>{text.cutoff}<input type="datetime-local" step="0.001" required min={localTime(pending.from)} max={localTime(pending.to)} value={localTime(cutoff || pending.to)} onChange={event => setCutoff(new Date(event.target.value).getTime())} /></label>
        <label className="workspace-check"><input type="checkbox" checked={keepRunning} onChange={event => setKeepRunning(event.target.checked)} />{text.keepRunning}</label>
        <footer><button type="button" disabled={busy || blocked} onClick={() => { void command({ type: 'resolve', cutoff: pending.from, continue: false }); }}>{text.discardGap}</button><button className="primary" disabled={busy || blocked}>{text.confirm}</button></footer>
      </form>
    </Dialog>}
  </>;
}
