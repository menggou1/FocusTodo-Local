import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useWorkspace } from './Context';

export function Dialog({ title, close, children }: { title: string; close(): void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), heading = useId();
  const { busy, text, error } = useWorkspace();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!; dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, []);
  return <dialog ref={ref} className="workspace-dialog" aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <header><h2 id={heading}>{title}</h2><button type="button" aria-label={text.close} onClick={close} disabled={busy}>×</button></header>
    {error && <p className="danger" role="alert">{text[error as 'blocked' | 'conflict' | 'validation' | 'failed']}</p>}
    {children}
  </dialog>;
}

/** Legacy secondary pages open above the workspace and return to the same selection. */
export function PageOverlay({ title, close, children, full = false }: {title:string;close():void;children:ReactNode;full?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null),heading=useId();
  const {text}=useWorkspace();
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null,dialog=ref.current!;dialog.showModal();return()=>{dialog.close();if(previous?.isConnected)previous.focus()}},[]);
  return <dialog ref={ref} className={'domain-overlay'+(full?' full':'')} aria-labelledby={heading} onCancel={event=>{event.preventDefault();close()}}><header><h1 id={heading}>{title}</h1><button data-testid="close-page" aria-label={text.close} onClick={close}>×</button></header><div className="domain-overlay-body">{children}</div></dialog>;
}
