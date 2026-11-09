import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useWorkspace } from './Context';

export function Dialog({ title, close, children, className='',inline=false }: { title: string; close(): void; children: ReactNode;className?:string;inline?:boolean }) {
  const ref = useRef<HTMLDialogElement>(null), heading = useId();
  const { busy, text, error } = useWorkspace();
  useEffect(() => {
    if(inline)return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!; dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, [inline]);
  if(inline)return <section className={'legacy-inline-dialog '+className} aria-label={title}>{children}</section>;
  return <dialog ref={ref} className={'workspace-dialog '+className} aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!busy) close(); }}>
    <header><h2 id={heading}>{title}</h2><button type="button" aria-label={text.close} onClick={close} disabled={busy}>×</button></header>
    {error && <p className="danger" role="alert">{text[error as 'blocked' | 'conflict' | 'validation' | 'failed']}</p>}
    {children}
  </dialog>;
}

/** Legacy secondary pages return to the same workspace selection. */
export function PageOverlay({title,close,children,full=false}:{title:string;close():void;children:ReactNode;full?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),heading=useId(),{text}=useWorkspace(),report=full&&title===text.reports;
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;if(report){const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('dialog[open]')){event.preventDefault();close()}};document.addEventListener('keydown',escape);return()=>{document.removeEventListener('keydown',escape);if(previous?.isConnected)previous.focus()}}const dialog=ref.current!;dialog.showModal();return()=>{dialog.close();if(previous?.isConnected)previous.focus()}},[report]);
 const header=<header><h1 id={heading}>{title}</h1><button data-testid="close-page" aria-label={text.close} onClick={close}>×</button></header>;
 if(report)return <section className="domain-overlay full legacy-report-overlay" role="dialog" aria-modal="true" aria-labelledby={heading}>{header}<div className="domain-overlay-body">{children}</div></section>;
 return <dialog ref={ref} className={'domain-overlay'+(full?' full':'')} aria-labelledby={heading} onCancel={event=>{event.preventDefault();close()}}>{header}<div className="domain-overlay-body">{children}</div></dialog>;
}
