import { invariant, snapshotSource } from './errors.mjs';
import { reminderIdentity } from '../domain/reports.mjs';
export function createNotificationService({ api, focus, onError, icon }) {
    let disposed = false; const active = new Set(), state = snapshotSource(api?.permission || 'unavailable', onError);
    const refresh = () => { state.publish(api?.permission || 'unavailable'); return state.getSnapshot(); };
    return Object.freeze({
        getSnapshot: state.getSnapshot, subscribe: state.subscribe, refresh,
        async requestPermission() { invariant(!disposed && api, 'Notifications unavailable'); await api.requestPermission(); return refresh(); },
        show(title, body) {
            invariant(!disposed, 'Notification service disposed', 'disposed');
            if (api?.permission !== 'granted') return false;
            let notification;
            try { notification = new api(title, { body, icon }); }
            catch (error) {
                try { onError?.(error); } catch (_) { /* Observer only. */ }
                return false;
            }
            active.add(notification);
            notification.onclick = () => { focus(); notification.close(); active.delete(notification); };
            notification.onclose = () => active.delete(notification); return true;
        },
        dispose() { disposed = true; for (const notification of active) notification.close(); active.clear(); state.dispose(); },
    });
}
export function createReminderService({ business, storage, data, notifications, now, setTimeout: schedule, clearTimeout: cancel, onError, title = () => '任务到时提醒' }) {
    const key = 'FocusTodo.taskRemindersRead', attempted = new Set(), state = snapshotSource({ due: [], unread: [], next: Infinity }, onError);
    let handle, disposed = false;
    const seen = () => { try { const value = JSON.parse(storage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch (_) { return []; } };
    const refresh = (notify = false) => {
        if (disposed) return; cancel(handle);
        const result = business.reminders(seen()); state.publish(result);
        const delay = Number.isFinite(result.next) ? Math.min(Math.max(1, result.next - now()), 86400000) : 86400000;
        handle = schedule(() => refresh(true), delay);
        if (notify) for (const task of result.unread) {
            const identity = reminderIdentity(task);
            if (attempted.has(identity)) continue;
            // An unsuccessful system notification stays unread in the app.
            attempted.add(identity);
            try { notifications.show(title(), task.name); }
            catch (error) { try { onError?.(error); } catch (_) { /* Observer only. */ } }
        }
        return state.getSnapshot();
    };
    const unsubscribe = business.subscribe(() => refresh(true));
    return Object.freeze({
        getSnapshot: state.getSnapshot, subscribe: state.subscribe, refresh,
        async markRead() {
            const due = business.reminders([]).due.map(reminderIdentity);
            await data.themeStorageOperation(() => {
                const read = new Set(seen());
                for (const id of due) read.add(id);
                storage.setItem(key, JSON.stringify([...read]));
            });
            return refresh();
        },
        dispose() { disposed = true; cancel(handle); unsubscribe(); state.dispose(); },
    });
}
