/* Local calendar enhancements, with the existing database and timer lifecycle. */
(function (root) {
    'use strict';
    const text = value => root.FocusI18n ? root.FocusI18n.text(value) : value;
    const notice = error => root.FocusLocal.notice(error.message || String(error));
    function deadlineInSevenDays(now = Date.now()) {
        const date = new Date(now); date.setDate(date.getDate() + 7); date.setHours(23, 59, 59, 999); return date.getTime();
    }
    // Half-open intervals: an event ending when another begins can reuse its column.
    // Include the visible minimum height so even very short records remain clickable.
    function layoutEvents(events, dayStart, dayEnd, minuteHeight) {
        const rows = events.map(event => {
            const start = Math.max(dayStart, Number(event.start)), end = Math.min(dayEnd, Number(event.end));
            return { event, start, end: Math.min(dayEnd, Math.max(end, start + 18 / minuteHeight * 60000)) };
        }).filter(row => Number.isFinite(row.start) && Number.isFinite(row.end) && row.end > row.start &&
            Number(row.event.end) > dayStart && Number(row.event.start) < dayEnd)
            .sort((a, b) => a.start - b.start || a.end - b.end || String(a.event.id).localeCompare(String(b.event.id)));
        let group = [], active = [], groupEnd = -Infinity, columns = 0;
        const finish = () => { group.forEach(row => { row.columns = columns; }); group = []; active = []; columns = 0; };
        for (const row of rows) {
            if (row.start >= groupEnd) finish();
            active = active.filter(item => item.end > row.start);
            const used = new Set(active.map(item => item.column)); let column = 0;
            while (used.has(column)) column++;
            row.column = column; active.push(row); group.push(row); columns = Math.max(columns, column + 1);
            groupEnd = group.length === 1 ? row.end : Math.max(groupEnd, row.end);
        }
        finish(); return rows;
    }
    function wrap(target, name, fn) {
        const previous = target[name]; target[name] = function (...args) { return fn.call(this, previous && previous.bind(this), ...args); };
    }
    function modal(title, build, onCancel) {
        const focus = document.activeElement, overlay = document.createElement('div'), form = document.createElement('form');
        overlay.className = 'focus-calendar-overlay'; form.className = 'focus-calendar-dialog';
        form.setAttribute('role', 'dialog'); form.setAttribute('aria-modal', 'true');
        form.dataset.dark = String(localStorage.getItem('DarkMode') === 'true' || document.documentElement.getAttribute('data-theme') === 'dark');
        const heading = document.createElement('h2'); heading.id = 'focus-calendar-dialog-title'; heading.textContent = text(title);
        form.setAttribute('aria-labelledby', heading.id); form.append(heading); overlay.append(form); document.body.append(overlay);
        const dialog = { form, dispose: null };
        const close = () => { document.removeEventListener('keydown', escape, true); dialog.dispose?.(); overlay.remove(); if (focus && focus.isConnected) focus.focus(); };
        dialog.close = close;
        function escape(event) {
            if (event.key !== 'Escape' || dialog.hasOpenNative?.()) return;
            event.preventDefault(); event.stopImmediatePropagation(); onCancel();
        }
        document.addEventListener('keydown', escape, true);
        overlay.onmousedown = event => { if (event.target === overlay) onCancel(); };
        form.onkeydown = event => {
            event.stopPropagation();
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onCancel(); }
            if (event.key === 'Tab') {
                const nodes = Array.from(form.querySelectorAll('input,select,button')).filter(node => !node.disabled);
                const first = nodes[0], last = nodes[nodes.length - 1];
                if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
                else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
            }
        };
        build(form, close); form.querySelector('input,select,button')?.focus(); return dialog;
    }
    function field(form, label, id, type = 'text') {
        const row = document.createElement('label'), caption = document.createElement('span');
        caption.textContent = text(label); const input = document.createElement(type === 'select' ? 'select' : 'input');
        if (type !== 'select') input.type = type; input.id = id; row.append(caption, input); form.append(row); return input;
    }
    function actions(form, cancel) {
        const row = document.createElement('div'); row.className = 'focus-calendar-actions';
        const back = document.createElement('button'), save = document.createElement('button');
        back.type = 'button'; back.textContent = text('取消'); back.onclick = cancel;
        save.type = 'submit'; save.textContent = text('确定'); row.append(back, save); form.append(row); return { back, save };
    }
    function renderShell(view, React, styles) {
        const h = React.createElement, p = view.props, mode = p.calendarViewMode;
        const select = h('select', { className: 'focus-schedule-view', value: mode, 'aria-label': text('日程视图'),
            onChange: event => p.onViewModeChange({ value: event.target.value }) },
            ['day', 'week', 'month'].map((value, index) => h('option', { key: value, value }, text(['日', '周', '月'][index]))));
        return h('div', { className: styles.layout + ' focus-schedule-shell' },
            h('div', { className: styles.pane + (p.showTaskPane ? '' : ' ' + styles.paneExpanded) },
                h('div', { className: styles.navigatorWrapper }, h('div', { className: styles.navigator },
                    h('div', { className: styles.left },
                        h('button', { type: 'button', className: styles.todayButton, onClick: p.onToday }, view.getTodayLabel()),
                        h('button', { type: 'button', className: styles.navButton, 'aria-label': text('前一天'), onClick: p.onNavigatePrev }, '‹'),
                        h('button', { type: 'button', className: styles.navButton, 'aria-label': text('后一天'), onClick: p.onNavigateNext }, '›'),
                        h('button', { type: 'button', className: styles.dateButton, onClick: p.onDatePicker },
                            h('span', { className: styles.dateText }, view.getDateLabel(p.calendarDate, mode)), h('span', { className: styles.dateArrow }))),
                    h('div', { className: styles.right }, select, h('button', { type: 'button', className: 'focus-schedule-add',
                        'aria-label': text('显示任务面板'), 'aria-expanded': p.showTaskPane, onClick: p.onToggleTaskPane }, '+')))),
                h('div', { className: styles.body }, view.renderCalendarContent(p.dayViewProps || {}, p.weekViewProps || {}, p.monthViewProps || {}))),
            p.showTaskPane ? h('div', { className: styles.taskPane }, view.renderTaskPaneContent()) : null);
    }
    function renderDay(view, React, styles) {
        const date = view.getMoment(view.props.date), today = date.isSame(view.getMoment(), 'day');
        const chinese = root.FocusI18n.locale.startsWith('zh');
        const label = (today ? text('今天') + ' ' : date.format(chinese ? 'M月D日' : 'MMM D') + ' ') + date.format('dddd');
        return React.createElement('div', { className: styles.root + ' focus-schedule-day', style: { '--calendar-day-hour-height': (view.props.hourHeight || 124) + 'px' } },
            React.createElement('div', { className: styles.header }, React.createElement('div', { className: styles.weekday }, label)),
            view.renderAllDaySection(), view.renderTimeline(view.shouldUseDualColumn(date)));
    }
    function attachController(controller, options) {
        if (controller.focusCalendarAttached) return; controller.focusCalendarAttached = true;
        const c = controller, { React, moment, preference, taskManager, subtaskManager, startTask, actions: redux, events, eventTypes, native } = options;
        let quick = null, picker = null, saving = false, live = true;
        let periodRequest = 0;
        const invalidate = () => { c.calendarDayEventCache = { tasks: new Map(), subtasks: new Map(), projects: new Map() }; };
        async function loadPeriod() {
            const mode = c.state.calendarViewMode; if (mode === 'day' || !live || root.FocusLocalData.maintenance) return;
            const token = ++periodRequest, date = c.state.calendarDate;
            const start = date.clone().startOf(mode === 'month' ? 'month' : 'isoWeek').startOf('isoWeek').valueOf();
            const end = date.clone().endOf(mode === 'month' ? 'month' : 'isoWeek').endOf('isoWeek').valueOf();
            const db = await root.FocusLocalData.open();
            const rows = await root.FocusLocalData.transaction(db, ['Schedule', 'Pomodoro'], 'readonly', (tx, done) => {
                const result = {}; let pending = 2;
                for (const name of ['Schedule', 'Pomodoro']) {
                    const request = tx.objectStore(name).index('endDate').getAll(IDBKeyRange.bound(start, end + 7 * 86400000));
                    request.onsuccess = () => { result[name] = request.result; if (!--pending) done(result); };
                }
            });
            const result = await c.transformCalendarDayEntries(rows.Schedule, rows.Pomodoro, start, end);
            if (live && c._isMounted && token === periodRequest) c.setState({ calendarMonthEvents: [...result.scheduled, ...result.completed], focusWeekEvents: [...result.scheduled, ...result.completed] });
        }
        const refresh = async () => {
            if (!c._isMounted || root.FocusLocalData.maintenance) return;
            invalidate(); await c.loadCalendarDayEntries(); await loadPeriod();
            if (c.state.showCalendarTasks) await c.loadCalendarTasks(c.state.calendarSelectedProjectId);
            const detail = c.state.calendarPomodoroDetail;
            if (detail) {
                const db = await root.FocusLocalData.open();
                const record = await root.FocusLocalData.transaction(db, ['Pomodoro'], 'readonly', (tx, done) => {
                    const request = tx.objectStore('Pomodoro').get(detail.id); request.onsuccess = () => done(request.result);
                });
                if (live && c.state.calendarPomodoroDetail?.id === detail.id) {
                    if (!record || record.state === -1) c.setState({ calendarPomodoroDetail: null, showCalendarTasks: false });
                    else {
                        const task = record.taskId ? await taskManager.fetchTaskById(record.taskId) : null;
                        if (!live || c.state.calendarPomodoroDetail?.id !== detail.id) return;
                        c.props.dispatch(redux.updateFinishedObject({ ...record, name: task?.name || '' }));
                        c.props.dispatch(redux.checkObject(record.id, task));
                        c.setState({ calendarPomodoroDetail: record });
                    }
                }
            }
        };
        const changed = () => { refresh().catch(notice); events.emit(eventTypes.POMO_RELOAD_POMODOROS); };
        root.addEventListener('focus-local-calendar-changed', changed);
        root.addEventListener('focus-local-timer-changed', changed);
        const focusRefresh = () => refresh().catch(notice);
        root.addEventListener('focus', focusRefresh);
        events.on(eventTypes.POMODORO_NEW, focusRefresh);
        c.cancelQuickTask = () => {
            if (saving) return;
            const previous = quick; quick = null; previous?.dialog.close();
            if (live) c.setState({ focusCalendarPreview: null });
        };
        c.openQuickTask = (startTime, interval) => {
            if (saving || root.FocusLocalData.maintenance) return;
            c.cancelQuickTask(); picker?.close(); picker = null;
            startTime = Math.floor(startTime / 60000) * 60000;
            interval = Math.max(60, Math.min(28800, Math.round(interval / 60) * 60));
            const projectId = c.state.calendarSelectedProjectId;
            const projects = (c.props.projects || []).filter(row => row && row.state !== -1 && [1000, 7005].includes(row.type));
            const defaultProject = projects.find(row => row.id === projectId) || projects.find(row => row.type === 7005) || projects[0];
            quick = { startTime, interval, dialog: null, draft: { id: 'local-schedule-draft', estimatePomoNum: 0,
                pomodoroInterval: interval, projectId: defaultProject?.id || '', pomodoros: [] } };
            const entry = quick;
            c.setState({ calendarPomodoroDetail: null, calendarScheduleDetail: null, showCalendarTasks: false,
                focusCalendarPreview: { id: 'local-calendar-preview', start: startTime, end: startTime + interval * 1000,
                    title: text('未指定任务'), category: 'scheduled', focusPreview: true } });
            quick.dialog = modal('添加任务', (form) => {
                form.classList.add('focus-schedule-quick'); form.noValidate = true;
                form.parentElement.classList.add('focus-schedule-quick-overlay');
                const name = field(form, '任务名称', 'focus-calendar-name'); name.required = true; name.maxLength = 1000;
                name.placeholder = text('添加任务...'); name.parentElement.classList.add('focus-schedule-name');
                const nativeHost = document.createElement('div'); nativeHost.className = 'focus-schedule-native-fields'; form.append(nativeHost);
                const updatePreview = () => {
                    if (quick !== entry) return;
                    c.setState({ focusCalendarPreview: { ...c.state.focusCalendarPreview, title: name.value.trim() || text('未指定任务'), end: startTime + entry.draft.pomodoroInterval * 1000 } });
                };
                function updateDraft(change) {
                    if (quick !== entry || saving) return;
                    entry.draft = { ...entry.draft, ...change }; renderNative(); updatePreview();
                }
                function renderNative() {
                    native.ReactDOM.render(React.createElement(native.Provider, { store: c.context.store }, React.createElement(React.Fragment, null,
                        React.createElement(native.Pomodoro, { task: entry.draft, onLocalDraftChange: updateDraft, ref: value => entry.pomodoroRow = value }),
                        React.createElement(native.Project, { task: entry.draft, projects, onLocalDraftChange: updateDraft, ref: value => entry.projectRow = value }))), nativeHost);
                }
                const dismissNative = event => {
                    if (event.key !== 'Escape') return;
                    const pomo = entry.pomodoroRow, project = entry.projectRow;
                    if (pomo?.state.inputShown || project?.state.inputShown) {
                        event.preventDefault(); event.stopImmediatePropagation();
                        pomo?.hideInput(); project?.setState({ inputShown: false });
                    }
                };
                entry.dispose = () => { document.body.classList.remove('focus-schedule-quick-open'); document.removeEventListener('keydown', dismissNative, true); native.ReactDOM.unmountComponentAtNode(nativeHost); };
                document.body.classList.add('focus-schedule-quick-open'); document.addEventListener('keydown', dismissNative, true);
                renderNative(); updatePreview();
                const error = document.createElement('p'); error.className = 'focus-schedule-error'; error.id = 'focus-schedule-error'; error.setAttribute('role', 'alert'); form.append(error);
                name.setAttribute('aria-describedby', error.id);
                name.oninput = () => { updatePreview(); if (name.value.trim()) { error.textContent = ''; name.removeAttribute('aria-invalid'); } };
                const buttons = actions(form, c.cancelQuickTask);
                form.onsubmit = async event => {
                    event.preventDefault(); if (saving) return;
                    if (!name.value.trim()) { error.textContent = text('请输入任务名称'); name.setAttribute('aria-invalid', 'true'); name.focus(); return; }
                    saving = true; buttons.save.disabled = buttons.back.disabled = true; error.textContent = '';
                    try {
                        const result = await root.FocusLocalData.createCalendarTask({ name: name.value, count: entry.draft.estimatePomoNum,
                            interval: entry.draft.pomodoroInterval, startTime, projectId: entry.draft.projectId,
                            shortBreak: preference.shortBreakInterval, addToTop: preference.newTaskOnTop });
                        if (live) {
                            events.emit(eventTypes.NEED_TO_REFRESH_PROJECT_INFO_OF_TASKS, [result.task]);
                            c.props.dispatch(redux.addTask(result.task));
                        }
                        saving = false; c.cancelQuickTask(); await refresh();
                    } catch (failure) {
                        saving = false;
                        if (live && quick) { buttons.save.disabled = buttons.back.disabled = false; error.textContent = text('保存失败') + '：' + failure.message; }
                    }
                };
            }, c.cancelQuickTask);
            entry.dialog.dispose = () => entry.dispose();
            entry.dialog.hasOpenNative = () => !!(entry.pomodoroRow?.state.inputShown || entry.projectRow?.state.inputShown);
            const pending = quick;
            const position = () => {
                if (quick !== pending || !pending.dialog.form.isConnected) return;
                const preview = document.querySelector('.focus-calendar-preview');
                if (!preview) return;
                const anchor = preview.getBoundingClientRect(), form = pending.dialog.form, bounds = form.getBoundingClientRect();
                const below = anchor.bottom + 12;
                const top = below + bounds.height <= root.innerHeight - 12 ? below : anchor.top - bounds.height - 12;
                Object.assign(form.style, { position: 'fixed', left: Math.max(12, Math.min(root.innerWidth - bounds.width - 12, anchor.left + anchor.width / 2 - bounds.width / 2)) + 'px',
                    top: Math.max(12, Math.min(root.innerHeight - bounds.height - 12, top)) + 'px' });
                form.dataset.anchored = 'true';
            };
            root.requestAnimationFrame(position);
        };
        c.handleCalendarTimeSlotDoubleClick = date => c.openQuickTask(Number(date), preference.workInterval);
        c.handleCalendarTimeRangeSelect = (start, end) => c.openQuickTask(Math.min(Number(start), Number(end)), Math.abs(Number(end) - Number(start)) / 1000);
        c.handleCalendarTimeSlotClick = () => {
            if (quick) return;
            c.hideCalendarContextMenu();
            if (c.state.calendarScheduleDetail) c.handleScheduleDetailClose();
            else if (c.state.calendarPomodoroDetail) { c.props.dispatch(redux.checkObject('')); c.setState({ calendarPomodoroDetail: null, showCalendarTasks: false }); }
            else if (c.state.showCalendarTasks) c.setState({ showCalendarTasks: false });
        };
        c.handleCalendarDatePicker = event => {
            event.stopPropagation(); if (saving) return;
            c.cancelQuickTask(); if (picker) { picker.close(); return; }
            const host = document.createElement('div'); document.body.append(host);
            const close = () => { if (picker?.host !== host) return; picker = null; native.ReactDOM.unmountComponentAtNode(host); host.remove(); };
            picker = { host, close };
            const target = event.currentTarget || document.querySelector('[class*="CalendarView-dateButton"]');
            native.ReactDOM.render(React.createElement(native.Overlay, { show: true, target, placement: 'bottom', rootClose: true, onHide: close, containerPadding: 8 },
                React.createElement(native.Popover, { id: 'deadline-selection-popover' }, React.createElement(native.DatePicker, {
                    deadline: c.state.calendarDate.clone().endOf('day').valueOf(), shortcutHidden: true, actionsHidden: true,
                    valueChange: value => { c.setState({ calendarDate: moment(value).startOf('day') }); close(); }
                }))), host);
        };
        c.handleCalendarEventStartPomodoro = async event => {
            try {
                if (!event || event.focusPreview || saving) return;
                const id = event.subtaskId || event.raw?.subtaskId;
                const subtask = id ? await subtaskManager.fetchSubtaskById(id) : null;
                const taskId = event.taskId || event.raw?.taskId || subtask?.taskId;
                const task = taskId ? await taskManager.fetchTaskById(taskId) : null;
                if ((taskId && (!task || task.state === -1)) || (id && (!subtask || subtask.state === -1))) throw new Error(text('关联任务已不存在，请重新选择任务。'));
                if (task?.isFinished || subtask?.isFinished) throw new Error(text('该任务已完成'));
                startTask(task, subtask);
            } catch (error) { notice(error); }
        };
        wrap(c, 'getCalendarDayViewProps', previous => ({ ...previous(),
            hourHeight: 124, scheduledEvents: c.state.focusCalendarPreview ? [...c.state.calendarDayScheduledEvents, c.state.focusCalendarPreview] : c.state.calendarDayScheduledEvents,
            onTimeSlotDoubleClick: c.handleCalendarTimeSlotDoubleClick, onTimeRangeSelect: c.handleCalendarTimeRangeSelect,
            onEventStartPomodoro: c.handleCalendarEventStartPomodoro }));
        wrap(c, 'getCalendarWeekViewProps', previous => ({ ...previous(), timedEvents: c.state.focusWeekEvents || [] }));
        c.handleCalendarMonthEventClick = event => c.setState({ calendarDate: moment(event.start).startOf('day'), calendarViewMode: 'day' }, () => c.handleCalendarEventClick(event));
        c.handleCalendarMonthDayClick = date => c.setState({ calendarDate: date.clone().startOf('day'), calendarViewMode: 'day' });
        wrap(c, 'componentDidMount', previous => { previous(); loadPeriod().catch(notice); });
        wrap(c, 'handleScheduleDetailChange', (previous, ...args) => { previous(...args); invalidate(); c.loadCalendarDayEntries(); });
        // The original handlers hide write failures. Reload from committed data on
        // failure as well as success so an optimistic block cannot remain fictitious.
        c.handleCalendarEventDrop = async ({ event, action = 'move', startTime, endTime }) => {
            if (!event?.raw?.id || event.category !== 'scheduled') return;
            const raw = event.raw, duration = raw.interval * 1000;
            const start = Math.round(startTime), end = action === 'resize' ? Math.max(start + 60000, Math.round(endTime)) : start + duration;
            try { await root.FocusLocalData.putSchedule({ ...raw, endDate: end, interval: Math.round((end - start) / 1000), sync: 0 }); }
            catch (error) { notice(error); }
            finally { await refresh(); }
        };
        c.handleCalendarEventCopy = async () => {
            const event = c.state.calendarContextMenuTarget; c.hideCalendarContextMenu();
            if (!event?.raw?.id) return;
            try {
                await root.FocusLocalData.putSchedule({ ...event.raw, id: root.crypto.randomUUID(), creationDate: Date.now(), sync: 0,
                    endDate: event.raw.endDate + (event.raw.interval + preference.shortBreakInterval) * 1000 });
            } catch (error) { notice(error); }
        };
        c.handleCalendarEventDelete = async () => {
            const event = c.state.calendarContextMenuTarget; c.hideCalendarContextMenu();
            if (!event?.raw?.id) return;
            try { await root.FocusLocalData.putSchedule({ ...event.raw, state: -1, sync: 0 }); }
            catch (error) { notice(error); }
        };
        c.getCalendarEventMenuGroups = () => [[
            { title: text('复制'), action: c.handleCalendarEventCopy },
            { title: text('删除'), action: c.handleCalendarEventDelete }
        ]];
        wrap(c, 'componentDidUpdate', (previous, oldProps, oldState) => {
            previous(oldProps, oldState);
            if (!oldState.calendarDate.isSame(c.state.calendarDate, 'day') || oldState.calendarViewMode !== c.state.calendarViewMode) {
                c.cancelQuickTask(); picker?.close(); picker = null;
                loadPeriod().catch(notice);
            }
        });
        wrap(c, 'componentWillUnmount', previous => {
            live = false; periodRequest++; quick?.dialog.close(); picker?.close(); quick = picker = null;
            root.removeEventListener('focus-local-calendar-changed', changed);
            root.removeEventListener('focus-local-timer-changed', changed); root.removeEventListener('focus', focusRefresh); previous();
            events.removeListener(eventTypes.POMODORO_NEW, focusRefresh);
        });
        c.focusCalendarRefresh = refresh;
    }
    function attachTimeline(timeline, React, classes) {
        if (timeline.focusCalendarAttached) return; timeline.focusCalendarAttached = true;
        const t = timeline, h = React.createElement;
        let selection = null, suppressClick = false, nowTimer = null;
        const day = () => t.getMoment(t.props.date).startOf('day');
        const minuteAt = event => {
            const element = t.timelineRef.current, bounds = element.getBoundingClientRect();
            return Math.max(0, Math.min(1439, Math.round((event.clientY - bounds.top + element.scrollTop) / t.getMinuteHeight())));
        };
        const plannedColumn = event => {
            const element = t.timelineRef.current, bounds = element.getBoundingClientRect();
            return !t.shouldUseDualColumn(day()) || event.clientX < bounds.left + bounds.width / 2;
        };
        function stopSelection() {
            selection = null; document.removeEventListener('mousemove', move, true); document.removeEventListener('mouseup', up, true);
        }
        function move(event) {
            if (!selection) return;
            if (Math.abs(event.clientY - selection.y) < 4 && !selection.moved) return;
            event.preventDefault(); selection.moved = true; selection.end = minuteAt(event);
            const start = Math.min(selection.start, selection.end);
            t.setState({ focusSelection: { start, end: Math.max(start + 1, selection.start, selection.end) } });
        }
        function up() {
            if (!selection) return;
            const current = selection; stopSelection(); t.setState({ focusSelection: null });
            if (current.moved) {
                suppressClick = true;
                const start = Math.min(current.start, current.end), end = Math.max(start + 1, current.start, current.end);
                t.props.onTimeRangeSelect?.(day().clone().add(start, 'minutes'), day().clone().add(end, 'minutes'));
            }
        }
        function down(event) {
            if (event.button !== 0 || event.target.closest('.focus-calendar-event') || !plannedColumn(event)) return;
            stopSelection(); const minute = minuteAt(event); selection = { start: minute, end: minute, y: event.clientY, moved: false };
            document.addEventListener('mousemove', move, true); document.addEventListener('mouseup', up, true);
        }
        function doubleClick(event) {
            if (event.target.closest('.focus-calendar-event') || !plannedColumn(event)) return;
            event.preventDefault(); t.props.onTimeSlotDoubleClick?.(day().clone().add(minuteAt(event), 'minutes'));
        }
        wrap(t, 'handleTimelineClick', (previous, event) => { if (suppressClick) { suppressClick = false; return; } previous(event); });
        const scrollKey = () => 'FocusTodo.calendarScroll';
        function restoreScroll() {
            let position = 0; try { position = Number(sessionStorage.getItem(scrollKey())) || 0; } catch (_) {}
            const element = t.timelineRef.current; if (element) { element.scrollTop = position; t.handleTimelineScroll(); }
        }
        wrap(t, 'handleTimelineScroll', previous => {
            previous(); try { sessionStorage.setItem(scrollKey(), String(t.timelineRef.current?.scrollTop || 0)); } catch (_) {}
        });
        wrap(t, 'renderTimeline', (previous, dual) => {
            function enhance(node) {
                if (!React.isValidElement(node)) return node;
                const children = React.Children.map(node.props.children, enhance), props = {};
                if (node.props.className === classes.timelineScroll) Object.assign(props, { onMouseDown: down, onDoubleClick: doubleClick });
                if (String(node.props.className || '').split(' ').includes(classes.timelineContent) && t.state.focusSelection) {
                    const range = t.state.focusSelection, top = range.start * t.getMinuteHeight();
                    return React.cloneElement(node, props, children, h('div', { className: 'focus-calendar-selection',
                        style: { top, height: Math.max(18, (range.end - range.start) * t.getMinuteHeight()), width: dual ? '50%' : '100%' } }));
                }
                return React.cloneElement(node, props, children);
            }
            return enhance(previous(dual));
        });
        function renderEvents(events = [], start, minuteHeight, layer, category, includePreview) {
            const nextDay = start.clone().add(1, 'day'), dragging = t.state.eventDragPreview;
            const nodes = layoutEvents(events, start.valueOf(), nextDay.valueOf(), minuteHeight).map(row => {
                const event = row.event;
                if (dragging && dragging.eventKey === t.getEventKey(event) && dragging.category === category) return null;
                const top = (row.start - start.valueOf()) / 60000 * minuteHeight, height = (row.end - row.start) / 60000 * minuteHeight;
                const theme = t.getEventAppearance(event, category) || {};
                const width = 'calc((100% - ' + (12 + (row.columns - 1) * 4) + 'px) / ' + row.columns + ')';
                const style = { ...theme.containerStyle, ...(category === 'completed' ? { backgroundColor: event.colorHex || '#4670F6', borderColor: event.colorHex || '#4670F6', color: '#fff' } : {}), top, height, right: 'auto', width,
                    left: 'calc(6px + ' + row.column + ' * (' + width + ' + 4px))' };
                const seconds = Math.max(1, Math.round((event.end - event.start) / 1000)), duration = Math.round(seconds / 60);
                const label = seconds < 60 ? seconds + 's' : duration >= 60 ? Math.floor(duration / 60) + 'h' + (duration % 60 ? duration % 60 + 'm' : '') : duration + 'm';
                const title = event.title || text('未指定任务'), short = height < 52;
                const onClick = e => { e.stopPropagation(); if (!event.focusPreview) t.handleEventClick(e, event); };
                return h('div', { key: event.id, className: classes.eventItem + ' focus-calendar-event' + (event.focusPreview ? ' focus-calendar-preview' : ''), style,
                    tabIndex: event.focusPreview ? -1 : 0, role: 'button', 'aria-label': title + ' ' + t.formatEventTime(event),
                    'data-event-id': event.id, 'data-category': category,
                    title: title + '\n' + t.formatEventTime(event) + ' · ' + label,
                    onMouseDown: e => { e.stopPropagation(); if (!event.focusPreview) t.handleEventMouseDown(e, event, category); },
                    onClick, onDoubleClick: e => e.stopPropagation(),
                    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); } },
                    onContextMenu: e => { if (!event.focusPreview) t.handleEventContextMenu(e, event, category); } },
                h('div', { className: 'focus-calendar-event-text' + (short ? ' focus-calendar-inline' : ''), style: category === 'completed' ? { color: '#fff' } : theme.titleStyle },
                    h('span', { className: 'focus-calendar-event-title', style: short ? {} : { WebkitLineClamp: Math.max(1, Math.floor((height - 30) / 17)) } }, title),
                    h('span', { className: 'focus-calendar-event-duration', style: category === 'completed' ? { color: '#fff' } : theme.timeStyle }, label)),
                category === 'scheduled' && !event.focusPreview ? h('button', { type: 'button', className: 'focus-calendar-start',
                    'aria-label': text('开始专注'), title: text('开始专注'),
                    onMouseDown: e => e.stopPropagation(), onDoubleClick: e => e.stopPropagation(),
                    onKeyDown: e => e.stopPropagation(), onClick: e => { e.stopPropagation(); t.props.onEventStartPomodoro?.(event); } }, '▶') : null,
                category === 'scheduled' && !event.focusPreview ? h('div', { className: classes.eventResizeHandle, onMouseDown: e => t.handleEventResizeMouseDown(e, event, category) }) : null);
            });
            if (includePreview) { const preview = t.renderDragPreviewNode(); if (preview) nodes.push(preview); }
            if (dragging?.category === category) nodes.push(t.renderEventDragPreviewNode(dragging));
            return h('div', { className: classes.eventsLayer + (layer ? ' ' + layer : '') }, nodes);
        }
        t.renderEventColumn = renderEvents;
        t.renderSingleColumnEvents = (events, start, height, preview, category) => renderEvents(events, start, height, '', category, preview);
        // Preserve the raw cross-midnight start during a drag. Clipping is only
        // for display; a 23:50–00:20 plan must not jump to 00:00 when selected.
        t.startEventDrag = (event, item, category, action = 'move') => {
            if (item?.focusPreview || category !== 'scheduled' || !item?.raw?.id) return;
            const element = t.timelineRef.current; if (!element) return;
            const start = t.getMoment(item.start), end = t.getMoment(item.end), startMinutes = start.diff(day(), 'minutes', true);
            if (end.valueOf() <= day().valueOf() || start.valueOf() >= day().add(1, 'day').valueOf()) return;
            const duration = Math.max(1, end.diff(start, 'minutes', true));
            t.eventDragContext = { eventData: item, category, eventKey: t.getEventKey(item), minuteHeight: t.getMinuteHeight(), dayStart: day(),
                startMinutes, durationMinutes: duration, startMomentValue: start.valueOf(), originalEndTime: end.valueOf(),
                initialBottomMinutes: startMinutes + duration, minDurationMinutes: Math.min(duration, 15),
                originClientY: event.clientY, originScrollTop: element.scrollTop, action };
            t.setState({ eventDragPreview: t.buildEventDragPreview(startMinutes, duration, item, category) });
            document.addEventListener('mousemove', t.handleEventDragMove, true); document.addEventListener('mouseup', t.handleEventDragEnd, true);
        };
        wrap(t, 'buildEventDragPreview', (previous, startMinutes, duration, event, category) => {
            const result = previous(startMinutes, duration, event, category);
            if (startMinutes < 0) {
                const begin = day().add(startMinutes, 'minutes'), end = begin.clone().add(duration, 'minutes');
                Object.assign(result, { startMinutes, top: 0, height: Math.max(18, (startMinutes + duration) * t.getMinuteHeight()),
                    startTime: begin.valueOf(), endTime: end.valueOf(), label: begin.format('HH:mm') + ' - ' + end.format('HH:mm') });
            }
            return result;
        });
        wrap(t, 'componentDidMount', previous => { previous(); restoreScroll(); nowTimer = setInterval(() => t.setState({ focusNow: Date.now() }), 60000); });
        wrap(t, 'componentDidUpdate', (previous, oldProps, ...rest) => {
            previous(oldProps, ...rest);
            if (!t.getMoment(oldProps.date).isSame(day(), 'day')) { stopSelection(); if (t.state.focusSelection) t.setState({ focusSelection: null }); restoreScroll(); }
        });
        wrap(t, 'componentWillUnmount', previous => { stopSelection(); clearInterval(nowTimer); t.clearPendingEventDrag(); previous(); });
    }
    const api = { deadlineInSevenDays, layoutEvents, attachController, attachTimeline, renderShell, renderDay };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FocusCalendar = api;
})(typeof window === 'undefined' ? globalThis : window);
