import { createRoot } from 'react-dom/client';
import { App } from '../features/App';
import { ErrorBoundary } from '../features/ErrorBoundary';
import { verifyIsolation } from '../services/isolation';
import { createBrowserServices } from '../services/browser';
import { versionMetadata } from '../domain/version';
import '../styles/app.css';

const abort = new AbortController();
const startup = document.getElementById('prototype-startup')!;
declare const __LOCAL_VERSION__: string;
declare const __SOURCE_VERSION__: string;
declare global {
  interface Window {
    __prototypeBoot: { styles: Record<string, 'loaded' | 'error'>; failed: boolean; fail?: () => void };
  }
}
try {
  await Promise.all(Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).map(link => {
    if (window.__prototypeBoot.styles[link.href] === 'loaded') return Promise.resolve();
    if (window.__prototypeBoot.failed) return Promise.reject(new Error('Required stylesheet failed'));
    return new Promise<void>((resolve, reject) => {
      link.addEventListener('load', () => resolve(), { once: true });
      link.addEventListener('error', () => reject(new Error('Required stylesheet failed')), { once: true });
    });
  }));
  if (window.__prototypeBoot.failed || startup.dataset.state === 'error') throw new Error('Required resource failed');
  await verifyIsolation(abort.signal, true);
  const core = await createBrowserServices(versionMetadata(__LOCAL_VERSION__, __SOURCE_VERSION__).appVersion);
  const { repository, ...services } = core;
  void repository;
  const root = createRoot(document.getElementById('prototype-root')!);
  root.render(<ErrorBoundary onRetry={() => location.reload()}><App services={services} /></ErrorBoundary>);
  // React acknowledges the commit; a render failure leaves the independent fallback visible.
  const observer = new MutationObserver(() => {
    if (!document.querySelector('[data-testid="app-shell"], [data-testid="error-boundary"]')) return;
    startup.hidden = true;
    observer.disconnect();
  });
  observer.observe(document.getElementById('prototype-root')!, { childList: true, subtree: true });
  addEventListener('pagehide', event => {
    if (event.persisted) return;
    abort.abort(); services.dispose(); observer.disconnect(); root.unmount();
  });
} catch (error) {
  startup.dataset.state = 'error';
  document.getElementById('prototype-status')!.textContent = navigator.language.startsWith('zh')
    ? '无法启动独立应用预览。请使用全新浏览器上下文和候选服务器；已有数据未更改。'
    : 'Cannot start the independent app preview. Use a fresh browser context and the preview server; existing data was not changed.';
  document.getElementById('prototype-retry')!.hidden = false;
  console.error(error instanceof Error ? error.name : 'Prototype startup failed');
}
