import { createPortal } from 'react-dom';
import { useEffect, useId, useRef, useState, useCallback, type ReactNode } from 'react';
import { useWorkspace } from './Context';

export function useWindowClose(close: () => void, immediate = false) {
  const [closing, setClosing] = useState(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null), latest = useRef(close);
  latest.current = close;
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const requestClose = useCallback(() => {
    if (timer.current) return;
    if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) { latest.current(); return; }
    setClosing(true);
    timer.current = setTimeout(() => latest.current(), 250);
  }, [immediate]);
  return { close: requestClose, motion: closing ? 'legacy-window-exit' : 'legacy-window-enter' };
}

export function Dialog({ title, close, children, className='',inline=false, motion }: { title: string; close(): void; children: ReactNode|((dismiss:()=>void)=>ReactNode);className?:string;inline?:boolean; motion?:string }) {
  const ownMotion = useWindowClose(close), requestClose = motion ? close : ownMotion.close;
  const ref = useRef<HTMLDialogElement>(null), heading = useId();
  const { busy, text, error } = useWorkspace();
  useEffect(() => {
    if(inline)return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!; dialog.showModal();
    return () => { dialog.close(); if (previous?.isConnected) previous.focus(); };
  }, [inline]);
  const content = typeof children==='function'?children(requestClose):children;
  if(inline)return <section className={'legacy-inline-dialog '+className} aria-label={title}>{content}</section>;
  return createPortal(<dialog data-app-interaction-root ref={ref} className={'workspace-dialog '+className+' '+(motion || ownMotion.motion)} aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!busy) requestClose(); }}>
    <header><h2 id={heading}>{title}</h2><button type="button" aria-label={text.close} onClick={requestClose} disabled={busy}>×</button></header>
    {error && <p className="danger" role="alert" data-selectable>{text[error as 'blocked' | 'conflict' | 'validation' | 'failed']}</p>}
    {content}
  </dialog>, document.body);
}

/** Legacy secondary pages return to the same workspace selection. */
export function PageOverlay({title,close:onClose,children,full=false}:{title:string;close():void;children:ReactNode;full?:boolean}){
 const ref=useRef<HTMLDialogElement>(null),heading=useId(),{text}=useWorkspace(),report=full&&title===text.reports;
 const {close,motion}=useWindowClose(onClose,report);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;if(report){const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.defaultPrevented&&!document.querySelector('dialog[open]')){event.preventDefault();close()}};document.addEventListener('keydown',escape);return()=>{document.removeEventListener('keydown',escape);if(previous?.isConnected)previous.focus()}}const dialog=ref.current!;dialog.showModal();return()=>{dialog.close();if(previous?.isConnected)previous.focus()}},[report]);
 const header=<header><h1 id={heading}>{title}</h1><button data-testid="close-page" aria-label={text.close} onClick={close}>×</button></header>;
 if(report)return <section className={'domain-overlay full legacy-report-overlay '+motion} role="dialog" aria-modal="true" aria-labelledby={heading}>{header}<div className="domain-overlay-body">{children}</div></section>;
 return <dialog ref={ref} className={'domain-overlay '+motion+(full?' full':'')} aria-labelledby={heading} onCancel={event=>{event.preventDefault();close()}}>{header}<div className="domain-overlay-body">{children}</div></dialog>;
}
