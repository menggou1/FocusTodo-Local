import { invariant, snapshotSource } from './errors.mjs';
import { repetitionDeadline } from '../domain/recurrence.mjs';
import { aggregateRecords, reportBuckets, reminderState, visibleRecord, calendarRange } from '../domain/reports.mjs';

const tables = ['Project', 'Task', 'Subtask', 'Schedule', 'Pomodoro', 'TimerSession'];
const names = ['projects', 'tasks', 'subtasks', 'schedules', 'records', 'sessions'];
function collect(tx, done, fail, apply, beforeCommit = () => {}) {
    const values = {}; let pending = tables.length;
    for (let index = 0; index < tables.length; index++) {
        const request = tx.objectStore(tables[index]).getAll();
        request.onsuccess = () => {
            values[names[index]] = request.result;
            if (!--pending) { try { const result = apply(values); beforeCommit(tx); done(result); } catch (error) { fail(error); } }
        };
    }
}
export function createBusinessService({ data, core, now, randomUUID, settings, onError, fault = () => {} }) {
    const state = snapshotSource({ projects: [], tasks: [], subtasks: [], schedules: [], records: [], sessions: [] }, onError);
    let disposed = false, revision = 0;
    const refresh = async () => {
        invariant(!disposed, 'Service disposed', 'disposed'); const request = ++revision;
        const value = await data.read(tables, (tx, done, fail) => collect(tx, done, fail, value => value));
        if (request === revision) state.publish(value); return state.getSnapshot();
    };
    const projectDefaults = () => ({ id: randomUUID(), objType: 'PROJECT', creationDate: now(), state: 0, name: '', order: 0,
        color: 'AEBDC3', isDefault: false, parentId: '', orderingRule: 3, type: 1000, imageName: '', expanded: true, sync: 0 });
    const taskDefaults = () => ({ id: randomUUID(), objType: 'TASK', creationDate: now(), name: '', state: 0,
        estimatePomoNum: 0, actualPomoNum: 0, pomodoroInterval: settings.getSnapshot().workInterval,
        projectId: '', deadline: 0, isFinished: false, finishedDate: 0, reminderDate: 0,
        rCycle: 0, rFirstDeadline: 0, rUnit: '', rValue: '', rId: '', rStartDate: 0, rEndDate: 0,
        reminders: '', remark: '', order: 0, hasSubtask: false, isExpanded: false, priority: 0, tags: '', sync: 0 });
    const subtaskDefaults = () => ({ id: randomUUID(), objType: 'SUBTASK', creationDate: now(), name: '', state: 0,
        estimatedPomoNum: 0, taskId: '', isFinished: false, finishedDate: 0, order: 0, sync: 0 });
    const command = async request => {
        invariant(!disposed, 'Service disposed', 'disposed'); let input = structuredClone(request);
        const batch = input.type === 'batch' ? input.commands : null;
        if (batch) invariant(Array.isArray(batch) && batch.length > 0 && batch.length <= 2000 && batch.every(item => ['updateTask','addSubtask','updateSubtask','removeSubtask','updateProject','removeProject'].includes(item.type)), 'Invalid atomic command batch');
        const result = await data.write(tables, (tx, done, fail) => collect(tx, done, fail, values => {
            const find = (name, id) => { const row = values[name].find(row => row.id === id && row.state !== -1); invariant(row, 'Record no longer exists', 'conflict'); return row; };
            const put = (table, row) => { tx.objectStore(table).put(row); const list = values[names[tables.indexOf(table)]]; const index = list.findIndex(item => item.id === row.id); if (index >= 0) list[index] = row; else list.push(row); return row; };
            const update = (table, row, changes) => put(table, { ...row, ...changes, id: row.id, sync: 0 });
            const check = row => {
                if (input.expected) invariant(Object.entries(input.expected).every(([key, value]) => JSON.stringify(row[key]) === JSON.stringify(value)), 'Record changed; refresh and retry', 'conflict');
            };
            const detach = predicate => {
                const session = values.sessions.find(row => row.id === 'active');
                if (session && predicate(session)) {
                    const result = core.reduce(session, { type: 'detach', expectedSession: session.sessionId }, now());
                    for (const row of result.records) tx.objectStore('Pomodoro').add(row);
                    tx.objectStore('TimerSession').put(result.session);
                    values.records.push(...result.records); values.sessions = [result.session];
                }
            };
            const spawnRepetition = task => {
                let next;
                    const deadline = repetitionDeadline(task, now());
                    next = { ...taskDefaults(), ...Object.fromEntries(['name','estimatePomoNum','projectId','rCycle','rFirstDeadline','rUnit','rValue','tags','remark','priority','pomodoroInterval'].map(key => [key, task[key]])),
                        deadline, rId: task.rId || randomUUID() };
                    if (task.reminderDate) next.reminderDate = task.reminderDate + new Date(deadline).setHours(23,59,59,999) - new Date(task.deadline).setHours(23,59,59,999);
                    const peers = values.tasks.filter(row => row.projectId === task.projectId && row.state === 0 && !row.isFinished);
                    if (peers.length) next.order = peers.reduce((minimum, task) => Math.min(minimum, task.order), Infinity) - 10000;
                    tx.objectStore('Task').add(next);
                    for (const child of values.subtasks.filter(child => child.taskId === task.id && child.state === 0)) tx.objectStore('Subtask').add({ ...subtaskDefaults(), name: child.name, order: child.order, taskId: next.id });
                return next;
            };
            const removeTask = (task, preserveHistory = false) => {
                detach(session => session.taskId === task.id);
                update('Task', task, { state: -1 });
                for (const row of values.subtasks.filter(row => row.taskId === task.id && row.state === 0)) update('Subtask', row, { state: -1 });
                if (!preserveHistory) for (const row of values.records.filter(row => row.taskId === task.id && row.state !== -1)) update('Pomodoro', row, { state: -1 });
                return { ...task, state: -1, sync: 0 };
            };
            const title = row => invariant(typeof row.name === 'string' && row.name.trim() && row.name.length <= 1000, 'Name must contain 1–1000 characters');
            const apply = request => { input = request; switch (input.type) {
            case 'addProject': {
                const row = { ...projectDefaults(), ...input.values }; title(row);
                invariant([1000, 2000, 3000].includes(row.type), 'Unsupported project type');
                tx.objectStore('Project').add(row); return row;
            }
            case 'updateProject': {
                const row = find('projects', input.id); check(row);
                const changes = input.changes || {}; if ('name' in changes) title(changes);
                if (changes.parentId) {
                    invariant(row.type !== 2000 && changes.parentId !== row.id && find('projects', changes.parentId).type === 2000, 'Invalid folder parent');
                }
                return update('Project', row, changes);
            }
            case 'removeProject': {
                const row = find('projects', input.id); check(row); invariant(row.type < 4000, 'Preset views cannot be deleted');
                if (row.type === 1000) for (const task of values.tasks.filter(task => task.projectId === row.id && task.state === 0)) removeTask(task);
                if (row.type === 2000) for (const child of values.projects.filter(child => child.parentId === row.id && child.state !== -1)) update('Project', child, { parentId: '' });
                if (row.type === 3000) for (const task of values.tasks.filter(task => task.state !== -1 && String(task.tags || '').split(',').includes(row.id))) {
                    update('Task', task, { tags: String(task.tags || '').split(',').filter(id => id && id !== row.id).join(',') });
                }
                return update('Project', row, { state: -1 });
            }
            case 'setProjectHidden': {
                const row = find('projects', input.id); check(row); const state = input.hidden ? 1 : 0;
                for (const task of values.tasks.filter(task => task.projectId === row.id && task.state === (input.hidden ? 0 : 1))) {
                    detach(session => session.taskId === task.id); update('Task', task, { state });
                    for (const child of values.subtasks.filter(child => child.taskId === task.id && child.state === (input.hidden ? 0 : 1))) update('Subtask', child, { state });
                }
                return update('Project', row, { state });
            }
            case 'reorderProjects': {
                const rows = input.snapshot.map(expected => { const row = find('projects', expected.id); invariant(row.order === expected.order, 'List order changed', 'conflict'); return row; });
                const slots = rows.map(row => row.order).sort((a, b) => a - b);
                invariant(slots.every((order, index) => Number.isFinite(order) && (!index || order !== slots[index - 1])), 'Invalid order slots');
                const from = rows.findIndex(row => row.id === input.from), to = rows.findIndex(row => row.id === input.to);
                invariant(from >= 0 && to >= 0, 'Unknown list in reorder'); rows.splice(to, 0, rows.splice(from, 1)[0]);
                return rows.map((row, index) => put('Project', { ...row, order: slots[index] }));
            }
            case 'restoreProjectOrder': {
                const defaults = new Map(data.defaultProjects().map(row => [row.id, row]));
                return values.projects.filter(row => defaults.get(row.id)?.type === row.type).map(row => put('Project', { ...row, order: defaults.get(row.id).order }));
            }
            case 'addTask': {
                const row = { ...taskDefaults(), ...input.values }; title(row);
                invariant(!row.projectId || [1000, 7005].includes(find('projects', row.projectId).type), 'Invalid task project');
                tx.objectStore('Task').add(row); return row;
            }
            case 'updateTask': {
                const row = find('tasks', input.id); check(row); const changes = input.changes || {};
                if ('name' in changes) title(changes);
                if (changes.projectId) invariant([1000, 7005].includes(find('projects', changes.projectId).type), 'Invalid task project');
                return update('Task', row, changes);
            }
            case 'removeTask': { const row = find('tasks', input.id); check(row); if(input.repeat==='current'&&row.rCycle&&!row.isFinished)spawnRepetition(row); return removeTask(row, !!input.preserveHistory); }
            case 'completeTask': {
                const row = find('tasks', input.id); check(row); let next = null;
                invariant(!row.isFinished, 'Task already completed', 'conflict');
                detach(session => session.taskId === row.id);
                if (row.rCycle) {
                    next = spawnRepetition(row);
                }
                const finished = update('Task', row, { isFinished: true, finishedDate: now(), rCycle: 0, rUnit: '', rValue: '', rFirstDeadline: 0 });
                return { finishedTask: finished, newTask: next };
            }
            case 'uncompleteTask': { const row = find('tasks', input.id); check(row); return update('Task', row, { isFinished: false, finishedDate: 0 }); }
            case 'addSubtask': {
                const row = { ...subtaskDefaults(), ...input.values }; title(row); find('tasks', row.taskId);
                tx.objectStore('Subtask').add(row); return row;
            }
            case 'updateSubtask': case 'toggleSubtask': case 'removeSubtask': {
                const row = find('subtasks', input.id); check(row);
                const changes = input.type === 'toggleSubtask' ? { isFinished: !row.isFinished, finishedDate: row.isFinished ? 0 : now() }
                    : input.type === 'removeSubtask' ? { state: -1 } : input.changes || {};
                if ('name' in changes) title(changes);
                if (input.type === 'removeSubtask' || changes.isFinished === true) detach(session => session.subtaskId === row.id);
                return update('Subtask', row, changes);
            }
            case 'addSchedule': {
                const row = { id: randomUUID(), objType: 'SCHEDULE', creationDate: now(), state: 0, isAllDay: false, subtaskId: '', taskId: '', sync: 0, ...input.values };
                invariant(Number.isFinite(row.endDate) && row.interval >= 60 && row.interval <= 28800, 'Invalid schedule');
                tx.objectStore('Schedule').add(row); return row;
            }
            case 'updateSchedule': case 'removeSchedule': {
                const row = find('schedules', input.id); check(row);
                const next = { ...row, ...(input.type === 'removeSchedule' ? { state: -1 } : input.changes) };
                invariant(Number.isFinite(next.endDate) && next.interval >= 60 && next.interval <= 28800, 'Invalid schedule');
                return update('Schedule', row, next);
            }
            case 'addRecord': case 'updateRecord': case 'removeRecord': {
                const row = input.type === 'addRecord' ? { id: randomUUID(), objType: 'POMODORO', creationDate: now(), state: 0,
                    endDate: now(), isManual: true, subtaskId: '', taskId: '', sync: 0, ...input.values } : find('records', input.id);
                check(row);
                const next = { ...row, ...(input.type === 'removeRecord' ? { state: -1 } : input.changes || {}) };
                invariant(visibleRecord({ ...next, state: 0 }) && next.interval <= 28800 && next.pomodoroInterval > 0 && next.pomodoroInterval <= 28800, 'Invalid focus record');
                if (input.type === 'addRecord') tx.objectStore('Pomodoro').add(next); else update('Pomodoro', row, next);
                return next;
            }
            default: invariant(false, 'Unknown business command');
            }}; return batch ? batch.map(apply) : apply(input);
        }, tx => fault('business-commit', { transaction: tx })));
        await refresh(); data.changed('timer'); return result;
    };
    return Object.freeze({
        getSnapshot: state.getSnapshot, subscribe: state.subscribe, refresh, command,
        batch: commands => command({type:'batch',commands}),
        search(keyword) {
            const query = String(keyword).trim().toLowerCase(); if (!query) return [];
            const value = state.getSnapshot(), tags = new Map(value.projects.filter(row => row.type === 3000 && row.state === 0).map(row => [row.id, row.name.toLowerCase()]));
            return value.tasks.filter(row => row.state === 0 && ([row.name, row.remark].some(text => String(text || '').toLowerCase().includes(query))
                || String(row.tags || '').split(',').some(id => tags.get(id.trim())?.includes(query))
                || value.subtasks.some(child => child.taskId === row.id && child.state === 0 && child.name.toLowerCase().includes(query))));
        },
        report(start, end) { const value = state.getSnapshot(); return aggregateRecords(value.records, start, end, value.tasks); },
        tasksInView(view, finished = false) {
            const {start,end} = calendarRange(now()), tomorrow = calendarRange(end), week = calendarRange(now(),'week');
            const seven = new Date(start); seven.setDate(seven.getDate()+7);
            const match = row => {
                switch (view.type) {
                case 1000: case 7005: return row.projectId === view.id;
                case 7000: return true;
                case 4000: return row.deadline >= 1 && row.deadline < end;
                case 4001: return row.deadline >= tomorrow.start && row.deadline < tomorrow.end;
                case 4002: return row.deadline > 0;
                case 4003: return row.deadline === 0;
                case 4004: return row.deadline >= start && row.deadline < seven.getTime();
                case 4006: return row.deadline > 0 && row.deadline < start;
                case 4007: return row.deadline >= week.start && row.deadline < week.end;
                case 5001: case 5002: case 5003: return row.priority === view.type - 5000;
                default: return false;
                }
            };
            return state.getSnapshot().tasks.filter(row=>row.state===0&&row.isFinished===finished&&match(row)).slice().sort((a,b)=>
                view.type>=4000&&view.type<5000?(a.deadline-b.deadline||a.id.localeCompare(b.id)):a.id.localeCompare(b.id));
        },
        history({start = 0, end = Infinity, taskId, subtaskId} = {}) {
            return state.getSnapshot().records.filter(row=>visibleRecord(row)&&row.endDate>=start&&row.endDate<end&&
                (taskId===undefined||row.taskId===taskId)&&(subtaskId===undefined||row.subtaskId===subtaskId)).slice().sort((a,b)=>b.endDate-a.endDate||a.id.localeCompare(b.id));
        },
        progress(taskId) { return state.getSnapshot().records.filter(row=>visibleRecord(row)&&row.taskId===taskId).map(row=>Math.max(0,Math.min(row.interval/row.pomodoroInterval,1))); },
        buckets(start, end, unit) { const value = state.getSnapshot(); return reportBuckets(value.records, start, end, unit, value.tasks); },
        reminders(read = []) { return reminderState(state.getSnapshot().tasks, read, now()); },
        dispose() { disposed = true; revision++; state.dispose(); },
    });
}
