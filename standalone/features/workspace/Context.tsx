import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ApplicationServices } from '../../app/contracts';
import type { WorkspaceText } from '../../shared/workspace';

type Command = (action: () => Promise<unknown>) => Promise<boolean>;
const Context = createContext<{ services: ApplicationServices; text: WorkspaceText; run: Command; queue: Command; report(error: unknown): void; busy: boolean; blocked: boolean; error: string } | null>(null);
export function useWorkspace() { const value = useContext(Context); if (!value) throw new Error('Missing workspace'); return value; }

export function WorkspaceProvider({ services, text, children }: { services: ApplicationServices; text: WorkspaceText; children: ReactNode }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [blocked, setBlocked] = useState(false);
  const guard = useRef(false), stopped = useRef(false);
  const [,publishCommit]=useState(0);
  const inFlight = useRef<Promise<void>>(Promise.resolve());
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!busy && document.activeElement === document.body && returnFocus.current?.isConnected) returnFocus.current.focus();
  }, [busy]);
  const run: Command = async action => {
    if (guard.current || stopped.current) return false;
    returnFocus.current = document.activeElement as HTMLElement | null;
    guard.current = true; setBusy(true); setError('');
    let finish!:()=>void;inFlight.current=new Promise(resolve=>{finish=resolve});
    try { await action(); publishCommit(v=>v+1); return true; }
    catch (failure) {
      const code = (failure as { code?: string; name?: string; recoveryRequired?: boolean });
      if (['incompatible-client', 'disposed'].includes(code.code || '') || code.recoveryRequired || ['VersionError', 'InvalidStateError'].includes(code.name || '')) {
        stopped.current = true; setBlocked(true); setError('blocked');
      } else setError(code.code === 'conflict' ? 'conflict' : code.code === 'validation' ? 'validation' : 'failed');
      return false;
    } finally { guard.current = false; setBusy(false); finish(); }
  };
  const queue: Command=async action=>{while(guard.current)await inFlight.current;return run(action)};
  const report=(failure:unknown)=>{
    const code=failure as {code?:string;name?:string;recoveryRequired?:boolean}|null;
    if(code && (['incompatible-client','disposed'].includes(code.code||'')||code.recoveryRequired||['VersionError','InvalidStateError'].includes(code.name||''))){stopped.current=true;setBlocked(true);setError('blocked')}
    else setError(previous=>previous||'failed');
  };
  return <Context value={{ services, text, run, queue, report, busy, blocked, error }}>
    {error && <div className="workspace-error" role="alert"><span data-selectable>{text[error as 'blocked' | 'conflict' | 'validation' | 'failed']}</span>
      {blocked ? <button onClick={() => location.reload()}>{text.reload}</button> : <button onClick={() => setError('')}>{text.dismiss}</button>}</div>}
    <span className="workspace-sr" role="status">{busy ? text.busy : ''}</span>
    {children}
  </Context>;
}
