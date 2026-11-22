import { useLayoutEffect, useRef, type RefObject } from 'react';

export type DragHandoff = { rect: DOMRect; remove(): void };
type Position = { x: number; y: number };
/** Retarget from the painted positions, including any interrupted animation. */
export function useRowMotion(scope: RefObject<HTMLElement | null>, selector: string, attribute: string, verticalOnly = false) {
  const running = useRef(new Map<HTMLElement, Animation>());
  const pending = useRef<{
    order: string;
    positions: Map<string, Position & { element?: HTMLElement }>;
    active: string;
    focus: HTMLElement | null;
    handoff?: DragHandoff;
    waitForOrder: boolean;
  } | null>(null);

  const rows = () => Array.from(scope.current?.querySelectorAll<HTMLElement>(selector) || []);
  const id = (element: HTMLElement) => element.getAttribute(attribute)!;
  const order = (elements: HTMLElement[]) => JSON.stringify(elements.map(id));
  const point = (rect: DOMRect) => ({
    x: rect.left + (scope.current?.scrollLeft || 0),
    y: rect.top + (scope.current?.scrollTop || 0),
  });
  const offset = (element?: HTMLElement) => {
    if (!element || !running.current.has(element)) return { x: 0, y: 0 };
    // The animation timeline and the applied transform can sample different
    // frames. Use the same rendered transform as getBoundingClientRect().
    const transform = getComputedStyle(element).transform;
    if (transform === 'none') return { x: 0, y: 0 };
    const matrix = new DOMMatrixReadOnly(transform);
    return { x: matrix.m41, y: matrix.m42 };
  };
  const stop = (element: HTMLElement, animation: Animation) => {
    if (running.current.get(element) !== animation) return;
    animation.onfinish = animation.oncancel = null;
    animation.cancel();
    running.current.delete(element);
    delete element.dataset.reorderActive;
  };

  function capture(active: string, handoff?: DragHandoff, waitForOrder = false) {
    const previous = pending.current;
    if (previous?.handoff) {
      if (handoff) previous.handoff.remove();
      else { handoff = previous.handoff; active = previous.active; waitForOrder = false; }
    }
    const elements = rows();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const positions = new Map<string, Position & { element?: HTMLElement }>(reduced ? [] : elements.map(element => {
      const current = point(element.getBoundingClientRect());
      const translation = offset(element);
      return [id(element), { x: current.x - translation.x, y: current.y - translation.y, element }];
    }));
    if (handoff) positions.set(active, point(handoff.rect));
    const focus = document.activeElement;
    const capture = pending.current = { active, positions, order: order(elements), handoff, waitForOrder,
      focus: focus instanceof HTMLElement && scope.current?.contains(focus) ? focus : null };
    return () => {
      if (pending.current === capture) { handoff?.remove(); pending.current = null; }
    };
  }

  useLayoutEffect(() => {
    const previous = pending.current;
    if (!previous) return;
    const elements = rows();
    if (previous.waitForOrder && order(elements) === previous.order) return;
    pending.current = null;
    const firstPositions = new Map(Array.from(previous.positions, ([key, position]) => {
      const translation = offset(position.element);
      return [key, { x: position.x + translation.x, y: position.y + translation.y }];
    }));
    previous.handoff?.remove();
    for (const [element, animation] of running.current) stop(element, animation);
    if (previous.focus?.isConnected && document.activeElement === document.body) previous.focus.focus({ preventScroll: true });
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Read the destination geometry in one pass before applying transforms.
    const destinations = elements.map(element => [element, point(element.getBoundingClientRect())] as const);
    for (const [element, destination] of destinations) {
      const first = firstPositions.get(id(element));
      if (!first || element.dataset.dragging === 'true') continue;
      const x = verticalOnly ? 0 : first.x - destination.x, y = first.y - destination.y;
      if (Math.abs(x) < .5 && Math.abs(y) < .5) continue;
      if (id(element) === previous.active) element.dataset.reorderActive = 'true';
      const animation = element.animate([{ transform: `translate(${x}px,${y}px)` }, { transform: 'translate(0px,0px)' }],
        { duration: 180, easing: 'ease-out' });
      running.current.set(element, animation);
      animation.onfinish = animation.oncancel = () => stop(element, animation);
    }
  });

  useLayoutEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const reduce = () => { if (media.matches) for (const [element, animation] of running.current) stop(element, animation); };
    media.addEventListener('change', reduce);
    return () => {
      media.removeEventListener('change', reduce);
      pending.current?.handoff?.remove();
      pending.current = null;
      for (const [element, animation] of running.current) stop(element, animation);
    };
  }, []);

  return capture;
}
