import { createRoot } from 'react-dom/client';
import { App } from '../features/App';
import { ErrorBoundary } from '../features/ErrorBoundary';
import { legacyAsset } from '../features/workspace/LegacyIcon';
import { verifyIsolation } from '../services/isolation';
import { createBrowserServices, loadStartupSounds } from '../services/browser';
import { dataDatabaseName, dataStoragePrefix } from '../services/scoped-storage.mjs';
import '../styles/app.css';

type BootStep = 'entry' | 'styles' | 'data' | 'fonts' | 'icons' | 'sounds' | 'render';
declare const __APP_ISOLATED__: boolean;
declare global {
  interface Window {
    __prototypeBoot: {
      styles: Record<string, 'loaded'>;
      signal: AbortSignal;
      mark(step: BootStep): void;
      fail(step: BootStep, error?: unknown): void;
      finish(): void;
    };
  }
}
const boot = window.__prototypeBoot;
async function complete<T>(step: BootStep, load: () => Promise<T>) {
  try {
    boot.signal.throwIfAborted();
    const result = await load();
    boot.signal.throwIfAborted();
    boot.mark(step);
    return result;
  } catch (error) {
    boot.fail(step, error);
    throw error;
  }
}
async function waitForStyles() {
  await Promise.all(Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'), link => {
    if (boot.styles[link.href] === 'loaded') return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      link.addEventListener('load', () => resolve(), { once: true, signal: boot.signal });
      boot.signal.addEventListener('abort', () => reject(boot.signal.reason), { once: true });
    });
  }));
}
async function loadFonts(locale: string) {
  const faces = locale.startsWith('zh')
    ? ['400 14px "Noto Sans SC"', '500 14px "Noto Sans SC"', '400 14px DINCond']
    : ['400 14px "Focus Noto Sans"', '400 14px DINCond'];
  await Promise.all(faces.map(async face => {
    const loaded = await document.fonts.load(face);
    if (!loaded.length) throw new Error('Missing required font face');
  }));
}
async function loadIcons() {
  const brand = document.querySelector<HTMLImageElement>('#prototype-brand')!;
  await Promise.all([brand.decode(), ...['header-portrait','user-dropdown','header-forest','header-report','header-notification',
    'header-notification-highlight','header-setting','search-icon'].map(name => {
    const icon = new Image();
    icon.src = legacyAsset(name);
    return icon.decode();
  })]);
}

let dispose: (() => void) | undefined;
try {
  boot.mark('entry');
  await complete('styles', waitForStyles);
  const services = await complete('data', async () => {
    const scope = __APP_ISOLATED__
      ? { databaseName: dataDatabaseName, storagePrefix: dataStoragePrefix }
      : { databaseName: 'PomodoroDB6', storagePrefix: '' };
    if (__APP_ISOLATED__) await verifyIsolation(boot.signal, scope);
    else if (!['http:', 'https:'].includes(location.protocol)) throw new Error('Use an HTTP server');
    const core = await createBrowserServices(scope);
    if (boot.signal.aborted) core.dispose();
    else {
      dispose = () => { dispose = undefined; core.dispose(); };
      boot.signal.addEventListener('abort', () => dispose?.(), { once: true });
    }
    const { repository, ...services } = core;
    void repository;
    return services;
  });

  await Promise.all([
    complete('fonts', () => loadFonts(services.language.locale)),
    complete('icons', loadIcons),
    complete('sounds', () => loadStartupSounds(services.settings.getSnapshot(), boot.signal)),
  ]);

  const mount = document.getElementById('prototype-root')!;
  const root = createRoot(mount);
  const observer = new MutationObserver(() => {
    if (mount.querySelector('[data-testid="app-shell"]')) {
      boot.mark('render');
      boot.finish();
      observer.disconnect();
    }
  });
  observer.observe(mount, { childList: true, subtree: true });
  boot.signal.addEventListener('abort', () => { observer.disconnect(); root.unmount(); }, { once: true });
  root.render(<ErrorBoundary onError={error => queueMicrotask(() => boot.fail('render', error))}
    onRetry={() => location.reload()}><App services={services} /></ErrorBoundary>);
} catch (error) {
  dispose?.();
  boot.fail('render', error);
  console.error(error instanceof Error ? error.name : 'Startup failed');
}
