import { useLayoutEffect } from 'react';

/** The 1.9.3 ScrollView overlay, applied only to its migrated scroll regions.
 * Native scrolling remains on the original element; only its paint is replaced.
 */
export function LegacyScrollbars() {
  useLayoutEffect(() => {
    const bound = new Map<HTMLElement, { dispose(): void; refresh(): void }>();
    const selectors = '.workspace-task-scroll,.workspace-details-info,.workspace-projects,.legacy-settings-content,.legacy-settings-project-rows,.legacy-report-overlay>.domain-overlay-body,[data-timer-scroll],[data-forest-scroll],.legacy-record-duration-picker,.legacy-record-task-scroll,.legacy-record-project-scroll,.legacy-tags-options,.legacy-record-inspector-content>form,.workspace-picker-surface .legacy-project-options,.legacy-calendar-project-menu,.legacy-folder-lists';
    function bind(view: HTMLElement) {
      const track = document.createElement('div'), thumb = document.createElement('div');
      track.className = 'legacy-scroll-track'; thumb.className = 'legacy-scroll-thumb';
      track.append(thumb); view.parentElement!.append(track); view.classList.add('legacy-scroll-view');
      // Forest has the original relative ScrollView wrapper. Its track must
      // travel with the drawer, rather than use viewport coordinates while the
      // transformed ancestor establishes a different fixed containing block.
      const forest = view.hasAttribute('data-forest-scroll');
      if (forest) track.classList.add('legacy-forest-scroll-track');
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
        Object.assign(track.style, forest ? { right: '2px', top: '0px', height: view.clientHeight + 'px' } : { left: r.right - 8 + 'px', top: r.top + 'px', height: view.clientHeight + 'px' });
        thumb.style.height = height + 'px'; thumb.style.transform = `translateY(${maxScroll > 0 ? travel * view.scrollTop / maxScroll : 0}px)`;
      }
      const move = (e: MouseEvent) => { if(view.dataset.timerScrollbar==='hidden')return;if (Math.abs(view.getBoundingClientRect().right - e.clientX) < 10) show(true); else if (track.dataset.highlight === 'true') show(false); };
      const wheel = (e: WheelEvent) => { e.stopPropagation();if(view.dataset.timerScrollbar==='hidden')return;show(Math.abs(view.getBoundingClientRect().right - e.clientX) < 10); };
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
    function sync(records?:MutationRecord[]) {
      // Rail children are absolutely positioned over the workspace: their
      // mount/unmount cannot move the underlying workspace scroll regions.
      const timerOnly=!!records?.length&&records.every(record=>record.target instanceof Element&&!!record.target.closest('.legacy-timer-widget-rail'));
      for (const [view, binding] of bound) if (!view.isConnected || !view.matches(selectors)) { binding.dispose(); bound.delete(view); }
      document.querySelectorAll<HTMLElement>(selectors).forEach(view => { if (!bound.has(view)) bound.set(view, bind(view)); else if(!timerOnly||view.closest('.legacy-timer-widget-rail'))bound.get(view)!.refresh(); });
    }
    const observer = new MutationObserver(sync); observer.observe(document.body, { childList: true, subtree: true }); sync();
    return () => { observer.disconnect(); for (const binding of bound.values()) binding.dispose(); };
  }, []);
  return null;
}
