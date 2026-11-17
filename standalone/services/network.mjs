import { ServiceError, invariant } from './errors.mjs';
export const wallpaperHosts = Object.freeze(['www.bing.com','bing.com','th.bing.com','bing.biturl.top']);
export function permitsRequest(input, origin, enabled) {
    try {
        const url = new URL(input, origin);
        if (url.origin === origin) return !url.pathname.includes('v63/user');
        return enabled && url.protocol === 'https:' && wallpaperHosts.includes(url.hostname) && !url.port && !url.username && !url.password;
    } catch (_) { return false; }
}
export function createNetworkService({ fetch: transport, origin, settings, setTimeout: schedule, clearTimeout: cancel }) {
    const controllers = new Set(); let disposed = false;
    const abortAll = () => { for (const controller of controllers) controller.abort(); };
    const unsubscribe = settings.subscribe(() => { if (!settings.getSnapshot().externalNetwork) abortAll(); });
    async function request(input, type = 'json', options = {}) {
        invariant(!disposed, 'Network service disposed', 'disposed');
        invariant(permitsRequest(input, origin, settings.getSnapshot().externalNetwork), 'External request blocked', 'network-blocked');
        invariant(['json','blob','text'].includes(type), 'Unknown response type');
        const url = new URL(input, origin), controller = new AbortController(); controllers.add(controller);
        const timeout = options.timeout ?? (type === 'blob' ? 20000 : 10000);
        invariant(Number.isFinite(timeout) && timeout > 0, 'Invalid network timeout');
        let timedOut = false, handle;
        const abort = () => controller.abort(options.signal?.reason);
        if (options.signal?.aborted) abort(); else options.signal?.addEventListener('abort', abort, { once: true });
        const aborted = new Promise((_, reject) => {
            const fail = () => reject(new ServiceError(timedOut ? 'timeout' : 'cancelled', timedOut ? 'Network request timed out' : 'Network request cancelled'));
            if (controller.signal.aborted) fail(); else controller.signal.addEventListener('abort', fail, { once: true });
        });
        const limit = type === 'blob' ? 10 * 1024 * 1024 : 256 * 1024;
        try {
            handle = schedule(() => { timedOut = true; controller.abort(); }, timeout);
            return await Promise.race([aborted, (async () => {
                const response = await transport(url.href, { signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
                invariant(response.ok && !response.redirected && (!response.url || new URL(response.url).href === url.href), 'Unexpected network response', 'network');
                invariant(Number(response.headers.get('content-length')) <= limit || !response.headers.get('content-length'), 'Response too large');
                let blob;
                if (response.body) {
                    const reader = response.body.getReader(), chunks = []; let length = 0;
                    try {
                        while (true) {
                            const part = await reader.read(); if (part.done) break;
                            length += part.value.byteLength;
                            if (length > limit) { await reader.cancel(); throw new ServiceError('validation','Response too large'); }
                            chunks.push(part.value);
                        }
                    } finally { reader.releaseLock(); }
                    blob = new Blob(chunks, { type: response.headers.get('content-type') || '' });
                } else { blob = await response.blob(); invariant(blob.size <= limit, 'Response too large'); }
                controller.signal.throwIfAborted();
                if (type === 'blob') return blob;
                const text = await blob.text(); return type === 'json' ? JSON.parse(text) : text;
            })()]);
        } finally { cancel(handle); options.signal?.removeEventListener('abort', abort); controllers.delete(controller); }
    }
    return Object.freeze({ request, permits: input => permitsRequest(input, origin, settings.getSnapshot().externalNetwork), cancel: abortAll,
        dispose() { disposed = true; unsubscribe(); abortAll(); } });
}
