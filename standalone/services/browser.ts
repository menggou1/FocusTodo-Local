import { createCoreServices } from './core.mjs';
import { createImageConverter } from './images.mjs';
import notificationIcon from '../../public/favicon.ico?url';

const sounds = import.meta.glob<string>('../../public/audio/*', { query: '?url', import: 'default', eager: true });
export function createBrowserServices(appVersion: string) {
    return createCoreServices({
        storage: localStorage, indexedDB, now: () => Date.now(), randomUUID: () => crypto.randomUUID(), random: () => Math.random(),
        appVersion, encodeBase64: value => btoa(unescape(encodeURIComponent(value))),
        decodeBase64: value => decodeURIComponent(escape(atob(value))), compression: window,
        locks: navigator.locks, channel: typeof BroadcastChannel === 'function' ? new BroadcastChannel('FocusTodoStandalone.PomodoroDB6:services') : null,
        languages: navigator.languages, origin: location.origin, fetch: (...args) => fetch(...args),
        createAudio(file) { const url = sounds['../../public/audio/' + file]; if (!url) throw new Error('Unknown local audio asset'); return new Audio(url); },
        notification: typeof Notification === 'function' ? Notification : undefined,
        notificationIcon,
        visible: () => !document.hidden, focus: () => window.focus(),
        image: createImageConverter({ createImage: () => new Image(), createCanvas: () => document.createElement('canvas'),
            createObjectURL: blob => URL.createObjectURL(blob), revokeObjectURL: url => URL.revokeObjectURL(url),
            setTimeout: (callback, delay) => window.setTimeout(callback, delay), clearTimeout: handle => window.clearTimeout(handle as number) }),
        async saveBackup(snapshot, prefix) {
            const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot)], { type: 'application/json' }));
            try { const link = document.createElement('a'); link.href = url; link.download = prefix + '-' + Date.now() + '.json';
                document.body.appendChild(link); link.click(); link.remove();
                if (!window.confirm(document.documentElement.lang.startsWith('zh') ? '请确认完整备份已保存并可读取，然后继续覆盖。取消将保留当前数据。' : 'Confirm the complete backup has been saved and is readable before replacement. Cancel to preserve current data.')) throw Object.assign(new Error('Backup confirmation cancelled'), {code:'cancelled'});
            } finally { window.setTimeout(() => URL.revokeObjectURL(url), 30000); }
        },
        observe(handlers) {
            const entries: [EventTarget, string, EventListener][] = [
                [window, 'storage', handlers.refresh], [window, 'focus', handlers.refresh],
                [document, 'visibilitychange', handlers.visibility],
                [window, 'pagehide', handlers.suspend], [window, 'pageshow', handlers.resume],
                [document, 'pointerdown', handlers.visibility],
            ];
            for (const [target, name, callback] of entries) target.addEventListener(name, callback);
            return () => { for (const [target, name, callback] of entries) target.removeEventListener(name, callback); };
        },
    });
}
