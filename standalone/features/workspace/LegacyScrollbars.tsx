import { useLayoutEffect } from 'react';

/** The 1.9.3 ScrollView overlay, applied only to its migrated scroll regions.
 * Native scrolling remains on the original element; only its paint is replaced.
 */
export function LegacyScrollbars() {
  useLayoutEffect(() => {
    const bound = new Map<HTMLElement, { dispose(): void; refresh(): void }>();
    const selectors = '.workspace-content:not(.calendar-content),.workspace-details,.workspace-projects,.legacy-settings-content,.legacy-report-overlay>.domain-overlay-body,[data-timer-scroll]';
    function bind(view: HTMLElement) {
      const track = document.createElement('div'), thumb = document.createElement('div');
      track.className = 'legacy-scroll-track'; thumb.className = 'legacy-scroll-thumb';
      track.append(thumb); view.parentElement!.append(track); view.classList.add('legacy-scroll-view');
      let timer: ReturnType<typeof setTimeout> | undefined, dragging = false, startY = 0, startScroll = 0, travel = 0, maxScroll = 0;
      function clear() { clearTimeout(timer); }
      function hide() { clear(); if (!dragging) { track.dataset.visible = 'false'; track.dataset.highlight = 'false'; } }
      function show(highlight: boolean, timeout = true) {
        if (view.dataset.timerScrollbar === 'hidden') return;
        clear(); track.dataset.visible = 'true'; track.dataset.highlight = String(highlight);
        if (timeout) timer = setTimeout(hide, 1000);
      }
      function update() {
        // Timer's hidden tracks never paint or accept input. Avoid forcing
        // layout on every frame of its rail-width transition for these tracks.
        if (view.dataset.timerScrollbar === 'hidden') return;
        const r = view.getBoundingClientRect(), height = Math.max(view.clientHeight / view.scrollHeight * view.clientHeight, 30);
        maxScroll = view.scrollHeight - view.clientHeight; travel = Math.max(view.clientHeight - height, 0);
        track.hidden = maxScroll <= 1;
        Object.assign(track.style, { left: r.right - 8 + 'px', top: r.top + 'px', height: view.clientHeight + 'px' });
        thumb.style.height = height + 'px'; thumb.style.transform = `translateY(${maxScroll > 0 ? travel * view.scrollTop / maxScroll : 0}px)`;
      }
      const move = (e: MouseEvent) => { if (Math.abs(view.getBoundingClientRect().right - e.clientX) < 10) show(true); else if (track.dataset.highlight === 'true') show(false); };
      const wheel = (e: WheelEvent) => { e.stopPropagation(); show(Math.abs(view.getBoundingClientRect().right - e.clientX) < 10); };
      const enterTrack = () => show(true, false), leaveTrack = () => { if (!dragging) show(false); };
      const drag = (e: PointerEvent) => { if (dragging && travel > 0) { e.preventDefault(); view.scrollTop = Math.max(0, Math.min(maxScroll, startScroll + (e.clientY - startY) * maxScroll / travel)); update(); } };
      const end = () => { dragging = false; show(true); };
      const down = (e: PointerEvent) => { if (e.button !== 0) return; e.preventDefault(); dragging = true; startY = e.clientY; startScroll = view.scrollTop; thumb.setPointerCapture(e.pointerId); show(true, false); };
      view.addEventListener('mousemove', move); view.addEventListener('mouseleave', hide); view.addEventListener('wheel', wheel, { passive: true }); view.addEventListener('scroll', update);
      track.addEventListener('mouseenter', enterTrack); track.addEventListener('mousemove', enterTrack); track.addEventListener('mouseleave', leaveTrack);
      thumb.addEventListener('pointerdown', down); thumb.addEventListener('pointermove', drag); thumb.addEventListener('pointerup', end); thumb.addEventListener('pointercancel', end);
      const resize = new ResizeObserver(update); resize.observe(view); for (const child of view.children) resize.observe(child);
      window.addEventListener('resize', update); window.addEventListener('scroll', update, true); update();
      return { refresh: update, dispose() { clear(); resize.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); view.classList.remove('legacy-scroll-view'); track.remove(); view.removeEventListener('mousemove', move); view.removeEventListener('mouseleave', hide); view.removeEventListener('wheel', wheel); view.removeEventListener('scroll', update); } };
    }
    function sync() {
      for (const [view, binding] of bound) if (!view.isConnected || !view.matches(selectors)) { binding.dispose(); bound.delete(view); }
      document.querySelectorAll<HTMLElement>(selectors).forEach(view => { if (!bound.has(view)) bound.set(view, bind(view)); else bound.get(view)!.refresh(); });
    }
    const observer = new MutationObserver(sync); observer.observe(document.getElementById('prototype-root')!, { childList: true, subtree: true }); sync();
    return () => { observer.disconnect(); for (const binding of bound.values()) binding.dispose(); };
  }, []);
  return null;
}
