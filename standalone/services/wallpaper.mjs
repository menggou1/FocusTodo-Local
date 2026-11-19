import { invariant, snapshotSource } from './errors.mjs';
const bingId = '__bing_daily__';

export function createWallpaperService({ themes, settings, network, image, parseImage, now, randomUUID }) {
    let revision = 0, pending = null, disposed = false;
    const state = snapshotSource({ loading: false, version: 0 });
    const publish = changes => state.publish({ ...state.getSnapshot(), ...changes });
    const read = (raw = themes.read().themes) => { const value = raw === null ? {} : JSON.parse(raw); invariant(value && typeof value === 'object' && !Array.isArray(value), 'Invalid theme library'); return value; };
    const fresh = row => {
        const time = now();
        return row?.dataUrl && row.updatedAt <= time && time - row.updatedAt < 43200000
            && new Date(row.updatedAt).toDateString() === new Date(time).toDateString();
    };
    const cancel = () => { revision++; pending?.controller.abort(); pending = null; publish({ loading: false }); };
    const unsubscribe = settings.subscribe(() => { if (!settings.getSnapshot().externalNetwork) cancel(); });
    const save = async (update, token, stillCurrent = () => true) => {
        const guard = () => !disposed && token === revision && stillCurrent();
        invariant(guard(), 'Wallpaper operation cancelled', 'cancelled');
        const result = await themes.commit(update, guard);
        publish({ version: state.getSnapshot().version + 1 }); return result;
    };
    const libraryJSON = value => {
        const raw = JSON.stringify(value);
        invariant(raw.length <= 2 * 1024 * 1024 || raw.length < (themes.read().themes || '').length, 'Custom themes exceed storage limit'); return raw;
    };
    async function loadBing(cached, activate, stillCurrent) {
        if (pending) return pending.promise;
        const token = ++revision;
        const controller = new AbortController();
        const promise = Promise.resolve().then(async () => {
            if (activate && cached?.dataUrl) {
                await save({ active: bingId, theme: bingId }, token);
                if (fresh(cached)) return cached;
            }
            let metadata;
            for (const endpoint of ['https://bing.biturl.top/?format=json&index=0&mkt=zh-CN','https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=1&mkt=zh-CN']) {
                try { metadata = parseImage(await network.request(endpoint, 'json', { signal: controller.signal })); if (metadata) break; }
                catch (error) { if (controller.signal.aborted || !settings.getSnapshot().externalNetwork) throw error; }
            }
            invariant(metadata, 'All wallpaper endpoints failed', 'network');
            const blob = await network.request(metadata.url, 'blob', { signal: controller.signal });
            invariant(/^image\/(jpeg|png|webp)$/.test(blob.type), 'Invalid wallpaper type');
            const converted = await image(blob, {thumbnailFromCompressed:true});
            invariant(token === revision && settings.getSnapshot().externalNetwork, 'Wallpaper operation cancelled', 'cancelled');
            const rows = read(), value = { ...converted, name: 'Bing每日壁纸', type: 'bing', updatedAt: now(), copyright: metadata.copyright };
            rows[bingId] = value;
            await save({ themes: libraryJSON(rows), ...(activate ? { active: bingId, theme: bingId } : {}) }, token, stillCurrent);
            return value;
        }).finally(() => { if (pending?.controller === controller) { pending = null; publish({ loading: false }); } });
        pending = { promise, controller };
        publish({ loading: true });
        return promise;
    }
    return Object.freeze({
        read: () => read(), fresh, cancel, subscribe: state.subscribe, getSnapshot: state.getSnapshot,
        async add(blob, name = '') {
            cancel(); const token = revision;
            invariant(blob.size <= 10 * 1024 * 1024 && /^image\//.test(blob.type), 'Invalid theme image');
            const converted = await image(blob); const id = 'custom_' + randomUUID();
            const rows = read(); rows[id] = { ...converted, name, originalName: name, createdAt: now(), type: 'custom' };
            await save({ themes: libraryJSON(rows), active: id, theme: id }, token); return id;
        },
        async select(id) {
            if (themes.read().active === id) return;
            cancel(); const rows = read(); invariant(rows[id]?.dataUrl, 'Missing theme image');
            await save({ active: id, theme: id }, revision);
        },
        async classic(id) { if (!themes.read().active && (themes.read().theme === 'Sea' ? 'Ocean' : themes.read().theme || 'Leaf') === id) return; cancel(); invariant(typeof id === 'string' && !id.startsWith('custom_') && id !== bingId, 'Invalid classic theme'); await save({ active: null, theme: id }, revision); },
        async remove(id) {
            cancel(); const rows = read(); invariant(rows[id], 'Theme no longer exists'); delete rows[id];
            const active = themes.read().active === id;
            await save({ themes: libraryJSON(rows), ...(active ? { active: null, theme: 'Leaf' } : {}) }, revision);
        },
        async bing() {
            invariant(!disposed, 'Wallpaper service disposed', 'disposed');
            invariant(settings.getSnapshot().externalNetwork, 'External networking is disabled', 'network-blocked');
            return pending?.promise ?? loadBing(read()[bingId], true);
        },
        async refreshActive() {
            if (disposed || pending || !settings.getSnapshot().externalNetwork) return;
            const original = themes.read();
            if (original.active !== bingId) return;
            const cached = read(original.themes)[bingId];
            if (fresh(cached)) return;
            return loadBing(cached, false, () => {
                const current = themes.read();
                return current.active === bingId && current.themes === original.themes;
            });
        },
        dispose() { disposed = true; cancel(); unsubscribe(); state.dispose(); },
    });
}
