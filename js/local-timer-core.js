/* FocusTodo official 7.1.1, local timer core | Lexible
 * Pure timer transitions. Times are epoch milliseconds; durations are seconds.
 * No browser, storage or UI side effects: the caller commits records + state together.
 */
(function (root, factory) {
    var api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FocusTimerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';
    const GAP_MS = 5 * 60 * 1000;
    const MAX_INTERVAL = 8 * 3600;
    const running = s => s.state === 'work' || s.state === 'rest';
    const clone = value => JSON.parse(JSON.stringify(value));
    function duration(value, fallback) {
        value = Number(value);
        return Number.isFinite(value) && value >= 1 && value <= MAX_INTERVAL ? Math.round(value) : fallback;
    }
    function settings(input) {
        input = input || {};
        return {
            interval: duration(input.interval, 1500),
            shortBreak: duration(input.shortBreak, 300), longBreak: duration(input.longBreak, 900),
            longEvery: Math.max(1, Math.min(100, Math.round(Number(input.longEvery) || 4))),
            autoWork: !!input.autoWork, autoBreak: !!input.autoBreak, banBreak: !!input.banBreak
        };
    }
    function create(input, now) {
        return {
            id: 'active', sessionId: input.sessionId, revision: 0, state: 'initial',
            mode: input.mode === 'countdown' ? 'countdown' : 'countup',
            taskId: input.taskId || '', subtaskId: input.subtaskId || '',
            config: settings(input.config), cursorAt: now, observedAt: now,
            phaseElapsed: 0, totalSeconds: 0, recordedSeconds: 0,
            spans: [], sequence: 0, blockSequence: 0,
            completed: Number(input.completed) || 0, pendingRecovery: null
        };
    }
    function append(s, start, end) {
        if (end <= start) return;
        const last = s.spans[s.spans.length - 1];
        if (last && last.end === start) last.end = end;
        else s.spans.push({ start, end });
    }
    function pendingSeconds(s) { return s.spans.reduce((n, p) => n + (p.end - p.start) / 1000, 0); }
    function emit(s, amount, rows) {
        if (amount < 0.001) return;
        if (rows.length >= 20000) throw new Error('恢复记录过多，请缩短截止时间后分批处理。');
        const blockId = s.sessionId + ':block:' + (++s.blockSequence);
        let remaining = amount;
        while (remaining > 0.000001 && s.spans.length) {
            const span = s.spans[0];
            const part = Math.min(remaining, (span.end - span.start) / 1000);
            const end = span.start + part * 1000;
            rows.push({
                id: s.sessionId + ':' + (++s.sequence), objType: 'POMODORO', state: 0,
                creationDate: end, endDate: end, interval: part, pomodoroInterval: s.config.interval,
                taskId: s.taskId, subtaskId: s.subtaskId, isManual: false, sync: 1,
                sessionId: s.sessionId, blockId
            });
            s.recordedSeconds += part;
            remaining -= part;
            if (end >= span.end - 0.0001) s.spans.shift();
            else span.start = end;
        }
    }
    function settle(s, rows, flush, events) {
        let left = pendingSeconds(s);
        while (left + 0.000001 >= s.config.interval) {
            emit(s, s.config.interval, rows);
            if (events) events.push({ type: 'work', at: rows[rows.length - 1].endDate });
            left = pendingSeconds(s);
        }
        if (flush && left >= 0.001) emit(s, left, rows);
    }
    function restInterval(s) {
        return s.completed > 0 && s.completed % s.config.longEvery === 0 ? s.config.longBreak : s.config.shortBreak;
    }
    function workEnded(s) {
        s.completed++;
        s.phaseElapsed = 0;
        if (s.config.banBreak) s.state = s.config.autoWork ? 'work' : 'initial';
        else s.state = s.config.autoBreak ? 'rest' : 'waitingForRest';
    }
    function advance(s, until, rows, events) {
        let iterations = 0;
        while (running(s) && until > s.cursorAt) {
            if (++iterations > 20000) throw new Error('恢复区间过长，请缩短专注截止时间后重试。');
            if (s.state === 'work' && s.mode === 'countup') {
                const delta = (until - s.cursorAt) / 1000;
                append(s, s.cursorAt, until);
                s.totalSeconds += delta; s.phaseElapsed += delta; s.cursorAt = until;
                settle(s, rows, false, events);
                break;
            }
            const limit = s.state === 'work' ? s.config.interval : restInterval(s);
            const end = Math.min(until, s.cursorAt + Math.max(0, limit - s.phaseElapsed) * 1000);
            const delta = (end - s.cursorAt) / 1000;
            if (s.state === 'work') { append(s, s.cursorAt, end); s.totalSeconds += delta; }
            s.phaseElapsed += delta; s.cursorAt = end;
            if (s.phaseElapsed + 0.000001 < limit) break;
            if (s.state === 'work') {
                settle(s, rows, true);
                if (events) events.push({ type: 'work', at: s.cursorAt });
                workEnded(s);
            }
            else {
                if (events) events.push({ type: 'break', at: s.cursorAt });
                s.phaseElapsed = 0; s.state = s.config.autoWork ? 'work' : 'initial';
            }
        }
    }
    function reduce(previous, action, now) {
        if (!Number.isFinite(now)) throw new Error('无效的计时时间。');
        let s = previous ? clone(previous) : create(action, now);
        const rows = [], events = [];
        if (action.expectedSession && s.sessionId !== action.expectedSession) throw new Error('计时会话已在其他标签页更改，请重试。');
        if (s.state === 'recovery' && action.type !== 'resolve' && action.type !== 'tick') {
            throw new Error('请先处理待确认的中断时间。');
        }
        if (running(s) && action.type !== 'resolve') {
            const gap = now - s.observedAt;
            if (gap > (action.gapMs || GAP_MS) || now < s.cursorAt - 1000) {
                s.pendingRecovery = {
                    from: s.cursorAt, to: Math.max(now, s.cursorAt), detectedAt: now,
                    priorState: s.state, clockChanged: now < s.cursorAt
                };
                s.state = 'recovery';
            } else advance(s, Math.max(now, s.cursorAt), rows, events);
        }
        if (s.state === 'recovery' && action.type !== 'resolve') {
            s.revision++; return { session: s, records: rows, events, recovered: false };
        }
        switch (action.type) {
        case 'start':
            if (running(s)) break; // Another tab already started the shared timer.
            if (s.state === 'pause') { s.state = 'work'; s.cursorAt = now; break; }
            s = create(action, now); s.state = 'work'; break;
        case 'pause':
            if (s.state === 'work') { settle(s, rows, true); s.state = 'pause'; }
            break;
        case 'resume':
            if (s.state === 'pause') { s.state = 'work'; s.cursorAt = now; }
            break;
        case 'rest':
            settle(s, rows, true); s.state = 'rest'; s.phaseElapsed = 0; s.cursorAt = now; break;
        case 'stop':
        case 'mode':
            settle(s, rows, true); s.state = 'initial'; s.phaseElapsed = 0;
            s.totalSeconds = 0; s.recordedSeconds = 0; s.spans = []; s.cursorAt = now;
            if (action.mode) s.mode = action.mode;
            break;
        case 'switchTask':
            settle(s, rows, true);
            s = create(action, now); s.state = action.paused ? 'pause' : 'work'; break;
        case 'detach':
            settle(s, rows, true); s.taskId = ''; s.subtaskId = '';
            s.config = settings(action.config || s.config); s.state = 'initial';
            s.phaseElapsed = 0; s.totalSeconds = 0; s.recordedSeconds = 0; s.spans = []; s.cursorAt = now;
            break;
        case 'configure':
            // Preference changes apply to idle/waiting timers. Active work keeps its duration.
            if (s.state === 'initial' || s.state === 'waitingForRest') s.config = settings(action.config);
            break;
        case 'flush': settle(s, rows, true); break;
        case 'resolve': {
            if (s.state !== 'recovery' || !s.pendingRecovery) break;
            const p = s.pendingRecovery;
            const cutoff = action.cutoff === undefined ? p.to : Number(action.cutoff);
            if (!Number.isFinite(cutoff) || cutoff < p.from || cutoff > p.to) throw new Error('截止时间必须在中断区间内。');
            s.state = p.priorState; s.pendingRecovery = null;
            advance(s, cutoff, rows, events);
            // Keep unfinished spans; confirmation time and excluded time are never counted.
            s.cursorAt = now;
            if (action.continue === false && s.state === 'work') { settle(s, rows, true); s.state = 'pause'; }
            break;
        }
        case 'tick': break;
        default: throw new Error('未知计时操作：' + action.type);
        }
        s.observedAt = now;
        s.revision = (previous ? previous.revision : 0) + 1;
        return { session: s, records: rows, events, recovered: action.type === 'resolve' };
    }
    function view(s, now) {
        const delta = running(s) ? Math.max(0, now - s.cursorAt) / 1000 : 0;
        const elapsed = s.state === 'initial' ? 0 : s.mode === 'countup' && s.state !== 'rest' ? s.totalSeconds + delta : s.phaseElapsed + delta;
        return { state: s.state === 'recovery' ? 'pause' : s.state,
            interval: s.state === 'rest' || s.state === 'waitingForRest' ? restInterval(s) : s.config.interval,
            elapse: elapsed, startTime: now - elapsed * 1000, breakpoint: s.recordedSeconds };
    }
    return { GAP_MS, MAX_INTERVAL, create, reduce, view, pendingSeconds, settings, running };
});
