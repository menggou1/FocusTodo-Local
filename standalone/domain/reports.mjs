import { invariant } from '../services/errors.mjs';
export const visibleRecord = row => row && row.state !== -1 && Number.isFinite(row.interval) && row.interval > 0 && Number.isFinite(row.endDate) && row.endDate > 0;
export function aggregateRecords(records, start, end, tasks = []) {
    invariant(Number.isFinite(start) && Number.isFinite(end) && end > start, 'Invalid report range');
    let seconds = 0, count = 0; const byTask = Object.create(null), byProject = Object.create(null);
    const projects = new Map(tasks.map(row => [row.id, row.projectId]));
    for (const row of records.filter(visibleRecord)) {
        // Legacy report intervals are [start, end); overlap is elapsed time,
        // independent of wall-clock labels on DST days.
        if (row.endDate < start || row.endDate >= end + 28800000) continue;
        const amount = Math.max(0, (Math.min(end, row.endDate) - Math.max(start, row.endDate - row.interval * 1000)) / 1000);
        seconds += amount; count += Math.min(amount / row.pomodoroInterval, 1);
        const task = row.taskId || 'null', project = projects.get(row.taskId) || 'null';
        if (amount) { byTask[task] = (byTask[task] || 0) + amount; byProject[project] = (byProject[project] || 0) + amount; }
    }
    return { time: seconds, count, byTask: { ...byTask }, byProject: { ...byProject } };
}
export function calendarRange(value, unit = 'day') {
    const lower = new Date(value); lower.setHours(0, 0, 0, 0);
    if (unit === 'week') lower.setDate(lower.getDate() - (lower.getDay() + 6) % 7);
    else if (unit === 'month') lower.setDate(1);
    else if (unit === 'year') lower.setMonth(0, 1);
    else invariant(unit === 'day', 'Invalid report unit');
    const upper = new Date(lower);
    if (unit === 'month') upper.setMonth(upper.getMonth() + 1);
    else if (unit === 'year') upper.setFullYear(upper.getFullYear() + 1);
    else upper.setDate(upper.getDate() + (unit === 'week' ? 7 : 1));
    return { start: lower.getTime(), end: upper.getTime() };
}
export function reportBuckets(records, start, end, unit = 'day', tasks = []) {
    const result = []; let cursor = start;
    while (cursor < end) {
        invariant(result.length < 20000, 'Report range too large');
        const boundary = calendarRange(cursor, unit).end;
        const next = Math.min(boundary, end);
        result.push({ start: cursor, end: next, ...aggregateRecords(records, cursor, next, tasks) }); cursor = next;
    }
    return result;
}
export function reminderState(tasks, read, now) {
    const key = row => JSON.stringify([row.id, row.reminderDate]);
    const active = tasks.filter(row => row.state === 0 && !row.isFinished && Number.isFinite(row.reminderDate) && row.reminderDate > 0);
    const due = active.filter(row => row.reminderDate <= now).sort((a, b) => b.reminderDate - a.reminderDate);
    const seen = new Set(read);
    return { due, unread: due.filter(row => !seen.has(key(row))), next: active.reduce((next, row) => row.reminderDate > now ? Math.min(next, row.reminderDate) : next, Infinity) };
}
