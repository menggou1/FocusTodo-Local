/* Explicit adapter for the legacy React timer. No React-internal traversal. */
(function (root) {
    'use strict';
    const core = root.FocusTimerCore, data = root.FocusLocalData;
    const RELEASE = root.FocusRelease;
    // Legacy completion/refresh events can supply records before the list's
    // asynchronous hydration replaces them with numeric progress fractions.
    function pomodoroValues(records) {
        if (!Array.isArray(records)) return [];
        return records.map(record => {
            const value = record && typeof record === 'object'
                ? Number(record.interval) / Number(record.pomodoroInterval) : Number(record);
            return Number.isFinite(value) ? Math.max(0, Math.min(value, 1)) : 0;
        });
    }
    function notice(message) {
        let box = document.getElementById('focus-local-notice');
        if (!box) {
            box = document.createElement('div'); box.id = 'focus-local-notice'; box.className = 'focus-local-notice'; box.setAttribute('role', 'alert');
            document.body.appendChild(box);
        }
        box.replaceChildren(document.createTextNode(message));
        const close = document.createElement('button'); close.textContent = '关闭提示'; close.onclick = () => box.remove(); box.appendChild(close);
    }
    root.addEventListener('focus-local-notice', event => notice(event.detail));
    function localDate(value) {
        const d = new Date(value - new Date(value).getTimezoneOffset() * 60000);
        return d.toISOString().slice(0, 19);
    }
    function attachTimer(timer, options) {
        let current = null, queue = Promise.resolve(), disposed = false, halted = false, dialog = null, poll, mounted = false, completingTask = false;
        const listeners = [];
        const listen = (target, event, callback) => { target.addEventListener(event, callback); listeners.push(() => target.removeEventListener(event, callback)); };
        function config(task) {
            const p = options.preference;
            return core.settings({ interval: task && task.pomodoroInterval || p.workInterval,
                shortBreak: p.shortBreakInterval, longBreak: p.longBreakInterval, longEvery: p.longBreakPomodoros,
                autoWork: p.autoWorkEnabled, autoBreak: p.autoBreakEnabled, banBreak: p.banBreakEnabled });
        }
        function input(type, extra) {
            return Object.assign({ type, sessionId: crypto.randomUUID(), mode: timer.state.isCountdown ? 'countdown' : 'countup',
                taskId: timer.props.task ? timer.props.task.id : '', subtaskId: timer.props.subtask ? timer.props.subtask.id : '',
                config: config(timer.props.task), completed: current ? current.completed : 0,
                expectedSession: type !== 'tick' && current ? current.sessionId : undefined }, extra || {});
        }
        function closeDialog() { if (dialog) dialog.remove(); dialog = null; }
        function showRecovery() {
            if (!current || current.state !== 'recovery') { closeDialog(); return; }
            if (dialog) return;
            const pending = current.pendingRecovery;
            dialog = document.createElement('div'); dialog.className = 'focus-recovery-backdrop'; dialog.id = 'focus-recovery';
            const card = document.createElement('section'); card.className = 'focus-recovery-card';
            card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'focus-recovery-title');
            const title = document.createElement('h2'); title.id = 'focus-recovery-title'; title.textContent = '确认中断期间的专注时间';
            const description = document.createElement('p');
            description.textContent = (pending.clockChanged ? '检测到系统时间回退。' : '检测到页面长时间未执行。') + '等待确认期间暂停新增计时；已有记录保留。';
            const range = document.createElement('p'); range.textContent = new Date(pending.from).toLocaleString() + ' — ' + new Date(pending.to).toLocaleString();
            const label = document.createElement('label'); label.textContent = '专注截止时间';
            const cutoff = document.createElement('input'); cutoff.type = 'datetime-local'; cutoff.step = '1';
            cutoff.min = localDate(pending.from); cutoff.max = localDate(pending.to); cutoff.value = localDate(pending.to); label.appendChild(cutoff);
            const summary = document.createElement('p'); summary.className = 'focus-recovery-summary';
            const continuing = document.createElement('label'), check = document.createElement('input'); check.type = 'checkbox'; check.checked = pending.source !== 'import';
            continuing.append(check, document.createTextNode('确认后继续计时（等待确认的时间不计入）'));
            const actions = document.createElement('div'); actions.className = 'focus-recovery-actions';
            const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.className = 'focus-recovery-error';
            let cutoffEdited = false;
            function preview() {
                try {
                    const end = cutoffEdited ? new Date(cutoff.value).getTime() : pending.to;
                    const result = core.reduce(current, { type: 'resolve', cutoff: end, continue: check.checked }, Date.now());
                    const minutes = result.records.reduce((sum, record) => sum + record.interval, 0) / 60;
                    const blocks = new Set(result.records.map(record => record.blockId)).size;
                    summary.textContent = '将补记 ' + blocks + ' 段，共 ' + Number(minutes.toFixed(2)) + ' 分钟；未满番茄的部分继续保留。';
                    error.textContent = '';
                } catch (e) { error.textContent = e.message; }
            }
            async function choose(end) {
                const buttons = actions.querySelectorAll('button'); buttons.forEach(button => { button.disabled = true; });
                try { await run('resolve', { cutoff: end, continue: check.checked }); }
                catch (e) { error.textContent = e.message; buttons.forEach(button => { button.disabled = false; }); }
            }
            [['全部计入', () => choose(pending.to)], ['按截止时间计入', () => choose(new Date(cutoff.value).getTime())],
                ['不计入中断部分', () => choose(pending.from)]].forEach(([text, handler]) => {
                    const button = document.createElement('button'); button.textContent = text; button.onclick = handler; actions.appendChild(button);
                });
            cutoff.oninput = () => { cutoffEdited = true; preview(); }; check.onchange = preview;
            card.append(title, description, range, label, summary, continuing, error, actions); dialog.appendChild(card); document.body.appendChild(dialog);
            card.addEventListener('keydown', event => {
                if (event.key !== 'Tab') return;
                const nodes = [...card.querySelectorAll('input,button')].filter(node => !node.disabled);
                if (event.shiftKey && document.activeElement === nodes[0]) { nodes[nodes.length - 1].focus(); event.preventDefault(); }
                else if (!event.shiftKey && document.activeElement === nodes[nodes.length - 1]) { nodes[0].focus(); event.preventDefault(); }
            });
            preview(); cutoff.focus();
        }
        async function renderSession(session, records) {
            if (disposed) return;
            current = session;
            const p = options.preference;
            if (p.timingTaskId !== session.taskId || p.timingSubtaskId !== session.subtaskId ||
                (timer.props.task ? timer.props.task.id : '') !== session.taskId) {
                p.timingTaskId = session.taskId; p.timingSubtaskId = session.subtaskId;
                await timer.updateTimingTask(session.taskId, session.subtaskId);
            }
            const view = core.view(session, Date.now());
            options.updateState(view.state);
            await new Promise(resolve => timer.setState({ timerInfo: view, isCountdown: session.mode === 'countdown', countdownFlag: !timer.state.countdownFlag }, resolve));
            timer.refreshStatusBar(view);
            // Also restore audio on a short reload where the saved state is already 'work'.
            timer.refreshBgMusic(view.state);
            showRecovery();
            if (records && records.length) {
                await options.onRecords(records);
                await timer.resetTaskPomodoros();
            }
        }
        function run(type, extra) {
            const execute = async () => {
                if (disposed || halted || data.maintenance) throw new Error('本页已暂停数据操作，请刷新后继续。');
                const action = input(type, extra);
                const result = await data.timerAction(action, Date.now());
                if (disposed) return result;
                await renderSession(result.session, result.records);
                if (type === 'mode') options.preference.isCountdown = result.session.mode === 'countdown';
                // Only the transaction that crosses a live boundary notifies. Recovery is silent.
                if (type !== 'resolve' && result.events && result.events.length) {
                    const work = result.events.some(event => event.type === 'work');
                    const rest = result.events.some(event => event.type === 'break');
                    try {
                        if (work) {
                            if (result.session.mode === 'countdown') timer.playWorkAlarm();
                            if (options.notifyWork) options.notifyWork(result.session);
                        }
                        if (rest) { timer.playBreakAlarm(); if (options.notifyBreak) options.notifyBreak(); }
                    } catch (error) { notice('计时已保存，完成提示未能播放：' + error.message); }
                }
                if (result.recovered) notice('中断时间已处理：补记 ' + Number((result.records.reduce((n, r) => n + r.interval, 0) / 60).toFixed(2)) + ' 分钟。');
                return result;
            };
            const result = queue.then(execute, execute);
            queue = result.catch(error => { notice('操作未完成：' + error.message); });
            return result;
        }
        function fire(type, extra) { return run(type, extra).catch(() => {}); }
        async function tick() {
            if (disposed || halted) return;
            const now = Date.now();
            if (!current) { await fire('tick'); return; }
            const elapsed = Math.max(0, now - current.cursorAt) / 1000;
            const view = core.view(current, now);
            const boundary = current.mode === 'countup' && current.state === 'work'
                ? core.pendingSeconds(current) + elapsed >= current.config.interval
                : current.phaseElapsed + elapsed >= view.interval;
            if (core.running(current) && (now - current.observedAt >= 30000 || now < current.cursorAt || boundary)) await fire('tick');
            else if (core.running(current)) timer.setState({ timerInfo: view, countdownFlag: !timer.state.countdownFlag });
        }
        const originalCompleteTask = timer.completeTask;
        const originalUpdateTimingTask = timer.updateTimingTask;
        timer.updateTimingTask = async (taskId, subtaskId) => {
            if (!taskId) { options.clearTask(); return; }
            await originalUpdateTimingTask(taskId, subtaskId);
        };
        timer.refreshWorkInterval = () => {
            if (disposed || halted) return;
            if (current) {
                if (current.state === 'initial' || current.state === 'waitingForRest') return fire('configure', { config: config(timer.props.task) });
                return;
            }
            const view = Object.assign({}, timer.state.timerInfo, { interval: config(timer.props.task).interval });
            timer.setState({ timerInfo: view }); timer.refreshStatusBar(view);
        };
        timer.refreshRestInteral = () => !disposed && !halted && current && (current.state === 'initial' || current.state === 'waitingForRest') && fire('configure', { config: config(timer.props.task) });
        timer.switchToState = state => fire(({ work: current && current.state === 'pause' ? 'resume' : 'start', pause: 'pause', rest: 'rest', initial: 'stop', waitingForRest: 'stop' })[state] || 'stop');
        timer.countDown = () => tick();
        timer.resetTimer = () => {};
        timer.addPomodoro = async callback => { const result = await run('flush'); if (callback) await callback(); return result; };
        timer.completePomodoro = () => fire('tick'); timer.completeBreak = () => fire('tick');
        timer.skipPomodoro = () => fire('flush');
        timer.startForTask = async (task, subtask) => {
            try {
                if (current && current.taskId === task.id && current.subtaskId === (subtask ? subtask.id : '') && core.running(current)) { timer.zoomUp(); return; }
                await run('switchTask', { taskId: task.id, subtaskId: subtask ? subtask.id : '', config: config(task) }); timer.zoomUp();
            } catch (_) {}
        };
        timer.cancel = async () => { try { await run('stop'); timer.hideConfirmDialog(); } catch (_) {} };
        timer.deleteTaskOrSubtask = () => fire('detach', { config: config(null) });
        timer.completeTask = async () => {
            if (!timer.props.task || completingTask) return;
            completingTask = true;
            const expectedSession = current && current.sessionId;
            try {
                // Freeze first so the legacy completion callback cannot start another work segment.
                await run('pause'); await originalCompleteTask();
                await run('detach', { config: config(null), expectedSession });
            } catch (error) { notice(error.message); }
            finally { completingTask = false; }
        };
        timer.taskOrSubtaskDidComplete = async () => {
            try { await run('detach', { config: config(null) }); } catch (error) { notice(error.message); }
        };
        timer.switchMode = () => fire('mode', { mode: timer.state.isCountdown ? 'countup' : 'countdown' });
        clearInterval(timer.countdownTimer);
        // Constructor subscriptions captured the old functions before these overrides.
        (options.subscriptions || []).forEach(([event, name, original]) => {
            options.events.removeListener(event, original);
            const callback = (...args) => {
                if (disposed) return;
                Promise.resolve(timer[name](...args)).catch(error => notice(error.message));
            };
            options.events.on(event, callback);
            listeners.push(() => options.events.removeListener(event, callback));
        });
        timer.localTimer = {
            async mount() {
                if (mounted || disposed) return; mounted = true;
                await root.FocusLocalReady;
                if (disposed) return;
                const saved = await data.session();
                if (disposed) return;
                if (saved) { current = saved; await run('tick'); }
                // An empty database must leave the task selector usable before first start.
                poll = setInterval(() => { tick().catch(error => notice(error.message)); }, 1000);
                const resume = () => { if (!document.hidden) fire('tick'); };
                listen(document, 'visibilitychange', () => { if (current) fire('tick'); });
                listen(document, 'resume', resume); listen(root, 'pageshow', resume); listen(root, 'focus', resume);
                listen(root, 'focus-local-timer-changed', event => {
                    queue = queue.then(async () => {
                        if (disposed || halted) return;
                        const saved = await data.session();
                        if (saved) await renderSession(saved, event.detail && event.detail.records || []);
                    }).catch(error => notice(error.message));
                });
                listen(root, 'focus-local-maintenance', () => { halted = true; clearInterval(poll); closeDialog(); });
                listen(root, 'focus-local-maintenance-end', event => {
                    if (!event.detail.succeeded) {
                        halted = false;
                        poll = setInterval(() => { tick().catch(error => notice(error.message)); }, 1000);
                        fire('tick');
                    }
                });
            },
            dispose() {
                disposed = true; clearInterval(poll); clearInterval(timer.countdownTimer);
                listeners.forEach(remove => remove()); closeDialog();
                if (options.disposeBridge) options.disposeBridge();
            },
            run, get session() { return current; }, get disposed() { return disposed; }
        };
        return timer.localTimer;
    }
    function attachAudio(player, preference) {
        let background = null, audition = null, wantsBackground = false, requesting = false, releaseLock = null, suspended = false, retryAfterRelease = false;
        const effects = new Set();
        const stop = audio => { if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); } };
        function play(file, volume, loop) {
            if (!/^[A-Za-z0-9_]+\.(mp3|m4a|wav|ogg)$/.test(file)) return null;
            const audio = new Audio('./audio/' + file);
            audio.volume = Math.max(0, Math.min(1, Number(volume) || 0)); audio.loop = !!loop;
            audio.play().catch(error => {
                if (error.name !== 'AbortError') console.warn('[Local audio] Playback unavailable:', file, error.message);
            });
            return audio;
        }
        player.start = function(file, volume) {
            const audio = play(file, volume === undefined ? 1 : volume, false);
            if (audio) { effects.add(audio); const cleanup = () => { effects.delete(audio); stop(audio); }; audio.onended = cleanup; audio.onerror = cleanup; }
        };
        function stopBackground() {
            stop(background); background = null;
            if (releaseLock) { releaseLock(); releaseLock = null; }
        }
        function ensureBackground() {
            const file = preference.bgMusic, volume = preference.whiteNoiseVolume / 100;
            if (!wantsBackground || suspended || document.hidden || player.timerState !== 'work' || file === 'bgm_Mute' || volume <= 0) { stopBackground(); return; }
            if (background && background.dataset.name === file) {
                background.volume = volume;
                if (background.paused) background.play().catch(() => {});
                return;
            }
            if (background) { stopBackground(); }
            if (navigator.locks && !releaseLock) {
                if (requesting) { retryAfterRelease = true; return; }
                requesting = true;
                navigator.locks.request('focustodo-local-background-audio', { ifAvailable: true }, async lock => {
                    if (!lock) return;
                    await new Promise(resolve => {
                        releaseLock = resolve;
                        ensureBackground();
                    });
                }).catch(error => console.warn('[Local audio] Lock unavailable:', error.message))
                    .finally(() => {
                        requesting = false;
                        if (retryAfterRelease) { retryAfterRelease = false; ensureBackground(); }
                    });
                return;
            }
            background = play(file + '.m4a', volume, true);
            if (background) background.dataset.name = file;
            else stopBackground();
        }
        player.stopBgm = () => { wantsBackground = false; stopBackground(); };
        player.startBgm = function(state) {
            if (state !== undefined) player.timerState = state;
            wantsBackground = player.timerState === 'work' && !audition;
            ensureBackground();
        };
        player.updateBgmVolume = () => player.startBgm();
        player.stopAudition = function(resume) { stop(audition); audition = null; if (resume) player.startBgm(); };
        player.startAudition = function(file, volume) {
            player.stopBgm(); player.stopAudition(); audition = play(file, volume, false);
            if (audition) audition.onended = audition.onerror = () => player.stopAudition(true);
        };
        player.updateAuditionVolume = value => { if (audition) audition.volume = Math.max(0, Math.min(1, value)); };
        root.addEventListener('pagehide', () => { suspended = true; stopBackground(); player.stopAudition(); effects.forEach(stop); effects.clear(); });
        root.addEventListener('pageshow', () => { suspended = false; player.startBgm(); });
        document.addEventListener('visibilitychange', ensureBackground);
        root.addEventListener('focus', () => { if (!suspended) player.startBgm(); });
        document.addEventListener('pointerdown', ensureBackground);
    }
    function notifyCompletion(title, message, legacy) {
        if (typeof root.Notification === 'function' && root.Notification.permission === 'granted') {
            const notification = new root.Notification(title, { body: message, icon: './img/header-portrait.png' });
            notification.onclick = () => { root.focus(); notification.close(); };
        } else if (legacy) legacy();
    }
    root.FocusLocal = { attachTimer, attachAudio, RELEASE, notice, notifyCompletion, pomodoroValues };
})(window);
