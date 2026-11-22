import { useLayoutEffect } from 'react';

/** The 1.9.3 ScrollView overlay, applied only to its migrated scroll regions.
 * Native scrolling remains on the original element; only its paint is replaced.
 */
export function LegacyScrollbars() {
  useLayoutEffect(() => {
    const bound = new Map<HTMLElement, { dispose(): void; refresh(): void }>();
    const selectors = '.legacy-settings-menu,.legacy-notification-scroll,[data-local-scroll],.workspace-task-scroll,.workspace-details-info,.workspace-projects,.legacy-settings-content,.legacy-settings-project-rows,.legacy-report-overlay>.domain-overlay-body,[data-timer-scroll],[data-forest-scroll],.legacy-record-duration-picker,.legacy-record-task-scroll,.legacy-record-project-scroll,.legacy-tags-options,.legacy-record-inspector-content>form,.workspace-picker-surface .legacy-project-options,.legacy-calendar-project-menu,.legacy-folder-lists,.legacy-review-scroll,.legacy-focus-items,.legacy-doughnut-legend';
    function bind(view: HTMLElement) {
      const track = document.createElement('div'), thumb = document.createElement('div');
      track.className = 'legacy-scroll-track'; thumb.className = 'legacy-scroll-thumb';
      track.append(thumb); view.parentElement!.append(track); view.classList.add('legacy-scroll-view');
      // Wrapped tracks share their scroll region's coordinates in moving drawers and dialogs.
      const local = view.matches('[data-local-scroll],[data-forest-scroll]');
      if (local) track.classList.add('legacy-local-scroll-track');
      let timer: ReturnType<typeof setTimeout> | undefined, dragging = false, startY = 0, startScroll = 0, travel = 0, maxScroll = 0;
      function positionThumb() {
        if (view.dataset.timerScrollbar === 'hidden') return;
        thumb.style.transform = `translateY(${maxScroll > 0 ? travel * view.scrollTop / maxScroll : 0}px)`;
      }
      function positionTrack() {
        const rect = view.getBoundingClientRect();
        track.style.left = rect.right - 8 + 'px';
        track.style.top = rect.top + 'px';
      }
      function ancestorScroll(event: Event) {
        if (view.dataset.timerScrollbar !== 'hidden' && event.target !== view && event.target instanceof Node && event.target.contains(view)) positionTrack();
      }
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
        const viewport = view.clientHeight, content = view.scrollHeight;
        const height = Math.min(viewport, Math.max(content ? viewport * viewport / content : 0, 30));
        maxScroll = content - viewport; travel = viewport - height;
        track.hidden = maxScroll <= 1;
        if (local) Object.assign(track.style, { right: '2px', top: '0px' }); else positionTrack();
        track.style.height = viewport + 'px'; thumb.style.height = height + 'px'; positionThumb();
      }
      const move = (e: MouseEvent) => { if(view.dataset.timerScrollbar==='hidden')return;if (Math.abs(view.getBoundingClientRect().right - e.clientX) < 10) show(true); else if (track.dataset.highlight === 'true') show(false); };
      const wheel = (e: WheelEvent) => { e.stopPropagation();if(view.dataset.timerScrollbar==='hidden')return;show(Math.abs(view.getBoundingClientRect().right - e.clientX) < 10); };
      const enterTrack = () => show(true, false), leaveTrack = () => { if (!dragging) show(false); };
      const drag = (e: PointerEvent) => { if (dragging && travel > 0) { e.preventDefault(); view.scrollTop = Math.max(0, Math.min(maxScroll, startScroll + (e.clientY - startY) * maxScroll / travel)); } };
      const end = () => { dragging = false; show(true); };
      const down = (e: PointerEvent) => { if (e.button !== 0) return; e.preventDefault(); dragging = true; startY = e.clientY; startScroll = view.scrollTop; thumb.setPointerCapture(e.pointerId); show(true, false); };
      view.addEventListener('mousemove', move); view.addEventListener('mouseleave', hide); view.addEventListener('wheel', wheel, { passive: true }); view.addEventListener('scroll', positionThumb);
      track.addEventListener('mouseenter', enterTrack); track.addEventListener('mousemove', enterTrack); track.addEventListener('mouseleave', leaveTrack);
      thumb.addEventListener('pointerdown', down); thumb.addEventListener('pointermove', drag); thumb.addEventListener('pointerup', end); thumb.addEventListener('pointercancel', end);
      const resize = new ResizeObserver(update); resize.observe(view); for (const child of view.children) resize.observe(child);
      window.addEventListener('resize', update); if (!local) window.addEventListener('scroll', ancestorScroll, true); update();
      return { refresh: update, dispose() { clear(); resize.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', ancestorScroll, true); view.classList.remove('legacy-scroll-view'); track.remove(); view.removeEventListener('mousemove', move); view.removeEventListener('mouseleave', hide); view.removeEventListener('wheel', wheel); view.removeEventListener('scroll', positionThumb); } };
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
