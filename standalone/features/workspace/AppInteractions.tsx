import { useLayoutEffect } from 'react';

/** CSS owns selection. Native image dragging also needs the HTML attribute in
 * Firefox; decorate only application images, preserving explicit drag sources.
 * No selectstart/dragstart cancellation: native editing and sorting stay native.
 */
export function observeApplicationImages(root:HTMLElement) {
    const roots='#prototype-root,[data-app-interaction-root]';
    function prepare(node:Node) {
      if (node.nodeType!==1) return;
      const element=node as Element,images=element.matches('img')?[element]:element.querySelectorAll('img');
      for(const image of images)if(image.closest(roots)&&!image.hasAttribute('draggable'))image.setAttribute('draggable','false');
    }
    prepare(root);
    const observer=new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)prepare(node)});
    observer.observe(root,{childList:true,subtree:true});
    return()=>observer.disconnect();
}
export function AppInteractions() {
  useLayoutEffect(()=>observeApplicationImages(document.body),[]);
  return null;
}
