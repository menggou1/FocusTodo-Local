import { confirmInApp } from './confirmation';
import type { PersistenceScope } from './isolation';
import type { PreferenceState } from './core.mjs';
import { createCoreServices } from './core.mjs';
import { createImageConverter } from './images.mjs';
import notificationIcon from '../../public/focus-app.ico?url';
import completeSound from '../../public/audio/Complete.m4a?inline';
import volumeTip from '../../public/audio/VolumeTip.wav?inline';
import volumeTipFile from '../../public/audio/VolumeTip.wav?url';

const embeddedVolumeTip = typeof OfflineAudioContext === 'function';
const sounds = import.meta.glob<string>(['../../public/audio/*', '!../../public/audio/VolumeTip.wav', '!../../public/audio/Complete.m4a'], { query: '?url', import: 'default', eager: true });
function inlineSound(file: string) {
    if (file === 'Complete.m4a') return completeSound;
    if (file === 'VolumeTip.wav' && embeddedVolumeTip) return volumeTip;
}
function soundURL(file: string) {
    // Keep the short WAV out of HTTP on full engines. Media-only ports such
    // as Windows WebKit lack Web Audio and require a real URL for playback.
    const url = inlineSound(file) ?? (file === 'VolumeTip.wav' ? volumeTipFile : sounds['../../public/audio/' + file]);
    if (!url) throw new Error('Unknown local audio asset');
    return url;
}

/** Fetch the complete built-in sounds needed by the current settings, without playing them. */
export async function loadStartupSounds(prefs: PreferenceState, signal: AbortSignal) {
    const files = new Set(['VolumeTip.wav', 'Complete.m4a']);
    for (const alarm of [prefs.workAlarm, prefs.breakAlarm]) {
        if (alarm !== 'alm_None' && sounds['../../public/audio/' + alarm + '.mp3']) files.add(alarm + '.mp3');
    }
    if (prefs.bgMusic !== 'bgm_Mute' && sounds['../../public/audio/' + prefs.bgMusic + '.m4a']) files.add(prefs.bgMusic + '.m4a');
    const decoder = embeddedVolumeTip ? new OfflineAudioContext(1, 1, 44100) : null;
    await Promise.all([...files].map(async file => {
        let bytes: Uint8Array<ArrayBuffer>;
        const embedded = inlineSound(file);
        if (embedded) {
            bytes = Uint8Array.from(atob(embedded.slice(embedded.indexOf(',') + 1)), char => char.charCodeAt(0));
        } else {
            const response = await fetch(soundURL(file), { signal });
            if (!response.ok) throw new Error('Required audio asset unavailable');
            bytes = new Uint8Array(await response.arrayBuffer());
        }
        signal.throwIfAborted();
        if (decoder) {
            const audio = await decoder.decodeAudioData(bytes.buffer);
            if (!audio.length) throw new Error('Empty audio asset');
        } else {
            // Some engines support HTML media but do not expose Web Audio.
            const tag = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
            const valid = file.endsWith('.wav') ? tag(0, 4) === 'RIFF' && tag(8, 4) === 'WAVE'
                : file.endsWith('.m4a') ? tag(4, 4) === 'ftyp'
                : tag(0, 3) === 'ID3' || bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
            if (!valid) throw new Error('Invalid audio asset');
        }
    }));
}

export function createBrowserServices(scope: PersistenceScope) {
    return createCoreServices({
        storage: localStorage, indexedDB, now: () => Date.now(), randomUUID: () => crypto.randomUUID(), random: () => Math.random(),
        ...scope, encodeBase64: value => btoa(unescape(encodeURIComponent(value))),
        decodeBase64: value => decodeURIComponent(escape(atob(value))), compression: window,
        locks: navigator.locks, channel: typeof BroadcastChannel === 'function' ? new BroadcastChannel(scope.databaseName + ':services') : null,
        languages: navigator.languages, origin: location.origin, fetch: (...args) => fetch(...args),
        createAudio: file => new Audio(soundURL(file)),
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
                if (!await confirmInApp('FocusTodo', document.documentElement.lang.startsWith('zh') ? '请确认完整备份已保存并可读取，然后继续覆盖。取消将保留当前数据。' : 'Confirm the complete backup has been saved and is readable before replacement. Cancel to preserve current data.')) throw Object.assign(new Error('Backup confirmation cancelled'), {code:'cancelled'});
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
