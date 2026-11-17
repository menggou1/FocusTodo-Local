import { sameValue } from './errors.mjs';
/** Persistence owns the timer. UI subscribers see committed snapshots only. */
export function createTimerService({ data, core, now, randomUUID, onError = () => {}, onCommit = () => {} }) {
    let snapshot = null, disposed = false, tail = Promise.resolve();
    const listeners = new Set();
    const freeze = value => {
        if (value && typeof value === 'object') {
            Object.values(value).forEach(freeze);
            Object.freeze(value);
        }
        return value;
    };
    const publish = value => {
        if (disposed || sameValue(snapshot, value)) return;
        snapshot = freeze(structuredClone(value));
        for (const listener of listeners) {
            try { listener(); } catch (error) { try { onError(error); } catch (_) { /* Observer only. */ } }
        }
    };
    const enqueue = body => {
        const run = () => {
            if (disposed) throw new Error('Timer service closed');
            return body();
        };
        const result = tail.then(run, run);
        tail = result.catch(() => {});
        return result;
    };
    return Object.freeze({
        getSnapshot: () => snapshot,
        subscribe(listener) {
            if (disposed) throw new Error('Timer service closed');
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        refresh: () => enqueue(async () => { publish(await data.session()); return snapshot; }),
        recover: () => enqueue(async () => {
            const session = await data.session();
            // A short reload advances normally; long/negative gaps enter the
            // core's confirmation state. Nothing fabricates wall-clock time.
            if (session && core.running(session)) {
                const result = await data.timerAction({ type: 'tick', expectedSession: session.sessionId }, now());
                publish(result.session);
                try { onCommit(result); } catch (error) { try { onError(error); } catch (_) { /* Observer. */ } }
            } else publish(session);
            return snapshot;
        }),
        command: action => {
            const input = structuredClone(action);
            return enqueue(async () => {
                if (!input.sessionId) input.sessionId = randomUUID();
                const result = await data.timerAction(input, now());
                publish(result.session);
                try { onCommit(result); } catch (error) { try { onError(error); } catch (_) { /* Observer. */ } }
                return result;
            });
        },
        view: () => snapshot ? core.view(snapshot, now()) : null,
        dispose() { disposed = true; listeners.clear(); },
    });
}
