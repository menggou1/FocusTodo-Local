import { useEffect, useRef, useState } from 'react';

// 1.9.3 TaskNewItem: the 14x20 trigger opens a 130x34 PomodoroSelection bubble.
// Options: minus/plus by one, editable number (0..1000), wheel by up to five, Enter closes.
export function QuickEstimate({ value, change, label, focusInput }: { value: number; change(value: number): void; label: string; focusInput(): void }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLSpanElement>(null);
  const close = () => { setOpen(false); requestAnimationFrame(focusInput); };
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => { if (!anchor.current?.contains(event.target as Node)) close(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', pointer);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', pointer);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  return <span className="workspace-quick-pomo-anchor" ref={anchor}>
    <button type="button" className="workspace-quick-pomo-trigger" aria-label={label + '…'} aria-haspopup="dialog" aria-expanded={open} onMouseDown={event => event.preventDefault()} onClick={() => open ? close() : setOpen(true)} />
    {open && <QuickEstimatePopover value={value} change={change} label={label} close={close} />}
  </span>;
}

function QuickEstimatePopover({ value, change, label, close }: { value: number; change(value: number): void; label: string; close(): void }) {
  const [width, setWidth] = useState(9);
  const measure = useRef<HTMLSpanElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const set = (next: number) => change(Math.max(0, Math.min(1000, next)));
  const surface = useRef<HTMLDivElement>(null);
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const element = surface.current!;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      set(latest.current - Math.max(-5, Math.min(5, Math.ceil(event.deltaY / 5))));
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);
  useEffect(() => {
    measure.current!.textContent = String(value);
    setWidth(Math.max(9, Math.ceil(measure.current!.getBoundingClientRect().width)));
    input.current?.focus();
  }, []);
  useEffect(() => {
    measure.current!.textContent = String(value);
    setWidth(Math.max(9, Math.ceil(measure.current!.getBoundingClientRect().width)));
  }, [value]);
  return <div className="workspace-quick-pomo-popover" role="dialog" aria-label={label + '…'} ref={surface}>
    <div className="legacy-pomodoro-selection">
      <button type="button" className="legacy-pomodoro-minus" aria-label={label + ' −'} onMouseDown={event => event.preventDefault()} onClick={() => set(value - 1)} />
      <div className="legacy-pomodoro-value">
        <span className="legacy-pomodoro-icon" aria-hidden="true" />
        <input ref={input} className="legacy-pomodoro-input" type="number" min={0} max={1000} step={1} value={value} aria-label={label} style={{ width: width + 'px' }}
          onChange={event => { const next = Number.parseInt(event.target.value, 10); set(Number.isNaN(next) ? 0 : next); }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); close(); } }} />
      </div>
      <button type="button" className="legacy-pomodoro-plus" aria-label={label + ' +'} onMouseDown={event => event.preventDefault()} onClick={() => set(value + 1)} />
    </div>
    <span ref={measure} className="legacy-pomodoro-width" aria-hidden="true">{value}</span>
  </div>;
}
