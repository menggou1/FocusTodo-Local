import { invariant, snapshotSource } from './errors.mjs';
export function createNotificationService({ api, focus, onError, icon = './favicon.ico' }) {
    let disposed = false; const active = new Set(), state = snapshotSource(api?.permission || 'unavailable', onError);
    const refresh = () => { state.publish(api?.permission || 'unavailable'); return state.getSnapshot(); };
    return Object.freeze({
        getSnapshot: state.getSnapshot, subscribe: state.subscribe, refresh,
        async requestPermission() { invariant(!disposed && api, 'Notifications unavailable'); await api.requestPermission(); return refresh(); },
        show(title, body) {
            invariant(!disposed, 'Notification service disposed', 'disposed');
            if (api?.permission !== 'granted') return false;
            const notification = new api(title, { body, icon }); active.add(notification);
            notification.onclick = () => { focus(); notification.close(); active.delete(notification); };
            notification.onclose = () => active.delete(notification); return true;
        },
        dispose() { disposed = true; for (const notification of active) notification.close(); active.clear(); state.dispose(); },
    });
}
export function createReminderService({ business, storage, data, notifications, now, setTimeout: schedule, clearTimeout: cancel, onError }) {
    const key = 'FocusTodo.taskRemindersRead', announced = new Set(), state = snapshotSource({ due: [], unread: [], next: Infinity }, onError);
    let handle, disposed = false;
    const seen = () => { try { const value = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; } };
    const refresh = (notify = false) => {
        if (disposed) return; cancel(handle);
        const result = business.reminders(seen()); state.publish(result);
        if (notify) for (const task of result.unread) {
            const identity = JSON.stringify([task.id, task.reminderDate]);
            if (!announced.has(identity)) { notifications.show('任务到时提醒', task.name); announced.add(identity); }
        }
        const delay = Number.isFinite(result.next) ? Math.min(Math.max(1, result.next - now()), 86400000) : 86400000;
        handle = schedule(() => refresh(true), delay); return state.getSnapshot();
    };
    const unsubscribe = business.subscribe(() => refresh(true));
    return Object.freeze({
        getSnapshot: state.getSnapshot, subscribe: state.subscribe, refresh,
        async markRead() {
            const values = new Set(seen()); for (const task of business.reminders([]).due) values.add(JSON.stringify([task.id, task.reminderDate]));
            await data.themeStorageOperation(() => storage.setItem(key, JSON.stringify([...values]))); return refresh();
        },
        dispose() { disposed = true; cancel(handle); unsubscribe(); state.dispose(); },
    });
}
