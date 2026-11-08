import { invariant } from './errors.mjs';
/** A browser lock owns automatic background playback. No timeout steals it. */
export function createAudioService({ createAudio, locks, settings, visible, onError = () => {}, notice = () => {} }) {
    let background = null, audition = null, timerState = 'initial', suspended = false, disposed = false;
    let requesting = false, controller = null, release = null, failed = false, explained = false;
    const effects = new Set();
    const stop = audio => { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } };
    const report = error => { try { onError(error); } catch (_) { /* Observer. */ } };
    const play = (file, volume, loop) => {
        if (!/^[A-Za-z0-9_]+\.(mp3|m4a|wav|ogg)$/.test(file)) return null;
        const audio = createAudio(file); audio.volume = Math.max(0, Math.min(1, Number(volume) || 0)); audio.loop = loop;
        Promise.resolve(audio.play()).catch(report); return audio;
    };
    const stopBackground = () => { stop(background); background = null; controller?.abort(); if (release) { release(); release = null; } };
    function update() {
        const preferences = settings.getSnapshot(), file = preferences.bgMusic, volume = preferences.whiteNoiseVolume / 100;
        if (disposed || suspended || !visible() || audition || timerState !== 'work' || file === 'bgm_Mute' || volume <= 0) { stopBackground(); return; }
        if (background?.name === file) { background.volume = volume; if (background.paused) Promise.resolve(background.play()).catch(report); return; }
        if (background) stopBackground();
        if (failed || !locks?.request) {
            if (!explained) { explained = true; notice('Automatic background audio requires multi-tab ownership; manual playback remains available.'); }
            return;
        }
        if (!release) {
            if (requesting) return; requesting = true; const request = controller = new AbortController();
            Promise.resolve().then(() => locks.request('FocusTodoStandalone.background-audio', { signal: request.signal }, async () => {
                if (request.signal.aborted || disposed) return;
                await new Promise(resolve => { release = resolve; update(); });
            })).catch(error => {
                if (error.name !== 'AbortError') { failed = true; stopBackground(); report(error); }
            }).finally(() => { if (controller === request) controller = null; requesting = false; if (!failed) update(); });
            return;
        }
        background = play(file + '.m4a', volume, true); if (background) background.name = file;
    }
    const unsubscribe = settings.subscribe(update);
    return Object.freeze({
        update,
        setTimerState(state) { timerState = state; update(); },
        effect(file, volume = settings.getSnapshot().ringtoneVolume / 100) {
            invariant(!disposed, 'Audio service disposed', 'disposed');
            const audio = play(file, volume, false);
            if (audio) { effects.add(audio); audio.onended = audio.onerror = () => { effects.delete(audio); stop(audio); }; }
        },
        audition(file, volume = 1) {
            invariant(!disposed, 'Audio service disposed', 'disposed'); stopBackground(); stop(audition); audition = play(file, volume, false);
            if (audition) audition.onended = audition.onerror = () => { stop(audition); audition = null; update(); };
        },
        auditionVolume(value) { if (audition) audition.volume = Math.max(0, Math.min(1, value)); },
        stopAudition() { stop(audition); audition = null; update(); },
        suspend() { suspended = true; stopBackground(); stop(audition); audition = null; effects.forEach(stop); effects.clear(); },
        resume() { suspended = false; update(); },
        dispose() { disposed = true; unsubscribe(); stopBackground(); stop(audition); effects.forEach(stop); effects.clear(); },
    });
}
