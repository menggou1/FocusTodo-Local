import { Children, Fragment, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Native disclosure state, with the legacy body-level overlay outside scroll clips.
 * A modal's overlays stay inside its top layer. All fields share root-close,
 * viewport clamping and the 150ms legacy popover fade.
 */
export function PickerField({children, restoreFocusOnEscape=false, resetOnOpen=false, gap=10, align='center', fitViewport=false, ...props}: ComponentProps<'details'> & {restoreFocusOnEscape?:boolean;resetOnOpen?:boolean;gap?:number;align?:'center'|'start';fitViewport?:boolean}) {
  const field = useRef<HTMLDetailsElement>(null), surface = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [mounted, setMounted] = useState(false), exit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [revision, setRevision] = useState(0);
  const [position, setPosition] = useState({left:0, top:0, arrow:0});
  useEffect(() => () => { if (exit.current) clearTimeout(exit.current); }, []);
  const parts = Children.toArray(children), summary = parts[0], content = parts.slice(1) as ReactNode;
  useLayoutEffect(() => {
    if (!open) return;
    const element = field.current!, popup = surface.current!;
    const place = () => {
      const summary = element.querySelector('summary')!;
      const anchor = summary.querySelector('.legacy-record-duration-text') || summary.querySelector('.legacy-tag-add-content,.legacy-detail-pomo-value,.legacy-detail-value,.legacy-record-value')
        || (element.matches('.legacy-priority-picker') ? summary.querySelector('.legacy-icon') : null)
        || (element.closest('.workspace-add-task') ? summary.querySelector('.workspace-nav-icon') : null) || summary;
      const rect = anchor.getBoundingClientRect(), width = popup.offsetWidth;
      const below = innerHeight - rect.bottom - gap - 4, above = rect.top - gap - 4;
      if (fitViewport) popup.style.setProperty('--picker-available-height', Math.max(0, below, above) + 'px');
      const height = popup.offsetHeight;
      const alignedLeft = align === 'start' ? rect.left : rect.x + (rect.width - width) / 2;
      const left = Math.max(4, Math.min(alignedLeft, innerWidth - width - 4));
      const preferredTop = fitViewport && height > below && above > below ? rect.top - gap - height : rect.bottom + gap;
      const top = Math.max(4, Math.min(preferredTop, innerHeight - height - 4));
      setPosition({left, top, arrow:rect.x + rect.width / 2 - left});
    };
    place();
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape' || event.defaultPrevented) return;
        event.preventDefault();
        event.stopPropagation();
        if (restoreFocusOnEscape) element.querySelector('summary')?.focus();
      }
      else if (element.contains(event.target as Node) || popup.contains(event.target as Node)) return;
      element.open = false;
    };
    const settle = (event: TransitionEvent) => {
      if (event.target instanceof Element && event.target.contains(element)) place();
    };
    if (fitViewport) document.addEventListener('transitionend', settle, true);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    document.addEventListener('click', dismiss, true);
    document.addEventListener('keydown', dismiss, true);
    return () => {
      if (fitViewport) document.removeEventListener('transitionend', settle, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('scroll', place, true);
      document.removeEventListener('click', dismiss, true);
      document.removeEventListener('keydown', dismiss, true);
    };
  }, [open, gap, align, fitViewport, restoreFocusOnEscape]);
  return <details {...props} ref={field} onToggle={event => {
    const next = event.currentTarget.open;
    if (exit.current) clearTimeout(exit.current);
    setOpen(next);
    if (next) {
      setMounted(true);
      if (resetOnOpen) setRevision(value => value + 1);
    }
    else exit.current = setTimeout(() => setMounted(false), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150);
    props.onToggle?.(event);
  }}>
    {summary}
    {mounted && createPortal(<div data-app-interaction-root className={'workspace-picker-surface '+(open?'':'is-closing ')+(props.className || '')} ref={surface} style={{left:position.left,top:position.top,'--picker-arrow':position.arrow+'px'} as React.CSSProperties}><Fragment key={revision}>{content}</Fragment></div>, field.current?.closest('dialog') || document.body)}
  </details>;
}
