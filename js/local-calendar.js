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
        const close = () => { overlay.remove(); if (focus && focus.isConnected) focus.focus(); };
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
        build(form, close); form.querySelector('input,select,button')?.focus(); return { close, form };
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
    function attachController(controller, options) {
        if (controller.focusCalendarAttached) return; controller.focusCalendarAttached = true;
        const c = controller, { React, moment, preference, taskManager, subtaskManager, startTask, actions: redux, events, eventTypes } = options;
        let quick = null, picker = null, saving = false, live = true;
        const invalidate = () => { c.calendarDayEventCache = { tasks: new Map(), subtasks: new Map(), projects: new Map() }; };
        const refresh = async () => {
            if (!c._isMounted || root.FocusLocalData.maintenance) return;
            invalidate(); await c.loadCalendarDayEntries();
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
            if (saving) return; quick?.dialog.close(); quick = null;
            if (live) c.setState({ focusCalendarPreview: null });
        };
        c.openQuickTask = (startTime, interval) => {
            if (saving || root.FocusLocalData.maintenance) return;
            c.cancelQuickTask(); picker?.close(); picker = null;
            startTime = Math.floor(startTime / 60000) * 60000;
            interval = Math.max(60, Math.min(10800, Math.round(interval / 60) * 60));
            const projectId = c.state.calendarSelectedProjectId;
            const projects = (c.props.projects || []).filter(row => row && row.state !== -1 && [1000, 7005].includes(row.type));
            const defaultProject = projects.find(row => row.id === projectId) || projects.find(row => row.type === 7005) || projects[0];
            quick = { startTime, interval, dialog: null };
            c.setState({ calendarPomodoroDetail: null, calendarScheduleDetail: null, showCalendarTasks: false,
                focusCalendarPreview: { id: 'local-calendar-preview', start: startTime, end: startTime + interval * 1000,
                    title: text('未指定任务'), category: 'scheduled', focusPreview: true } });
            quick.dialog = modal('添加任务', (form) => {
                const name = field(form, '任务名称', 'focus-calendar-name'); name.required = true; name.maxLength = 1000;
                const time = document.createElement('p'); time.textContent = moment(startTime).format('YYYY-MM-DD HH:mm'); form.append(time);
                const count = field(form, '预计番茄数', 'focus-calendar-count', 'number'); count.min = '1'; count.max = '99'; count.step = '1'; count.value = '1'; count.required = true;
                const minutes = field(form, '每个番茄（分钟）', 'focus-calendar-minutes', 'number');
                minutes.min = '1'; minutes.max = '180'; minutes.step = '1'; minutes.value = interval / 60; minutes.required = true;
                const list = field(form, '清单', 'focus-calendar-project', 'select');
                projects.forEach(project => {
                    const option = document.createElement('option'); option.value = project.id;
                    option.textContent = project.type === 7005 ? text('任务') : project.name; list.append(option);
                });
                if (defaultProject) list.value = defaultProject.id;
                const summary = document.createElement('p'); summary.className = 'focus-calendar-summary'; form.append(summary);
                const updatePreview = () => {
                    const seconds = Math.max(60, Math.min(10800, Number(minutes.value) * 60 || 60));
                    summary.textContent = count.value + ' × ' + minutes.value + text(' 分钟') + ' · ' + text('最多安排前 5 个番茄，间隔使用短休息时长。');
                    c.setState({ focusCalendarPreview: { ...c.state.focusCalendarPreview, title: name.value.trim() || text('未指定任务'), end: startTime + seconds * 1000 } });
                };
                name.oninput = count.oninput = minutes.oninput = updatePreview; updatePreview();
                const error = document.createElement('p'); error.setAttribute('role', 'alert'); form.append(error);
                const buttons = actions(form, c.cancelQuickTask);
                form.onsubmit = async event => {
                    event.preventDefault(); if (saving || !form.reportValidity()) return;
                    if (!name.value.trim()) { name.focus(); return; }
                    saving = true; buttons.save.disabled = buttons.back.disabled = true; error.textContent = '';
                    try {
                        const result = await root.FocusLocalData.createCalendarTask({ name: name.value, count: Number(count.value),
                            interval: Number(minutes.value) * 60, startTime, projectId: list.value,
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
            c.cancelQuickTask(); picker?.close();
            const cancel = () => { picker?.close(); picker = null; };
            picker = modal('选择日期', form => {
                const date = field(form, '日期', 'focus-calendar-date', 'date'); date.required = true;
                date.value = c.state.calendarDate.format('YYYY-MM-DD'); actions(form, cancel);
                form.onsubmit = e => { e.preventDefault(); if (!form.reportValidity()) return; c.setState({ calendarDate: moment(date.value).startOf('day') }); cancel(); };
            }, cancel);
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
            scheduledEvents: c.state.focusCalendarPreview ? [...c.state.calendarDayScheduledEvents, c.state.focusCalendarPreview] : c.state.calendarDayScheduledEvents,
            onTimeSlotDoubleClick: c.handleCalendarTimeSlotDoubleClick, onTimeRangeSelect: c.handleCalendarTimeRangeSelect,
            onEventStartPomodoro: c.handleCalendarEventStartPomodoro }));
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
            }
        });
        wrap(c, 'componentWillUnmount', previous => {
            live = false; quick?.dialog.close(); picker?.close(); quick = picker = null;
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
                const style = { ...theme.containerStyle, top, height, right: 'auto', width,
                    left: 'calc(6px + ' + row.column + ' * (' + width + ' + 4px))' };
                const duration = Math.max(1, Math.round((event.end - event.start) / 60000));
                const label = duration >= 60 ? Math.floor(duration / 60) + 'h' + (duration % 60 ? duration % 60 + 'm' : '') : duration + 'm';
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
                h('div', { className: 'focus-calendar-event-text' + (short ? ' focus-calendar-inline' : ''), style: theme.titleStyle },
                    h('span', { className: 'focus-calendar-event-title', style: short ? {} : { WebkitLineClamp: Math.max(1, Math.floor((height - 30) / 17)) } }, title),
                    h('span', { className: 'focus-calendar-event-duration', style: theme.timeStyle }, label)),
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
    const api = { deadlineInSevenDays, layoutEvents, attachController, attachTimeline };
    if (typeof module === 'object' && module.exports) module.exports = api;
    else root.FocusCalendar = api;
})(typeof window === 'undefined' ? globalThis : window);
