import { Children, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Native disclosure state, with the legacy body-level overlay outside scroll clips.
 * A modal's overlays stay inside its top layer. All fields share root-close,
 * viewport clamping and the 150ms legacy popover fade.
 */
export function PickerField({children, ...props}: ComponentProps<'details'>) {
  const field = useRef<HTMLDetailsElement>(null), surface = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false), [mounted, setMounted] = useState(false), exit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [position, setPosition] = useState({left:0, top:0, arrow:0});
  useEffect(() => () => { if (exit.current) clearTimeout(exit.current); }, []);
  const parts = Children.toArray(children), summary = parts[0], content = parts.slice(1) as ReactNode;
  useLayoutEffect(() => {
    if (!open) return;
    const element = field.current!, popup = surface.current!;
    const place = () => {
      const summary = element.querySelector('summary')!;
      const anchor = summary.querySelector('.legacy-tag-add-content,.legacy-detail-pomo-value,.legacy-detail-value,.legacy-record-value')
        || (element.matches('.legacy-priority-picker') ? summary.querySelector('.legacy-icon') : null) || summary;
      const rect = anchor.getBoundingClientRect(), width = popup.offsetWidth, height = popup.offsetHeight;
      const left = Math.max(4, Math.min(rect.x + rect.width / 2 - width / 2, innerWidth - width - 4));
      const top = Math.max(4, Math.min(rect.bottom + 10, innerHeight - height - 4));
      setPosition({left, top, arrow:rect.x + rect.width / 2 - left});
    };
    place();
    const dismiss = (event: Event) => {
      if (event instanceof KeyboardEvent) { if (event.key !== 'Escape') return; event.preventDefault(); event.stopPropagation(); }
      else if (element.contains(event.target as Node) || popup.contains(event.target as Node)) return;
      element.open = false;
    };
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    document.addEventListener('click', dismiss);
    document.addEventListener('keydown', dismiss, true);
    return () => { window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); document.removeEventListener('click', dismiss); document.removeEventListener('keydown', dismiss, true); };
  }, [open]);
  return <details {...props} ref={field} onToggle={event => {
    const next = event.currentTarget.open;
    if (exit.current) clearTimeout(exit.current);
    setOpen(next);
    if (next) setMounted(true);
    else exit.current = setTimeout(() => setMounted(false), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 150);
    props.onToggle?.(event);
  }}>
    {summary}
    {mounted && createPortal(<div data-app-interaction-root className={'workspace-picker-surface '+(open?'':'is-closing ')+(props.className || '')} ref={surface} style={{left:position.left,top:position.top,'--picker-arrow':position.arrow+'px'} as React.CSSProperties}>{content}</div>, field.current?.closest('dialog') || document.body)}
  </details>;
}
